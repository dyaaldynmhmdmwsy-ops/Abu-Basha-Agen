"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const STATES = Object.freeze([
  "RECEIVED",
  "UNDERSTOOD",
  "PLANNED",
  "VERIFIED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "RECOVERABLE",
  "RECOVERY_REQUIRED"
]);

const TRANSITIONS = Object.freeze({
  RECEIVED: ["UNDERSTOOD", "FAILED"],
  UNDERSTOOD: ["PLANNED", "FAILED"],
  PLANNED: ["VERIFIED", "FAILED"],
  VERIFIED: ["AWAITING_APPROVAL", "FAILED"],
  AWAITING_APPROVAL: ["APPROVED", "FAILED", "RECOVERY_REQUIRED"],
  APPROVED: ["EXECUTING", "RECOVERY_REQUIRED", "FAILED"],
  EXECUTING: ["COMPLETED", "FAILED", "RECOVERABLE", "RECOVERY_REQUIRED"],
  COMPLETED: [],
  FAILED: ["RECOVERABLE", "RECOVERY_REQUIRED"],
  RECOVERABLE: ["RECOVERY_REQUIRED"],
  RECOVERY_REQUIRED: ["AWAITING_APPROVAL", "FAILED"]
});

class SessionStateManager {
  constructor(options = {}) {
    this.name = "Session State Manager";
    this.version = "1.0.0";
    this.phase = 15;
    this.safe = true;
    this.readOnly = false;
    this.autoFix = false;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.failClosed = true;
    this.requiresApproval = true;
    this.executionEnabled = false;

    this.dbPath = options.dbPath ||
      path.resolve(process.cwd(), "data", "agent-state.sqlite");

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    this.db = new DatabaseSync(this.dbPath);
    this.initializeSchema();
  }

  initializeSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        plan_id TEXT,
        approval_id TEXT,
        context_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS state_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        revision INTEGER NOT NULL,
        reason TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id)
      );

      CREATE INDEX IF NOT EXISTS idx_state_transitions_session
        ON state_transitions(session_id, id);
    `);
  }

  createSession(sessionId, context = {}) {
    const id = String(sessionId || "").trim();

    if (!id) {
      return {
        success: false,
        type: "invalid_session_id"
      };
    }

    const existing = this.getSession(id);

    if (existing) {
      return {
        success: true,
        type: "session_exists",
        session: existing
      };
    }

    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO sessions (
        session_id,
        state,
        revision,
        context_json,
        created_at,
        updated_at
      )
      VALUES (?, ?, 0, ?, ?, ?)
    `).run(
      id,
      "RECEIVED",
      JSON.stringify(context || {}),
      now,
      now
    );

    this.db.prepare(`
      INSERT INTO state_transitions (
        session_id,
        from_state,
        to_state,
        revision,
        reason,
        metadata_json,
        created_at
      )
      VALUES (?, NULL, ?, 0, ?, ?, ?)
    `).run(
      id,
      "RECEIVED",
      "session_created",
      "{}",
      now
    );

    return {
      success: true,
      type: "session_created",
      session: this.getSession(id)
    };
  }

  getSession(sessionId) {
    const id = String(sessionId || "").trim();

    if (!id) {
      return null;
    }

    const row = this.db.prepare(`
      SELECT
        session_id,
        state,
        revision,
        plan_id,
        approval_id,
        context_json,
        created_at,
        updated_at
      FROM sessions
      WHERE session_id = ?
    `).get(id);

    if (!row) {
      return null;
    }

    return {
      ...row,
      context: this.parseJson(row.context_json)
    };
  }

  transition(sessionId, nextState, options = {}) {
    const id = String(sessionId || "").trim();
    const target = String(nextState || "").trim();

    if (!id || !STATES.includes(target)) {
      return {
        success: false,
        type: "invalid_state_transition",
        reason: "INVALID_SESSION_OR_STATE"
      };
    }

    const current = this.getSession(id);

    if (!current) {
      return {
        success: false,
        type: "session_not_found"
      };
    }

    if (current.state === target) {
      return {
        success: true,
        type: "transition_idempotent",
        session: current
      };
    }

    const allowed = TRANSITIONS[current.state] || [];

    if (!allowed.includes(target)) {
      return {
        success: false,
        type: "transition_rejected",
        reason: "INVALID_STATE_TRANSITION",
        from: current.state,
        to: target
      };
    }

    const now = new Date().toISOString();
    const revision = current.revision + 1;
    const reason = String(options.reason || "state_transition");
    const metadata = JSON.stringify(options.metadata || {});

    try {
      this.db.exec("BEGIN IMMEDIATE");

      this.db.prepare(`
        UPDATE sessions
        SET
          state = ?,
          revision = ?,
          plan_id = COALESCE(?, plan_id),
          approval_id = COALESCE(?, approval_id),
          updated_at = ?
        WHERE session_id = ? AND revision = ?
      `).run(
        target,
        revision,
        options.planId || null,
        options.approvalId || null,
        now,
        id,
        current.revision
      );

      const updated = this.getSession(id);

      if (!updated || updated.revision !== revision) {
        throw new Error("SESSION_REVISION_CONFLICT");
      }

      this.db.prepare(`
        INSERT INTO state_transitions (
          session_id,
          from_state,
          to_state,
          revision,
          reason,
          metadata_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        current.state,
        target,
        revision,
        reason,
        metadata,
        now
      );

      this.db.exec("COMMIT");

      return {
        success: true,
        type: "state_transitioned",
        session: this.getSession(id)
      };
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch (_) {}

      return {
        success: false,
        type: "transition_failed",
        reason: error.message
      };
    }
  }

  getTransitions(sessionId) {
    const id = String(sessionId || "").trim();

    if (!id) {
      return [];
    }

    return this.db.prepare(`
      SELECT
        id,
        session_id,
        from_state,
        to_state,
        revision,
        reason,
        metadata_json,
        created_at
      FROM state_transitions
      WHERE session_id = ?
      ORDER BY id ASC
    `).all(id).map(row => ({
      ...row,
      metadata: this.parseJson(row.metadata_json)
    }));
  }

  recover(sessionId) {
    const session = this.getSession(sessionId);

    if (!session) {
      return {
        success: false,
        type: "recovery_session_not_found"
      };
    }

    return {
      success: true,
      type: "session_recovered",
      executable: false,
      executionStarted: false,
      requiresApproval: true,
      session,
      transitions: this.getTransitions(session.session_id)
    };
  }

  inspect(sessionId) {
    return this.recover(sessionId);
  }

  parseJson(value) {
    try {
      return JSON.parse(value || "{}");
    } catch (_) {
      return {};
    }
  }

  getStatus() {
    return {
      phase: this.phase,
      component: this.name,
      version: this.version,
      safe: this.safe,
      readOnly: this.readOnly,
      autoFix: this.autoFix,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      failClosed: this.failClosed,
      requiresApproval: this.requiresApproval,
      executionEnabled: this.executionEnabled,
      database: "sqlite",
      stateCount: STATES.length
    };
  }

  close() {
    this.db.close();
  }
}

SessionStateManager.STATES = STATES;
SessionStateManager.TRANSITIONS = TRANSITIONS;

module.exports = SessionStateManager;

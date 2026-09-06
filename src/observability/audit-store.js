"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

class AuditStore {
  constructor(options = {}) {
    this.name = "Central Audit Store";
    this.version = "1.0.0";
    this.safe = true;
    this.readOnly = false;
    this.failClosed = true;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.executionEnabled = false;
    this.requiresApproval = true;

    this.dbPath = options.dbPath ||
      path.resolve(process.cwd(), "data", "agent-state.sqlite");

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        session_id TEXT,
        correlation_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        component TEXT NOT NULL,
        action TEXT,
        tool TEXT,
        connector TEXT,
        approval_id TEXT,
        approval_required INTEGER NOT NULL DEFAULT 1,
        approved INTEGER NOT NULL DEFAULT 0,
        execution_allowed INTEGER NOT NULL DEFAULT 0,
        external_execution INTEGER NOT NULL DEFAULT 0,
        success INTEGER NOT NULL DEFAULT 0,
        result_type TEXT,
        error_type TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_events_session
        ON audit_events(session_id, id);

      CREATE INDEX IF NOT EXISTS idx_audit_events_correlation
        ON audit_events(correlation_id, id);

      CREATE INDEX IF NOT EXISTS idx_audit_events_created
        ON audit_events(created_at, id);
    `);
  }

  sanitizeMetadata(metadata = {}) {
    if (!metadata || typeof metadata !== "object") {
      return {};
    }

    const blocked = new Set([
      "apiKey",
      "apikey",
      "api_key",
      "authorization",
      "token",
      "accessToken",
      "refreshToken",
      "secret",
      "password",
      "prompt",
      "userPrompt",
      "rawPrompt",
      "payload"
    ]);

    const output = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (blocked.has(key)) continue;

      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        output[key] = value;
      }
    }

    return output;
  }

  append(event = {}) {
    const eventId = String(
      event.eventId || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    );

    const correlationId = String(
      event.correlationId || event.sessionId || eventId
    );

    const sessionId =
      event.sessionId === undefined ||
      event.sessionId === null ||
      String(event.sessionId).trim() === ""
        ? null
        : String(event.sessionId).trim();

    const now = new Date().toISOString();
    const metadata = JSON.stringify(
      this.sanitizeMetadata(event.metadata || {})
    );

    try {
      this.db.prepare(`
        INSERT INTO audit_events (
          event_id,
          session_id,
          correlation_id,
          event_type,
          source,
          component,
          action,
          tool,
          connector,
          approval_id,
          approval_required,
          approved,
          execution_allowed,
          external_execution,
          success,
          result_type,
          error_type,
          metadata_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        sessionId,
        correlationId,
        String(event.eventType || "unknown"),
        String(event.source || "unknown"),
        String(event.component || "unknown"),
        event.action ? String(event.action) : null,
        event.tool ? String(event.tool) : null,
        event.connector ? String(event.connector) : null,
        event.approvalId ? String(event.approvalId) : null,
        event.approvalRequired === false ? 0 : 1,
        event.approved === true ? 1 : 0,
        event.executionAllowed === true ? 1 : 0,
        event.externalExecution === true ? 1 : 0,
        event.success === true ? 1 : 0,
        event.resultType ? String(event.resultType) : null,
        event.errorType ? String(event.errorType) : null,
        metadata,
        now
      );

      return {
        success: true,
        type: "audit_event_recorded",
        eventId,
        correlationId
      };
    } catch (error) {
      return {
        success: false,
        type: "audit_event_record_failed",
        failClosed: true,
        executionAllowed: false,
        message: error.message
      };
    }
  }

  getEvents(options = {}) {
    const limit = Math.max(
      1,
      Math.min(Number(options.limit) || 100, 1000)
    );

    const rows = this.db.prepare(`
      SELECT
        id,
        event_id,
        session_id,
        correlation_id,
        event_type,
        source,
        component,
        action,
        tool,
        connector,
        approval_id,
        approval_required,
        approved,
        execution_allowed,
        external_execution,
        success,
        result_type,
        error_type,
        metadata_json,
        created_at
      FROM audit_events
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);

    return rows.map(row => ({
      ...row,
      approval_required: row.approval_required === 1,
      approved: row.approved === 1,
      execution_allowed: row.execution_allowed === 1,
      external_execution: row.external_execution === 1,
      success: row.success === 1,
      metadata: this.parseJson(row.metadata_json)
    }));
  }

  getStatus() {
    const row = this.db.prepare(
      "SELECT COUNT(*) AS count FROM audit_events"
    ).get();

    return {
      name: this.name,
      version: this.version,
      status: "online",
      safe: this.safe,
      readOnly: this.readOnly,
      failClosed: this.failClosed,
      database: "sqlite",
      table: "audit_events",
      eventCount: Number(row?.count || 0),
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      executionEnabled: this.executionEnabled,
      requiresApproval: this.requiresApproval
    };
  }

  parseJson(value) {
    try {
      return JSON.parse(value || "{}");
    } catch (_) {
      return {};
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = AuditStore;

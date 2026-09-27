"use strict";

const { execFile } = require("node:child_process");
const path = require("node:path");

const ALLOWED_ACTIONS = Object.freeze({
  build: Object.freeze({
    command: "npm",
    args: Object.freeze(["run", "build"]),
  }),
  test: Object.freeze({
    command: "npm",
    args: Object.freeze(["test"]),
  }),
  debug: Object.freeze({
    command: "npm",
    args: Object.freeze(["run", "gate:targeted"]),
  }),
  release: Object.freeze({
    command: "npm",
    args: Object.freeze(["run", "release"]),
  }),
});

class DevelopmentPipelineExecutor {
  constructor(options = {}) {
    this.projectRoot = path.resolve(
      options.projectRoot || process.cwd()
    );

    this.executionGate = options.executionGate || null;

    this.failClosed = options.failClosed !== false;
    this.externalExecution = options.externalExecution === true;
    this.autonomousExecution = options.autonomousExecution === true;
    this.requiresApproval = options.requiresApproval !== false;

    this.version = "1.0.0";
  }

  getStatus() {
    return {
      success: true,
      type: "development_pipeline_executor_status",
      version: this.version,
      failClosed: this.failClosed,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      requiresApproval: this.requiresApproval,
      executable: true,
      executionBoundary: "execution-gate",
      supportedActions: Object.keys(ALLOWED_ACTIONS),
    };
  }

  getAction(action) {
    if (typeof action !== "string") {
      return null;
    }

    const normalized = action.trim().toLowerCase();
    return ALLOWED_ACTIONS[normalized] || null;
  }

  canExecute(request = {}, context = {}) {
    if (!this.failClosed) {
      return {
        allowed: false,
        reason: "fail_closed_required",
      };
    }

    if (this.autonomousExecution) {
      return {
        allowed: false,
        reason: "autonomous_execution_forbidden",
      };
    }

    const action = this.getAction(request.action);

    if (!action) {
      return {
        allowed: false,
        reason: "operation_not_allowed",
      };
    }

    if (this.requiresApproval && context.approved !== true) {
      return {
        allowed: false,
        reason: "approval_required",
      };
    }

    if (this.executionGate && typeof this.executionGate.check === "function") {
      const gate = this.executionGate.check({
        externalExecution: this.externalExecution,
        requiresApproval: this.requiresApproval,
        approved: context.approved === true,
      });

      if (!gate || gate.allowed !== true) {
        return {
          allowed: false,
          reason: gate?.reason || "execution_gate_blocked",
        };
      }
    }

    return {
      allowed: true,
      command: action.command,
      args: [...action.args],
      cwd: this.projectRoot,
    };
  }

  execute(request = {}, context = {}) {
    const decision = this.canExecute(request, context);

    if (!decision.allowed) {
      return Promise.resolve({
        success: false,
        type: "development_pipeline_execution",
        failClosed: this.failClosed,
        blocked: true,
        reason: decision.reason,
      });
    }

    return new Promise((resolve) => {
      const startedAt = new Date().toISOString();

      execFile(
        decision.command,
        decision.args,
        {
          cwd: this.projectRoot,
          shell: false,
          windowsHide: true,
          timeout: Number.isFinite(context.timeoutMs)
            ? Math.max(1000, Math.min(context.timeoutMs, 15 * 60 * 1000))
            : 15 * 60 * 1000,
          maxBuffer: 2 * 1024 * 1024,
          env: {
            ...process.env,
            CI: process.env.CI || "1",
          },
        },
        (error, stdout, stderr) => {
          const finishedAt = new Date().toISOString();

          resolve({
            success: !error,
            type: "development_pipeline_execution",
            action: request.action,
            command: decision.command,
            args: decision.args,
            cwd: decision.cwd,
            startedAt,
            finishedAt,
            exitCode:
              typeof error?.code === "number"
                ? error.code
                : error
                  ? 1
                  : 0,
            stdout: String(stdout || "").slice(-20000),
            stderr: String(stderr || "").slice(-20000),
            failClosed: this.failClosed,
            approved: context.approved === true,
          });
        }
      );
    });
  }
}

module.exports = DevelopmentPipelineExecutor;

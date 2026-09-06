"use strict";

const cp = require("child_process");
const path = require("path");

class ProjectAuditProvider {
  constructor(options = {}) {
    this.name = "project-audit";
    this.type = "project-audit-provider";
    this.version = "1.0.0";

    this.root = path.resolve(
      options.root || path.join(__dirname, "../../..")
    );

    this.safe = true;
    this.readOnly = true;
    this.autoFix = false;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.failClosed = true;
    this.requiresApproval = true;
  }

  run() {
    const startedAt = Date.now();

    const result = cp.spawnSync(
      "node",
      ["tools/full-project-audit.js"],
      {
        cwd: this.root,
        env: {
          ...process.env,
          PROJECT_AUDIT_READ_ONLY: "1",
          PROJECT_AUDIT_SKIP_NPM_TEST: "1"
        },
        encoding: "utf8",
        timeout: 180000,
        killSignal: "SIGTERM",
        maxBuffer: 16 * 1024 * 1024
      }
    );

    const stdout = (result.stdout || "").trim();
    const stderr = (result.stderr || "").trim();

    let status = "FAIL";

    if (result.error) {
      status = "FAIL";
    } else if (result.status === 0) {
      status = stdout.includes("SYSTEM STATUS : PASS")
        ? "PASS"
        : "WARN";
    }

    return {
      success: result.status === 0 && !result.error,
      status,
      provider: this.name,
      type: this.type,
      version: this.version,
      safe: this.safe,
      readOnly: this.readOnly,
      autoFix: this.autoFix,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      failClosed: this.failClosed,
      requiresApproval: this.requiresApproval,
      checks: 1,
      exitCode: result.status,
      durationMs: Date.now() - startedAt,
      stdout,
      stderr,
      error: result.error ? String(result.error.message || result.error) : null
    };
  }

  inspect() {
    return this.run();
  }

  diagnose() {
    return this.run();
  }

  getStatus() {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      root: this.root,
      safe: this.safe,
      readOnly: this.readOnly,
      autoFix: this.autoFix,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      failClosed: this.failClosed,
      requiresApproval: this.requiresApproval
    };
  }
}

module.exports = ProjectAuditProvider;

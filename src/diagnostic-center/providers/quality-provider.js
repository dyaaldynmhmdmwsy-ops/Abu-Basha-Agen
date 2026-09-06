"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

class QualityProvider {
  constructor(options = {}) {
    this.name = "quality";
    this.type = "quality-provider";
    this.version = "1.0.0";
    this.root = options.root || path.resolve(__dirname, "../../..");

    this.safe = true;
    this.readOnly = true;
    this.autoFix = false;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.failClosed = true;
  }

  run() {
    const startedAt = Date.now();
    const tool = path.join(
      this.root,
      "tools",
      "quality",
      "quality-gate.js"
    );

    const result = spawnSync(
      "node",
      [tool],
      {
        cwd: this.root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    const stdout = (result.stdout || "").trim();
    const stderr = (result.stderr || "").trim();
    const exitCode =
      typeof result.status === "number" ? result.status : 1;

    const passedMatch = stdout.match(/PASSED=(\d+)/);
    const failedMatch = stdout.match(/FAILED=(\d+)/);
    const reportMatch = stdout.match(/REPORT=(.+)/);

    const passed = passedMatch ? Number(passedMatch[1]) : 0;
    const failed = failedMatch ? Number(failedMatch[1]) : 0;

    return {
      success: exitCode === 0 && failed === 0,
      status: exitCode === 0 && failed === 0 ? "PASS" : "FAIL",
      provider: this.name,
      checks: [
        {
          name: "quality-gate",
          success: exitCode === 0 && failed === 0,
          exitCode,
          passed,
          failed
        }
      ],
      findings:
        failed > 0
          ? [`Quality Gate reported ${failed} failed gate(s).`]
          : [],
      recommendations:
        failed > 0
          ? ["Inspect reports/quality-gate.json before making changes."]
          : [],
      duration: Date.now() - startedAt,
      error:
        exitCode !== 0
          ? stderr || stdout || "Quality Gate failed."
          : null,
      reportPath: reportMatch ? reportMatch[1].trim() : null,
      stdout,
      stderr
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
      safe: this.safe,
      readOnly: this.readOnly,
      autoFix: this.autoFix,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      failClosed: this.failClosed
    };
  }
}

module.exports = QualityProvider;

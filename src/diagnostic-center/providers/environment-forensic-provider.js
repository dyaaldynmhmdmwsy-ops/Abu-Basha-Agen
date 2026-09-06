"use strict";

const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

class EnvironmentForensicProvider {
  constructor(options = {}) {
    this.name = "environment-forensic";
    this.type = "environment-forensic-provider";
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

  runCommand(command, args = []) {
    const startedAt = Date.now();

    const result = cp.spawnSync(command, args, {
      cwd: this.root,
      encoding: "utf8",
      timeout: 10000,
      env: process.env
    });

    return {
      command,
      args,
      exitCode: typeof result.status === "number" ? result.status : null,
      success: result.status === 0 && !result.error,
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
      error: result.error
        ? String(result.error.message || result.error)
        : null,
      durationMs: Date.now() - startedAt
    };
  }

  checkCommand(name, command, args = []) {
    const result = this.runCommand(command, args);

    return {
      name,
      status: result.success ? "PASS" : "WARN",
      ...result
    };
  }

  inspect() {
    return this.run();
  }

  diagnose() {
    return this.run();
  }

  run() {
    const startedAt = Date.now();
    const checks = [];

    checks.push(
      this.checkCommand("node", "node", ["--version"])
    );

    checks.push(
      this.checkCommand("npm", "npm", ["--version"])
    );

    checks.push(
      this.checkCommand("git", "git", ["--version"])
    );

    checks.push(
      this.checkCommand("bash", "bash", ["--version"])
    );

    checks.push(
      this.checkCommand("java", "java", ["-version"])
    );

    checks.push(
      this.checkCommand("javac", "javac", ["-version"])
    );

    checks.push(
      this.checkCommand("adb", "adb", ["version"])
    );

    checks.push(
      this.checkCommand("npm-prefix", "npm", ["config", "get", "prefix"])
    );

    checks.push(
      this.checkCommand("npm-root", "npm", ["root", "-g"])
    );

    const importantPaths = [
      "package.json",
      "package-lock.json",
      "src",
      "tests",
      "tools",
      "reports",
      "backups"
    ];

    for (const relativePath of importantPaths) {
      const target = path.join(this.root, relativePath);

      checks.push({
        name: `path:${relativePath}`,
        status: fs.existsSync(target) ? "PASS" : "WARN",
        path: target,
        exists: fs.existsSync(target)
      });
    }

    const resolvedNode = this.runCommand("bash", [
      "-lc",
      "command -v node"
    ]);

    checks.push({
      name: "resolved-node",
      status: resolvedNode.success ? "PASS" : "FAIL",
      ...resolvedNode
    });

    const nodeExecPath = process.execPath;

    checks.push({
      name: "node-exec-path",
      status:
        nodeExecPath && nodeExecPath !== "/apex/com.android.runtime/bin/linker64"
          ? "PASS"
          : "WARN",
      execPath: nodeExecPath,
      note:
        "Diagnostic only. Termux may expose an Android linker path through process.execPath."
    });

    const packageFile = path.join(this.root, "package.json");
    const lockFile = path.join(this.root, "package-lock.json");

    checks.push({
      name: "package-json",
      status: fs.existsSync(packageFile) ? "PASS" : "FAIL",
      exists: fs.existsSync(packageFile)
    });

    checks.push({
      name: "package-lock",
      status: fs.existsSync(lockFile) ? "PASS" : "WARN",
      exists: fs.existsSync(lockFile)
    });

    const failures = checks.filter(item => item.status === "FAIL");
    const warnings = checks.filter(item => item.status === "WARN");

    const status = failures.length > 0
      ? "FAIL"
      : warnings.length > 0
        ? "WARN"
        : "PASS";

    return {
      success: failures.length === 0,
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
      root: this.root,
      platform: process.platform,
      architecture: process.arch,
      hostname: os.hostname(),
      nodeVersion: process.version,
      checks,
      totalChecks: checks.length,
      passed: checks.filter(item => item.status === "PASS").length,
      warnings: warnings.length,
      failures: failures.length,
      durationMs: Date.now() - startedAt
    };
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

module.exports = EnvironmentForensicProvider;

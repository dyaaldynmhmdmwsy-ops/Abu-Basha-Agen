"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = process.cwd();

function run(name, command, args = []) {
  const started = Date.now();

  try {
    const output = execFileSync(command, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    return {
      name,
      success: true,
      durationMs: Date.now() - started,
      output: output.trim()
    };
  } catch (error) {
    return {
      name,
      success: false,
      durationMs: Date.now() - started,
      exitCode: typeof error.status === "number" ? error.status : null,
      stdout: String(error.stdout || "").trim(),
      stderr: String(error.stderr || "").trim()
    };
  }
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const result = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "backups"
    ) {
      continue;
    }

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      result.push(...collectFiles(full));
    } else {
      result.push(full);
    }
  }

  return result;
}

function main() {
  const report = {
    tool: "Agent Quality Gate",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    root: ROOT,
    environment: {},
    files: {},
    gates: []
  };

  report.environment.node = process.version;

  const npm = run("npm_version", "npm", ["--version"]);
  report.environment.npm = npm.output || null;

  if (fs.existsSync("package.json")) {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

    report.environment.package = {
      name: pkg.name || null,
      version: pkg.version || null,
      scripts: pkg.scripts || {}
    };
  }

  const trackedFiles = collectFiles(path.join(ROOT, "src"));

  report.files.src = trackedFiles.map(file => ({
    file: path.relative(ROOT, file),
    sha256: sha256(file)
  }));

  report.gates.push(
    run("node_version", "node", ["--version"]),
    run("package_json_syntax", "node", [
      "-e",
      'JSON.parse(require("fs").readFileSync("package.json","utf8"));'
    ]),
    run("runtime_syntax", "node", [
      "--check",
      "src/core/runtime.js"
    ]),
    run("plan_executor_syntax", "node", [
      "--check",
      "src/plan-executors/index.js"
    ]),
    run("plan_registry_syntax", "node", [
      "--check",
      "src/plan-registry/index.js"
    ]),
    run("approval_syntax", "node", [
      "--check",
      "src/approval/index.js"
    ])
  );

  report.summary = {
    totalGates: report.gates.length,
    passed: report.gates.filter(x => x.success).length,
    failed: report.gates.filter(x => !x.success).length
  };

  report.status =
    report.summary.failed === 0 ? "PASS" : "FAIL";

  fs.mkdirSync("reports", { recursive: true });

  fs.writeFileSync(
    "reports/quality-gate.json",
    JSON.stringify(report, null, 2)
  );

  console.log("=== AGENT QUALITY GATE ===");
  console.log(`STATUS=${report.status}`);
  console.log(`GATES=${report.summary.totalGates}`);
  console.log(`PASSED=${report.summary.passed}`);
  console.log(`FAILED=${report.summary.failed}`);
  console.log("REPORT=reports/quality-gate.json");

  if (report.status !== "PASS") {
    process.exitCode = 1;
  }
}

main();

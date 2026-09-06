"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();
const REPORT_TXT = path.join(ROOT, "TERMUX_NODE_FORENSIC_V1.txt");
const REPORT_JSON = path.join(ROOT, "TERMUX_NODE_FORENSIC_V1.json");

const results = [];

function exec(command, args = []) {
  try {
    const r = cp.spawnSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    return {
      exists: true,
      code: r.status,
      signal: r.signal,
      stdout: (r.stdout || "").trim(),
      stderr: (r.stderr || "").trim(),
      error: r.error ? String(r.error.message || r.error) : null
    };
  } catch (error) {
    return {
      exists: false,
      code: null,
      signal: null,
      stdout: "",
      stderr: "",
      error: error.message
    };
  }
}

function record(name, command, result, expected = 0) {
  const pass =
    result.exists &&
    result.code === expected &&
    !result.error;

  const item = {
    name,
    command,
    status: pass ? "PASS" : "FAIL",
    code: result.code,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error
  };

  results.push(item);

  console.log(
    `${item.status} | ${name} | exit=${result.code}`
  );

  if (result.stdout) {
    console.log(`  STDOUT: ${result.stdout}`);
  }

  if (result.stderr) {
    console.log(`  STDERR: ${result.stderr}`);
  }

  if (result.error) {
    console.log(`  ERROR: ${result.error}`);
  }
}

console.log("======================================================");
console.log("          TERMUX NODE FORENSIC AUDIT V1");
console.log("                 READ-ONLY MODE");
console.log("======================================================");

console.log("");
console.log("[1] Current Node process");

console.log(`process.version = ${process.version}`);
console.log(`process.execPath = ${process.execPath}`);
console.log(`process.platform = ${process.platform}`);
console.log(`process.arch = ${process.arch}`);
console.log(`PREFIX = ${process.env.PREFIX || "NOT_SET"}`);
console.log(`HOME = ${process.env.HOME || "NOT_SET"}`);
console.log(`JAVA_HOME = ${process.env.JAVA_HOME || "NOT_SET"}`);
console.log(`PATH = ${process.env.PATH || "NOT_SET"}`);

console.log("");
console.log("[2] Shell resolution");

record(
  "command-v-node",
  "command -v node",
  exec("bash", ["-lc", "command -v node"])
);

record(
  "type-a-node",
  "type -a node",
  exec("bash", ["-lc", "type -a node"])
);

record(
  "node-version",
  "node --version",
  exec("node", ["--version"])
);

console.log("");
console.log("[3] Node execution primitives");

record(
  "node-e",
  "node -e console.log(...)",
  exec("node", ["-e", "console.log('NODE_E_OK')"])
);

record(
  "node-p",
  "node -p 1+1",
  exec("node", ["-p", "1+1"])
);

record(
  "node-stdin",
  "printf ... | node",
  exec(
    "bash",
    ["-lc", "printf \"console.log('NODE_STDIN_OK')\\n\" | node"]
  )
);

/*
 * Termux/Android Node forensic rule:
 *
 * process.execPath may report Android's dynamic linker:
 * /apex/com.android.runtime/bin/linker64
 *
 * That value is NOT the authoritative Termux Node executable.
 * Therefore process.execPath must never be executed directly
 * as the Node binary in this audit.
 */

const resolvedNode = exec(
  "bash",
  ["-lc", "command -v node"]
);

const nodeExecutable =
  resolvedNode.code === 0
    ? resolvedNode.stdout.trim()
    : "";

if (nodeExecutable) {
  record(
    "resolved-node-e",
    "command-v node -> node -e",
    exec(
      nodeExecutable,
      ["-e", "console.log('RESOLVED_NODE_E_OK')"]
    )
  );
} else {
  results.push({
    name: "resolved-node-e",
    command: "command-v node -> node -e",
    code: 127,
    stdout: "",
    stderr: "",
    error: "Unable to resolve Termux Node executable",
    status: "FAIL"
  });

  console.log(
    "FAIL | resolved-node-e | Node executable could not be resolved"
  );
}

/*
 * Diagnostic information only.
 * Never classify process.execPath itself as a Node failure.
 */

results.push({
  name: "process-execPath",
  command: "process.execPath",
  code: 0,
  stdout: process.execPath,
  stderr: "",
  status: "INFO"
});

console.log(
  "INFO | process-execPath | " + process.execPath
);

console.log("");
console.log("[4] Node module resolution");

record(
  "node-module-resolution",
  "node -e require('fs')",
  exec(
    "node",
    ["-e", "require('fs'); console.log('FS_REQUIRE_OK')"]
  )
);

record(
  "node-path-resolution",
  "node -e require.resolve('path')",
  exec(
    "node",
    ["-e", "console.log(require.resolve('path'))"]
  )
);

console.log("");
console.log("[5] Android / linker information");

record(
  "which-node",
  "which node",
  exec("which", ["node"])
);

record(
  "readlink-node",
  "readlink -f $(command -v node)",
  exec(
    "bash",
    ["-lc", "readlink -f \"$(command -v node)\""]
  )
);

record(
  "file-node",
  "file $(command -v node)",
  exec(
    "bash",
    ["-lc", "file \"$(command -v node)\""]
  )
);

console.log("");
console.log("[6] Java / Android sanity");

record(
  "java-version",
  "java -version",
  exec("java", ["-version"])
);

record(
  "javac-version",
  "javac -version",
  exec("javac", ["-version"])
);

record(
  "adb-version",
  "adb version",
  exec("adb", ["version"])
);

console.log("");
console.log("[7] Project-side Node loading");

const packageFile = path.join(ROOT, "package.json");

if (fs.existsSync(packageFile)) {
  record(
    "package-json-load",
    "node -e require('./package.json')",
    exec(
      "node",
      [
        "-e",
        "const p=require('./package.json'); console.log(p.name || 'PACKAGE_NAME_MISSING')"
      ]
    )
  );
} else {
  console.log("WARN | package-json-load | package.json missing");
}

console.log("");
console.log("[8] Diagnosis");

const failures = results.filter(
  item => item.status === "FAIL"
);

let diagnosis = "PASS";

if (failures.length > 0) {
  diagnosis = "NODE_FORENSIC_FAILURE";
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: "READ_ONLY",
  root: ROOT,

  diagnosis,

  summary: {
    total: results.length,
    pass: results.filter(x => x.status === "PASS").length,
    fail: failures.length
  },

  process: {
    version: process.version,
    execPath: process.execPath,
    platform: process.platform,
    arch: process.arch
  },

  environment: {
    prefix: process.env.PREFIX || null,
    home: process.env.HOME || null,
    javaHome: process.env.JAVA_HOME || null,
    path: process.env.PATH || null
  },

  results
};

const lines = [
  "======================================================",
  "          TERMUX NODE FORENSIC AUDIT V1",
  "======================================================",
  `ROOT: ${ROOT}`,
  `DIAGNOSIS: ${diagnosis}`,
  `TOTAL: ${report.summary.total}`,
  `PASS: ${report.summary.pass}`,
  `FAIL: ${report.summary.fail}`,
  "",
  "PROCESS:",
  `NODE_VERSION: ${process.version}`,
  `EXEC_PATH: ${process.execPath}`,
  `PLATFORM: ${process.platform}`,
  `ARCH: ${process.arch}`,
  "",
  "RESULTS:"
];

for (const item of results) {
  lines.push(
    `${item.status} | ${item.name} | exit=${item.code}`
  );

  if (item.stdout) {
    lines.push(`  stdout=${item.stdout}`);
  }

  if (item.stderr) {
    lines.push(`  stderr=${item.stderr}`);
  }

  if (item.error) {
    lines.push(`  error=${item.error}`);
  }
}

fs.writeFileSync(
  REPORT_TXT,
  lines.join("\n") + "\n",
  "utf8"
);

fs.writeFileSync(
  REPORT_JSON,
  JSON.stringify(report, null, 2) + "\n",
  "utf8"
);

console.log("");
console.log("======================================================");
console.log("             FINAL NODE FORENSIC RESULT");
console.log("======================================================");
console.log(`DIAGNOSIS : ${diagnosis}`);
console.log(`PASS      : ${report.summary.pass}`);
console.log(`FAIL      : ${report.summary.fail}`);
console.log(`REPORT_TXT  : ${REPORT_TXT}`);
console.log(`REPORT_JSON : ${REPORT_JSON}`);
console.log("");
console.log("NODE_FORENSIC_COMPLETE");
console.log("NO_PROJECT_FILES_MODIFIED");
console.log("======================================================");

"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();
const results = [];

function run(command, args = []) {
  try {
    const r = cp.spawnSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    return {
      exists: true,
      code: r.status,
      stdout: (r.stdout || "").trim(),
      stderr: (r.stderr || "").trim()
    };
  } catch (error) {
    return {
      exists: false,
      code: null,
      stdout: "",
      stderr: error.message
    };
  }
}

function check(name, command, args = []) {
  const r = run(command, args);

  results.push({
    name,
    command: [command, ...args].join(" "),
    exists: r.exists,
    code: r.code,
    stdout: r.stdout,
    stderr: r.stderr,
    status: r.exists && r.code === 0 ? "PASS" : "WARN"
  });
}

console.log("======================================================");
console.log("        TERMUX ENVIRONMENT AUDIT V1");
console.log("                 READ-ONLY MODE");
console.log("======================================================");
console.log(`ROOT=${ROOT}`);
console.log("");

console.log("[1] Environment");
console.log(`TERMUX_PREFIX=${process.env.PREFIX || "NOT_SET"}`);
console.log(`HOME=${process.env.HOME || "NOT_SET"}`);
console.log(`PATH=${process.env.PATH || "NOT_SET"}`);
console.log(`JAVA_HOME=${process.env.JAVA_HOME || "NOT_SET"}`);
console.log(`NODE=${process.version}`);
console.log(`PLATFORM=${process.platform}`);
console.log(`ARCH=${process.arch}`);
console.log(`EXEC_PATH=${process.execPath}`);

console.log("");
console.log("[2] Toolchain");

check("node", "node", ["--version"]);
check("npm", "npm", ["--version"]);
check("git", "git", ["--version"]);
check("bash", "bash", ["--version"]);
check("tar", "tar", ["--version"]);
check("gzip", "gzip", ["--version"]);
check("openssl", "openssl", ["version"]);
check("curl", "curl", ["--version"]);
check("wget", "wget", ["--version"]);
check("jq", "jq", ["--version"]);
check("rg", "rg", ["--version"]);

console.log("");
console.log("[3] Java / Android");

check("java", "java", ["-version"]);
check("javac", "javac", ["-version"]);
check("adb", "adb", ["version"]);

console.log("");
console.log("[4] Project filesystem");

const importantPaths = [
  ROOT,
  path.join(ROOT, "package.json"),
  path.join(ROOT, "src"),
  path.join(ROOT, "tests"),
  path.join(ROOT, "tools"),
  path.join(ROOT, "node_modules")
];

for (const target of importantPaths) {
  let status = "MISSING";
  try {
    if (fs.existsSync(target)) {
      const s = fs.statSync(target);
      status = s.isDirectory() ? "DIRECTORY" : "FILE";
    }
  } catch {
    status = "ERROR";
  }

  console.log(`${status} | ${target}`);
}

console.log("");
console.log("[5] Storage");

check("disk", "df", ["-h", ROOT]);

console.log("");
console.log("[6] npm");

check("npm-cache", "npm", ["config", "get", "cache"]);
check("npm-prefix", "npm", ["config", "get", "prefix"]);
check("npm-root", "npm", ["root"]);

console.log("");
console.log("[7] Node execution sanity");

const nodeTest = run(process.execPath, [
  "-e",
  "console.log(JSON.stringify({node:process.version,ok:true}))"
]);

results.push({
  name: "node-execution-sanity",
  command: `${process.execPath} -e <sanity>`,
  exists: true,
  code: nodeTest.code,
  stdout: nodeTest.stdout,
  stderr: nodeTest.stderr,
  status: nodeTest.code === 0 ? "PASS" : "FAIL"
});

console.log(
  nodeTest.code === 0
    ? "PASS | Node execution sanity"
    : "FAIL | Node execution sanity"
);

console.log("");
console.log("[8] Bash execution sanity");

const bashTest = run("bash", [
  "-lc",
  "printf 'BASH_SANITY_OK\\n'"
]);

results.push({
  name: "bash-execution-sanity",
  command: "bash -lc <sanity>",
  exists: bashTest.exists,
  code: bashTest.code,
  stdout: bashTest.stdout,
  stderr: bashTest.stderr,
  status: bashTest.exists && bashTest.code === 0 ? "PASS" : "FAIL"
});

console.log(
  bashTest.exists && bashTest.code === 0
    ? "PASS | Bash execution sanity"
    : "FAIL | Bash execution sanity"
);

console.log("");
console.log("[9] Final diagnosis");

const failures = results.filter(x => x.status === "FAIL");
const warnings = results.filter(x => x.status === "WARN");

let systemStatus = "PASS";

if (failures.length > 0) {
  systemStatus = "FAIL";
} else if (warnings.length > 0) {
  systemStatus = "PASS_WITH_WARNINGS";
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: "READ_ONLY",
  root: ROOT,
  systemStatus,
  summary: {
    total: results.length,
    pass: results.filter(x => x.status === "PASS").length,
    warn: warnings.length,
    fail: failures.length
  },
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    execPath: process.execPath,
    prefix: process.env.PREFIX || null,
    home: process.env.HOME || null,
    javaHome: process.env.JAVA_HOME || null
  },
  results
};

const txtFile = path.join(ROOT, "TERMUX_ENVIRONMENT_AUDIT_V1.txt");
const jsonFile = path.join(ROOT, "TERMUX_ENVIRONMENT_AUDIT_V1.json");

const lines = [
  "======================================================",
  "        TERMUX ENVIRONMENT AUDIT V1",
  "======================================================",
  `ROOT: ${ROOT}`,
  `SYSTEM STATUS: ${systemStatus}`,
  "",
  `TOTAL: ${report.summary.total}`,
  `PASS: ${report.summary.pass}`,
  `WARN: ${report.summary.warn}`,
  `FAIL: ${report.summary.fail}`,
  "",
  "RESULTS:"
];

for (const item of results) {
  lines.push(
    `${item.status} | ${item.name} | ${item.command}`
  );
}

fs.writeFileSync(txtFile, lines.join("\n") + "\n", "utf8");
fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2) + "\n", "utf8");

console.log("");
console.log("======================================================");
console.log("             TERMUX AUDIT RESULT");
console.log("======================================================");
console.log(`SYSTEM STATUS : ${systemStatus}`);
console.log(`PASS          : ${report.summary.pass}`);
console.log(`WARN          : ${report.summary.warn}`);
console.log(`FAIL          : ${report.summary.fail}`);
console.log(`REPORT_TXT    : ${txtFile}`);
console.log(`REPORT_JSON   : ${jsonFile}`);
console.log("");
console.log("TERMUX_AUDIT_COMPLETE");
console.log("NO_PROJECT_FILES_MODIFIED");
console.log("======================================================");

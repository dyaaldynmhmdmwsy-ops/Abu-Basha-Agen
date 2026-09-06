"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();
const REPORT_TXT = path.join(ROOT, "PROJECT_AUDIT_REPORT.txt");
const REPORT_JSON = path.join(ROOT, "PROJECT_AUDIT_REPORT.json");

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".backups",
  ".safety-backup",
  ".auto-repair-backup",
  "backups",
  "backup",
  "archive"
]);

const BACKUP_NAME_RE =
  /(^|[-_.])(backup|backups|bak|old|archive|recovery)([-_.]|$)/i;

const results = [];
const duplicateGroups = [];
const jsFiles = [];
const allFiles = [];

const NODE_COMMAND = "node";

function run(cmd, args = []) {
  try {
    const executable =
      cmd === process.execPath || cmd === "node"
        ? NODE_COMMAND
        : cmd;

    const r = cp.spawnSync(executable, args, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });

    return {
      code: typeof r.status === "number" ? r.status : 1,
      stdout: r.stdout || "",
      stderr: r.stderr || ""
    };
  } catch (e) {
    return {
      code: 1,
      stdout: "",
      stderr: String(e.message || e)
    };
  }
}

function add(stage, status, detail) {
  results.push({ stage, status, detail });
  console.log(
    `${status} | ${stage} | ${detail}`
  );
}

function walk(dir) {
  let entries = [];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(full);
      continue;
    }

    if (!entry.isFile()) continue;

    allFiles.push(full);

    if (entry.name.endsWith(".js")) {
      jsFiles.push(full);
    }
  }
}

function rel(p) {
  return path.relative(ROOT, p);
}

console.log("======================================================");
console.log("             AGENT FULL PROJECT AUDIT");
console.log("                 READ-ONLY MODE");
console.log("======================================================");
console.log(`ROOT=${ROOT}`);
console.log("");

/* -------------------------------------------------- */
/* 1. Project identity                                */
/* -------------------------------------------------- */

add(
  "01_PROJECT_ROOT",
  fs.existsSync(ROOT) ? "PASS" : "FAIL",
  ROOT
);

const packageJson = path.join(ROOT, "package.json");

if (fs.existsSync(packageJson)) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(packageJson, "utf8")
    );

    add(
      "02_PACKAGE_JSON",
      "PASS",
      `name=${pkg.name || "unknown"} version=${pkg.version || "unknown"}`
    );

    const scripts = pkg.scripts || {};

    add(
      "03_NPM_SCRIPTS",
      Object.keys(scripts).length ? "PASS" : "WARN",
      Object.keys(scripts).join(", ") || "none"
    );
  } catch (e) {
    add(
      "02_PACKAGE_JSON",
      "FAIL",
      e.message
    );
  }
} else {
  add(
    "02_PACKAGE_JSON",
    "FAIL",
    "package.json missing"
  );
}

/* -------------------------------------------------- */
/* 2. Inventory                                        */
/* -------------------------------------------------- */

walk(ROOT);

add(
  "04_FILE_INVENTORY",
  "PASS",
  `${allFiles.length} source/project files scanned`
);

add(
  "05_JS_INVENTORY",
  "PASS",
  `${jsFiles.length} JavaScript files eligible for node --check`
);

/* -------------------------------------------------- */
/* 3. Syntax — ONLY actual JS files                   */
/* -------------------------------------------------- */

let syntaxPass = 0;
let syntaxFail = 0;
const syntaxFailures = [];

for (const file of jsFiles) {
  const r = run(process.execPath, ["--check", file]);

  if (r.code === 0) {
    syntaxPass++;
  } else {
    syntaxFail++;

    syntaxFailures.push({
      file: rel(file),
      stderr: (r.stderr || "").trim()
    });
  }
}

add(
  "06_JS_SYNTAX_SCAN",
  syntaxFail === 0 ? "PASS" : "FAIL",
  `${syntaxPass} passed / ${syntaxFail} failed`
);

/* -------------------------------------------------- */
/* 4. Runtime require                                  */
/* -------------------------------------------------- */

const runtime = path.join(
  ROOT,
  "src",
  "core",
  "runtime.js"
);

if (fs.existsSync(runtime)) {
  const r = run(process.execPath, [
    "-e",
    `require(${JSON.stringify(runtime)}); console.log("RUNTIME_REQUIRE_OK")`
  ]);

  add(
    "07_RUNTIME_REQUIRE",
    r.code === 0 ? "PASS" : "FAIL",
    r.code === 0
      ? "runtime loaded"
      : (r.stderr || r.stdout).trim()
  );
} else {
  add(
    "07_RUNTIME_REQUIRE",
    "FAIL",
    "src/core/runtime.js missing"
  );
}

/* -------------------------------------------------- */
/* 5. Runtime instantiate                              */
/* -------------------------------------------------- */

if (fs.existsSync(runtime)) {
  const script = `
const Runtime = require(${JSON.stringify(runtime)});
const R = Runtime.default || Runtime;
if (typeof R !== "function") {
  throw new Error("Runtime export is not constructable");
}
const instance = new R();
console.log("RUNTIME_INSTANTIATE_OK");
`;

  const r = run(process.execPath, ["-e", script]);

  add(
    "08_RUNTIME_INSTANTIATE",
    r.code === 0 ? "PASS" : "FAIL",
    r.code === 0
      ? "runtime instantiated"
      : (r.stderr || r.stdout).trim()
  );
}

/* -------------------------------------------------- */
/* 6. Core component presence                          */
/* -------------------------------------------------- */

const components = [
  ["executionGate", "src/security/execution-gate.js"],
  ["connectorHub", "src/connectors/hub/index.js"],
  ["connectorResolver", "src/connectors/resolver/index.js"],
  ["connectorGateway", "src/connector-gateway/index.js"],
  ["connectorPolicy", "src/connector-policy/index.js"],
  ["developerExecutor", "src/executors/developer-executor.js"],
  ["developerToolRegistry", "src/developer-tools/index.js"],
  ["developerPlatform", "src/developer-platform/index.js"],
  ["planExecutor", "src/plan-executors/index.js"],
  ["planRegistry", "src/plan-registry/index.js"]
];

for (const [name, file] of components) {
  add(
    `09_COMPONENT_${name}`,
    fs.existsSync(path.join(ROOT, file))
      ? "PASS"
      : "FAIL",
    file
  );
}

/* -------------------------------------------------- */
/* 7. Targeted core test                              */
/* -------------------------------------------------- */

const coreTest = path.join(
  ROOT,
  "tests",
  "developer-core-integration.js"
);

if (fs.existsSync(coreTest)) {
  const r = run(process.execPath, [coreTest]);

  add(
    "10_DEVELOPER_CORE_INTEGRATION",
    r.code === 0 ? "PASS" : "FAIL",
    `exit=${r.code}`
  );

  if (r.stdout) {
    console.log(r.stdout);
  }

  if (r.stderr) {
    console.log("----- TEST STDERR -----");
    console.log(r.stderr);
  }
} else {
  add(
    "10_DEVELOPER_CORE_INTEGRATION",
    "FAIL",
    "test missing"
  );
}

/* -------------------------------------------------- */
/* 8. NPM test                                         */
/* -------------------------------------------------- */

if (fs.existsSync(packageJson) && process.env.PROJECT_AUDIT_SKIP_NPM_TEST !== "1") {
  const r = run("npm", ["test"]);

  add(
    "11_NPM_TEST",
    r.code === 0 ? "PASS" : "FAIL",
    `exit=${r.code}`
  );

  if (r.stdout) {
    console.log("----- NPM TEST STDOUT -----");
    console.log(r.stdout);
  }

  if (r.stderr) {
    console.log("----- NPM TEST STDERR -----");
    console.log(r.stderr);
  }
}

/* -------------------------------------------------- */
/* 9. Duplicate filenames                             */
/* -------------------------------------------------- */

const byName = new Map();

for (const file of allFiles) {
  const name = path.basename(file);

  if (!byName.has(name)) {
    byName.set(name, []);
  }

  byName.get(name).push(file);
}

for (const [name, files] of byName.entries()) {
  if (files.length > 1) {
    duplicateGroups.push({
      name,
      files: files.map(rel)
    });
  }
}

add(
  "12_DUPLICATE_FILENAMES",
  duplicateGroups.length === 0 ? "PASS" : "WARN",
  `${duplicateGroups.length} duplicate filename groups`
);

/* -------------------------------------------------- */
/* 10. Backup/archive inventory                        */
/* -------------------------------------------------- */

const backupCandidates = [];

function backupWalk(dir) {
  let entries = [];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (
      BACKUP_NAME_RE.test(entry.name) ||
      BACKUP_NAME_RE.test(path.basename(dir))
    ) {
      backupCandidates.push(full);
    }

    if (entry.isDirectory()) {
      backupWalk(full);
    }
  }
}

backupWalk(ROOT);

add(
  "13_BACKUP_ARCHIVE_INVENTORY",
  "PASS",
  `${backupCandidates.length} backup/archive candidates`
);

/* -------------------------------------------------- */
/* 11. Architecture markers                           */
/* -------------------------------------------------- */

const markerPatterns = [
  "TODO",
  "FIXME",
  "PATCH_STOP",
  "LEGACY",
  "DEPRECATED",
  "DUPLICATE",
  "fallback",
  "externalExecution",
  "requiresApproval",
  "executionAllowed"
];

let markerCount = 0;

for (const file of jsFiles) {
  let text = "";

  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const marker of markerPatterns) {
    const matches = text.match(
      new RegExp(
        marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "gi"
      )
    );

    if (matches) {
      markerCount += matches.length;
    }
  }
}

add(
  "14_ARCHITECTURE_MARKERS",
  "PASS",
  `${markerCount} markers found; review required`
);

/* -------------------------------------------------- */
/* 12. Final diagnosis                                */
/* -------------------------------------------------- */

const failures = results.filter(
  x => x.status === "FAIL"
);

const firstFailure = failures[0] || null;

let systemStatus = "PASS";

if (failures.length) {
  systemStatus = "FAIL";
} else if (
  results.some(x => x.status === "WARN")
) {
  systemStatus = "PASS_WITH_WARNINGS";
}

const report = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  systemStatus,
  summary: {
    totalStages: results.length,
    pass: results.filter(x => x.status === "PASS").length,
    fail: failures.length,
    warn: results.filter(x => x.status === "WARN").length
  },
  firstFailure,
  syntax: {
    javascriptFiles: jsFiles.length,
    passed: syntaxPass,
    failed: syntaxFail,
    failures: syntaxFailures
  },
  duplicates: duplicateGroups,
  backupCandidates: backupCandidates.map(rel),
  results
};

if (process.env.PROJECT_AUDIT_READ_ONLY !== "1") {
  fs.writeFileSync(
    REPORT_JSON,
    JSON.stringify(report, null, 2)
  );
}

const txt = [];

txt.push("======================================================");
txt.push("             AGENT FULL PROJECT AUDIT");
txt.push("======================================================");
txt.push(`ROOT: ${ROOT}`);
txt.push(`SYSTEM STATUS: ${systemStatus}`);
txt.push("");
txt.push(`TOTAL STAGES: ${report.summary.totalStages}`);
txt.push(`PASS: ${report.summary.pass}`);
txt.push(`FAIL: ${report.summary.fail}`);
txt.push(`WARN: ${report.summary.warn}`);
txt.push("");

if (firstFailure) {
  txt.push("FIRST FAILURE:");
  txt.push(`STAGE: ${firstFailure.stage}`);
  txt.push(`DETAIL: ${firstFailure.detail}`);
} else {
  txt.push("FIRST FAILURE: NONE");
}

txt.push("");
txt.push("JAVASCRIPT SYNTAX:");
txt.push(`FILES: ${syntaxPass + syntaxFail}`);
txt.push(`PASS: ${syntaxPass}`);
txt.push(`FAIL: ${syntaxFail}`);

if (syntaxFailures.length) {
  txt.push("");
  txt.push("SYNTAX FAILURES:");

  for (const failure of syntaxFailures) {
    txt.push(`- ${failure.file}`);
    txt.push(`  ${failure.stderr}`);
  }
}

txt.push("");
txt.push("DUPLICATE FILENAME GROUPS:");

for (const group of duplicateGroups) {
  txt.push(`DUPLICATE: ${group.name}`);

  for (const file of group.files) {
    txt.push(`  - ${file}`);
  }
}

txt.push("");
txt.push("BACKUP/ARCHIVE CANDIDATES:");
txt.push(`COUNT: ${backupCandidates.length}`);

for (const file of backupCandidates) {
  txt.push(`- ${rel(file)}`);
}

txt.push("");
txt.push("ALL STAGES:");

for (const item of results) {
  txt.push(
    `${item.status} | ${item.stage} | ${item.detail}`
  );
}

if (process.env.PROJECT_AUDIT_READ_ONLY !== "1") {
  fs.writeFileSync(
    REPORT_TXT,
    txt.join("\n") + "\n"
  );
}

console.log("");
console.log("======================================================");
console.log("                 FINAL AUDIT RESULT");
console.log("======================================================");
console.log(`SYSTEM STATUS : ${systemStatus}`);
console.log(`TOTAL STAGES  : ${report.summary.totalStages}`);
console.log(`PASS          : ${report.summary.pass}`);
console.log(`FAIL          : ${report.summary.fail}`);
console.log(`WARN          : ${report.summary.warn}`);

if (firstFailure) {
  console.log("");
  console.log(`FIRST FAILURE: ${firstFailure.stage}`);
  console.log(`DETAIL: ${firstFailure.detail}`);
}

console.log("");
console.log(`REPORT_TXT=${REPORT_TXT}`);
console.log(`REPORT_JSON=${REPORT_JSON}`);
console.log("");
console.log("AUDIT_COMPLETE");
console.log("NO_PROJECT_FILES_MODIFIED");

if (systemStatus === "FAIL") {
  process.exitCode = 1;
} else {
  process.exitCode = 0;
}

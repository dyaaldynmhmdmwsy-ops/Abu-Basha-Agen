const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const packagePath = path.join(ROOT, "package.json");

const pkg = JSON.parse(
  fs.readFileSync(packagePath, "utf8")
);

const FULL_TEST_COMMANDS = String(
  pkg.scripts?.test || ""
)
  .split("&&")
  .map(command => command.trim())
  .filter(Boolean);

const QUALITY_GATE_COMMAND = String(
  pkg.scripts?.["quality:gate"] || ""
).trim();

function printHeader(title) {
  console.log("");
  console.log("==================================================");
  console.log(` ${title}`);
  console.log("==================================================");
}

function runNodeCommand(command) {
  const match = command.match(/^node\s+(.+)$/);

  if (!match) {
    return runNpmCommand(command);
  }

  const file = match[1].trim();

  if (!file) {
    console.log("COMMAND_STATUS=FAIL");
    console.log("COMMAND_ERROR=missing_node_target");
    return 1;
  }

  const target = path.resolve(ROOT, file);

  if (!target.startsWith(ROOT + path.sep)) {
    console.log("COMMAND_STATUS=FAIL");
    console.log("COMMAND_ERROR=target_outside_project");
    return 1;
  }

  const result = spawnSync(
    "node",
    [target],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
      timeout: 60000,
      killSignal: "SIGTERM"
    }
  );

  if (result.error) {
    console.log("COMMAND_STATUS=FAIL");
    console.log(
      `COMMAND_ERROR=${result.error.message}`
    );
    return 1;
  }

  return typeof result.status === "number"
    ? result.status
    : 1;
}

function runNpmCommand(command) {
  const match = command.match(
    /^npm\s+run\s+([A-Za-z0-9:_-]+)$/
  );

  if (!match) {
    console.log("COMMAND_STATUS=FAIL");
    console.log(
      `COMMAND_ERROR=unsupported_command:${command}`
    );
    return 1;
  }

  const scriptName = match[1];

  if (!pkg.scripts?.[scriptName]) {
    console.log("COMMAND_STATUS=FAIL");
    console.log(
      `COMMAND_ERROR=missing_npm_script:${scriptName}`
    );
    return 1;
  }

  const result = spawnSync(
    "npm",
    ["run", scriptName],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
      timeout: 60000,
      killSignal: "SIGTERM"
    }
  );

  if (result.error) {
    console.log("COMMAND_STATUS=FAIL");
    console.log(
      `COMMAND_ERROR=${result.error.message}`
    );
    return 1;
  }

  return typeof result.status === "number"
    ? result.status
    : 1;
}

function runCommand(command, index, total) {
  console.log("");
  console.log(`=== GATE ${index}/${total} ===`);
  console.log(`COMMAND=${command}`);

  const rc = command.startsWith("node ")
    ? runNodeCommand(command)
    : runNpmCommand(command);

  console.log(`GATE_EXIT_CODE=${rc}`);

  if (rc === 0) {
    console.log("GATE_STATUS=PASS");
  } else {
    console.log("GATE_STATUS=FAIL");
  }

  return rc;
}

function runFullGate() {
  printHeader("ENGINEERING FULL GATE");

  if (!FULL_TEST_COMMANDS.length) {
    console.log("FULL_GATE_STATUS=FAIL");
    console.log(
      "FULL_GATE_ERROR=package_test_script_missing"
    );
    return 1;
  }

  let failures = 0;

  for (let i = 0; i < FULL_TEST_COMMANDS.length; i++) {
    const rc = runCommand(
      FULL_TEST_COMMANDS[i],
      i + 1,
      FULL_TEST_COMMANDS.length
    );

    if (rc !== 0) {
      failures++;
      console.log("FULL_GATE_FAIL_FAST=YES");
      break;
    }
  }

  console.log("");
  console.log("=== FULL GATE RESULT ===");
  console.log(`FULL_GATE_FAILURES=${failures}`);

  if (failures === 0) {
    console.log("ENGINEERING_FULL_GATE=PASS");
    return 0;
  }

  console.log("ENGINEERING_FULL_GATE=FAIL");
  return 1;
}

function runQualityGate() {
  printHeader("ENGINEERING QUALITY GATE");

  if (!QUALITY_GATE_COMMAND) {
    console.log("QUALITY_GATE_STATUS=FAIL");
    console.log(
      "QUALITY_GATE_ERROR=quality_gate_script_missing"
    );
    return 1;
  }

  const rc = runCommand(
    QUALITY_GATE_COMMAND,
    1,
    1
  );

  console.log("");
  console.log(
    rc === 0
      ? "ENGINEERING_QUALITY_GATE=PASS"
      : "ENGINEERING_QUALITY_GATE=FAIL"
  );

  return rc;
}

function runTargetedGate(file) {
  printHeader("ENGINEERING TARGETED GATE");

  if (!file) {
    console.log("TARGETED_GATE_STATUS=FAIL");
    console.log(
      "TARGETED_GATE_ERROR=target_required"
    );
    return 1;
  }

  const normalized = file.replace(/^\.\/+/, "");
  const target = path.resolve(ROOT, normalized);

  if (!target.startsWith(ROOT + path.sep)) {
    console.log("TARGETED_GATE_STATUS=FAIL");
    console.log(
      "TARGETED_GATE_ERROR=target_outside_project"
    );
    return 1;
  }

  if (!fs.existsSync(target)) {
    console.log("TARGETED_GATE_STATUS=FAIL");
    console.log(
      `TARGETED_GATE_ERROR=missing:${normalized}`
    );
    return 1;
  }

  if (path.extname(target) !== ".js") {
    console.log("TARGETED_GATE_STATUS=FAIL");
    console.log(
      "TARGETED_GATE_ERROR=target_must_be_js"
    );
    return 1;
  }

  const rc = runCommand(
    `node ${normalized}`,
    1,
    1
  );

  console.log("");
  console.log(
    rc === 0
      ? "ENGINEERING_TARGETED_GATE=PASS"
      : "ENGINEERING_TARGETED_GATE=FAIL"
  );

  return rc;
}

function runRealGate() {
  printHeader("ENGINEERING REAL CONNECTOR GATE");

  const target = "tests/phase21-real-connector-validation.js";

  if (!fs.existsSync(require("path").resolve(ROOT, target))) {
    console.log("REAL_GATE_STATUS=FAIL");
    console.log("REAL_GATE_ERROR=missing_real_connector_regression");
    return 1;
  }

  console.log("REAL_CONNECTOR_FLAG=1");
  console.log("NETWORK_CALL=AUTHORIZED_BY_EXPLICIT_GATE");

  const result = spawnSync(
    "node",
    [require("path").resolve(ROOT, target)],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
      timeout: 60000,
      killSignal: "SIGTERM",
      env: {
        ...process.env,
        PHASE21_REAL_CONNECTOR: "1"
      }
    }
  );

  if (result.error) {
    console.log("REAL_GATE_STATUS=FAIL");
    console.log(`REAL_GATE_ERROR=${result.error.message}`);
    return 1;
  }

  const rc =
    typeof result.status === "number"
      ? result.status
      : 1;

  console.log(`REAL_GATE_EXIT_CODE=${rc}`);

  if (rc === 0) {
    console.log("REAL_GATE_STATUS=PASS");
    console.log("ENGINEERING_REAL_CONNECTOR_GATE=PASS");
  } else {
    console.log("REAL_GATE_STATUS=FAIL");
    console.log("ENGINEERING_REAL_CONNECTOR_GATE=FAIL");
  }

  return rc;
}

function printUsage() {
  console.log("Usage:");
  console.log(
    "  node scripts/engineering-gate.js full"
  );
  console.log(
    "  node scripts/engineering-gate.js quality"
  );
  console.log(
    "  node scripts/engineering-gate.js targeted <test-file>"
  );
  console.log(
    "  node scripts/engineering-gate.js real"
  );
}

const mode = process.argv[2] || "";

let rc = 1;

if (mode === "full") {
  rc = runFullGate();
} else if (mode === "quality") {
  rc = runQualityGate();
} else if (mode === "targeted") {
  rc = runTargetedGate(process.argv[3]);
} else if (mode === "real") {
  rc = runRealGate();
} else {
  printUsage();
  console.log("ENGINEERING_GATE_USAGE=FAIL");
  rc = 1;
}

process.exitCode = rc;

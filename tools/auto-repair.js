"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const backupEngine = require("./backup-engine");

const ROOT = path.resolve(__dirname, "..");
const BACKUP_DIR = path.join(ROOT, ".auto-repair-backup");

const TESTS = [
  "tests/developer-platform-bootstrap.js",
  "tests/developer-platform-integration.js",
  "tests/developer-core-integration.js"
];

function log(message) {
  console.log(`[AUTO-REPAIR] ${message}`);
}

function backupFile(file) {
  if (!fs.existsSync(file)) return;

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const relative = path.relative(ROOT, file);
  const destination = path.join(BACKUP_DIR, relative);

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);

  log(`Backup: ${relative}`);
}

function checkSyntax(file) {
  try {
    execSync(`node --check "${file}"`, {
      cwd: ROOT,
      stdio: "pipe"
    });

    return {
      success: true,
      file
    };
  } catch (error) {
    return {
      success: false,
      file,
      error: error.stderr
        ? error.stderr.toString()
        : error.message
    };
  }
}

function runTest(test) {
  try {
    execSync(`node "${test}"`, {
      cwd: ROOT,
      stdio: "pipe"
    });

    return {
      success: true,
      test
    };
  } catch (error) {
    return {
      success: false,
      test,
      error: error.stdout
        ? error.stdout.toString()
        : error.message
    };
  }
}

function repairPackageTestScript() {
  const packageFile = path.join(ROOT, "package.json");

  if (!fs.existsSync(packageFile)) {
    return false;
  }

  const packageJson = JSON.parse(
    fs.readFileSync(packageFile, "utf8")
  );

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  const expected =
    "node tests/developer-platform-bootstrap.js && " +
    "node tests/developer-platform-integration.js && " +
    "node tests/developer-core-integration.js";

  if (packageJson.scripts.test === expected) {
    return false;
  }

  backupFile(packageFile);

  packageJson.scripts.test = expected;

  fs.writeFileSync(
    packageFile,
    JSON.stringify(packageJson, null, 2) + "\n",
    "utf8"
  );

  log("Repaired package.json test script.");

  return true;
}

function collectSourceFiles() {
  const files = [];

  function walk(directory) {
    if (!fs.existsSync(directory)) return;

    for (const entry of fs.readdirSync(directory)) {
      if (
        entry === "node_modules" ||
        entry === ".git" ||
        entry === ".auto-repair-backup"
      ) {
        continue;
      }

      const fullPath = path.join(directory, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.endsWith(".js") &&
        !entry.includes(".before-")
      ) {
        files.push(fullPath);
      }
    }
  }

  walk(path.join(ROOT, "src"));
  walk(path.join(ROOT, "tests"));

  return files;
}

async function main() {
  console.log("==========================================");
  console.log(" AUTO REPAIR ENGINE v1");
  console.log("==========================================");

  log(`Project: ${ROOT}`);

  console.log("\n[1] Syntax scan");

  const sourceFiles = collectSourceFiles();
  const syntaxErrors = [];

  for (const file of sourceFiles) {
    const result = checkSyntax(file);

    if (!result.success) {
      syntaxErrors.push(result);
      console.log(`FAIL: ${path.relative(ROOT, file)}`);
    }
  }

  if (syntaxErrors.length === 0) {
    console.log("PASS - No JavaScript syntax errors found.");
  } else {
    console.log(
      `FAIL - ${syntaxErrors.length} syntax error(s) found.`
    );

    for (const item of syntaxErrors) {
      console.log("\n---");
      console.log(path.relative(ROOT, item.file));
      console.log(item.error);
    }

    console.log(
      "\nNo automatic source-code modification was performed."
    );
  }

  console.log("\n[2] Safe project repair");

  let packageChanged = false;

  try {
    packageChanged = repairPackageTestScript();
  } catch (error) {
    console.log("Package repair failed:");
    console.log(error.message);
  }

  if (!packageChanged) {
    log("No package.json repair required.");
  }

  console.log("\n[3] Developer tests");

  const results = [];

  for (const test of TESTS) {
    console.log(`\nRunning: ${test}`);

    const result = runTest(test);
    results.push(result);

    if (result.success) {
      console.log("PASS");
    } else {
      console.log("FAIL");
      console.log(result.error);
    }
  }

  const failedTests = results.filter(
    result => !result.success
  );

  if (failedTests.length > 0 && packageChanged) {
    console.log("\n[4] AUTO-ROLLBACK");
    console.log("Tests failed after package repair.");
    console.log("AUTO-ROLLBACK: package.json");

    try {
      const rollbackResult = backupEngine.rollbackFile("package.json");
      console.log(rollbackResult);

      if (!rollbackResult.success) {
        throw new Error("PACKAGE ROLLBACK FAILED");
      }

      console.log("AUTO-ROLLBACK: package.json RESTORED");
    } catch (error) {
      console.error("AUTO-ROLLBACK FAILED");
      console.error(error.message);
      process.exit(1);
    }
  }


  console.log("\n==========================================");
  console.log(" AUTO REPAIR REPORT");
  console.log("==========================================");

  const passed = results.filter(
    result => result.success
  ).length;

  console.log(
    `Tests: ${passed}/${results.length} passed`
  );

  console.log(
    `Syntax errors: ${syntaxErrors.length}`
  );

  console.log(
    `Package repaired: ${packageChanged ? "YES" : "NO"}`
  );

  console.log(
    `Backup directory: ${path.relative(ROOT, BACKUP_DIR)}`
  );

  if (
    syntaxErrors.length === 0 &&
    passed === results.length
  ) {
    console.log("\nSYSTEM STATUS: HEALTHY");
    process.exit(0);
  }

  console.log("\nSYSTEM STATUS: NEEDS REVIEW");
  process.exit(1);
}

main().catch(error => {
  console.error("\nAUTO REPAIR ENGINE FAILED");
  console.error(error.stack || error.message || error);
  process.exit(1);
});

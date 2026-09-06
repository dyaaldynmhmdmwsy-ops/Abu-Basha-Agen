"use strict";

const { execSync } = require("child_process");

const tests = [
  "tests/tool-orchestrator-block-01.js",
  "tests/agent-tool-routing-block-02.js",
  "tests/execution-plan-block-03.js",
  "tests/connector-gateway-block-04.js",
  "tests/execution-engine-block-05.js",
  "tests/tool-registry-expansion-block-06.js",
  "tests/phase3-agent-pods.js",
  "tests/master-abubasha-contract.js",
  "tests/developer-platform-bootstrap.js",
  "tests/developer-platform-integration.js",
  "tests/developer-core-integration.js",
  "tests/architecture-governance.js"
];

console.log("========================================");
console.log(" FINAL INTEGRATION GATE");
console.log("========================================");

let failed = 0;

for (const test of tests) {
  console.log(`\n>>> ${test}`);

  try {
    execSync(`node "${require("path").resolve(test)}"`, {
      stdio: "inherit",
      cwd: process.cwd()
    });
  } catch (error) {
    failed++;
    console.error(`FAILED: ${test}`);
    break;
  }
}

console.log("\n========================================");

if (failed === 0) {
  console.log("FINAL INTEGRATION GATE: PASS");
  console.log(`TESTS_CHECKED=${tests.length}`);
  process.exitCode = 0;
} else {
  console.log("FINAL INTEGRATION GATE: FAIL");
  console.log(`FAILED_TESTS=${failed}`);
  process.exitCode = 1;
}

console.log("========================================");

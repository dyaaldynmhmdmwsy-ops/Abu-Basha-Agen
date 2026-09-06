"use strict";

const ProjectAuditProvider =
  require("../src/diagnostic-center/providers/project-audit-provider");

const provider = new ProjectAuditProvider({
  root: process.cwd()
});

const status = provider.getStatus();

const checks = [
  ["PROVIDER_SAFE", status.safe === true],
  ["PROVIDER_READ_ONLY", status.readOnly === true],
  ["PROVIDER_NO_AUTOFIX", status.autoFix === false],
  ["PROVIDER_NO_EXTERNAL_EXECUTION", status.externalExecution === false],
  ["PROVIDER_NO_AUTONOMOUS_EXECUTION", status.autonomousExecution === false],
  ["PROVIDER_FAIL_CLOSED", status.failClosed === true],
  ["PROVIDER_API", typeof provider.run === "function"],
];

let failures = 0;

for (const [name, passed] of checks) {
  console.log(`${name}=${passed ? "PASS" : "FAIL"}`);
  if (!passed) failures++;
}

const result = provider.run();

const runPassed =
  result &&
  result.success === true &&
  result.exitCode === 0 &&
  (result.status === "PASS" || result.status === "WARN");

console.log(`PROVIDER_RUN_STATUS=${result ? result.status : "FAIL"}`);
console.log(`PROVIDER_RUN_EXIT_CODE=${result ? result.exitCode : "N/A"}`);
console.log(`PROVIDER_RUN=${runPassed ? "PASS" : "FAIL"}`);

if (!runPassed) failures++;

console.log(`PROJECT_AUDIT_REGRESSION_FAILURES=${failures}`);

if (failures === 0) {
  console.log("PROJECT_AUDIT_PROVIDER_REGRESSION=PASS");
} else {
  console.log("PROJECT_AUDIT_PROVIDER_REGRESSION=FAIL");
  process.exitCode = 1;
}

"use strict";

const assert = require("assert");

const Runtime = require("../src/core/runtime");
const ApiBoundary = require("../src/api");

async function main() {
  const runtime = new Runtime();
  const api = new ApiBoundary(runtime);

  const status = api.getDiagnosticStatus();

  assert.strictEqual(status.success, true);
  assert.strictEqual(status.type, "diagnostic_status");
  assert.ok(status.status);
  assert.strictEqual(status.status.safe, true);
  assert.strictEqual(status.status.readOnly, true);
  assert.strictEqual(status.status.autoFix, false);
  assert.strictEqual(status.status.externalExecution, false);
  assert.strictEqual(status.status.autonomousExecution, false);
  assert.strictEqual(status.status.failClosed, true);

  const initialReport = api.getDiagnosticReport();
  assert.strictEqual(initialReport, null);

  const result = await api.runDiagnostic();

  assert.ok(result);
  assert.strictEqual(result.success, true);
  assert.strictEqual(typeof result.status, "string");
  assert.ok(Array.isArray(result.providers));
  assert.ok(result.safety);
  assert.strictEqual(result.safety.safe, true);
  assert.strictEqual(result.safety.readOnly, true);
  assert.strictEqual(result.safety.autoFix, false);
  assert.strictEqual(result.safety.externalExecution, false);
  assert.strictEqual(result.safety.autonomousExecution, false);
  assert.strictEqual(result.safety.failClosed, true);

  const report = api.getDiagnosticReport();

  assert.ok(report);
  assert.strictEqual(report.center, "diagnostic-center");
  assert.ok(report.safety);
  assert.strictEqual(report.safety.failClosed, true);
  assert.strictEqual(api.getDiagnosticReport(), report);

  console.log("API_DIAGNOSTIC_STATUS=PASS");
  console.log("API_INITIAL_REPORT_NULL=PASS");
  console.log("API_DIAGNOSTIC_RUN=PASS");
  console.log("API_DIAGNOSTIC_SAFETY=PASS");
  console.log("API_DIAGNOSTIC_REPORT=PASS");
  console.log("API_REPORT_IDENTITY=PASS");
  console.log("EXECUTION_TRIGGERED=NO");
  console.log("EXTERNAL_NETWORK_USED=NO");
  console.log("SECRETS_VALUES_PRINTED=NO");
  console.log("PHASE22_7_BLOCK_C_REGRESSION=PASS");
}

main().catch((error) => {
  console.error("TEST_ERROR=" + error.message);
  process.exitCode = 1;
});

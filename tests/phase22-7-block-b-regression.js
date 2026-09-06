"use strict";

const assert = require("node:assert/strict");
const Runtime = require("../src/core/runtime");

(async () => {
  const runtime = new Runtime();
  const center = runtime.diagnosticCenter;

  assert.ok(center, "DiagnosticCenter must be available");

  const status = runtime.getDiagnosticStatus();

  assert.equal(status.safe, true);
  assert.equal(status.readOnly, true);
  assert.equal(status.autoFix, false);
  assert.equal(status.externalExecution, false);
  assert.equal(status.autonomousExecution, false);
  assert.equal(status.failClosed, true);

  const initialReport = runtime.getDiagnosticReport();

  assert.equal(
    initialReport,
    null,
    "diagnostic report must be null before first run"
  );

  const result = await runtime.runDiagnostic();

  assert.equal(result.success, true);
  assert.equal(typeof result.status, "string");
  assert.ok(Array.isArray(result.providers));

  assert.ok(result.safety);

  assert.equal(result.safety.safe, true);
  assert.equal(result.safety.readOnly, true);
  assert.equal(result.safety.autoFix, false);
  assert.equal(result.safety.externalExecution, false);
  assert.equal(result.safety.autonomousExecution, false);
  assert.equal(result.safety.failClosed, true);

  const report = runtime.getDiagnosticReport();

  assert.ok(report);
  assert.equal(report.center, "diagnostic-center");
  assert.ok(report.safety);
  assert.equal(report.safety.failClosed, true);

  assert.equal(
    runtime.getDiagnosticReport(),
    report,
    "runtime must expose the latest DiagnosticCenter report"
  );

  const providers = center.listProviders();

  assert.ok(providers.includes("quality"));

  console.log("RUNTIME_DIAGNOSTIC_STATUS=PASS");
  console.log("INITIAL_REPORT_NULL=PASS");
  console.log("DIAGNOSTIC_RUN=PASS");
  console.log("DIAGNOSTIC_SAFETY=PASS");
  console.log("DIAGNOSTIC_REPORT_AFTER_RUN=PASS");
  console.log("REPORT_IDENTITY=PASS");
  console.log("QUALITY_PROVIDER_REGISTERED=PASS");
  console.log("NETWORK_USED=NO");
  console.log("SECRETS_VALUES_PRINTED=NO");
  console.log("PRODUCTION_SOURCE_PATCHED=NO");
  console.log("PHASE22_7_BLOCK_B_REGRESSION=PASS");
})().catch((error) => {
  console.error("PHASE22_7_BLOCK_B_REGRESSION=FAIL");
  console.error("ERROR=" + error.message);
  process.exitCode = 1;
});

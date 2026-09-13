"use strict";

const assert = require("assert");
const DiagnosticCenter = require("../src/diagnostic-center");

(async () => {
  const center = new DiagnosticCenter();

  const finding = {
    findingId: "DC8-REAL-CENTER-REGRESSION-001",
    classification: "FAIL",
    severity: "HIGH",
    title: "Synthetic canonical execution failure",
    evidence:
      "Controlled synthetic diagnostic evidence.",
    rootCause:
      "Synthetic root cause: execution request uses a non-canonical path.",
    affectedFiles: [
      "src/example/canonical-path.js"
    ],
    requiredFix:
      "Route the request through the canonical execution path.",
    patchScope:
      "Modify only src/example/canonical-path.js.",
    targetedTest:
      "node tests/example-canonical-path.js",
    securityImpact:
      "Production routing must remain fail-closed.",
    expectedResult:
      "The request reaches the canonical execution path.",
    correlationId:
      "dc8-regression-correlation-001",
    sessionId:
      "dc8-regression-session-001",
    approvalId:
      "dc8-regression-approval-001",
    planId:
      "dc8-regression-plan-001"
  };

  center.registerProvider(
    "dc8-regression-synthetic",
    {
      name: "dc8-regression-synthetic",
      type: "diagnostic-synthetic",
      safe: true,
      readOnly: true,
      autoFix: false,
      externalExecution: false,
      autonomousExecution: false,
      failClosed: true,
      requiresApproval: true,

      run() {
        return {
          success: false,
          status: "FAIL",
          provider: "dc8-regression-synthetic",
          findings: [finding]
        };
      }
    }
  );

  const report = await center.run({
    providers: [
      "dc8-regression-synthetic"
    ]
  });

  assert.ok(report);
  assert.strictEqual(
    typeof report,
    "object"
  );

  /*
   * A diagnostic FAIL is a finding, not a
   * DiagnosticCenter pipeline failure.
   */
  assert.strictEqual(
    report.success,
    true
  );

  assert.strictEqual(
    report.status,
    "FAIL"
  );

  assert.ok(report.evidence);
  assert.ok(report.correlation);
  assert.ok(report.rootCause);
  assert.ok(report.repairPlan);

  assert.strictEqual(
    report.evidence.findings.length,
    1
  );

  const evidence =
    report.evidence.findings[0];

  assert.strictEqual(
    evidence.correlationId,
    "dc8-regression-correlation-001"
  );

  assert.strictEqual(
    evidence.sessionId,
    "dc8-regression-session-001"
  );

  assert.strictEqual(
    evidence.approvalId,
    "dc8-regression-approval-001"
  );

  assert.strictEqual(
    evidence.planId,
    "dc8-regression-plan-001"
  );

  assert.ok(
    report.correlation.groups.length >= 1
  );

  const correlated =
    report.correlation.findings[0];

  assert.strictEqual(
    correlated.ids.correlationId,
    "dc8-regression-correlation-001"
  );

  assert.strictEqual(
    correlated.ids.sessionId,
    "dc8-regression-session-001"
  );

  assert.strictEqual(
    correlated.ids.approvalId,
    "dc8-regression-approval-001"
  );

  assert.strictEqual(
    correlated.ids.planId,
    "dc8-regression-plan-001"
  );

  assert.strictEqual(
    report.rootCause.rootCauses.length,
    1
  );

  const rootCause =
    report.rootCause.rootCauses[0];

  assert.strictEqual(
    rootCause.rootCause,
    "Synthetic root cause: execution request uses a non-canonical path."
  );

  assert.strictEqual(
    rootCause.requiredFix,
    "Route the request through the canonical execution path."
  );

  assert.strictEqual(
    rootCause.patchScope,
    "Modify only src/example/canonical-path.js."
  );

  assert.strictEqual(
    rootCause.targetedTest,
    "node tests/example-canonical-path.js"
  );

  assert.strictEqual(
    rootCause.securityImpact,
    "Production routing must remain fail-closed."
  );

  assert.strictEqual(
    rootCause.expectedResult,
    "The request reaches the canonical execution path."
  );

  assert.strictEqual(
    report.repairPlan.plans.length,
    1
  );

  assert.strictEqual(
    report.repairPlan.summary.readyForRepair,
    1
  );

  const plan =
    report.repairPlan.plans[0];

  assert.strictEqual(
    plan.status,
    "READY_FOR_REPAIR"
  );

  assert.strictEqual(
    plan.findingId,
    "DC8-REAL-CENTER-REGRESSION-001"
  );

  assert.strictEqual(
    plan.correlationIds.correlationId,
    "dc8-regression-correlation-001"
  );

  /*
   * Safety: diagnostic reporting may produce
   * a repair plan, but it must never execute it.
   */
  const status =
    center.getStatus();

  assert.strictEqual(
    status.safe,
    true
  );

  assert.strictEqual(
    status.readOnly,
    true
  );

  assert.strictEqual(
    status.autoFix,
    false
  );

  assert.strictEqual(
    status.externalExecution,
    false
  );

  assert.strictEqual(
    status.autonomousExecution,
    false
  );

  assert.strictEqual(
    status.failClosed,
    true
  );

  console.log(
    "DC8_REGRESSION_ASYNC_REPORT=PASS"
  );

  console.log(
    "DC8_REGRESSION_DIAGNOSTIC_FAIL_STATUS=PASS"
  );

  console.log(
    "DC8_REGRESSION_EVIDENCE=PASS"
  );

  console.log(
    "DC8_REGRESSION_CORRELATION=PASS"
  );

  console.log(
    "DC8_REGRESSION_ROOTCAUSE=PASS"
  );

  console.log(
    "DC8_REGRESSION_REPAIR_READY=PASS"
  );

  console.log(
    "DC8_REGRESSION_SAFETY=PASS"
  );

  console.log(
    "\nDC8_REAL_FINDING_REGRESSION=PASS"
  );
})().catch(error => {
  console.error(
    "\nDC8_REAL_FINDING_REGRESSION=FAIL"
  );
  console.error(
    error.stack || error.message || String(error)
  );
  process.exitCode = 1;
});

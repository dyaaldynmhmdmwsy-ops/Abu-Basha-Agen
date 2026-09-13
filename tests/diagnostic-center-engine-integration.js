"use strict";

const assert = require("assert");
const DiagnosticCenter = require("../src/diagnostic-center");

async function main() {
  const center = new DiagnosticCenter();

  assert.deepStrictEqual(
    center.listProviders(),
    [
      "path-intelligence",
      "environment-forensic",
      "project-audit",
      "quality"
    ],
    "Existing provider composition must remain unchanged."
  );

  assert.strictEqual(center.evidenceEngine.name, "evidence-engine");
  assert.strictEqual(center.correlationEngine.name, "correlation-engine");
  assert.strictEqual(center.rootCauseEngine.name, "root-cause-engine");
  assert.strictEqual(center.repairPlanEngine.name, "repair-plan-engine");

  const report = await center.run({
    providers: []
  });

  assert.strictEqual(
    report.success,
    true,
    "Empty provider diagnostic must remain successful."
  );

  assert.strictEqual(report.status, "PASS");

  assert.ok(report.evidence);
  assert.ok(report.correlation);
  assert.ok(report.rootCause);
  assert.ok(report.repairPlan);

  assert.strictEqual(
    report.correlation.success,
    true
  );

  assert.strictEqual(
    report.rootCause.success,
    true
  );

  assert.strictEqual(
    report.repairPlan.success,
    true
  );

  assert.ok(
    Array.isArray(report.findings),
    "Integrated findings must be an array."
  );

  assert.ok(
    report.classificationCounts &&
    typeof report.classificationCounts === "object",
    "Classification counts must be exposed."
  );

  assert.strictEqual(
    report.repairReady,
    false,
    "No repair plan may be invented from empty evidence."
  );

  assert.strictEqual(report.safety.safe, true);
  assert.strictEqual(report.safety.readOnly, true);
  assert.strictEqual(report.safety.autoFix, false);
  assert.strictEqual(report.safety.externalExecution, false);
  assert.strictEqual(report.safety.autonomousExecution, false);
  assert.strictEqual(report.safety.failClosed, true);

  assert.strictEqual(
    center.getReport(),
    report
  );

  console.log("DC8_ENGINE_IDENTITY=PASS");
  console.log("DC8_PROVIDER_COMPOSITION_PRESERVED=PASS");
  console.log("DC8_EVIDENCE_INTEGRATION=PASS");
  console.log("DC8_CORRELATION_INTEGRATION=PASS");
  console.log("DC8_ROOT_CAUSE_INTEGRATION=PASS");
  console.log("DC8_REPAIR_PLAN_INTEGRATION=PASS");
  console.log("DC8_NO_INVENTED_REPAIR=PASS");
  console.log("DC8_REPORT_CONTRACT=PASS");
  console.log("DC8_SAFETY_CONTRACT=PASS");
  console.log("DC8_FAIL_CLOSED_CONTRACT=PASS");
  console.log("DC8_ENGINE_INTEGRATION_TEST=PASS");
}

main().catch((error) => {
  console.error(`DC8_ENGINE_INTEGRATION_TEST=FAIL`);
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});

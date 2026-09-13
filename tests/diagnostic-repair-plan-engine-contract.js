"use strict";

const RepairPlanEngine = require(
  "../src/diagnostic-center/repair-plan-engine"
);

let failures = 0;

function check(name, condition) {
  if (condition) {
    console.log(`${name}=PASS`);
  } else {
    console.log(`${name}=FAIL`);
    failures += 1;
  }
}

(() => {
  const engine = new RepairPlanEngine();
  const status = engine.getStatus();

  check(
    "ENGINE_IDENTITY",
    engine.name === "repair-plan-engine" &&
      engine.type === "diagnostic-repair-plan" &&
      engine.version === "1.0.0"
  );

  check(
    "SAFETY_CONTRACT",
    status.safe === true &&
      status.readOnly === true &&
      status.autoFix === false &&
      status.externalExecution === false &&
      status.autonomousExecution === false &&
      status.failClosed === true &&
      status.requiresApproval === true
  );

  const report = engine.buildReport({
    rootCauses: [
      {
        findingId: "finding-ready",
        provider: "provider-a",
        classification: "FAIL",
        rootCause:
          "Explicitly proven contract failure",
        evidence: [
          "Direct execution evidence"
        ],
        affectedFiles: [
          "src/example.js"
        ],
        requiredFix:
          "Correct the canonical implementation",
        patchScope:
          "Modify only src/example.js",
        targetedTest:
          "Run the targeted contract regression",
        securityImpact:
          "Preserve fail-closed execution behavior",
        expectedResult:
          "Targeted regression passes",
        correlationIds: {
          correlationId: "corr-001",
          sessionId: "session-001"
        }
      },
      {
        findingId: "finding-incomplete",
        provider: "provider-b",
        classification: "FAIL",
        rootCause:
          "Explicitly proven but incomplete finding",
        evidence: [
          "Failure evidence"
        ],
        affectedFiles: [
          "src/incomplete.js"
        ],
        requiredFix:
          "Fix the implementation"
      }
    ]
  });

  check(
    "REPORT_SUCCESS",
    report.success === true &&
      report.status === "PASS" &&
      report.type === "diagnostic_repair_plan_report"
  );

  check(
    "READY_FOR_REPAIR_ONLY_WHEN_COMPLETE",
    report.summary.readyForRepair === 1 &&
      report.plans.length === 1 &&
      report.plans[0].findingId === "finding-ready" &&
      report.plans[0].status === "READY_FOR_REPAIR"
  );

  check(
    "REQUIRED_FIX_PRESERVED",
    report.plans[0].requiredFix ===
      "Correct the canonical implementation"
  );

  check(
    "PATCH_SCOPE_PRESERVED",
    report.plans[0].patchScope ===
      "Modify only src/example.js"
  );

  check(
    "TARGETED_TEST_PRESERVED",
    report.plans[0].targetedTest ===
      "Run the targeted contract regression"
  );

  check(
    "SECURITY_IMPACT_PRESERVED",
    report.plans[0].securityImpact ===
      "Preserve fail-closed execution behavior"
  );

  check(
    "EXPECTED_RESULT_PRESERVED",
    report.plans[0].expectedResult ===
      "Targeted regression passes"
  );

  check(
    "CORRELATION_PRESERVED",
    report.plans[0].correlationIds.correlationId ===
      "corr-001"
  );

  check(
    "INCOMPLETE_PLAN_NOT_PROMOTED",
    report.unresolved.some(
      (item) =>
        item.findingId === "finding-incomplete" &&
        item.reason ===
          "repair_plan_requirements_not_explicitly_proven"
    )
  );

  const invalid = engine.buildReport(null);

  check(
    "FAIL_CLOSED_INVALID_INPUT",
    invalid.success === false &&
      invalid.status === "FAIL" &&
      invalid.failClosed === true
  );

  console.log();
  console.log(
    `DIAGNOSTIC_REPAIR_PLAN_ENGINE_FAILURES=${failures}`
  );

  if (failures === 0) {
    console.log(
      "DIAGNOSTIC_REPAIR_PLAN_ENGINE_CONTRACT_TEST=PASS"
    );
    process.exitCode = 0;
  } else {
    console.log(
      "DIAGNOSTIC_REPAIR_PLAN_ENGINE_CONTRACT_TEST=FAIL"
    );
    process.exitCode = 1;
  }
})();

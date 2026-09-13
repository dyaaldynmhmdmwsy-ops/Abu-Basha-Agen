"use strict";

const CorrelationEngine = require("../src/diagnostic-center/correlation-engine");

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
  const engine = new CorrelationEngine();

  const status = engine.getStatus();

  check(
    "ENGINE_IDENTITY",
    engine.name === "correlation-engine" &&
      engine.type === "diagnostic-correlation" &&
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

  const report = engine.buildReport([
    {
      provider: "provider-a",
      status: "PASS",
      findings: [
        {
          findingId: "finding-a",
          classification: "PROVEN",
          correlationId: "corr-001",
          sessionId: "session-001",
          affectedFiles: ["src/a.js"],
          evidence: ["direct evidence"]
        }
      ]
    },
    {
      provider: "provider-b",
      status: "FAIL",
      findings: [
        {
          findingId: "finding-b",
          classification: "FAIL",
          correlationId: "corr-001",
          sessionId: "session-001",
          affectedFiles: ["src/b.js"],
          evidence: ["direct failure evidence"]
        }
      ]
    },
    {
      provider: "provider-c",
      status: "WARN",
      findings: [
        {
          findingId: "finding-c",
          classification: "GAP",
          affectedFiles: ["src/c.js"],
          evidence: ["no correlation identifier"]
        }
      ]
    }
  ]);

  check(
    "REPORT_SUCCESS",
    report.success === true &&
      report.status === "PASS" &&
      report.type === "diagnostic_correlation_report"
  );

  check(
    "CORRELATION_GROUP_CREATED",
    report.summary.correlationGroups >= 2
  );

  check(
    "MULTI_FINDING_CORRELATION",
    report.summary.multiFindingGroups >= 1 &&
      report.multiFindingGroups.some(
        (group) =>
          group.key === "correlationId" &&
          group.value === "corr-001" &&
          group.findingIds.includes("finding-a") &&
          group.findingIds.includes("finding-b")
      )
  );

  check(
    "UNCORRELATED_EVIDENCE_NOT_INVENTED",
    report.uncorrelatedFindingIds.includes("finding-c")
  );

  const invalid = engine.collect(null);

  check(
    "FAIL_CLOSED_INVALID_INPUT",
    invalid.success === false &&
      invalid.status === "FAIL" &&
      invalid.failClosed === true
  );

  console.log();
  console.log(`DIAGNOSTIC_CORRELATION_ENGINE_FAILURES=${failures}`);

  if (failures === 0) {
    console.log("DIAGNOSTIC_CORRELATION_ENGINE_CONTRACT_TEST=PASS");
    process.exitCode = 0;
  } else {
    console.log("DIAGNOSTIC_CORRELATION_ENGINE_CONTRACT_TEST=FAIL");
    process.exitCode = 1;
  }
})();

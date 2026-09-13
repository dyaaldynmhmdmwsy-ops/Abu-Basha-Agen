"use strict";

const RootCauseEngine = require(
  "../src/diagnostic-center/root-cause-engine"
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
  const engine = new RootCauseEngine();
  const status = engine.getStatus();

  check(
    "ENGINE_IDENTITY",
    engine.name === "root-cause-engine" &&
      engine.type === "diagnostic-root-cause" &&
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

  const report = engine.analyze({
    findings: [
      {
        findingId: "finding-fail",
        provider: "provider-a",
        classification: "FAIL",
        evidence: [
          "Direct execution evidence"
        ],
        affectedFiles: [
          "src/example.js"
        ],
        ids: {
          correlationId: "corr-001",
          sessionId: "session-001"
        },
        source: {
          rootCause:
            "Explicitly proven contract failure in src/example.js"
        }
      },
      {
        findingId: "finding-gap",
        provider: "provider-b",
        classification: "GAP",
        evidence: [
          "Missing implementation evidence"
        ],
        affectedFiles: [
          "src/unknown.js"
        ],
        ids: {
          correlationId: "corr-001"
        }
      },
      {
        findingId: "finding-no-cause",
        provider: "provider-c",
        classification: "FAIL",
        evidence: [
          "Failure exists but cause is not explicit"
        ],
        ids: {
          correlationId: "corr-002"
        }
      }
    ]
  });

  check(
    "REPORT_SUCCESS",
    report.success === true &&
      report.status === "PASS" &&
      report.type === "diagnostic_root_cause_report"
  );

  check(
    "PROVEN_ROOT_CAUSE_ONLY",
    report.summary.provenRootCauses === 1 &&
      report.rootCauses[0].findingId ===
        "finding-fail"
  );

  check(
    "ROOT_CAUSE_TEXT_PRESERVED",
    report.rootCauses[0].rootCause ===
      "Explicitly proven contract failure in src/example.js"
  );

  check(
    "CORRELATION_PRESERVED",
    report.rootCauses[0].correlationIds.correlationId ===
      "corr-001"
  );

  check(
    "AFFECTED_FILES_PRESERVED",
    report.rootCauses[0].affectedFiles.includes(
      "src/example.js"
    )
  );

  check(
    "UNPROVEN_CAUSE_NOT_INVENTED",
    report.unresolved.some(
      (item) =>
        item.findingId === "finding-no-cause" &&
        item.reason ===
          "root_cause_not_explicitly_proven"
    )
  );

  check(
    "GAP_NOT_PROMOTED_TO_ROOT_CAUSE",
    report.unresolved.some(
      (item) =>
        item.findingId === "finding-gap" &&
        item.reason ===
          "insufficient_proven_evidence"
    )
  );

  const invalid = engine.analyze(null);

  check(
    "FAIL_CLOSED_INVALID_INPUT",
    invalid.success === false &&
      invalid.status === "FAIL" &&
      invalid.failClosed === true
  );

  console.log();
  console.log(
    `DIAGNOSTIC_ROOT_CAUSE_ENGINE_FAILURES=${failures}`
  );

  if (failures === 0) {
    console.log(
      "DIAGNOSTIC_ROOT_CAUSE_ENGINE_CONTRACT_TEST=PASS"
    );
    process.exitCode = 0;
  } else {
    console.log(
      "DIAGNOSTIC_ROOT_CAUSE_ENGINE_CONTRACT_TEST=FAIL"
    );
    process.exitCode = 1;
  }
})();

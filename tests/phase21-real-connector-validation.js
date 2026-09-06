"use strict";

const Runtime = require("../src/core/runtime");

(async () => {
  if (process.env.PHASE21_REAL_CONNECTOR !== "1") {
    console.log("PHASE21_REAL_CONNECTOR=SKIPPED");
    console.log("NETWORK_CALL=NOT_PERFORMED");
    console.log("REAL_TEST_REQUIRES_EXPLICIT_FLAG=YES");
    return;
  }

  const runtime = new Runtime();

  const result = await runtime.connectorGateway.execute(
    "gemini",
    {
      prompt: "Reply with exactly: GEMINI_REAL_VALIDATION_OK",
      timeoutMs: 60000
    },
    {
      sessionId: "phase21-real-validation",
      correlationId: `phase21-real-${Date.now()}`
    },
    {
      approved: true,
      requiresApproval: true,
      externalExecution: true
    }
  );

  console.log("=== PHASE 21 — REAL CONNECTOR REGRESSION ===");
  console.log("EXECUTION_SUCCESS=" +
    (result.success === true ? "PASS" : "FAIL"));
  console.log("RESULT_TYPE=" + (result.type || "unknown"));
  console.log("GEMINI_RESPONSE_RECEIVED=" +
    (result.success === true ? "YES" : "NO"));
  console.log("EXECUTION_ALLOWED=" +
    (result.executionAllowed === true ? "YES" : "NO"));
  console.log("AUDIT_OUTCOME_PERSISTED=" +
    (result.auditOutcomePersisted === true ? "YES" : "NO"));
  console.log("SECRET_VALUES=NOT_PRINTED");
  console.log("NETWORK_CALL=PERFORMED");

  const pass =
    result.success === true &&
    result.type === "gemini_response" &&
    result.executionAllowed === true &&
    result.auditOutcomePersisted === true;

  console.log("PHASE21_REAL_CONNECTOR_REGRESSION=" +
    (pass ? "PASS" : "FAIL"));

  if (!pass) {
    process.exitCode = 1;
  }
})();

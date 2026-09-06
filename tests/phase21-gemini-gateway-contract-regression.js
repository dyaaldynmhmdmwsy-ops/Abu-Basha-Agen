"use strict";

const assert = require("assert");
const Runtime = require("../src/core/runtime");

async function main() {
  const runtime = new Runtime();

  const entry = runtime.connectorHub.get("gemini");

  assert.ok(entry, "Gemini connector must be registered");
  assert.strictEqual(
    entry.metadata.requiresApproval,
    true,
    "Gemini must require approval"
  );
  assert.strictEqual(
    entry.metadata.externalExecution,
    true,
    "Gemini must be marked as external execution"
  );

  const blocked =
    runtime.connectorGateway.canExecute(
      "gemini",
      { approved: false }
    );

  assert.strictEqual(
    blocked.success,
    false,
    "Unapproved Gemini execution must be blocked"
  );

  assert.strictEqual(
    blocked.type,
    "approval_required",
    "Unapproved Gemini execution must fail at approval gate"
  );

  assert.strictEqual(
    blocked.executionAllowed,
    false,
    "Unapproved Gemini executionAllowed must be false"
  );

  const allowed =
    runtime.connectorGateway.canExecute(
      "gemini",
      { approved: true }
    );

  assert.strictEqual(
    allowed.success,
    true,
    "Approved Gemini gate preflight must succeed"
  );

  assert.strictEqual(
    allowed.executionAllowed,
    true,
    "Approved Gemini gate preflight must allow execution"
  );

  console.log("GEMINI_REGISTERED=YES");
  console.log("REQUIRES_APPROVAL=YES");
  console.log("EXTERNAL_EXECUTION=YES");
  console.log("UNAPPROVED_BLOCKED=YES");
  console.log("UNAPPROVED_TYPE=approval_required");
  console.log("APPROVED_ALLOWED=YES");
  console.log("NETWORK_CALL=NOT_PERFORMED");
  console.log("SECRET_VALUES=NOT_PRINTED");
  console.log("PHASE21_GEMINI_GATE_REGRESSION=PASS");
}

main().catch((error) => {
  console.error(
    "PHASE21_GEMINI_GATE_REGRESSION=FAIL"
  );
  console.error(
    "ERROR=" + String(error?.message || error).slice(0, 240)
  );
  process.exitCode = 1;
});

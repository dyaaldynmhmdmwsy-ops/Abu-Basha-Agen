"use strict";

const assert = require("assert");
const Runtime = require("../src/core/runtime");

(async () => {
  const runtime = new Runtime();

  assert.ok(runtime.master, "MASTER_MISSING");
  assert.strictEqual(
    typeof runtime.delegateToAbuBashaWithApproval,
    "function",
    "ABU_BASHA_APPROVAL_API_MISSING"
  );

  const result = await runtime.delegateToAbuBashaWithApproval({
    text: "Create a simulated Abu Basha content proposal",
    intent: "content"
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.type, "delegation_approval_created");

  assert.ok(
    result.coordination &&
    result.coordination.success === true,
    "APPROVAL_COORDINATION_FAILED"
  );

  assert.ok(result.approval, "APPROVAL_NOT_CREATED");

  assert.strictEqual(
    result.coordination.executable,
    false,
    "COORDINATION_MUST_NOT_EXECUTE"
  );

  console.log("APPROVAL_E2E_DELEGATION=PASS");
  console.log("APPROVAL_E2E_COORDINATION=PASS");
  console.log("APPROVAL_E2E_APPROVAL_CREATED=PASS");
  console.log("APPROVAL_E2E_EXECUTION_BLOCKED=PASS");
  console.log("PHASE9_MASTER_APPROVAL_E2E_TEST=PASS");
})().catch((error) => {
  console.error("PHASE9_MASTER_APPROVAL_E2E_TEST=FAIL");
  console.error(error.message);
  process.exitCode = 1;
});

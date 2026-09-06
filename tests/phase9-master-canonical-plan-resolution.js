const assert = require("node:assert/strict");
const Runtime = require("../src/core/runtime");

(async () => {
  const runtime = new Runtime();

  const delegated = await runtime.delegateToAbuBashaWithApproval({
    text: "Phase 9 canonical plan regression",
    intent: "content"
  });

  assert.equal(delegated.success, true);
  const approval = delegated.approval;
  assert.ok(approval && approval.id && approval.planId);

  const registered = runtime.planRegistry.get(approval.planId);
  assert.ok(registered);
  assert.equal(registered.id, approval.planId);
  console.log("CANONICAL_PLAN_REGISTERED=PASS");

  const blocked = await runtime.executeApproved(approval.id);
  assert.equal(blocked.success, false);
  console.log("PRE_APPROVAL_BLOCKED=PASS");

  const approved = runtime.approve(approval.id);
  assert.equal(approved.success, true);
  console.log("APPROVAL=PASS");

  const executed = await runtime.executeApproved(approval.id);
  assert.equal(executed.success, true);
  assert.equal(executed.type, "approved_execution");
  assert.equal(executed.result.steps.length, 1);
  assert.equal(executed.result.steps[0].success, true);
  console.log("CANONICAL_APPROVED_EXECUTION=PASS");
  console.log("PHASE9_CANONICAL_PLAN_RESOLUTION_REGRESSION=PASS");
})().catch(error => {
  console.error("PHASE9_CANONICAL_PLAN_RESOLUTION_REGRESSION=FAIL");
  console.error(error.stack || error);
  process.exitCode = 1;
});

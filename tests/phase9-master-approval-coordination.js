"use strict";

const assert = require("assert");
const Master = require("../src/agents/master");

(() => {
  const master = new Master();

  const valid = master.prepareApproval({
    success: true,
    type: "plan_pod_proposal",
    planId: "content_service",
    pod: "abu-basha",
    requiresApproval: true,
    executable: false,
    proposal: { success: true }
  });

  assert.strictEqual(valid.success, true);
  assert.strictEqual(valid.type, "approval_request");
  assert.strictEqual(valid.requiresApproval, true);
  assert.strictEqual(valid.executable, false);
  console.log("APPROVAL_COORDINATION_PASS=PASS");

  const unsafe = master.prepareApproval({
    success: true,
    planId: "content_service",
    pod: "abu-basha",
    requiresApproval: true,
    executable: true,
    proposal: {}
  });

  assert.strictEqual(unsafe.success, false);
  assert.strictEqual(unsafe.type, "unsafe_proposal_state");
  console.log("APPROVAL_UNSAFE_FAIL_CLOSED=PASS");

  const incomplete = master.prepareApproval({
    success: true,
    requiresApproval: true,
    executable: false
  });

  assert.strictEqual(incomplete.success, false);
  assert.strictEqual(incomplete.type, "approval_context_incomplete");
  console.log("APPROVAL_CONTEXT_FAIL_CLOSED=PASS");

  console.log("PHASE9_MASTER_APPROVAL_COORDINATION_TEST=PASS");
})();

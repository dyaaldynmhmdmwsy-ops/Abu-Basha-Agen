"use strict";

const assert = require("assert");
const Master = require("../src/agents/master");
const AbuBashaPod = require("../src/agents/pods/abu-basha");

(async () => {
  const master = new Master();
  const pod = new AbuBashaPod({ mode: "simulation" });

  master.registerPod("abu-basha", pod);

  const registry = {
    plans: new Map([
      ["content_service", {
        id: "content_service",
        name: "AI Content Service",
        category: "content",
        steps: []
      }],
      ["security_research", {
        id: "security_research",
        name: "Authorized Security Research",
        category: "security",
        steps: []
      }]
    ]),
    get(id) {
      return this.plans.get(id);
    },
    register(id, definition) {
      this.plans.set(id, { id, ...definition });
      return { success: true, id };
    }
  };

  master.attachPlanRegistry(registry);

  const compatible = master.evaluatePlanPodCompatibility(
    registry.get("content_service"),
    "abu-basha"
  );

  assert.strictEqual(compatible.success, true);
  assert.strictEqual(compatible.type, "plan_pod_compatible");
  assert.strictEqual(compatible.executable, false);
  assert.strictEqual(compatible.requiresApproval, true);
  console.log("DECISION_COMPATIBILITY_PASS=PASS");

  const denied = master.evaluatePlanPodCompatibility(
    registry.get("security_research"),
    "abu-basha"
  );

  assert.strictEqual(denied.success, false);
  assert.strictEqual(
    denied.type,
    "plan_pod_compatibility_denied"
  );
  console.log("DECISION_MISMATCH_FAIL_CLOSED=PASS");

  const proposal = await master.proposePlanWithPod({
    intent: "content"
  });

  assert.strictEqual(proposal.success, true);
  assert.strictEqual(proposal.type, "plan_pod_proposal");
  assert.strictEqual(proposal.executable, false);
  assert.strictEqual(proposal.requiresApproval, true);
  console.log("DECISION_GATE_PROPOSAL_PASS=PASS");

  console.log("PHASE9_MASTER_DECISION_GATE_TEST=PASS");
})().catch((error) => {
  console.error("PHASE9_MASTER_DECISION_GATE_TEST=FAIL");
  console.error(error.message);
  process.exitCode = 1;
});

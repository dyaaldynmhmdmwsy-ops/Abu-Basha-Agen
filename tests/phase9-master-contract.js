"use strict";

const assert = require("assert");
const Master = require("../src/agents/master");

(async () => {
  const master = new Master({ mode: "simulation" });

  assert.strictEqual(master.name, "master");
  assert.strictEqual(master.type, "orchestrator");
  assert.strictEqual(master.version, "1.0.0");
  assert.strictEqual(master.mode, "simulation");

  assert.strictEqual(master.externalExecution, false);
  assert.strictEqual(master.requiresApproval, true);

  assert.strictEqual(typeof master.registerPod, "function");
  assert.strictEqual(typeof master.delegate, "function");
  assert.strictEqual(typeof master.getStatus, "function");

  const pod = {
    async propose(task) {
      return {
        success: true,
        type: "proposal",
        task
      };
    }
  };

  const registration = master.registerPod("test-pod", pod);

  assert.strictEqual(registration.success, true);
  assert.strictEqual(master.hasPod("test-pod"), true);
  assert.deepStrictEqual(master.listPods(), ["test-pod"]);

  const delegation = await master.delegate(
    { intent: "test_intent", payload: { value: 1 } },
    { pod: "test-pod" }
  );

  assert.strictEqual(delegation.success, true);
  assert.strictEqual(delegation.type, "delegated");
  assert.strictEqual(delegation.master, "master");
  assert.strictEqual(delegation.pod, "test-pod");
  assert.strictEqual(delegation.proposal.success, true);

  const status = master.getStatus();

  assert.strictEqual(status.name, "master");
  assert.strictEqual(status.type, "orchestrator");
  assert.strictEqual(status.mode, "simulation");
  assert.strictEqual(status.externalExecution, false);
  assert.deepStrictEqual(status.pods, ["test-pod"]);

  console.log("PHASE9_MASTER_BASELINE_CONTRACT=PASS");
  console.log("PHASE9_MASTER_SAFETY_CONTRACT=PASS");
  console.log("PHASE9_MASTER_DELEGATION_CONTRACT=PASS");
})();

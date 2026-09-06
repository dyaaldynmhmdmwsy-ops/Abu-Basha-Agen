"use strict";

const assert = require("assert");

const AgentRuntime = require("../src/core/runtime");
const Master = require("../src/agents/master");
const AbuBashaPod = require("../src/agents/pods/abu-basha");

console.log("========================================");
console.log("=== PHASE 3 AGENT & POD CONTRACT TEST ===");
console.log("========================================");

(async () => {
  // ---------------------------------------------------------
  // 1. Master construction
  // ---------------------------------------------------------

  console.log("[1] Master construction");

  const master = new Master({
    mode: "simulation"
  });

  assert.strictEqual(master.name, "master");
  assert.strictEqual(master.type, "orchestrator");
  assert.strictEqual(master.mode, "simulation");
  assert.notStrictEqual(
    master.externalExecution,
    true
  );

  console.log("PASS");

  // ---------------------------------------------------------
  // 2. Abu Basha construction
  // ---------------------------------------------------------

  console.log("[2] Abu Basha Pod construction");

  const abu = new AbuBashaPod({
    mode: "simulation"
  });

  assert.strictEqual(
    abu.name,
    "abu-basha"
  );

  assert.strictEqual(
    abu.type,
    "specialized-pod"
  );

  assert.strictEqual(
    abu.mode,
    "simulation"
  );

  assert.notStrictEqual(
    abu.externalExecution,
    true
  );

  assert.strictEqual(
    abu.requiresApproval,
    true
  );

  assert.strictEqual(
    typeof abu.propose,
    "function"
  );

  console.log("PASS");

  // ---------------------------------------------------------
  // 3. Master registration
  // ---------------------------------------------------------

  console.log("[3] Master Pod registration");

  const registration =
    master.registerPod(
      "abu-basha",
      abu
    );

  assert.strictEqual(
    registration.success,
    true
  );

  assert.strictEqual(
    master.hasPod("abu-basha"),
    true
  );

  assert.deepStrictEqual(
    master.listPods(),
    ["abu-basha"]
  );

  console.log("PASS");

  // ---------------------------------------------------------
  // 4. Duplicate registration protection
  // ---------------------------------------------------------

  console.log("[4] Duplicate registration protection");

  const duplicate =
    master.registerPod(
      "abu-basha",
      abu
    );

  assert.strictEqual(
    duplicate.success,
    false
  );

  assert.strictEqual(
    duplicate.type,
    "pod_already_exists"
  );

  console.log("PASS");

  // ---------------------------------------------------------
  // 5. Safe delegation
  // ---------------------------------------------------------

  console.log("[5] Master → Abu Basha delegation");

  const delegation =
    await master.delegate(
      {
        type: "content_review",
        topic: "Abu Basha"
      },
      {
        pod: "abu-basha"
      }
    );

  assert.strictEqual(
    delegation.success,
    true
  );

  assert.strictEqual(
    delegation.type,
    "delegated"
  );

  assert.strictEqual(
    delegation.master,
    "master"
  );

  assert.strictEqual(
    delegation.pod,
    "abu-basha"
  );

  assert.ok(
    delegation.proposal
  );

  assert.notStrictEqual(
    delegation.proposal.externalExecution,
    true
  );

  assert.strictEqual(
    delegation.proposal.requiresApproval,
    true
  );

  console.log("PASS");

  // ---------------------------------------------------------
  // 6. Runtime ownership integrity
  // ---------------------------------------------------------

  console.log("[6] Runtime Master/Pod ownership");

  const runtime =
    new AgentRuntime();

  assert.ok(runtime.master);
  assert.ok(runtime.abuBashaPod);

  assert.strictEqual(
    runtime.master.hasPod("abu-basha"),
    true
  );

  assert.strictEqual(
    runtime.master.pods.get("abu-basha"),
    runtime.abuBashaPod
  );

  console.log("PASS");

  // ---------------------------------------------------------
  // 7. Runtime safety boundary
  // ---------------------------------------------------------

  console.log("[7] External execution boundary");

  assert.notStrictEqual(
    runtime.master.externalExecution,
    true
  );

  assert.notStrictEqual(
    runtime.abuBashaPod.externalExecution,
    true
  );

  console.log("PASS");

  // ---------------------------------------------------------
  // 8. Runtime delegation path
  // ---------------------------------------------------------

  console.log("[8] Runtime delegation → approval");

  const approval =
    await runtime.delegateToAbuBashaWithApproval({
      type: "content_review",
      topic: "Abu Basha"
    });

  assert.strictEqual(
    approval.success,
    true
  );

  assert.strictEqual(
    approval.type,
    "delegation_approval_created"
  );

  assert.ok(
    approval.approval
  );

  assert.strictEqual(
    approval.approval.status,
    "pending_approval"
  );

  console.log("PASS");

  // ---------------------------------------------------------
  // 9. No automatic external action
  // ---------------------------------------------------------

  console.log("[9] No automatic external execution");

  assert.strictEqual(
    approval.proposal.externalExecution,
    false
  );

  assert.strictEqual(
    approval.proposal.simulationOnly,
    true
  );

  console.log("PASS");

  // ---------------------------------------------------------
  // FINAL
  // ---------------------------------------------------------

  console.log("");
  console.log("========================================");
  console.log("=== PHASE 3 AGENT & PODS TEST PASS ===");
  console.log("========================================");
})().catch((err) => {
  console.error("");
  console.error("PHASE 3 TEST FAILED");
  console.error(err.stack || err.message);
  process.exit(1);
});

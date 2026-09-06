"use strict";

const assert = require("assert");

const Master = require("../src/agents/master");
const AbuBashaPod = require("../src/agents/pods/abu-basha");

async function main() {
  console.log("==========================================");
  console.log(" MASTER + ABU BASHA CONTRACT TEST");
  console.log("==========================================");

  console.log("[1] Master construction");

  const master = new Master({
    mode: "simulation"
  });

  assert.strictEqual(master.name, "master");
  assert.strictEqual(master.type, "orchestrator");
  assert.strictEqual(master.mode, "simulation");

  console.log("PASS");

  console.log("[2] Abu Basha Pod construction");

  const abu = new AbuBashaPod({
    mode: "simulation"
  });

  assert.strictEqual(abu.name, "abu-basha");
  assert.strictEqual(abu.type, "specialized-pod");
  assert.strictEqual(abu.mode, "simulation");

  console.log("PASS");

  console.log("[3] Safety boundary");

  assert.strictEqual(
    abu.externalExecution,
    false
  );

  assert.strictEqual(
    abu.requiresApproval,
    true
  );

  console.log("PASS");

  console.log("[4] Pod registration");

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

  console.log("PASS");

  console.log("[5] Duplicate registration protection");

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

  console.log("[6] Safe delegation");

  const result =
    await master.delegate(
      {
        type: "content_request",
        topic: "Abu Basha"
      },
      {
        pod: "abu-basha"
      }
    );

  assert.strictEqual(
    result.success,
    true
  );

  assert.strictEqual(
    result.type,
    "delegated"
  );

  assert.strictEqual(
    result.pod,
    "abu-basha"
  );

  assert.strictEqual(
    result.proposal.externalExecution,
    false
  );

  assert.strictEqual(
    result.proposal.requiresApproval,
    true
  );

  console.log("PASS");

  console.log("[7] External execution remains disabled");

  assert.strictEqual(
    abu.externalExecution,
    false
  );

  console.log("PASS");

  console.log("==========================================");
  console.log(" MASTER + ABU BASHA CONTRACT TEST PASS");
  console.log("==========================================");
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(2);
});

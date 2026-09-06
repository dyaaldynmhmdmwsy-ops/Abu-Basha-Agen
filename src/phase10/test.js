"use strict";

const assert = require("assert");
const OperationalControlLayer = require("./index");

class FakeRuntime {
  constructor() {
    this.approvals = [];
  }

  createApproval(plan) {
    const item = {
      id: `approval-${this.approvals.length + 1}`,
      status: "pending",
      plan
    };

    this.approvals.push(item);

    return {
      success: true,
      item
    };
  }

  async executeApproved(id, action, payload) {
    const approval = this.approvals.find(
      item => item.id === id
    );

    if (!approval || approval.status !== "approved") {
      return {
        type: "approval_required"
      };
    }

    return {
      type: "approved_execution",
      id,
      action,
      payload
    };
  }

  getStatus() {
    return {
      runtime: true,
      externalExecution: false
    };
  }
}

(async () => {
  console.log("==========================================");
  console.log(" PHASE 10 OPERATIONAL CONTROL TEST");
  console.log("==========================================");

  const runtime = new FakeRuntime();
  const layer = new OperationalControlLayer(runtime);

  console.log("[1] Construction");
  assert.strictEqual(layer.getStatus().phase, 10);
  console.log("PASS");

  console.log("[2] Safety boundary");
  assert.strictEqual(
    layer.getStatus().requireApproval,
    true
  );
  assert.strictEqual(
    layer.getStatus().externalExecution,
    false
  );
  console.log("PASS");

  console.log("[3] Goal validation");
  assert.strictEqual(
    layer.validateGoal({
      goal: "test objective"
    }).valid,
    true
  );

  assert.strictEqual(
    layer.validateGoal(null).valid,
    false
  );
  console.log("PASS");

  console.log("[4] Planning");
  const planned = layer.buildPlan({
    goal: "test objective"
  });

  assert.strictEqual(planned.valid, true);
  assert.strictEqual(planned.executable, false);
  assert.ok(Array.isArray(planned.plan.steps));
  console.log("PASS");

  console.log("[5] Approval gate");
  const prepared = await layer.prepare({
    goal: "safe operation"
  });

  assert.strictEqual(
    prepared.type,
    "approval_required"
  );

  assert.strictEqual(
    prepared.executable,
    false
  );

  assert.strictEqual(
    prepared.externalExecution,
    false
  );

  console.log("PASS");

  console.log("[6] External execution blocked");
  const blocked = await layer.executeApproved(
    "approval-1",
    "test",
    {}
  );

  assert.strictEqual(
    blocked.type,
    "execution_blocked"
  );

  console.log("PASS");

  console.log("[7] Dry-run isolation");
  const dry = new OperationalControlLayer(
    runtime,
    { dryRun: true }
  );

  const dryResult = await dry.prepare({
    goal: "dry run"
  });

  assert.strictEqual(
    dryResult.type,
    "dry_run"
  );

  assert.strictEqual(
    dryResult.executable,
    false
  );

  console.log("PASS");

  console.log("[8] History");
  assert.ok(layer.getHistory().length >= 2);
  console.log("PASS");

  console.log("[9] Inspection");
  const status = layer.inspect();

  assert.strictEqual(
    status.executionBoundary.approvalRequired,
    true
  );

  assert.strictEqual(
    status.executionBoundary.externalExecutionBlocked,
    true
  );

  assert.strictEqual(
    status.executionBoundary.executableByDefault,
    false
  );

  console.log("PASS");

  console.log("[10] Final safety contract");
  assert.strictEqual(
    layer.getStatus().safe,
    true
  );

  console.log("PASS");

  console.log("==========================================");
  console.log(" PHASE 10 OPERATIONAL CONTROL PASS");
  console.log("==========================================");
})().catch(error => {
  console.error("PHASE10_TEST=FAIL");
  console.error(error.stack || error);
  process.exit(1);
});

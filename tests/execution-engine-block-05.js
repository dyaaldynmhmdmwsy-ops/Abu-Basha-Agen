"use strict";

const assert = require("assert");
const PlanExecutor = require("../src/plan-executors");
const AuditStore = require("../src/observability/audit-store");

async function main() {
  console.log("========================================");
  console.log(" BLOCK 05 CANONICAL PLAN EXECUTOR TEST");
  console.log("========================================");

  const plan = {
    id: "canonical-block-05",
    name: "Canonical Block 05 Plan",
    externalExecution: false,
    executionAllowed: false
  };

  const definition = {
    id: plan.id,
    name: plan.name,
    category: "test",
    steps: [
      {
        name: "approved_control",
        label: "Approved canonical control",
        type: "control"
      }
    ]
  };

  let approved = false;

  const runtime = {
    approvals: {
      getAll() {
        return [
          {
            id: "approval-block-05",
            planId: plan.id,
            status: approved ? "approved" : "pending",
            plan
          }
        ];
      }
    },

    planRegistry: {
      get(planId) {
        return planId === plan.id ? definition : null;
      }
    },

    connectorPolicy: null,

    auditStore: new AuditStore({
      dbPath: ":memory:"
    }),

    developerTools: {
      getStatus() {
        return {
          name: "Test Developer Tool Registry",
          status: "online"
        };
      }
    }
  };

  console.log("[1] PlanExecutor bootstrap");

  const executor = new PlanExecutor(runtime);

  assert.strictEqual(
    executor.getStatus().status,
    "online"
  );

  console.log("PASS");

  console.log("[2] Pending approval blocks execution");

  const blocked = await executor.execute(
    "approval-block-05"
  );

  assert.strictEqual(blocked.success, false);
  assert.strictEqual(
    blocked.type,
    "approval_required"
  );

  console.log("PASS");

  console.log("[3] Approval enables canonical execution");

  approved = true;

  const result = await executor.execute(
    "approval-block-05"
  );

  assert.strictEqual(result.success, true);
  assert.strictEqual(
    result.type,
    "plan_execution"
  );
  assert.strictEqual(
    result.plan.id,
    plan.id
  );
  assert.strictEqual(
    result.definition.id,
    plan.id
  );
  assert.strictEqual(
    result.steps.length,
    1
  );
  assert.strictEqual(
    result.steps[0].success,
    true
  );
  assert.strictEqual(
    result.steps[0].executor,
    "Control Executor"
  );

  console.log("PASS");

  console.log("[4] Unknown step type rejected by StepPolicy");

  runtime.planRegistry.get = () => ({
    id: plan.id,
    name: plan.name,
    category: "test",
    steps: [
      {
        name: "unknown_step",
        label: "Unknown step",
        type: "unknown"
      }
    ]
  });

  const rejected = await executor.execute(
    "approval-block-05"
  );

  assert.strictEqual(rejected.success, false);
  assert.strictEqual(
    rejected.type,
    "plan_execution_failed"
  );
  assert.strictEqual(
    rejected.failedStep.type,
    "step_policy_rejected"
  );
  assert.strictEqual(
    rejected.failedStep.policy.type,
    "step_type_not_allowed"
  );

  console.log("PASS");

  console.log("[5] Canonical status integrity");

  const status = executor.getStatus();

  assert.strictEqual(
    status.name,
    "Plan Executor"
  );
  assert.strictEqual(
    status.version,
    "1.5.0"
  );
  assert.strictEqual(
    status.status,
    "online"
  );
  assert.ok(status.policy);
  assert.ok(status.executors);
  assert.ok(status.executors.control);

  console.log("PASS");

  console.log("========================================");
  console.log(" BLOCK 05 CANONICAL PLAN EXECUTOR: PASS");
  console.log("========================================");
  console.log("BLOCK05_CANONICAL_PLAN_EXECUTOR=PASS");
}

main().catch(error => {
  console.error("BLOCK05_CANONICAL_PLAN_EXECUTOR=FAIL");
  console.error(error);
  process.exitCode = 1;
});

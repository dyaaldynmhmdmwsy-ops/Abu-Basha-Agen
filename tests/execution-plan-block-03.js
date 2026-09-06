"use strict";

const assert = require("assert");

const ExecutionPlanner =
  require("../src/execution-plan");

const planner =
  new ExecutionPlanner();

console.log("========================================");
console.log(" BLOCK 03 EXECUTION PLAN TEST");
console.log("========================================");

console.log("[1] Planner bootstrap");

const status =
  planner.getStatus();

assert.strictEqual(
  status.status,
  "online"
);

assert.strictEqual(
  status.executionEnabled,
  false
);

assert.strictEqual(
  status.externalExecution,
  false
);

console.log("PASS");

console.log("[2] Development plan");

const dev =
  planner.createPlan(
    "برمجة تطبيق جديد"
  );

assert.strictEqual(
  dev.type,
  "execution_plan"
);

assert.strictEqual(
  dev.status,
  "ready"
);

assert.ok(
  dev.planId
);

assert.strictEqual(
  dev.steps.length,
  1
);

assert.strictEqual(
  dev.steps[0].tool,
  "developer"
);

console.log("PASS");

console.log("[3] Bot plan");

const bot =
  planner.createPlan(
    "إنشاء بوت جديد"
  );

assert.strictEqual(
  bot.status,
  "ready"
);

assert.strictEqual(
  bot.steps[0].tool,
  "bot-builder"
);

assert.strictEqual(
  bot.requiresApproval,
  true
);

console.log("PASS");

console.log("[4] App plan");

const app =
  planner.createPlan(
    "إنشاء تطبيق أندرويد"
  );

assert.strictEqual(
  app.steps[0].tool,
  "app-builder"
);

assert.strictEqual(
  app.requiresApproval,
  true
);

console.log("PASS");

console.log("[5] Repair plan");

const repair =
  planner.createPlan(
    "تشخيص مشكلة في الهاتف"
  );

assert.strictEqual(
  repair.steps[0].tool,
  "diagnostics"
);

assert.strictEqual(
  repair.requiresApproval,
  true
);

console.log("PASS");

console.log("[6] Research plan");

const research =
  planner.createPlan(
    "ابحث عن معلومات في الإنترنت"
  );

assert.strictEqual(
  research.steps[0].tool,
  "web-research"
);

assert.strictEqual(
  research.external,
  undefined
);

assert.strictEqual(
  research.executionAllowed,
  false
);

assert.strictEqual(
  research.steps[0].external,
  true
);

console.log("PASS");

console.log("[7] Media plan");

const media =
  planner.createPlan(
    "مونتاج فيديو"
  );

assert.strictEqual(
  media.steps[0].tool,
  "media"
);

console.log("PASS");

console.log("[8] Empty task");

const empty =
  planner.createPlan("");

assert.strictEqual(
  empty.status,
  "no_task"
);

assert.strictEqual(
  empty.steps.length,
  0
);

assert.strictEqual(
  empty.executionAllowed,
  false
);

console.log("PASS");

console.log("[9] Unknown task");

const unknown =
  planner.createPlan(
    "مهمة غير معروفة تماماً"
  );

assert.strictEqual(
  unknown.status,
  "no_tool"
);

assert.strictEqual(
  unknown.steps.length,
  0
);

assert.strictEqual(
  unknown.executionAllowed,
  false
);

console.log("PASS");

console.log("[10] Execution boundary");

for (const plan of [
  dev,
  bot,
  app,
  repair,
  research,
  media
]) {
  assert.strictEqual(
    plan.executionAllowed,
    false
  );

  for (const step of plan.steps) {
    assert.strictEqual(
      step.executionAllowed,
      false
    );
  }
}

console.log("PASS");

console.log("[11] History");

assert.ok(
  planner.getHistory().length >= 6
);

console.log("PASS");

console.log("");
console.log("========================================");
console.log("BLOCK 03 TEST: PASS");
console.log("========================================");

console.log(
  JSON.stringify(
    planner.getStatus(),
    null,
    2
  )
);

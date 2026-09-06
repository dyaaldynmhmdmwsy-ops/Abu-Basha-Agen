"use strict";

const assert = require("assert");

const AgentToolRouter =
  require("../src/tool-routing");

const router =
  new AgentToolRouter();

function checkRoute(text, expectedTool) {
  const result = router.route(text);

  assert.strictEqual(
    result.type,
    "tool_route"
  );

  assert.strictEqual(
    result.status,
    "matched"
  );

  assert.ok(result.tool);

  assert.strictEqual(
    result.tool.name,
    expectedTool
  );

  return result;
}

console.log("========================================");
console.log(" BLOCK 02 TOOL ROUTING TEST");
console.log("========================================");

console.log("[1] Router bootstrap");

const status =
  router.getStatus();

assert.strictEqual(
  status.status,
  "online"
);

assert.ok(
  status.total >= 6
);

console.log("PASS");

console.log("[2] Web research routing");

const web =
  checkRoute(
    "ابحث عن معلومات في الإنترنت",
    "web-research"
  );

assert.strictEqual(
  web.external,
  true
);

assert.strictEqual(
  web.executionAllowed,
  false
);

console.log("PASS");

console.log("[3] Development routing");

const dev =
  checkRoute(
    "برمجة تطبيق جديد",
    "developer"
  );

assert.strictEqual(
  dev.requiresApproval,
  true
);

console.log("PASS");

console.log("[4] Bot routing");

const bot =
  checkRoute(
    "إنشاء بوت جديد",
    "bot-builder"
  );

assert.strictEqual(
  bot.requiresApproval,
  true
);

console.log("PASS");

console.log("[5] App routing");

const app =
  checkRoute(
    "إنشاء تطبيق أندرويد",
    "app-builder"
  );

assert.strictEqual(
  app.requiresApproval,
  true
);

console.log("PASS");

console.log("[6] Repair routing");

const repair =
  checkRoute(
    "تشخيص مشكلة في الهاتف",
    "diagnostics"
  );

assert.strictEqual(
  repair.requiresApproval,
  true
);

console.log("PASS");

console.log("[7] Media routing");

const media =
  checkRoute(
    "مونتاج فيديو",
    "media"
  );

assert.strictEqual(
  media.requiresApproval,
  true
);

console.log("PASS");

console.log("[8] Empty task");

const empty =
  router.route("");

assert.strictEqual(
  empty.status,
  "no_task"
);

assert.strictEqual(
  empty.tool,
  null
);

console.log("PASS");

console.log("[9] Unknown task");

const unknown =
  router.route(
    "مهمة غير معروفة تماماً"
  );

assert.strictEqual(
  unknown.status,
  "no_match"
);

assert.strictEqual(
  unknown.tool,
  null
);

console.log("PASS");

console.log("[10] External execution boundary");

for (const result of [
  web,
  dev,
  bot,
  app,
  repair,
  media
]) {
  assert.strictEqual(
    result.executionAllowed,
    false
  );
}

console.log("PASS");

console.log("");
console.log("========================================");
console.log("BLOCK 02 ROUTING TEST: PASS");
console.log("========================================");

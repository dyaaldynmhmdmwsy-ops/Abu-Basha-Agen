"use strict";

const assert = require("assert");

const catalog =
  require(
    process.cwd() +
    "/src/tool-catalog"
  );

const ToolRegistry =
  require(
    process.cwd() +
    "/src/tool-catalog/registry"
  );

const registry =
  new ToolRegistry();

console.log("========================================");
console.log(" BLOCK 06 TOOL REGISTRY TEST");
console.log("========================================");

console.log("[1] Bootstrap");

assert.strictEqual(
  registry.status,
  "online"
);

console.log("PASS");

console.log("[2] Register expanded catalog");

const registrations =
  registry.registerMany(catalog);

assert.strictEqual(
  registrations.length,
  catalog.length
);

assert.ok(
  catalog.length >= 15
);

console.log("PASS");

console.log("[3] Required capabilities");

for (const name of [
  "developer",
  "web-research",
  "bot-builder",
  "app-builder",
  "diagnostics",
  "media",
  "file-manager",
  "terminal",
  "git",
  "database",
  "document",
  "scheduler",
  "social-media",
  "analytics",
  "content-engine",
  "ai-model"
]) {
  assert.ok(
    registry.get(name),
    `Missing tool: ${name}`
  );
}

console.log("PASS");

console.log("[4] Enabled tools");

assert.ok(
  registry.listEnabled().length >= 15
);

console.log("PASS");

console.log("[5] Category lookup");

assert.ok(
  registry.byCategory("development")
    .length >= 1
);

assert.ok(
  registry.byCategory("creation")
    .length >= 2
);

console.log("PASS");

console.log("[6] Developer discovery");

const developer =
  registry.select(
    "برمجة وتطوير كود"
  );

assert.ok(developer);

console.log("PASS");

console.log("[7] Research discovery");

const research =
  registry.select(
    "ابحث عن معلومات في الإنترنت"
  );

assert.ok(research);

assert.strictEqual(
  research.name,
  "web-research"
);

console.log("PASS");

console.log("[8] Repair discovery");

const repair =
  registry.select(
    "تشخيص وإصلاح الهاتف"
  );

assert.ok(repair);

assert.strictEqual(
  repair.name,
  "diagnostics"
);

console.log("PASS");

console.log("[9] Social discovery");

const social =
  registry.select(
    "إدارة فيسبوك ويوتيوب وتيك توك"
  );

assert.ok(social);

assert.strictEqual(
  social.name,
  "social-media"
);

console.log("PASS");

console.log("[10] External boundary metadata");

const externalTools =
  registry.list().filter(
    tool => tool.external === true
  );

assert.ok(
  externalTools.length >= 4
);

for (const tool of externalTools) {
  assert.strictEqual(
    tool.executor,
    null
  );
}

console.log("PASS");

console.log("[11] Approval metadata");

for (const tool of registry.list()) {
  assert.strictEqual(
    typeof tool.requiresApproval,
    "boolean"
  );
}

console.log("PASS");

console.log("[12] History");

assert.ok(
  registry.getHistory().length >= 4
);

console.log("PASS");

console.log("[13] Status");

const status =
  registry.getStatus();

assert.strictEqual(
  status.status,
  "online"
);

assert.ok(
  status.total >= 15
);

assert.ok(
  status.enabled >= 15
);

console.log("PASS");

console.log("");
console.log("========================================");
console.log("BLOCK 06 TEST: PASS");
console.log("========================================");

console.log(
  JSON.stringify(
    status,
    null,
    2
  )
);

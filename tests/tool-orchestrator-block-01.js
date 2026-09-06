"use strict";

const assert = require("assert");

const ToolOrchestrator =
  require("../src/tool-orchestrator");

const catalog =
  require("../src/tool-orchestrator/catalog");

const orchestrator =
  new ToolOrchestrator();

console.log("=== BLOCK 01 ORCHESTRATOR TEST ===");

console.log("[1] Register catalog");

orchestrator.registerMany(catalog);

assert.strictEqual(
  orchestrator.getStatus().total,
  catalog.length
);

console.log("PASS");

console.log("[2] Required tools");

assert.ok(
  orchestrator.get("web-research")
);

assert.ok(
  orchestrator.get("developer")
);

assert.ok(
  orchestrator.get("bot-builder")
);

assert.ok(
  orchestrator.get("app-builder")
);

assert.ok(
  orchestrator.get("diagnostics")
);

assert.ok(
  orchestrator.get("media")
);

console.log("PASS");

console.log("[3] Web research routing");

const web =
  orchestrator.select(
    "ابحث عن معلومات في الإنترنت"
  );

assert.ok(web);
assert.strictEqual(
  web.name,
  "web-research"
);

console.log("PASS");

console.log("[4] Development routing");

const dev =
  orchestrator.select(
    "برمجة وتطوير كود"
  );

assert.ok(dev);
assert.strictEqual(
  dev.name,
  "developer"
);

console.log("PASS");

console.log("[5] Repair routing");

const repair =
  orchestrator.select(
    "تشخيص مشكلة في الهاتف"
  );

assert.ok(repair);
assert.strictEqual(
  repair.name,
  "diagnostics"
);

console.log("PASS");

console.log("[6] Approval policy");

assert.strictEqual(
  orchestrator.get("developer").requiresApproval,
  true
);

assert.strictEqual(
  orchestrator.get("bot-builder").requiresApproval,
  true
);

assert.strictEqual(
  orchestrator.get("app-builder").requiresApproval,
  true
);

assert.strictEqual(
  orchestrator.get("diagnostics").requiresApproval,
  true
);

console.log("PASS");

console.log("[7] External boundary");

assert.strictEqual(
  orchestrator.get("web-research").external,
  true
);

assert.strictEqual(
  orchestrator.get("web-research").executor,
  null
);

console.log("PASS");

console.log("[8] Disabled tools excluded");

const disabledTool = {
  name: "disabled-test-tool",
  category: "test",
  description: "Disabled test tool",
  capabilities: ["اختبار"],
  enabled: false,
  requiresApproval: true,
  external: false
};

orchestrator.register(disabledTool);

assert.strictEqual(
  orchestrator.get("disabled-test-tool").enabled,
  false
);

const disabledResult =
  orchestrator.select("اختبار");

assert.ok(
  !disabledResult ||
  disabledResult.name !== "disabled-test-tool"
);

console.log("PASS");

console.log("[9] History");

assert.ok(
  orchestrator.getHistory().length >= 3
);

console.log("PASS");

console.log("[10] Status integrity");

const status =
  orchestrator.getStatus();

assert.strictEqual(
  status.status,
  "online"
);

assert.ok(
  status.total >= catalog.length
);

assert.ok(
  status.enabled >= catalog.length
);

console.log("PASS");

console.log("");
console.log("========================================");
console.log("BLOCK 01 TEST: PASS");
console.log("========================================");

console.log(
  JSON.stringify(status, null, 2)
);

"use strict";

const ModelRegistry = require("../src/ai/model-registry");
const ModelRouter = require("../src/ai/model-router");

const registry = new ModelRegistry();

if (registry.getStatus().status !== "online") {
  throw new Error("REGISTRY_OFFLINE");
}

if (!registry.has("gemini-3.6-flash")) {
  throw new Error("DEFAULT_MODEL_MISSING");
}

const router = new ModelRouter({ registry });

const selected = router.resolve();
if (!selected.success || selected.model.id !== "gemini-3.6-flash") {
  throw new Error("DEFAULT_ROUTING_FAILED");
}

const requested = router.resolve("gemini-3.5-flash");
if (!requested.success || requested.model.id !== "gemini-3.5-flash") {
  throw new Error("REQUESTED_ROUTING_FAILED");
}

const missing = router.resolve("not-a-real-model");
if (missing.success || missing.type !== "model_not_found") {
  throw new Error("UNKNOWN_MODEL_GUARD_FAILED");
}

const status = router.getStatus();
if (status.status !== "online") {
  throw new Error("ROUTER_STATUS_FAILED");
}

console.log("========================================");
console.log(" CORE INTELLIGENCE — PHASE 2 TEST");
console.log("========================================");
console.log("REGISTRY=PASS");
console.log("DEFAULT_ROUTING=PASS");
console.log("REQUESTED_ROUTING=PASS");
console.log("UNKNOWN_MODEL_GUARD=PASS");
console.log("ROUTER_STATUS=PASS");
console.log("========================================");
console.log("PHASE 2 CORE INTELLIGENCE: PASS");
console.log("TEST_RESULT=PASS");

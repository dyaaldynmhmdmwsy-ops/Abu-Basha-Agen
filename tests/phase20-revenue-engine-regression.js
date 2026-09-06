"use strict";

const assert = require("assert");
const RevenueEngine = require("../src/revenue");
const Runtime = require("../src/core/runtime");

function testCanonicalRevenueEngine() {
  const revenue = new RevenueEngine();

  assert.strictEqual(revenue.version, "2.0.0");
  assert.strictEqual(revenue.status, "online");

  const opportunities = revenue.listOpportunities();

  assert.strictEqual(opportunities.length, 5);

  for (const opportunity of opportunities) {
    assert.strictEqual(opportunity.requiresApproval, true);
  }

  const content = revenue.getOpportunity("content_service");
  assert.ok(content);
  assert.strictEqual(content.id, "content_service");

  assert.strictEqual(
    revenue.getOpportunity("does_not_exist"),
    null
  );

  const contentSearch = revenue.searchOpportunities("content");
  assert.ok(
    contentSearch.some(item => item.id === "content_service")
  );

  const telegramSearch = revenue.searchOpportunities("telegram");
  assert.ok(
    telegramSearch.some(item => item.id === "telegram_service")
  );

  const allSearch = revenue.searchOpportunities("");
  assert.strictEqual(allSearch.length, 5);

  const planResult = revenue.createPlan("content_service");

  assert.strictEqual(planResult.success, true);
  assert.ok(planResult.plan);
  assert.strictEqual(planResult.plan.requiresApproval, true);
  assert.ok(Array.isArray(planResult.plan.steps));
  assert.ok(planResult.plan.steps.length > 0);

  const missingPlan = revenue.createPlan("does_not_exist");

  assert.strictEqual(missingPlan.success, false);

  return true;
}

function testRuntimeRevenueBridge() {
  const runtime = new Runtime();

  const opportunities = runtime.listRevenueOpportunities();

  assert.strictEqual(opportunities.length, 5);

  const planResult =
    runtime.createRevenuePlanWithApproval("content_service");

  assert.strictEqual(planResult.success, true);
  assert.ok(planResult.plan);
  assert.ok(planResult.approval);

  assert.strictEqual(
    planResult.plan.requiresApproval,
    true
  );

  assert.strictEqual(
    planResult.approval.status,
    "pending_approval"
  );

  assert.strictEqual(
    planResult.plan.externalExecution,
    undefined
  );

  return true;
}

function testCatalogRemoval() {
  const fs = require("fs");
  const path = require("path");

  const obsoleteCatalog = path.resolve(
    __dirname,
    "../src/revenue/opportunities.js"
  );

  assert.strictEqual(
    fs.existsSync(obsoleteCatalog),
    false
  );

  return true;
}

testCanonicalRevenueEngine();
testRuntimeRevenueBridge();
testCatalogRemoval();

console.log("PHASE20_REVENUE_ENGINE_REGRESSION=PASS");
console.log("CANONICAL_REVENUE_ENGINE=PASS");
console.log("APPROVAL_REQUIRED=PASS");
console.log("RUNTIME_REVENUE_BRIDGE=PASS");
console.log("OBSOLETE_CATALOG_REMOVED=PASS");

"use strict";

/*
 * Phase 9 is deliberately discovery-driven.
 *
 * It does NOT invent business actions.
 * It reports the actual capabilities exposed by the project.
 * It provides a safe boundary for the next stage.
 */

const fs = require("fs");
const path = require("path");

function exists(p) {
  return fs.existsSync(path.resolve(process.cwd(), p));
}

function discover() {
  const domains = [
    ["runtime", "src/core/runtime.js"],
    ["agent", "src/agent.js"],
    ["agents", "src/agents"],
    ["approval", "src/approval"],
    ["connectors", "src/connectors"],
    ["connectorGateway", "src/connector-gateway"],
    ["executors", "src/executors"],
    ["planExecutors", "src/plan-executors"],
    ["executionPlan", "src/execution-plan"],
    ["toolCatalog", "src/tool-catalog"],
    ["toolOrchestrator", "src/tool-orchestrator"],
    ["toolRouting", "src/tool-routing"],
    ["revenue", "src/revenue"],
    ["skills", "src/skills"],
    ["phase8", "src/phase8"]
  ];

  const status = {};

  status.legacyPlanningPaths = {
    executionPlan: exists("src/execution-plan"),
    toolRouting: exists("src/tool-routing"),
    executionPath: "legacy_discovery_only"
  };

  for (const [name, target] of domains) {
    status[name] = exists(target);
  }

  return status;
}

function getStatus() {
  const discovered = discover();

  return {
    phase: 9,
    name: "Discovery & Capability Boundary",
    safe: true,
    executable: false,
    externalExecution: false,
    requireApproval: true,
    discovered
  };
}

function validate() {
  const status = getStatus();

  const required = [
    "runtime",
    "agent",
    "approval",
    "connectors",
    "executors",
    "planExecutors",
    "phase8"
  ];

  const missing = required.filter(
    key => status.discovered[key] !== true
  );

  return {
    valid: missing.length === 0,
    missing,
    status
  };
}

module.exports = {
  discover,
  getStatus,
  validate
};

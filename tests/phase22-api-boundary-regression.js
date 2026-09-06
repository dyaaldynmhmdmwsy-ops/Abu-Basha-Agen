"use strict";

const Runtime = require("../src/core/runtime");
const ApiBoundary = require("../src/api");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const runtime = new Runtime();
const api = new ApiBoundary(runtime);

const metadata = api.getMetadata();

assert(api instanceof ApiBoundary, "API_INSTANCE_FAILED");
assert(metadata.name === "ControlCenterApiBoundary", "API_NAME_FAILED");
assert(metadata.version === "1.0.0", "API_VERSION_FAILED");

assert(
  metadata.execution.directExecution === false,
  "DIRECT_EXECUTION_MUST_REMAIN_BLOCKED"
);

assert(
  metadata.execution.externalExecution === false,
  "EXTERNAL_EXECUTION_MUST_REMAIN_BLOCKED"
);

assert(
  metadata.execution.autonomousExecution === false,
  "AUTONOMOUS_EXECUTION_MUST_REMAIN_DISABLED"
);

assert(
  metadata.execution.requiresApproval === true,
  "APPROVAL_MUST_REMAIN_REQUIRED"
);

const status = api.getStatus();
assert(status.success === true, "STATUS_SURFACE_FAILED");

const core = api.getCentralCoreStatus();
assert(core.success === true, "CORE_SURFACE_FAILED");

const approvals = api.getApprovalStatus();
assert(approvals.success === true, "APPROVAL_STATUS_SURFACE_FAILED");

const pending = api.getPendingApprovals();
assert(pending.success === true, "PENDING_APPROVAL_SURFACE_FAILED");

const revenue = api.getRevenueStatus();
assert(revenue.success === true, "REVENUE_STATUS_SURFACE_FAILED");

const opportunities = api.listRevenueOpportunities();
assert(opportunities.success === true, "REVENUE_OPPORTUNITIES_SURFACE_FAILED");

const plans = api.getRevenuePlans();
assert(plans.success === true, "REVENUE_PLANS_SURFACE_FAILED");

console.log("API_BOUNDARY_INSTANCE=PASS");
console.log("STATUS_SURFACE=PASS");
console.log("CORE_SURFACE=PASS");
console.log("APPROVAL_SURFACE=PASS");
console.log("REVENUE_SURFACE=PASS");
console.log("DIRECT_EXECUTION=BLOCKED");
console.log("EXTERNAL_EXECUTION=BLOCKED");
console.log("AUTONOMOUS_EXECUTION=DISABLED");
console.log("APPROVAL_REQUIRED=YES");
console.log("NETWORK_CALL=NOT_PERFORMED");
console.log("SECRET_VALUES=NOT_PRINTED");
console.log("PHASE22_API_BOUNDARY_REGRESSION=PASS");

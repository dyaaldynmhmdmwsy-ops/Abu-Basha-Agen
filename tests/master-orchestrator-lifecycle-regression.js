"use strict";

const Runtime = require("../src/core/runtime");

(async () => {
  const runtime = new Runtime();

  const master = runtime.master;
  const verificationGate = runtime.verificationGate;
  const approvalGate = runtime.approvalGate;

  const checks = {
    master_present:
      !!master &&
      master.type === "orchestrator" &&
      master.externalExecution === false &&
      master.requiresApproval === true,

    plan_registry_attached:
      !!master.planRegistry &&
      typeof master.planRegistry.register === "function",

    verification_gate_present:
      !!verificationGate &&
      verificationGate.constructor.name === "PlanVerificationGate",

    human_approval_gate_present:
      !!approvalGate &&
      approvalGate.constructor.name === "HumanApprovalGate",

    abu_basha_registered:
      typeof master.hasPod === "function" &&
      master.hasPod("abu-basha") === true,

    master_status_safe:
      master.getStatus().externalExecution === false &&
      master.getStatus().requiresApproval === true
  };

  for (const [name, value] of Object.entries(checks)) {
    console.log(
      name.toUpperCase() + "=" + (value ? "PASS" : "FAIL")
    );
  }

  const passed = Object.values(checks).every(Boolean);

  console.log(
    "MASTER_LIFECYCLE_REGRESSION=" +
      (passed ? "PASS" : "FAIL")
  );

  if (!passed) {
    process.exitCode = 1;
  }
})();

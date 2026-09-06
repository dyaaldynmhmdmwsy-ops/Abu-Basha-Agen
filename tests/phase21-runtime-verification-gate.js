"use strict";

const Runtime = require("../src/core/runtime");

(async () => {
  const runtime = new Runtime();

  let prepareApprovalCalls = 0;

  const originalPrepareApproval =
    runtime.master.prepareApproval.bind(runtime.master);

  runtime.master.prepareApproval = function (...args) {
    prepareApprovalCalls += 1;
    return originalPrepareApproval(...args);
  };

  const normal =
    await runtime.delegateToAbuBashaWithApproval({
      task: "phase21 permanent regression normal path"
    });

  const normalPass =
    normal &&
    normal.success === true &&
    normal.coordination &&
    normal.coordination.success === true;

  console.log(
    "NORMAL_VERIFICATION_PATH=" +
      (normalPass ? "PASS" : "FAIL")
  );

  const originalVerify =
    runtime.verificationGate.verify.bind(
      runtime.verificationGate
    );

  runtime.verificationGate.verify = function () {
    return {
      type: "verification_blocked",
      safe: true,
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      verified: false,
      reason: "TEST_FORCED_VERIFICATION_FAILURE"
    };
  };

  const pendingBefore =
    runtime.approvals.getPending().length;

  const prepareCallsBefore =
    prepareApprovalCalls;

  const blocked =
    await runtime.delegateToAbuBashaWithApproval({
      task: "phase21 permanent regression blocked path"
    });

  const pendingAfter =
    runtime.approvals.getPending().length;

  const prepareCallsAfter =
    prepareApprovalCalls;

  runtime.verificationGate.verify =
    originalVerify;

  const blockedPass =
    blocked &&
    blocked.success === false &&
    blocked.type === "delegation_verification_failed" &&
    blocked.verification &&
    blocked.verification.verified === false;

  const approvalBlocked =
    pendingAfter === pendingBefore;

  const coordinationBlocked =
    prepareCallsAfter === prepareCallsBefore;

  console.log(
    "VERIFICATION_FAILURE_BLOCKED=" +
      (blockedPass ? "PASS" : "FAIL")
  );

  console.log(
    "APPROVAL_NOT_CREATED_AFTER_FAILURE=" +
      (approvalBlocked ? "PASS" : "FAIL")
  );

  console.log(
    "PREPARE_APPROVAL_NOT_REACHED=" +
      (coordinationBlocked ? "PASS" : "FAIL")
  );

  if (
    normalPass &&
    blockedPass &&
    approvalBlocked &&
    coordinationBlocked
  ) {
    console.log(
      "PHASE21_RUNTIME_VERIFICATION_REGRESSION=PASS"
    );
  } else {
    console.log(
      "PHASE21_RUNTIME_VERIFICATION_REGRESSION=FAIL"
    );
    process.exitCode = 1;
  }
})().catch(error => {
  console.error(
    "TEST_ERROR=" + (error.message || String(error))
  );
  process.exitCode = 1;
});

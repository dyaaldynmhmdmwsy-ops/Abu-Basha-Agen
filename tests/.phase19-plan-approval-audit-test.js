"use strict";

const Runtime = require("../src/core/runtime");

(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sessionId = `phase19-plan-session-${suffix}`;
  const correlationId = `phase19-plan-correlation-${suffix}`;
  const planId = `phase19-plan-${suffix}`;

  const runtime = new Runtime();

  try {
    const plan = {
      id: planId,
      name: "Phase 19 Plan Approval Audit Test",
      category: "diagnostic",
      steps: [
        {
          name: "phase19_audit_step",
          label: "Phase 19 Audit Step",
          type: "execution"
        }
      ]
    };

    const registration = runtime.planRegistry.register(plan.id, {
      name: plan.name,
      category: plan.category,
      steps: plan.steps
    });

    if (!registration || registration.success !== true) {
      throw new Error("PLAN_REGISTRATION_FAILED");
    }

    const approvalResult = runtime.approvals.create(plan);

    if (!approvalResult || approvalResult.success !== true) {
      throw new Error("APPROVAL_CREATION_FAILED");
    }

    const approvalId = approvalResult.item.id;

    const approveResult = runtime.approvals.approve(approvalId);

    if (!approveResult || approveResult.success !== true) {
      throw new Error("APPROVAL_APPROVAL_FAILED");
    }

    if (
      !runtime.planExecutor.executionExecutor ||
      typeof runtime.planExecutor.executionExecutor.execute !== "function"
    ) {
      throw new Error("EXECUTION_EXECUTOR_UNAVAILABLE");
    }

    const originalExecute =
      runtime.planExecutor.executionExecutor.execute;

    runtime.planExecutor.executionExecutor.execute = async () => ({
      success: true,
      type: "phase19_safe_executor_stub",
      executionAllowed: false,
      externalExecution: false
    });

    let result;

    try {
      result = await runtime.planExecutor.execute(
        approvalId,
        {},
        {
          sessionId,
          correlationId
        }
      );
    } finally {
      runtime.planExecutor.executionExecutor.execute = originalExecute;
    }

    const events =
      runtime.auditStore.getEvents({
        sessionId,
        correlationId
      }) || [];

    const intent = events.find(
      event =>
        event.event_type === "execution_intent" &&
        event.action === "execute_step"
    );

    const checks = {
      planRegistered: registration.success === true,
      approvalCreated: approvalResult.success === true,
      approvalApproved: approveResult.success === true,
      resultReturned: Boolean(result),
      auditIntentExists: Boolean(intent),
      approvalIdPersisted:
        Boolean(intent) && intent.approval_id === approvalId,
      sessionIdPersisted:
        Boolean(intent) && intent.session_id === sessionId,
      correlationIdPersisted:
        Boolean(intent) &&
        intent.correlation_id === correlationId,
      executionBlockedAtAuditIntent:
        Boolean(intent) &&
        intent.execution_allowed === false,
      payloadNotLogged: events.every(
        event =>
          !Object.prototype.hasOwnProperty.call(event, "payload")
      ),
      promptNotLogged: events.every(
        event =>
          !Object.prototype.hasOwnProperty.call(event, "prompt")
      )
    };

    const failures = Object.entries(checks)
      .filter(([, value]) => value !== true)
      .map(([key]) => key);

    console.log("PLAN_REGISTERED=" + checks.planRegistered);
    console.log("APPROVAL_CREATED=" + checks.approvalCreated);
    console.log("APPROVAL_APPROVED=" + checks.approvalApproved);
    console.log("RESULT_RETURNED=" + checks.resultReturned);
    console.log("AUDIT_INTENT_EXISTS=" + checks.auditIntentExists);
    console.log("APPROVAL_ID_PERSISTED=" + checks.approvalIdPersisted);
    console.log("SESSION_ID_PERSISTED=" + checks.sessionIdPersisted);
    console.log(
      "CORRELATION_ID_PERSISTED=" +
        checks.correlationIdPersisted
    );
    console.log(
      "EXECUTION_BLOCKED_AT_AUDIT_INTENT=" +
        checks.executionBlockedAtAuditIntent
    );
    console.log("PAYLOAD_NOT_LOGGED=" + checks.payloadNotLogged);
    console.log("PROMPT_NOT_LOGGED=" + checks.promptNotLogged);
    console.log("AUDIT_EVENT_COUNT=" + events.length);
    console.log("FAILURE_COUNT=" + failures.length);

    if (failures.length === 0) {
      console.log("PHASE19_PLAN_APPROVAL_AUDIT=PASS");
      process.exitCode = 0;
    } else {
      console.log("PHASE19_PLAN_APPROVAL_AUDIT=FAIL");
      console.log("FAILED_CHECKS=" + failures.join(","));
      process.exitCode = 1;
    }
  } catch (error) {
    console.log("TARGETED_TEST_ERROR=" + error.message);
    console.log("PHASE19_PLAN_APPROVAL_AUDIT=FAIL");
    process.exitCode = 1;
  } finally {
    if (
      runtime.auditStore &&
      typeof runtime.auditStore.close === "function"
    ) {
      runtime.auditStore.close();
    }

    if (
      runtime.sessionState &&
      typeof runtime.sessionState.close === "function"
    ) {
      runtime.sessionState.close();
    }
  }
})();

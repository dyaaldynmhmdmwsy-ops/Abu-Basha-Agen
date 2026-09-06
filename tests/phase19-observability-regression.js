"use strict";

const Runtime = require("../src/core/runtime");

(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const SESSION_ID = `phase19-observability-${suffix}`;
  const CORRELATION_ID = `phase19-correlation-${suffix}`;
  const APPROVAL_ID = `phase19-approval-${suffix}`;

  const runtime = new Runtime();

  try {
    const result = await runtime.connectorGateway.execute(
      "execution",
      { action: "phase19_observability_regression" },
      {
        sessionId: SESSION_ID,
        correlationId: CORRELATION_ID
      },
      {
        approved: true,
        requiresApproval: false,
        approvalId: APPROVAL_ID
      }
    );

    const events =
      runtime.auditStore.getEvents({
        sessionId: SESSION_ID,
        correlationId: CORRELATION_ID
      }) || [];

    const intent = events.find(
      event => event.event_type === "execution_intent"
    );

    const outcome = events.find(
      event => event.event_type === "execution_outcome"
    );

    const checks = {
      auditStoreExists:
        Boolean(runtime.auditStore) &&
        typeof runtime.auditStore.append === "function",

      resultSuccess:
        result && result.success === true,

      executionAllowed:
        result && result.executionAllowed === true,

      auditOutcomePersisted:
        result && result.auditOutcomePersisted === true,

      intentExists:
        Boolean(intent),

      outcomeExists:
        Boolean(outcome),

      intentExecutionBlocked:
        intent && intent.execution_allowed === false,

      outcomeExecutionAllowed:
        outcome && outcome.execution_allowed === true,

      approvalIdPersisted:
        outcome && outcome.approval_id === APPROVAL_ID,

      correlationIdPersisted:
        outcome && outcome.correlation_id === CORRELATION_ID,

      outcomeSuccess:
        outcome && outcome.success === true,

      payloadNotLogged:
        events.every(event =>
          !Object.prototype.hasOwnProperty.call(event, "payload")
        ),

      promptNotLogged:
        events.every(event =>
          !Object.prototype.hasOwnProperty.call(event, "prompt")
        )
    };

    const failures = Object.entries(checks)
      .filter(([, value]) => value !== true);

    console.log("AUDIT_STORE_EXISTS=" + checks.auditStoreExists);
    console.log("RESULT_SUCCESS=" + checks.resultSuccess);
    console.log("EXECUTION_ALLOWED=" + checks.executionAllowed);
    console.log(
      "AUDIT_OUTCOME_PERSISTED=" + checks.auditOutcomePersisted
    );
    console.log("INTENT_EVENT_FOUND=" + checks.intentExists);
    console.log("OUTCOME_EVENT_FOUND=" + checks.outcomeExists);
    console.log(
      "INTENT_EXECUTION_BLOCKED=" + checks.intentExecutionBlocked
    );
    console.log(
      "OUTCOME_EXECUTION_ALLOWED=" + checks.outcomeExecutionAllowed
    );
    console.log(
      "APPROVAL_ID_PERSISTED=" + checks.approvalIdPersisted
    );
    console.log(
      "CORRELATION_PERSISTED=" + checks.correlationIdPersisted
    );
    console.log("OUTCOME_SUCCESS=" + checks.outcomeSuccess);
    console.log("PAYLOAD_NOT_LOGGED=" + checks.payloadNotLogged);
    console.log("PROMPT_NOT_LOGGED=" + checks.promptNotLogged);
    console.log("AUDIT_EVENT_COUNT=" + events.length);
    console.log("FAILURE_COUNT=" + failures.length);

    const planApprovalId = `phase19-plan-approval-${suffix}`;
    const planId = `phase19-plan-${suffix}`;
    const planSessionId = `phase19-plan-session-${suffix}`;
    const planCorrelationId = `phase19-plan-correlation-${suffix}`;

    const plan = {
      id: planId,
      name: "Phase 19 Plan Approval Audit",
      category: "observability",
      steps: [
        {
          name: "phase19_audit_step",
          label: "Phase 19 Audit Step",
          type: "execution"
        }
      ]
    };

    const planRegistration =
      runtime.planRegistry.register(plan.id, {
        name: plan.name,
        category: plan.category,
        steps: plan.steps
      });

    const planApproval =
      runtime.approvals.create(plan);

    const planApprovalCreated =
      planApproval &&
      planApproval.success === true &&
      planApproval.item &&
      planApproval.item.id;

    const planApprovalApproved =
      planApprovalCreated
        ? runtime.approvals.approve(planApproval.item.id)
        : null;

    const originalExecution =
      runtime.planExecutor.executionExecutor.execute;

    runtime.planExecutor.executionExecutor.execute =
      async () => ({
        success: true,
        type: "phase19_safe_executor_stub",
        executionAllowed: false,
        externalExecution: false
      });

    let planExecutionResult;

    try {
      planExecutionResult =
        await runtime.planExecutor.execute(
          planApprovalCreated
            ? planApproval.item.id
            : planApprovalId,
          {},
          {
            sessionId: planSessionId,
            correlationId: planCorrelationId
          }
        );
    } finally {
      runtime.planExecutor.executionExecutor.execute =
        originalExecution;
    }

    const planEvents =
      runtime.auditStore.getEvents({
        sessionId: planSessionId,
        correlationId: planCorrelationId
      }) || [];

    const planIntent =
      planEvents.find(
        event =>
          event.event_type === "execution_intent" &&
          event.action === "execute_step"
      );

    const planApprovalAuditChecks = {
      planRegistered:
        planRegistration &&
        planRegistration.success === true,

      approvalCreated:
        planApprovalCreated !== false &&
        Boolean(planApprovalCreated),

      approvalApproved:
        planApprovalApproved &&
        planApprovalApproved.success === true,

      executionReturned:
        Boolean(planExecutionResult),

      auditIntentExists:
        Boolean(planIntent),

      approvalIdPersisted:
        Boolean(planIntent) &&
        planIntent.approval_id ===
          (planApprovalCreated
            ? planApproval.item.id
            : planApprovalId),

      sessionIdPersisted:
        Boolean(planIntent) &&
        planIntent.session_id === planSessionId,

      correlationIdPersisted:
        Boolean(planIntent) &&
        planIntent.correlation_id ===
          planCorrelationId,

      executionBlockedAtAuditIntent:
        Boolean(planIntent) &&
        planIntent.execution_allowed === false,

      payloadNotLogged:
        planEvents.every(
          event =>
            !Object.prototype.hasOwnProperty.call(
              event,
              "payload"
            )
        ),

      promptNotLogged:
        planEvents.every(
          event =>
            !Object.prototype.hasOwnProperty.call(
              event,
              "prompt"
            )
        )
    };

    const planApprovalFailures =
      Object.entries(planApprovalAuditChecks)
        .filter(([, value]) => value !== true)
        .map(([key]) => key);

    console.log(
      "PLAN_APPROVAL_PLAN_REGISTERED=" +
        planApprovalAuditChecks.planRegistered
    );
    console.log(
      "PLAN_APPROVAL_CREATED=" +
        planApprovalAuditChecks.approvalCreated
    );
    console.log(
      "PLAN_APPROVAL_APPROVED=" +
        planApprovalAuditChecks.approvalApproved
    );
    console.log(
      "PLAN_APPROVAL_EXECUTION_RETURNED=" +
        planApprovalAuditChecks.executionReturned
    );
    console.log(
      "PLAN_APPROVAL_AUDIT_INTENT_EXISTS=" +
        planApprovalAuditChecks.auditIntentExists
    );
    console.log(
      "PLAN_APPROVAL_ID_PERSISTED=" +
        planApprovalAuditChecks.approvalIdPersisted
    );
    console.log(
      "PLAN_SESSION_ID_PERSISTED=" +
        planApprovalAuditChecks.sessionIdPersisted
    );
    console.log(
      "PLAN_CORRELATION_ID_PERSISTED=" +
        planApprovalAuditChecks.correlationIdPersisted
    );
    console.log(
      "PLAN_EXECUTION_BLOCKED_AT_AUDIT_INTENT=" +
        planApprovalAuditChecks.executionBlockedAtAuditIntent
    );
    console.log(
      "PLAN_PAYLOAD_NOT_LOGGED=" +
        planApprovalAuditChecks.payloadNotLogged
    );
    console.log(
      "PLAN_PROMPT_NOT_LOGGED=" +
        planApprovalAuditChecks.promptNotLogged
    );
    console.log(
      "PLAN_APPROVAL_AUDIT_FAILURE_COUNT=" +
        planApprovalFailures.length
    );

    if (planApprovalFailures.length !== 0) {
      console.log(
        "PHASE19_PLAN_APPROVAL_AUDIT=FAIL"
      );
      console.log(
        "PLAN_APPROVAL_FAILED_CHECKS=" +
          planApprovalFailures.join(",")
      );
      console.log("STOP_AND_DIAGNOSE=YES");
      process.exitCode = 1;
      return;
    }

    console.log(
      "PHASE19_PLAN_APPROVAL_AUDIT=PASS"
    );

    if (failures.length === 0) {
      console.log("PHASE19_OBSERVABILITY_REGRESSION=PASS");
      console.log("READY_FOR_PACKAGE_REGISTRATION=YES");
    } else {
      console.log("PHASE19_OBSERVABILITY_REGRESSION=FAIL");
      console.log(
        "FAILED_CHECKS=" +
          failures.map(([key]) => key).join(",")
      );
      console.log("STOP_AND_DIAGNOSE=YES");
    }
  } catch (error) {
    console.log("REGRESSION_TEST_ERROR=" + error.message);
    console.log("PHASE19_OBSERVABILITY_REGRESSION=FAIL");
    console.log("STOP_AND_DIAGNOSE=YES");
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

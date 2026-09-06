const assert = require("node:assert/strict");

const ResilienceManager = require("../src/resilience");
const PlanExecutor = require("../src/plan-executors");

let failures = 0;

function check(name, condition) {
  try {
    assert.equal(Boolean(condition), true);
    console.log(`${name}=PASS`);
  } catch (error) {
    console.log(`${name}=FAIL`);
    console.error(error.message);
    failures++;
  }
}

(async () => {
  console.log("========================================");
  console.log(" PHASE 16 RESILIENCE REGRESSION");
  console.log("========================================");

  const manager = new ResilienceManager(
    { sessionState: null },
    { maxRetries: 2, retryDelayMs: 0 }
  );

  const status = manager.getStatus();

  check("MANAGER_PRESENT", manager instanceof ResilienceManager);
  check("SAFE", status.safe === true);
  check("FAIL_CLOSED", status.failClosed === true);
  check("EXTERNAL_EXECUTION_DISABLED", status.externalExecution === false);
  check("AUTONOMOUS_EXECUTION_DISABLED", status.autonomousExecution === false);
  check("EXECUTION_DISABLED", status.executionEnabled === false);
  check("APPROVAL_REQUIRED", status.requiresApproval === true);
  check("MAX_RETRIES_TWO", status.maxRetries === 2);

  let ordinaryAttempts = 0;

  const ordinaryFailure = await manager.execute(async () => {
    ordinaryAttempts++;
    return {
      success: false,
      type: "ordinary_failure"
    };
  });

  check(
    "NON_RETRYABLE_FAIL_CLOSED",
    ordinaryFailure.success === false
  );
  check(
    "NON_RETRYABLE_SINGLE_ATTEMPT",
    ordinaryAttempts === 1
  );
  check(
    "NON_RETRYABLE_EXECUTION_BLOCKED",
    ordinaryFailure.executionAllowed === false
  );
  check(
    "NON_RETRYABLE_NO_RECOVERY_AUTO_EXECUTION",
    ordinaryFailure.recoveryRequired === false
  );

  let retryAttempts = 0;

  const retrySuccess = await manager.execute(async () => {
    retryAttempts++;

    if (retryAttempts < 3) {
      return {
        success: false,
        type: "temporary_failure",
        retryable: true
      };
    }

    return {
      success: true,
      type: "operation_success"
    };
  });

  check("RETRY_EVENTUAL_SUCCESS", retrySuccess.success === true);
  check("RETRY_TOTAL_ATTEMPTS_THREE", retryAttempts === 3);
  check("RETRY_FLAG_REPORTED", retrySuccess.retried === true);
  check(
    "RETRY_SUCCESS_RESULT_PRESERVED",
    retrySuccess.result.type === "operation_success"
  );

  let exhaustedAttempts = 0;

  const fakeSessionState = {
    transitioned: null,

    getSession(sessionId) {
      return {
        sessionId,
        state: "EXECUTING",
        revision: 1
      };
    },

    async transition(sessionId, state, metadata) {
      this.transitioned = {
        sessionId,
        state,
        metadata
      };

      return {
        success: true,
        sessionId,
        state
      };
    }
  };

  const recoveryManager = new ResilienceManager(
    { sessionState: fakeSessionState },
    { maxRetries: 2, retryDelayMs: 0 }
  );

  const exhausted = await recoveryManager.execute(
    async () => {
      exhaustedAttempts++;

      return {
        success: false,
        type: "temporary_failure",
        retryable: true
      };
    },
    {
      sessionId: "phase16-recovery-test"
    }
  );

  check("EXHAUSTED_FAIL_CLOSED", exhausted.success === false);
  check("EXHAUSTED_TOTAL_ATTEMPTS_THREE", exhaustedAttempts === 3);
  check(
    "EXHAUSTED_TYPE_CORRECT",
    exhausted.type === "resilience_retry_exhausted"
  );
  check(
    "EXHAUSTED_RECOVERY_REQUIRED",
    exhausted.recoveryRequired === true
  );
  check(
    "EXHAUSTED_EXECUTION_BLOCKED",
    exhausted.executionAllowed === false
  );
  check(
    "EXHAUSTED_PERSISTENCE_ATTEMPTED",
    exhausted.persistence &&
      exhausted.persistence.persisted === true
  );
  check(
    "EXHAUSTED_PERSISTED_RECOVERY_REQUIRED",
    fakeSessionState.transitioned &&
      fakeSessionState.transitioned.state === "RECOVERY_REQUIRED"
  );

  let thrownAttempts = 0;

  const thrownRetry = await manager.execute(async () => {
    thrownAttempts++;

    if (thrownAttempts === 1) {
      const error = new Error("temporary");
      error.retryable = true;
      throw error;
    }

    return {
      success: true,
      type: "recovered_operation"
    };
  });

  check("THROWN_RETRY_SUCCESS", thrownRetry.success === true);
  check("THROWN_RETRY_TWO_ATTEMPTS", thrownAttempts === 2);

  const runtimeStub = {
    connectorPolicy: undefined,
    sessionState: null
  };

  const planExecutor = new PlanExecutor(runtimeStub);
  const executorStatus = planExecutor.getStatus();

  check(
    "PLAN_EXECUTOR_RESILIENCE_PRESENT",
    executorStatus.resilience &&
      executorStatus.resilience.name === "Resilience Manager"
  );
  check(
    "PLAN_EXECUTOR_RESILIENCE_FAIL_CLOSED",
    executorStatus.resilience &&
      executorStatus.resilience.failClosed === true
  );
  check(
    "PLAN_EXECUTOR_EXTERNAL_EXECUTION_DISABLED",
    executorStatus.resilience &&
      executorStatus.resilience.externalExecution === false
  );
  check(
    "PLAN_EXECUTOR_AUTONOMOUS_EXECUTION_DISABLED",
    executorStatus.resilience &&
      executorStatus.resilience.autonomousExecution === false
  );

  console.log("");
  console.log(`PHASE16_PERMANENT_FAILURE_COUNT=${failures}`);

  if (failures === 0) {
    console.log("PHASE16_PERMANENT_REGRESSION=PASS");
    process.exitCode = 0;
  } else {
    console.log("PHASE16_PERMANENT_REGRESSION=FAIL");
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error("PHASE16_PERMANENT_REGRESSION=FAIL");
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});

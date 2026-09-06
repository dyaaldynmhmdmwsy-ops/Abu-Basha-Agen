"use strict";

const STATES = Object.freeze({
  FAILED: "FAILED",
  RECOVERABLE: "RECOVERABLE",
  RECOVERY_REQUIRED: "RECOVERY_REQUIRED"
});

class ResilienceManager {
  constructor(runtime, options = {}) {
    this.runtime = runtime;
    this.name = "Resilience Manager";
    this.version = "1.0.0";
    this.status = "ready";

    this.safe = true;
    this.failClosed = true;
    this.externalExecution = false;
    this.autonomousExecution = false;
    this.executionEnabled = false;
    this.requiresApproval = true;

    this.maxRetries =
      Number.isInteger(options.maxRetries) && options.maxRetries >= 0
        ? options.maxRetries
        : 2;

    this.retryDelayMs =
      Number.isInteger(options.retryDelayMs) && options.retryDelayMs >= 0
        ? options.retryDelayMs
        : 0;

    this.history = [];
  }

  isRetryable(result) {
    return Boolean(
      result &&
      (
        result.retryable === true ||
        (result.error && result.error.retryable === true)
      )
    );
  }

  normalizeThrown(error) {
    return {
      success: false,
      type: "resilience_operation_error",
      retryable: Boolean(error && error.retryable === true),
      error: {
        name: error && error.name ? error.name : "Error",
        message: error && error.message ? error.message : String(error),
        retryable: Boolean(error && error.retryable === true)
      }
    };
  }

  async waitBeforeRetry() {
    if (this.retryDelayMs <= 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, this.retryDelayMs);
    });
  }

  async persistFailure(context, failureState, reason) {
    const sessionState = this.runtime && this.runtime.sessionState;

    if (!sessionState || !context || !context.sessionId) {
      return {
        success: true,
        persisted: false,
        reason: "no_session_context"
      };
    }

    try {
      const session = sessionState.getSession(context.sessionId);

      if (!session) {
        return {
          success: false,
          persisted: false,
          reason: "session_not_found"
        };
      }

      const transition = await sessionState.transition(
        context.sessionId,
        failureState,
        {
          source: this.name,
          reason
        }
      );

      return {
        success: Boolean(transition && transition.success !== false),
        persisted: true,
        state: failureState
      };
    } catch (error) {
      return {
        success: false,
        persisted: false,
        reason: "persistence_failed",
        error: {
          name: error.name,
          message: error.message
        }
      };
    }
  }

  async execute(operation, context = {}) {
    const startedAt = new Date().toISOString();
    let attempts = 0;
    let lastResult = null;

    while (attempts <= this.maxRetries) {
      attempts += 1;

      try {
        lastResult = await operation();
      } catch (error) {
        lastResult = this.normalizeThrown(error);
      }

      if (lastResult && lastResult.success !== false) {
        const record = {
          success: true,
          attempts,
          retried: attempts > 1,
          result: lastResult,
          resilience: {
            maxRetries: this.maxRetries,
            retryable: false
          },
          startedAt,
          finishedAt: new Date().toISOString()
        };

        this.history.push(record);
        return record;
      }

      if (!this.isRetryable(lastResult)) {
        break;
      }

      if (attempts > this.maxRetries) {
        break;
      }

      await this.waitBeforeRetry();
    }

    const exhausted = this.isRetryable(lastResult);

    const persistence = await this.persistFailure(
      context,
      exhausted ? STATES.RECOVERY_REQUIRED : STATES.FAILED,
      exhausted
        ? "resilience_retry_exhausted"
        : "resilience_non_retryable_failure"
    );

    const record = {
      success: false,
      type: exhausted
        ? "resilience_retry_exhausted"
        : "resilience_failure",
      attempts,
      retried: attempts > 1,
      retryable: exhausted,
      executionAllowed: false,
      recoveryRequired: exhausted,
      result: lastResult,
      persistence,
      resilience: {
        maxRetries: this.maxRetries,
        retryable: exhausted
      },
      startedAt,
      finishedAt: new Date().toISOString()
    };

    this.history.push(record);
    return record;
  }

  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      safe: this.safe,
      failClosed: this.failClosed,
      externalExecution: this.externalExecution,
      autonomousExecution: this.autonomousExecution,
      executionEnabled: this.executionEnabled,
      requiresApproval: this.requiresApproval,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
      history: this.history.length
    };
  }
}

module.exports = ResilienceManager;

"use strict";

class ControlledOperation {
  constructor(runtime, options = {}) {
    this.runtime = runtime || {};

    this.options = {
      requireApproval: true,
      externalExecution: false,
      executable: false,
      dryRun: false,
      maxOperations: 20,
      ...options
    };

    // Immutable safety invariants.
    this.options.requireApproval = true;
    this.options.externalExecution = false;
    this.options.executable = false;

    this.history = [];
  }

  validate(operation) {
    if (!operation || typeof operation !== "object") {
      return {
        valid: false,
        reason: "INVALID_OPERATION"
      };
    }

    if (!operation.goal || typeof operation.goal !== "string") {
      return {
        valid: false,
        reason: "GOAL_REQUIRED"
      };
    }

    if (operation.goal.length > 1000) {
      return {
        valid: false,
        reason: "GOAL_TOO_LONG"
      };
    }

    return {
      valid: true
    };
  }

  async prepare(operation) {
    const validation = this.validate(operation);

    if (!validation.valid) {
      const result = {
        type: "operation_rejected",
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        reason: validation.reason
      };

      this.history.push({
        type: "rejected",
        result
      });

      return result;
    }

    if (this.options.dryRun) {
      const result = {
        type: "dry_run",
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        operation
      };

      this.history.push({
        type: "dry_run",
        result
      });

      return result;
    }

    const result = {
      type: "approval_required",
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      operation
    };

    this.history.push({
      type: "prepared",
      result
    });

    return result;
  }

  async executeApproved(approvalId, operation, context = {}) {
    if (!approvalId) {
      const result = {
        type: "approval_required",
        executable: false,
        externalExecution: false,
        approvalRequired: true
      };

      this.history.push({
        type: "blocked",
        result
      });

      return result;
    }

    const result = {
      type: "execution_blocked",
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      approvalId,
      operation,
      context
    };

    this.history.push({
      type: "execution_blocked",
      result
    });

    return result;
  }

  getHistory() {
    return [...this.history];
  }

  getStatus() {
    return {
      phase: 16,
      component: "ControlledOperationV1",
      safe: true,
      requireApproval: true,
      approvalRequired: true,
      externalExecution: false,
      executable: false,
      dryRun: this.options.dryRun,
      maxOperations: this.options.maxOperations,
      historySize: this.history.length
    };
  }

  inspect() {
    const runtimeStatus =
      typeof this.runtime.getStatus === "function"
        ? this.runtime.getStatus() || {}
        : {};

    return {
      ...this.getStatus(),
      runtimeExternalExecution:
        runtimeStatus.externalExecution === true,
      externalExecutionBlocked: true
    };
  }
}

module.exports = ControlledOperation;

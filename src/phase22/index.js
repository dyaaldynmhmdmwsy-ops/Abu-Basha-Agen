"use strict";

class HumanApprovalGate {
  constructor(runtime = {}) {
    this.runtime = runtime;
    this.history = [];
  }

  requestApproval(verification = {}, context = {}) {
    if (!verification || typeof verification !== "object") {
      const result = {
        type: "approval_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        approved: false,
        reason: "INVALID_VERIFICATION"
      };

      this.history.push(result);
      return result;
    }

    if (verification.executable === true) {
      const result = {
        type: "approval_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        approved: false,
        reason: "EXECUTABLE_VERIFICATION_NOT_ALLOWED"
      };

      this.history.push(result);
      return result;
    }

    if (verification.externalExecution === true) {
      const result = {
        type: "approval_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        approved: false,
        reason: "EXTERNAL_EXECUTION_NOT_ALLOWED"
      };

      this.history.push(result);
      return result;
    }

    if (verification.verified !== true) {
      const result = {
        type: "approval_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        approved: false,
        reason: "VERIFICATION_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    const goal =
      typeof verification.goal === "string"
        ? verification.goal.trim()
        : "";

    if (!goal) {
      const result = {
        type: "approval_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        approved: false,
        reason: "GOAL_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    const result = {
      type: "approval_request",
      safe: true,
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      approved: false,
      goal,
      context:
        context && typeof context === "object"
          ? { ...context }
          : {},
      approval: {
        status: "HUMAN_REVIEW_REQUIRED",
        approved: false,
        execution: "BLOCKED",
        externalExecution: "BLOCKED",
        autonomousExecution: "DISABLED"
      },
      nextStep: {
        action: "WAIT_FOR_HUMAN_APPROVAL",
        requiresApproval: true,
        executable: false
      }
    };

    this.history.push(result);
    return result;
  }

  confirmApproval(approvalToken, request = {}, context = {}) {
    if (!approvalToken) {
      const result = {
        type: "approval_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        approved: false,
        reason: "APPROVAL_TOKEN_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    const result = {
      type: "approval_recorded",
      safe: true,
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      approved: true,
      approvalToken,
      request,
      context,
      execution: {
        executable: false,
        externalExecution: "BLOCKED",
        autonomousExecution: "DISABLED"
      },
      nextStep: {
        action: "EXECUTION_REMAINS_BLOCKED",
        requiresApproval: true,
        executable: false
      }
    };

    this.history.push(result);
    return result;
  }

  getHistory() {
    return [...this.history];
  }

  getStatus() {
    return {
      phase: 22,
      component: "HumanApprovalGate",
      safe: true,
      requireApproval: true,
      approvalRequired: true,
      externalExecution: false,
      executable: false,
      approvalOnly: true,
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

module.exports = HumanApprovalGate;

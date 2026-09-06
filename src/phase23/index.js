"use strict";

class ApprovalDecisionRouter {
  constructor(runtime = {}) {
    this.runtime = runtime;
    this.history = [];
  }

  route(approval = {}, context = {}) {
    if (!approval || typeof approval !== "object") {
      const result = {
        type: "approval_route_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true,
        routed: false,
        reason: "INVALID_APPROVAL"
      };

      this.history.push(result);
      return result;
    }

    if (approval.executable === true) {
      const result = {
        type: "approval_route_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true,
        routed: false,
        reason: "EXECUTABLE_APPROVAL_NOT_ALLOWED"
      };

      this.history.push(result);
      return result;
    }

    if (approval.externalExecution === true) {
      const result = {
        type: "approval_route_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true,
        routed: false,
        reason: "EXTERNAL_EXECUTION_NOT_ALLOWED"
      };

      this.history.push(result);
      return result;
    }

    if (approval.autonomousExecution === true) {
      const result = {
        type: "approval_route_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true,
        routed: false,
        reason: "AUTONOMOUS_EXECUTION_NOT_ALLOWED"
      };

      this.history.push(result);
      return result;
    }

    if (approval.approved !== true) {
      const result = {
        type: "approval_route_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true,
        routed: false,
        reason: "HUMAN_APPROVAL_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    const goal =
      typeof approval.goal === "string"
        ? approval.goal.trim()
        : "";

    if (!goal) {
      const result = {
        type: "approval_route_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        autonomousExecution: false,
        approvalRequired: true,
        routed: false,
        reason: "GOAL_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    const result = {
      type: "approval_route_recorded",
      safe: true,

      // HARD EXECUTION BOUNDARY
      executable: false,
      externalExecution: false,
      autonomousExecution: false,

      approvalRequired: true,
      routed: true,
      approved: true,

      goal,

      context:
        context && typeof context === "object"
          ? { ...context }
          : {},

      route: {
        status: "APPROVED_FOR_CONTROLLED_HANDOFF",
        execution: "BLOCKED",
        externalExecution: "BLOCKED",
        autonomousExecution: "DISABLED"
      },

      nextStep: {
        action: "CONTROLLED_HANDOFF_REQUIRES_SEPARATE_EXECUTOR",
        requiresApproval: true,
        executable: false,
        externalExecution: false
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
      phase: 23,
      component: "ApprovalDecisionRouter",
      safe: true,
      requireApproval: true,
      approvalRequired: true,
      externalExecution: false,
      executable: false,
      autonomousExecution: false,
      routingOnly: true,
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
      runtimeExecutable:
        runtimeStatus.executable === true,
      externalExecutionBlocked: true,
      autonomousExecutionDisabled: true
    };
  }
}

module.exports = ApprovalDecisionRouter;

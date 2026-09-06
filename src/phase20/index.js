"use strict";

class PlanDecompositionEngine {
  constructor(runtime = {}) {
    this.runtime = runtime;
    this.history = [];
  }

  createPlan(decision = {}, context = {}) {
    if (!decision || typeof decision !== "object") {
      const result = {
        type: "plan_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        reason: "INVALID_DECISION"
      };

      this.history.push(result);
      return result;
    }

    if (decision.executable === true) {
      const result = {
        type: "plan_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        reason: "EXECUTABLE_DECISION_NOT_ALLOWED"
      };

      this.history.push(result);
      return result;
    }

    if (decision.externalExecution === true) {
      const result = {
        type: "plan_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        reason: "EXTERNAL_EXECUTION_NOT_ALLOWED"
      };

      this.history.push(result);
      return result;
    }

    const goal =
      typeof decision.goal === "string"
        ? decision.goal.trim()
        : "";

    if (!goal) {
      const result = {
        type: "plan_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        reason: "GOAL_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    const result = {
      type: "plan",
      safe: true,
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      goal,
      context:
        context && typeof context === "object"
          ? { ...context }
          : {},
      decision: {
        status:
          typeof decision.decision === "string"
            ? decision.decision
            : "REVIEW_REQUIRED"
      },
      steps: [
        {
          id: 1,
          action: "REVIEW_GOAL",
          executable: false,
          approvalRequired: true
        },
        {
          id: 2,
          action: "VALIDATE_POLICY",
          executable: false,
          approvalRequired: true
        },
        {
          id: 3,
          action: "REQUEST_APPROVAL",
          executable: false,
          approvalRequired: true
        }
      ],
      execution: {
        mode: "PLAN_ONLY",
        externalExecution: "BLOCKED",
        autonomousExecution: "DISABLED"
      },
      nextStep: {
        action: "REQUEST_HUMAN_APPROVAL",
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
      phase: 20,
      component: "PlanDecompositionEngine",
      safe: true,
      requireApproval: true,
      approvalRequired: true,
      externalExecution: false,
      executable: false,
      planningOnly: true,
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

module.exports = PlanDecompositionEngine;

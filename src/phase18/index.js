"use strict";

class PolicyRiskEngine {
  constructor(runtime = {}) {
    this.runtime = runtime;
    this.history = [];
  }

  evaluate(input = {}) {
    const goal =
      typeof input.goal === "string"
        ? input.goal.trim()
        : "";

    if (!goal) {
      const result = {
        type: "policy_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        risk: "HIGH",
        reason: "GOAL_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    const result = {
      type: "policy_evaluation",
      safe: true,
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      risk: "REVIEW",
      goal,
      policy: {
        externalExecution: "BLOCKED",
        approval: "REQUIRED",
        autonomousExecution: "DISABLED"
      },
      recommendation: {
        action: "REVIEW_BEFORE_EXECUTION",
        requiresApproval: true
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
      phase: 18,
      component: "PolicyRiskEngine",
      safe: true,
      requireApproval: true,
      approvalRequired: true,
      externalExecution: false,
      executable: false,
      riskEvaluationOnly: true,
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

module.exports = PolicyRiskEngine;

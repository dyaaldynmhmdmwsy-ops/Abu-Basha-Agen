"use strict";

class IntelligenceCore {
  constructor(runtime = {}) {
    this.runtime = runtime;
    this.history = [];
  }

  analyze(goal, context = {}) {
    const normalizedGoal =
      typeof goal === "string"
        ? goal.trim()
        : "";

    if (!normalizedGoal) {
      const result = {
        type: "analysis_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        reason: "GOAL_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    if (normalizedGoal.length > 2000) {
      const result = {
        type: "analysis_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        reason: "GOAL_TOO_LONG"
      };

      this.history.push(result);
      return result;
    }

    const result = {
      type: "analysis",
      safe: true,
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      goal: normalizedGoal,
      context: context && typeof context === "object"
        ? { ...context }
        : {},
      recommendation: {
        action: "REVIEW_AND_PLAN",
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
      phase: 17,
      component: "IntelligenceCore",
      safe: true,
      requireApproval: true,
      approvalRequired: true,
      externalExecution: false,
      executable: false,
      analysisOnly: true,
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

module.exports = IntelligenceCore;

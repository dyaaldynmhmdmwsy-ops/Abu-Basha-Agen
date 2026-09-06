"use strict";

class DecisionApprovalGate {
  constructor(runtime = {}) {
    this.runtime = runtime;
    this.history = [];
  }

  decide(analysis = {}, policy = {}) {
    if (!analysis || typeof analysis !== "object") {
      const result = {
        type: "decision_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        decision: "REJECT",
        reason: "INVALID_ANALYSIS"
      };

      this.history.push(result);
      return result;
    }

    if (!policy || typeof policy !== "object") {
      const result = {
        type: "decision_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        decision: "REJECT",
        reason: "INVALID_POLICY"
      };

      this.history.push(result);
      return result;
    }

    const goal =
      typeof analysis.goal === "string"
        ? analysis.goal.trim()
        : typeof policy.goal === "string"
          ? policy.goal.trim()
          : "";

    if (!goal) {
      const result = {
        type: "decision_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        decision: "REJECT",
        reason: "GOAL_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    const policySafe = policy.safe !== false;
    const policyExternalExecution =
      policy.externalExecution === true;

    const policyExecutable =
      policy.executable === true;

    if (!policySafe || policyExternalExecution || policyExecutable) {
      const result = {
        type: "decision_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        decision: "BLOCK",
        goal,
        reason: "UNSAFE_POLICY_STATE"
      };

      this.history.push(result);
      return result;
    }

    const result = {
      type: "decision",
      safe: true,
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      decision: "REVIEW_REQUIRED",
      goal,
      analysis: {
        accepted:
          analysis.type === "analysis",
        recommendation:
          analysis.recommendation || null
      },
      policy: {
        risk:
          typeof policy.risk === "string"
            ? policy.risk
            : "REVIEW",
        evaluation:
          policy.type === "policy_evaluation",
        externalExecution:
          "BLOCKED",
        approval:
          "REQUIRED",
        autonomousExecution:
          "DISABLED"
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
      phase: 19,
      component: "DecisionApprovalGate",
      safe: true,
      requireApproval: true,
      approvalRequired: true,
      externalExecution: false,
      executable: false,
      decisionOnly: true,
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

module.exports = DecisionApprovalGate;

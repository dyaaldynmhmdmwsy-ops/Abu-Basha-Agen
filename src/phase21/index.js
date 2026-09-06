"use strict";

class PlanVerificationGate {
  constructor(runtime = {}) {
    this.runtime = runtime;
    this.history = [];
  }

  verify(plan = {}, context = {}) {
    if (!plan || typeof plan !== "object") {
      const result = {
        type: "verification_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        verified: false,
        reason: "INVALID_PLAN"
      };

      this.history.push(result);
      return result;
    }

    if (plan.executable === true) {
      const result = {
        type: "verification_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        verified: false,
        reason: "EXECUTABLE_PLAN_NOT_ALLOWED"
      };

      this.history.push(result);
      return result;
    }

    if (plan.externalExecution === true) {
      const result = {
        type: "verification_blocked",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        verified: false,
        reason: "EXTERNAL_EXECUTION_NOT_ALLOWED"
      };

      this.history.push(result);
      return result;
    }

    const goal =
      typeof plan.goal === "string"
        ? plan.goal.trim()
        : "";

    if (!goal) {
      const result = {
        type: "verification_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        verified: false,
        reason: "GOAL_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    if (!Array.isArray(plan.steps)) {
      const result = {
        type: "verification_rejected",
        safe: true,
        executable: false,
        externalExecution: false,
        approvalRequired: true,
        verified: false,
        reason: "STEPS_REQUIRED"
      };

      this.history.push(result);
      return result;
    }

    for (const step of plan.steps) {
      if (!step || typeof step !== "object") {
        const result = {
          type: "verification_blocked",
          safe: true,
          executable: false,
          externalExecution: false,
          approvalRequired: true,
          verified: false,
          reason: "INVALID_STEP"
        };

        this.history.push(result);
        return result;
      }

      if (step.executable === true) {
        const result = {
          type: "verification_blocked",
          safe: true,
          executable: false,
          externalExecution: false,
          approvalRequired: true,
          verified: false,
          reason: "EXECUTABLE_STEP_NOT_ALLOWED"
        };

        this.history.push(result);
        return result;
      }

      if (step.externalExecution === true) {
        const result = {
          type: "verification_blocked",
          safe: true,
          executable: false,
          externalExecution: false,
          approvalRequired: true,
          verified: false,
          reason: "EXTERNAL_EXECUTION_STEP_NOT_ALLOWED"
        };

        this.history.push(result);
        return result;
      }

      if (step.approvalRequired !== true) {
        const result = {
          type: "verification_blocked",
          safe: true,
          executable: false,
          externalExecution: false,
          approvalRequired: true,
          verified: false,
          reason: "STEP_APPROVAL_REQUIRED"
        };

        this.history.push(result);
        return result;
      }
    }

    const result = {
      type: "plan_verified",
      safe: true,
      executable: false,
      externalExecution: false,
      approvalRequired: true,
      verified: true,
      goal,
      context:
        context && typeof context === "object"
          ? { ...context }
          : {},
      verification: {
        status: "VERIFIED_FOR_REVIEW",
        execution: "BLOCKED",
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
      phase: 21,
      component: "PlanVerificationGate",
      safe: true,
      requireApproval: true,
      approvalRequired: true,
      externalExecution: false,
      executable: false,
      verificationOnly: true,
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

module.exports = PlanVerificationGate;

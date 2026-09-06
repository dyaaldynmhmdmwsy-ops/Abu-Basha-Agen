"use strict";

/*
 * Phase 10
 * Operational Control & Decision Layer
 *
 * Purpose:
 *   Convert a user goal into a governed execution lifecycle.
 *
 * Safety:
 *   - Planning does not execute.
 *   - External execution is blocked by default.
 *   - Approval is required before execution.
 *   - Existing Phase 8 boundary remains authoritative.
 *   - No automatic network/external side effects are introduced.
 */

class OperationalControlLayer {
  constructor(runtime, options = {}) {
    this.runtime = runtime || null;

    this.options = {
      requireApproval: true,
      externalExecution: false,
      maxSteps: 20,
      dryRun: false,
      ...options
    };

    this.history = [];
  }

  _id(prefix = "op10") {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  _event(type, data = {}) {
    return {
      type,
      phase: 10,
      timestamp: new Date().toISOString(),
      ...data
    };
  }

  validateGoal(goal) {
    if (!goal || typeof goal !== "object") {
      return {
        valid: false,
        reasons: ["goal_required"]
      };
    }

    const text =
      typeof goal.goal === "string"
        ? goal.goal.trim()
        : typeof goal.objective === "string"
          ? goal.objective.trim()
          : "";

    if (!text) {
      return {
        valid: false,
        reasons: ["goal_text_required"]
      };
    }

    return {
      valid: true,
      reasons: [],
      goal: text
    };
  }

  buildPlan(goal, context = {}) {
    const validation = this.validateGoal(goal);

    if (!validation.valid) {
      return this._event("plan_rejected", {
        id: this._id(),
        valid: false,
        reasons: validation.reasons
      });
    }

    const plan = {
      id: this._id("plan10"),
      phase: 10,
      objective: validation.goal,
      context,
      steps: [
        {
          id: "step-1",
          type: "analyze",
          status: "planned"
        },
        {
          id: "step-2",
          type: "capability_check",
          status: "planned"
        },
        {
          id: "step-3",
          type: "safety_check",
          status: "planned"
        },
        {
          id: "step-4",
          type: "approval_gate",
          status: "planned"
        },
        {
          id: "step-5",
          type: "execution",
          status: "blocked_until_approval"
        },
        {
          id: "step-6",
          type: "audit",
          status: "planned"
        }
      ]
    };

    if (plan.steps.length > this.options.maxSteps) {
      return this._event("plan_rejected", {
        id: this._id(),
        valid: false,
        reasons: ["max_steps_exceeded"]
      });
    }

    const result = this._event("plan_created", {
      id: plan.id,
      valid: true,
      executable: false,
      externalExecution: false,
      requireApproval: true,
      plan
    });

    this.history.push(result);
    return result;
  }

  async prepare(goal, context = {}) {
    const planResult = this.buildPlan(goal, context);

    if (!planResult.valid) {
      this.history.push(planResult);
      return planResult;
    }

    if (this.options.dryRun) {
      const result = this._event("dry_run", {
        id: this._id(),
        executable: false,
        externalExecution: false,
        requireApproval: true,
        plan: planResult.plan
      });

      this.history.push(result);
      return result;
    }

    /*
     * Phase 8 remains the final execution boundary.
     * Phase 10 may request approval, but cannot bypass it.
     */
    if (
      this.options.requireApproval &&
      this.runtime &&
      typeof this.runtime.createApproval === "function"
    ) {
      const approval = await Promise.resolve(
        this.runtime.createApproval(planResult.plan)
      );

      const result = this._event("approval_required", {
        id: this._id(),
        executable: false,
        externalExecution: false,
        requireApproval: true,
        approval,
        plan: planResult.plan
      });

      this.history.push(result);
      return result;
    }

    const result = this._event("approval_required", {
      id: this._id(),
      executable: false,
      externalExecution: false,
      requireApproval: true,
      approval: null,
      plan: planResult.plan
    });

    this.history.push(result);
    return result;
  }

  async executeApproved(
    approvalId,
    action,
    payload = {},
    options = {}
  ) {
    if (!approvalId) {
      return this._event("execution_rejected", {
        id: this._id(),
        reason: ["approval_id_required"]
      });
    }

    /*
     * External execution is deliberately blocked unless the
     * existing runtime explicitly provides the approved boundary.
     */
    if (
      !this.runtime ||
      typeof this.runtime.executeApproved !== "function"
    ) {
      return this._event("execution_rejected", {
        id: this._id(),
        approvalId,
        reason: ["approved_execution_unavailable"]
      });
    }

    if (this.options.externalExecution !== true) {
      return this._event("execution_blocked", {
        id: this._id(),
        approvalId,
        action,
        executable: false,
        externalExecution: false,
        reason: ["external_execution_disabled"]
      });
    }

    const result = await this.runtime.executeApproved(
      approvalId,
      action,
      payload,
      {
        ...options
      }
    );

    const envelope = this._event("execution_result", {
      id: this._id(),
      approvalId,
      result
    });

    this.history.push(envelope);
    return envelope;
  }

  getHistory() {
    return this.history.map(item => ({ ...item }));
  }

  getStatus() {
    return {
      phase: 10,
      component: "OperationalControlLayer",
      safe: true,
      requireApproval: true,
      externalExecution: false,
      dryRun: this.options.dryRun,
      maxSteps: this.options.maxSteps,
      historySize: this.history.length
    };
  }

  inspect() {
    let runtimeStatus = {};

    if (
      this.runtime &&
      typeof this.runtime.getStatus === "function"
    ) {
      runtimeStatus = this.runtime.getStatus() || {};
    }

    return {
      ...this.getStatus(),
      runtime: runtimeStatus,
      executionBoundary: {
        approvalRequired: true,
        externalExecutionBlocked: true,
        executableByDefault: false
      }
    };
  }
}

module.exports = OperationalControlLayer;

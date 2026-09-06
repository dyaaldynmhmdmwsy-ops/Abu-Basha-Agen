"use strict";

class GovernedExecutionOrchestrator {
  constructor(runtime, options = {}) {
    this.runtime = runtime;
    this.options = {
      dryRun: false,
      requireApproval: true,
      maxSteps: 20,
      ...options
    };
    this.history = [];
  }

  _id() {
    return `phase8-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _envelope(type, data = {}) {
    return {
      type,
      phase: 8,
      timestamp: new Date().toISOString(),
      ...data
    };
  }

  validatePlan(plan) {
    if (!plan || typeof plan !== "object") {
      return {
        valid: false,
        reasons: ["plan_required"]
      };
    }

    if (!plan.action || typeof plan.action !== "string") {
      return {
        valid: false,
        reasons: ["action_required"]
      };
    }

    return {
      valid: true,
      reasons: []
    };
  }

  async prepare(plan, context = {}) {
    const validation = this.validatePlan(plan);

    if (!validation.valid) {
      const result = this._envelope("rejected", {
        id: this._id(),
        approved: false,
        executable: false,
        reasons: validation.reasons,
        plan,
        context
      });

      this.history.push(result);
      return result;
    }

    if (this.options.dryRun) {
      const result = this._envelope("dry_run", {
        id: this._id(),
        approved: false,
        executable: false,
        plan,
        context
      });

      this.history.push(result);
      return result;
    }

    if (
      this.options.requireApproval &&
      this.runtime &&
      typeof this.runtime.createApproval === "function"
    ) {
      const approval = this.runtime.createApproval(plan);

      const result = this._envelope("approval_required", {
        id: this._id(),
        approved: false,
        executable: false,
        approval,
        plan,
        context
      });

      this.history.push(result);
      return result;
    }

    const result = this._envelope("prepared", {
      id: this._id(),
      approved: false,
      executable: false,
      plan,
      context
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
      return this._envelope("rejected", {
        id: this._id(),
        reason: ["approval_id_required"]
      });
    }

    if (
      !this.runtime ||
      typeof this.runtime.executeApproved !== "function"
    ) {
      return this._envelope("rejected", {
        id: this._id(),
        reason: ["approved_execution_unavailable"]
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

    const envelope = this._envelope("execution_result", {
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
      phase: 8,
      component: "GovernedExecutionOrchestrator",
      safe: true,
      externalExecution: false,
      dryRun: this.options.dryRun,
      requireApproval: this.options.requireApproval,
      maxSteps: this.options.maxSteps,
      historySize: this.history.length

    };
  }

  inspect() {
    const runtimeStatus =
      this.runtime &&
      typeof this.runtime.getStatus === "function"
        ? this.runtime.getStatus()
        : {};

    return {
      ...this.getStatus(),
      ...runtimeStatus,
      externalExecution:
        runtimeStatus.externalExecution === true
          ? true
          : false
    };
  }
}

module.exports = GovernedExecutionOrchestrator;

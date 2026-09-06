"use strict";

/**
 * Execution Executor v1.0.0
 *
 * مسؤول فقط عن تنفيذ خطوات من النوع execution.
 * لا يدير الخطط ولا الموافقات.
 */

class ExecutionExecutor {
  constructor(runtime) {
    if (!runtime) {
      throw new Error("ExecutionExecutor يحتاج Runtime");
    }

    this.runtime = runtime;
    this.name = "Execution Executor";
    this.version = "1.0.0";
    this.executed = 0;
    this.history = [];
  }

  async execute(
    plan,
    step,
    index,
    payload = {},
    options = {}
  ) {
    const startedAt = new Date().toISOString();

    if (!step || step.type !== "execution") {
      return {
        success: false,
        type: "invalid_execution_step",
        message: "ExecutionExecutor يقبل خطوات من النوع execution فقط."
      };
    }

    const action = {
      name: `plan_step_${index + 1}`,
      stepName: step.name,
      label: step.label,
      planId: plan.id,
      opportunityId: plan.opportunityId,
      planName: plan.name,
      stepIndex: index
    };

    const stepPayload = {
      ...payload,
      planId: plan.id,
      opportunityId: plan.opportunityId,
      planName: plan.name,
      step: step.label,
      stepName: step.name,
      stepIndex: index
    };

    const toolName =
      step.tool ||
      options.tool ||
      step.name ||
      action.name;

    if (
      !this.runtime.connectorResolver ||
      !this.runtime.connectorGateway
    ) {
      return {
        success: false,
        type: "execution_gateway_unavailable",
        message: "مسار التنفيذ الموحد غير متاح."
      };
    }

    const context = {
      planId: plan.id,
      opportunityId: plan.opportunityId,
      planName: plan.name,
      step: step.label,
      stepName: step.name,
      stepIndex: index,
      action
    };

    const operation = {
      ...options,
      approved: options.approved === true,
      requiresApproval:
        options.requiresApproval !== false
    };

    const result = await this.runtime.connectorGateway.execute(
      toolName,
      stepPayload,
      context,
      operation
    );

    const record = {
      success: result.success === true,
      type: "execution",
      action,
      result,
      startedAt,
      finishedAt: new Date().toISOString()
    };

    this.history.push(record);

    if (record.success) {
      this.executed++;
    }

    return record;
  }

  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: "online",
      executed: this.executed,
      history: this.history.length
    };
  }
}

module.exports = ExecutionExecutor;

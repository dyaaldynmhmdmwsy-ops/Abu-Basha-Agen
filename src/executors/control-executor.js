"use strict";

/**
 * Control Executor v1.0.0
 *
 * مسؤول عن خطوات التحكم الداخلية فقط.
 * لا يستدعي Runtime ولا Connector.
 */

class ControlExecutor {
  constructor(runtime) {
    if (!runtime) {
      throw new Error("ControlExecutor يحتاج Runtime");
    }

    this.runtime = runtime;
    this.name = "Control Executor";
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

    if (!step || step.type !== "control") {
      return {
        success: false,
        type: "invalid_control_step",
        message: "ControlExecutor يقبل خطوات من النوع control فقط."
      };
    }

    const action = {
      name: `plan_control_${index + 1}`,
      stepName: step.name,
      label: step.label,
      planId: plan.id,
      opportunityId: plan.opportunityId,
      planName: plan.name,
      stepIndex: index
    };

    const result = {
      success: true,
      type: "control",
      action: step.name,
      message: `تم تنفيذ خطوة التحكم الداخلية: ${step.label}`,
      simulated: true
    };

    const record = {
      success: true,
      type: "control",
      action,
      result,
      startedAt,
      finishedAt: new Date().toISOString()
    };

    this.history.push(record);
    this.executed++;

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

module.exports = ControlExecutor;

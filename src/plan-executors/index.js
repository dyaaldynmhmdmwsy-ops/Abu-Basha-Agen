"use strict";

const ExecutionExecutor = require("../executors/execution-executor");
const ControlExecutor = require("../executors/control-executor");
const DeveloperExecutor = require("../executors/developer-executor");
const StepPolicy = require("../step-policy");
const DeveloperToolRegistry = require("../developer-tools");
const ResilienceManager = require("../resilience");

class PlanExecutor {
  constructor(runtime) {
    if (!runtime) {
      throw new Error("PlanExecutor يحتاج Runtime");
    }

    this.runtime = runtime;
    this.name = "Plan Executor";
    this.version = "1.5.0";

    this.executed = 0;
    this.history = [];

    this.executionExecutor = new ExecutionExecutor(runtime);
    this.controlExecutor = new ControlExecutor(runtime);
    this.toolRegistry =
      runtime.developerTools || new DeveloperToolRegistry();

    this.developerExecutor =
      new DeveloperExecutor(runtime, this.toolRegistry);

    this.stepPolicy = new StepPolicy();
    this.connectorPolicy = runtime.connectorPolicy;
    this.resilience = new ResilienceManager(runtime);
  }

  findApproval(approvalId) {
    return (
      this.runtime.approvals
        .getAll()
        .find(item => item.id === approvalId) || null
    );
  }

  findPlan(planId) {
    if (!planId) {
      return null;
    }

    const approvals =
      this.runtime.approvals &&
      typeof this.runtime.approvals.getAll === "function"
        ? this.runtime.approvals.getAll()
        : [];

    const approval = approvals.find(
      item => item && item.planId === planId
    );

    if (approval && approval.plan && approval.plan.id === planId) {
      return approval.plan;
    }

    // Canonical fallback: the Runtime-owned Plan Registry.
    // Never synthesize a plan during execution.
    if (
      this.runtime.planRegistry &&
      typeof this.runtime.planRegistry.get === "function"
    ) {
      return this.runtime.planRegistry.get(planId);
    }

    return null;
  }

  getPlanDefinition(planId) {
    if (!this.runtime.planRegistry) {
      return null;
    }

    return this.runtime.planRegistry.get(planId);
  }

  getExecutorForStep(step) {
    if (!step || !step.type) {
      return null;
    }

    if (step.type === "execution") {
      return this.executionExecutor;
    }

    if (step.type === "control") {
      return this.controlExecutor;
    }

    if (step.type === "developer") {
      return this.developerExecutor;
    }

    return null;
  }

  async executeStep(
    plan,
    definition,
    step,
    index,
    payload = {},
    options = {}
  ) {
    const policy = this.stepPolicy.canExecute(step);

    if (!policy.success) {
      return {
        success: false,
        type: "step_policy_rejected",
        policy,
        step: step ? step.label : null,
        stepName: step ? step.name : null,
        stepIndex: index
      };
    }

const executor = this.getExecutorForStep(step);

    if (!executor) {
      return {
        success: false,
        type: "unsupported_step_type",
        message:
          `نوع الخطوة "${step && step.type}" غير مدعوم.`,
        step: step ? step.label : null,
        stepName: step ? step.name : null,
        stepIndex: index
      };
    }

    const auditStore = this.auditStore || this.runtime.auditStore;

    if (!auditStore || typeof auditStore.append !== "function") {
      return {
        success: false,
        type: "audit_store_unavailable",
        executionAllowed: false,
        failClosed: true,
        step: step ? step.label : null,
        stepName: step ? step.name : null,
        stepIndex: index
      };
    }

    const auditIntent = auditStore.append({
      eventType: "execution_intent",
      source: "plan-executor",
      component: "PlanExecutor",
      action: "execute_step",
      sessionId: options.sessionId || null,
      correlationId:
        options.correlationId ||
        options.sessionId ||
        plan.id ||
        `plan-${index}`,
      approvalId: options.approvalId || null,
      approvalRequired: true,
      approved: true,
      executionAllowed: false,
      externalExecution: false,
      success: true,
      metadata: {
        planId: plan.id,
        stepIndex: index,
        stepName: step.name,
        executor: executor.name
      }
    });

    if (!auditIntent || auditIntent.success !== true) {
      return {
        success: false,
        type: "audit_intent_blocked",
        executionAllowed: false,
        failClosed: true,
        audit: auditIntent || null,
        step: step ? step.label : null,
        stepName: step ? step.name : null,
        stepIndex: index
      };
    }

    const resilienceResult = await this.resilience.execute(
      () => executor.execute(
        plan,
        step,
        index,
        payload,
        options
      ),
      {
        plan,
        definition,
        step,
        index,
        options,
        sessionId: options.sessionId
      }
    );

    if (!resilienceResult.success) {
      return {
        ...resilienceResult,
        policy,
        step: step.label,
        stepName: step.name,
        stepIndex: index,
        executor: executor.name
      };
    }

    const result = resilienceResult.result;

    return {
      ...result,
      policy,
      step: step.label,
      stepName: step.name,
      stepIndex: index,
      executor: executor.name
    };
  }

  async execute(
    approvalId,
    payload = {},
    options = {}
  ) {
    const startedAt = new Date().toISOString();

    options = {
      ...options,
      approvalId
    };

    const approval = this.findApproval(approvalId);

    if (!approval) {
      return {
        success: false,
        type: "approval_not_found",
        message:
          `الموافقة "${approvalId}" غير موجودة.`
      };
    }

    if (approval.status !== "approved") {
      return {
        success: false,
        type: "approval_required",
        message:
          "لا يمكن تنفيذ الخطة قبل موافقة المستخدم."
      };
    }

    const plan = this.findPlan(approval.planId);

    if (!plan) {
      return {
        success: false,
        type: "plan_not_found",
        message:
          `الخطة "${approval.planId}" غير موجودة.`
      };
    }

    const definition = this.getPlanDefinition(
      plan.id
    );

    if (!definition) {
      return {
        success: false,
        type: "plan_definition_not_found",
        message:
          `تعريف الخطة "${plan.id}" غير موجود في Plan Registry.`
      };
    }

    const steps = [];

    for (
      let index = 0;
      index < definition.steps.length;
      index++
    ) {
      const step = definition.steps[index];

      const stepResult = await this.executeStep(
        plan,
        definition,
        step,
        index,
        {
          ...payload,
          ...(options.connector === "gemini" && !payload.prompt
            ? {
                prompt: `Execute plan step "${step.name}" for opportunity "${plan.opportunityId}". Target: "${plan.target || "online"}".`
              }
            : {})
        },
        options
      );

      steps.push(stepResult);

      if (!stepResult.success) {
        const failedResult = {
          success: false,
          type: "plan_execution_failed",
          plan,
          approval,
          definition,
          failedStep: stepResult,
          steps,
          startedAt,
          finishedAt: new Date().toISOString()
        };

        this.history.push(failedResult);

        return failedResult;
      }
    }

    this.executed++;

    const result = {
      success: true,
      type: "plan_execution",
      plan,
      approval,
      definition,
      steps,
      startedAt,
      finishedAt: new Date().toISOString()
    };

    this.history.push(result);

    return result;
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
      history: this.history.length,

      policy: this.stepPolicy.getStatus(),

      connectorPolicy: this.connectorPolicy
        ? this.connectorPolicy.getStatus()
        : null,

      executors: {
        execution: this.executionExecutor.getStatus(),
        control: this.controlExecutor.getStatus(),
        developer: this.developerExecutor.getStatus()
      },
      toolRegistry: this.toolRegistry.getStatus(),

      resilience: this.resilience.getStatus()
    };
  }
}

module.exports = PlanExecutor;

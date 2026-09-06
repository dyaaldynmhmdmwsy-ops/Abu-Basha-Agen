"use strict";

const AgentToolRouter =
  require("../tool-routing");

class ExecutionPlanner {
  constructor(options = {}) {
    this.router =
      options.router ||
      new AgentToolRouter();

    this.history = [];
    this.planCounter = 0;
  }

  createPlan(task) {
    const text =
      String(task || "").trim();

    if (!text) {
      return {
        type: "execution_plan",
        status: "no_task",
        planId: null,
        task: "",
        steps: [],
        requiresApproval: false,
        executionAllowed: false
      };
    }

    const route =
      this.router.route(text);

    if (route.status !== "matched") {
      return {
        type: "execution_plan",
        status: "no_tool",
        planId: null,
        task: text,
        steps: [],
        requiresApproval: false,
        executionAllowed: false
      };
    }

    this.planCounter += 1;

    const step = {
      id: 1,
      action: "prepare",
      tool: route.tool.name,
      category: route.tool.category,
      description: route.tool.description,
      status: "planned",
      requiresApproval: route.requiresApproval,
      external: route.external,
      executionAllowed: false
    };

    const plan = {
      type: "execution_plan",
      status: "ready",
      planId: `plan-${Date.now()}-${this.planCounter}`,
      task: text,
      steps: [step],
      requiresApproval: route.requiresApproval,
      executionAllowed: false
    };

    this.history.push({
      planId: plan.planId,
      task: text,
      timestamp: new Date().toISOString()
    });

    return plan;
  }

  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  getStatus() {
    return {
      status: "online",
      plansCreated: this.history.length,
      executionEnabled: false,
      externalExecution: false
    };
  }
}

module.exports = ExecutionPlanner;

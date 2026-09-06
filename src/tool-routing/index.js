"use strict";

const ToolOrchestrator =
  require("../tool-orchestrator");

const catalog =
  require("../tool-orchestrator/catalog");

class AgentToolRouter {
  constructor(options = {}) {
    this.orchestrator =
      options.orchestrator ||
      new ToolOrchestrator();

    if (this.orchestrator.getStatus().total === 0) {
      this.orchestrator.registerMany(catalog);
    }
  }

  route(task) {
    const text = String(task || "").trim();

    if (!text) {
      return {
        type: "tool_route",
        status: "no_task",
        task: "",
        tool: null,
        requiresApproval: false,
        external: false
      };
    }

    const tool =
      this.orchestrator.select(text);

    if (!tool) {
      return {
        type: "tool_route",
        status: "no_match",
        task: text,
        tool: null,
        requiresApproval: false,
        external: false
      };
    }

    return {
      type: "tool_route",
      status: "matched",
      task: text,
      tool: {
        name: tool.name,
        category: tool.category,
        description: tool.description,
        capabilities: [...tool.capabilities]
      },
      requiresApproval: tool.requiresApproval === true,
      external: tool.external === true,
      executionAllowed: false
    };
  }

  discover(task) {
    return this.orchestrator.discover(task);
  }

  getStatus() {
    return this.orchestrator.getStatus();
  }
}

module.exports = AgentToolRouter;

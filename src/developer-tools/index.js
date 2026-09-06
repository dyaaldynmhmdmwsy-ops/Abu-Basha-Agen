"use strict";

/**
 * Developer Tool Registry v1.0.0
 *
 * سجل مركزي لأدوات المطور.
 * لا ينفذ الأدوات بنفسه؛ فقط يسجلها ويسترجعها.
 */

class DeveloperToolRegistry {
  constructor(executionGate = null) {
    this.executionGate = executionGate;
    this.name = "Developer Tool Registry";
    this.version = "1.0.0";
    this.status = "online";
    this.tools = new Map();
  }

  register(name, tool, metadata = {}) {
    if (!name || typeof name !== "string") {
      return {
        success: false,
        type: "invalid_tool_name",
        message: "اسم الأداة غير صالح."
      };
    }

    if (!tool || typeof tool.execute !== "function") {
      return {
        success: false,
        type: "invalid_tool",
        message: `الأداة "${name}" يجب أن تحتوي على execute().`
      };
    }

    if (this.tools.has(name)) {
      return {
        success: false,
        type: "tool_already_exists",
        message: `الأداة "${name}" مسجلة مسبقاً.`
      };
    }

    const entry = {
      name,
      tool,
      metadata: {
        enabled: metadata.enabled !== false,
        category: metadata.category || "developer",
        description: metadata.description || "",
        requiresApproval: metadata.requiresApproval !== false
      }
    };

    this.tools.set(name, entry);

    return {
      success: true,
      type: "tool_registered",
      name,
      metadata: entry.metadata
    };
  }

  get(name) {
    return this.tools.get(name) || null;
  }

  has(name) {
    return this.tools.has(name);
  }

  list() {
    return [...this.tools.values()].map(entry => ({
      name: entry.name,
      metadata: entry.metadata
    }));
  }

  async execute(name, payload = {}, context = {}) {
    const entry = this.get(name);

    if (!entry) {
      return {
        success: false,
        type: "tool_not_found",
        message: `الأداة "${name}" غير موجودة.`
      };
    }

    if (!entry.metadata.enabled) {
      return {
        success: false,
        type: "tool_disabled",
        message: `الأداة "${name}" غير مفعّلة.`
      };
    }

    const requiresApproval =
      entry.metadata.requiresApproval !== false;

    if (this.executionGate && requiresApproval) {
      const gateResult = this.executionGate.check({
        requiresApproval: true,
        approved:
          context &&
          context.options &&
          context.options.approved === true,
        operation: "developer_tool",
        context: {
          tool: name
        }
      });

      if (!gateResult.success) {
        return gateResult;
      }
    }

    return entry.tool.execute(payload, context);
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      total: this.tools.size,
      tools: this.list()
    };
  }
}

module.exports = DeveloperToolRegistry;

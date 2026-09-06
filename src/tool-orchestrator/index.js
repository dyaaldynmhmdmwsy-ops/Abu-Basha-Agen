"use strict";

/*
 * Tool Orchestrator
 * ==================
 * مسؤول عن:
 * 1. تسجيل الأدوات
 * 2. اكتشاف الأدوات المناسبة للمهمة
 * 3. اختيار الأداة
 * 4. تصنيف الأدوات حسب المجال
 *
 * هذه الكتلة لا تنفذ أي عملية خارجية بنفسها.
 * التنفيذ يبقى مسؤولية Executors + Policies.
 */

class ToolOrchestrator {
  constructor(registry = null) {
    this.registry = registry;
    this.tools = new Map();
    this.history = [];
  }

  register(tool) {
    if (!tool || !tool.name) {
      throw new Error("Invalid tool definition");
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    const normalized = {
      name: String(tool.name),
      category: tool.category || "general",
      description: tool.description || "",
      capabilities: Array.isArray(tool.capabilities)
        ? [...tool.capabilities]
        : [],
      enabled: tool.enabled !== false,
      requiresApproval: tool.requiresApproval !== false,
      external: tool.external === true,
      executor: tool.executor || null
    };

    this.tools.set(normalized.name, normalized);

    return normalized;
  }

  registerMany(tools = []) {
    return tools.map(tool => this.register(tool));
  }

  unregister(name) {
    return this.tools.delete(name);
  }

  get(name) {
    return this.tools.get(name) || null;
  }

  list() {
    return Array.from(this.tools.values());
  }

  listEnabled() {
    return this.list().filter(tool => tool.enabled);
  }

  discover(task) {
    const text = String(task || "").trim().toLowerCase();

    if (!text) {
      return [];
    }

    const matches = [];

    for (const tool of this.listEnabled()) {
      let score = 0;

      const searchable = [
        tool.name,
        tool.category,
        tool.description,
        ...tool.capabilities
      ]
        .join(" ")
        .toLowerCase();

      const words = text
        .split(/\s+/)
        .filter(Boolean);

      for (const word of words) {
        if (word.length >= 3 && searchable.includes(word)) {
          score += 1;
        }
      }

      if (score > 0) {
        matches.push({
          tool,
          score
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);

    const result = matches.map(item => item.tool);

    this.history.push({
      task: text,
      results: result.map(tool => tool.name),
      timestamp: new Date().toISOString()
    });

    return result;
  }

  select(task) {
    const candidates = this.discover(task);

    if (!candidates.length) {
      return null;
    }

    return candidates[0];
  }

  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  getStatus() {
    const all = this.list();

    return {
      status: "online",
      total: all.length,
      enabled: all.filter(tool => tool.enabled).length,
      disabled: all.filter(tool => !tool.enabled).length,
      external: all.filter(tool => tool.external).length,
      history: this.history.length
    };
  }
}

module.exports = ToolOrchestrator;

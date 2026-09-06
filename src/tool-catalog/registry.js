"use strict";

class ToolRegistry {
  constructor() {
    this.name = "Canonical Capability Registry";
    this.version = "1.1.0";
    this.status = "online";
    this.tools = new Map();
    this.history = [];
  }

  register(tool = {}) {
    if (!tool || typeof tool !== "object") {
      return {
        success: false,
        type: "invalid_tool"
      };
    }

    if (!tool.name || typeof tool.name !== "string") {
      return {
        success: false,
        type: "invalid_tool_name"
      };
    }

    const normalized = {
      name: tool.name,
      category: tool.category || "general",
      description: tool.description || "",
      capabilities: Array.isArray(tool.capabilities)
        ? [...tool.capabilities]
        : [],
      requiresApproval: tool.requiresApproval !== false,
      external: tool.external === true,
      enabled: tool.enabled !== false,
      executor: tool.executor || null
    };

    this.tools.set(normalized.name, normalized);

    return {
      success: true,
      type: "tool_registered",
      tool: normalized
    };
  }

  registerMany(tools = []) {
    return tools.map(tool => this.register(tool));
  }

  get(name) {
    return this.tools.get(name) || null;
  }

  has(name) {
    return this.tools.has(name);
  }

  remove(name) {
    return this.tools.delete(name);
  }

  list() {
    return [...this.tools.values()];
  }

  listEnabled() {
    return this.list().filter(tool => tool.enabled);
  }

  byCategory(category) {
    return this.listEnabled().filter(
      tool => tool.category === category
    );
  }

  normalizeText(value = "") {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[؟?!.,،؛:()\\[\\]{}"']/g, " ")
      .replace(/\\s+/g, " ")
      .trim();
  }

  tokenize(value = "") {
    return this.normalizeText(value)
      .split(" ")
      .filter(word => word.length >= 2);
  }

  getIntentProfile(tool) {
    const profiles = {
      "developer": {
        exact: [
          "برمجة",
          "تطوير كود",
          "كتابة كود",
          "تصحيح كود",
          "build software",
          "write code",
          "debug code"
        ],
        strong: [
          "تطوير",
          "كود",
          "برمج",
          "برنامج",
          "software",
          "coding",
          "developer"
        ],
        weak: [
          "مشروع",
          "ملف"
        ]
      },

      "web-research": {
        exact: [
          "ابحث عن معلومات في الإنترنت",
          "ابحث في الإنترنت",
          "بحث في الإنترنت",
          "ابحث عن معلومات",
          "بحث عن معلومات",
          "web research",
          "internet research",
          "search the web"
        ],
        strong: [
          "ابحث",
          "بحث",
          "معلومات",
          "الإنترنت",
          "الويب",
          "مصادر",
          "research",
          "search"
        ],
        weak: [
          "رابط",
          "مصدر"
        ]
      },

      "media": {
        exact: [
          "مونتاج فيديو",
          "تحرير فيديو",
          "تعديل فيديو",
          "صناعة فيديو",
          "video editing",
          "edit video"
        ],
        strong: [
          "مونتاج",
          "فيديو",
          "تحرير",
          "تعديل",
          "قص",
          "موسيقى للفيديو",
          "video",
          "editing"
        ],
        weak: [
          "صوت",
          "صورة"
        ]
      },

      "diagnostics": {
        exact: [
          "تشخيص الهاتف",
          "تشخيص مشكلة في الهاتف",
          "إصلاح الهاتف",
          "مشكلة في الهاتف",
          "فحص الهاتف",
          "phone diagnostics",
          "repair phone"
        ],
        strong: [
          "هاتف",
          "موبايل",
          "تشخيص",
          "إصلاح",
          "عطل",
          "مشكلة",
          "بطارية",
          "شاشة"
        ],
        weak: [
          "جهاز",
          "فحص"
        ]
      },

      "social-media": {
        exact: [
          "إدارة فيسبوك",
          "إدارة يوتيوب",
          "إدارة تيك توك",
          "إدارة وسائل التواصل",
          "social media",
          "facebook",
          "youtube",
          "tiktok"
        ],
        strong: [
          "فيسبوك",
          "يوتيوب",
          "تيك توك",
          "تواصل اجتماعي",
          "منشور",
          "متابعين",
          "هاشتاق"
        ],
        weak: [
          "صفحة",
          "محتوى"
        ]
      }
    };

    return profiles[tool.name] || {
      exact: [],
      strong: [],
      weak: []
    };
  }

  normalizeText(value = "") {
    return String(value || "")
      .toLowerCase()
      .replace(/[ًٌٍَُِّْـ]/g, "")
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  tokenize(value = "") {
    return this.normalizeText(value)
      .split(/\s+/)
      .filter(Boolean);
  }

  scoreTool(tool, task = "") {
    const text = this.normalizeText(task);

    if (!text) {
      return {
        score: 0,
        exact: 0,
        strong: 0,
        weak: 0,
        token: 0,
        phraseLength: 0
      };
    }

    const profile = this.getIntentProfile(tool);

    let exact = 0;
    let strong = 0;
    let weak = 0;
    let token = 0;
    let phraseLength = 0;

    for (const phrase of profile.exact) {
      const normalized = this.normalizeText(phrase);

      if (normalized && text.includes(normalized)) {
        const length = this.tokenize(normalized).length;

        exact += 100 + (length * 25);
        phraseLength = Math.max(phraseLength, length);
      }
    }

    for (const phrase of profile.strong) {
      const normalized = this.normalizeText(phrase);

      if (normalized && text.includes(normalized)) {
        strong += 15;
      }
    }

    for (const phrase of profile.weak) {
      const normalized = this.normalizeText(phrase);

      if (normalized && text.includes(normalized)) {
        weak += 2;
      }
    }

    const words = this.tokenize(text);
    const searchable = [
      tool.name,
      tool.category,
      tool.description,
      ...tool.capabilities
    ]
      .map(value => this.normalizeText(value))
      .filter(Boolean);

    for (const word of words) {
      if (searchable.includes(word)) {
        token += 3;
      }
    }

    /*
     * Intent dominance:
     *
     * A multi-intent task must not be treated as a bag of unrelated
     * words. Exact phrases represent the strongest evidence.
     *
     * Example:
     * "مونتاج فيديو وابحث عن موسيقى مناسبة"
     *
     * The phrase "مونتاج فيديو" belongs to media and therefore
     * media remains the primary tool.
     */

    const score =
      exact +
      strong +
      weak +
      token;

    return {
      score,
      exact,
      strong,
      weak,
      token,
      phraseLength
    };
  }

  discover(task = "") {
    const text = this.normalizeText(task);

    if (!text) {
      return [];
    }

    const candidates = [];

    for (const tool of this.listEnabled()) {
      const ranking = this.scoreTool(tool, text);

      if (ranking.score > 0) {
        candidates.push({
          tool,
          ...ranking
        });
      }
    }

    candidates.sort((a, b) => {
      if (b.exact !== a.exact) {
        return b.exact - a.exact;
      }

      if (b.phraseLength !== a.phraseLength) {
        return b.phraseLength - a.phraseLength;
      }

      if (b.strong !== a.strong) {
        return b.strong - a.strong;
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.tool.name.localeCompare(b.tool.name);
    });

    const result = candidates.map(item => item.tool);

    this.history.push({
      task: text,
      results: result.map(tool => tool.name),
      ranking: candidates.map(item => ({
        tool: item.tool.name,
        score: item.score,
        exact: item.exact,
        strong: item.strong,
        weak: item.weak,
        token: item.token,
        phraseLength: item.phraseLength
      })),
      timestamp: new Date().toISOString()
    });

    return result;
  }

  select(task = "") {
    const candidates = this.discover(task);

    if (!candidates.length) {
      return null;
    }

    const historyEntry =
      this.history[this.history.length - 1];

    const ranking =
      historyEntry &&
      Array.isArray(historyEntry.ranking)
        ? historyEntry.ranking
        : [];

    const first = candidates[0];

    const selected =
      ranking.find(item =>
        item.tool === first.name
      );

    if (!selected || selected.score < 10) {
      return null;
    }

    const second = ranking[1];

    /*
     * If there is no exact phrase and two tools are nearly tied,
     * refuse to guess.
     */
    if (
      second &&
      selected.exact === 0 &&
      second.exact === 0 &&
      second.score >= selected.score - 5
    ) {
      return null;
    }

    return first;
  }
  listCapabilities(options = {}) {
    const enabledOnly = options.enabledOnly !== false;
    const source = enabledOnly ? this.listEnabled() : this.list();
    const capabilities = new Set();

    for (const tool of source) {
      for (const capability of tool.capabilities || []) {
        const normalized = this.normalizeText(capability);
        if (normalized) {
          capabilities.add(normalized);
        }
      }
    }

    return [...capabilities].sort((a, b) => a.localeCompare(b));
  }

  findByCapability(capability = "", options = {}) {
    const query = this.normalizeText(capability);
    if (!query) {
      return [];
    }

    const enabledOnly = options.enabledOnly !== false;
    const source = enabledOnly ? this.listEnabled() : this.list();

    return source.filter(tool =>
      (tool.capabilities || []).some(item =>
        this.normalizeText(item) === query ||
        this.normalizeText(item).includes(query) ||
        query.includes(this.normalizeText(item))
      )
    );
  }

  inspectCapabilities(task = "") {
    const candidates = this.discover(task);

    return {
      success: true,
      type: "capability_discovery",
      task: this.normalizeText(task),
      capabilities: candidates.map(tool => ({
        name: tool.name,
        category: tool.category,
        capabilities: [...tool.capabilities],
        requiresApproval: tool.requiresApproval,
        external: tool.external,
        enabled: tool.enabled
      })),
      selected: this.select(task)?.name || null
    };
  }

  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  getStatus() {
    const all = this.list();

    return {
      name: this.name,
      version: this.version,
      status: this.status,
      total: all.length,
      enabled: all.filter(tool => tool.enabled).length,
      disabled: all.filter(tool => !tool.enabled).length,
      external: all.filter(tool => tool.external).length,
      approvalRequired: all.filter(
        tool => tool.requiresApproval
      ).length,
      history: this.history.length
    };
  }
}

module.exports = ToolRegistry;

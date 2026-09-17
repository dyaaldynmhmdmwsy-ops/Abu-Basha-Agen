"use strict";

class ModelRegistry {
  constructor(options = {}) {
    this.name = "Gemini Flash Model Registry";
    this.version = "1.0.0";
    this.status = "online";

    this.family = options.family || "gemini";

    this.models = new Map([
      ["gemini-3.8-flash", {
        id: "gemini-3.8-flash",
        family: "gemini",
        capability: "text",
        tier: "advanced",
        status: "stable",
        fallbackEligible: false,
        fallbackPriority: 0
      }],
      ["gemini-3.7-flash", {
        id: "gemini-3.7-flash",
        family: "gemini",
        capability: "text",
        tier: "advanced",
        status: "stable",
        fallbackEligible: true,
        fallbackPriority: 100
      }],
      ["gemini-3.6-flash", {
        id: "gemini-3.6-flash",
        family: "gemini",
        capability: "text",
        tier: "standard",
        status: "stable",
        fallbackEligible: true,
        fallbackPriority: 90
      }],
      ["gemini-3.5-flash", {
        id: "gemini-3.5-flash",
        family: "gemini",
        capability: "text",
        tier: "standard",
        status: "stable",
        fallbackEligible: true,
        fallbackPriority: 80
      }],
      ["gemini-3.5-flash-lite", {
        id: "gemini-3.5-flash-lite",
        family: "gemini",
        capability: "text",
        tier: "lite",
        status: "stable",
        fallbackEligible: true,
        fallbackPriority: 70
      }]
    ]);
  }

  register(model) {
    if (!model || !model.id) {
      return {
        success: false,
        type: "invalid_model"
      };
    }

    const existing = this.models.get(model.id) || {};

    this.models.set(model.id, {
      ...existing,
      family: model.family || existing.family || this.family,
      capability: model.capability || existing.capability || "unknown",
      status:
        existing.status && existing.status !== "unknown"
          ? existing.status
          : (model.status || "unknown"),
      ...model
    });

    const current = this.models.get(model.id);

    if (
      existing.status &&
      existing.status !== "unknown" &&
      model.status === "discovered"
    ) {
      current.status = existing.status;
    }

    return {
      success: true,
      type: "model_registered",
      model: this.models.get(model.id)
    };
  }

  has(modelId) {
    return this.models.has(modelId);
  }

  get(modelId) {
    return this.models.get(modelId) || null;
  }

  list() {
    return Array.from(this.models.values());
  }

  listFamily(family = this.family) {
    return this.list().filter(model => model.family === family);
  }

  listCapability(capability) {
    return this.list().filter(model => model.capability === capability);
  }

  async discover(client) {
    if (!client || !client.models || typeof client.models.list !== "function") {
      return {
        success: false,
        type: "invalid_model_client"
      };
    }

    const discovered = [];
    const pager = await client.models.list();

    for await (const model of pager) {
      const name = String(model?.name || "");
      const id = name.startsWith("models/")
        ? name.slice(7)
        : name;

      const normalizedId = id.toLowerCase();

      if (!normalizedId.includes("gemini")) {
        continue;
      }

      const supportedFamily =
        normalizedId.includes("flash") ||
        normalizedId.includes("pro") ||
        normalizedId.includes("embedding") ||
        normalizedId.includes("transcribe");

      if (!supportedFamily) {
        continue;
      }

      const methods = Array.isArray(model?.supportedActions)
        ? model.supportedActions
        : [];

      if (methods.length && !methods.includes("generateContent")) {
        continue;
      }

      let family = "gemini";
      let capability = "text";

      if (normalizedId.includes("pro")) {
        family = "gemini-pro";
      } else if (normalizedId.includes("flash")) {
        family = "gemini-flash";
      }

      if (normalizedId.includes("image")) {
        capability = "image";
      } else if (normalizedId.includes("tts")) {
        capability = "tts";
      } else if (normalizedId.includes("transcribe")) {
        capability = "transcription";
      } else if (normalizedId.includes("embedding")) {
        capability = "embedding";
      }

      const entry = {
        id,
        family,
        capability,
        tier: normalizedId.includes("lite") ? "lite" :
          normalizedId.includes("pro") ? "advanced" : "standard",
        status: normalizedId.includes("preview") ? "preview" : "discovered"
      };

      this.register(entry);
      discovered.push(entry);
    }

    return {
      success: true,
      type: "models_discovered",
      count: discovered.length,
      models: discovered
    };
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      family: this.family,
      total: this.models.size,
      capabilities: [...new Set(
        this.list().map(model => model.capability)
      )],
      models: this.list()
    };
  }
}

module.exports = ModelRegistry;

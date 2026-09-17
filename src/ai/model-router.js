"use strict";

const ModelRegistry = require("./model-registry");

class ModelRouter {
  constructor(options = {}) {
    this.name = "Gemini Flash Model Router";
    this.version = "1.0.0";
    this.status = "online";

    this.registry = options.registry || new ModelRegistry();

    this.defaultModel =
      options.defaultModel || "gemini-3.8-flash";
  }

  resolve(requestedModel = null) {
    if (requestedModel) {
      if (!this.registry.has(requestedModel)) {
        return {
          success: false,
          type: "model_not_found",
          requestedModel
        };
      }

      return {
        success: true,
        type: "model_selected",
        model: this.registry.get(requestedModel),
        source: "requested"
      };
    }

    if (this.registry.has(this.defaultModel)) {
      return {
        success: true,
        type: "model_selected",
        model: this.registry.get(this.defaultModel),
        source: "default"
      };
    }

    const fallback = this.registry.list()[0] || null;

    if (!fallback) {
      return {
        success: false,
        type: "no_model_available"
      };
    }

    return {
      success: true,
      type: "model_selected",
      model: fallback,
      source: "fallback"
    };
  }

  resolveFallback(primaryModel = null) {
    const primary = primaryModel || this.defaultModel;

    const candidates = this.registry
      .list()
      .filter(model =>
        model &&
        model.id !== primary &&
        model.status === "stable" &&
        model.capability === "text" &&
        model.fallbackEligible === true
      )
      .sort(
        (a, b) =>
          Number(b.fallbackPriority || 0) -
          Number(a.fallbackPriority || 0)
      );

    const fallback = candidates[0] || null;

    if (!fallback) {
      return {
        success: false,
        type: "no_fallback_model_available",
        primaryModel: primary
      };
    }

    return {
      success: true,
      type: "fallback_model_selected",
      model: fallback,
      primaryModel: primary,
      source: "model_policy"
    };
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      defaultModel: this.defaultModel,
      registry: this.registry.getStatus()
    };
  }
}

module.exports = ModelRouter;

"use strict";

const ModelRegistry = require("./model-registry");

class ModelRouter {
  constructor(options = {}) {
    this.name = "Gemini Flash Model Router";
    this.version = "1.0.0";
    this.status = "online";

    this.registry = options.registry || new ModelRegistry();

    this.defaultModel =
      options.defaultModel || "gemini-3.6-flash";
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

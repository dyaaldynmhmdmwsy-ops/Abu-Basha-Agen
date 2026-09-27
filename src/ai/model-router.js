"use strict";

const ModelRegistry = require("./model-registry");

const MODEL_STATES = Object.freeze({
  AVAILABLE: "AVAILABLE",
  TEMPORARILY_LIMITED: "TEMPORARILY_LIMITED",
  QUOTA_EXHAUSTED: "QUOTA_EXHAUSTED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  UNKNOWN: "UNKNOWN"
});

class ModelRouter {
  constructor(options = {}) {
    this.name = "Gemini Flash Model Router";
    this.version = "2.0.0";
    this.status = "online";

    this.registry = options.registry || new ModelRegistry();

    this.defaultModel =
      options.defaultModel || "gemini-3.8-flash";

    this.maxFallbackAttempts =
      Number.isInteger(options.maxFallbackAttempts) &&
      options.maxFallbackAttempts >= 0
        ? Math.min(options.maxFallbackAttempts, 2)
        : 2;

    this.temporaryLimitMs =
      Number.isInteger(options.temporaryLimitMs) &&
      options.temporaryLimitMs > 0
        ? options.temporaryLimitMs
        : 15000;

    this.providerUnavailableMs =
      Number.isInteger(options.providerUnavailableMs) &&
      options.providerUnavailableMs > 0
        ? options.providerUnavailableMs
        : 10000;

    this.modelStates = new Map();
  }

  _now() {
    return Date.now();
  }

  _state(modelId) {
    const id = String(modelId || "").trim();

    if (!id) {
      return {
        state: MODEL_STATES.UNKNOWN,
        blockedUntil: null
      };
    }

    const existing = this.modelStates.get(id);

    if (!existing) {
      return {
        state: MODEL_STATES.AVAILABLE,
        blockedUntil: null
      };
    }

    if (
      existing.blockedUntil &&
      existing.blockedUntil <= this._now() &&
      existing.state !== MODEL_STATES.QUOTA_EXHAUSTED
    ) {
      existing.state = MODEL_STATES.AVAILABLE;
      existing.blockedUntil = null;
      existing.lastRecoveryAt = this._now();
    }

    return {
      ...existing
    };
  }

  getModelState(modelId) {
    return {
      modelId,
      ...this._state(modelId)
    };
  }

  isModelAvailable(modelId) {
    const state = this._state(modelId);
    return state.state === MODEL_STATES.AVAILABLE;
  }

  classifyFailure(failure = {}) {
    const status = Number(
      failure.status ||
      failure.response?.status ||
      0
    );

    const message = String(
      failure.message ||
      failure.error?.message ||
      failure ||
      ""
    );

    const normalized = message.toLowerCase();

    const quotaEvidence =
      normalized.includes("quota_exceeded") ||
      normalized.includes("quota exceeded") ||
      normalized.includes("daily quota") ||
      normalized.includes("generate_content_free_tier_requests") ||
      normalized.includes("quota metric") ||
      normalized.includes("resource_exhausted") &&
        (
          normalized.includes("quota") ||
          normalized.includes("limit")
        );

    if (quotaEvidence) {
      return {
        state: MODEL_STATES.QUOTA_EXHAUSTED,
        retryable: false,
        fallbackAllowed: true,
        fallbackReason: "quota_exhausted",
        blockedUntil: null
      };
    }

    const rateLimitEvidence =
      normalized.includes("rate_limit_exceeded") ||
      normalized.includes("rate limit") ||
      normalized.includes("too many requests") ||
      normalized.includes("too_many_requests") ||
      normalized.includes("per-minute") ||
      normalized.includes("per minute") ||
      normalized.includes("per-second") ||
      normalized.includes("per second");

    if (status === 429 && rateLimitEvidence) {
      return {
        state: MODEL_STATES.TEMPORARILY_LIMITED,
        retryable: true,
        fallbackAllowed: true,
        fallbackReason: "rate_limit",
        blockedUntil: this._now() + this.temporaryLimitMs
      };
    }

    if (
      status === 503 ||
      normalized.includes("unavailable") ||
      normalized.includes("high demand")
    ) {
      return {
        state: MODEL_STATES.PROVIDER_UNAVAILABLE,
        retryable: true,
        fallbackAllowed: true,
        fallbackReason: "provider_unavailable",
        blockedUntil: this._now() + this.providerUnavailableMs
      };
    }

    if (
      status === 408 ||
      status === 425 ||
      (status >= 500 && status <= 599)
    ) {
      return {
        state: MODEL_STATES.TEMPORARILY_LIMITED,
        retryable: true,
        fallbackAllowed: true,
        fallbackReason: "transient_provider_failure",
        blockedUntil: this._now() + this.temporaryLimitMs
      };
    }

    if (
      normalized.includes("timeout") ||
      normalized.includes("timed out") ||
      normalized.includes("network") ||
      normalized.includes("connection") ||
      normalized.includes("socket") ||
      normalized.includes("econn") ||
      normalized.includes("etimedout") ||
      normalized.includes("eai_again")
    ) {
      return {
        state: MODEL_STATES.TEMPORARILY_LIMITED,
        retryable: true,
        fallbackAllowed: false,
        fallbackReason: "network_transient",
        blockedUntil: this._now() + this.temporaryLimitMs
      };
    }

    return {
      state: MODEL_STATES.UNKNOWN,
      retryable: false,
      fallbackAllowed: false,
      fallbackReason: "policy_uncertainty",
      blockedUntil: null
    };
  }

  recordFailure(modelId, failure = {}) {
    const id = String(modelId || "").trim();

    if (!id) {
      return {
        success: false,
        type: "invalid_model_failure_record"
      };
    }

    const classification = this.classifyFailure(failure);

    this.modelStates.set(id, {
      state: classification.state,
      blockedUntil: classification.blockedUntil || null,
      lastFailureAt: this._now(),
      lastStatus: Number(failure.status || 0) || null,
      retryable: classification.retryable,
      fallbackAllowed: classification.fallbackAllowed,
      fallbackReason: classification.fallbackReason
    });

    return {
      success: true,
      modelId: id,
      ...classification,
      quotaState: classification.state
    };
  }

  recordSuccess(modelId) {
    const id = String(modelId || "").trim();

    if (!id) {
      return {
        success: false,
        type: "invalid_model_success_record"
      };
    }

    this.modelStates.set(id, {
      state: MODEL_STATES.AVAILABLE,
      blockedUntil: null,
      lastSuccessAt: this._now()
    });

    return {
      success: true,
      modelId: id,
      state: MODEL_STATES.AVAILABLE,
      quotaState: MODEL_STATES.AVAILABLE
    };
  }

  resolve(requestedModel = null) {
    if (requestedModel) {
      if (!this.registry.has(requestedModel)) {
        return {
          success: false,
          type: "model_not_found",
          requestedModel,
          failClosed: true
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
        type: "no_model_available",
        failClosed: true
      };
    }

    return {
      success: true,
      type: "model_selected",
      model: fallback,
      source: "registry_fallback"
    };
  }

  resolveExecutionModel(requestedModel = null, options = {}) {
    const allowFallback =
      options.allowFallback === true;

    const selection = this.resolve(requestedModel);

    if (!selection.success || !selection.model) {
      return selection;
    }

    const primary = selection.model;
    const state = this._state(primary.id);

    if (this.isModelAvailable(primary.id)) {
      return {
        success: true,
        type: "execution_model_selected",
        model: primary,
        requestedModel: requestedModel || null,
        selectedModel: primary.id,
        fallbackUsed: false,
        fallbackReason: null,
        quotaState: state.state
      };
    }

    if (!allowFallback) {
      return {
        success: false,
        type: "model_temporarily_unavailable",
        requestedModel: requestedModel || primary.id,
        selectedModel: primary.id,
        quotaState: state.state,
        failClosed: true
      };
    }

    const fallback = this.resolveFallback(primary.id, {
      excludeModels: options.excludeModels || []
    });

    if (!fallback.success) {
      return {
        success: false,
        type: "no_fallback_model_available",
        requestedModel: requestedModel || primary.id,
        selectedModel: primary.id,
        quotaState: state.state,
        failClosed: true
      };
    }

    return {
      success: true,
      type: "execution_model_fallback",
      model: fallback.model,
      requestedModel: requestedModel || primary.id,
      selectedModel: fallback.model.id,
      fallbackUsed: true,
      fallbackReason:
        state.fallbackReason ||
        "selected_model_unavailable",
      quotaState: state.state
    };
  }

  resolveFallback(primaryModel = null, options = {}) {
    const primary = primaryModel || this.defaultModel;

    const excluded = new Set(
      Array.isArray(options.excludeModels)
        ? options.excludeModels
        : []
    );

    excluded.add(primary);

    const candidates = this.registry
      .list()
      .filter(model =>
        model &&
        model.id &&
        !excluded.has(model.id) &&
        model.status === "stable" &&
        model.capability === "text" &&
        model.fallbackEligible === true &&
        this.isModelAvailable(model.id)
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
      source: "central_model_policy"
    };
  }

  getExecutionChain(requestedModel = null) {
    const selection = this.resolveExecutionModel(
      requestedModel,
      { allowFallback: true }
    );

    if (!selection.success || !selection.model) {
      return {
        success: false,
        type: selection.type || "no_model_available",
        failClosed: true
      };
    }

    const chain = [selection.model];
    const excluded = new Set([selection.model.id]);

    let primary = selection.model.id;

    for (
      let index = 0;
      index < this.maxFallbackAttempts;
      index += 1
    ) {
      const next = this.resolveFallback(primary, {
        excludeModels: [...excluded]
      });

      if (!next.success || !next.model) {
        break;
      }

      chain.push(next.model);
      excluded.add(next.model.id);
      primary = next.model.id;
    }

    return {
      success: true,
      type: "execution_model_chain",
      requestedModel: requestedModel || null,
      models: chain,
      fallbackUsed: selection.fallbackUsed === true,
      fallbackReason: selection.fallbackReason || null,
      quotaState: selection.quotaState
    };
  }

  getStatus() {
    const states = {};

    for (const model of this.registry.list()) {
      states[model.id] = this.getModelState(model.id);
    }

    return {
      name: this.name,
      version: this.version,
      status: this.status,
      defaultModel: this.defaultModel,
      maxFallbackAttempts: this.maxFallbackAttempts,
      freeTierFirst: true,
      paidFallback: false,
      autoBilling: false,
      registry: this.registry.getStatus(),
      modelStates: states
    };
  }
}

ModelRouter.STATES = MODEL_STATES;

module.exports = ModelRouter;

"use strict";

const InjectionDefense = require("../../injection-defense");

class VoiceCapability {
  constructor(options = {}) {
    this.name = "Voice Capability Boundary";
    this.version = "1.0.0";
    this.status = "ready";

    this.providerNeutral = true;
    this.requiresApproval = true;
    this.autonomousExecution = false;
    this.executionEnabled = false;
    this.externalExecution = false;
    this.directGeminiBypass = false;
    this.directRuntimeExecution = false;

    this.injectionDefense =
      options.injectionDefense || new InjectionDefense();

    this.sttProvider = null;
    this.ttsProvider = null;
  }

  setSTTProvider(provider) {
    if (!provider || typeof provider.transcribe !== "function") {
      return {
        success: false,
        type: "invalid_stt_provider"
      };
    }

    this.sttProvider = provider;

    return {
      success: true,
      type: "stt_provider_registered"
    };
  }

  setTTSProvider(provider) {
    if (!provider || typeof provider.synthesize !== "function") {
      return {
        success: false,
        type: "invalid_tts_provider"
      };
    }

    this.ttsProvider = provider;

    return {
      success: true,
      type: "tts_provider_registered"
    };
  }

  inspectVoiceInput(input) {
    const result = this.injectionDefense.inspect(input);

    if (!result || result.safe !== true) {
      return {
        success: false,
        type: "voice_input_blocked",
        executionAllowed: false,
        requiresApproval: true,
        reason: result?.reason || "untrusted_voice_input"
      };
    }

    return {
      success: true,
      type: "voice_input_accepted",
      executionAllowed: false,
      requiresApproval: true,
      trustedInput: result.input || input
    };
  }

  async transcribe(audio, context = {}) {
    if (!this.sttProvider) {
      return {
        success: false,
        type: "stt_provider_unavailable",
        executionAllowed: false
      };
    }

    const result = await this.sttProvider.transcribe(audio, context);

    if (!result || result.success !== true || typeof result.text !== "string") {
      return {
        success: false,
        type: "stt_failed",
        executionAllowed: false
      };
    }

    const inspected = this.inspectVoiceInput(result.text);

    if (!inspected.success) {
      return inspected;
    }

    return {
      success: true,
      type: "voice_transcription",
      text: inspected.trustedInput,
      executionAllowed: false,
      requiresApproval: true,
      actionExecution: "plan_only"
    };
  }

  async synthesize(text, context = {}) {
    if (!this.ttsProvider) {
      return {
        success: false,
        type: "tts_provider_unavailable",
        executionAllowed: false
      };
    }

    const result = await this.ttsProvider.synthesize(text, context);

    return {
      ...result,
      executionAllowed: false,
      externalExecution: false,
      actionExecution: "presentation_only",
      requiresApproval: true
    };
  }

  createActionPlan(transcribedText, context = {}) {
    const inspected = this.inspectVoiceInput(transcribedText);

    if (!inspected.success) {
      return inspected;
    }

    return {
      success: true,
      type: "voice_action_plan",
      text: inspected.trustedInput,
      planOnly: true,
      executionAllowed: false,
      autonomousExecution: false,
      requiresApproval: true,
      externalExecution: false,
      context
    };
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      providerNeutral: this.providerNeutral,
      sttConfigured: Boolean(this.sttProvider),
      ttsConfigured: Boolean(this.ttsProvider),
      requiresApproval: this.requiresApproval,
      autonomousExecution: this.autonomousExecution,
      executionEnabled: this.executionEnabled,
      externalExecution: this.externalExecution,
      directGeminiBypass: this.directGeminiBypass,
      directRuntimeExecution: this.directRuntimeExecution
    };
  }
}

module.exports = VoiceCapability;

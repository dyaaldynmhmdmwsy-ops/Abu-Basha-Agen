"use strict";

const { GoogleGenAI } = require("@google/genai");

const DEFAULT_TTS_MODEL = "gemini-3.1-flash-tts-preview";

class GeminiTTSAdapter {
  constructor(options = {}) {
    this.name = "Gemini TTS Adapter";
    this.version = "1.0.0";
    this.status = "online";
    this.providerNeutral = true;
    this.model =
      options.model ||
      process.env.GEMINI_TTS_MODEL ||
      DEFAULT_TTS_MODEL;

    this.apiKey =
      options.apiKey ||
      process.env.GEMINI_API_KEY ||
      "";

    this.client = this.apiKey
      ? new GoogleGenAI({ apiKey: this.apiKey })
      : null;
  }

  async synthesize(text, options = {}) {
    const input =
      typeof text === "string"
        ? text.trim()
        : "";

    if (!input) {
      return {
        success: false,
        type: "tts_text_required",
        executionAllowed: false,
        externalExecution: false,
        actionExecution: "presentation_only",
        requiresApproval: true,
        failClosed: true
      };
    }

    if (!this.client) {
      return {
        success: false,
        type: "tts_provider_not_configured",
        executionAllowed: false,
        externalExecution: false,
        actionExecution: "presentation_only",
        requiresApproval: true,
        failClosed: true
      };
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: input,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName:
                  options.voiceName ||
                  process.env.GEMINI_TTS_VOICE ||
                  "Kore"
              }
            },
            languageCode:
              options.languageCode ||
              "ar-SA"
          }
        }
      });

      const audio =
        response &&
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].content &&
        response.candidates[0].content.parts
          ? response.candidates[0].content.parts.find(
              (part) =>
                part &&
                part.inlineData &&
                typeof part.inlineData.data === "string"
            )
          : null;

      if (!audio || !audio.inlineData) {
        return {
          success: false,
          type: "tts_audio_not_returned",
          model: this.model,
          executionAllowed: false,
          externalExecution: false,
          actionExecution: "presentation_only",
          requiresApproval: true,
          failClosed: true
        };
      }

      const mimeType =
        audio.inlineData.mimeType ||
        "audio/pcm";

      const data = audio.inlineData.data;

      return {
        success: true,
        type: "tts_audio_ready",
        model: this.model,
        audio: {
          data,
          mimeType
        },
        executionAllowed: false,
        externalExecution: false,
        actionExecution: "presentation_only",
        requiresApproval: true,
        failClosed: false
      };
    } catch (error) {
      return {
        success: false,
        type: "tts_provider_error",
        model: this.model,
        error: error && error.message
          ? error.message
          : "tts_provider_error",
        executionAllowed: false,
        externalExecution: false,
        actionExecution: "presentation_only",
        requiresApproval: true,
        failClosed: true
      };
    }
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      provider: "gemini",
      model: this.model,
      configured: Boolean(this.client),
      requiresApproval: true,
      executionAllowed: false,
      externalExecution: false
    };
  }
}

module.exports = GeminiTTSAdapter;

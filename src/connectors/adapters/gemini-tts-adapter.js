"use strict";

const { GoogleGenAI } = require("@google/genai");

const DEFAULT_TTS_MODEL = "gemini-3.8-flash-tts";
const DEFAULT_TTS_VOICE = "Kore";
const DEFAULT_TIMEOUT_MS = 30000;

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

    this.voice =
      options.voice ||
      process.env.GEMINI_TTS_VOICE ||
      DEFAULT_TTS_VOICE;

    this.apiKey =
      options.apiKey ||
      process.env.GEMINI_API_KEY ||
      "";

    this.timeoutMs = Number(
      options.timeoutMs ||
      process.env.GEMINI_TTS_TIMEOUT_MS ||
      DEFAULT_TIMEOUT_MS
    );

    this.client = this.apiKey
      ? new GoogleGenAI({ apiKey: this.apiKey })
      : null;
  }

  async synthesize(text, options = {}) {
    const input =
      typeof text === "string"
        ? text.trim()
        : "";

    const security = {
      executionAllowed: false,
      externalExecution: false,
      actionExecution: "presentation_only",
      requiresApproval: true
    };

    if (!input) {
      return {
        success: false,
        type: "tts_text_required",
        ...security,
        failClosed: true
      };
    }

    if (!this.client) {
      return {
        success: false,
        type: "tts_provider_not_configured",
        model: this.model,
        ...security,
        failClosed: true
      };
    }

    const voice =
      options.voiceName ||
      options.voice ||
      this.voice;

    const style =
      options.style ||
      "Natural Sudanese Arabic delivery. Clear, warm, calm, conversational pronunciation. Preserve the supplied transcript exactly; do not paraphrase, summarize, answer, or add words.";

    try {
      const interaction = await Promise.race([
        this.client.interactions.create({
          model: this.model,
          input: [
            {
              type: "user_input",
              content: [
                {
                  type: "text",
                  text: input,
                  annotations: [
                    {
                      type: "speech_metadata",
                      style
                    }
                  ]
                }
              ]
            }
          ],
          response_format: {
            type: "audio"
          },
          generation_config: {
            speech_config: [
              {
                voice
              }
            ]
          }
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("tts_timeout")),
            this.timeoutMs
          )
        )
      ]);

      const audio = interaction?.output_audio;

      if (
        !audio ||
        typeof audio.data !== "string" ||
        !audio.data
      ) {
        return {
          success: false,
          type: "tts_audio_not_returned",
          model: this.model,
          ...security,
          failClosed: true
        };
      }

      return {
        success: true,
        type: "tts_audio_ready",
        model: this.model,
        voice,
        transcript: input,
        audio: {
          data: audio.data,
          mimeType:
            typeof audio.mime_type === "string" &&
            audio.mime_type
              ? audio.mime_type
              : "audio/wav"
        },
        ...security,
        failClosed: false
      };
    } catch (error) {
      return {
        success: false,
        type: "tts_provider_error",
        model: this.model,
        error:
          error?.message ||
          "tts_provider_error",
        ...security,
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
      voice: this.voice,
      configured: Boolean(this.client),
      requiresApproval: true,
      executionAllowed: false,
      externalExecution: false,
      actionExecution: "presentation_only"
    };
  }
}

module.exports = GeminiTTSAdapter;

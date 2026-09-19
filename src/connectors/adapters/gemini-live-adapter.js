"use strict";

const { GoogleGenAI } = require("@google/genai");

const DEFAULT_LIVE_MODEL = "gemini-3.8-live";
const DEFAULT_TIMEOUT_MS = 30000;

class GeminiLiveAdapter {
  constructor(options = {}) {
    this.name = "Gemini Live Voice Adapter";
    this.version = "1.0.0";
    this.status = "online";
    this.providerNeutral = true;

    this.model =
      options.model ||
      process.env.GEMINI_LIVE_MODEL ||
      DEFAULT_LIVE_MODEL;

    this.apiKey =
      options.apiKey ||
      process.env.GEMINI_API_KEY ||
      "";

    this.timeoutMs = Number(
      options.timeoutMs ||
      process.env.GEMINI_LIVE_TIMEOUT_MS ||
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
        type: "live_voice_text_required",
        ...security,
        failClosed: true
      };
    }

    if (!this.client) {
      return {
        success: false,
        type: "live_voice_provider_not_configured",
        model: this.model,
        ...security,
        failClosed: true
      };
    }

    let session = null;
    let timer = null;
    let settled = false;
    let audioParts = [];
    let audioMimeType = null;

    try {
      const result = await new Promise(async (resolve) => {
        const finish = (value) => {
          if (settled) {
            return;
          }

          settled = true;

          if (timer) {
            clearTimeout(timer);
            timer = null;
          }

          resolve(value);
        };

        timer = setTimeout(() => {
          finish({
            success: false,
            type: "live_voice_timeout",
            model: this.model,
            ...security,
            failClosed: true
          });
        }, this.timeoutMs);

        try {
          session = await this.client.live.connect({
            model: this.model,
            config: {
              responseModalities: ["AUDIO"],
              ...(options.voiceName
                ? {
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: {
                          voiceName: options.voiceName
                        }
                      }
                    }
                  }
                : {})
            },
            callbacks: {
              onopen: () => {},
              onmessage: (message) => {
                const parts =
                  message?.serverContent?.modelTurn?.parts || [];

                for (const part of parts) {
                  const inlineData = part?.inlineData;

                  if (
                    inlineData &&
                    typeof inlineData.data === "string"
                  ) {
                    audioParts.push(inlineData.data);

                    if (
                      typeof inlineData.mimeType === "string" &&
                      inlineData.mimeType
                    ) {
                      audioMimeType = inlineData.mimeType;
                    }
                  }
                }

                if (message?.serverContent?.turnComplete === true) {
                  if (audioParts.length === 0) {
                    finish({
                      success: false,
                      type: "live_voice_audio_not_returned",
                      model: this.model,
                      ...security,
                      failClosed: true
                    });
                    return;
                  }

                  finish({
                    success: true,
                    type: "live_voice_audio_ready",
                    model: this.model,
                    audio: {
                      data: audioParts.join(""),
                      mimeType:
                        audioMimeType ||
                        "audio/pcm"
                    },
                    ...security,
                    failClosed: false
                  });
                }
              },
              onerror: (error) => {
                finish({
                  success: false,
                  type: "live_voice_provider_error",
                  model: this.model,
                  error:
                    error?.message ||
                    "live_voice_provider_error",
                  ...security,
                  failClosed: true
                });
              },
              onclose: () => {
                if (!settled) {
                  finish({
                    success: false,
                    type: "live_voice_connection_closed",
                    model: this.model,
                    ...security,
                    failClosed: true
                  });
                }
              }
            }
          });

          session.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: input
                  }
                ]
              }
            ],
            turnComplete: true
          });
        } catch (error) {
          finish({
            success: false,
            type: "live_voice_connection_error",
            model: this.model,
            error:
              error?.message ||
              "live_voice_connection_error",
            ...security,
            failClosed: true
          });
        }
      });

      return result;
    } finally {
      if (session && typeof session.close === "function") {
        try {
          session.close();
        } catch (_) {
          // Cleanup must not replace the primary result.
        }
      }
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
      externalExecution: false,
      actionExecution: "presentation_only"
    };
  }
}

module.exports = GeminiLiveAdapter;

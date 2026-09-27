"use strict";

const { GoogleGenAI } = require("@google/genai");

class GeminiInteractionsAdapter {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
    this.model =
      options.model ||
      process.env.GEMINI_INTERACTIONS_MODEL ||
      "gemini-3.8-flash";

    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY_REQUIRED");
    }

    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async execute(prompt, options = {}) {
    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new Error("PROMPT_REQUIRED");
    }

    const request = {
      model: this.model,
      input: prompt.trim(),
    };

    if (
      typeof options.previousInteractionId === "string" &&
      options.previousInteractionId.trim()
    ) {
      request.previous_interaction_id =
        options.previousInteractionId.trim();
    }

    const interaction = await this.client.interactions.create(request);

    return {
      success: true,
      type: "gemini_interaction_response",
      interactionId: interaction.id || null,
      status: interaction.status || null,
      text:
        typeof interaction.output_text === "string"
          ? interaction.output_text
          : "",
      model: interaction.model || this.model,
    };
  }
}

module.exports = { GeminiInteractionsAdapter };

"use strict";

const GeminiAdapter = require("./connectors/adapters/gemini-adapter");

const gemini = new GeminiAdapter();

/*
 * Compatibility facade.
 *
 * The old askGemini() API is preserved for existing callers,
 * but the Gemini implementation now lives only in GeminiAdapter.
 * No second GoogleGenAI client or duplicate system prompt exists here.
 */
async function askGemini(prompt) {
  const result = await gemini.execute({ prompt });

  if (!result.success) {
    throw new Error(result.message || "Gemini execution failed.");
  }

  return result.text || "";
}

module.exports = { askGemini };

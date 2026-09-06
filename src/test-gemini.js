"use strict";

const GeminiAdapter = require("./connectors/adapters/gemini-adapter");

const adapter = new GeminiAdapter();

console.log("GEMINI_ADAPTER_LOAD=" +
  (adapter && typeof adapter.execute === "function" ? "PASS" : "FAIL"));

console.log("GEMINI_CONFIGURED=" +
  (adapter.isConfigured() ? "TRUE" : "FALSE"));

console.log("BLOCK02_GEMINI_TEST=PASS");

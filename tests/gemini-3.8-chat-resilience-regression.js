"use strict";

const Runtime = require("../src/core/runtime");

async function main() {
  const runtime = new Runtime();

  let attempts = 0;

  runtime.geminiAdapter = {
    async execute() {
      attempts += 1;

      if (attempts <= 2) {
        return {
          success: false,
          type: "gemini_api_error",
          connector: "gemini",
          model: "gemini-3.8-flash",
          status: 503,
          retryable: true,
          message: "synthetic transient failure"
        };
      }

      return {
        success: true,
        type: "gemini_response",
        connector: "gemini",
        model: "gemini-3.8-flash",
        text: "synthetic Gemini 3.8 response"
      };
    }
  };

  const result = await runtime.chat("اختبار استجابة Gemini");

  const checks = {
    attemptsThree: attempts === 3,
    success: result.success === true,
    responseType: result.type === "conversation_response",
    conversationIntent: result.intent === "conversation",
    executionBlocked: result.executionAllowed === false,
    externalExecutionBlocked: result.externalExecution === false,
    textPreserved:
      result.text === "synthetic Gemini 3.8 response",
    resilienceHistory:
      runtime.geminiResilience.getHistory(1).length === 1,
    retried:
      runtime.geminiResilience.getHistory(1)[0]?.retried === true,
    resilienceAttempts:
      runtime.geminiResilience.getHistory(1)[0]?.attempts === 3
  };

  for (const [key, value] of Object.entries(checks)) {
    console.log(
      key.toUpperCase() +
      "=" +
      (value ? "PASS" : "FAIL")
    );
  }

  const passed = Object.values(checks).every(Boolean);

  console.log(
    "GEMINI_3_8_CHAT_RETRY_REGRESSION=" +
    (passed ? "PASS" : "FAIL")
  );

  if (!passed) {
    throw new Error("GEMINI_3_8_CHAT_RETRY_REGRESSION_FAILED");
  }
}

main().catch((error) => {
  console.error(
    "TEST_ERROR=" +
    String(error && error.message ? error.message : error)
  );
  process.exitCode = 1;
});

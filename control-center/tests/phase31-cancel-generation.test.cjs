const fs = require("fs");
const assert = require("assert");

const root = process.cwd();
const api = fs.readFileSync(
  "control-center/src/api.ts",
  "utf8"
);
const app = fs.readFileSync(
  "control-center/src/App.tsx",
  "utf8"
);

assert(
  /export async function chat\([\s\S]*?options: Record<string, unknown> = \{\}/.test(api),
  "chat API must remain callable with options"
);

assert(
  /options\.signal instanceof AbortSignal/.test(api),
  "chat API must accept an AbortSignal"
);

assert(
  /signal\?\.aborted/.test(api),
  "aborted chat requests must stop retrying"
);

assert(
  /url: `\$\{API_BASE\}\/chat\/cancel`/.test(api),
  "cancelChat must target the chat-only cancel endpoint"
);

assert(
  /export async function cancelChat\(/.test(api),
  "cancelChat API boundary must exist"
);

assert(
  /new AbortController\(\)/.test(app),
  "App must create a per-chat AbortController"
);

assert(
  /\.abort\(\)/.test(app),
  "App must expose explicit chat cancellation"
);

assert(
  /cancelChatGeneration/.test(app),
  "App must expose a dedicated cancel handler"
);

assert(
  /signal: chatAbortController\.signal/.test(app),
  "AbortSignal must be scoped to chat() only"
);

assert(
  /createChatApproval\(prompt\)/.test(app),
  "Approval must remain outside chat cancellation signal"
);

assert(
  /executeApprovedChat\(/.test(app),
  "Execution Gateway must remain present"
);

assert(
  !/createChatApproval\([^)]*signal/.test(app),
  "Approval must not receive chat AbortSignal"
);

assert(
  !/executeApprovedChat\([^)]*signal/.test(app),
  "Execution must not receive chat AbortSignal"
);

console.log("PASS=CANCEL_GENERATION_SOURCE_GATE");


// Focused behavioral verification:
// cancel-before-chat must fail closed and must not invoke inference.
// This validates the actual Runtime boundary rather than only source text.
(async () => {
  const Runtime = require("../../src/core/runtime");

  const runtime = new Runtime(process.cwd());

  let inferenceCalls = 0;

  runtime.agentsOrchestrator = {
    run: async () => {
      inferenceCalls += 1;
      return {
        success: true,
        text: "UNEXPECTED_INFERENCE"
      };
    }
  };

  runtime.geminiAdapter = {
    execute: async () => {
      inferenceCalls += 1;
      return {
        success: true,
        text: "UNEXPECTED_GEMINI"
      };
    }
  };

  const requestId = `cancel-test-${Date.now()}`;

  const cancelResult =
    await runtime.cancelChat(requestId);

  assert.strictEqual(
    cancelResult.success,
    true,
    "CANCEL_BEFORE_CHAT_FAILED"
  );

  assert.strictEqual(
    cancelResult.type,
    "chat_generation_cancelled",
    "CANCEL_RESULT_TYPE_INVALID"
  );

  assert.strictEqual(
    cancelResult.cancelled,
    true,
    "CANCEL_RESULT_FLAG_MISSING"
  );

  const chatResult =
    await runtime.chat(
      "اختبار إلغاء التوليد",
      {
        requestId
      }
    );

  assert.strictEqual(
    chatResult.success,
    false,
    "CANCELLED_CHAT_MUST_FAIL"
  );

  assert.strictEqual(
    chatResult.type,
    "chat_generation_cancelled",
    "CANCELLED_CHAT_RESULT_INVALID"
  );

  assert.strictEqual(
    chatResult.cancelled,
    true,
    "CANCELLED_CHAT_FLAG_MISSING"
  );

  assert.strictEqual(
    inferenceCalls,
    0,
    "CANCELLED_CHAT_INVOKED_INFERENCE"
  );

  // Smart Retry with the same requestId must remain cancelled
  // and must not invoke inference.
  const retryResult =
    await runtime.chat(
      "اختبار إلغاء التوليد",
      {
        requestId
      }
    );

  assert.strictEqual(
    retryResult.type,
    "chat_generation_cancelled",
    "CANCELLED_SMART_RETRY_REOPENED_REQUEST"
  );

  assert.strictEqual(
    inferenceCalls,
    0,
    "CANCELLED_SMART_RETRY_INVOKED_INFERENCE"
  );

  // Approval/execution objects remain independent of chat cancellation.
  assert(
    typeof runtime.createChatApproval === "function",
    "CREATE_CHAT_APPROVAL_MISSING"
  );

  assert(
    typeof runtime.executeApprovedChat === "function",
    "EXECUTE_APPROVED_CHAT_MISSING"
  );

  console.log("PASS=RUNTIME_CANCEL_BEHAVIOR");
  console.log("PASS=CANCEL_BEFORE_CHAT_FAIL_CLOSED");
  console.log("PASS=CANCELLED_SMART_RETRY_STAYS_CANCELLED");
  console.log("PASS=APPROVAL_EXECUTION_BOUNDARY_RUNTIME");
})().catch((error) => {
  console.error(
    "FAIL=RUNTIME_CANCEL_BEHAVIOR:" +
      (error && error.message
        ? error.message
        : String(error))
  );
  process.exitCode = 1;
});

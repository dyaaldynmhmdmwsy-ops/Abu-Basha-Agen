"use strict";

const assert = require("assert");
const Runtime = require("../src/core/runtime");
const ApiBoundary = require("../src/api");

(async () => {
  const runtime = new Runtime();
  const api = new ApiBoundary(runtime);

  assert.strictEqual(
    typeof api.createChatApproval,
    "function",
    "API_CHAT_APPROVAL_METHOD_MISSING"
  );

  assert.strictEqual(
    typeof api.executeApprovedChat,
    "function",
    "API_CHAT_EXECUTION_METHOD_MISSING"
  );

  const request = api.createChatApproval(
    "مرحبا، أريد مساعدة في كتابة فكرة محتوى.",
    {
      target: "user",
      sessionId: "phase22-chat-regression",
      correlationId: "phase22-chat-regression"
    }
  );

  assert.strictEqual(
    request.success,
    true,
    "CHAT_APPROVAL_REQUEST_FAILED"
  );

  assert.strictEqual(
    request.type,
    "chat_approval_required",
    "CHAT_APPROVAL_TYPE_FAILED"
  );

  assert.strictEqual(
    request.approvalRequired,
    true,
    "CHAT_APPROVAL_REQUIRED_FAILED"
  );

  assert.strictEqual(
    request.approved,
    false,
    "CHAT_MUST_START_UNAPPROVED"
  );

  assert.strictEqual(
    request.executionAllowed,
    false,
    "CHAT_MUST_START_BLOCKED"
  );

  assert.strictEqual(
    request.autonomousExecution,
    false,
    "CHAT_AUTONOMOUS_EXECUTION_ENABLED"
  );

  assert.strictEqual(
    request.externalExecution,
    false,
    "CHAT_EXTERNAL_EXECUTION_EXPOSED"
  );

  assert.ok(
    request.approval && request.approval.id,
    "CHAT_APPROVAL_ID_MISSING"
  );

  assert.strictEqual(
    request.approval.status,
    "pending_approval",
    "CHAT_APPROVAL_INITIAL_STATE_FAILED"
  );

  const blocked = await api.executeApprovedChat(
    request.approval.id,
    "مرحبا، أريد مساعدة في كتابة فكرة محتوى.",
    {
      sessionId: "phase22-chat-regression",
      correlationId: "phase22-chat-regression"
    }
  );

  assert.strictEqual(
    blocked.success,
    false,
    "CHAT_EXECUTION_BYPASSED_APPROVAL"
  );

  assert.strictEqual(
    blocked.type,
    "approval_required",
    "CHAT_PREAPPROVAL_BLOCK_TYPE_FAILED"
  );

  assert.strictEqual(
    blocked.executionAllowed,
    false,
    "CHAT_PREAPPROVAL_EXECUTION_ALLOWED"
  );

  const metadata = api.getMetadata();

  assert.strictEqual(
    metadata.execution.directExecution,
    false,
    "API_DIRECT_EXECUTION_CHANGED"
  );

  assert.strictEqual(
    metadata.execution.externalExecution,
    false,
    "API_EXTERNAL_EXECUTION_CHANGED"
  );

  assert.strictEqual(
    metadata.execution.autonomousExecution,
    false,
    "API_AUTONOMOUS_EXECUTION_CHANGED"
  );

  assert.strictEqual(
    metadata.execution.requiresApproval,
    true,
    "API_APPROVAL_REQUIREMENT_CHANGED"
  );

  console.log("API_CHAT_APPROVAL=PASS");
  console.log("CHAT_APPROVAL_STATE=pending_approval");
  console.log("API_CHAT_EXECUTION=PASS");
  console.log("PRE_APPROVAL_EXECUTION=BLOCKED");
  console.log("DIRECT_EXECUTION=BLOCKED");
  console.log("EXTERNAL_EXECUTION=BLOCKED");
  console.log("AUTONOMOUS_EXECUTION=DISABLED");
  console.log("APPROVAL_REQUIRED=YES");
  console.log("NETWORK_CALL=NOT_PERFORMED");
  console.log("SECRET_VALUES=NOT_PRINTED");
  console.log("PHASE22_CHAT_API_REGRESSION=PASS");
})().catch(error => {
  console.error("PHASE22_CHAT_API_REGRESSION=FAIL");
  console.error(
    "ERROR=" +
      String(
        error && error.message
          ? error.message
          : error
      ).slice(0, 300)
  );
  process.exitCode = 1;
});

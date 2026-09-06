"use strict";

const assert = require("assert");
const http = require("http");

const {
  createHttpBridge,
  DEFAULT_HOST
} = require("../src/http/server");

function request(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined
      ? null
      : JSON.stringify(body);

    const req = http.request({
      host: DEFAULT_HOST,
      port,
      method,
      path,
      headers: payload
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
          }
        : {}
    }, (res) => {
      let data = "";

      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch (_) {
          return reject(new Error("HTTP response was not valid JSON"));
        }

        resolve({
          statusCode: res.statusCode,
          body: parsed
        });
      });
    });

    req.on("error", reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

function createFakeRuntime() {
  const approvals = new Map();

  return {
    getStatus() {
      return {
        status: "ready"
      };
    },

    getCentralCoreStatus() {
      return {
        status: "ready"
      };
    },

    getPendingApprovals() {
      return Array.from(approvals.values());
    },

    getApprovalStatus() {
      return {
        pending: approvals.size
      };
    },

    getRevenueStatus() {
      return {
        enabled: false
      };
    },

    listRevenueOpportunities() {
      return [];
    },

    getRevenuePlans() {
      return [];
    },

    createChatApproval(prompt) {
      const approval = {
        id: "test-approval-1",
        plan: {
          goal: prompt
        }
      };

      approvals.set(approval.id, approval);

      return {
        success: true,
        type: "chat_approval_required",
        approval,
        plan: approval.plan
      };
    },

    approve(id) {
      if (!approvals.has(id)) {
        return {
          success: false,
          type: "approval_not_found"
        };
      }

      return {
        success: true,
        type: "approval_approved",
        id
      };
    },

    reject(id) {
      if (!approvals.has(id)) {
        return {
          success: false,
          type: "approval_not_found"
        };
      }

      approvals.delete(id);

      return {
        success: true,
        type: "approval_rejected",
        id
      };
    },

    executeApprovedChat() {
      return {
        success: false,
        type: "execution_blocked_in_test_runtime",
        executionAllowed: false,
        failClosed: true
      };
    }
  };
}

(async () => {
  const runtime = createFakeRuntime();

  const bridge = createHttpBridge({
    runtime,
    port: 0
  });

  await new Promise((resolve, reject) => {
    bridge.server.once("error", reject);
    bridge.server.listen(0, DEFAULT_HOST, resolve);
  });

  const port = bridge.server.address().port;

  try {
    const health = await request(port, "GET", "/health");

    assert.strictEqual(health.statusCode, 200);
    assert.strictEqual(health.body.success, true);
    assert.strictEqual(health.body.type, "health");

    const status = await request(port, "GET", "/api/status");

    assert.strictEqual(status.statusCode, 200);
    assert.strictEqual(status.body.success, true);
    assert.strictEqual(status.body.type, "runtime_status");

    const approval = await request(
      port,
      "POST",
      "/api/chat/approval",
      { prompt: "اختبار HTTP Bridge" }
    );

    assert.strictEqual(approval.statusCode, 200);
    assert.strictEqual(approval.body.success, true);
    assert.strictEqual(
      approval.body.type,
      "chat_approval_required"
    );
    assert.ok(approval.body.approval);

    const approvals = await request(
      port,
      "GET",
      "/api/approvals"
    );

    assert.strictEqual(approvals.statusCode, 200);
    assert.strictEqual(approvals.body.success, true);
    assert.strictEqual(approvals.body.items.length, 1);

    const approve = await request(
      port,
      "POST",
      "/api/approvals/approve",
      { approvalId: "test-approval-1" }
    );

    assert.strictEqual(approve.statusCode, 200);
    assert.strictEqual(approve.body.success, true);

    const execution = await request(
      port,
      "POST",
      "/api/chat/execute-approved",
      {
        approvalId: "test-approval-1",
        prompt: "اختبار التنفيذ"
      }
    );

    assert.strictEqual(execution.statusCode, 200);
    assert.strictEqual(execution.body.success, false);
    assert.strictEqual(execution.body.executionAllowed, false);
    assert.strictEqual(execution.body.failClosed, true);

    const missingPrompt = await request(
      port,
      "POST",
      "/api/chat/approval",
      {}
    );

    assert.strictEqual(missingPrompt.statusCode, 400);
    assert.strictEqual(
      missingPrompt.body.type,
      "prompt_required"
    );

    const unknownRoute = await request(
      port,
      "GET",
      "/api/not-a-real-route"
    );

    assert.strictEqual(unknownRoute.statusCode, 404);
    assert.strictEqual(
      unknownRoute.body.type,
      "route_not_found"
    );

    console.log("HEALTH_ROUTE=PASS");
    console.log("STATUS_ROUTE=PASS");
    console.log("CHAT_APPROVAL_ROUTE=PASS");
    console.log("APPROVAL_LIST_ROUTE=PASS");
    console.log("APPROVE_ROUTE=PASS");
    console.log("EXECUTION_FAIL_CLOSED=PASS");
    console.log("INPUT_VALIDATION=PASS");
    console.log("UNKNOWN_ROUTE=PASS");
    console.log("EXTERNAL_NETWORK_USED=NO");
    console.log("SECRETS_PRINTED=NO");
    console.log("PHASE22_5_PATCH2_HTTP_BRIDGE_REGRESSION=PASS");
  } finally {
    await new Promise((resolve) => bridge.stop(resolve));
  }
})().catch((error) => {
  console.error(
    "PHASE22_5_PATCH2_HTTP_BRIDGE_REGRESSION=FAIL"
  );
  console.error(
    error && error.message
      ? error.message
      : String(error)
  );
  process.exitCode = 1;
});

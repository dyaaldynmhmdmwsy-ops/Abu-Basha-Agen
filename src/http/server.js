"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const ApiBoundary = require("../api");
const { createAgent } = require("../index");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const MAX_BODY_BYTES = 1024 * 1024;

const STATIC_ROOT = path.resolve(__dirname, "../../control-center/dist");

const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
});

function staticResponse(res, filePath) {
  const relative = String(filePath || "").replaceAll("\\", "/");
  const absolute = path.resolve(STATIC_ROOT, "." + "/" + relative);

  if (!absolute.startsWith(STATIC_ROOT + path.sep)) {
    return errorResponse(res, 403, "static_path_forbidden");
  }

  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return errorResponse(res, 404, "static_file_not_found");
  }

  const body = fs.readFileSync(absolute);
  const type = CONTENT_TYPES[path.extname(absolute).toLowerCase()] ||
    "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  });

  res.end(body);
}

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });

  res.end(body);
}

function errorResponse(res, statusCode, type) {
  return jsonResponse(res, statusCode, {
    success: false,
    type,
    failClosed: true
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;

      if (total > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body too large"), {
          code: "BODY_TOO_LARGE"
        }));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (total === 0) {
        resolve({});
        return;
      }

      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(text));
      } catch (_) {
        reject(Object.assign(new Error("Invalid JSON"), {
          code: "INVALID_JSON"
        }));
      }
    });

    req.on("error", reject);
  });
}

function normalizePath(url) {
  try {
    return new URL(url || "/", "http://127.0.0.1").pathname;
  } catch (_) {
    return null;
  }
}

function createHttpBridge(options = {}) {
  const runtime = options.runtime || (
    typeof options.agentFactory === "function"
      ? options.agentFactory().runtime
      : createAgent().runtime
  );

  const api = options.apiBoundary || new ApiBoundary(runtime);

  async function handle(req, res) {
    const path = normalizePath(req.url);
    const method = String(req.method || "GET").toUpperCase();

    if (!path) {
      return errorResponse(res, 400, "invalid_path");
    }

    try {
      if (method === "GET" && path === "/health") {
        return jsonResponse(res, 200, {
          success: true,
          type: "health",
          status: "ok"
        });
      }

      if (method === "GET" && path === "/") {
        return staticResponse(res, "index.html");
      }

      if (method === "GET" && path.startsWith("/assets/")) {
        return staticResponse(res, path.slice(1));
      }

      if (method === "GET" && path === "/api/status") {
        return jsonResponse(res, 200, api.getStatus());
      }

      if (method === "GET" && path === "/api/core/status") {
        return jsonResponse(res, 200, api.getCentralCoreStatus());
      }

      if (method === "GET" && path === "/api/approvals") {
        return jsonResponse(res, 200, api.getPendingApprovals());
      }

      if (method === "GET" && path === "/api/approvals/status") {
        return jsonResponse(res, 200, api.getApprovalStatus());
      }

      if (method === "GET" && path === "/api/plans/status") {
      return jsonResponse(res, 200, api.getPlanRegistryStatus());
    }

    if (method === "GET" && path === "/api/execution/status") {
      return jsonResponse(res, 200, api.getExecutionStatus());
    }

    if (method === "GET" && path === "/api/execution/history") {
      return jsonResponse(res, 200, api.getExecutionHistory());
    }
    if (method === "GET" && path === "/api/diagnostic/status") {
      return jsonResponse(res, 200, api.getDiagnosticStatus());
    }

    if (method === "GET" && path === "/api/diagnostic/report") {
      return jsonResponse(res, 200, api.getDiagnosticReport());
    }

    if (method === "POST" && path === "/api/diagnostic/run") {
      const body = await readJsonBody(req);
      const options =
        body && typeof body === "object" && !Array.isArray(body)
          ? body.options || {}
          : {};

      const result = await api.runDiagnostic(options);
      return jsonResponse(res, 200, result);
    }


    if (method === "GET" && path === "/api/revenue/status") {
        return jsonResponse(res, 200, api.getRevenueStatus());
      }

      if (method === "GET" && path === "/api/revenue/opportunities") {
        return jsonResponse(res, 200, api.listRevenueOpportunities());
      }

      if (method === "GET" && path === "/api/revenue/plans") {
        return jsonResponse(res, 200, api.getRevenuePlans());
      }

      if (method === "POST" && path === "/api/revenue/plans") {
        const body = await readJsonBody(req);

        const opportunityId =
          typeof body.opportunityId === "string"
            ? body.opportunityId.trim()
            : "";

        const target =
          typeof body.target === "string" && body.target.trim()
            ? body.target.trim()
            : "online";

        if (!opportunityId) {
          return errorResponse(
            res,
            400,
            "revenue_opportunity_id_required"
          );
        }

        const result = api.createRevenuePlanWithApproval(
          opportunityId,
          target
        );

        if (!result || result.success !== true) {
          return jsonResponse(res, 400, result || {
            success: false,
            type: "revenue_plan_approval_failed",
            failClosed: true
          });
        }

        return jsonResponse(res, 200, result);
      }

      if (method === "GET" && path === "/api/metadata") {
        return jsonResponse(res, 200, api.getMetadata());
      }

      if (method === "POST" && path === "/api/developer/approval") {
        const body = await readJsonBody(req);

        const task =
          typeof body.task === "string"
            ? body.task.trim()
            : "";

        if (!task) {
          return errorResponse(res, 400, "developer_task_required");
        }

        const result = api.createDeveloperApproval({ task });

        return jsonResponse(
          res,
          result && result.success === true ? 200 : 400,
          result || {
            success: false,
            type: "developer_approval_failed",
            failClosed: true
          }
        );
      }

      if (
      method === "POST" &&
      path === "/api/developer/execute-approved"
    ) {
      const body = await readJsonBody(req);
      const approvalId =
        typeof body.approvalId === "string"
          ? body.approvalId.trim()
          : "";

      if (!approvalId) {
        return errorResponse(res, 400, "approval_id_required");
      }

      const result = await api.executeApprovedDeveloper(approvalId);

      return jsonResponse(
        res,
        result && result.success === true ? 200 : 400,
        result || {
          success: false,
          type: "developer_execution_failed",
          executionAllowed: false,
          failClosed: true
        }
      );
    }

    if (
      method === "POST" &&
      path === "/api/voice/synthesize"
    ) {
      const body = await readJsonBody(req);

      const text =
        typeof body.text === "string"
          ? body.text.trim()
          : "";

      if (!text) {
        return errorResponse(
          res,
          400,
          "tts_text_required"
        );
      }

      const result = await api.synthesizeVoice(
        text,
        body.options || {}
      );

      return jsonResponse(
        res,
        result && result.success === true ? 200 : 400,
        result || {
          success: false,
          type: "tts_failed",
          executionAllowed: false,
          externalExecution: false,
          actionExecution: "presentation_only",
          requiresApproval: true,
          failClosed: true
        }
      );
    }

    if (method === "POST" && path === "/api/chat") {
        const body = await readJsonBody(req);
        const prompt = typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

        if (!prompt) {
          return errorResponse(res, 400, "prompt_required");
        }

        const result = await api.chat(
          prompt,
          body.options || {}
        );

        return jsonResponse(res, 200, result);
      }

      if (method === "POST" && path === "/api/chat/approval") {
        const body = await readJsonBody(req);
        const prompt = typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

        if (!prompt) {
          return errorResponse(res, 400, "prompt_required");
        }

        const result = api.createChatApproval(prompt, body.options || {});
        return jsonResponse(res, 200, result);
      }

      if (method === "POST" && path === "/api/approvals/approve") {
        const body = await readJsonBody(req);
        const approvalId = typeof body.approvalId === "string"
          ? body.approvalId.trim()
          : "";

        if (!approvalId) {
          return errorResponse(res, 400, "approval_id_required");
        }

        const result = api.approve(approvalId);
        return jsonResponse(res, 200, result);
      }

      if (method === "POST" && path === "/api/approvals/reject") {
        const body = await readJsonBody(req);
        const approvalId = typeof body.approvalId === "string"
          ? body.approvalId.trim()
          : "";

        if (!approvalId) {
          return errorResponse(res, 400, "approval_id_required");
        }

        const result = api.reject(approvalId);
        return jsonResponse(res, 200, result);
      }

      if (method === "POST" && path === "/api/chat/execute-approved") {
        const body = await readJsonBody(req);

        const approvalId = typeof body.approvalId === "string"
          ? body.approvalId.trim()
          : "";

        const prompt = typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

        if (!approvalId || !prompt) {
          return errorResponse(res, 400, "approval_id_and_prompt_required");
        }

        const result = await api.executeApprovedChat(
          approvalId,
          prompt,
          body.options || {}
        );

        return jsonResponse(res, 200, result);
      }

      return errorResponse(res, 404, "route_not_found");
    } catch (error) {
      if (error && error.code === "BODY_TOO_LARGE") {
        return errorResponse(res, 413, "request_body_too_large");
      }

      if (error && error.code === "INVALID_JSON") {
        return errorResponse(res, 400, "invalid_json");
      }

      return errorResponse(res, 500, "http_bridge_internal_error");
    }
  }

  const server = http.createServer((req, res) => {
    Promise.resolve(handle(req, res)).catch(() => {
      if (!res.headersSent) {
        errorResponse(res, 500, "http_bridge_internal_error");
      } else {
        res.destroy();
      }
    });
  });

  return {
    server,
    api,
    runtime,
    host: options.host || DEFAULT_HOST,
    port: Number(options.port ?? DEFAULT_PORT),

    start(callback) {
      server.listen(this.port, this.host, callback);
    },

    stop(callback) {
      if (!server.listening) {
        if (typeof callback === "function") callback();
        return;
      }

      server.close(callback);
    }
  };
}

module.exports = {
  createHttpBridge,
  MAX_BODY_BYTES,
  DEFAULT_HOST,
  DEFAULT_PORT
};

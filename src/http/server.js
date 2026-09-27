"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const ApiBoundary = require("../api");
const { createAgent } = require("../index");
const { createAgentGateway } = require("./agent-gateway");
const { GeminiInteractionsAdapter } = require("../connectors/adapters/gemini-interactions-adapter");
const { AgentHarness } = require("../core/agent-harness");

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

async function readJsonBodyWithLimit(req, maxBytes) {
  return await new Promise((resolve, reject) => {
    let total = 0;
    let text = "";
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.setEncoding("utf8");

    req.on("data", (chunk) => {
      if (settled) return;

      total += Buffer.byteLength(chunk, "utf8");

      if (total > maxBytes) {
        fail(new Error("Request body exceeds the allowed limit."));
        req.destroy();
        return;
      }

      text += chunk;
    });

    req.on("end", () => {
      if (settled) return;

      try {
        settled = true;
        resolve(JSON.parse(text || "{}"));
      } catch (error) {
        fail(error);
      }
    });

    req.on("error", fail);
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
  const agentHarness =
    options.agentHarness ||
    options.harness ||
    new AgentHarness({
      provider:
        options.provider ||
        new GeminiInteractionsAdapter(),
    });
  const agentGateway = createAgentGateway({
    harness: agentHarness,
  });

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

    if (method === "POST" && path === "/api/settings/update") {
      const result = api.updateSettings(
        body && body.patch,
        {
          source: "control-center",
          approved: false,
          externalExecution: false
        }
      );

      return sendJson(
        res,
        result && result.success ? 200 : 400,
        result
      );
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

    if (method === "GET" && path === "/api/settings") {
      return sendJson(res, 200, api.getSettings());
    }

      if (method === "GET" && path === "/api/project-workspaces/status") {
      const result =
        typeof api.getProjectWorkspaceStatus === "function"
          ? api.getProjectWorkspaceStatus()
          : {
              success: false,
              type: "project_workspace_unavailable",
              failClosed: true
            };

      return jsonResponse(
        res,
        result && result.success === false ? 400 : 200,
        result
      );
    }

    if (method === "GET" && path === "/api/project-workspaces") {
      const type =
        typeof req.url === "string"
          ? new URL(req.url, "http://127.0.0.1").searchParams.get("type")
          : null;

      const result =
        typeof api.listProjectWorkspaces === "function"
          ? api.listProjectWorkspaces(type || null)
          : {
              success: false,
              type: "project_workspace_unavailable",
              failClosed: true
            };

      return jsonResponse(
        res,
        result && result.success === false ? 400 : 200,
        result
      );
    }

    if (method === "GET" && path.startsWith("/api/project-workspaces/")) {
      const id = path.slice("/api/project-workspaces/".length).trim();

      if (!id || id === "status") {
        return errorResponse(res, 400, "project_workspace_id_required");
      }

      const result =
        typeof api.getProjectWorkspace === "function"
          ? api.getProjectWorkspace(id)
          : {
              success: false,
              type: "project_workspace_unavailable",
              failClosed: true
            };

      return jsonResponse(
        res,
        result && result.success === false ? 400 : 200,
        result
      );
    }

    if (method === "POST" && path === "/api/development-pipeline/approval") {
      const body = await readJsonBody(req);
      return sendJson(
        res,
        200,
        api.createDevelopmentPipelineApproval(body || {})
      );
    }

    if (method === "POST" && path === "/api/development-pipeline/execute-approved") {
      const body = await readJsonBody(req);
      return sendJson(
        res,
        200,
        await api.executeApprovedDevelopmentPipeline(
          body?.approvalId
        )
      );
    }

    if (method === "POST" && path === "/api/project-workspaces") {
      const body = await readJsonBody(req);
      const request =
        body && typeof body === "object" && !Array.isArray(body)
          ? body
          : {};

      const result =
        typeof api.createProjectWorkspace === "function"
          ? api.createProjectWorkspace(request)
          : {
              success: false,
              type: "project_workspace_unavailable",
              failClosed: true
            };

      return jsonResponse(
        res,
        result && result.success === true ? 200 : 400,
        result || {
          success: false,
          type: "project_workspace_creation_failed",
          failClosed: true
        }
      );
    }

    if (
      method === "GET" &&
      path === "/api/development-pipeline/status"
    ) {
      const result =
        typeof api.getDevelopmentPipelineStatus === "function"
          ? api.getDevelopmentPipelineStatus()
          : {
              success: false,
              type: "development_pipeline_unavailable",
              failClosed: true
            };

      return sendJson(res, 200, result);
    }

    if (
      method === "GET" &&
      path === "/api/development-pipeline"
    ) {
      const url = new URL(req.url, "http://127.0.0.1");
      const rawLimit = Number(url.searchParams.get("limit") || "50");
      const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(Math.floor(rawLimit), 100))
        : 50;

      const result =
        typeof api.listDevelopmentPipelineRequests === "function"
          ? api.listDevelopmentPipelineRequests(limit)
          : {
              success: false,
              type: "development_pipeline_unavailable",
              failClosed: true
            };

      return sendJson(res, 200, result);
    }

    if (
      method === "GET" &&
      path.startsWith("/api/development-pipeline/")
    ) {
      const id = path
        .slice("/api/development-pipeline/".length)
        .trim();

      if (!id || id === "status") {
        return sendJson(res, 400, {
          success: false,
          type: "invalid_pipeline_request_id",
          failClosed: true
        });
      }

      const result =
        typeof api.getDevelopmentPipelineRequest === "function"
          ? api.getDevelopmentPipelineRequest(id)
          : {
              success: false,
              type: "development_pipeline_unavailable",
              failClosed: true
            };

      return sendJson(res, result.success ? 200 : 404, result);
    }

    if (
      method === "POST" &&
      path === "/api/development-pipeline"
    ) {
      const body = await readJson(req);

      const result =
        typeof api.createDevelopmentPipelineRequest === "function"
          ? api.createDevelopmentPipelineRequest(body || {})
          : {
              success: false,
              type: "development_pipeline_unavailable",
              failClosed: true
            };

      return sendJson(res, result.success ? 201 : 400, result);
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

      const options =
        body &&
        body.options &&
        typeof body.options === "object"
          ? body.options
          : {};

      const messageId =
        typeof options.messageId === "string"
          ? options.messageId.trim()
          : "";

      if (!messageId) {
        return errorResponse(
          res,
          400,
          "tts_message_id_required"
        );
      }

      const result = await api.synthesizeVoice(
        text,
        {
          ...options,
          messageId
        }
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

    if (method === "POST" && path === "/api/agent/run") {
      const body = await readJsonBody(req);
      const result = await agentGateway.run(body);
      return jsonResponse(res, result.statusCode, result.body);
    }

    if (method === "POST" && path === "/api/voice/transcribe") {
      let tempAudioPath = null;

      try {
        /*
         * STT transport contract:
         * {
         *   audio: {
         *     base64: "<audio bytes>",
         *     mimeType: "audio/mp4"
         *   },
         *   context: {}
         * }
         *
         * Client-supplied filePath is intentionally ignored.
         */

        const STT_MAX_RAW_BYTES = 8 * 1024 * 1024;
        const STT_MAX_JSON_BYTES = 12 * 1024 * 1024;

        const body = await readJsonBodyWithLimit(
          req,
          STT_MAX_JSON_BYTES
        );

        const audio = body && body.audio;

        if (!audio || typeof audio !== "object") {
          return jsonResponse(res, 400, {
            success: false,
            type: "stt_audio_required",
            message: "Audio payload is required.",
            executionAllowed: false,
            externalExecution: false,
            actionExecution: "plan_only",
            requiresApproval: true,
            failClosed: true,
          });
        }

        const base64 =
          typeof audio.base64 === "string"
            ? audio.base64.trim()
            : "";

        const mimeType =
          typeof audio.mimeType === "string"
            ? audio.mimeType.trim().toLowerCase()
            : "";

        const allowedMimeTypes = new Set([
          "audio/mp4",
          "audio/m4a",
          "audio/aac",
          "audio/x-m4a",
          "audio/mpeg",
          "audio/mp3",
          "audio/wav",
          "audio/webm",
          "audio/ogg",
        ]);

        if (!base64) {
          return jsonResponse(res, 400, {
            success: false,
            type: "stt_audio_base64_required",
            message: "Base64 audio payload is required.",
            executionAllowed: false,
            externalExecution: false,
            actionExecution: "plan_only",
            requiresApproval: true,
            failClosed: true,
          });
        }

        if (!allowedMimeTypes.has(mimeType)) {
          return jsonResponse(res, 415, {
            success: false,
            type: "stt_audio_mime_unsupported",
            message: "Unsupported audio MIME type.",
            executionAllowed: false,
            externalExecution: false,
            actionExecution: "plan_only",
            requiresApproval: true,
            failClosed: true,
          });
        }

        /*
         * Strict base64 validation.
         * Whitespace is rejected so malformed transport cannot be
         * silently normalized.
         */
        if (
          base64.length === 0 ||
          base64.length % 4 !== 0 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
        ) {
          return jsonResponse(res, 400, {
            success: false,
            type: "stt_audio_base64_invalid",
            message: "Invalid base64 audio payload.",
            executionAllowed: false,
            externalExecution: false,
            actionExecution: "plan_only",
            requiresApproval: true,
            failClosed: true,
          });
        }

        const audioBuffer = Buffer.from(base64, "base64");

        if (
          !audioBuffer ||
          audioBuffer.length === 0 ||
          audioBuffer.length > STT_MAX_RAW_BYTES
        ) {
          return jsonResponse(res, 413, {
            success: false,
            type: "stt_audio_size_invalid",
            message: "Audio payload exceeds the allowed size.",
            executionAllowed: false,
            externalExecution: false,
            actionExecution: "plan_only",
            requiresApproval: true,
            failClosed: true,
          });
        }

        const fs = require("node:fs/promises");
        const os = require("node:os");
        const pathModule = require("node:path");

        const tempDir = await fs.mkdtemp(
          pathModule.join(os.tmpdir(), "abu-basha-stt-")
        );

        const extensionByMime = {
          "audio/mp4": ".m4a",
          "audio/m4a": ".m4a",
          "audio/aac": ".aac",
          "audio/x-m4a": ".m4a",
          "audio/mpeg": ".mp3",
          "audio/mp3": ".mp3",
          "audio/wav": ".wav",
          "audio/webm": ".webm",
          "audio/ogg": ".ogg",
        };

        tempAudioPath = pathModule.join(
          tempDir,
          `input${extensionByMime[mimeType] || ".audio"}`
        );

        await fs.writeFile(tempAudioPath, audioBuffer, {
          flag: "wx",
          mode: 0o600,
        });

        const result = await api.transcribeVoice(
          {
            filePath: tempAudioPath,
            mimeType,
            source: "http_stt_transport",
          },
          body &&
          body.context &&
          typeof body.context === "object"
            ? body.context
            : {}
        );

        return jsonResponse(
          res,
          result && result.success === false ? 502 : 200,
          result
        );
      } catch (error) {
        return jsonResponse(res, 500, {
          success: false,
          type: "stt_http_failed",
          message:
            error instanceof Error
              ? error.message
              : "Voice transcription failed.",
          executionAllowed: false,
          externalExecution: false,
          actionExecution: "plan_only",
          requiresApproval: true,
          failClosed: true,
        });
      } finally {
        if (tempAudioPath) {
          try {
            const fs = require("node:fs/promises");
            const os = require("node:os");
            const pathModule = require("node:path");

            await fs.rm(
              pathModule.dirname(tempAudioPath),
              {
                recursive: true,
                force: true,
              }
            );
          } catch {
            /*
             * Cleanup failure is intentionally swallowed here.
             * The transcription result remains fail-closed at the
             * API boundary; no external execution is enabled.
             */
          }
        }
      }
    }

if (method === "POST" && path === "/api/chat/stream") {
      const body = await readJsonBody(req);
      const prompt =
        typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return errorResponse(
          res,
          400,
          "prompt_required"
        );
      }

      const chatOptions = {
        ...(body.options &&
        typeof body.options === "object"
          ? body.options
          : {})
      };

      if (
        typeof body.sessionId === "string" &&
        body.sessionId.trim()
      ) {
        chatOptions.sessionId =
          body.sessionId.trim();
      }

      if (
        typeof body.requestId === "string" &&
        body.requestId.trim()
      ) {
        chatOptions.requestId =
          body.requestId.trim();
      }

      if (
        !api ||
        typeof api.chatStream !== "function"
      ) {
        return errorResponse(
          res,
          503,
          "streaming_unavailable"
        );
      }

      res.statusCode = 200;
      res.setHeader(
        "Content-Type",
        "application/x-ndjson; charset=utf-8"
      );
      res.setHeader(
        "Cache-Control",
        "no-cache, no-transform"
      );
      res.setHeader(
        "X-Accel-Buffering",
        "no"
      );

      try {
        for await (
          const chunk of api.chatStream(
            prompt,
            chatOptions
          )
        ) {
          res.write(
            JSON.stringify(chunk) + "\n"
          );
        }
      } catch (error) {
        const failure = {
          success: false,
          type: "chat_stream_failed",
          intent: "conversation",
          approvalRequired: false,
          executionAllowed: false,
          externalExecution: false,
          failClosed: true,
          message:
            error?.message
              ? String(error.message)
              : String(error)
        };

        res.write(
          JSON.stringify(failure) + "\n"
        );
      }

      res.end();
      return;
    }

    if (method === "POST" && path === "/api/chat") {
        const body = await readJsonBody(req);
        const prompt = typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

        if (!prompt) {
          return errorResponse(res, 400, "prompt_required");
        }

        const chatOptions = {
          ...(body.options &&
          typeof body.options === "object"
            ? body.options
            : {})
        };

        if (
          typeof body.sessionId === "string" &&
          body.sessionId.trim()
        ) {
          chatOptions.sessionId =
            body.sessionId.trim();
        }

        if (
          typeof body.requestId === "string" &&
          body.requestId.trim()
        ) {
          chatOptions.requestId =
            body.requestId.trim();
        }

        const result = await api.chat(
          prompt,
          chatOptions
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

      if (method === "POST" && path === "/api/chat/cancel") {
        const requestId =
          body &&
          typeof body.requestId === "string"
            ? body.requestId.trim()
            : "";

        if (!requestId) {
          return jsonResponse(res, 400, {
            success: false,
            type: "invalid_chat_cancel_request",
            executionAllowed: false,
            externalExecution: false,
            failClosed: true,
            message: "معرّف طلب المحادثة مطلوب."
          });
        }

        const result = await api.cancelChat(requestId);
        return jsonResponse(res, result && result.success === false ? 400 : 200, result);
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

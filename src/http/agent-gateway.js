"use strict";

const { AgentHarness, HarnessError } = require("../core/agent-harness");

function createAgentGateway(options = {}) {
  const harness = options.harness;

  if (!harness || typeof harness.run !== "function") {
    throw new HarnessError(
      "HARNESS_REQUIRED",
      "Agent Gateway requires an AgentHarness instance."
    );
  }

  async function run(body = {}) {
    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return {
        statusCode: 400,
        body: {
          success: false,
          type: "agent_error",
          code: "PROMPT_REQUIRED",
          message: "prompt_required",
        },
      };
    }

    if (
      body.sessionId !== undefined &&
      (typeof body.sessionId !== "string" || !body.sessionId.trim())
    ) {
      return {
        statusCode: 400,
        body: {
          success: false,
          type: "agent_error",
          code: "INVALID_SESSION_ID",
          message: "invalid_session_id",
        },
      };
    }

    try {
      const result = await harness.run({
        prompt,
        sessionId: body.sessionId,
        options:
          body.options && typeof body.options === "object"
            ? body.options
            : {},
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          type: "agent_response",
          state: result.state,
          sessionId: result.sessionId,
          interactionId: result.interactionId || null,
          approvalRequired: result.approvalRequired === true,
          executionAllowed: result.executionAllowed === true,
          text: typeof result.text === "string" ? result.text : "",
          toolResults: Array.isArray(result.toolResults)
            ? result.toolResults
            : undefined,
        },
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          type: "agent_error",
          code: error.code || "AGENT_GATEWAY_ERROR",
          message: error.message || "agent_gateway_error",
        },
      };
    }
  }

  return Object.freeze({ run });
}

module.exports = { createAgentGateway };

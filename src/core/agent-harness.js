"use strict";

/**
 * Abu Basha Agent Harness
 *
 * Production boundary:
 *   Request
 *     -> Session
 *     -> Model Provider
 *     -> Tool Policy
 *     -> Approval
 *     -> Tool Execution
 *     -> Verification
 *     -> Audit
 *
 * The harness is provider-agnostic. Gemini/OpenAI/MCP providers
 * plug into the provider contract without changing the harness.
 */

const crypto = require("node:crypto");

const STATES = Object.freeze({
  RECEIVED: "received",
  THINKING: "thinking",
  WAITING_FOR_APPROVAL: "waiting_for_approval",
  EXECUTING: "executing",
  VERIFYING: "verifying",
  COMPLETED: "completed",
  FAILED: "failed",
});

class HarnessError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HarnessError";
    this.code = code;
    this.details = details;
  }
}

class AgentHarness {
  constructor(options = {}) {
    this.provider = options.provider || null;
    this.tools = new Map();
    this.sessions = new Map();
    this.audit = typeof options.audit === "function" ? options.audit : () => {};
    this.approval = typeof options.approval === "function"
      ? options.approval
      : async () => false;
    this.verify = typeof options.verify === "function"
      ? options.verify
      : async result => ({ verified: true, result });

    if (!this.provider || typeof this.provider.execute !== "function") {
      throw new HarnessError(
        "PROVIDER_REQUIRED",
        "Agent Harness requires a provider with execute()."
      );
    }
  }

  registerTool(name, definition) {
    if (!name || typeof name !== "string") {
      throw new HarnessError("TOOL_NAME_REQUIRED", "Tool name is required.");
    }

    if (!definition || typeof definition.execute !== "function") {
      throw new HarnessError(
        "TOOL_EXECUTOR_REQUIRED",
        `Tool '${name}' requires execute().`
      );
    }

    this.tools.set(name, {
      name,
      description: definition.description || "",
      requiresApproval: definition.requiresApproval !== false,
      execute: definition.execute,
      verify: typeof definition.verify === "function"
        ? definition.verify
        : null,
    });

    return { success: true, tool: name };
  }

  createSession(options = {}) {
    const id = options.id || crypto.randomUUID();

    if (this.sessions.has(id)) {
      return this.sessions.get(id);
    }

    const session = {
      id,
      interactionId: null,
      state: STATES.RECEIVED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: options.metadata || {},
    };

    this.sessions.set(id, session);
    return session;
  }

  getSession(id) {
    return this.sessions.get(id) || null;
  }

  updateSession(session, patch) {
    Object.assign(session, patch, {
      updatedAt: new Date().toISOString(),
    });
    return session;
  }

  emit(event, session, data = {}) {
    this.audit({
      event,
      sessionId: session.id,
      state: session.state,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  async run(request = {}) {
    const prompt = typeof request.prompt === "string"
      ? request.prompt.trim()
      : "";

    if (!prompt) {
      throw new HarnessError("PROMPT_REQUIRED", "Prompt is required.");
    }

    const session = request.sessionId
      ? (this.getSession(request.sessionId) ||
         this.createSession({ id: request.sessionId }))
      : this.createSession();

    this.updateSession(session, { state: STATES.RECEIVED });
    this.emit("run_received", session, { promptLength: prompt.length });

    try {
      this.updateSession(session, { state: STATES.THINKING });
      this.emit("model_execution_started", session);

      const result = await this.provider.execute(prompt, {
        previousInteractionId: session.interactionId,
        sessionId: session.id,
        ...request.options,
      });

      if (!result || result.success !== true) {
        throw new HarnessError(
          "MODEL_EXECUTION_FAILED",
          "Model provider did not return a successful result.",
          { result }
        );
      }

      if (result.interactionId) {
        session.interactionId = result.interactionId;
      }

      this.emit("model_execution_completed", session, {
        interactionId: session.interactionId,
        providerStatus: result.status || null,
      });

      if (Array.isArray(result.toolCalls) && result.toolCalls.length) {
        const toolResults = [];

        for (const call of result.toolCalls) {
          const tool = this.tools.get(call.name);

          if (!tool) {
            throw new HarnessError(
              "TOOL_NOT_REGISTERED",
              `Tool '${call.name}' is not registered.`
            );
          }

          if (tool.requiresApproval) {
            this.updateSession(session, {
              state: STATES.WAITING_FOR_APPROVAL,
            });

            this.emit("approval_required", session, {
              tool: call.name,
              approvalRequest: call.arguments || {},
            });

            const approved = await this.approval({
              session,
              tool: call.name,
              arguments: call.arguments || {},
            });

            if (approved !== true) {
              this.emit("approval_denied", session, { tool: call.name });

              return {
                success: true,
                state: STATES.WAITING_FOR_APPROVAL,
                sessionId: session.id,
                interactionId: session.interactionId,
                approvalRequired: true,
                executionAllowed: false,
                tool: call.name,
              };
            }
          }

          this.updateSession(session, { state: STATES.EXECUTING });
          this.emit("tool_execution_started", session, {
            tool: call.name,
          });

          const toolResult = await tool.execute(call.arguments || {});

          this.updateSession(session, { state: STATES.VERIFYING });

          const verification = tool.verify
            ? await tool.verify(toolResult, call.arguments || {})
            : await this.verify(toolResult, {
                session,
                tool: call.name,
                arguments: call.arguments || {},
              });

          if (!verification || verification.verified !== true) {
            throw new HarnessError(
              "VERIFICATION_FAILED",
              `Verification failed for tool '${call.name}'.`,
              { verification }
            );
          }

          this.emit("tool_verified", session, {
            tool: call.name,
          });

          toolResults.push({
            tool: call.name,
            result: toolResult,
            verification,
          });
        }

        this.updateSession(session, { state: STATES.COMPLETED });
        this.emit("run_completed", session, {
          toolCount: toolResults.length,
        });

        return {
          success: true,
          state: STATES.COMPLETED,
          sessionId: session.id,
          interactionId: session.interactionId,
          approvalRequired: false,
          executionAllowed: true,
          toolResults,
          modelResult: result,
        };
      }

      this.updateSession(session, { state: STATES.COMPLETED });
      this.emit("run_completed", session);

      return {
        success: true,
        state: STATES.COMPLETED,
        sessionId: session.id,
        interactionId: session.interactionId,
        approvalRequired: false,
        executionAllowed: false,
        text: result.text || "",
        modelResult: result,
      };
    } catch (error) {
      this.updateSession(session, { state: STATES.FAILED });
      this.emit("run_failed", session, {
        code: error.code || "HARNESS_ERROR",
        message: error.message,
      });

      throw error;
    }
  }
}

module.exports = {
  AgentHarness,
  HarnessError,
  STATES,
};

"use strict";

const { Agent, Runner } = require("@openai/agents");

function contentToText(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item.text === "string") return item.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function inputToText(input) {
  if (typeof input === "string") {
    return input;
  }

  if (!Array.isArray(input)) {
    return "";
  }

  return input
    .map((item) => {
      if (typeof item === "string") return item;

      if (!item || typeof item !== "object") {
        return "";
      }

      const text = contentToText(item.content);

      if (!text) return "";

      const role =
        typeof item.role === "string"
          ? item.role
          : "";

      return role === "user"
        ? text
        : role
          ? `${role}: ${text}`
          : text;
    })
    .filter(Boolean)
    .join("\n");
}

class GeminiAgentsModel {
  constructor(executeModel) {
    if (typeof executeModel !== "function") {
      throw new TypeError("executeModel must be a function");
    }

    this.name = "abu-basha-gemini";
    this.executeModel = executeModel;
  }

  async getResponse(request) {
    const prompt = inputToText(request && request.input);

    if (!prompt) {
      throw new Error("AGENTS_MODEL_EMPTY_INPUT");
    }

    const result = await this.executeModel(
      prompt,
      request || {}
    );

    if (!result || result.success !== true) {
      const error = new Error(
        result && result.type
          ? result.type
          : "AGENTS_GEMINI_INFERENCE_FAILED"
      );

      error.result = result;
      throw error;
    }

    const text =
      typeof result.text === "string"
        ? result.text
        : "";

    if (!text) {
      throw new Error("AGENTS_GEMINI_EMPTY_OUTPUT");
    }

    return {
      usage: {
        inputTokens: 0,
        inputTokensDetails: [],
        outputTokens: 0,
        outputTokensDetails: [],
        totalTokens: 0,
        requests: 1,
        requestUsageEntries: []
      },
      output: [
        {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text
            }
          ]
        }
      ]
    };
  }
}

class AbuBashaAgentsOrchestrator {
  constructor(options = {}) {
    this.model = new GeminiAgentsModel(options.executeModel);

    this.agent = new Agent({
      name: "Abu Basha AI",
      instructions:
        "أنت وكيل أبو بشة AI. حافظ على هوية الوكيل وسياق الطلب. " +
        "لا تنفذ أي إجراء خارجي بنفسك. التنفيذ الخارجي والموافقات " +
        "تظل مسؤولية Runtime المركزي وApproval Gateway.",
      model: this.model
    });

    this.runner = new Runner();
  }

  async run(prompt, options = {}) {
    const text =
      typeof prompt === "string"
        ? prompt.trim()
        : "";

    if (!text) {
      return {
        success: false,
        type: "invalid_chat_prompt",
        failClosed: true
      };
    }

    try {
      const history =
        options &&
        Array.isArray(options.conversationHistory)
          ? options.conversationHistory
              .filter(
                item =>
                  item &&
                  (item.role === "user" ||
                    item.role === "assistant") &&
                  typeof item.text === "string" &&
                  item.text.trim()
              )
              .slice(-20)
          : [];

      const runnerInput = [
        ...history.map(item => ({
          role: item.role,
          content: [
            {
              type: "input_text",
              text: item.text
            }
          ]
        })),
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text
            }
          ]
        }
      ];

      const result = await this.runner.run(
        this.agent,
        runnerInput,
        {
          context:
            options.context &&
            typeof options.context === "object"
              ? options.context
              : undefined
        }
      );

      const output =
        result &&
        typeof result.finalOutput === "string"
          ? result.finalOutput.trim()
          : "";

      if (!output) {
        return {
          success: false,
          type: "agents_empty_output",
          failClosed: true
        };
      }

      return {
        success: true,
        type: "agents_conversation_response",
        text: output,
        runner: "openai-agents",
        model: this.model.name
      };
    } catch (error) {
      return {
        success: false,
        type: "agents_runner_failed",
        message:
          error && error.message
            ? error.message
            : String(error),
        failClosed: true
      };
    }
  }
}

module.exports = AbuBashaAgentsOrchestrator;

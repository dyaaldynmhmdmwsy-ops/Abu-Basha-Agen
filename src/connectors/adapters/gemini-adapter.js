"use strict";

const BaseAdapter = require("./base-adapter");
const { GoogleGenAI } = require("@google/genai");
const ModelRouter = require("../../ai/model-router");
const InjectionDefense = require("../../injection-defense");

const SYSTEM_PROMPT = 'أنت "وكيل أبو بشة"، مساعد ذكاء اصطناعي لإدارة المحتوى والمهام الخاصة بصفحة أبو بشة.\n\nهوية الصفحة:\n- صفحة تهتم بالمحتوى والأخبار المتعلقة بالسودان.\n- الجمهور الأساسي هو الجمهور السوداني والمهتم بالشأن السوداني.\n- الهدف هو تقديم محتوى واضح ومنظم وجذاب، مع الحفاظ على الدقة والمصداقية.\n\nمهامك:\n- اقتراح أفكار للمنشورات والفيديوهات.\n- كتابة العناوين والخطافات (Hooks) والوصف.\n- اقتراح أفكار للمونتاج والصور المصغرة.\n- تنظيم خطة المحتوى والمهام.\n- مساعدة المستخدم في تطوير هوية الصفحة.\n- عند طلب تنفيذ إجراء خارجي، اقترح الإجراء أولًا واطلب موافقة المستخدم قبل التنفيذ.\n\nقواعد مهمة:\n- لا تختلق خبرًا أو مصدرًا أو رقمًا أو تصريحًا.\n- لا تقدم الشائعات أو الادعاءات غير المؤكدة على أنها حقائق.\n- إذا لم تكن لديك معلومات كافية، قل بوضوح إن المعلومات غير كافية.\n- لا تدّعي أنك تحققت من خبر أو نفذت إجراءً خارجيًا إذا لم يحدث ذلك فعليًا.\n- عند التعامل مع خبر، فرّق بوضوح بين الخبر المؤكد والادعاء أو المعلومة غير المؤكدة.\n- كن محايدًا ودقيقًا عند عرض المعلومات، وابتعد عن التحريض أو الكراهية ضد أي مجموعة.\n\nأسلوب الرد:\n- العربية الواضحة والبسيطة.\n- عملي ومباشر.\n- استخدم عناوين ونقاط عندما تكون مفيدة.\n- لا تكرر سؤال المستخدم بلا داعٍ.\n\nاسم الوكيل: وكيل أبو بشة.';

class GeminiAdapter extends BaseAdapter {
  constructor(options = {}) {
    super("gemini", {
      provider: "Google",
      category: "ai"
    });

    this.apiKey = process.env.GEMINI_API_KEY || null;
    this.client = this.apiKey
      ? new GoogleGenAI({ apiKey: this.apiKey })
      : null;

    const configuredModel =
      typeof options.defaultModel === "string" && options.defaultModel.trim()
        ? options.defaultModel.trim()
        : null;

    this.modelRouter =
      options.modelRouter instanceof ModelRouter
        ? options.modelRouter
        : new ModelRouter({
            defaultModel: configuredModel || undefined
          });

    this.injectionDefense = new InjectionDefense();
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async openStream(payload = {}, context = {}) {
    if (!this.isConfigured()) {
      return {
        success: false,
        type: "connector_not_configured",
        connector: "gemini",
        retryable: false,
        message: "GEMINI_API_KEY غير موجود."
      };
    }

    const modelSelection = this.modelRouter.resolve(
      payload.model || null
    );

    if (!modelSelection.success) {
      return {
        success: false,
        type: modelSelection.type,
        connector: "gemini",
        retryable: false,
        requestedModel: modelSelection.requestedModel || null
      };
    }

    const requestedModel = modelSelection.model.id;
    const executionChain =
      this.modelRouter.getExecutionChain(requestedModel);

    if (
      !executionChain ||
      executionChain.success !== true ||
      !Array.isArray(executionChain.models) ||
      !executionChain.models.length
    ) {
      return {
        success: false,
        type: executionChain?.type || "no_model_available",
        connector: "gemini",
        requestedModel,
        retryable: false,
        failClosed: true,
        message: "لا يوجد نموذج Gemini صالح لمسار المحادثة.",
        context
      };
    }

    const prompt =
      typeof payload.prompt === "string"
        ? payload.prompt.trim()
        : "";

    if (!prompt) {
      return {
        success: false,
        type: "invalid_payload",
        connector: "gemini",
        retryable: false,
        failClosed: true,
        message: "Gemini يحتاج prompt.",
        context
      };
    }

    const history =
      Array.isArray(payload.conversationHistory)
        ? payload.conversationHistory
            .filter(item =>
              item &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.text === "string" &&
              item.text.trim()
            )
            .slice(-20)
        : [];

    const historyText = history.length
      ? history
          .map(item =>
            "[" +
            String(item.role).toUpperCase() +
            "_HISTORY]\n" +
            item.text.trim() +
            "\n[/HISTORY]"
          )
          .join("\n")
      : "";

    const modelInput = historyText
      ? "[CONVERSATION_HISTORY_BEGIN]\n" +
        historyText +
        "\n[CONVERSATION_HISTORY_END]\n" +
        "[CURRENT_USER_MESSAGE_BEGIN]\n" +
        prompt +
        "\n[CURRENT_USER_MESSAGE_END]"
      : prompt;

    const trustedInput =
      this.injectionDefense.buildModelInput(modelInput);

    if (!trustedInput.success) {
      return {
        success: false,
        type: trustedInput.type,
        connector: "gemini",
        retryable: false,
        failClosed: true,
        message: "تم حجب الإدخال عند حدود الثقة.",
        security: trustedInput,
        context
      };
    }

    const modelsToTry =
      executionChain.models.map(model => model.id);

    let lastFailure = null;

    for (let index = 0; index < modelsToTry.length; index += 1) {
      const model = modelsToTry[index];

      try {
        const stream =
          await this.client.models.generateContentStream({
            model,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              maxOutputTokens: 256,
              httpOptions: {
                timeout: 60000
              }
            },
            contents: trustedInput.text
          });

        const normalizedStream = (async function* () {
          let emitted = false;

          try {
            for await (const chunk of stream) {
              const text =
                typeof chunk?.text === "string"
                  ? chunk.text
                  : "";

              if (!text) {
                continue;
              }

              emitted = true;

              yield {
                success: true,
                type: "gemini_stream_chunk",
                connector: "gemini",
                model,
                text,
                done: false,
                context
              };
            }

            yield {
              success: true,
              type: "gemini_stream_end",
              connector: "gemini",
              model,
              text: "",
              done: true,
              emitted,
              context
            };
          } catch (error) {
            yield {
              success: false,
              type: "gemini_stream_failed",
              connector: "gemini",
              model,
              retryable: false,
              message:
                error?.message
                  ? String(error.message)
                  : String(error),
              context
            };
          }
        })();

        return {
          success: true,
          type: "gemini_stream_opened",
          connector: "gemini",
          model,
          requestedModel,
          fallbackUsed: index > 0,
          stream: normalizedStream,
          context
        };
      } catch (error) {
        const status = Number(
          error?.status ||
          error?.response?.status ||
          0
        );

        const message = String(
          error?.message ||
          error ||
          ""
        );

        const retryable =
          status === 408 ||
          status === 425 ||
          status === 429 ||
          (status >= 500 && status <= 599) ||
          message.includes("UNAVAILABLE") ||
          message.includes("high demand");

        lastFailure = {
          success: false,
          type: "gemini_stream_open_failed",
          connector: "gemini",
          model,
          requestedModel,
          fallbackUsed: index > 0,
          status: status || null,
          retryable,
          message,
          context
        };

        if (!retryable || index >= modelsToTry.length - 1) {
          break;
        }
      }
    }

    return lastFailure || {
      success: false,
      type: "gemini_stream_open_failed",
      connector: "gemini",
      model: requestedModel,
      retryable: false,
      message: "فشل فتح قناة Streaming.",
      context
    };
  }

  async *executeStream(payload = {}, context = {}) {
    if (!this.isConfigured()) {
      yield {
        success: false,
        type: "connector_not_configured",
        connector: "gemini",
        message: "GEMINI_API_KEY غير موجود."
      };
      return;
    }

    const modelSelection = this.modelRouter.resolve(
      payload.model || null
    );

    if (!modelSelection.success) {
      yield {
        success: false,
        type: modelSelection.type,
        connector: "gemini",
        requestedModel: modelSelection.requestedModel || null
      };
      return;
    }

    const executionSelection =
      this.modelRouter.resolveExecutionModel(
        payload.model || null,
        { allowFallback: true }
      );

    if (
      !executionSelection ||
      executionSelection.success !== true ||
      !executionSelection.model
    ) {
      yield {
        success: false,
        type:
          executionSelection?.type ||
          "no_model_available",
        connector: "gemini",
        requestedModel: payload.model || null,
        retryable: false,
        failClosed: true,
        message:
          "لا يوجد نموذج Gemini متاح حاليًا.",
        context
      };
      return;
    }

    const model = executionSelection.model.id;

    if (
      !executionSelection ||
      executionSelection.success !== true ||
      !executionSelection.model
    ) {
      return {
        success: false,
        type:
          executionSelection?.type ||
          "no_model_available",
        connector: "gemini",
        requestedModel: payload.model || null,
        retryable: false,
        failClosed: true,
        message:
          "لا يوجد نموذج Gemini متاح حاليًا.",
        context
      };
    }
    const prompt =
      payload.prompt ||
      payload.text ||
      "";

    const trustedInput =
      this.injectionDefense.buildModelInput(prompt);

    if (!trustedInput.success) {
      yield {
        success: false,
        type: trustedInput.type,
        connector: "gemini",
        model,
        message: "تم حجب الإدخال عند حدود الثقة.",
        security: trustedInput
      };
      return;
    }

    if (!prompt) {
      yield {
        success: false,
        type: "invalid_payload",
        connector: "gemini",
        message: "Gemini يحتاج prompt."
      };
      return;
    }

    this.executed++;

    try {
      const stream =
        await this.client.models.generateContentStream({
          model,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            maxOutputTokens: 256,
            httpOptions: {
              timeout: 60000
            }
          },
          contents: trustedInput.text
        });

      let emitted = false;

      for await (const chunk of stream) {
        const text =
          typeof chunk?.text === "string"
            ? chunk.text
            : "";

        if (!text) {
          continue;
        }

        emitted = true;

        yield {
          success: true,
          type: "gemini_stream_chunk",
          connector: "gemini",
          model,
          text,
          done: false,
          context
        };
      }

      yield {
        success: true,
        type: "gemini_stream_end",
        connector: "gemini",
        model,
        text: "",
        done: true,
        emitted,
        context
      };
    } catch (error) {
      yield {
        success: false,
        type: "gemini_stream_failed",
        connector: "gemini",
        model,
        retryable: false,
        message:
          error?.message
            ? String(error.message)
            : String(error),
        context
      };
    }
  }

  async execute(payload = {}, context = {}) {
    if (!this.isConfigured()) {
      return {
        success: false,
        type: "connector_not_configured",
        connector: "gemini",
        message: "GEMINI_API_KEY غير موجود."
      };
    }

    const modelSelection = this.modelRouter.resolve(
      payload.model || null
    );

    if (!modelSelection.success) {
      return {
        success: false,
        type: modelSelection.type,
        connector: "gemini",
        requestedModel: modelSelection.requestedModel || null
      };
    }

    const model = modelSelection.model.id;

    const prompt =
      payload.prompt ||
      payload.text ||
      "";

    const trustedInput = this.injectionDefense.buildModelInput(prompt);

    if (!trustedInput.success) {
      return {
        success: false,
        type: trustedInput.type,
        connector: "gemini",
        model,
        message: "تم حجب الإدخال عند حدود الثقة.",
        security: trustedInput
      };
    }

    if (!prompt) {
      return {
        success: false,
        type: "invalid_payload",
        connector: "gemini",
        message: "Gemini يحتاج prompt."
      };
    }

    this.executed++;



    let lastStatus = 0;
    let lastMessage = "";

    // Retry ownership is delegated to the Runtime ResilienceManager.
    // The adapter performs one primary provider request per execute() call.

    const executeRequest = async (requestModel) => {
      const request = this.client.models.generateContent({
        model: requestModel,
        config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 256,
          httpOptions: { timeout: 60000 }
        },
        contents: trustedInput.text
      });

      return request;
    };

    try {
      const response = await executeRequest(model);

      return {
        success: true,
        type: "gemini_response",
        connector: "gemini",
        model,
        attempts: 1,
        text: response.text || "",
        context
      };
    } catch (error) {
      lastStatus = Number(
        error?.status ||
        error?.response?.status ||
        0
      );

      lastMessage = String(
        error?.message ||
        error ||
        ""
      );

      const providerCode = String(
        error?.code ||
        error?.statusText ||
        error?.response?.data?.error?.status ||
        error?.response?.data?.error?.code ||
        ""
      );

      if (
        lastStatus === 429 ||
        providerCode === "RESOURCE_EXHAUSTED" ||
        lastMessage.includes("RESOURCE_EXHAUSTED")
      ) {
        lastMessage = `${lastMessage} RESOURCE_EXHAUSTED quota exhausted`;
      }

      this.modelRouter.recordFailure(
        model,
        {
          status: lastStatus,
          message: lastMessage
        }
      );

      if (lastMessage.includes("timed out")) {
        return {
          success: false,
          type: "gemini_timeout",
          connector: "gemini",
          model,
          attempts: 1,
          retryable: false,
          message: "انتهت مهلة طلب Gemini.",
          context
        };
      }
    }

    const initialFailurePolicy =
      this.modelRouter.classifyFailure({
        status: lastStatus,
        message: lastMessage
      });

    const transient503 =
      initialFailurePolicy.state === "PROVIDER_UNAVAILABLE";

    const attemptedModels = new Set([model]);
    let fallbackModel = model;
    let fallbackAttempted = false;

    while (true) {
      const fallbackSelection =
        this.modelRouter.resolveFallback(fallbackModel);

      const nextFallbackModel =
        fallbackSelection &&
        fallbackSelection.success === true &&
        fallbackSelection.model &&
        fallbackSelection.model.id
          ? fallbackSelection.model.id
          : null;

      if (
        !nextFallbackModel ||
        attemptedModels.has(nextFallbackModel)
      ) {
        break;
      }

      fallbackModel = nextFallbackModel;
      attemptedModels.add(fallbackModel);

      const failurePolicy =
        this.modelRouter.classifyFailure({
          status: lastStatus,
          message: lastMessage
        });

      if (!failurePolicy.fallbackAllowed) {
        break;
      }

      fallbackAttempted = true;

      try {
        const response = await executeRequest(fallbackModel);

        return {
          success: true,
          type: "gemini_response",
          connector: "gemini",
          model: fallbackModel,
          requestedModel: model,
          fallback: true,
          fallbackAttempted: true,
          attempts: attemptedModels.size,
          text: response.text || "",
          context
        };
      } catch (fallbackError) {
        lastStatus = Number(
          fallbackError?.status ||
          fallbackError?.response?.status ||
          0
        );

        lastMessage = String(
          fallbackError?.message ||
          fallbackError ||
          ""
        );

        const fallbackProviderCode = String(
          fallbackError?.code ||
          fallbackError?.statusText ||
          fallbackError?.response?.data?.error?.status ||
          fallbackError?.response?.data?.error?.code ||
          ""
        );

        if (
          lastStatus === 429 ||
          fallbackProviderCode === "RESOURCE_EXHAUSTED" ||
          lastMessage.includes("RESOURCE_EXHAUSTED")
        ) {
          lastMessage = `${lastMessage} RESOURCE_EXHAUSTED quota exhausted`;
        }

        this.modelRouter.recordFailure(
          fallbackModel,
          {
            status: lastStatus,
            message: lastMessage
          }
        );
      }
    }


    const finalFailurePolicy =
      this.modelRouter.classifyFailure({
        status: lastStatus,
        message: lastMessage
      });

    const quotaExceeded =
      finalFailurePolicy.state === "QUOTA_EXHAUSTED";

    const retryable =
      finalFailurePolicy.retryable === true;

    return {
      success: false,
      type: quotaExceeded ? "gemini_quota_exceeded" : "gemini_api_error",
      connector: "gemini",
      model,
      status: lastStatus || null,
      retryable,
      quotaExceeded,
      attempts: fallbackAttempted ? 2 : 1,
      fallbackAttempted,
      message: lastMessage,
      context
    };
  }
}

module.exports = GeminiAdapter;

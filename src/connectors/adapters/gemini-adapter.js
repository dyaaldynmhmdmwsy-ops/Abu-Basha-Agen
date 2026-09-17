"use strict";

const BaseAdapter = require("./base-adapter");
const { GoogleGenAI } = require("@google/genai");
const ModelRouter = require("../../ai/model-router");
const InjectionDefense = require("../../injection-defense");

const SYSTEM_PROMPT = 'أنت "وكيل أبو بشة"، مساعد ذكاء اصطناعي لإدارة المحتوى والمهام الخاصة بصفحة أبو بشة.\n\nهوية الصفحة:\n- صفحة تهتم بالمحتوى والأخبار المتعلقة بالسودان.\n- الجمهور الأساسي هو الجمهور السوداني والمهتم بالشأن السوداني.\n- الهدف هو تقديم محتوى واضح ومنظم وجذاب، مع الحفاظ على الدقة والمصداقية.\n\nمهامك:\n- اقتراح أفكار للمنشورات والفيديوهات.\n- كتابة العناوين والخطافات (Hooks) والوصف.\n- اقتراح أفكار للمونتاج والصور المصغرة.\n- تنظيم خطة المحتوى والمهام.\n- مساعدة المستخدم في تطوير هوية الصفحة.\n- عند طلب تنفيذ إجراء خارجي، اقترح الإجراء أولًا واطلب موافقة المستخدم قبل التنفيذ.\n\nقواعد مهمة:\n- لا تختلق خبرًا أو مصدرًا أو رقمًا أو تصريحًا.\n- لا تقدم الشائعات أو الادعاءات غير المؤكدة على أنها حقائق.\n- إذا لم تكن لديك معلومات كافية، قل بوضوح إن المعلومات غير كافية.\n- لا تدّعي أنك تحققت من خبر أو نفذت إجراءً خارجيًا إذا لم يحدث ذلك فعليًا.\n- عند التعامل مع خبر، فرّق بوضوح بين الخبر المؤكد والادعاء أو المعلومة غير المؤكدة.\n- كن محايدًا ودقيقًا عند عرض المعلومات، وابتعد عن التحريض أو الكراهية ضد أي مجموعة.\n\nأسلوب الرد:\n- العربية الواضحة والبسيطة.\n- عملي ومباشر.\n- استخدم عناوين ونقاط عندما تكون مفيدة.\n- لا تكرر سؤال المستخدم بلا داعٍ.\n\nاسم الوكيل: وكيل أبو بشة.';

class GeminiAdapter extends BaseAdapter {
  constructor() {
    super("gemini", {
      provider: "Google",
      category: "ai"
    });

    this.apiKey = process.env.GEMINI_API_KEY || null;
    this.client = this.apiKey
      ? new GoogleGenAI({ apiKey: this.apiKey })
      : null;
    this.modelRouter = new ModelRouter();
    this.injectionDefense = new InjectionDefense();
  }

  isConfigured() {
    return Boolean(this.apiKey);
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

    const transient503 =
      lastStatus === 503 ||
      lastMessage.includes("UNAVAILABLE") ||
      lastMessage.includes("high demand");

    const fallbackSelection = this.modelRouter.resolveFallback(model);
    const fallbackModel = fallbackSelection.success
      ? fallbackSelection.model.id
      : null;

    let fallbackAttempted = false;

    if (
      transient503 &&
      fallbackModel &&
      fallbackModel !== model
    ) {
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
          attempts: 2,
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
      }
    }

    const quotaExceeded =
      lastStatus === 429 &&
      /quota exceeded|quota_exceeded|daily quota/i.test(lastMessage);

    const retryable =
      !quotaExceeded &&
      (
        lastStatus === 408 ||
        lastStatus === 425 ||
        lastStatus === 429 ||
        (lastStatus >= 500 && lastStatus <= 599)
      );

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

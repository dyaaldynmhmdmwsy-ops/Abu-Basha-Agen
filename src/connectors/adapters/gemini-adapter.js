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

    const timeoutMs = Number(
      payload.timeoutMs ||
      process.env.GEMINI_TIMEOUT_MS ||
      30000
    );

    const request = this.client.models.generateContent({
      model,
      contents: `${SYSTEM_PROMPT}\n\nبيانات المستخدم غير الموثوقة:\n${trustedInput.text}`
    });

    const timeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Gemini request timed out.")),
        timeoutMs
      )
    );

    try {
      const response = await Promise.race([
        request,
        timeout
      ]);

      return {
        success: true,
        type: "gemini_response",
        connector: "gemini",
        model,
        text: response.text || "",
        context
      };
    } catch (error) {
      const status = Number(error?.status || error?.response?.status || 0);
      const message = String(error?.message || error || "");

      if (message.includes("timed out")) {
        return {
          success: false,
          type: "gemini_timeout",
          connector: "gemini",
          model,
          message: "انتهت مهلة طلب Gemini.",
          context
        };
      }

      return {
        success: false,
        type: "gemini_api_error",
        connector: "gemini",
        model,
        status: status || null,
        message,
        context
      };
    }
  }
}

module.exports = GeminiAdapter;

"use strict";

/**
 * Plan Registry
 *
 * يسجل أنواع الخطط وخطواتها.
 * لا ينفذ أي شيء.
 */

class PlanRegistry {
  constructor() {
    this.name = "Plan Registry";
    this.version = "1.0.0";
    this.plans = new Map();

    this.register("telegram_service", {
      name: "Telegram Bot Service",
      category: "software",
      steps: [
        {
          name: "analyze_opportunity",
          label: "تحليل الفرصة",
          type: "execution"
        },
        {
          name: "define_requirements",
          label: "تحديد المتطلبات",
          type: "execution"
        },
        {
          name: "create_prototype",
          label: "إنشاء نموذج أولي",
          type: "execution"
        },
        {
          name: "test_prototype",
          label: "اختبار النموذج",
          type: "execution"
        },
        {
          name: "request_approval",
          label: "طلب موافقة المستخدم",
          type: "control"
        },
        {
          name: "execute_after_approval",
          label: "التنفيذ بعد الموافقة",
          type: "execution"
        }
      ]
    });

    [
      ["content_service", "AI Content Service", "content"],
      ["automation_service", "Automation Service", "software"],
      ["security_research", "Authorized Security Research", "security"]
    ].forEach(([id, name, category]) => {
      this.register(id, {
        name,
        category,
        steps: [
          {name:"analyze_opportunity", label:"تحليل الفرصة", type:"execution"},
          {name:"define_requirements", label:"تحديد المتطلبات", type:"execution"},
          {name:"create_prototype", label:"إنشاء نموذج أولي", type:"execution"},
          {name:"test_prototype", label:"اختبار النموذج", type:"execution"},
          {name:"request_approval", label:"طلب موافقة المستخدم", type:"control"},
          {name:"execute_after_approval", label:"التنفيذ بعد الموافقة", type:"execution"}
        ]
      });
    });
  }

  register(id, definition) {
    if (!id || !definition) {
      throw new Error("معرف أو تعريف الخطة غير صالح");
    }

    if (!definition.name) {
      throw new Error(`الخطة "${id}" بدون اسم`);
    }

    if (!Array.isArray(definition.steps)) {
      throw new Error(`الخطة "${id}" يجب أن تحتوي على steps`);
    }

    this.plans.set(id, {
      id,
      name: definition.name,
      category: definition.category || "general",
      steps: definition.steps.map((step, index) => ({
        name: step.name || `step_${index + 1}`,
        label: step.label || step.name || `Step ${index + 1}`,
        type: step.type || "execution",
        tool:
          step.type === "execution"
            ? (step.tool || "plan_execution")
            : step.tool
      }))
    });

    return {
      success: true,
      id
    };
  }

  has(id) {
    return this.plans.has(id);
  }

  get(id) {
    return this.plans.get(id) || null;
  }

  list() {
    return [...this.plans.values()];
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: "online",
      plans: this.plans.size
    };
  }
}

module.exports = PlanRegistry;

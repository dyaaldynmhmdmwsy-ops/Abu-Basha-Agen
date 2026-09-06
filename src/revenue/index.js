class RevenueEngine {
  constructor() {
    this.name = "Revenue Engine";
    this.version = "2.0.0";
    this.status = "online";
    this.opportunities = [];


    // =================================
    // فرص الربح الأساسية
    // =================================

    const defaultOpportunities = [
      {
        id: "telegram_service",
        name: "Telegram Bot Service",
        category: "automation",
        model: "service",
        description: "إنشاء بوتات لخدمات وأتمتة مشروعة",
        platform: "telegram",
        monetization: [
          "بيع الخدمة",
          "اشتراك شهري",
          "خدمات مخصصة"
        ],
        type: "legal",
        riskLevel: "low",
        requiresApproval: true
      },
      {
        id: "content_service",
        name: "AI Content Service",
        category: "content",
        model: "service",
        description: "إنشاء محتوى وتصميمات وفيديوهات للعملاء",
        platform: null,
        monetization: [
          "بيع الخدمات",
          "اشتراكات العملاء"
        ],
        type: "legal",
        riskLevel: "low",
        requiresApproval: true
      },
      {
        id: "automation_service",
        name: "Automation Service",
        category: "software",
        model: "service",
        description: "بناء أدوات أتمتة للشركات والمشاريع",
        platform: null,
        monetization: [
          "مشاريع مخصصة",
          "اشتراك",
          "دعم وصيانة"
        ],
        type: "legal",
        riskLevel: "low",
        requiresApproval: true
      },
      {
        id: "security_research",
        name: "Authorized Security Research",
        category: "security",
        model: "research",
        description: "اختبار أمني مصرح به واكتشاف ثغرات في أنظمة نملكها أو نملك تصريحاً لاختبارها",
        platform: null,
        monetization: [
          "Bug Bounty",
          "اختبارات أمنية مصرح بها",
          "تقارير أمنية"
        ],
        type: "legal",
        riskLevel: "medium",
        requiresApproval: true
      },
      {
        id: "unverified_opportunity",
        name: "Unverified Opportunity",
        category: "research",
        model: "analysis",
        description: "فرصة غير موثقة تحتاج إلى التحقق من شروطها وقانونيتها قبل أي تنفيذ",
        platform: null,
        monetization: [
          "تحدد بعد التحقق"
        ],
        type: "unverified",
        riskLevel: "high",
        requiresApproval: true
      }
    ];

    defaultOpportunities.forEach(opportunity => {
      this.addOpportunity(opportunity);
    });
    this.plans = [];
  }

  addOpportunity(opportunity) {
    const item = {
      id: opportunity.id || `opp_${Date.now()}`,
      name: opportunity.name,
      category: opportunity.category || "online",
      model: opportunity.model || "service",
      description: opportunity.description || "",
      monetization: opportunity.monetization || [],
      platform: opportunity.platform || null,

      // تصنيف الفرصة
      type: opportunity.type || "unverified",
      riskLevel: opportunity.riskLevel || "unknown",

      // الفرص غير القانونية أو عالية الخطورة لا يتم تنفيذها تلقائياً
      legal: opportunity.type === "legal",
      requiresApproval: true,

      status: "available",
      createdAt: new Date().toISOString()
    };

    this.opportunities.push(item);
    return item;
  }

  listOpportunities(filter = {}) {
    return this.opportunities.filter(item => {
      if (filter.category && item.category !== filter.category) {
        return false;
      }

      if (filter.platform && item.platform !== filter.platform) {
        return false;
      }

      return true;
    });
  }

  findOpportunity(id) {
    return this.opportunities.find(item => item.id === id) || null;
  }

  // Canonical public lookup API.
  getOpportunity(id) {
    return this.findOpportunity(id);
  }

  // Canonical public search API.
  searchOpportunities(keyword = "") {
    const value = String(keyword).trim().toLowerCase();

    if (!value) {
      return this.listOpportunities();
    }

    return this.opportunities.filter(item =>
      [
        item.id,
        item.name,
        item.category,
        item.model,
        item.description,
        item.platform,
        ...(Array.isArray(item.monetization)
          ? item.monetization
          : [])
      ]
        .filter(value => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }

  createPlan(opportunityId, target = "online") {
    const opportunity = this.findOpportunity(opportunityId);

    if (!opportunity) {
      return {
        success: false,
        type: "opportunity_not_found",
        message: "الفرصة غير موجودة"
      };
    }

    const plan = {
      id: `plan_${Date.now()}`,
      opportunityId: opportunity.id,
      name: opportunity.name,
      target,
      requiresApproval: true,
      status: "proposal",
      steps: [
        "تحليل الفرصة",
        "تحديد المتطلبات",
        "إنشاء نموذج أولي",
        "اختبار النموذج",
        "طلب موافقة المستخدم",
        "التنفيذ بعد الموافقة"
      ],
      createdAt: new Date().toISOString()
    };

    this.plans.push(plan);

    return {
      success: true,
      type: "revenue_plan",
      plan
    };
  }

  getPlans() {
    return this.plans;
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      opportunities: this.opportunities.length,
      plans: this.plans.length
    };
  }
}

module.exports = RevenueEngine;

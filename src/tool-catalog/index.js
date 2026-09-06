"use strict";

/*
 * BLOCK 06
 * Expanded Tool Capability Catalog.
 *
 * IMPORTANT:
 * This catalog describes capabilities.
 * It does NOT execute external operations.
 *
 * Actual execution remains behind:
 * Tool Registry
 * -> Resolver
 * -> Connector Gateway
 * -> Policy
 * -> Execution Engine
 */

const tools = [
  {
    name: "developer",
    category: "development",
    description: "كتابة وتحليل وتعديل واختبار البرمجيات",
    capabilities: [
      "code",
      "برمجة",
      "كود",
      "تطوير",
      "debug",
      "testing",
      "software"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "web-research",
    category: "research",
    description: "البحث وجمع المعلومات والمصادر",
    capabilities: [
      "web",
      "search",
      "research",
      "بحث",
      "إنترنت",
      "مواقع",
      "مصادر"
    ],
    requiresApproval: false,
    external: true,
    enabled: true
  },

  {
    name: "bot-builder",
    category: "creation",
    description: "إنشاء وتصميم البوتات والأتمتة",
    capabilities: [
      "bot",
      "بوت",
      "روبوت",
      "automation",
      "إنشاء"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "app-builder",
    category: "creation",
    description: "إنشاء هياكل ومشاريع التطبيقات",
    capabilities: [
      "app",
      "تطبيق",
      "android",
      "APK",
      "mobile",
      "إنشاء تطبيق"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "diagnostics",
    category: "repair",
    description: "تشخيص مشاكل البرامج والأجهزة",
    capabilities: [
      "diagnostics",
      "تشخيص",
      "repair",
      "إصلاح",
      "صيانة",
      "phone",
      "هاتف"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "media",
    category: "media",
    description: "مهام الصور والفيديو والصوت والمحتوى",
    capabilities: [
      "media",
      "video",
      "image",
      "audio",
      "مونتاج",
      "فيديو",
      "صورة",
      "صوت"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "file-manager",
    category: "system",
    description: "إدارة الملفات والمجلدات داخل بيئة المشروع",
    capabilities: [
      "files",
      "file",
      "folder",
      "ملفات",
      "مجلدات",
      "نسخ",
      "نقل"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "terminal",
    category: "system",
    description: "تنفيذ أوامر النظام المسموح بها داخل بيئة الوكيل",
    capabilities: [
      "terminal",
      "shell",
      "bash",
      "termux",
      "أوامر",
      "طرفية"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "git",
    category: "development",
    description: "إدارة المستودعات والإصدارات والتغييرات",
    capabilities: [
      "git",
      "github",
      "repository",
      "commit",
      "branch",
      "مستودع",
      "إصدارات"
    ],
    requiresApproval: true,
    external: true,
    enabled: true
  },

  {
    name: "database",
    category: "data",
    description: "التعامل مع قواعد البيانات والبيانات المنظمة",
    capabilities: [
      "database",
      "db",
      "sql",
      "sqlite",
      "بيانات",
      "قاعدة بيانات"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "document",
    category: "productivity",
    description: "إنشاء وتحليل ومعالجة المستندات",
    capabilities: [
      "document",
      "docs",
      "pdf",
      "text",
      "مستند",
      "وثيقة",
      "PDF"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "scheduler",
    category: "automation",
    description: "إدارة المهام المجدولة والتشغيل الدوري",
    capabilities: [
      "schedule",
      "scheduler",
      "cron",
      "automation",
      "جدولة",
      "مواعيد",
      "تلقائي"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "social-media",
    category: "social",
    description: "إدارة وتحليل مهام منصات التواصل الاجتماعي",
    capabilities: [
      "social",
      "facebook",
      "tiktok",
      "youtube",
      "whatsapp",
      "سوشيال",
      "فيسبوك",
      "تيك توك",
      "يوتيوب"
    ],
    requiresApproval: true,
    external: true,
    enabled: true
  },

  {
    name: "analytics",
    category: "analytics",
    description: "تحليل الأداء والإحصائيات والبيانات",
    capabilities: [
      "analytics",
      "statistics",
      "metrics",
      "تحليل",
      "إحصائيات",
      "أرقام"
    ],
    requiresApproval: true,
    external: true,
    enabled: true
  },

  {
    name: "content-engine",
    category: "content",
    description: "اقتراح وإنشاء وتنظيم المحتوى",
    capabilities: [
      "content",
      "writing",
      "caption",
      "hashtags",
      "محتوى",
      "كتابة",
      "هاشتاق"
    ],
    requiresApproval: true,
    external: false,
    enabled: true
  },

  {
    name: "ai-model",
    category: "ai",
    description: "واجهة عامة لمزودي نماذج الذكاء الاصطناعي",
    capabilities: [
      "ai",
      "llm",
      "model",
      "gemini",
      "ذكاء اصطناعي",
      "نموذج"
    ],
    requiresApproval: true,
    external: true,
    enabled: true
  }
];

module.exports = tools;

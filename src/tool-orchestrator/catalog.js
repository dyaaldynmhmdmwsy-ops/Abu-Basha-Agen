"use strict";

/*
 * Initial capability catalog.
 * أدوات وصفية فقط في هذه المرحلة.
 * لا يوجد تنفيذ خارجي هنا.
 */

module.exports = [
  {
    name: "web-research",
    category: "research",
    description: "البحث عن المعلومات والمصادر والمواقع",
    capabilities: [
      "بحث",
      "إنترنت",
      "مواقع",
      "مصادر",
      "research",
      "web",
      "search"
    ],
    enabled: true,
    requiresApproval: false,
    external: true
  },

  {
    name: "developer",
    category: "development",
    description: "تحليل وكتابة وتعديل واختبار البرمجيات",
    capabilities: [
      "برمجة",
      "كود",
      "تطوير",
      "software",
      "code",
      "development"
    ],
    enabled: true,
    requiresApproval: true,
    external: false
  },

  {
    name: "bot-builder",
    category: "creation",
    description: "إنشاء وتصميم البوتات",
    capabilities: [
      "بوت",
      "روبوت",
      "bot",
      "automation",
      "إنشاء"
    ],
    enabled: true,
    requiresApproval: true,
    external: false
  },

  {
    name: "app-builder",
    category: "creation",
    description: "إنشاء هياكل ومشاريع التطبيقات",
    capabilities: [
      "تطبيق",
      "app",
      "android",
      "APK",
      "إنشاء تطبيق"
    ],
    enabled: true,
    requiresApproval: true,
    external: false
  },

  {
    name: "diagnostics",
    category: "repair",
    description: "تشخيص مشاكل البرامج والأجهزة وتقديم حلول آمنة",
    capabilities: [
      "صيانة",
      "إصلاح",
      "تشخيص",
      "هاتف",
      "phone",
      "repair",
      "diagnostics"
    ],
    enabled: true,
    requiresApproval: true,
    external: false
  },

  {
    name: "media",
    category: "media",
    description: "مهام المحتوى والصور والفيديو والصوت",
    capabilities: [
      "مونتاج",
      "فيديو",
      "صورة",
      "صوت",
      "media",
      "video",
      "image"
    ],
    enabled: true,
    requiresApproval: true,
    external: false
  }
];

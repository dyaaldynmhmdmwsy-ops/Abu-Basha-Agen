export type WorkspaceId =
  | "overview"
  | "chat"
  | "coding"
  | "editing"
  | "studio"
  | "control"
  | "settings";

export type WorkspaceKind =
  | "dashboard"
  | "conversation"
  | "development"
  | "media"
  | "creative"
  | "operations"
  | "configuration";

export type WorkspaceDefinition = {
  id: WorkspaceId;
  kind: WorkspaceKind;
  title: string;
  subtitle: string;
  kicker: string;
  description: string;
  mobileLabel: string;
};

export const WORKSPACE_CATALOG: readonly WorkspaceDefinition[] = [
  {
    id: "overview",
    kind: "dashboard",
    title: "الرئيسية",
    subtitle: "مركز القيادة",
    kicker: "OVERVIEW",
    description:
      "نقطة البداية المركزية لمتابعة حالة الوكيل ومسارات العمل.",
    mobileLabel: "الرئيسية"
  },
  {
    id: "chat",
    kind: "conversation",
    title: "المحادثة",
    subtitle: "مساعد أبو بشة",
    kicker: "CHAT",
    description:
      "محادثة مركزية آمنة مع فصل واضح بين المعلومات والعمليات التنفيذية.",
    mobileLabel: "المحادثة"
  },
  {
    id: "coding",
    kind: "development",
    title: "البرمجة",
    subtitle: "Development Workspace",
    kicker: "CODING",
    description:
      "بيئة عمل مخصصة للمشاريع البرمجية والمهام التي تمر عبر بوابة الموافقة.",
    mobileLabel: "البرمجة"
  },
  {
    id: "editing",
    kind: "media",
    title: "المونتاج",
    subtitle: "Media Workspace",
    kicker: "EDITING",
    description:
      "مساحة مستقلة لأدوات الوسائط والمونتاج والمشاريع المرتبطة بها.",
    mobileLabel: "المونتاج"
  },
  {
    id: "studio",
    kind: "creative",
    title: "الاستوديو",
    subtitle: "Creation Workspace",
    kicker: "STUDIO",
    description:
      "مساحة موحدة للمحتوى والمشاريع والأصول وسير العمل الإبداعي.",
    mobileLabel: "الاستوديو"
  },
  {
    id: "control",
    kind: "operations",
    title: "التحكم والأمان",
    subtitle: "Operations & Security",
    kicker: "CONTROL",
    description:
      "المراقبة والموافقات والتدقيق والحالة التشغيلية ضمن الحدود الأمنية.",
    mobileLabel: "التحكم"
  },
  {
    id: "settings",
    kind: "configuration",
    title: "الإعدادات",
    subtitle: "Product Configuration",
    kicker: "SETTINGS",
    description:
      "إدارة إعدادات المنتج من خلال واجهة مرتبطة بالـRuntime المركزي.",
    mobileLabel: "الإعدادات"
  }
];

export function getWorkspaceDefinition(
  id: WorkspaceId
): WorkspaceDefinition {
  return (
    WORKSPACE_CATALOG.find((workspace) => workspace.id === id) ||
    WORKSPACE_CATALOG[0]
  );
}

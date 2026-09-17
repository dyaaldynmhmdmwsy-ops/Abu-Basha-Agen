import { useCallback, useEffect, useState } from "react";
import {
  approveApproval,
  getApprovalStatus,
  getApprovals,
  getDiagnosticReport,
  getDiagnosticStatus,
  getRevenueOpportunities,
  getRevenuePlans,
  getRevenueStatus,
  getExecutionHistory,
  runDiagnostic,
  getExecutionStatus,
  getPlanStatus,
  rejectApproval,
  type ApprovalItem,
  type ApprovalStatus,
  type DiagnosticReport,
  type DiagnosticStatus,
  type RevenueOpportunity,
  type RevenuePlan,
  type RevenueStatus,
  type ExecutionHistoryItem,
  type ExecutionStatus,
  type PlanStatus,
  createChatApproval,
  executeApprovedChat,
  createDeveloperApproval,
  executeApprovedDeveloper,
  chat,
  type ChatApprovalResponse,
  type ChatExecutionResponse,
  type DeveloperApprovalResponse,
  DeveloperExecutionResponse
} from "./api";

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void) | null;
};

type BrowserSpeechRecognitionConstructor =
  new () => BrowserSpeechRecognition;

type Section =
  | "overview"
  | "chat"
  | "plans"
  | "approvals"
  | "execution"
  | "audit"
  | "revenue";

type Hub =
  | "chat"
  | "coding"
  | "editing"
  | "studio"
  | "control";

type WorkspaceId = Hub;

const hubs: {
  id: WorkspaceId;
  label: string;
  icon: string;
}[] = [
  { id: "chat", label: "المحادثة", icon: "chat" },
  { id: "coding", label: "البرمجة", icon: "code" },
  { id: "editing", label: "المونتاج", icon: "edit" },
  { id: "studio", label: "الاستوديو", icon: "studio" },
  { id: "control", label: "التحكم والأمان", icon: "control" }
];

/*
 * Legacy section metadata.
 * Kept for existing internal monitoring/render branches.
 * Primary navigation is provided by hubs above.
 */
const sections: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "الرئيسية", icon: "⌂" },
  { id: "chat", label: "المحادثة", icon: "✦" },
  { id: "plans", label: "الخطط", icon: "≡" },
  { id: "approvals", label: "الموافقات", icon: "✓" },
  { id: "execution", label: "التنفيذ", icon: "▶" },
  { id: "audit", label: "التدقيق", icon: "◉" },
  { id: "revenue", label: "الأرباح", icon: "$" }
];

function statusLabel(status?: string) {
  if (status === "online") return "متصل";
  if (status === "unavailable") return "غير متاح";
  return status || "غير معروف";
}

function App() {
  const [activeWorkspace, setActiveWorkspace] =
    useState<WorkspaceId>("chat");
  const [active, setActive] = useState<Section>("chat");
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [executionStatus, setExecutionStatus] =
    useState<ExecutionStatus | null>(null);
  const [history, setHistory] = useState<ExecutionHistoryItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [approvalStatus, setApprovalStatus] =
    useState<ApprovalStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnosticStatus, setDiagnosticStatus] =
    useState<DiagnosticStatus | null>(null);
  const [diagnosticReport, setDiagnosticReport] =
    useState<DiagnosticReport | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [revenueStatus, setRevenueStatus] =
    useState<RevenueStatus | null>(null);
  const [revenueOpportunities, setRevenueOpportunities] =
    useState<RevenueOpportunity[]>([]);
  const [revenuePlans, setRevenuePlans] =
    useState<RevenuePlan[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [chatToolsOpen, setChatToolsOpen] = useState(false);
  const [chatApproval, setChatApproval] =
    useState<ChatApprovalResponse["approval"] | null>(null);
  const [chatApprovalPrompt, setChatApprovalPrompt] = useState("");
  const [chatExecution, setChatExecution] =
    useState<ChatExecutionResponse | null>(null);

  const [codingTask, setCodingTask] = useState("");
  const [codingLoading, setCodingLoading] = useState(false);
  const [codingApproval, setCodingApproval] =
    useState<DeveloperApprovalResponse["approval"] | null>(null);
  const [codingExecutionLoading, setCodingExecutionLoading] =
    useState(false);
  const [codingExecution, setCodingExecution] =
    useState<DeveloperExecutionResponse | null>(null);

  const [error, setError] = useState("");

  const loadApprovals = useCallback(async () => {
    setApprovalLoading(true);
    setError("");

    try {
      const [approvalResult, statusResult] = await Promise.all([
        getApprovals(),
        getApprovalStatus()
      ]);

      if (!approvalResult.success || !statusResult.success) {
        throw new Error("Approval API returned a protected failure");
      }

      const items = Array.isArray(approvalResult.items)
        ? approvalResult.items
        : [];

      setApprovals(items);
      setApprovalStatus(statusResult.status || null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "تعذر قراءة بيانات الموافقات"
      );
    } finally {
      setApprovalLoading(false);
    }
  }, []);

  const handleCreateCodingApproval = useCallback(async () => {
    const task = codingTask.trim();

    if (!task) {
      setError("أدخل مهمة برمجية أولًا.");
      return;
    }

    setCodingLoading(true);
    setError("");
    setCodingApproval(null);

    try {
      const result = await createDeveloperApproval(task);

      if (!result.success || !result.approval) {
        throw new Error(
          result.type || "تعذر إنشاء موافقة مهمة التطوير"
        );
      }

      setCodingApproval(result.approval);
      await loadApprovals();
    } catch (codingError) {
      setError(
        codingError instanceof Error
          ? codingError.message
          : "تعذر إنشاء طلب موافقة التطوير"
      );
    } finally {
      setCodingLoading(false);
    }
  }, [codingTask, loadApprovals]);

  const handleExecuteCodingApproval = useCallback(async () => {
    const approvalId = codingApproval?.id?.trim();

    if (!approvalId || codingApproval?.status !== "approved") {
      setError("لا يمكن تنفيذ مهمة التطوير قبل اعتماد الموافقة.");
      return;
    }

    setCodingExecutionLoading(true);
    setError("");
    setCodingExecution(null);

    try {
      const result = await executeApprovedDeveloper(approvalId);

      if (!result.success) {
        throw new Error(
          typeof result.message === "string"
            ? result.message
            : result.type ||
              "تعذر تنفيذ مهمة التطوير المعتمدة"
        );
      }

      setCodingExecution(result);
      await loadApprovals();
    } catch (executionError) {
      setError(
        executionError instanceof Error
          ? executionError.message
          : "تعذر تنفيذ مهمة التطوير المعتمدة"
      );
    } finally {
      setCodingExecutionLoading(false);
    }
  }, [codingApproval, loadApprovals]);

  const handleApprovalAction = useCallback(
    async (approvalId: string, action: "approve" | "reject") => {
      setApprovalLoading(true);
      setError("");

      try {
        const result =
          action === "approve"
            ? await approveApproval(approvalId)
            : await rejectApproval(approvalId);

        if (!result.success) {
          throw new Error(
            result.message || result.type || "Approval action failed"
          );
        }

        if (codingApproval?.id === approvalId) {
          setCodingApproval((current) =>
            current
              ? {
                  ...current,
                  status:
                    action === "approve"
                      ? "approved"
                      : "rejected"
                }
              : current
          );
        }

        await loadApprovals();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "تعذر تنفيذ إجراء الموافقة"
        );
      } finally {
        setApprovalLoading(false);
      }
    },
    [codingApproval, loadApprovals]
  );

  const loadMonitor = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [planResult, executionResult, historyResult] =
        await Promise.all([
          getPlanStatus(),
          getExecutionStatus(),
          getExecutionHistory()
        ]);

      if (
        !planResult.success ||
        !executionResult.success ||
        !historyResult.success
      ) {
        throw new Error("Monitor API returned a protected failure");
      }

      setPlanStatus(planResult.status || null);
      setExecutionStatus(executionResult.status || null);
      setHistory(Array.isArray(historyResult.items) ? historyResult.items : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "تعذر قراءة بيانات المراقبة"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRevenue = useCallback(async () => {
    setRevenueLoading(true);
    setError("");

    try {
      const [statusResult, opportunitiesResult, plansResult] =
        await Promise.all([
          getRevenueStatus(),
          getRevenueOpportunities(),
          getRevenuePlans()
        ]);

      if (
        !statusResult.success ||
        !opportunitiesResult.success ||
        !plansResult.success
      ) {
        throw new Error("Revenue API returned a protected failure");
      }

      setRevenueStatus(statusResult.status || null);
      setRevenueOpportunities(
        Array.isArray(opportunitiesResult.items)
          ? opportunitiesResult.items
          : []
      );
      setRevenuePlans(
        Array.isArray(plansResult.items)
          ? plansResult.items
          : []
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "تعذر قراءة بيانات الأرباح"
      );
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  const loadDiagnostics = useCallback(async () => {
    setDiagnosticLoading(true);
    setError("");

    try {
      const [statusResult, reportResult] = await Promise.all([
        getDiagnosticStatus(),
        getDiagnosticReport()
      ]);

      if (!statusResult.success) {
        throw new Error("Diagnostic status API returned a protected failure");
      }

      setDiagnosticStatus(statusResult.status || null);
      setDiagnosticReport(reportResult);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "تعذر قراءة بيانات التدقيق"
      );
    } finally {
      setDiagnosticLoading(false);
    }
  }, []);

  const handleDiagnosticRun = useCallback(async () => {
    setDiagnosticLoading(true);
    setError("");

    try {
      const result = await runDiagnostic();

      if (!result.success) {
        throw new Error(
          `Diagnostic run failed: ${result.status || "FAIL"}`
        );
      }

      setDiagnosticReport(result);

      const statusResult = await getDiagnosticStatus();

      if (!statusResult.success) {
        throw new Error("Diagnostic status API returned a protected failure");
      }

      setDiagnosticStatus(statusResult.status || null);
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "تعذر تشغيل التشخيص"
      );
    } finally {
      setDiagnosticLoading(false);
    }
  }, []);

  const handleChatSubmit = useCallback(async () => {
    const prompt = chatInput.trim();

    if (!prompt || chatLoading) {
      return;
    }

    setChatLoading(true);
    setError("");
    setChatExecution(null);
    setChatApproval(null);
    setChatApprovalPrompt("");

    setChatMessages((current) => [
      ...current,
      { role: "user", content: prompt }
    ]);
    setChatInput("");

    try {
      const result = await chat(prompt);

      if (!result.success) {
        throw new Error(
          result.message || "تعذر معالجة رسالة المحادثة"
        );
      }

      if (result.type === "conversation_response") {
        const assistantText =
          typeof result.text === "string"
            ? result.text
            : typeof result.message === "string"
              ? result.message
              : "تمت معالجة رسالتك.";

        setChatMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: assistantText
          }
        ]);

        return;
      }

      if (result.type === "action_proposal") {
        if (
          result.approvalRequired !== true ||
          result.executionAllowed === true
        ) {
          throw new Error(
            "رفض آمن: عقد العملية التنفيذية غير صالح."
          );
        }

        const approval = await createChatApproval(prompt);

        if (
          !approval.success ||
          !approval.approval?.id
        ) {
          throw new Error(
            approval.message ||
            "تعذر إنشاء بوابة الموافقة للعملية المقترحة."
          );
        }

        setChatApproval(approval.approval);
        setChatApprovalPrompt(prompt);

        setChatMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              "تم تحليل طلبك كعملية تنفيذية. تمت صياغة المقترح وإنشاء طلب موافقة آمن. لن يتم التنفيذ قبل موافقتك الصريحة."
          }
        ]);

        return;
      }

      throw new Error(
        "استجابة المحادثة غير معروفة."
      );
    } catch (chatError) {
      const errorMessage =
        chatError instanceof Error
          ? chatError.message
          : "تعذر الاتصال بقناة المحادثة";

      setError(errorMessage);

      setChatMessages((messages) => [
        ...messages,
        {
          role: "assistant",
          content: `تعذر الحصول على رد من الوكيل: ${errorMessage}`
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading]);

  const handleChatApprove = useCallback(async () => {
    if (
      !chatApproval?.id ||
      !chatApprovalPrompt.trim() ||
      chatLoading
    ) {
      return;
    }

    setChatLoading(true);
    setError("");

    try {
      const approvalResult = await approveApproval(chatApproval.id);

      if (!approvalResult.success) {
        throw new Error(
          approvalResult.message || "تعذر اعتماد طلب المحادثة"
        );
      }

      const result = await executeApprovedChat(
        chatApproval.id,
        chatApprovalPrompt
      );

      if (!result.success) {
        throw new Error(
          result.message || "تعذر تنفيذ طلب المحادثة بعد الموافقة"
        );
      }

      setChatExecution(result);
      setChatApproval(null);

      const executionResult = result.result as {
        steps?: Array<{
          result?: {
            text?: unknown;
          } | null;
        }>;
      } | null;

      const firstStepResult =
        executionResult &&
        Array.isArray(executionResult.steps) &&
        executionResult.steps.length > 0
          ? executionResult.steps[0]
          : null;

      const geminiResult = firstStepResult?.result || null;

      const assistantText =
        typeof result.result === "string"
          ? result.result
          : typeof geminiResult?.text === "string"
            ? geminiResult.text
            : typeof result.message === "string"
              ? result.message
              : "تمت معالجة طلب المحادثة بنجاح.";

      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: assistantText
        }
      ]);
    } catch (chatError) {
      setError(
        chatError instanceof Error
          ? chatError.message
          : "تعذر تنفيذ طلب المحادثة"
      );
    } finally {
      setChatLoading(false);
    }
  }, [chatApproval, chatApprovalPrompt, chatLoading]);

  const handleChatReject = useCallback(() => {
    setChatApproval(null);
    setChatApprovalPrompt("");
    setChatExecution(null);
  }, []);

  useEffect(() => {
    if (active === "plans" || active === "execution" || active === "overview") {
      void loadMonitor();
    }

    if (active === "approvals") {
      void loadApprovals();
    }

    if (active === "audit") {
      void loadDiagnostics();
    }

    if (active === "revenue") {
      void loadRevenue();
    }
  }, [
    active,
    loadApprovals,
    loadDiagnostics,
    loadMonitor,
    loadRevenue
  ]);

  const activeSection = sections.find((item) => item.id === active);
  const monitorVisible = active === "plans" || active === "execution";

  const handleVoiceInput = () => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };

    const Recognition =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setChatMessages((messages) => [
        ...messages,
        {
          role: "assistant",
          content:
            "الإدخال الصوتي غير مدعوم في هذا المتصفح. يمكنك استخدام الكتابة حالياً."
        }
      ]);
      return;
    }

    const recognition = new Recognition();

    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setVoiceListening(true);
    };

    recognition.onresult = (event) => {
      const result = event.results[0]?.[0]?.transcript?.trim();

      if (result) {
        setChatInput((current) =>
          current ? `${current} ${result}` : result
        );
      }
    };

    recognition.onerror = (event) => {
      setVoiceListening(false);

      const reason = event.error || "unknown";

      if (reason !== "aborted") {
        setChatMessages((messages) => [
          ...messages,
          {
            role: "assistant",
            content:
              `تعذر التقاط الإدخال الصوتي. رمز الخطأ: ${reason}.`
          }
        ]);
      }
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    try {
      recognition.start();
    } catch {
      setVoiceListening(false);
    }
  };

  const activeHub =
    hubs.find((hub) => hub.id === activeWorkspace) ?? hubs[0];

  const renderHubIcon = (icon: string) => {
    if (icon === "chat") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2v-4.3A7.4 7.4 0 0 1 4.5 7.5 7.5 7.5 0 0 1 12 4h.5A7.5 7.5 0 0 1 20 11.5Z" />
        </svg>
      );
    }

    if (icon === "code") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
        </svg>
      );
    }

    if (icon === "edit") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4M14 20h6" />
        </svg>
      );
    }

    if (icon === "studio") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="4" width="17" height="16" rx="3" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m5.5 17 4.5-4 3 2 2-2 3.5 4" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 20 6v5c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z" />
        <path d="M9.5 12 11 13.5l3.5-3.5" />
      </svg>
    );
  };

  return (
    <div className="app-shell modern-platform-shell" dir="rtl">
      <header className="topbar modern-topbar">
        <div className="topbar-copy">
          <div className="brand">
            <span className="brand-mark modern-brand-mark" aria-hidden="true">✦</span>
            <span>أبو بشة</span>
          </div>
        </div>

        <div className="status modern-status" aria-label="حالة Runtime">
          <span className="status-dot" aria-hidden="true" />
          <span>متصل</span>
        </div>
      </header>

      <nav className="hub-nav" aria-label="أقسام أبو بشة الرئيسية">
        <div className="hub-nav-scroll">
          {hubs.map((hub) => (
            <button
              key={hub.id}
              className={
                activeHub.id === hub.id
                  ? "hub-nav-item active"
                  : "hub-nav-item"
              }
              type="button"
              onClick={() => setActiveWorkspace(hub.id)}
              aria-current={activeHub.id === hub.id ? "page" : undefined}
            >
              <span className="hub-nav-icon">
                {renderHubIcon(hub.icon)}
              </span>
              <span>{hub.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="content">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">ABU BASHA AI · CENTRAL CORE</span>
            <h1>{activeWorkspace === "chat" ? "المحادثة" : activeHub.label}</h1>
            <p>
              مساحة التحكم المركزية للوكيل، مع محادثة ذكية وتنفيذ محكوم
              بالموافقة وطبقات حماية تعمل بشكل Fail-Closed.
            </p>
          </div>
          <div className="hero-badge" aria-label="حالة النظام">
            <span className="hero-badge-dot" aria-hidden="true" />
            <span>النواة متصلة</span>
          </div>
        </section>

        <section className="grid">
          <article className="card">
            <span className="card-label">حالة الوكيل</span>
            <strong>جاهز</strong>
            <small>Runtime operational</small>
          </article>

          <article className="card">
            <span className="card-label">الخطط المسجلة</span>
            <strong>{planStatus?.plans ?? "—"}</strong>
            <small>{statusLabel(planStatus?.status)}</small>
          </article>

          <article className="card">
            <span className="card-label">التنفيذ</span>
            <strong>{executionStatus?.executed ?? "—"}</strong>
            <small>عمليات مسجلة</small>
          </article>

          <article className="card">
            <span className="card-label">التنفيذ الذاتي</span>
            <strong>معطل</strong>
            <small>Autonomous execution disabled</small>
          </article>
        </section>

        {activeWorkspace === "coding" ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <span className="workspace-kicker">CODING WORKSPACE</span>
                <h2>البرمجة</h2>
                <p>تنفيذ مهام التطوير عبر عقدة الموافقة المعتمدة.</p>
              </div>
            </div>

            <div className="workspace-body">
              <div className="card">
                <span className="card-label">مهمة التطوير</span>

                <textarea
                  value={codingTask}
                  onChange={(event) => setCodingTask(event.target.value)}
                  placeholder="اكتب المهمة البرمجية التي تريد تنفيذها..."
                  rows={6}
                  disabled={codingLoading}
                />

                <button
                  type="button"
                  onClick={handleCreateCodingApproval}
                  disabled={codingLoading || !codingTask.trim()}
                >
                  {codingLoading
                    ? "جاري إنشاء طلب الموافقة..."
                    : "طلب موافقة التنفيذ"}
                </button>
              </div>

              {codingApproval ? (
                <div className="card">
                  <span className="card-label">الموافقة</span>
                  <strong>{codingApproval.status || "pending_approval"}</strong>
                  <small>
                    Approval ID: {codingApproval.id || "—"}
                  </small>
                  <small>
                    التنفيذ لا يتم من الواجهة مباشرة، ولا يصبح متاحًا إلا
                    عبر مسار الموافقة المعتمد.
                  </small>

                  {codingApproval.status === "approved" ? (
                    <button
                      type="button"
                      onClick={handleExecuteCodingApproval}
                      disabled={codingExecutionLoading}
                    >
                      {codingExecutionLoading
                        ? "جاري تنفيذ المهمة المعتمدة..."
                        : "تنفيذ المهمة المعتمدة"}
                    </button>
                  ) : null}

                  {codingExecution ? (
                    <small>
                      حالة التنفيذ:{" "}
                      {codingExecution.success ? "نجح" : "فشل"}
                    </small>
                  ) : null}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>لا توجد موافقة نشطة</strong>
                  <span>
                    اكتب مهمة ثم اطلب الموافقة. لن يتم تنفيذ أي أمر
                    برمجي في هذه المرحلة.
                  </span>
                </div>
              )}
            </div>
          </section>
        ) : activeWorkspace === "editing" ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <span className="workspace-kicker">EDITING WORKSPACE</span>
                <h2>المونتاج</h2>
                <p>مساحة مستقلة لأدوات الوسائط والمونتاج.</p>
              </div>
            </div>
            <div className="workspace-body">
              <div className="empty-state">
                <strong>مساحة المونتاج جاهزة</strong>
                <span>
                  قدرات الوسائط ستظهر هنا عندما تكون مدعومة بعقد Capability
                  واضح وقابل للتدقيق.
                </span>
              </div>
            </div>
          </section>
        ) : activeWorkspace === "studio" ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <span className="workspace-kicker">STUDIO WORKSPACE</span>
                <h2>الاستوديو</h2>
                <p>مساحة موحدة للمحتوى والمشاريع والأصول.</p>
              </div>
            </div>
            <div className="workspace-body">
              <div className="empty-state">
                <strong>الاستوديو جاهز</strong>
                <span>
                  سيتم عرض أدوات الاستوديو من خلال قدرات حقيقية قابلة للتدقيق.
                </span>
              </div>
            </div>
          </section>
        ) : activeWorkspace === "control" ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <span className="workspace-kicker">CONTROL &amp; SECURITY</span>
                <h2>التحكم والأمان</h2>
                <p>المراقبة والموافقات والتدقيق والحالة التشغيلية.</p>
              </div>
            </div>
            <div className="workspace-body">
              <div className="empty-state">
                <strong>مركز التحكم والأمان</strong>
                <span>
                  أدوات المراقبة والموافقات والتدقيق ستُنقل إلى هذه المساحة
                  تدريجيًا مع الحفاظ على المسار الأمني الحالي.
                </span>
              </div>
            </div>
          </section>
        ) : monitorVisible ? (
          <section className="monitor-stack">
            <section className="workspace">
              <div className="workspace-header">
                <span>Plan Registry</span>
                <span className="protected">READ ONLY</span>
              </div>

              <div className="monitor-body">
                <div className="monitor-row">
                  <span>الحالة</span>
                  <strong>{statusLabel(planStatus?.status)}</strong>
                </div>
                <div className="monitor-row">
                  <span>الإصدار</span>
                  <strong>{planStatus?.version || "—"}</strong>
                </div>
                <div className="monitor-row">
                  <span>عدد الخطط</span>
                  <strong>{planStatus?.plans ?? "—"}</strong>
                </div>
              </div>
            </section>

            <section className="workspace">
              <div className="workspace-header">
                <span>Execution Monitor</span>
                <span className="protected">READ ONLY</span>
              </div>

              <div className="monitor-body">
                <div className="monitor-row">
                  <span>الحالة</span>
                  <strong>{statusLabel(executionStatus?.status)}</strong>
                </div>
                <div className="monitor-row">
                  <span>التنفيذات</span>
                  <strong>{executionStatus?.executed ?? "—"}</strong>
                </div>
                <div className="monitor-row">
                  <span>السجل</span>
                  <strong>{executionStatus?.history ?? history.length}</strong>
                </div>
              </div>
            </section>

            <section className="workspace">
              <div className="workspace-header">
                <span>Execution History</span>
                <span className="protected">READ ONLY</span>
              </div>

              <div className="history-list">
                {history.length === 0 ? (
                  <div className="empty-state">
                    لا توجد عمليات مسجلة للعرض.
                  </div>
                ) : (
                  history.map((item, index) => (
                    <article className="history-item" key={index}>
                      <strong>
                        {String(
                          item.planId ??
                            item.plan ??
                            item.name ??
                            `عملية ${index + 1}`
                        )}
                      </strong>
                      <small>
                        {String(
                          item.status ??
                            item.result ??
                            item.outcome ??
                            "سجل تنفيذ"
                        )}
                      </small>
                    </article>
                  ))
                )}
              </div>
            </section>

            {error ? <div className="error-state">{error}</div> : null}

            <button
              className="refresh-button"
              type="button"
              onClick={() => void loadMonitor()}
              disabled={loading}
            >
              {loading ? "جارٍ التحديث..." : "تحديث البيانات"}
            </button>
          </section>
        ) : active === "audit" ? (
          <section className="monitor-stack diagnostic-stack">
            <section className="workspace">
              <div className="workspace-header">
                <span>Diagnostic Center</span>
                <span className="protected">READ ONLY</span>
              </div>

              <div className="monitor-body">
                <div className="monitor-row">
                  <span>الحالة</span>
                  <strong>{statusLabel(diagnosticStatus?.mode)}</strong>
                </div>
                <div className="monitor-row">
                  <span>المركز</span>
                  <strong>{diagnosticStatus?.name || "—"}</strong>
                </div>
                <div className="monitor-row">
                  <span>المزوّدون</span>
                  <strong>
                    {diagnosticStatus?.providers?.length ?? 0}
                  </strong>
                </div>
                <div className="monitor-row">
                  <span>التشخيصات السابقة</span>
                  <strong>{diagnosticStatus?.history ?? 0}</strong>
                </div>
              </div>
            </section>

            <section className="workspace">
              <div className="workspace-header">
                <span>Safety Boundary</span>
                <span className="protected">FAIL CLOSED</span>
              </div>

              <div className="monitor-body">
                <div className="monitor-row">
                  <span>Read Only</span>
                  <strong>{diagnosticStatus?.readOnly ? "مفعل" : "غير مفعل"}</strong>
                </div>
                <div className="monitor-row">
                  <span>Auto Fix</span>
                  <strong>{diagnosticStatus?.autoFix ? "مفعل" : "معطل"}</strong>
                </div>
                <div className="monitor-row">
                  <span>تنفيذ خارجي</span>
                  <strong>
                    {diagnosticStatus?.externalExecution ? "مفعل" : "معطل"}
                  </strong>
                </div>
                <div className="monitor-row">
                  <span>تنفيذ ذاتي</span>
                  <strong>
                    {diagnosticStatus?.autonomousExecution ? "مفعل" : "معطل"}
                  </strong>
                </div>
                <div className="monitor-row">
                  <span>Fail Closed</span>
                  <strong>{diagnosticStatus?.failClosed ? "مفعل" : "غير مفعل"}</strong>
                </div>
              </div>
            </section>

            <section className="workspace">
              <div className="workspace-header">
                <span>Latest Diagnostic Report</span>
                <span className="protected">DIAGNOSTIC ONLY</span>
              </div>

              {!diagnosticReport ? (
                <div className="empty-state">
                  لم يتم تشغيل تشخيص بعد.
                </div>
              ) : (
                <div className="monitor-body">
                  <div className="monitor-row">
                    <span>النتيجة</span>
                    <strong>{diagnosticReport.status}</strong>
                  </div>
                  <div className="monitor-row">
                    <span>المزوّدون المفحوصون</span>
                    <strong>
                      {diagnosticReport.providers?.length ?? 0}
                    </strong>
                  </div>
                  <div className="monitor-row">
                    <span>المدة</span>
                    <strong>
                      {typeof diagnosticReport.duration === "number"
                        ? `${diagnosticReport.duration} ms`
                        : "—"}
                    </strong>
                  </div>
                  <div className="diagnostic-providers">
                    {(diagnosticReport.providers || []).map(
                      (provider, index) => (
                        <article
                          className="diagnostic-provider"
                          key={`${provider.provider || "provider"}-${index}`}
                        >
                          <div className="diagnostic-provider-header">
                            <strong>{provider.provider || "مزوّد"}</strong>
                            <span className="protected">
                              {provider.status || "UNKNOWN"}
                            </span>
                          </div>

                          <small>
                            الفحوصات: {provider.checks?.length ?? 0} ·
                            النتائج: {provider.findings?.length ?? 0} ·
                            التوصيات: {provider.recommendations?.length ?? 0}
                          </small>
                        </article>
                      )
                    )}
                  </div>
                </div>
              )}
            </section>

            {error ? <div className="error-state">{error}</div> : null}

            <div className="diagnostic-actions">
              <button
                className="refresh-button"
                type="button"
                onClick={() => void handleDiagnosticRun()}
                disabled={diagnosticLoading}
              >
                {diagnosticLoading ? "جارٍ تشغيل التشخيص..." : "تشغيل التشخيص"}
              </button>

              <button
                className="refresh-button"
                type="button"
                onClick={() => void loadDiagnostics()}
                disabled={diagnosticLoading}
              >
                {diagnosticLoading ? "جارٍ القراءة..." : "تحديث التدقيق"}
              </button>
            </div>
          </section>
        ) : active === "revenue" ? (
          <section className="monitor-stack revenue-stack">
            <section className="workspace">
              <div className="workspace-header">
                <span>Revenue Engine</span>
                <span className="protected">READ ONLY</span>
              </div>

              <div className="monitor-body">
                <div className="monitor-row">
                  <span>الحالة</span>
                  <strong>{statusLabel(revenueStatus?.status)}</strong>
                </div>
                <div className="monitor-row">
                  <span>الإصدار</span>
                  <strong>{revenueStatus?.version || "—"}</strong>
                </div>
                <div className="monitor-row">
                  <span>فرص الربح</span>
                  <strong>
                    {revenueStatus?.opportunities ??
                      revenueOpportunities.length}
                  </strong>
                </div>
                <div className="monitor-row">
                  <span>خطط الربح</span>
                  <strong>
                    {revenueStatus?.plans ?? revenuePlans.length}
                  </strong>
                </div>
              </div>
            </section>

            <section className="workspace">
              <div className="workspace-header">
                <span>Revenue Opportunities</span>
                <span className="protected">APPROVAL REQUIRED</span>
              </div>

              <div className="revenue-list">
                {revenueOpportunities.length === 0 ? (
                  <div className="empty-state">
                    لا توجد فرص ربح متاحة.
                  </div>
                ) : (
                  revenueOpportunities.map((opportunity) => (
                    <article
                      className="revenue-item"
                      key={opportunity.id}
                    >
                      <div className="revenue-item-header">
                        <div>
                          <strong>{opportunity.name || opportunity.id}</strong>
                          <small>{opportunity.id}</small>
                        </div>
                        <span className="protected">
                          {opportunity.riskLevel || "unknown"}
                        </span>
                      </div>

                      <p>
                        {opportunity.description ||
                          "لا يوجد وصف للفرصة."}
                      </p>

                      <div className="revenue-meta">
                        <span>
                          التصنيف: {opportunity.category || "—"}
                        </span>
                        <span>
                          النموذج: {opportunity.model || "—"}
                        </span>
                        <span>
                          الموافقة:{" "}
                          {opportunity.requiresApproval
                            ? "مطلوبة"
                            : "غير محددة"}
                        </span>
                      </div>

                      {opportunity.monetization?.length ? (
                        <small>
                          مصادر الدخل:{" "}
                          {opportunity.monetization.join(" · ")}
                        </small>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="workspace">
              <div className="workspace-header">
                <span>Revenue Plans</span>
                <span className="protected">PROPOSAL / APPROVAL</span>
              </div>

              <div className="revenue-list">
                {revenuePlans.length === 0 ? (
                  <div className="empty-state">
                    لا توجد خطط ربح مسجلة.
                  </div>
                ) : (
                  revenuePlans.map((plan) => (
                    <article
                      className="revenue-item"
                      key={plan.id}
                    >
                      <div className="revenue-item-header">
                        <div>
                          <strong>{plan.name || plan.id}</strong>
                          <small>{plan.id}</small>
                        </div>
                        <span className="protected">
                          {plan.status || "proposal"}
                        </span>
                      </div>

                      <div className="revenue-meta">
                        <span>
                          الهدف: {plan.target || "online"}
                        </span>
                        <span>
                          الموافقة:{" "}
                          {plan.requiresApproval
                            ? "مطلوبة"
                            : "غير محددة"}
                        </span>
                      </div>

                      {plan.steps?.length ? (
                        <div className="revenue-steps">
                          {plan.steps.map((step, index) => (
                            <small key={`${plan.id}-step-${index}`}>
                              {index + 1}. {step}
                            </small>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>

            {error ? <div className="error-state">{error}</div> : null}

            <button
              className="refresh-button"
              type="button"
              onClick={() => void loadRevenue()}
              disabled={revenueLoading}
            >
              {revenueLoading ? "جارٍ التحديث..." : "تحديث بيانات الأرباح"}
            </button>
          </section>
        ) : active === "approvals" ? (
          <section className="workspace">
            <div className="workspace-header">
              <span>Approval Center</span>
              <span className="protected">PROTECTED</span>
            </div>

            <div className="workspace-body approval-center">
              <div className="approval-summary">
                <div className="approval-stat">
                  <span>المعلقة</span>
                  <strong>
                    {approvalStatus?.pending ?? approvals.length}
                  </strong>
                </div>

                <div className="approval-stat">
                  <span>المعتمدة</span>
                  <strong>{approvalStatus?.approved ?? 0}</strong>
                </div>

                <div className="approval-stat">
                  <span>المرفوضة</span>
                  <strong>{approvalStatus?.rejected ?? 0}</strong>
                </div>
              </div>

              {approvals.length === 0 ? (
                <div className="empty-state">
                  لا توجد طلبات موافقة معلقة.
                </div>
              ) : (
                <div className="approval-list">
                  {approvals.map((approval) => (
                    <article className="approval-item" key={approval.id}>
                      <div className="approval-item-header">
                        <div>
                          <strong>
                            {approval.planName ||
                              approval.plan?.name ||
                              "طلب موافقة"}
                          </strong>
                          <small>{approval.id}</small>
                        </div>

                        <span className="protected">
                          {approval.status || "pending_approval"}
                        </span>
                      </div>

                      <p>
                        {approval.plan?.goal ||
                          "لا يوجد وصف للخطة."}
                      </p>

                      <div className="approval-actions">
                        <button
                          className="refresh-button"
                          type="button"
                          onClick={() =>
                            void handleApprovalAction(
                              approval.id,
                              "approve"
                            )
                          }
                          disabled={
                            approvalLoading ||
                            approval.status !== "pending_approval"
                          }
                        >
                          موافقة
                        </button>

                        <button
                          className="refresh-button approval-reject"
                          type="button"
                          onClick={() =>
                            void handleApprovalAction(
                              approval.id,
                              "reject"
                            )
                          }
                          disabled={
                            approvalLoading ||
                            approval.status !== "pending_approval"
                          }
                        >
                          رفض
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {error ? (
                <div className="error-state">{error}</div>
              ) : null}

              <button
                className="refresh-button"
                type="button"
                onClick={() => void loadApprovals()}
                disabled={approvalLoading}
              >
                {approvalLoading ? "جارٍ التحديث..." : "تحديث الموافقات"}
              </button>
            </div>
          </section>
        ) : active === "chat" ? (
          <section className="workspace chat-workspace">
            <div className="chat-header">
              <div className="chat-header-main">
                <div className="chat-avatar" aria-hidden="true">
                  ✦
                </div>

                <div className="chat-header-copy">
                  <strong>مساعد أبو بشة</strong>
                  <span>
                    محادثة آمنة عبر النواة المركزية
                  </span>
                </div>
              </div>

              <div className="chat-status">
                <span className="chat-status-dot" />
                <span>متصل</span>
              </div>
            </div>

            <div className="chat-panel">
              <div
                className="chat-messages"
                aria-live="polite"
                aria-busy={chatLoading}
              >
                {chatMessages.length === 0 ? (
                  <div className="chat-empty">
                    <div className="chat-empty-icon" aria-hidden="true">
                      ✦
                    </div>

                    <div className="chat-empty-badge">
                      CENTRAL CORE
                    </div>

                    <h2>مرحبًا بك في المحادثة</h2>

                    <p>
                      اكتب ما تريد، وسيحدد الوكيل بأمان ما إذا كان طلبك
                      محادثة عادية أو عملية تحتاج إلى موافقة صريحة.
                    </p>

                    <div className="chat-empty-safety">
                      <span>🛡</span>
                      <span>لا يوجد تنفيذ تلقائي</span>
                    </div>
                  </div>
                ) : (
                  <div className="chat-message-list">
                    {chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`chat-message ${message.role}`}
                      >
                        <div className="chat-message-avatar" aria-hidden="true">
                          {message.role === "user" ? "أ" : "✦"}
                        </div>

                        <div className="chat-message-body">
                          <div className="chat-message-meta">
                            <span className="chat-role">
                              {message.role === "user"
                                ? "أنت"
                                : "أبو بشة"}
                            </span>
                          </div>

                          <div className="chat-message-content">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {chatLoading ? (
                  <div className="chat-loading" aria-label="جارٍ المعالجة">
                    <div className="chat-message-avatar" aria-hidden="true">
                      ✦
                    </div>

                    <div className="chat-loading-bubble">
                      <span />
                      <span />
                      <span />
                      <em>أبو بشة يعالج طلبك...</em>
                    </div>
                  </div>
                ) : null}
              </div>

              {chatApproval ? (
                <section className="chat-approval-card" aria-live="polite">
                  <div className="chat-card-icon" aria-hidden="true">
                    🛡
                  </div>

                  <div className="chat-card-content">
                    <div className="chat-card-eyebrow">
                      يتطلب موافقتك
                    </div>

                    <strong>تم تجهيز عملية للتنفيذ</strong>

                    <p>
                      لن يتم تنفيذ هذه العملية قبل موافقتك الصريحة.
                    </p>

                    <div className="chat-approval-prompt">
                      {chatApprovalPrompt}
                    </div>

                    <div className="chat-approval-actions">
                      <button
                        className="refresh-button chat-primary-action"
                        type="button"
                        onClick={() => void handleChatApprove()}
                        disabled={chatLoading}
                      >
                        {chatLoading
                          ? "جارٍ التنفيذ..."
                          : "موافقة وتنفيذ"}
                      </button>

                      <button
                        className="refresh-button approval-reject"
                        type="button"
                        onClick={handleChatReject}
                        disabled={chatLoading}
                      >
                        رفض
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              {chatExecution ? (
                <section className="chat-execution-result" aria-live="polite">
                  <div className="chat-card-icon" aria-hidden="true">
                    ✓
                  </div>

                  <div className="chat-card-content">
                    <div className="chat-card-eyebrow">
                      EXECUTION RESULT
                    </div>

                    <strong>اكتمل تنفيذ العملية</strong>

                    <p>
                      {typeof chatExecution.result === "string"
                        ? chatExecution.result
                        : chatExecution.result &&
                            typeof chatExecution.result === "object" &&
                            "text" in chatExecution.result &&
                            typeof chatExecution.result.text === "string"
                          ? chatExecution.result.text
                          : chatExecution.message ||
                            "تمت معالجة الطلب بنجاح."}
                    </p>
                  </div>
                </section>
              ) : null}

              <form
                className="chat-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleChatSubmit();
                }}
              >
                <div className="chat-composer-inner">
                  <div className="chat-composer-toolbar">
                    <div className="chat-tools-menu-wrap">
                      <button
                        className={
                          chatToolsOpen
                            ? "chat-tool-button chat-plus-button is-open"
                            : "chat-tool-button chat-plus-button"
                        }
                        type="button"
                        disabled={chatLoading}
                        aria-label={chatToolsOpen ? "إغلاق الأدوات" : "إضافة"}
                        aria-expanded={chatToolsOpen}
                        title={chatToolsOpen ? "إغلاق الأدوات" : "إضافة"}
                        onClick={() => setChatToolsOpen((open) => !open)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>

                      {chatToolsOpen ? (
                        <div
                          className="chat-tools-menu"
                          role="menu"
                          aria-label="أدوات الإضافة"
                        >
                          <label
                            className="chat-tools-menu-button"
                            title="إضافة صورة"
                            aria-label="إضافة صورة"
                          >
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              disabled={chatLoading}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  setChatInput((current) =>
                                    current
                                      ? `${current}\n[صورة: ${file.name}]`
                                      : `[صورة: ${file.name}]`
                                  );
                                }
                                event.currentTarget.value = "";
                                setChatToolsOpen(false);
                              }}
                            />
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5z" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="m5.5 18 4.5-4.5 3-3 2-2 3.5 3.5" />
                            </svg>
                            <span>صورة</span>
                          </label>

                          <label
                            className="chat-tools-menu-button"
                            title="إضافة فيديو"
                            aria-label="إضافة فيديو"
                          >
                            <input
                              type="file"
                              accept="video/*"
                              hidden
                              disabled={chatLoading}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  setChatInput((current) =>
                                    current
                                      ? `${current}\n[فيديو: ${file.name}]`
                                      : `[فيديو: ${file.name}]`
                                  );
                                }
                                event.currentTarget.value = "";
                                setChatToolsOpen(false);
                              }}
                            />
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <rect x="3" y="5" width="13" height="14" rx="2" />
                              <path d="m16 10 5-3v10l-5-3z" />
                            </svg>
                            <span>فيديو</span>
                          </label>

                          <label
                            className="chat-tools-menu-button"
                            title="إضافة ملف"
                            aria-label="إضافة ملف"
                          >
                            <input
                              type="file"
                              hidden
                              disabled={chatLoading}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  setChatInput((current) =>
                                    current
                                      ? `${current}\n[ملف: ${file.name}]`
                                      : `[ملف: ${file.name}]`
                                  );
                                }
                                event.currentTarget.value = "";
                                setChatToolsOpen(false);
                              }}
                            />
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                              <path d="M14 3v5h5M8 13h8M8 17h6" />
                            </svg>
                            <span>ملف</span>
                          </label>

                          <button
                            className="chat-tools-menu-button"
                            type="button"
                            disabled={chatLoading}
                            aria-label="إضافة رابط"
                            title="إضافة رابط"
                            onClick={() => {
                              const url = window.prompt("ألصق الرابط هنا");
                              if (url?.trim()) {
                                setChatInput((current) =>
                                  current
                                    ? `${current}\n${url.trim()}`
                                    : url.trim()
                                );
                              }
                              setChatToolsOpen(false);
                            }}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" />
                              <path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 7 20l1.15-1.15" />
                            </svg>
                            <span>رابط</span>
                          </button>

                          <button
                            className="chat-tools-menu-button"
                            type="button"
                            disabled={chatLoading}
                            aria-label="لصق من الحافظة"
                            title="لصق من الحافظة"
                            onClick={async () => {
                              try {
                                const text = await navigator.clipboard.readText();
                                if (text.trim()) {
                                  setChatInput((current) =>
                                    current
                                      ? `${current} ${text.trim()}`
                                      : text.trim()
                                  );
                                }
                              } catch {
                                const text = window.prompt(
                                  "ألصق النص أو الرابط هنا"
                                );
                                if (text?.trim()) {
                                  setChatInput((current) =>
                                    current
                                      ? `${current} ${text.trim()}`
                                      : text.trim()
                                  );
                                }
                              }
                              setChatToolsOpen(false);
                            }}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <rect x="8" y="7" width="11" height="13" rx="2" />
                              <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>لصق</span>
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <button
                      className={
                        voiceListening
                          ? "chat-tool-button chat-mic-button is-listening"
                          : "chat-tool-button chat-mic-button"
                      }
                      type="button"
                      disabled={chatLoading}
                      aria-label="التحدث بالصوت"
                      title="التحدث بالصوت"
                      onClick={handleVoiceInput}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
                      </svg>
                    </button>
                  </div>

                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="اكتب رسالتك إلى أبو بشة..."
                    rows={1}
                    disabled={chatLoading}
                    aria-label="رسالة المحادثة"
                  />

                  <button
                    className="chat-send-button"
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    aria-label={
                      chatLoading ? "جارٍ الإرسال" : "إرسال الرسالة"
                    }
                    title={chatLoading ? "جارٍ الإرسال" : "إرسال"}
                  >
                    {chatLoading ? "…" : "↑"}
                  </button>
                </div>

                <div className="chat-composer-hint">
                  <span>صورة</span>
                  <span>فيديو</span>
                  <span>ملف</span>
                  <span>رابط</span>
                  <span>الموافقة مطلوبة لأي عملية تنفيذية</span>
                </div>
              </form>
            </div>
          </section>
        ) : (
          <section className="workspace">
            <div className="workspace-header">
              <span>Control Surface</span>
              <span className="protected">PROTECTED</span>
            </div>

            <div className="workspace-body">
              <div className="placeholder-icon">{activeSection?.icon}</div>
              <h2>{activeSection?.label}</h2>
              <p>
                هذه الطبقة تعرض الحالة والبيانات فقط. لا توجد هنا أي قناة تنفيذ
                مباشر.
              </p>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Control Center navigation">
        {sections.map((section) => (
          <button
            key={section.id}
            className={active === section.id ? "nav-item active" : "nav-item"}
            onClick={() => setActive(section.id)}
            type="button"
          >
            <span>{section.icon}</span>
            <small>{section.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;

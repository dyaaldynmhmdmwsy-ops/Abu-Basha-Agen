import { ControlWorkspace } from "./ui/ControlWorkspace";
import { StudioWorkspace } from "./ui/StudioWorkspace";
import { EditingWorkspace } from "./ui/EditingWorkspace";
import { WORKSPACE_CATALOG } from "./ui";
import { CodingWorkspace } from "./ui/CodingWorkspace";
import "./ui/codingWorkspace.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState } from "react";
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
  chatStream,
  cancelChat,
  synthesizeVoice,
  getSettings,
  updateSettings,
  type SettingsData,
  type SettingsResponse,
  type ChatApprovalResponse,
  type ChatExecutionResponse,
  type DeveloperApprovalResponse,
  type DeveloperExecutionResponse,
  type ProjectWorkspace,
  getProjectWorkspaceStatus,
  listProjectWorkspaces,
  createProjectWorkspace,
  getDevelopmentPipelineStatus,
  type DevelopmentPipelineStatusResponse,
  AudioRecorder,
  transcribeVoice
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
  | "overview"
  | "chat"
  | "coding"
  | "editing"
  | "studio"
  | "control"
  | "settings";

type WorkspaceId = Hub;

const WORKSPACE_ICONS: Record<WorkspaceId, string> = {
  overview: "overview",
  chat: "chat",
  coding: "code",
  editing: "edit",
  studio: "studio",
  control: "control",
  settings: "settings"
};

const hubs = WORKSPACE_CATALOG.map((workspace) => ({
  id: workspace.id,
  label: workspace.title,
  icon: WORKSPACE_ICONS[workspace.id]
}));

type WorkspaceTool = {
  id: string;
  name: string;
  kind: "app" | "service" | "resource";
  status: "available" | "disabled";
};

const TOOL_CATALOG: Record<WorkspaceId, WorkspaceTool[]> = {
  overview: [
    { id: "quick-actions", name: "الإجراءات السريعة", kind: "service", status: "available" },
    { id: "activity-center", name: "مركز النشاط", kind: "service", status: "available" }
  ],
  chat: [
    { id: "gemini", name: "Gemini", kind: "service", status: "available" },
    { id: "voice", name: "الصوت", kind: "service", status: "available" }
  ],
  coding: [
    { id: "github", name: "GitHub", kind: "app", status: "disabled" },
    { id: "gitlab", name: "GitLab", kind: "app", status: "disabled" },
    { id: "documentation", name: "التوثيق", kind: "resource", status: "disabled" }
  ],
  editing: [
    { id: "video-editor", name: "محرر الفيديو", kind: "app", status: "disabled" },
    { id: "image-editor", name: "محرر الصور", kind: "app", status: "disabled" },
    { id: "media-library", name: "مكتبة الوسائط", kind: "resource", status: "disabled" }
  ],
  studio: [
    { id: "design-tools", name: "أدوات التصميم", kind: "app", status: "disabled" },
    { id: "asset-library", name: "مكتبة الأصول", kind: "resource", status: "disabled" },
    { id: "creative-services", name: "الخدمات الإبداعية", kind: "service", status: "disabled" }
  ],
  control: [
    { id: "diagnostics", name: "مركز التشخيص", kind: "service", status: "available" },
    { id: "approvals", name: "الموافقات", kind: "service", status: "available" },
    { id: "audit", name: "التدقيق", kind: "service", status: "available" }
  ],
  settings: [
    { id: "tool-registry", name: "سجل الأدوات", kind: "service", status: "available" },
    { id: "security", name: "الأمان والصلاحيات", kind: "service", status: "available" },
    { id: "appearance", name: "المظهر", kind: "service", status: "available" }
  ]
};

/*
 * Legacy section metadata.
 * Kept for existing internal monitoring/render branches.
 * Primary navigation is provided by hubs above.
 */
const sections: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "الرئيسية", icon: "⌂" },
  { id: "chat", label: "المحادثة", icon: "abu-basha-spark" },
  { id: "plans", label: "الخطط", icon: "plans" },
  { id: "approvals", label: "الموافقات", icon: "approvals" },
  { id: "execution", label: "التنفيذ", icon: "execution" },
  { id: "audit", label: "التدقيق", icon: "audit" },
  { id: "revenue", label: "الأرباح", icon: "revenue" }
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

  const [toolHubWorkspace, setToolHubWorkspace] = useState<WorkspaceId | null>(null);
  const [workspaceTools, setWorkspaceTools] =
    useState<Record<WorkspaceId, WorkspaceTool[]>>(TOOL_CATALOG);
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

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSavedAt, setSettingsSavedAt] = useState<number | null>(null);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");

  type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    sourcePrompt?: string;
    action?: {
      approvalId: string;
      prompt: string;
      approvalRequired: true;
      executionAllowed: false;
      status:
        | "pending_approval"
        | "approved"
        | "rejected"
        | "executed"
        | "failed";
    };
  };

  type PersistedChatMessage = Omit<ChatMessage, "action"> & {
    action?: never;
  };

  // STAGE28_CHAT_PERSISTENCE_V1
  const CHAT_PERSISTENCE_VERSION = 1;
  const CHAT_PERSISTENCE_PREFIX = "abu-basha-chat-messages";
  const CHAT_PERSISTENCE_MAX_MESSAGES = 40;

  const getChatPersistenceKey = (sessionId: string) => {
    const normalizedSessionId = sessionId.trim();
    return normalizedSessionId
      ? `${CHAT_PERSISTENCE_PREFIX}:v${CHAT_PERSISTENCE_VERSION}:${normalizedSessionId}`
      : null;
  };

  const isPersistedChatMessage = (
    value: unknown
  ): value is PersistedChatMessage => {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    if (
      typeof candidate.id !== "string" ||
      !candidate.id.trim() ||
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      typeof candidate.content !== "string"
    ) {
      return false;
    }

    if (
      candidate.sourcePrompt !== undefined &&
      typeof candidate.sourcePrompt !== "string"
    ) {
      return false;
    }

    // Persisted UI history is never allowed to carry executable authority.
    if (candidate.action !== undefined) {
      return false;
    }

    return true;
  };

  const readPersistedChatMessages = (
    sessionId: string
  ): PersistedChatMessage[] => {
    const key = getChatPersistenceKey(sessionId);

    if (!key || typeof window === "undefined") {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(key);

      if (!raw) {
        return [];
      }

      const parsed: unknown = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray(
          (parsed as { messages?: unknown }).messages
        )
      ) {
        return [];
      }

      const messages = (
        parsed as { messages: unknown[] }
      ).messages;

      if (!messages.every(isPersistedChatMessage)) {
        return [];
      }

      return messages
        .slice(-CHAT_PERSISTENCE_MAX_MESSAGES)
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          ...(message.sourcePrompt?.trim()
            ? { sourcePrompt: message.sourcePrompt.trim() }
            : {})
        }));
    } catch {
      return [];
    }
  };

  const writePersistedChatMessages = (
    sessionId: string,
    messages: ChatMessage[]
  ) => {
    const key = getChatPersistenceKey(sessionId);

    if (!key || typeof window === "undefined") {
      return;
    }

    const persistedMessages: PersistedChatMessage[] =
      messages
        .filter(
          (message) =>
            !message.action &&
            typeof message.id === "string" &&
            typeof message.content === "string" &&
            (message.role === "user" ||
              message.role === "assistant")
        )
        .slice(-CHAT_PERSISTENCE_MAX_MESSAGES)
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          ...(message.sourcePrompt?.trim()
            ? { sourcePrompt: message.sourcePrompt.trim() }
            : {})
        }));

    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: CHAT_PERSISTENCE_VERSION,
          messages: persistedMessages
        })
      );
    } catch {
      // UI persistence is best-effort and never affects chat authority.
    }
  };

  const createChatMessage = (
    role: ChatMessage["role"],
    content: string,
    sourcePrompt?: string
  ): ChatMessage => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    ...(sourcePrompt?.trim()
      ? { sourcePrompt: sourcePrompt.trim() }
      : {})
  });

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatPersistenceSessionId, setChatPersistenceSessionId] =
    useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSpeakingMessageId, setVoiceSpeakingMessageId] =
    useState<string | null>(null);
  const [chatToolsOpen, setChatToolsOpen] = useState(false);

  const [chatExecution, setChatExecution] =
    useState<ChatExecutionResponse | null>(null);

  const activeChatAbortRef = useRef<AbortController | null>(null);
  const activeChatRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sessionId = window.localStorage.getItem(
      "abu-basha-agent-session-id"
    )?.trim();

    if (!sessionId) {
      setChatPersistenceSessionId(null);
      setChatMessages([]);
      return;
    }

    setChatPersistenceSessionId(sessionId);

    const restoredMessages = readPersistedChatMessages(sessionId);

    // Never hydrate action-bearing state from local persistence.
    setChatMessages(
      restoredMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        ...(message.sourcePrompt
          ? { sourcePrompt: message.sourcePrompt }
          : {})
      }))
    );
  }, []);

  useEffect(() => {
    if (!chatPersistenceSessionId) {
      return;
    }

    writePersistedChatMessages(
      chatPersistenceSessionId,
      chatMessages
    );
  }, [chatMessages, chatPersistenceSessionId]);

  const cancelChatGeneration = useCallback(() => {
    const requestId = activeChatRequestIdRef.current;

    activeChatAbortRef.current?.abort();

    if (requestId) {
      void cancelChat(requestId).catch((error) => {
        console.warn(
          "Chat cancellation boundary request failed:",
          error instanceof Error ? error.message : error
        );
      });
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError("");
    try {
      const response = await getSettings();
      setSettings(response.settings || null);
      setSettingsDirty(false);
      setSettingsSavedAt(null);
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "تعذر تحميل الإعدادات."
      );
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const saveSettings = useCallback(
    async (patch: Partial<SettingsData>) => {
      setSettingsSaving(true);
      setSettingsMessage("");
      setSettingsError("");
      try {
        const response: SettingsResponse = await updateSettings(patch);
        if (response.settings) {
          setSettings(response.settings);
        }
        setSettingsDirty(false);
        setSettingsSavedAt(Date.now());
        setSettingsMessage("تم حفظ الإعدادات.");
      } catch (error) {
        setSettingsError(
          error instanceof Error ? error.message : "تعذر حفظ الإعدادات."
        );
      } finally {
        setSettingsSaving(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeWorkspace === "settings" && !settings && !settingsLoading) {
      void loadSettings();
    }
  }, [activeWorkspace, settings, settingsLoading, loadSettings]);

  const patchSettings = useCallback(
    (section: keyof SettingsData, values: Record<string, unknown>) => {
      setSettings((current) => ({
        ...(current || {}),
        [section]: {
          ...((current?.[section] as Record<string, unknown> | undefined) || {}),
          ...values
        }
      }));
      setSettingsDirty(true);
      setSettingsMessage("");
    },
    []
  );

  const [codingTask, setCodingTask] = useState("");
  const [codingLoading, setCodingLoading] = useState(false);
  const [codingApproval, setCodingApproval] =
    useState<DeveloperApprovalResponse["approval"] | null>(null);
  const [codingExecutionLoading, setCodingExecutionLoading] =
    useState(false);
  const [codingExecution, setCodingExecution] =
    useState<DeveloperExecutionResponse | null>(null);

  const [pipelineStatus, setPipelineStatus] =
    useState<DevelopmentPipelineStatusResponse | null>(null);
  const [pipelineStatusLoading, setPipelineStatusLoading] =
    useState(false);

  const [projectWorkspaces, setProjectWorkspaces] =
    useState<ProjectWorkspace[]>([]);
  const [projectWorkspaceLoading, setProjectWorkspaceLoading] =
    useState(false);
  const [projectWorkspaceSaving, setProjectWorkspaceSaving] =
    useState(false);
  const [projectWorkspaceError, setProjectWorkspaceError] =
    useState("");
  const [projectWorkspaceName, setProjectWorkspaceName] =
    useState("");
  const [projectWorkspacePlatform, setProjectWorkspacePlatform] =
    useState("web");

  const [error, setError] = useState("");

  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const voiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const voiceRequestRef = useRef(0);

  const ensureVoiceAudioContext = useCallback(async () => {
    const existing = voiceAudioContextRef.current;

    if (existing && existing.state !== "closed") {
      if (existing.state === "suspended") {
        await existing.resume();
      }
      return existing;
    }

    const context = new AudioContext();
    voiceAudioContextRef.current = context;

    if (context.state === "suspended") {
      await context.resume();
    }

    return context;
  }, []);
  const refreshDevelopmentPipelineStatus = useCallback(async () => {
    setPipelineStatusLoading(true);
    try {
      const response = await getDevelopmentPipelineStatus();
      if (response.success && response.failClosed === true) {
        setPipelineStatus(response);
      } else {
        setPipelineStatus(null);
      }
    } finally {
      setPipelineStatusLoading(false);
    }
  }, []);

  const loadProjectWorkspaces = useCallback(async () => {
    if (
      activeWorkspace !== "coding" &&
      activeWorkspace !== "editing" &&
      activeWorkspace !== "studio"
    ) {
      return;
    }

    setProjectWorkspaceLoading(true);
    setProjectWorkspaceError("");

    try {
      const [statusResult, listResult] = await Promise.all([
        getProjectWorkspaceStatus(),
        listProjectWorkspaces(activeWorkspace)
      ]);

      if (!statusResult.success || statusResult.failClosed !== true) {
        throw new Error("Project workspace service is unavailable.");
      }

      if (!listResult.success || listResult.failClosed !== true) {
        throw new Error("Project workspace list is unavailable.");
      }

      setProjectWorkspaces(
        Array.isArray(listResult.workspaces)
          ? listResult.workspaces
          : []
      );
    } catch (loadError) {
      setProjectWorkspaces([]);
      setProjectWorkspaceError(
        loadError instanceof Error
          ? loadError.message
          : "تعذر تحميل مشاريع مساحة العمل."
      );
    } finally {
      setProjectWorkspaceLoading(false);
    }
  }, [activeWorkspace]);

  const handleCreateProjectWorkspace = useCallback(async () => {
    const name = projectWorkspaceName.trim();

    if (
      !name ||
      (activeWorkspace !== "coding" &&
        activeWorkspace !== "editing" &&
        activeWorkspace !== "studio")
    ) {
      return;
    }

    setProjectWorkspaceSaving(true);
    setProjectWorkspaceError("");

    try {
      const response = await createProjectWorkspace({
        name,
        type: activeWorkspace,
        platform: projectWorkspacePlatform,
        status: "active"
      });

      if (
        !response.success ||
        response.failClosed !== true ||
        !response.workspace
      ) {
        throw new Error("Project workspace creation was blocked.");
      }

      setProjectWorkspaces((current) => [
        response.workspace as ProjectWorkspace,
        ...current.filter(
          (workspace) => workspace.id !== response.workspace?.id
        )
      ]);
      setProjectWorkspaceName("");
    } catch (createError) {
      setProjectWorkspaceError(
        createError instanceof Error
          ? createError.message
          : "تعذر إنشاء مساحة المشروع."
      );
    } finally {
      setProjectWorkspaceSaving(false);
    }
  }, [
    activeWorkspace,
    projectWorkspaceName,
    projectWorkspacePlatform
  ]);

  useEffect(() => {
    if (
      activeWorkspace === "coding" ||
      activeWorkspace === "editing" ||
      activeWorkspace === "studio"
    ) {
      void loadProjectWorkspaces();
    }
  }, [activeWorkspace, loadProjectWorkspaces]);

  const openToolHub = useCallback((workspace: WorkspaceId) => {
    setToolHubWorkspace(workspace);
  }, []);

  const closeToolHub = useCallback(() => {
    setToolHubWorkspace(null);
  }, []);

  const toggleWorkspaceTool = useCallback(
    (workspace: WorkspaceId, toolId: string) => {
      setWorkspaceTools((current) => ({
        ...current,
        [workspace]: (current[workspace] || []).map((tool) =>
          tool.id === toolId
            ? {
                ...tool,
                status:
                  tool.status === "available" ? "disabled" : "available"
              }
            : tool
        )
      }));
    },
    []
  );



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

      console.log("[ABU_CHAT_TRACE] HANDLER_RESULT", {
      success: result.success,
      type: result.type,
      intent: result.intent
    });

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

  const handleChatSubmit = useCallback(async (overridePrompt?: string) => {
    const prompt = (overridePrompt ?? chatInput).trim();
    if (!prompt || chatLoading) {
      return;
    }

    setChatLoading(true);
    setError("");
    setChatExecution(null);

    setChatMessages((current) => [
      ...current,
      createChatMessage("user", prompt, prompt)
    ]);
    setChatInput("");

    const chatAbortController = new AbortController();
    const requestId = crypto.randomUUID();
    activeChatAbortRef.current = chatAbortController;
    activeChatRequestIdRef.current = requestId;

    let streamStarted = false;
    let streamCompleted = false;
    let streamCancelled = false;
    let streamText = "";
    let hasStreamActionProposal = false;
    let streamActionApprovalRequired: boolean | undefined;
    let streamActionExecutionAllowed: boolean | undefined;

    const assistantMessage = createChatMessage(
      "assistant",
      "",
      prompt
    );

    try {
      console.log("[ABU_CHAT_TRACE] STREAM_HANDLER_START", {
        promptLength: prompt.length
      });

      void ensureVoiceAudioContext();

      await chatStream(
        prompt,
        (chunk) => {
          if (
            chatAbortController.signal.aborted ||
            chunk.type === "chat_generation_cancelled" ||
            chunk.cancelled === true
          ) {
            streamCancelled = true;
            return;
          }

          if (chunk.type === "action_proposal") {
            hasStreamActionProposal = true;
            streamActionApprovalRequired =
              chunk.approvalRequired;
            streamActionExecutionAllowed =
              chunk.executionAllowed;
            return;
          }

          if (
            chunk.success === false ||
            chunk.type === "chat_stream_failed" ||
            chunk.type === "gemini_stream_open_failed" ||
            chunk.type === "gemini_stream_failed" ||
            chunk.type === "streaming_unavailable"
          ) {
            streamCancelled = true;
            const failureMessage =
              typeof chunk.message === "string" && chunk.message.trim()
                ? chunk.message
                : "تعذر إكمال توليد الرد من مزود الذكاء الاصطناعي.";
            throw new Error(failureMessage);
          }

          if (
            chunk.type === "conversation_stream_chunk" &&
            typeof chunk.text === "string"
          ) {
            streamStarted = true;
            streamText += chunk.text;

            setChatMessages((current) => {
              const existing = current.some(
                (message) => message.id === assistantMessage.id
              );

              if (existing) {
                return current.map((message) =>
                  message.id === assistantMessage.id
                    ? { ...message, content: streamText }
                    : message
                );
              }

              return [
                ...current,
                {
                  ...assistantMessage,
                  content: streamText
                }
              ];
            });
            return;
          }

          if (chunk.type === "conversation_stream_end") {
            streamCompleted = true;
          }
        },
        {
          requestId,
          signal: chatAbortController.signal
        }
      );

      if (
        chatAbortController.signal.aborted ||
        streamCancelled
      ) {
        return;
      }

      if (hasStreamActionProposal) {
        activeChatAbortRef.current = null;
        activeChatRequestIdRef.current = null;

        if (
          streamActionApprovalRequired !== true ||
          streamActionExecutionAllowed === true
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

        const actionMessage: ChatMessage = {
          ...createChatMessage(
            "assistant",
            "تم تحليل طلبك كعملية تنفيذية. تمت صياغة المقترح وإنشاء طلب موافقة آمن. لن يتم التنفيذ قبل موافقتك الصريحة.",
            prompt
          ),
          action: {
            approvalId: approval.approval.id,
            prompt,
            approvalRequired: true,
            executionAllowed: false,
            status: "pending_approval"
          }
        };

        setChatMessages((current) => [
          ...current,
          actionMessage
        ]);
        return;
      }

      if (!streamStarted || !streamCompleted) {
        throw new Error(
          "انتهى تدفق المحادثة دون اكتمال عقد الاستجابة."
        );
      }

      const finalAssistantMessage = {
        ...assistantMessage,
        content: streamText
      };

      setChatMessages((current) =>
        current.map((message) =>
          message.id === finalAssistantMessage.id
            ? finalAssistantMessage
            : message
        )
      );

      if (finalAssistantMessage.content.trim()) {
        void playVoiceText(
          finalAssistantMessage.content,
          finalAssistantMessage.id
        );
      }
    } catch (chatError) {
      if (
        chatAbortController.signal.aborted ||
        (chatError instanceof DOMException &&
          chatError.name === "AbortError")
      ) {
        setError("");
        return;
      }

      const errorMessage =
        chatError instanceof Error
          ? chatError.message
          : "تعذر الاتصال بقناة المحادثة";

      setError(errorMessage);
      setChatMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `تعذر الحصول على رد من الوكيل: ${errorMessage}`
        }
      ]);
    } finally {
      if (
        activeChatAbortRef.current === chatAbortController
      ) {
        activeChatAbortRef.current = null;
        activeChatRequestIdRef.current = null;
      }

      setChatLoading(false);
    }
  }, [
    chatInput,
    chatLoading,
    ensureVoiceAudioContext
  ]);

  const handleChatApprove = useCallback(
    async (
      messageId: string,
      action: NonNullable<ChatMessage["action"]>
    ) => {
      if (
        !messageId ||
        !action.approvalId ||
        !action.prompt.trim() ||
        chatLoading ||
        action.approvalRequired !== true ||
        action.executionAllowed !== false ||
        action.status !== "pending_approval"
      ) {
        return;
      }

      setChatLoading(true);
      setError("");

      try {
        const approvalResult = await approveApproval(action.approvalId);

        if (!approvalResult.success) {
          throw new Error(
            approvalResult.message || "تعذر اعتماد طلب المحادثة"
          );
        }

        setChatMessages((current) =>
          current.map((message) =>
            message.id === messageId && message.action
              ? {
                  ...message,
                  action: {
                    ...message.action,
                    status: "approved"
                  }
                }
              : message
          )
        );

        const result = await executeApprovedChat(
          action.approvalId,
          action.prompt
        );

        if (!result.success) {
          throw new Error(
            result.message || "تعذر تنفيذ طلب المحادثة بعد الموافقة"
          );
        }

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

        setChatMessages((current) =>
          current.map((message) =>
            message.id === messageId && message.action
              ? {
                  ...message,
                  action: {
                    ...message.action,
                    status: "executed"
                  }
                }
              : message
          )
        );

        setChatMessages((current) => [
          ...current,
          createChatMessage("assistant", assistantText)
        ]);
      } catch (chatError) {
        setChatMessages((current) =>
          current.map((message) =>
            message.id === messageId && message.action
              ? {
                  ...message,
                  action: {
                    ...message.action,
                    status: "failed"
                  }
                }
              : message
          )
        );

        setError(
          chatError instanceof Error
            ? chatError.message
            : "تعذر تنفيذ طلب المحادثة"
        );
      } finally {
        setChatLoading(false);
      }
    },
    [chatLoading]
  );

  const handleChatReject = useCallback(
    async (
      messageId: string,
      action: NonNullable<ChatMessage["action"]>
    ) => {
      if (
        !messageId ||
        !action.approvalId ||
        chatLoading ||
        action.approvalRequired !== true ||
        action.executionAllowed !== false ||
        action.status !== "pending_approval"
      ) {
        return;
      }

      setChatLoading(true);
      setError("");

      try {
        const result = await rejectApproval(action.approvalId);

        if (!result.success) {
          throw new Error(
            result.message || "تعذر رفض طلب المحادثة"
          );
        }

        setChatMessages((current) =>
          current.map((message) =>
            message.id === messageId && message.action
              ? {
                  ...message,
                  action: {
                    ...message.action,
                    status: "rejected"
                  }
                }
              : message
          )
        );
      } catch (chatError) {
        setError(
          chatError instanceof Error
            ? chatError.message
            : "تعذر رفض طلب المحادثة"
        );
      } finally {
        setChatLoading(false);
      }
    },
    [chatLoading]
  );

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


  const handleCopyMessage = useCallback(async (message: ChatMessage) => {
    const text = message.content.trim();

    if (!text) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("الحافظة غير متاحة في بيئة التشغيل الحالية.");
      }

      await navigator.clipboard.writeText(text);
      setError("");
    } catch (messageError) {
      setError(
        messageError instanceof Error
          ? messageError.message
          : "تعذر نسخ الرسالة."
      );
    }
  }, []);

  const handleShareMessage = useCallback(async (message: ChatMessage) => {
    const text = message.content.trim();

    if (!text) {
      return;
    }

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          text
        });
        setError("");
        return;
      }

      if (!navigator.clipboard?.writeText) {
        throw new Error("المشاركة والحافظة غير متاحتين في بيئة التشغيل الحالية.");
      }

      await navigator.clipboard.writeText(text);
      setError("");
    } catch (messageError) {
      if (
        messageError instanceof DOMException &&
        messageError.name === "AbortError"
      ) {
        return;
      }

      setError(
        messageError instanceof Error
          ? messageError.message
          : "تعذر مشاركة الرسالة."
      );
    }
  }, []);

  const handleEditMessage = useCallback((message: ChatMessage) => {
    if (message.role !== "user") {
      return;
    }

    const text = message.content.trim();

    if (!text) {
      return;
    }

    setChatInput(text);
    setError("");
  }, []);

  const handleDeleteMessage = useCallback((messageId: string) => {
    if (!messageId) {
      return;
    }

    setChatMessages((current) => {
      const target = current.find((message) => message.id === messageId);

      // Message actions are bound to backend approval state.
      // Never remove an action-bearing message locally because that
      // could hide a live approval/execution state from the user.
      if (target?.action) {
        return current;
      }

      return current.filter((message) => message.id !== messageId);
    });
    setError("");
  }, []);

  const handleRetryMessage = useCallback(
    (message: ChatMessage) => {
      const prompt =
        message.role === "user"
          ? message.content.trim()
          : message.sourcePrompt?.trim() || "";

      if (!prompt || chatLoading) {
        return;
      }

      void handleChatSubmit(prompt);
    },
    [chatLoading, handleChatSubmit]
  );

  const handleRegenerateMessage = useCallback(
    (message: ChatMessage) => {
      if (
        message.role !== "assistant" ||
        !message.sourcePrompt?.trim() ||
        chatLoading
      ) {
        return;
      }

      void handleChatSubmit(message.sourcePrompt);
    },
    [chatLoading, handleChatSubmit]
  );

  const stopVoicePlayback = useCallback(() => {
    voiceRequestRef.current += 1;

    const source = voiceSourceRef.current;

    if (source) {
      try {
        source.stop();
      } catch {
        // Source may already be stopped.
      }

      try {
        source.disconnect();
      } catch {
        // Ignore cleanup failures.
      }

      voiceSourceRef.current = null;
    }

    setVoiceSpeakingMessageId(null);
  }, []);

  const playVoiceText = useCallback(
    async (text: string, messageId: string) => {
      const input = text.trim();

      if (!input) {
        return;
      }

      stopVoicePlayback();

      const requestId = ++voiceRequestRef.current;

      try {
        const result = await synthesizeVoice(input, {
          languageCode: "ar-SA",
        messageId
        });

        if (requestId !== voiceRequestRef.current) {
          return;
        }

        if (
          typeof result.messageId !== "string" ||
          result.messageId.trim() !== messageId.trim()
        ) {
          return;
        }

        if (
          !result.success ||
          result.type !== "tts_audio_ready" ||
          !result.audio?.data
        ) {
          throw new Error(
            result.message || "تعذر تجهيز الصوت"
          );
        }

        const mimeType =
          result.audio.mimeType || "audio/wav";

        if (!mimeType.toLowerCase().startsWith("audio/wav")) {
          throw new Error(
            "صيغة الصوت المستلمة غير مدعومة للتشغيل الآمن."
          );
        }

        const binary = window.atob(result.audio.data);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }

        const audioContext = await ensureVoiceAudioContext();

        if (requestId !== voiceRequestRef.current) {
          return;
        }

        const audioBuffer = await audioContext.decodeAudioData(
          bytes.buffer.slice(0)
        );

        if (requestId !== voiceRequestRef.current) {
          return;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        source.onended = () => {
          if (voiceSourceRef.current === source) {
            voiceSourceRef.current = null;
            setVoiceSpeakingMessageId(null);
          }
        };

        voiceSourceRef.current = source;
        setVoiceSpeakingMessageId(messageId);
        source.start(0);
      } catch (voiceError) {
        if (requestId !== voiceRequestRef.current) {
          return;
        }

        setVoiceSpeakingMessageId(null);

        console.warn(
          "TTS voice playback failed:",
          voiceError instanceof Error
            ? voiceError.message
            : voiceError
        );
      }
    },
    [ensureVoiceAudioContext, stopVoicePlayback]
  );

  const handleVoiceInput = async () => {
    if (voiceListening) {
      try {
        const recording = await AudioRecorder.stopRecording();

        setVoiceListening(false);

        if (
          !recording ||
          recording.success !== true ||
          recording.type !== "audio_recording_ready" ||
          typeof recording.base64 !== "string" ||
          !recording.base64
        ) {
          throw new Error("لم يتم استلام تسجيل صوتي صالح.");
        }

        const transcription = await transcribeVoice(
          {
            base64: recording.base64,
            mimeType: recording.mimeType || "audio/mp4",
          },
          {
            language: "ar",
            source: "native_microphone",
          },
        );

        if (
          transcription.success !== true ||
          typeof transcription.transcript !== "string" ||
          !transcription.transcript.trim()
        ) {
          throw new Error(
            transcription.message || "تعذر تحويل التسجيل الصوتي إلى نص.",
          );
        }

        const result = transcription.transcript.trim();

        setChatInput((current) =>
          current ? `${current} ${result}` : result,
        );
      } catch (error) {
        setVoiceListening(false);

        const message =
          error instanceof Error
            ? error.message
            : "تعذر معالجة الإدخال الصوتي.";

        setChatMessages((messages) => [
          ...messages,
          createChatMessage(
            "assistant",
            `تعذر معالجة الإدخال الصوتي: ${message}`,
          ),
        ]);
      }

      return;
    }

    try {
      await AudioRecorder.startRecording();
      setVoiceListening(true);
    } catch (error) {
      setVoiceListening(false);

      const message =
        error instanceof Error
          ? error.message
          : "تعذر بدء التسجيل. يرجى السماح باستخدام الميكروفون.";

      setChatMessages((messages) => [
        ...messages,
        createChatMessage(
          "assistant",
          `تعذر بدء التسجيل الصوتي: ${message}`,
        ),
      ]);
    }
  };

  const activeHub =
    hubs.find((hub) => hub.id === activeWorkspace) ?? hubs[0];

  const renderHubIcon = (icon: string) => {
    if (icon === "overview") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5Z" />
          <path d="M9 21v-6h6v6" />
        </svg>
      );
    }

    if (icon === "chat") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2v-4.3A7.4 7.4 0 0 1 4.5 7.5 7.5 7.5 0 0 1 12 4h.5A7.5 7.5 0 0 1 20 11.5Z" />
        </svg>
      );
    }

    if (icon === "abu-basha-spark") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
          <circle cx="18.5" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
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

    if (icon === "plans") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 4h12v16H6Z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    }

    if (icon === "approvals") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="m7 12 3 3 7-7" />
        </svg>
      );
    }

    if (icon === "execution") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 5v14l11-7L7 5Z" />
        </svg>
      );
    }

    if (icon === "audit") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4M8.5 11h5M11 8.5v5" />
        </svg>
      );
    }

    if (icon === "revenue") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v18M16 7.5c0-1.7-1.7-3-4-3s-4 1.3-4 3 1.7 3 4 3 4 1.3 4 3-1.7 3-4 3-4-1.3-4-3" />
        </svg>
      );
    }

    if (icon === "settings") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
          <path d="m19 13 2-1-2-1-.5-2 1-2-2-1-1.5 1-2-.8L13 4h-2l-.5 2.2-2 .8L7 6 5 7l1 2-.5 2-2 1 2 1 .5 2-1 2 2 1 1.5-1 2 .8L11 20h2l.5-2.2 2-.8 1.5 1 2-1-1-2 .5-2Z" />
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


  useEffect(() => {
    return () => {
      stopVoicePlayback();

      const context = voiceAudioContextRef.current;

      if (context) {
        void context.close();
        voiceAudioContextRef.current = null;
      }
    };
  }, [stopVoicePlayback]);

  return (
    <div className="app-shell modern-platform-shell" dir="rtl">
      <header className="topbar modern-topbar">
        <div className="topbar-copy">
          <div className="brand">
            <span className="brand-mark modern-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" className="ui-icon ui-icon-brand" focusable="false"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" fill="currentColor"/><circle cx="18.5" cy="5.5" r="1.5" fill="currentColor"/></svg></span>
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
              onClick={() => {
                setActiveWorkspace(hub.id);
              }}
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

        <section
          aria-label="Development Pipeline"
          className="workspace-card"
        >
          <div className="workspace-card-header">
            <div>
              <h2>Development Pipeline</h2>
              <p>Build, Test, Debug, Release — عبر بوابة الموافقة الآمنة.</p>
            </div>
            <button
              type="button"
              className="workspace-tool-add"
              onClick={refreshDevelopmentPipelineStatus}
              disabled={pipelineStatusLoading}
            >
              {pipelineStatusLoading ? "جارٍ التحديث..." : "تحديث"}
            </button>
          </div>
          <div className="settings-grid">
            <div className="settings-card">
              <strong>الحالة</strong>
              <span>
                {pipelineStatusLoading
                  ? "جارٍ التحقق..."
                  : pipelineStatus?.failClosed === true
                    ? "Fail-Closed"
                    : "غير متاح"}
              </span>
            </div>
            <div className="settings-card">
              <strong>الموافقة</strong>
              <span>
                {pipelineStatus?.requiresApproval === true
                  ? "مطلوبة"
                  : "غير متاحة"}
              </span>
            </div>
            <div className="settings-card">
              <strong>التنفيذ الخارجي</strong>
              <span>
                {pipelineStatus?.externalExecution === true
                  ? "مغلق حسب السياسة"
                  : "غير مفعّل"}
              </span>
            </div>
          </div>
        </section>

        {activeWorkspace === "coding" ? (
          <CodingWorkspace
            projectName={projectWorkspaceName}
            projectPlatform={projectWorkspacePlatform}
            projectSaving={projectWorkspaceSaving}
            projectLoading={projectWorkspaceLoading}
            projectError={projectWorkspaceError}
            projectWorkspaces={projectWorkspaces}
            codingTask={codingTask}
            codingLoading={codingLoading}
            codingApproval={codingApproval}
            codingExecution={codingExecution}
            codingExecutionLoading={codingExecutionLoading}
            onProjectNameChange={setProjectWorkspaceName}
            onProjectPlatformChange={setProjectWorkspacePlatform}
            onCreateProject={handleCreateProjectWorkspace}
            onTaskChange={setCodingTask}
            onCreateApproval={handleCreateCodingApproval}
            onExecuteApproval={handleExecuteCodingApproval}
            onOpenTools={() => openToolHub("coding")}
          />
        ) : activeWorkspace === "editing" ? (
          <EditingWorkspace
            projectName={projectWorkspaceName}
            projectPlatform={projectWorkspacePlatform}
            projectSaving={projectWorkspaceSaving}
            projectLoading={projectWorkspaceLoading}
            projectError={projectWorkspaceError}
            projectWorkspaces={projectWorkspaces}
            onProjectNameChange={setProjectWorkspaceName}
            onProjectPlatformChange={setProjectWorkspacePlatform}
            onCreateProject={handleCreateProjectWorkspace}
            onOpenTools={() => openToolHub("editing")}
          />
        ) : activeWorkspace === "studio" ? (
          <StudioWorkspace
            projectName={projectWorkspaceName}
            projectPlatform={projectWorkspacePlatform}
            projectSaving={projectWorkspaceSaving}
            projectLoading={projectWorkspaceLoading}
            projectError={projectWorkspaceError}
            projectWorkspaces={projectWorkspaces}
            onProjectNameChange={setProjectWorkspaceName}
            onProjectPlatformChange={setProjectWorkspacePlatform}
            onCreateProject={handleCreateProjectWorkspace}
            onOpenTools={() => openToolHub("studio")}
          />
         ) : activeWorkspace === "control" ? (
          <ControlWorkspace
            planStatus={planStatus}
            executionStatus={executionStatus}
            openApprovals={0}
            failedApprovals={0}
            onRefresh={() => {
              void loadApprovals();
            }}
            onOpenTools={() => openToolHub("control")}
          />
        ) : activeWorkspace === "overview" ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <div className="workspace-title-group">
                  <span className="workspace-kicker">OVERVIEW WORKSPACE</span>
                  <h2>الرئيسية</h2>
                </div>
                <button
                  type="button"
                  className="workspace-tool-add"
                  onClick={() => openToolHub("overview")}
                  aria-label="إدارة أدوات الرئيسية"
                  title="إدارة أدوات الرئيسية"
                >+</button>
                <p>نقطة البداية المركزية لمتابعة حالة الوكيل ومسارات العمل.</p>
              </div>
            </div>
            <div className="workspace-body">
              <div className="grid">
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
              </div>
            </div>
          </section>
        ) : activeWorkspace === "settings" ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <div className="workspace-title-group">
                  <span className="workspace-kicker">SETTINGS WORKSPACE</span>
                  <h2>الإعدادات المركزية</h2>
                </div>
                <p>
                  إدارة هوية الوكيل، المظهر، السلوك، الأدوات، الذكاء الاصطناعي،
                  الأمان، الإشعارات، البيانات والتشخيص من نقطة واحدة.
                </p>
              </div>

              <div className="workspace-header-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void loadSettings()}
                  disabled={settingsLoading || settingsSaving}
                >
                  {settingsLoading ? "جارٍ التحميل..." : "تحديث"}
                </button>
                <button
                  type="button"
                  className="workspace-tool-add"
                  onClick={() => openToolHub("settings")}
                  aria-label="إدارة أدوات الإعدادات"
                  title="إدارة أدوات الإعدادات"
                >
                  +
                </button>
              </div>
            </div>

            <div className="workspace-body settings-management">
              {settingsLoading && !settings ? (
                <div className="card settings-state-card">
                  <strong>جارٍ تحميل الإعدادات...</strong>
                  <small>يتم جلب الحالة الحالية من Runtime.</small>
                </div>
              ) : settingsError ? (
                <div className="card settings-state-card settings-error-card">
                  <strong>تعذر تحميل الإعدادات</strong>
                  <small>{settingsError}</small>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void loadSettings()}
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : settings ? (
                <>
                  {settingsMessage ? (
                    <div className="settings-feedback settings-success">
                      {settingsMessage}
                    </div>
                  ) : null}

                  {settingsError ? (
                    <div className="settings-feedback settings-error">
                      {settingsError}
                    </div>
                  ) : null}

                  <div className="grid settings-grid">
                    <article className="card settings-card settings-section-card">
                      <span className="card-label">الحساب والهوية</span>
                      <strong>هوية أبو بشة</strong>
                      <small>
                        البيانات المحلية القابلة للتعديل فقط؛ وضع الهوية الأساسي
                        يظل محكومًا بالـRuntime.
                      </small>
                      <label className="settings-field">
                        <span>الاسم الظاهر</span>
                        <input
                          value={settings.account?.displayName || ""}
                          onChange={(event) =>
                            patchSettings("account", {
                              displayName: event.target.value
                            })
                          }
                          disabled={settingsSaving}
                        />
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          void saveSettings({ account: settings.account })
                        }
                        disabled={settingsSaving}
                      >
                        حفظ الهوية
                      </button>
                    </article>

                    <article className="card settings-card settings-section-card">
                      <span className="card-label">المظهر</span>
                      <strong>واجهة المنتج</strong>
                      <small>تفضيلات العرض المحلية المدعومة.</small>
                      <label className="settings-field">
                        <span>السمة</span>
                        <select
                          value={settings.appearance?.theme || "dark"}
                          onChange={(event) =>
                            patchSettings("appearance", {
                              theme: event.target.value
                            })
                          }
                        >
                          <option value="dark">داكن</option>
                          <option value="light">فاتح</option>
                          <option value="system">النظام</option>
                        </select>
                      </label>
                      <label className="settings-field">
                        <span>كثافة الواجهة</span>
                        <select
                          value={settings.appearance?.density || "comfortable"}
                          onChange={(event) =>
                            patchSettings("appearance", {
                              density: event.target.value
                            })
                          }
                        >
                          <option value="comfortable">مريحة</option>
                          <option value="compact">مضغوطة</option>
                        </select>
                      </label>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={settings.appearance?.reduceMotion ?? false}
                          onChange={(event) =>
                            patchSettings("appearance", {
                              reduceMotion: event.target.checked
                            })
                          }
                          disabled={settingsSaving}
                        />
                        <span>تقليل الحركة والمؤثرات</span>
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          void saveSettings({ appearance: settings.appearance })
                        }
                        disabled={settingsSaving}
                      >
                        حفظ المظهر
                      </button>
                    </article>

                    <article className="card settings-card settings-section-card">
                      <span className="card-label">تفضيلات الوكيل</span>
                      <strong>السلوك والتفاعل</strong>
                      <small>تفضيلات الوكيل التي لا تمنح صلاحيات تنفيذ جديدة.</small>
                      <label className="settings-field">
                        <span>أسلوب الرد</span>
                        <select
                          value={settings.agent?.responseStyle || "balanced"}
                          onChange={(event) =>
                            patchSettings("agent", {
                              responseStyle: event.target.value
                            })
                          }
                        >
                          <option value="balanced">متوازن</option>
                          <option value="detailed">مفصل</option>
                          <option value="concise">مختصر</option>
                        </select>
                      </label>
                      <label className="settings-field">
                        <span>الموافقات</span>
                        <select
                          value={settings.agent?.confirmations || "required"}
                          onChange={(event) =>
                            patchSettings("agent", {
                              confirmations: event.target.value
                            })
                          }
                        >
                          <option value="required">موافقة مطلوبة</option>
                        </select>
                      </label>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={settings.agent?.proactiveSuggestions ?? true}
                          onChange={(event) =>
                            patchSettings("agent", {
                              proactiveSuggestions: event.target.checked
                            })
                          }
                          disabled={settingsSaving}
                        />
                        <span>اقتراحات استباقية</span>
                      </label>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications?.enabled ?? true}
                          onChange={(event) =>
                            patchSettings("notifications", {
                              enabled: event.target.checked
                            })
                          }
                          disabled={settingsSaving}
                        />
                        <span>الإشعارات مفعلة</span>
                      </label>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications?.approvalAlerts ?? true}
                          onChange={(event) =>
                            patchSettings("notifications", {
                              approvalAlerts: event.target.checked
                            })
                          }
                        />
                        <span>تنبيهات الموافقات</span>
                      </label>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications?.executionAlerts ?? true}
                          onChange={(event) =>
                            patchSettings("notifications", {
                              executionAlerts: event.target.checked
                            })
                          }
                        />
                        <span>تنبيهات التنفيذ</span>
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          void saveSettings({
                            notifications: settings.notifications
                          })
                        }
                        disabled={settingsSaving}
                      >
                        حفظ الإشعارات
                      </button>
                    </article>

                    <article className="card settings-card settings-section-card">
                      <span className="card-label">البيانات والجلسات</span>
                      <strong>Data & Sessions</strong>
                      <small>
                        إعدادات الاحتفاظ بالبيانات؛ لا يوجد حذف تلقائي من الواجهة
                        دون مسار Runtime مخصص.
                      </small>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={settings.data?.retainSessionHistory ?? true}
                          onChange={(event) =>
                            patchSettings("data", {
                              retainSessionHistory: event.target.checked
                            })
                          }
                        />
                        <span>الاحتفاظ بسجل الجلسات</span>
                      </label>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={settings.data?.retainAuditHistory ?? true}
                          onChange={(event) =>
                            patchSettings("data", {
                              retainAuditHistory: event.target.checked
                            })
                          }
                        />
                        <span>الاحتفاظ بسجل التدقيق</span>
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void saveSettings({ data: settings.data })}
                        disabled={settingsSaving}
                      >
                        حفظ البيانات
                      </button>
                    </article>

                    <article className="card settings-card settings-section-card">
                      <span className="card-label">الذكاء الاصطناعي</span>
                      <strong>AI Provider</strong>
                      <small>اختيارات النموذج المسموح بها من خدمة الإعدادات المركزية.</small>
                      <label className="settings-field">
                        <span>المزوّد</span>
                        <select
                          value={settings.ai?.provider || "gemini"}
                          onChange={(event) =>
                            patchSettings("ai", {
                              provider: event.target.value
                            })
                          }
                          disabled={settingsSaving}
                        >
                          <option value="gemini">Gemini</option>
                        </select>
                      </label>
                      <label className="settings-field">
                        <span>النموذج</span>
                        <select
                          value={settings.ai?.model || "gemini-3.8-flash"}
                          onChange={(event) =>
                            patchSettings("ai", {
                              model: event.target.value
                            })
                          }
                          disabled={settingsSaving}
                        >
                          <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                          <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                          <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                          <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void saveSettings({ ai: settings.ai })}
                        disabled={settingsSaving}
                      >
                        حفظ الذكاء الاصطناعي
                      </button>
                    </article>

                    <article className="card settings-card settings-section-card">
                      <span className="card-label">الأدوات والموصلات</span>
                      <strong>Tools & Connectors</strong>
                      <small>تفضيلات العرض والاستخدام المحلية؛ لا تمنح صلاحيات تنفيذ.</small>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={settings.tools?.enabled ?? true}
                          onChange={(event) =>
                            patchSettings("tools", {
                              enabled: event.target.checked
                            })
                          }
                          disabled={settingsSaving}
                        />
                        <span>الأدوات مفعلة</span>
                      </label>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={settings.connectors?.showUnavailable ?? true}
                          onChange={(event) =>
                            patchSettings("connectors", {
                              showUnavailable: event.target.checked
                            })
                          }
                          disabled={settingsSaving}
                        />
                        <span>إظهار الموصلات غير المتاحة</span>
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          void saveSettings({
                            tools: settings.tools,
                            connectors: settings.connectors
                          })
                        }
                        disabled={settingsSaving}
                      >
                        حفظ الأدوات والموصلات
                      </button>
                    </article>

                    <article className="card settings-card settings-section-card">
                      <span className="card-label">Runtime & Security</span>
                      <strong>حدود التشغيل</strong>
                      <small>هذه القيم مراقبة فقط ولا يمكن لواجهة الإعدادات تغييرها.</small>
                      <div className="settings-status-row">
                        <span>Runtime</span>
                        <strong>{executionStatus?.status || "غير متاح"}</strong>
                      </div>
                      <div className="settings-status-row">
                        <span>Require Approval</span>
                        <strong>مفعل</strong>
                      </div>
                      <div className="settings-status-row">
                        <span>Fail Closed</span>
                        <strong>مفعل</strong>
                      </div>
                      <div className="settings-status-row">
                        <span>Autonomous Execution</span>
                        <strong>معطل</strong>
                      </div>
                      <div className="settings-status-row">
                        <span>External Execution</span>
                        <strong>معطل</strong>
                      </div>
                    </article>

                    <article className="card settings-card settings-section-card">
                      <span className="card-label">الهوية والحساب</span>
                      <strong>Account Identity</strong>
                      <small>الهوية المحلية قابلة للعرض فقط؛ نمط الهوية لا يُعدل من Settings.</small>
                      <div className="settings-status-row">
                        <span>Identity Mode</span>
                        <strong>{settings.account?.identityMode || "local"}</strong>
                      </div>
                      <div className="settings-status-row">
                        <span>Display Name</span>
                        <strong>{settings.account?.displayName || "غير محدد"}</strong>
                      </div>
                    </article>

                    <article className="card settings-card settings-section-card">
                      <span className="card-label">التشخيص والصيانة</span>
                      <strong>Diagnostic Center</strong>
                      <small>
                        الوصول إلى مركز التشخيص الموجود مع بقاء التشغيل الآمن
                        والـread-only boundaries كما هي.
                      </small>
                      <div className="settings-status-row">
                        <span>حالة التشخيص</span>
                        <strong>
                          {statusLabel(diagnosticStatus?.mode)}
                        </strong>
                      </div>
                      <div className="settings-status-row">
                        <span>Fail-Closed</span>
                        <strong>
                          {diagnosticStatus?.failClosed ? "مفعل" : "—"}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setActive("audit")}
                      >
                        فتح مركز التشخيص
                      </button>
                    </article>

                    <article className="card settings-card settings-section-card">
                      <span className="card-label">حول أبو بشة</span>
                      <strong>الإصدار والحالة</strong>
                      <small>معلومات المنتج والحالة الحالية للـRuntime.</small>
                      <div className="settings-status-row">
                        <span>Runtime</span>
                        <strong>
                          {statusLabel(executionStatus?.status)}
                        </strong>
                      </div>
                      <div className="settings-status-row">
                        <span>Execution</span>
                        <strong>
                          {executionStatus?.executed ?? 0}
                        </strong>
                      </div>
                      <div className="settings-status-row">
                        <span>Settings API</span>
                        <strong>متصل</strong>
                      </div>
                    </article>
                  </div>

                  <div className="settings-save-bar">
                    <span>
                      {settingsSaving
                        ? "جارٍ حفظ التغييرات..."
                        : settingsDirty
                          ? "لديك تغييرات غير محفوظة."
                          : settingsSavedAt
                            ? "تمت مزامنة الإعدادات مع Runtime."
                            : "الإعدادات محكومة بالـAPI المركزي."}
                    </span>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        void saveSettings({
                          account: settings.account,
                          appearance: settings.appearance,
                          agent: settings.agent,
                          tools: settings.tools,
                          connectors: settings.connectors,
                          ai: settings.ai,
                          notifications: settings.notifications,
                          data: settings.data
                        })
                      }
                      disabled={settingsSaving || !settingsDirty}
                    >
                      {settingsSaving ? "جارٍ الحفظ..." : "حفظ كل التغييرات"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="card settings-state-card">
                  <strong>لا توجد إعدادات متاحة.</strong>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void loadSettings()}
                  >
                    تحميل الإعدادات
                  </button>
                </div>
              )}
            </div>
          </section>
            ) : toolHubWorkspace ? (
              <section className="workspace tool-hub-overlay">
                <div className="workspace-header">
                  <div>
                    <span className="workspace-kicker">TOOL HUB</span>
                    <h2>
                      أدوات{" "}
                      {hubs.find((hub) => hub.id === toolHubWorkspace)?.label || "القسم"}
                    </h2>
                    <p>
                      إدارة الأدوات المرتبطة بالقسم. الربط التنفيذي الفعلي يحتاج
                      Connector وCapability معتمدين.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeToolHub}
                  >
                    إغلاق
                  </button>
                </div>

                <div className="workspace-body">
                  <div className="grid tool-hub-grid">
                    {(workspaceTools[toolHubWorkspace] || []).map((tool) => (
                      <article className="card tool-card" key={tool.id}>
                        <span className="card-label">
                          {tool.kind === "app"
                            ? "تطبيق"
                            : tool.kind === "service"
                              ? "خدمة"
                              : "مورد"}
                        </span>
                        <strong>{tool.name}</strong>
                        <small>
                          {tool.status === "available"
                            ? "مفعّل في هذا القسم"
                            : "غير مفعّل — لا يوجد وصول تنفيذي تلقائي"}
                        </small>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            toggleWorkspaceTool(toolHubWorkspace, tool.id)
                          }
                        >
                          {tool.status === "available" ? "تعطيل" : "تفعيل"}
                        </button>
                      </article>
                    ))}
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
                  <svg viewBox="0 0 24 24" className="ui-icon ui-icon-spark" aria-hidden="true" focusable="false"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" fill="currentColor"/></svg>
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
                      <svg viewBox="0 0 24 24" className="ui-icon ui-icon-spark" aria-hidden="true" focusable="false"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" fill="currentColor"/></svg>
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
                        key={message.id}
                        className={`chat-message ${message.role}`}
                      >
                        <div className="chat-message-avatar" aria-hidden="true">
                          {message.role === "user" ? "أ" : <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true" focusable="false"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" fill="currentColor"/></svg>}
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
                            <div className="chat-message-assistant-actions">
                              <div className="chat-message-actions">
                                {message.role === "assistant" ? (
                                  <button
                                    className="chat-message-voice-button"
                                    type="button"
                                    onClick={() => {
                                      if (voiceSpeakingMessageId === message.id) {
                                        stopVoicePlayback();
                                        return;
                                      }

                                      void playVoiceText(
                                        message.content,
                                        message.id
                                      );
                                    }}
                                    aria-label={
                                      voiceSpeakingMessageId === message.id
                                        ? "إيقاف الرد الصوتي"
                                        : "تشغيل الرد صوتيًا"
                                    }
                                    title={
                                      voiceSpeakingMessageId === message.id
                                        ? "إيقاف الصوت"
                                        : "تشغيل الصوت"
                                    }
                                  >
                                    {voiceSpeakingMessageId === message.id ? (
                                      <svg
                                        viewBox="0 0 24 24"
                                        className="ui-icon"
                                        aria-hidden="true"
                                        focusable="false"
                                      >
                                        <rect
                                          x="7"
                                          y="7"
                                          width="10"
                                          height="10"
                                          rx="2"
                                          fill="currentColor"
                                        />
                                      </svg>
                                    ) : (
                                      <svg
                                        viewBox="0 0 24 24"
                                        className="ui-icon"
                                        aria-hidden="true"
                                        focusable="false"
                                      >
                                        <path
                                          d="M4 10v4h4l5 4V6L8 10H4z"
                                          fill="currentColor"
                                        />
                                        <path
                                          d="M16 9.2a4 4 0 010 5.6M18.5 6.7a7.5 7.5 0 010 10.6"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                    )}
                                  </button>
                                ) : null}

                                <button
                                  className="chat-message-action-button"
                                  type="button"
                                  onClick={() => void handleCopyMessage(message)}
                                  aria-label="نسخ الرسالة"
                                  title="نسخ"
                                  disabled={!message.content.trim()}
                                >
                                  نسخ
                                </button>

                                <button
                                  className="chat-message-action-button"
                                  type="button"
                                  onClick={() => void handleShareMessage(message)}
                                  aria-label="مشاركة الرسالة"
                                  title="مشاركة"
                                  disabled={!message.content.trim()}
                                >
                                  مشاركة
                                </button>

                                {message.role === "user" ? (
                                  <button
                                    className="chat-message-action-button"
                                    type="button"
                                    onClick={() => handleEditMessage(message)}
                                    aria-label="تعديل الرسالة"
                                    title="تعديل"
                                    disabled={!message.content.trim() || chatLoading}
                                  >
                                    تعديل
                                  </button>
                                ) : null}

                                {message.role === "user" ? (
                                  <button
                                    className="chat-message-action-button"
                                    type="button"
                                    onClick={() => handleRetryMessage(message)}
                                    aria-label="إعادة إرسال الرسالة"
                                    title="إعادة المحاولة"
                                    disabled={!message.content.trim() || chatLoading}
                                  >
                                    إعادة المحاولة
                                  </button>
                                ) : null}

                                {message.role === "assistant" ? (
                                  <button
                                    className="chat-message-action-button"
                                    type="button"
                                    onClick={() => handleRegenerateMessage(message)}
                                    aria-label="توليد الرد مرة أخرى"
                                    title="توليد مرة أخرى"
                                    disabled={!message.sourcePrompt?.trim() || chatLoading}
                                  >
                                    توليد مرة أخرى
                                  </button>
                                ) : null}

                                <button
                                  className="chat-message-action-button chat-message-action-button-danger"
                                  type="button"
                                  onClick={() => handleDeleteMessage(message.id)}
                                  aria-label="حذف الرسالة"
                                  title="حذف"
                                >
                                  حذف
                                </button>
                              </div>

                              {message.action ? (
                                <div
                                  className="chat-message-action-controls"
                                  data-message-id={message.id}
                                  data-approval-id={message.action.approvalId}
                                >
                                  <div className="chat-message-action-state">
                                    {message.action.status === "pending_approval"
                                      ? "بانتظار موافقتك"
                                      : message.action.status === "approved"
                                        ? "تمت الموافقة"
                                        : message.action.status === "rejected"
                                          ? "تم الرفض"
                                          : message.action.status === "executed"
                                            ? "تم التنفيذ"
                                            : "فشل التنفيذ"}
                                  </div>

                                  {message.action.status === "pending_approval" &&
                                  message.action.approvalRequired === true &&
                                  message.action.executionAllowed === false ? (
                                    <div className="chat-message-action-buttons">
                                      <button
                                        className="chat-message-action-approve"
                                        type="button"
                                        onClick={() =>
                                          void handleChatApprove(
                                            message.id,
                                            message.action!
                                          )
                                        }
                                        disabled={chatLoading}
                                      >
                                        {chatLoading
                                          ? "جارٍ التنفيذ..."
                                          : "موافقة وتنفيذ"}
                                      </button>

                                      <button
                                        className="chat-message-action-reject"
                                        type="button"
                                        onClick={() =>
                                          void handleChatReject(
                                            message.id,
                                            message.action!
                                          )
                                        }
                                        disabled={chatLoading}
                                      >
                                        رفض
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {chatLoading ? (
                  <div className="chat-loading" aria-label="جارٍ المعالجة">
                    <div className="chat-message-avatar" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="ui-icon ui-icon-spark" aria-hidden="true" focusable="false"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" fill="currentColor"/></svg>
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
                          <button
                            className="chat-tools-menu-button"
                            type="button"
                            disabled
                            aria-label="رفع الصور غير متاح حاليًا"
                            title="رفع الصور غير متاح حاليًا: لا يوجد عقد رفع فعلي معتمد"
                          >
                            <span>صورة</span>
                          </button>

                          <button
                            className="chat-tools-menu-button"
                            type="button"
                            disabled
                            aria-label="رفع الفيديو غير متاح حاليًا"
                            title="رفع الفيديو غير متاح حاليًا: لا يوجد عقد رفع فعلي معتمد"
                          >
                            <span>فيديو</span>
                          </button>

                          <button
                            className="chat-tools-menu-button"
                            type="button"
                            disabled
                            aria-label="رفع الملفات غير متاح حاليًا"
                            title="رفع الملفات غير متاح حاليًا: لا يوجد عقد رفع فعلي معتمد"
                          >
                            <span>ملف</span>
                          </button>

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
                      aria-label={voiceListening ? "إيقاف التسجيل الصوتي" : "التحدث بالصوت"}
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
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        if (!chatLoading && chatInput.trim()) {
                          void handleChatSubmit();
                        }
                      }
                    }}
                    placeholder="اكتب رسالتك إلى أبو بشة..."
                    rows={1}
                    disabled={chatLoading}
                    aria-label="رسالة المحادثة"
                  />

                  {chatLoading ? (
                    <button
                      className="chat-send-button chat-cancel-button"
                      type="button"
                      onClick={cancelChatGeneration}
                      aria-label="إلغاء توليد الرد"
                      title="إلغاء توليد الرد"
                    >
                      <svg
                        className="ui-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <rect
                          x="6"
                          y="6"
                          width="12"
                          height="12"
                          rx="2"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="chat-send-button"
                      type="submit"
                      disabled={!chatInput.trim()}
                      aria-label="إرسال الرسالة"
                      title="إرسال"
                    >
                      ↑
                    </button>
                  )}
                </div>

                <div className="chat-composer-hint">
                  <span>
                    {voiceSpeakingMessageId !== null
                      ? "يتحدث أبو بشة..."
                      : "الصوت المباشر متاح"}
                  </span>
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
              <div className="placeholder-icon" aria-hidden="true">
                {activeSection ? renderHubIcon(activeSection.icon) : null}
              </div>
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
            onClick={() => {
              if (section.id === "overview" || section.id === "chat") {
                setActiveWorkspace(section.id);
                setActive(section.id);
              } else {
                setActive(section.id);
              }
            }}
            type="button"
          >
            <span className="nav-item-icon" aria-hidden="true">
              {renderHubIcon(section.icon)}
            </span>
            <small>{section.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;

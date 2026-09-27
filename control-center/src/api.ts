import { CapacitorHttp, registerPlugin} from "@capacitor/core";

export interface AudioRecorderPlugin {
  startRecording(): Promise<{
    success: boolean;
    type: string;
    mimeType: string;
    maxDurationMs: number;
  }>;
  stopRecording(): Promise<{
    success: boolean;
    type: string;
    mimeType: string;
    extension: string;
    durationMs: number;
    sizeBytes: number;
    base64: string;
  }>;
  cancelRecording(): Promise<{
    success: boolean;
    type: string;
  }>;
}

export const AudioRecorder = registerPlugin<AudioRecorderPlugin>("AudioRecorder");


const API_BASE = "http://127.0.0.1:3000/api";

const RUNTIME_READY_TIMEOUT_MS = 12000;
const RUNTIME_READY_INTERVAL_MS = 500;

async function waitForRuntimeReady(): Promise<void> {
  const deadline = Date.now() + RUNTIME_READY_TIMEOUT_MS;
  let lastError = "Runtime غير جاهز.";

  while (Date.now() < deadline) {
    try {
    const response = await CapacitorHttp.request({
        url: `${API_BASE}/status`,
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        connectTimeout: 2000,
        readTimeout: 3000
      });

      if (response.status >= 200 && response.status < 300) {
        return;
      }

      lastError = `Runtime status: ${response.status}`;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "تعذر التحقق من جاهزية Runtime.";
    }

    await new Promise((resolve) =>
      setTimeout(resolve, RUNTIME_READY_INTERVAL_MS)
    );
  }

  throw new Error(
    `Runtime غير جاهز بعد ${RUNTIME_READY_TIMEOUT_MS}ms: ${lastError}`
  );
}

async function getJson<T>(path: string): Promise<T> {
  const response = await CapacitorHttp.request({
    url: `${API_BASE}${path}`,
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  console.log("[ABU_CHAT_TRACE] RESPONSE_RECEIVED", {
    status: response.status,
    dataType: typeof response.data
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.data as T;
}

export type SettingsData = {
  account?: {
    displayName?: string;
    identityMode?: string;
  };
  appearance?: {
    theme?: string;
    density?: string;
    reduceMotion?: boolean;
  };
  agent?: {
    responseStyle?: string;
    confirmations?: string;
    proactiveSuggestions?: boolean;
  };
  tools?: {
    enabled?: boolean;
  };
  connectors?: {
    showUnavailable?: boolean;
  };
  ai?: {
    provider?: string;
    model?: string;
  };
  security?: {
    requireApproval?: boolean;
    failClosed?: boolean;
  };
  notifications?: {
    enabled?: boolean;
    approvalAlerts?: boolean;
    executionAlerts?: boolean;
  };
  data?: {
    retainSessionHistory?: boolean;
    retainAuditHistory?: boolean;
  };
  [key: string]: unknown;
};

export type SettingsResponse = {
  success?: boolean;
  type?: string;
  settings?: SettingsData;
  status?: unknown;
  failClosed?: boolean;
  [key: string]: unknown;
};

export type PlanStatus = {
  name?: string;
  version?: string;
  status?: string;
  plans?: number;
};

export type ExecutionStatus = {
  name?: string;
  version?: string;
  status?: string;
  executed?: number;
  history?: number;
  policy?: unknown;
  connectorPolicy?: unknown;
  execution?: unknown;
  control?: unknown;
  developer?: unknown;
  toolRegistry?: unknown;
  resilience?: unknown;
};

export type ExecutionHistoryItem = {
  [key: string]: unknown;
};

export type ApprovalPlan = {
  id?: string;
  name?: string;
  goal?: string;
  [key: string]: unknown;
};

export type ApprovalItem = {
  id: string;
  planId?: string;
  planName?: string;
  plan?: ApprovalPlan;
  status?: string;
  createdAt?: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  [key: string]: unknown;
};

export type ApprovalStatus = {
  name?: string;
  version?: string;
  status?: string;
  total?: number;
  pending?: number;
  approved?: number;
  rejected?: number;
  [key: string]: unknown;
};

export type ApprovalResult = {
  success: boolean;
  type: string;
  message?: string;
  id?: string;
  item?: ApprovalItem;
  [key: string]: unknown;
};

export type ApiEnvelope<T> = {
  success: boolean;
  type: string;
  status?: T;
  items?: T;
  failClosed?: boolean;
};

export type DiagnosticProviderResult = {
  success?: boolean;
  status?: string;
  provider?: string;
  checks?: unknown[];
  findings?: string[];
  recommendations?: string[];
  duration?: number;
  error?: string | null;
  [key: string]: unknown;
};

export type DiagnosticStatus = {
  name?: string;
  type?: string;
  version?: string;
  mode?: string;
  providers?: string[];
  safe?: boolean;
  readOnly?: boolean;
  autoFix?: boolean;
  externalExecution?: boolean;
  autonomousExecution?: boolean;
  failClosed?: boolean;
  requiresApproval?: boolean;
  history?: number;
  [key: string]: unknown;
};

export type RevenueOpportunity = {
  id: string;
  name?: string;
  category?: string;
  model?: string;
  description?: string;
  monetization?: string[];
  platform?: string | null;
  type?: string;
  riskLevel?: string;
  legal?: boolean;
  requiresApproval?: boolean;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type RevenuePlan = {
  id: string;
  opportunityId?: string;
  name?: string;
  target?: string;
  requiresApproval?: boolean;
  status?: string;
  steps?: string[];
  createdAt?: string;
  [key: string]: unknown;
};

export type RevenueStatus = {
  name?: string;
  version?: string;
  status?: string;
  opportunities?: number;
  plans?: number;
  [key: string]: unknown;
};

export type DiagnosticReport = {
  success: boolean;
  status: string;
  center?: string;
  version?: string;
  mode?: string;
  startedAt?: string;
  duration?: number;
  providers?: DiagnosticProviderResult[];
  safety?: {
    safe?: boolean;
    readOnly?: boolean;
    autoFix?: boolean;
    externalExecution?: boolean;
    autonomousExecution?: boolean;
    failClosed?: boolean;
    requiresApproval?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};


export function getSettings() {
  return getJson<SettingsResponse>("/settings");
}

export async function updateSettings(
  patch: Partial<SettingsData>
): Promise<SettingsResponse> {
  await waitForRuntimeReady();

  const response = await CapacitorHttp.request({
    url: `${API_BASE}/settings/update`,
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    data: patch
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Settings update failed: ${response.status}`);
  }

  return response.data as SettingsResponse;
}

export function getPlanStatus() {
  return getJson<ApiEnvelope<PlanStatus>>("/plans/status");
}

export function getExecutionStatus() {
  return getJson<ApiEnvelope<ExecutionStatus>>("/execution/status");
}

export function getExecutionHistory() {
  return getJson<ApiEnvelope<ExecutionHistoryItem[]>>("/execution/history");
}

export function getApprovals() {
  return getJson<ApiEnvelope<ApprovalItem[]>>("/approvals");
}

export function getApprovalStatus() {
  return getJson<ApiEnvelope<ApprovalStatus>>("/approvals/status");
}

export function getRevenueStatus() {
  return getJson<ApiEnvelope<RevenueStatus>>("/revenue/status");
}

export function getRevenueOpportunities() {
  return getJson<ApiEnvelope<RevenueOpportunity[]>>(
    "/revenue/opportunities"
  );
}

export function getRevenuePlans() {
  return getJson<ApiEnvelope<RevenuePlan[]>>("/revenue/plans");
}

export function getDiagnosticStatus() {
  return getJson<ApiEnvelope<DiagnosticStatus>>("/diagnostic/status");
}

export function getDiagnosticReport() {
  return getJson<DiagnosticReport | null>("/diagnostic/report");
}

export async function runDiagnostic() {
  const response = await fetch(`${API_BASE}/diagnostic/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ options: {} })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<DiagnosticReport>;
}


export type ChatApprovalResponse = {
  success: boolean;
  type: string;
  message?: string;
  approvalRequired?: boolean;
  approved?: boolean;
  executionAllowed?: boolean;
  autonomousExecution?: boolean;
  externalExecution?: boolean;
  failClosed?: boolean;
  approval?: ApprovalItem;
  plan?: ApprovalPlan;
  [key: string]: unknown;
};

export type ChatResponse = {
  success: boolean;
  type: string;
  intent?: string;
  message?: string;
  text?: string;
  approvalRequired?: boolean;
  approved?: boolean;
  executionAllowed?: boolean;
  executable?: boolean;
  autonomousExecution?: boolean;
  externalExecution?: boolean;
  failClosed?: boolean;
  proposal?: Record<string, unknown> | null;
  approval?: ApprovalItem;
  plan?: ApprovalPlan;
  [key: string]: unknown;
};

export type ChatExecutionResponse = {
  success: boolean;
  type: string;
  message?: string;
  approvalId?: string;
  action?: string;
  result?: unknown;
  approvalRequired?: boolean;
  approved?: boolean;
  executionAllowed?: boolean;
  autonomousExecution?: boolean;
  externalExecution?: boolean;
  failClosed?: boolean;
  [key: string]: unknown;
};

export async function chatStream(
  prompt: string,
  onChunk: (chunk: ChatResponse) => void,
  options: Record<string, unknown> = {}
): Promise<void> {
  const text = prompt.trim();

  if (!text) {
    throw new Error("prompt is required");
  }

  if (typeof onChunk !== "function") {
    throw new TypeError("onChunk is required");
  }

  const storedSessionId =
    typeof window !== "undefined"
      ? window.localStorage.getItem(
          "abu-basha-agent-session-id"
        )
      : null;

  const requestId =
    typeof options.requestId === "string" &&
    options.requestId.trim()
      ? options.requestId.trim()
      : crypto.randomUUID();

  const signal =
    options.signal instanceof AbortSignal
      ? options.signal
      : undefined;

  const requestOptions = { ...options };
  delete requestOptions.signal;

  if (signal?.aborted) {
    throw new DOMException(
      "Chat generation cancelled.",
      "AbortError"
    );
  }

  const response = await fetch(
    `${API_BASE}/chat/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson"
      },
      body: JSON.stringify({
        prompt: text,
        ...(storedSessionId
          ? { sessionId: storedSessionId }
          : {}),
        requestId,
        options: requestOptions
      }),
      signal
    }
  );

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Streaming response body غير متاح."
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException(
          "Chat generation cancelled.",
          "AbortError"
        );
      }

      const { value, done } =
        await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(
        value,
        { stream: true }
      );

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          continue;
        }

        const chunk =
          JSON.parse(trimmed) as ChatResponse;

        if (
          chunk.success === true &&
          typeof chunk.sessionId === "string" &&
          typeof window !== "undefined"
        ) {
          window.localStorage.setItem(
            "abu-basha-agent-session-id",
            chunk.sessionId
          );
        }

        onChunk({
          ...chunk,
          type:
            chunk.type === "agent_response"
              ? "conversation_response"
              : chunk.type
        });
      }
    }

    buffer += decoder.decode();

    const finalLine = buffer.trim();

    if (finalLine) {
      const chunk =
        JSON.parse(finalLine) as ChatResponse;

      onChunk({
        ...chunk,
        type:
          chunk.type === "agent_response"
            ? "conversation_response"
            : chunk.type
      });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function chat(
  prompt: string,
  options: Record<string, unknown> = {}
): Promise<ChatResponse> {
  const text = prompt.trim();

  if (!text) {
    throw new Error("prompt is required");
  }

  const storedSessionId =
    typeof window !== "undefined"
      ? window.localStorage.getItem(
          "abu-basha-agent-session-id"
        )
      : null;

  const requestId =
    typeof options.requestId === "string" &&
    options.requestId.trim()
      ? options.requestId.trim()
      : crypto.randomUUID();

  const signal =
    options.signal instanceof AbortSignal
      ? options.signal
      : undefined;

  const requestOptions = { ...options };
  delete requestOptions.signal;

  const maxRetries = 2;

  const isTransientStatus = (status: number) =>
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500;

  const isTransientError = (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return /timeout|timed out|network|connection|socket|unavailable|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(
      message
    );
  };

  let response:
    Awaited<
      ReturnType<typeof CapacitorHttp.request>
    > | null = null;

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt += 1
  ) {
    if (signal?.aborted) {
      throw new DOMException(
        "Chat generation cancelled.",
        "AbortError"
      );
    }

    try {
      const candidate =
        await CapacitorHttp.request({
          url: `${API_BASE}/chat`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          data: {
            prompt: text,
            ...(storedSessionId
              ? { sessionId: storedSessionId }
              : {}),
            requestId,
            options: requestOptions
          },
          connectTimeout: 10000,
          readTimeout: 70000
        });

      response = candidate;

      if (signal?.aborted) {
        throw new DOMException(
          "Chat generation cancelled.",
          "AbortError"
        );
      }

      if (
        candidate.status >= 200 &&
        candidate.status < 300
      ) {
        break;
      }

      if (
        !isTransientStatus(candidate.status) ||
        attempt >= maxRetries
      ) {
        break;
      }
    } catch (error) {
      if (
        signal?.aborted ||
        (error instanceof DOMException &&
          error.name === "AbortError")
      ) {
        throw new DOMException(
          "Chat generation cancelled.",
          "AbortError"
        );
      }

      if (
        !isTransientError(error) ||
        attempt >= maxRetries
      ) {
        throw error;
      }
    }

    const delayMs = Math.min(
      1200,
      300 * 2 ** attempt
    );

    await new Promise((resolve) =>
      setTimeout(resolve, delayMs)
    );
  }

  if (!response) {
    throw new Error(
      "تعذر الحصول على استجابة من قناة المحادثة."
    );
  }

  if (
    response.status < 200 ||
    response.status >= 300
  ) {
    throw new Error(
      `API request failed: ${response.status}`
    );
  }

  try {
    if (typeof response.data === "string") {
      return JSON.parse(
        response.data
      ) as ChatResponse;
    }

    if (
      response.data !== null &&
      typeof response.data === "object"
    ) {
      const result =
        response.data as Record<string, unknown>;

      if (
        result.success === true &&
        typeof result.sessionId === "string" &&
        typeof window !== "undefined"
      ) {
        window.localStorage.setItem(
          "abu-basha-agent-session-id",
          result.sessionId
        );
      }

      return {
        ...result,
        type:
          result.type === "agent_response"
            ? "conversation_response"
            : result.type
      } as ChatResponse;
    }

    throw new Error(
      "استجابة المحادثة من Runtime غير صالحة."
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "استجابة المحادثة من Runtime غير صالحة."
    ) {
      throw error;
    }

    throw new Error(
      "استجابة المحادثة من Runtime ليست JSON صالحًا."
    );
  }
}

export type ProjectWorkspace = {
  id: string;
  name: string;
  type: "coding" | "editing" | "studio" | string;
  platform: string;
  rootPath?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type ProjectWorkspaceStatusResponse = {
  success?: boolean;
  type?: string;
  status?: Record<string, unknown>;
  failClosed?: boolean;
  [key: string]: unknown;
};

export type ProjectWorkspaceResponse = {
  success?: boolean;
  type?: string;
  workspace?: ProjectWorkspace;
  failClosed?: boolean;
  [key: string]: unknown;
};

export type ProjectWorkspaceListResponse = {
  success?: boolean;
  type?: string;
  workspaces?: ProjectWorkspace[];
  failClosed?: boolean;
  [key: string]: unknown;
};

export async function getProjectWorkspaceStatus(): Promise<ProjectWorkspaceStatusResponse> {
  return getJson<ProjectWorkspaceStatusResponse>("/project-workspaces/status");
}

export async function listProjectWorkspaces(
  type?: string | null
): Promise<ProjectWorkspaceListResponse> {
  const query = type && type.trim()
    ? `?type=${encodeURIComponent(type.trim())}`
    : "";

  return getJson<ProjectWorkspaceListResponse>(
    `/project-workspaces${query}`
  );
}

export async function getProjectWorkspace(
  id: string
): Promise<ProjectWorkspaceResponse> {
  const workspaceId = id.trim();

  if (!workspaceId) {
    return {
      success: false,
      type: "project_workspace_id_required",
      failClosed: true
    };
  }

  return getJson<ProjectWorkspaceResponse>(
    `/project-workspaces/${encodeURIComponent(workspaceId)}`
  );
}

export async function createProjectWorkspace(
  request: Record<string, unknown>
): Promise<ProjectWorkspaceResponse> {
  const response = await CapacitorHttp.request({
    url: `${API_BASE}/project-workspaces`,
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    data: request && typeof request === "object"
      ? request
      : {}
  });

  const result = response.data as ProjectWorkspaceResponse;

  if (!result || typeof result !== "object") {
    return {
      success: false,
      type: "project_workspace_invalid_response",
      failClosed: true
    };
  }

  return result;
}


export type DevelopmentPipelineAction =
  | "build"
  | "test"
  | "debug"
  | "release";

export type DevelopmentPipelineWorkspace =
  | "coding"
  | "editing"
  | "studio";

export type DevelopmentPipelineRequest = {
  id: string;
  action: DevelopmentPipelineAction;
  workspace: DevelopmentPipelineWorkspace;
  projectId?: string | null;
  status: string;
  failClosed?: boolean;
  externalExecution?: boolean;
  autonomousExecution?: boolean;
  requiresApproval?: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type DevelopmentPipelineStatusResponse = {
  success: boolean;
  type?: string;
  name?: string;
  version?: string;
  supportedActions?: DevelopmentPipelineAction[];
  supportedWorkspaces?: DevelopmentPipelineWorkspace[];
  failClosed?: boolean;
  externalExecution?: boolean;
  autonomousExecution?: boolean;
  requiresApproval?: boolean;
  executable?: boolean;
  executionBoundary?: string;
  [key: string]: unknown;
};

export type DevelopmentPipelineResponse = {
  success: boolean;
  type?: string;
  request?: DevelopmentPipelineRequest | null;
  failClosed?: boolean;
  [key: string]: unknown;
};

export type DevelopmentPipelineListResponse = {
  success: boolean;
  type?: string;
  requests?: DevelopmentPipelineRequest[];
  count?: number;
  failClosed?: boolean;
  [key: string]: unknown;
};

export async function getDevelopmentPipelineStatus(): Promise<DevelopmentPipelineStatusResponse> {
  return getJson<DevelopmentPipelineStatusResponse>(
    "/development-pipeline/status"
  );
}

export async function listDevelopmentPipelineRequests(
  limit = 50
): Promise<DevelopmentPipelineListResponse> {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(Math.floor(limit), 100))
    : 50;

  return getJson<DevelopmentPipelineListResponse>(
    `/development-pipeline?limit=${safeLimit}`
  );
}

export async function getDevelopmentPipelineRequest(
  id: string
): Promise<DevelopmentPipelineResponse> {
  const normalizedId = String(id || "").trim();

  if (!normalizedId) {
    return {
      success: false,
      type: "invalid_pipeline_request_id",
      failClosed: true
    };
  }

  return getJson<DevelopmentPipelineResponse>(
    `/development-pipeline/${encodeURIComponent(normalizedId)}`
  );
}

export async function createDevelopmentPipelineRequest(
  request: Partial<DevelopmentPipelineRequest>
): Promise<DevelopmentPipelineResponse> {
  const result = await CapacitorHttp.request({
    url: `${API_BASE}/development-pipeline`,
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    data: request,
    connectTimeout: 10000,
    readTimeout: 70000
  });

  if (!result?.data || typeof result.data !== "object") {
    return {
      success: false,
      type: "invalid_pipeline_response",
      failClosed: true
    };
  }

  return result.data as DevelopmentPipelineResponse;
}

export type DevelopmentPipelineApprovalResponse = {
  success: boolean;
  type?: string;
  failClosed?: boolean;
  requiresApproval?: boolean;
  approved?: boolean;
  approvalId?: string;
  request?: DevelopmentPipelineRequest;
  reason?: string;
  [key: string]: unknown;
};

export type DevelopmentPipelineExecutionResponse = {
  success: boolean;
  type?: string;
  failClosed?: boolean;
  blocked?: boolean;
  action?: DevelopmentPipelineAction;
  approvalId?: string;
  reason?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  [key: string]: unknown;
};

export async function createDevelopmentPipelineApproval(
  request: Partial<DevelopmentPipelineRequest>
): Promise<DevelopmentPipelineApprovalResponse> {
  const safeRequest =
    request && typeof request === "object" ? request : {};

  try {
    const response = await CapacitorHttp.request({
      url: `${API_BASE}/development-pipeline/approval`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: safeRequest,
      connectTimeout: 10000,
      readTimeout: 70000,
    });

    const data = response?.data;

    if (!data || typeof data !== "object") {
      return {
        success: false,
        failClosed: true,
        reason: "invalid_approval_response",
      };
    }

    return data as DevelopmentPipelineApprovalResponse;
  } catch {
    return {
      success: false,
      failClosed: true,
      reason: "approval_request_failed",
    };
  }
}

export async function executeApprovedDevelopmentPipeline(
  approvalId: string
): Promise<DevelopmentPipelineExecutionResponse> {
  const safeId = typeof approvalId === "string" ? approvalId.trim() : "";

  if (!safeId) {
    return {
      success: false,
      failClosed: true,
      blocked: true,
      reason: "approval_id_required",
    };
  }

  try {
    const response = await CapacitorHttp.request({
      url: `${API_BASE}/development-pipeline/execute-approved`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: {
        approvalId: safeId,
      },
      connectTimeout: 10000,
      readTimeout: 900000,
    });

    const data = response?.data;

    if (!data || typeof data !== "object") {
      return {
        success: false,
        failClosed: true,
        blocked: true,
        reason: "invalid_execution_response",
      };
    }

    return data as DevelopmentPipelineExecutionResponse;
  } catch {
    return {
      success: false,
      failClosed: true,
      blocked: true,
      reason: "execution_request_failed",
    };
  }
}
export type DeveloperApprovalResponse = {
  success: boolean;
  type: string;
  approved?: boolean;
  approvalRequired?: boolean;
  executionAllowed?: boolean;
  plan?: {
    id?: string;
    name?: string;
    category?: string;
    task?: string;
    steps?: unknown[];
  } | null;
  approval?: ApprovalItem | null;
  [key: string]: unknown;
};

export type DeveloperExecutionResponse = {
  success: boolean;
  type: string;
  approvalId?: string;
  executionAllowed?: boolean;
  [key: string]: unknown;
};



export type VoiceSynthesisResponse = {
  success: boolean;
  type: string;
  messageId?: string;
  model?: string;
  audio?: {
    data?: string;
    mimeType?: string;
  };
  executionAllowed?: boolean;
  externalExecution?: boolean;
  actionExecution?: string;
  requiresApproval?: boolean;
  failClosed?: boolean;
  message?: string;
  [key: string]: unknown;
};


export type VoiceTranscriptionResponse = {
  success: boolean;
  type: string;
  transcript?: string;
  message?: string;
  code?: string;
  [key: string]: unknown;
};

export async function transcribeVoice(
  audio: { base64: string; mimeType: string },
  context: Record<string, unknown> = {},
): Promise<VoiceTranscriptionResponse> {
  if (
    !audio ||
    typeof audio.base64 !== "string" ||
    !audio.base64.trim() ||
    typeof audio.mimeType !== "string" ||
    !audio.mimeType.trim()
  ) {
    return {
      success: false,
      type: "stt_audio_invalid",
      message: "بيانات التسجيل الصوتي غير صالحة.",
    };
  }

  const response = await CapacitorHttp.request({
    method: "POST",
    url: `${API_BASE}/voice/transcribe`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    data: {
      audio: {
        base64: audio.base64,
        mimeType: audio.mimeType,
      },
      context,
    },
    connectTimeout: 10000,
    readTimeout: 70000,
  });

  const body =
    typeof response.data === "string"
      ? JSON.parse(response.data)
      : response.data;

  if (
    !body ||
    typeof body !== "object" ||
    typeof body.success !== "boolean"
  ) {
    throw new Error("Invalid STT response.");
  }

  return body as VoiceTranscriptionResponse;
}

const TTS_MAX_ATTEMPTS = 3;
const TTS_RETRY_BASE_DELAY_MS = 350;
const TTS_RETRY_MAX_DELAY_MS = 2000;

function isTtsRetryableError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error ?? "");

  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes("aborterror") ||
    normalized.includes("aborted") ||
    normalized.includes("cancel") ||
    normalized.includes("messageid") ||
    normalized.includes("required") ||
    normalized.includes("invalid")
  ) {
    return false;
  }

  return (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("429") ||
    normalized.includes("500") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    normalized.includes("504")
  );
}

function isTtsRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 504);
}

function ttsRetryDelay(attempt: number): number {
  const exponential = Math.min(
    TTS_RETRY_MAX_DELAY_MS,
    TTS_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  );

  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exponential * 0.25)));

  return exponential + jitter;
}

export async function synthesizeVoice(
  text: string,
  options: Record<string, unknown> = {}
): Promise<VoiceSynthesisResponse> {
  const input = text.trim();

  if (!input) {
    throw new Error("voice text is required");
  }

  const messageId =
    typeof options.messageId === "string"
      ? options.messageId.trim()
      : "";

  if (!messageId) {
    throw new Error("tts messageId is required");
  }

  await waitForRuntimeReady();

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= TTS_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await CapacitorHttp.request({
        url: `${API_BASE}/voice/synthesize`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        data: {
          text: input,
          options: {
            ...options,
            messageId
          }
        },
        connectTimeout: 10000,
        readTimeout: 40000
      });

      if (
        response.status < 200 ||
        response.status >= 300
      ) {
        if (
          attempt < TTS_MAX_ATTEMPTS &&
          isTtsRetryableStatus(response.status)
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, ttsRetryDelay(attempt))
          );
          continue;
        }

        throw new Error(
          `Voice API request failed: ${response.status}`
        );
      }

      let body: VoiceSynthesisResponse;

      if (typeof response.data === "string") {
        body = JSON.parse(response.data) as VoiceSynthesisResponse;
      } else if (
        response.data !== null &&
        typeof response.data === "object"
      ) {
        body = response.data as VoiceSynthesisResponse;
      } else {
        throw new Error("Invalid voice synthesis response.");
      }

      if (
        typeof body.messageId !== "string" ||
        body.messageId.trim() !== messageId
      ) {
        throw new Error("tts messageId mismatch");
      }

      return body;
    } catch (error) {
      lastError = error;

      if (
        attempt >= TTS_MAX_ATTEMPTS ||
        !isTtsRetryableError(error)
      ) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, ttsRetryDelay(attempt))
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Voice synthesis failed.");
}

export async function createDeveloperApproval(
  task: string
): Promise<DeveloperApprovalResponse> {
  const text = task.trim();

  if (!text) {
    throw new Error("task is required");
  }

  const response = await fetch(`${API_BASE}/developer/approval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      task: text
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<DeveloperApprovalResponse>;
}

export async function executeApprovedDeveloper(
  approvalId: string
): Promise<DeveloperExecutionResponse> {
  const normalizedId = approvalId.trim();

  if (!normalizedId) {
    throw new Error("approvalId is required");
  }

  const response = await fetch(`${API_BASE}/developer/execute-approved`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      approvalId: normalizedId
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<DeveloperExecutionResponse>;
}

export async function cancelChat(
  requestId: string
): Promise<{
  success: boolean;
  type?: string;
  message?: string;
  requestId?: string;
  cancelled?: boolean;
  failClosed?: boolean;
}> {
  const id = requestId.trim();

  if (!id) {
    throw new Error("requestId is required");
  }

  const response = await CapacitorHttp.request({
    url: `${API_BASE}/chat/cancel`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    data: {
      requestId: id
    },
    connectTimeout: 5000,
    readTimeout: 10000
  });

  if (
    response.status < 200 ||
    response.status >= 300
  ) {
    throw new Error(
      `Chat cancel request failed: ${response.status}`
    );
  }

  if (typeof response.data === "string") {
    return JSON.parse(response.data);
  }

  if (
    response.data !== null &&
    typeof response.data === "object"
  ) {
    return response.data as {
      success: boolean;
      type?: string;
      message?: string;
      requestId?: string;
      cancelled?: boolean;
      failClosed?: boolean;
    };
  }

  throw new Error(
    "استجابة إلغاء المحادثة من Runtime غير صالحة."
  );
}

export async function createChatApproval(
  prompt: string,
  options: Record<string, unknown> = {}
): Promise<ChatApprovalResponse> {
  const text = prompt.trim();

  if (!text) {
    throw new Error("prompt is required");
  }

  const response = await fetch(`${API_BASE}/chat/approval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      prompt: text,
      options
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<ChatApprovalResponse>;
}

export async function executeApprovedChat(
  approvalId: string,
  prompt: string,
  options: Record<string, unknown> = {}
): Promise<ChatExecutionResponse> {
  const normalizedId = approvalId.trim();
  const text = prompt.trim();

  if (!normalizedId) {
    throw new Error("approvalId is required");
  }

  if (!text) {
    throw new Error("prompt is required");
  }

  const response = await fetch(`${API_BASE}/chat/execute-approved`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      approvalId: normalizedId,
      prompt: text,
      options
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<ChatExecutionResponse>;
}

async function postApprovalAction(
  path: string,
  approvalId: string
): Promise<ApprovalResult> {
  const normalizedId = approvalId.trim();

  if (!normalizedId) {
    throw new Error("approvalId is required");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ approvalId: normalizedId })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<ApprovalResult>;
}

export function approveApproval(approvalId: string) {
  return postApprovalAction("/approvals/approve", approvalId);
}

export function rejectApproval(approvalId: string) {
  return postApprovalAction("/approvals/reject", approvalId);
}

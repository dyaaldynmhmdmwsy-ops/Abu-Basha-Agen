import { CapacitorHttp } from "@capacitor/core";

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

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.data as T;
}

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

export async function chat(
  prompt: string,
  options: Record<string, unknown> = {}
): Promise<ChatResponse> {
  const text = prompt.trim();

  if (!text) {
    throw new Error("prompt is required");
  }

  await waitForRuntimeReady();

  const response = await CapacitorHttp.request({
    url: `${API_BASE}/chat`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    data: {
      prompt: text,
      options
    },
    connectTimeout: 10000,
    readTimeout: 70000
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`API request failed: ${response.status}`);
  }

  try {
    if (typeof response.data === "string") {
      return JSON.parse(response.data) as ChatResponse;
    }

    if (
      response.data !== null &&
      typeof response.data === "object"
    ) {
      return response.data as ChatResponse;
    }

    throw new Error(
      "استجابة المحادثة من Runtime غير صالحة."
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "استجابة المحادثة من Runtime غير صالحة."
    ) {
      throw error;
    }

    throw new Error(
      "استجابة المحادثة من Runtime ليست JSON صالحًا."
    );
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

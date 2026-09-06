const API_BASE = "/api";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
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

export type ApiEnvelope<T> = {
  success: boolean;
  type: string;
  status?: T;
  items?: ExecutionHistoryItem[];
  failClosed?: boolean;
};

export function getPlanStatus() {
  return getJson<ApiEnvelope<PlanStatus>>("/plans/status");
}

export function getExecutionStatus() {
  return getJson<ApiEnvelope<ExecutionStatus>>("/execution/status");
}

export function getExecutionHistory() {
  return getJson<ApiEnvelope<unknown>>("/execution/history");
}

import { auth, getFirebaseAppCheckToken } from "../lib/firebase";
import { buildApiHeaders } from "./api-headers";

export type ApiRole = "citizen" | "operator" | "demo_operator";

export interface ApiSession {
  uid: string;
  email: string | null;
  role: ApiRole;
  isAnonymous: boolean;
  isDemoOperator: boolean;
  isRealOperator: boolean;
}

interface ApiFetchOptions {
  demoOperator?: boolean;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, options: ApiFetchOptions = {}) {
  const headers = await buildApiHeaders(
    init.headers,
    init.body,
    options,
    { isDev: !!(import.meta as any).env?.DEV },
    async () => auth.currentUser ? auth.currentUser.getIdToken() : null,
    getFirebaseAppCheckToken
  );

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function fetchApiSession(options: ApiFetchOptions = {}): Promise<ApiSession | null> {
  const response = await apiFetch("/api/session", { method: "GET" }, options);
  if (!response.ok) return null;
  const result = await response.json();
  return result.actor || null;
}

export async function runAgentForIssue(issueId: string) {
  const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await apiFetch("/api/agent/run", {
    method: "POST",
    body: JSON.stringify({ issueId, idempotencyKey }),
  }, { demoOperator: true });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to run the agent workflow.");
  }
  return result;
}

export async function fetchLatestAgentRun(issueId: string) {
  const response = await apiFetch(`/api/issues/${issueId}/agent-runs/latest`, {
    method: "GET",
  }, { demoOperator: true });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to load the latest agent run.");
  }
  return result;
}

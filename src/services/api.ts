import { auth } from "../lib/firebase";

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
  const headers = new Headers(init.headers || {});
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if ((import.meta as any).env?.DEV) {
    headers.set("X-CivicLens-Local-AppCheck-Bypass", "true");
  }

  if (options.demoOperator) {
    headers.set("X-CivicLens-Demo-Operator", "true");
  }

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

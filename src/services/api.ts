import { signInAnonymously } from "firebase/auth";
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

async function getFirebaseIdTokenForApi(): Promise<string | null> {
  if (typeof (auth as any).authStateReady === "function") {
    await (auth as any).authStateReady();
  }

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, options: ApiFetchOptions = {}) {
  const headers = await buildApiHeaders(
    init.headers,
    init.body,
    options,
    { isDev: !!(import.meta as any).env?.DEV },
    getFirebaseIdTokenForApi,
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

export async function runAgentForIssue(
  issueId: string,
  options: ApiFetchOptions = { demoOperator: true }
) {
  const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await apiFetch("/api/agent/run", {
    method: "POST",
    body: JSON.stringify({ issueId, idempotencyKey }),
  }, options);
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

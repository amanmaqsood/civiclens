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

export interface AgentRunStreamEvent {
  type: string;
  issueId?: string;
  runId?: string;
  status?: string;
  message?: string;
  step?: any;
  run?: any;
  retry?: any;
  error?: string;
  ts?: string;
}

interface AgentRunStreamOptions extends ApiFetchOptions {
  signal?: AbortSignal;
  onOpen?: () => void;
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

export async function streamAgentRunEvents(
  issueId: string,
  onEvent: (event: AgentRunStreamEvent) => void,
  options: AgentRunStreamOptions = { demoOperator: true }
) {
  const response = await apiFetch(`/api/issues/${issueId}/agent-events/stream`, {
    method: "GET",
    headers: { Accept: "text/event-stream" },
    signal: options.signal,
  }, { demoOperator: options.demoOperator });
  if (!response.ok || !response.body) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Failed to open the live agent stream.");
  }
  options.onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emitFrame = (frame: string) => {
    const lines = frame.replace(/\r/g, "").split("\n");
    const eventLine = lines.find((line) => line.startsWith("event:"));
    const dataLines = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart());
    if (!dataLines.length) return;
    try {
      const parsed = JSON.parse(dataLines.join("\n"));
      onEvent({
        type: eventLine ? eventLine.slice(6).trim() : parsed.type || "message",
        ...parsed,
      });
    } catch {
      // Ignore malformed stream frames; the next valid event will continue the run.
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      emitFrame(frame);
      boundary = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) emitFrame(buffer);
}

import type { Request } from "express";

export type ApiRole = "citizen" | "operator" | "demo_operator";

export interface DecodedFirebaseIdentity {
  uid: string;
  email?: string;
  email_verified?: boolean;
  role?: string;
  roles?: string[];
  operator?: boolean;
  admin?: boolean;
  firebase?: {
    sign_in_provider?: string;
  };
}

export interface RequestActor {
  uid: string;
  email: string | null;
  role: ApiRole;
  isAnonymous: boolean;
  isDemoOperator: boolean;
  isRealOperator: boolean;
}

export interface QuotaBucket {
  count: number;
  resetTime: number;
}

export interface QuotaConfig {
  limit: number;
  windowMs: number;
}

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export function parseCsvEnv(value?: string): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function hasOperatorClaim(decoded: DecodedFirebaseIdentity): boolean {
  const role = typeof decoded.role === "string" ? decoded.role.toLowerCase() : "";
  const roles = Array.isArray(decoded.roles) ? decoded.roles.map((item) => String(item).toLowerCase()) : [];
  return decoded.operator === true || decoded.admin === true || role === "operator" || roles.includes("operator");
}

export function resolveActorFromDecoded(
  decoded: DecodedFirebaseIdentity,
  allowlistedEmails: string[],
  demoOperatorRequested: boolean,
  demoOperatorEnabled: boolean
): RequestActor {
  const email = typeof decoded.email === "string" ? decoded.email.toLowerCase() : null;
  const isAnonymous = decoded.firebase?.sign_in_provider === "anonymous";
  const hasVerifiedEmail = decoded.email_verified === true;
  const emailAllowed = !!email && hasVerifiedEmail && allowlistedEmails.includes(email);
  const claimAllowed = !isAnonymous && hasOperatorClaim(decoded);
  const isRealOperator = claimAllowed || emailAllowed;
  const isDemoOperator = !isRealOperator && demoOperatorRequested && demoOperatorEnabled;

  return {
    uid: decoded.uid,
    email,
    role: isRealOperator ? "operator" : isDemoOperator ? "demo_operator" : "citizen",
    isAnonymous,
    isDemoOperator,
    isRealOperator,
  };
}

export function isLocalRequest(req: Pick<Request, "ip" | "hostname" | "headers">): boolean {
  const host = String(req.headers.host || req.hostname || "").toLowerCase();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").toLowerCase();
  const ip = String(req.ip || "").replace("::ffff:", "");
  const localHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];
  const isLocalHost = localHosts.some((localHost) => host.startsWith(localHost) || forwardedHost.startsWith(localHost));
  return isLocalHost || ip === "127.0.0.1" || ip === "::1" || ip === "";
}

export function isLocalAppCheckBypassAllowed(
  req: Pick<Request, "ip" | "hostname" | "headers">,
  options: { nodeEnv?: string; bypassEnabled: boolean }
): boolean {
  const requested = String(req.headers["x-civiclens-local-appcheck-bypass"] || "").toLowerCase() === "true";
  return requested && options.nodeEnv !== "production" && options.bypassEnabled && isLocalRequest(req);
}

export function isDemoOperatorRequested(req: Pick<Request, "headers">): boolean {
  return String(req.headers["x-civiclens-demo-operator"] || "").toLowerCase() === "true";
}

export function consumeQuota(
  buckets: Map<string, QuotaBucket>,
  key: string,
  config: QuotaConfig,
  now = Date.now()
): QuotaResult {
  const existing = buckets.get(key);
  const bucket = !existing || now > existing.resetTime
    ? { count: 0, resetTime: now + config.windowMs }
    : existing;

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= config.limit,
    remaining: Math.max(0, config.limit - bucket.count),
    resetTime: bucket.resetTime,
  };
}

export function findOversizedStringField(
  value: unknown,
  options: { maxTextLength: number; maxImageLength: number },
  path = "body"
): string | null {
  if (typeof value === "string") {
    const key = path.split(".").pop() || "";
    const maxLength = ["image", "afterImage", "beforeImage", "imageUrl", "beforeImageUrl"].includes(key)
      ? options.maxImageLength
      : options.maxTextLength;
    return value.length > maxLength ? path : null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const result = findOversizedStringField(value[index], options, `${path}.${index}`);
      if (result) return result;
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const result = findOversizedStringField(child, options, `${path}.${key}`);
      if (result) return result;
    }
  }

  return null;
}

export function classifyProtectedRoute(method: string, path: string): "health" | "gemini" | "mutation" | "session" {
  if (method === "GET" && (path === "/api/health" || path === "/health" || path === "/api/readyz" || path === "/readyz")) return "health";
  // Open311 GeoReport v2 is open civic data - publicly readable, no token required.
  if (method === "GET" && (path === "/api/export/open311" || path.endsWith("/open311"))) return "health";
  // Predictive analytics is open civic data - publicly readable.
  if (method === "GET" && path === "/api/insights/predictive") return "health";
  // Community leaderboard is public (anonymized handles only).
  if (method === "GET" && path === "/api/leaderboard") return "health";
  if (path === "/api/session") return "session";
  if (
    path === "/api/analyze-report" ||
    path === "/api/check-duplicate" ||
    path === "/api/resolution-plan" ||
    path === "/api/verify-resolution" ||
    path === "/api/escalation" ||
    path === "/api/translate" ||
    path === "/api/agent/run"
  ) {
    return "gemini";
  }
  return "mutation";
}

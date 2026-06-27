import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { FieldValue, getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getAppCheck as getAdminAppCheck } from "firebase-admin/app-check";
import {
  classifyProtectedRoute,
  consumeQuota,
  findOversizedStringField,
  isDemoOperatorRequested,
  isLocalAppCheckBypassAllowed,
  parseCsvEnv,
  resolveActorFromDecoded,
  type RequestActor,
} from "./src/server/perimeter";
import { isDefaultFirestoreDatabase, resolveFirebaseAdminConfig } from "./src/server/admin-config";
import {
  coerceIssueStatus,
  issueStatusLabel,
  normalizeIssueStatus,
  type IssueStatusKey,
} from "./src/constants/status";

async function startServer() {
  const app = express();
  const configuredPort = Number(process.env.PORT || 3000);
  const PORT = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 3000;
  const isProduction = process.env.NODE_ENV === "production";
  const localAppCheckBypassEnabled = process.env.CIVICLENS_LOCAL_APP_CHECK_BYPASS !== "false" && !isProduction;
  const requireAppCheck = process.env.CIVICLENS_REQUIRE_APP_CHECK === "true";
  const demoOperatorEnabled = process.env.CIVICLENS_DEMO_OPERATOR_ENABLED === "true" || !isProduction;
  const operatorAllowlist = parseCsvEnv(process.env.CIVICLENS_OPERATOR_EMAILS || process.env.OPERATOR_EMAILS);
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  const firebaseAdminConfig = resolveFirebaseAdminConfig(process.env);
  const runtimeConfig = {
    mode: isProduction ? "production" : "development",
    missing: [
      ...(isProduction && !geminiApiKey ? ["GEMINI_API_KEY"] : []),
    ],
    warnings: [
      ...(isProduction && !firebaseAdminConfig.projectId ? ["FIREBASE_PROJECT_ID/GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT is not set; relying on Application Default Credentials project discovery."] : []),
      ...(isProduction && operatorAllowlist.length === 0 ? ["CIVICLENS_OPERATOR_EMAILS is empty; real operators must use Firebase custom claims."] : []),
      ...(!requireAppCheck ? ["CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled."] : []),
      ...(!process.env.GOOGLE_MAPS_PLATFORM_KEY ? ["GOOGLE_MAPS_PLATFORM_KEY is not set in the server environment."] : []),
    ],
  };

  function structuredLog(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
    const payload = JSON.stringify({
      level,
      event,
      service: "civiclens",
      timestamp: new Date().toISOString(),
      ...fields,
    });
    if (level === "error") console.error(payload);
    else if (level === "warn") console.warn(payload);
    else console.log(payload);
  }

  if (runtimeConfig.missing.length || runtimeConfig.warnings.length) {
    structuredLog(runtimeConfig.missing.length ? "error" : "warn", "runtime_config_checked", runtimeConfig);
  }

  app.set("trust proxy", 1);

  // Set payload size limit for base64 image uploads
  app.use(express.json({ limit: "15mb" }));

  app.use((err: any, req: any, res: any, next: any) => {
    if (err?.type === "entity.too.large") {
      return res.status(413).json({
        success: false,
        error: "Request payload exceeds the maximum allowed size.",
      });
    }
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({
        success: false,
        error: "Request body must be valid JSON.",
      });
    }
    next(err);
  });

  // Initialize Gemini client on the server
  const ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // --- Admin SDK probe (STEP 19a) ---
  let adminDb: any = null;
  let adminInitError: string | null = null;
  try {
    if (!getAdminApps().length) {
      initAdminApp(firebaseAdminConfig.appOptions);
    }
    adminDb = isDefaultFirestoreDatabase(firebaseAdminConfig.databaseId)
      ? getAdminFirestore()
      : getAdminFirestore(firebaseAdminConfig.databaseId);
  } catch (e: any) {
    adminInitError = e?.message || String(e);
    structuredLog("error", "admin_sdk_init_failed", { error: adminInitError });
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function isRetryableError(err: any): boolean {
    if (!err) return false;
    const errMsg = String(err.message || err.statusText || "").toUpperCase();
    const status = err.status || err.statusCode || err.code;
    return (
      status === 503 ||
      status === 429 ||
      status === "UNAVAILABLE" ||
      status === "RESOURCE_EXHAUSTED" ||
      errMsg.includes("503") ||
      errMsg.includes("429") ||
      errMsg.includes("UNAVAILABLE") ||
      errMsg.includes("RESOURCE_EXHAUSTED") ||
      errMsg.includes("RATE_LIMIT") ||
      errMsg.includes("QUOTA")
    );
  }

  async function generateContentWithRetry(aiClient: any, args: any): Promise<{ response: any; retried: boolean }> {
    const delays = [1500, 3000, 6000];
    let attempt = 0;
    while (true) {
      try {
        const response = await aiClient.models.generateContent(args);
        return { response, retried: attempt > 0 };
      } catch (error: any) {
        if (attempt < delays.length && isRetryableError(error)) {
          const delayTime = delays[attempt];
          structuredLog("warn", "gemini_retry", {
            attempt: attempt + 1,
            maxAttempts: delays.length + 1,
            delayMs: delayTime,
            error: error?.message || String(error),
          });
          await sleep(delayTime);
          attempt++;
        } else {
          throw error;
        }
      }
    }
  }

  function sendApiError(res: any, status: number, error: string, logError?: any) {
    if (logError) {
      structuredLog("error", "api_error", {
        status,
        error,
        detail: logError?.message || String(logError),
      });
    }
    return res.status(status).json({ success: false, error });
  }

  function clientIp(req: any): string {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return forwarded || String(req.ip || "unknown");
  }

  function apiPath(req: any): string {
    return String(req.originalUrl || req.url || "").split("?")[0];
  }

  app.use("/api/*", (req: any, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      structuredLog(res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info", "api_request", {
        method: req.method,
        path: apiPath(req),
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        routeKind: classifyProtectedRoute(req.method, apiPath(req)),
        actorRole: req.actor?.role || "unresolved",
      });
    });
    next();
  });

  async function verifyApiAppCheck(req: any, res: any, next: any) {
    const routeKind = classifyProtectedRoute(req.method, apiPath(req));
    if (routeKind === "health") return next();

    if (!requireAppCheck) {
      res.setHeader("X-CivicLens-AppCheck", "not-enforced");
      return next();
    }

    if (isLocalAppCheckBypassAllowed(req, { nodeEnv: process.env.NODE_ENV, bypassEnabled: localAppCheckBypassEnabled })) {
      res.setHeader("X-CivicLens-AppCheck", "local-bypass");
      return next();
    }

    const appCheckToken = String(req.headers["x-firebase-appcheck"] || req.headers["x-firebase-appcheck-token"] || "");
    if (!appCheckToken) {
      return sendApiError(res, 401, "App Check token is required.");
    }

    try {
      await getAdminAppCheck().verifyToken(appCheckToken);
      return next();
    } catch (error) {
      return sendApiError(res, 401, "Invalid App Check token.", error);
    }
  }

  async function attachActor(req: any, res: any, next: any) {
    const routeKind = classifyProtectedRoute(req.method, apiPath(req));
    if (routeKind === "health") return next();

    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return sendApiError(res, 401, "Firebase ID token is required.");
    }

    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      req.actor = resolveActorFromDecoded(
        decoded,
        operatorAllowlist,
        isDemoOperatorRequested(req),
        demoOperatorEnabled
      );
      return next();
    } catch (error) {
      return sendApiError(res, 401, "Invalid Firebase ID token.", error);
    }
  }

  function requireOperatorForIssue(issueData: any, actor: RequestActor | undefined, res: any): boolean {
    if (actor?.isRealOperator) return true;
    if (actor?.isDemoOperator && issueData?.isDemoData === true) return true;
    if (actor?.isDemoOperator) {
      sendApiError(res, 403, "Demo operator actions are limited to synthetic demo cases.");
      return false;
    }
    sendApiError(res, 403, "Operator authorization is required.");
    return false;
  }

  const quotaBuckets = new Map<string, { count: number; resetTime: number }>();
  const quotaConfig = {
    session: { limit: 60, windowMs: 60_000 },
    gemini: { limit: 20, windowMs: 60_000 },
    mutation: { limit: 30, windowMs: 60_000 },
  } as const;

  // Security headers for all API routes
  app.use("/api/*", (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  // Shared request size/oversized fields validation for all API routes
  app.use("/api/*", (req, res, next) => {
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const oversizedPath = findOversizedStringField(req.body, {
        maxTextLength: 15_000,
        maxImageLength: 15 * 1024 * 1024,
      });
      if (oversizedPath) {
        return sendApiError(res, 400, `Request field '${oversizedPath}' exceeds the maximum allowed size.`);
      }
    }
    next();
  });

  app.use("/api/*", verifyApiAppCheck);
  app.use("/api/*", attachActor);

  app.use("/api/*", (req: any, res, next) => {
    const routeKind = classifyProtectedRoute(req.method, apiPath(req));
    if (routeKind === "health") return next();
    const config = routeKind === "gemini" ? quotaConfig.gemini : routeKind === "session" ? quotaConfig.session : quotaConfig.mutation;
    const actorKey = req.actor?.uid || "anonymous";
    const key = `${routeKind}:${actorKey}:${clientIp(req)}`;
    const quota = consumeQuota(quotaBuckets, key, config);
    res.setHeader("X-RateLimit-Limit", String(config.limit));
    res.setHeader("X-RateLimit-Remaining", String(quota.remaining));
    res.setHeader("X-RateLimit-Reset", new Date(quota.resetTime).toISOString());
    if (!quota.allowed) {
      return sendApiError(res, 429, "Too many requests. Please try again later.");
    }
    return next();
  });

  function healthPayload() {
    return {
      status: "ok",
      service: "civiclens",
      mode: runtimeConfig.mode,
      timestamp: new Date().toISOString(),
    };
  }

  function readinessPayload() {
    const checks = {
      adminDb: !!adminDb,
      geminiConfigured: !!geminiApiKey,
      configValid: runtimeConfig.missing.length === 0,
    };
    const ready = checks.adminDb && checks.configValid && (!isProduction || checks.geminiConfigured);
    return {
      status: ready ? "ready" : "not_ready",
      ready,
      checks,
      missing: runtimeConfig.missing,
      warnings: runtimeConfig.warnings,
      adminInitError,
      timestamp: new Date().toISOString(),
    };
  }

  app.get("/health", (req, res) => {
    res.json(healthPayload());
  });

  app.get("/api/health", (req, res) => {
    res.json(healthPayload());
  });

  app.get("/readyz", (req, res) => {
    const payload = readinessPayload();
    res.status(payload.ready ? 200 : 503).json(payload);
  });

  app.get("/api/readyz", (req, res) => {
    const payload = readinessPayload();
    res.status(payload.ready ? 200 : 503).json(payload);
  });

  app.get("/api/session", (req: any, res) => {
    const actor = req.actor as RequestActor | undefined;
    if (!actor) {
      return sendApiError(res, 401, "Firebase ID token is required.");
    }
    res.json({
      success: true,
      actor: {
        uid: actor.uid,
        email: actor.email,
        role: actor.role,
        isAnonymous: actor.isAnonymous,
        isDemoOperator: actor.isDemoOperator,
        isRealOperator: actor.isRealOperator,
      },
      config: {
        demoOperatorEnabled,
        operatorAllowlistConfigured: operatorAllowlist.length > 0,
        localAppCheckBypass: !isProduction && localAppCheckBypassEnabled,
        appCheckEnforced: requireAppCheck,
      },
    });
  });

  // Admin SDK health probe (STEP 19a)
  app.get("/api/admin/health", async (req: any, res) => {
    const actor = req.actor as RequestActor | undefined;
    if (!actor?.isRealOperator) {
      return sendApiError(res, 403, "Operator authorization is required.");
    }
    if (!adminDb) {
      return sendApiError(res, 500, "Server data layer unavailable.", adminInitError);
    }
    try {
      const snap = await adminDb.collection("issues").limit(1).get();
      res.json({ ok: true, adminSdk: "initialized", sampleDocsRead: snap.size });
    } catch (e: any) {
      sendApiError(res, 500, "Server data layer health check failed.", e);
    }
  });

  const categoriesList = ["pothole", "water_leak", "streetlight", "waste", "drainage", "road_damage", "other"];
  const urgenciesList = ["routine", "priority", "urgent"];
  const areasList = ["single_property", "street", "neighborhood", "unknown"];

  function validateSchema(data: any): boolean {
    if (!data || typeof data !== "object") return false;
    if (!categoriesList.includes(data.category)) return false;
    if (typeof data.title !== "string" || !data.title) return false;
    if (typeof data.summary !== "string" || !data.summary) return false;
    if (typeof data.severity !== "number" || data.severity < 1 || data.severity > 5) return false;
    if (!urgenciesList.includes(data.urgency)) return false;
    if (!Array.isArray(data.visibleHazards)) return false;
    if (!areasList.includes(data.affectedArea)) return false;
    if (!Array.isArray(data.privacyFlags)) return false;
    if (typeof data.confidence !== "number") return false;
    return true;
  }

  function isSafeDocumentId(id: unknown): id is string {
    return typeof id === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(id);
  }

  function cleanText(value: unknown, fallback = "", maxLength = 2000): string {
    if (typeof value !== "string") return fallback;
    return value.trim().slice(0, maxLength);
  }

  function cleanStringArray(value: unknown, maxItems = 10, maxLength = 160): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => typeof item === "string")
      .slice(0, maxItems)
      .map((item) => item.trim().slice(0, maxLength))
      .filter(Boolean);
  }

  function cleanNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  function serverPriorityScore(issue: any): number {
    const severity = cleanNumber(issue.severity, 1, 1, 5);
    const urgencyBonus = issue.urgency === "urgent" ? 10 : issue.urgency === "priority" ? 5 : 0;
    const confirmBonus = Math.min(cleanNumber(issue.confirmCount, 0, 0, 999) * 3, 15);
    const reportBonus = Math.min(cleanNumber(issue.reportCount, 1, 1, 999) * 4, 15);
    return Math.round(Math.min(100, severity * 12 + urgencyBonus + confirmBonus + reportBonus) * 10) / 10;
  }

  function makeTicketId(): string {
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `CL-${datePart}-${randomPart}`;
  }

  function publicIssueFromDoc(id: string, data: any) {
    return { id, ...data };
  }

  async function addServerActivity(issueRef: any, activity: {
    actorType: "operator" | "citizen" | "ai";
    eventType: string;
    message: string;
    timestamp: string;
    byUid?: string;
    byRole?: string;
  }) {
    await issueRef.collection("activity").add(activity);
  }

    // Server-authoritative status transition (Admin SDK + auth + state machine) — STEP 19b
  app.post("/api/issues/update-status", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;

    const { issueId } = req.body || {};
    const newStatus = coerceIssueStatus(req.body?.newStatus);
    const rationale = cleanText(req.body?.rationale, "", 1200);
    if (!issueId || typeof issueId !== "string" || !newStatus) {
      return sendApiError(res, 400, "Invalid issueId or status.");
    }

    try {
      const ref = adminDb.collection("issues").doc(issueId);
      const snap = await ref.get();
      if (!snap.exists) return sendApiError(res, 404, "Issue not found.");
      const allowed: Record<IssueStatusKey, IssueStatusKey[]> = {
        submitted: ["verified"],
        verified: ["in_progress"],
        in_progress: ["resolved", "submitted"],
        resolved: ["in_progress"],
      };
      const nowIso = new Date().toISOString();
      if (!rationale || rationale.length < 8) {
        return sendApiError(res, 400, "Operator rationale is required for lifecycle transitions.");
      }

      const authIssueData = snap.data();
      if (!requireOperatorForIssue(authIssueData, actor, res)) return;

      let responsePayload: any = null;
      await adminDb.runTransaction(async (tx: any) => {
        const txSnap = await tx.get(ref);
        if (!txSnap.exists) throw new Error("NOT_FOUND");
        const issueData = txSnap.data() || {};
        if (!(actor?.isRealOperator || (actor?.isDemoOperator && issueData?.isDemoData === true))) {
          throw new Error("FORBIDDEN_OPERATOR");
        }

        const current = normalizeIssueStatus(issueData.status);
        if (!(allowed[current] || []).includes(newStatus)) {
          const transitionError: any = new Error("INVALID_TRANSITION");
          transitionError.current = current;
          throw transitionError;
        }

        const updates: any = { status: newStatus, updatedAt: nowIso };
        if (newStatus === "verified") updates.triagedAt = nowIso;
        if (newStatus === "in_progress") {
          updates.workStartedAt = nowIso;
          if (!issueData.assignedAt) updates.assignedAt = nowIso;
        }
        if (newStatus === "resolved") {
          if (!issueData.closureAssessment) {
            throw new Error("MISSING_CLOSURE");
          }
          updates.resolvedAt = nowIso;
        }
        if (current === "resolved" || newStatus === "submitted") {
          updates.reopenedAt = nowIso;
        }

        tx.update(ref, updates);
        tx.set(ref.collection("approvals").doc(), {
          type: newStatus === "resolved" ? "closure_resolution" : current === "resolved" ? "reopen" : "status_transition",
          fromStatus: current,
          toStatus: newStatus,
          rationale,
          humanApproved: true,
          createdAt: nowIso,
          byUid: actor?.uid,
          byRole: actor?.role,
        });
        tx.set(ref.collection("activity").doc(), {
          actorType: "operator",
          eventType: "status_changed",
          message: `Status advanced to ${issueStatusLabel(newStatus)} by server-authorized operator. Rationale: ${rationale}`,
          timestamp: nowIso,
          byUid: actor?.uid,
          byRole: actor?.role,
        });
        responsePayload = { success: true, status: newStatus, resolvedAt: updates.resolvedAt || null };
      });

      res.json(responsePayload);
    } catch (e: any) {
      if (e?.message === "NOT_FOUND") return sendApiError(res, 404, "Issue not found.");
      if (e?.message === "FORBIDDEN_OPERATOR") return sendApiError(res, 403, "Operator authorization failed for this issue.");
      if (e?.message === "INVALID_TRANSITION") {
        return sendApiError(res, 409, `Illegal transition: ${issueStatusLabel(e.current)} -> ${issueStatusLabel(newStatus)}.`);
      }
      if (e?.message === "MISSING_CLOSURE") return sendApiError(res, 409, "Closure evidence and assessment are required before resolving.");
      sendApiError(res, 500, "Status update failed.", e);
    }
  });

  app.post("/api/issues/create", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor) return sendApiError(res, 401, "Firebase ID token is required.");

    const idempotencyKey = isSafeDocumentId(req.body?.idempotencyKey) ? req.body.idempotencyKey : adminDb.collection("issues").doc().id;
    const issueRef = adminDb.collection("issues").doc(idempotencyKey);
    const nowIso = new Date().toISOString();

    const category = categoriesList.includes(req.body?.category) ? req.body.category : "other";
    const urgency = urgenciesList.includes(req.body?.urgency) ? req.body.urgency : "routine";
    const affectedArea = areasList.includes(req.body?.affectedArea) ? req.body.affectedArea : "unknown";
    const imageValue = cleanText(req.body?.imageUrl || req.body?.image, "", 1_200_000);
    if (!imageValue) return sendApiError(res, 400, "Image URL or image payload is required.");

    const report = {
      ticketId: makeTicketId(),
      image: imageValue,
      lat: typeof req.body?.lat === "number" ? req.body.lat : null,
      lng: typeof req.body?.lng === "number" ? req.body.lng : null,
      locationName: cleanText(req.body?.locationName, "Current Location", 500),
      category,
      description: cleanText(req.body?.description, "No description provided", 3000),
      timestamp: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: "submitted",
      citizenUpvotes: 0,
      userId: actor.uid,
      isDemoData: false,
      title: cleanText(req.body?.title, "Civic Incident", 180),
      summary: cleanText(req.body?.summary, req.body?.description || "No summary provided", 1200),
      severity: cleanNumber(req.body?.severity, 3, 1, 5),
      urgency,
      visibleHazards: cleanStringArray(req.body?.visibleHazards),
      affectedArea,
      privacyFlags: cleanStringArray(req.body?.privacyFlags),
      confidence: cleanNumber(req.body?.confidence, 0, 0, 1),
      reportCount: 1,
      confirmCount: 0,
      disputeCount: 0,
      verificationStatus: "unverified",
      agentTrace: [],
      priorityScore: 0,
    };
    report.priorityScore = serverPriorityScore(report);

    try {
      const saved = await adminDb.runTransaction(async (tx: any) => {
        const existing = await tx.get(issueRef);
        if (existing.exists) {
          const existingData = existing.data();
          if (existingData.userId !== actor.uid) {
            throw new Error("IDEMPOTENCY_CONFLICT");
          }
          return existingData;
        }
        tx.set(issueRef, report);
        const activityRef = issueRef.collection("activity").doc();
        tx.set(activityRef, {
          actorType: "citizen",
          eventType: "created",
          message: "Prototype report saved by server.",
          timestamp: nowIso,
          byUid: actor.uid,
          byRole: actor.role,
        });
        return report;
      });

      return res.json({ success: true, data: publicIssueFromDoc(issueRef.id, saved) });
    } catch (error: any) {
      if (error?.message === "IDEMPOTENCY_CONFLICT") {
        return sendApiError(res, 409, "Idempotency key already belongs to another user.");
      }
      return sendApiError(res, 500, "Failed to create issue report.", error);
    }
  });

  app.post("/api/issues/:issueId/evidence", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor) return sendApiError(res, 401, "Firebase ID token is required.");
    const { issueId } = req.params;
    if (!isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid issue id.");
    const evidenceId = isSafeDocumentId(req.body?.idempotencyKey) ? req.body.idempotencyKey : `${actor.uid}_${Date.now()}`;
    const issueRef = adminDb.collection("issues").doc(issueId);
    const evidenceRef = issueRef.collection("evidence").doc(evidenceId);
    const nowIso = new Date().toISOString();

    try {
      await adminDb.runTransaction(async (tx: any) => {
        const issueSnap = await tx.get(issueRef);
        if (!issueSnap.exists) throw new Error("NOT_FOUND");
        const existingEvidence = await tx.get(evidenceRef);
        if (existingEvidence.exists) return;

        tx.set(evidenceRef, {
          imageUrl: cleanText(req.body?.imageUrl, "", 1200),
          description: cleanText(req.body?.description, "Supporting evidence", 1200),
          lat: typeof req.body?.lat === "number" ? req.body.lat : null,
          lng: typeof req.body?.lng === "number" ? req.body.lng : null,
          severity: cleanNumber(req.body?.severity, 1, 1, 5),
          submittedBy: actor.uid,
          timestamp: nowIso,
        });
        tx.update(issueRef, {
          reportCount: FieldValue.increment(1),
          updatedAt: nowIso,
        });
        tx.set(issueRef.collection("activity").doc(), {
          actorType: "citizen",
          eventType: "evidence_submitted",
          message: "Supporting evidence linked by server.",
          timestamp: nowIso,
          byUid: actor.uid,
          byRole: actor.role,
        });
      });

      return res.json({ success: true, evidenceId });
    } catch (error: any) {
      if (error?.message === "NOT_FOUND") return sendApiError(res, 404, "Issue not found.");
      return sendApiError(res, 500, "Failed to attach evidence.", error);
    }
  });

  app.post("/api/issues/:issueId/support", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor) return sendApiError(res, 401, "Firebase ID token is required.");
    const { issueId } = req.params;
    if (!isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid issue id.");
    const issueRef = adminDb.collection("issues").doc(issueId);
    const supportRef = issueRef.collection("support").doc(actor.uid);
    const nowIso = new Date().toISOString();

    try {
      await adminDb.runTransaction(async (tx: any) => {
        const issueSnap = await tx.get(issueRef);
        if (!issueSnap.exists) throw new Error("NOT_FOUND");
        const existingSupport = await tx.get(supportRef);
        if (existingSupport.exists) throw new Error("ALREADY_SUPPORTED");
        tx.set(supportRef, { userId: actor.uid, timestamp: nowIso });
        tx.update(issueRef, {
          citizenUpvotes: FieldValue.increment(1),
          updatedAt: nowIso,
        });
      });
      return res.json({ success: true });
    } catch (error: any) {
      if (error?.message === "NOT_FOUND") return sendApiError(res, 404, "Issue not found.");
      if (error?.message === "ALREADY_SUPPORTED") return sendApiError(res, 409, "You have already supported this issue.");
      return sendApiError(res, 500, "Failed to support issue.", error);
    }
  });

  app.post("/api/issues/:issueId/verification", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor) return sendApiError(res, 401, "Firebase ID token is required.");
    const { issueId } = req.params;
    const type = req.body?.type;
    if (!isSafeDocumentId(issueId) || !["confirm", "dispute"].includes(type)) {
      return sendApiError(res, 400, "Invalid verification request.");
    }
    const issueRef = adminDb.collection("issues").doc(issueId);
    const verificationRef = issueRef.collection("verifications").doc(actor.uid);
    const nowIso = new Date().toISOString();

    try {
      await adminDb.runTransaction(async (tx: any) => {
        const issueSnap = await tx.get(issueRef);
        if (!issueSnap.exists) throw new Error("NOT_FOUND");
        const existingVote = await tx.get(verificationRef);
        if (existingVote.exists) throw new Error("ALREADY_VERIFIED");

        tx.set(verificationRef, {
          userId: actor.uid,
          type,
          timestamp: nowIso,
        });
        tx.update(issueRef, {
          confirmCount: type === "confirm" ? FieldValue.increment(1) : FieldValue.increment(0),
          disputeCount: type === "dispute" ? FieldValue.increment(1) : FieldValue.increment(0),
          verificationStatus: type === "confirm" ? "community_confirmed" : "community_disputed",
          updatedAt: nowIso,
        });
        tx.set(issueRef.collection("activity").doc(), {
          actorType: "citizen",
          eventType: "verification",
          message: `Community ${type} recorded by server.`,
          timestamp: nowIso,
          byUid: actor.uid,
          byRole: actor.role,
        });
      });
      return res.json({ success: true });
    } catch (error: any) {
      if (error?.message === "NOT_FOUND") return sendApiError(res, 404, "Issue not found.");
      if (error?.message === "ALREADY_VERIFIED") return sendApiError(res, 409, "You have already verified or disputed this issue.");
      return sendApiError(res, 500, "Failed to submit verification.", error);
    }
  });

  app.post("/api/issues/:issueId/translations", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid translation request.");

    try {
      const issueRef = adminDb.collection("issues").doc(issueId);
      await issueRef.update({
        titleHi: cleanText(req.body?.titleHi, "", 240),
        summaryHi: cleanText(req.body?.summaryHi, "", 1600),
        updatedAt: new Date().toISOString(),
      });
      return res.json({ success: true });
    } catch (error) {
      return sendApiError(res, 500, "Failed to save translations.", error);
    }
  });

  app.post("/api/issues/:issueId/activity", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid activity request.");
    const issueRef = adminDb.collection("issues").doc(issueId);
    try {
      const snap = await issueRef.get();
      if (!snap.exists) return sendApiError(res, 404, "Issue not found.");
      await addServerActivity(issueRef, {
        actorType: actor.isRealOperator || actor.isDemoOperator ? "operator" : "citizen",
        eventType: cleanText(req.body?.eventType, "note", 80),
        message: cleanText(req.body?.message, "Activity recorded by server.", 1000),
        timestamp: new Date().toISOString(),
        byUid: actor.uid,
        byRole: actor.role,
      });
      return res.json({ success: true });
    } catch (error) {
      return sendApiError(res, 500, "Failed to record activity.", error);
    }
  });

  async function draftResolutionPlanFromIssue(issueData: any, issueId: string) {
    const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const category = cleanText(issueData.category, "general civic issue", 120);
    const title = cleanText(issueData.title, issueData.category || "Civic incident", 180);
    const summary = cleanText(issueData.summary || issueData.description, "Reported civic issue pending summary.", 1200);
    const locationName = cleanText(issueData.locationName, "India", 240);
    const ticketId = cleanText(issueData.ticketId, issueId, 100);
    const lat = typeof issueData.lat === "number" ? issueData.lat : null;
    const lng = typeof issueData.lng === "number" ? issueData.lng : null;

    const promptText = `Suggest a likely responsible Indian municipal authority or department and draft a complaint packet for human review for this reported civic issue.
Use Google Search grounding to lookup real-world departments, municipal corporations, or utility boards that govern this category of issues in this specific Indian city or state.

Issue details loaded from Firestore by CivicLens server:
- Category: ${category}
- Title: ${title}
- Summary: ${summary}
- Location/address description: ${locationName}
- Coordinates: lat ${lat ?? "unknown"}, lng ${lng ?? "unknown"}
- CivicLens prototype ticket ID: ${ticketId}
- Reporting Date (Today): ${todayStr}

Determine:
1. The likely municipal corporation, public works body, or utility contact to verify (recommendedAuthority).
2. A public grievance portal, email, app name, or citizen helpline if one can be grounded (contactChannel).
3. A published or typical citizen follow-up window in days (slaDays, integer). If uncertain, provide a conservative estimate and make the uncertainty clear in the draft body.
4. A drafted complaint email or letter for human review only:
   - subject: A concise professional subject line
   - body: The full body of a draft letter, starting with a polite salutation, laying out the ticket summary, citing safety concerns and location, and asking for review within the suggested follow-up window.
   - bodyHindi: A fluent Hindi translation of the draft complaint body.
   - summaryHindi: A brief Hindi summary of the problem.
   - nextActions: 3 actionable steps for the citizen or operator to verify before acting outside CivicLens.

CRITICAL COMPLIANCE DIRECTIVE:
Use only the CivicLens prototype ticket ID ('${ticketId}') and current date ('${todayStr}') for reference numbers or dates. Never invent government complaint IDs, submission IDs, approval numbers, official acknowledgements, or external filing history.

Output STRICT, VALID JSON conforming exactly to this schema:
{
  "recommendedAuthority": "string",
  "contactChannel": "string",
  "slaDays": 10,
  "actionPacket": {
    "subject": "string",
    "body": "string",
    "bodyHindi": "string",
    "summaryHindi": "string",
    "nextActions": ["string", "string", "string"]
  }
}
Output ONLY valid JSON and nothing else.`;

    const startTime = Date.now();
    const result = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: promptText,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const durationMs = Date.now() - startTime;
    const response = result.response;
    const responseText = (response.text || "").trim();
    let cleanResponseText = responseText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    let parsedData: any;
    try {
      parsedData = JSON.parse(cleanResponseText);
    } catch {
      const jsonMatch = cleanResponseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Unable to parse Gemini resolution plan result as JSON.");
      parsedData = JSON.parse(jsonMatch[0]);
    }

    const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const seenSources = new Set<string>();
    parsedData.groundingSources = searchChunks
      .map((chunk: any) => ({
        title: cleanText(chunk.web?.title, "Grounding source", 180),
        url: cleanText(chunk.web?.uri, "", 2000),
        claimSupported: "Suggested authority/contact reference for a draft action packet.",
        sourceType: "sourced",
      }))
      .filter((source: any) => {
        if (!source.url || seenSources.has(source.url)) return false;
        seenSources.add(source.url);
        return true;
      });

    return {
      success: true,
      data: parsedData,
      durationMs,
      confidence: 0.95,
      inputDigest: `${category}: "${title}"`,
      outputSummary: `Suggested authority: ${cleanText(parsedData.recommendedAuthority, "Unknown", 160)} - follow-up: ${cleanNumber(parsedData.slaDays, 0, 0, 365)} days`,
      retried: result.retried,
    };
  }

  app.post("/api/issues/:issueId/agent-trace-plan", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid agent update request.");
    if (req.body?.resolutionPlan !== undefined) {
      return sendApiError(res, 400, "Resolution plans are generated from server-loaded issue state.");
    }
    const issueRef = adminDb.collection("issues").doc(issueId);

    try {
      const snap = await issueRef.get();
      if (!snap.exists) return sendApiError(res, 404, "Issue not found.");
      if (!requireOperatorForIssue(snap.data(), actor, res)) return;
      const issueData = snap.data() || {};
      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };
      let changed = false;
      if (req.body?.draftResolutionPlan === true) {
        const planResult = await draftResolutionPlanFromIssue(issueData, issueId);
        updateData.resolutionPlan = planResult.data;
        updateData.agentTrace = [
          ...(Array.isArray(issueData.agentTrace) ? issueData.agentTrace : []),
          {
            step: "draft_action_packet",
            tool: "agent.draft_action_packet",
            status: "done",
            rationale: "Draft resolution plan saved by the server for human review.",
            ts: updateData.updatedAt,
            inputDigest: planResult.inputDigest,
            outputSummary: planResult.outputSummary,
            durationMs: planResult.durationMs,
            retried: planResult.retried,
            sources: planResult.data.groundingSources || [],
          },
        ].slice(-30);
        changed = true;
      }
      if (typeof req.body?.priorityScore === "number") {
        updateData.priorityScore = cleanNumber(req.body.priorityScore, 0, 0, 100);
        changed = true;
      }
      if (!changed) {
        return sendApiError(res, 400, "No server-generated agent update was requested.");
      }
      await issueRef.update(updateData);
      await addServerActivity(issueRef, {
        actorType: "ai",
        eventType: "agent_trace_updated",
        message: "Agent trace and draft plan saved by server.",
        timestamp: updateData.updatedAt,
        byUid: actor.uid,
        byRole: actor.role,
      });
      return res.json({ success: true, data: updateData.resolutionPlan || null });
    } catch (error) {
      return sendApiError(res, 500, "Failed to save agent results.", error);
    }
  });

  app.post("/api/issues/:issueId/closure-assessment", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid closure request.");
    const issueRef = adminDb.collection("issues").doc(issueId);
    try {
      const snap = await issueRef.get();
      if (!snap.exists) return sendApiError(res, 404, "Issue not found.");
      if (!requireOperatorForIssue(snap.data(), actor, res)) return;
      const nowIso = new Date().toISOString();
      const closureAssessment = req.body?.closureAssessment || {};
      await issueRef.update({
        closureAssessment,
        closureSubmittedAt: nowIso,
        agentTrace: [
          ...(Array.isArray(snap.data().agentTrace) ? snap.data().agentTrace : []),
          {
            step: "verify_closure",
            tool: "agent.verify_closure",
            status: closureAssessment?.resolved ? "done" : "failed",
            rationale: cleanText(closureAssessment?.explanation, "Closure assessment saved by server.", 1200),
            ts: nowIso,
            inputDigest: "Server accepted closure assessment payload",
            outputSummary: `Recommendation: ${cleanText(closureAssessment?.recommendation, "request_more_evidence", 80)}`,
            retried: false,
          },
        ].slice(-30),
        updatedAt: nowIso,
      });
      await addServerActivity(issueRef, {
        actorType: "operator",
        eventType: "closure_assessment",
        message: "Closure assessment saved by server for human review.",
        timestamp: nowIso,
        byUid: actor.uid,
        byRole: actor.role,
      });
      return res.json({ success: true });
    } catch (error) {
      return sendApiError(res, 500, "Failed to save closure assessment.", error);
    }
  });

  app.post("/api/issues/:issueId/escalation-record", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid escalation request.");
    const issueRef = adminDb.collection("issues").doc(issueId);
    try {
      const snap = await issueRef.get();
      if (!snap.exists) return sendApiError(res, 404, "Issue not found.");
      if (!requireOperatorForIssue(snap.data(), actor, res)) return;
      const nowIso = new Date().toISOString();
      const escalation = {
        escalatedAt: nowIso,
        escalationLetter: cleanText(req.body?.escalationLetter, "", 8000),
        rtiRequest: cleanText(req.body?.rtiRequest, "", 8000),
      };
      await issueRef.update({
        escalation,
        agentTrace: [
          ...(Array.isArray(snap.data().agentTrace) ? snap.data().agentTrace : []),
          {
            step: "record_event",
            tool: "agent.record_event",
            status: "done",
            rationale: "Escalation and RTI drafts saved by the server for human review.",
            ts: nowIso,
            inputDigest: "Escalation draft save request",
            outputSummary: "Draft escalation and RTI text recorded",
            retried: false,
          },
        ].slice(-30),
        updatedAt: nowIso,
      });
      await addServerActivity(issueRef, {
        actorType: "operator",
        eventType: "escalation_draft",
        message: "Escalation and RTI drafts saved by server.",
        timestamp: nowIso,
        byUid: actor.uid,
        byRole: actor.role,
      });
      return res.json({ success: true, data: escalation });
    } catch (error) {
      return sendApiError(res, 500, "Failed to save escalation draft.", error);
    }
  });

  app.post("/api/issues/:issueId/routing-approval", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    const rationale = cleanText(req.body?.rationale, "", 1200);
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid routing approval request.");
    if (!rationale || rationale.length < 8) return sendApiError(res, 400, "Operator rationale is required.");
    const issueRef = adminDb.collection("issues").doc(issueId);
    try {
      const snap = await issueRef.get();
      if (!snap.exists) return sendApiError(res, 404, "Issue not found.");
      const data = snap.data();
      if (!requireOperatorForIssue(data, actor, res)) return;
      if (!data.resolutionPlan) return sendApiError(res, 409, "A draft resolution plan is required before routing approval.");
      const nowIso = new Date().toISOString();
      await issueRef.collection("approvals").add({
        type: "routing_action_packet",
        rationale,
        humanApproved: true,
        recommendedAuthority: data.resolutionPlan.recommendedAuthority || null,
        contactChannel: data.resolutionPlan.contactChannel || null,
        createdAt: nowIso,
        byUid: actor.uid,
        byRole: actor.role,
      });
      await issueRef.update({
        routingApprovedAt: nowIso,
        routingApprovedBy: actor.uid,
        assignedAt: data.assignedAt || nowIso,
        updatedAt: nowIso,
      });
      await addServerActivity(issueRef, {
        actorType: "operator",
        eventType: "routing_approved",
        message: `Draft routing/action packet approved for human follow-up. Rationale: ${rationale}`,
        timestamp: nowIso,
        byUid: actor.uid,
        byRole: actor.role,
      });
      return res.json({ success: true });
    } catch (error) {
      return sendApiError(res, 500, "Failed to approve routing plan.", error);
    }
  });

  app.post("/api/issues/:issueId/escalation-finalize", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    const rationale = cleanText(req.body?.rationale, "", 1200);
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid escalation finalization request.");
    if (!rationale || rationale.length < 8) return sendApiError(res, 400, "Operator rationale is required.");
    const issueRef = adminDb.collection("issues").doc(issueId);
    try {
      const snap = await issueRef.get();
      if (!snap.exists) return sendApiError(res, 404, "Issue not found.");
      const data = snap.data();
      if (!requireOperatorForIssue(data, actor, res)) return;
      if (!data.escalation) return sendApiError(res, 409, "Escalation draft is required before finalization.");
      const nowIso = new Date().toISOString();
      await issueRef.collection("approvals").add({
        type: "escalation_finalization",
        rationale,
        humanApproved: true,
        createdAt: nowIso,
        byUid: actor.uid,
        byRole: actor.role,
      });
      await issueRef.update({
        "escalation.finalizedAt": nowIso,
        "escalation.finalizedBy": actor.uid,
        updatedAt: nowIso,
      });
      await addServerActivity(issueRef, {
        actorType: "operator",
        eventType: "escalation_finalized",
        message: `Escalation/RTI draft finalized for manual use. Rationale: ${rationale}`,
        timestamp: nowIso,
        byUid: actor.uid,
        byRole: actor.role,
      });
      return res.json({ success: true });
    } catch (error) {
      return sendApiError(res, 500, "Failed to finalize escalation.", error);
    }
  });

  const demoSeedTemplates = [
    {
      title: "Clogged Stormwater Drain on Koramangala 80 Feet Road",
      description: "Synthetic sample: water backs up onto the road due to plastic blocking the inlet slab.",
      category: "drainage",
      locationName: "80 Feet Rd, Koramangala, Bengaluru",
      lat: 12.9348,
      lng: 77.6251,
      image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80",
      severity: 4,
      status: "in_progress",
      reportCount: 3,
      confirmCount: 4,
      urgency: "priority",
    },
    {
      title: "Massive Crater Pothole outside Indiranagar Metro Station",
      description: "Synthetic sample: large pothole on the main road forces two wheelers to swerve.",
      category: "pothole",
      locationName: "CMH Road, Indiranagar, Bengaluru",
      lat: 12.9785,
      lng: 77.6385,
      image: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
      severity: 5,
      status: "submitted",
      reportCount: 1,
      confirmCount: 0,
      urgency: "urgent",
    },
    {
      title: "Broken Streetlight Street 14 Jayanagar 4th Block",
      description: "Synthetic sample: streetlight SL-J-98 has been broken for 10 days near the park.",
      category: "streetlight",
      locationName: "14th Cross Rd, Jayanagar 4th Block, Bengaluru",
      lat: 12.9282,
      lng: 77.5831,
      image: "https://images.unsplash.com/photo-1509024640106-cf78faeb99b2?auto=format&fit=crop&w=600&q=80",
      severity: 2,
      status: "verified",
      reportCount: 2,
      confirmCount: 3,
      urgency: "routine",
    },
    {
      title: "Overflowing Garbage Pile in Malleshwaram 8th Cross",
      description: "Synthetic sample: uncollected garbage is blocking pedestrians.",
      category: "waste",
      locationName: "8th Cross, Malleshwaram, Bengaluru",
      lat: 13.0031,
      lng: 77.5694,
      image: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
      severity: 3,
      status: "verified",
      reportCount: 4,
      confirmCount: 5,
      urgency: "priority",
    },
    {
      title: "Leaking Drinking Water Pipeline on ITPL Main Road",
      description: "Synthetic sample: clean water is leaking from a main joint and flooding the street.",
      category: "water_leak",
      locationName: "ITPL Main Rd, Whitefield, Bengaluru",
      lat: 12.9866,
      lng: 77.6950,
      image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
      severity: 5,
      status: "resolved",
      reportCount: 5,
      confirmCount: 8,
      urgency: "urgent",
    },
    {
      title: "Clogged Sewer Line on Outer Ring Road Yeswanthpur",
      description: "Synthetic sample: sewer line is overflowing onto a highway lane.",
      category: "drainage",
      locationName: "Pipeline Rd, Yeswanthpur, Bengaluru",
      lat: 13.0232,
      lng: 77.5550,
      image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80",
      severity: 4,
      status: "in_progress",
      reportCount: 2,
      confirmCount: 2,
      urgency: "priority",
    },
    {
      title: "Deep Pavement Cavity in HSR Layout Sector 2",
      description: "Synthetic sample: footpath block has caved in near commercial shops.",
      category: "pothole",
      locationName: "24th Main, HSR Layout Sector 2, Bengaluru",
      lat: 12.9112,
      lng: 77.6385,
      image: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
      severity: 3,
      status: "submitted",
      reportCount: 1,
      confirmCount: 1,
      urgency: "routine",
    },
  ];

  app.post("/api/demo/seed", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor?.isRealOperator && !actor?.isDemoOperator) {
      return sendApiError(res, 403, "Demo operator authorization is required.");
    }

    try {
      const existing = await adminDb.collection("issues").where("isDemoData", "==", true).limit(1).get();
      if (!existing.empty) return res.json({ success: true, seeded: 0 });
      const batch = adminDb.batch();
      const now = Date.now();

      for (const [index, template] of demoSeedTemplates.entries()) {
        const ref = adminDb.collection("issues").doc();
        const timestamp = new Date(now - (index + 2) * 6 * 60 * 60 * 1000).toISOString();
        const report = {
          ticketId: `#BLR-${Math.floor(10000 + Math.random() * 90000)}`,
          image: template.image,
          lat: template.lat,
          lng: template.lng,
          locationName: template.locationName,
          category: template.category,
          description: template.description,
          status: template.status,
          citizenUpvotes: template.confirmCount,
          userId: actor.uid,
          timestamp,
          createdAt: timestamp,
          updatedAt: new Date().toISOString(),
          title: template.title,
          summary: template.description,
          severity: template.severity,
          urgency: template.urgency,
          visibleHazards: ["Synthetic sample"],
          affectedArea: "street",
          privacyFlags: [],
          confidence: 0.9,
          reportCount: template.reportCount,
          confirmCount: template.confirmCount,
          disputeCount: 0,
          verificationStatus: template.confirmCount > 0 ? "community_confirmed" : "unverified",
          isDemoData: true,
          agentTrace: [{
            step: "Demo Seed",
            tool: "demo.syntheticSeed",
            status: "done",
            rationale: "Synthetic demo record seeded by server for workflow preview.",
            ts: new Date().toISOString(),
            outputSummary: "Synthetic demo only",
          }],
          priorityScore: serverPriorityScore(template),
        };
        batch.set(ref, report);
        batch.set(ref.collection("activity").doc(), {
          actorType: "operator",
          eventType: "demo_seeded",
          message: "Synthetic demo report seeded by server.",
          timestamp: new Date().toISOString(),
          byUid: actor.uid,
          byRole: actor.role,
        });
      }

      await batch.commit();
      return res.json({ success: true, seeded: demoSeedTemplates.length });
    } catch (error) {
      return sendApiError(res, 500, "Failed to seed demo data.", error);
    }
  });

  app.post("/api/demo/clear", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor?.isRealOperator && !actor?.isDemoOperator) {
      return sendApiError(res, 403, "Demo operator authorization is required.");
    }

    try {
      const snap = await adminDb.collection("issues").where("isDemoData", "==", true).limit(200).get();
      const batch = adminDb.batch();
      snap.forEach((docSnap: any) => batch.delete(docSnap.ref));
      await batch.commit();
      return res.json({ success: true, cleared: snap.size });
    } catch (error) {
      return sendApiError(res, 500, "Failed to clear demo data.", error);
    }
  });


  // Server-side Gemini Multimodal Report Analysis Endpoint
  app.post("/api/analyze-report", async (req, res) => {
    const { image, description } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, error: "Image payload is required." });
    }

    try {
      // Clean base64 image by removing MIME prefix if present
      const base64Data = image.split(",")[1] || image;
      const mimeType = image.match(/data:([^;]+);/)?.[1] || "image/jpeg";

      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };

      const promptText = `Analyze this civic issue photo. Additional citizen context: "${description || "None provided"}".
Output a structured description including hazards, severity, scale, and urgency. 
If confidence is low (under 0.6) or ambiguity exists, ask a targeted clarificationQuestion to verify if this is the citizen's intended issue to report.`;

      const startTime = Date.now();
      // Main Gemini Content Generation
      const mainResult = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: [imagePart, { text: promptText }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                enum: categoriesList,
                description: "The primary category of the civic issue.",
              },
              title: {
                type: Type.STRING,
                description: "A very brief, descriptive, title for the report.",
              },
              summary: {
                type: Type.STRING,
                description: "1-2 sentence concise summary of the issue.",
              },
              severity: {
                type: Type.INTEGER,
                description: "Severity rating from 1 (minor) to 5 (extreme hazard).",
              },
              urgency: {
                type: Type.STRING,
                enum: urgenciesList,
                description: "Calculated response urgency.",
              },
              visibleHazards: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of hazards, debris, or damage visible in the shot.",
              },
              affectedArea: {
                type: Type.STRING,
                enum: areasList,
                description: "Relative scale of impact.",
              },
              privacyFlags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Privacy risks identified (like license plates, readable faces).",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence rating of detection between 0 and 1.",
              },
              clarificationQuestion: {
                type: Type.STRING,
                description: "A targeted question to clear up ambiguities if confidence is under 0.6 (optional).",
              },
            },
            required: [
              "category",
              "title",
              "summary",
              "severity",
              "urgency",
              "visibleHazards",
              "affectedArea",
              "privacyFlags",
              "confidence",
            ],
          },
        },
      });

      const durationMs = Date.now() - startTime;
      const response = mainResult.response;
      let finalRetried = mainResult.retried;
      let fallbackUsed = false;

      const responseText = response.text || "";
      let parsedData: any;
      let parseSuccess = false;

      try {
        parsedData = JSON.parse(responseText.trim());
        if (validateSchema(parsedData)) {
          parseSuccess = true;
        }
      } catch (e) {
        console.warn("First-attempt JSON parse/validation failed. Attempting repair...");
      }

      // Repair Once Mechanism
      if (!parseSuccess) {
        fallbackUsed = true;
        try {
          const repairPrompt = `The previous attempt to generate structured JSON failed schema validation or was malformed.
Please repair the JSON and output STRICT, VALID JSON conforming exactly to the requested schema.

The schema requires:
- category: one of ${JSON.stringify(categoriesList)}
- title: string
- summary: string
- severity: integer 1-5
- urgency: one of ${JSON.stringify(urgenciesList)}
- visibleHazards: string[]
- affectedArea: one of ${JSON.stringify(areasList)}
- privacyFlags: string[]
- confidence: number (0 to 1)
- clarificationQuestion?: optional string

Malformed Response output:
${responseText}

Respond ONLY with the corrected, valid JSON object.`;

          const repairResult = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: repairPrompt,
            config: {
              responseMimeType: "application/json",
            },
          });

          if (repairResult.retried) {
            finalRetried = true;
          }

          parsedData = JSON.parse((repairResult.response.text || "").trim());
          if (validateSchema(parsedData)) {
            parseSuccess = true;
          }
        } catch (repairError) {
          console.error("Gemini JSON Repair attempt failed too:", repairError);
        }
      }

      const truncatedDesc = description ? (description.length > 30 ? description.slice(0, 30) + "..." : description) : "None";
      const inputDigest = `photo (${mimeType}) + description: "${truncatedDesc}"`;
      const outputSummary = parseSuccess
        ? `${parsedData.category || "issue"} · severity ${parsedData.severity || 1}/5 · ${parsedData.visibleHazards?.length || 0} hazards · ${(parsedData.confidence || 0).toFixed(2)} conf`
        : "Fallback to manual form";

      if (parseSuccess) {
        return res.json({
          success: true,
          fallback: false,
          data: parsedData,
          durationMs,
          confidence: parsedData.confidence,
          inputDigest,
          outputSummary,
          retried: finalRetried,
          fallbackUsed,
        });
      } else {
        // Fall back cleanly to manual form
        return res.json({
          success: false,
          fallback: true,
          error: "Schema validation failed, falling back to manual entry mode.",
          durationMs,
          confidence: 0,
          inputDigest,
          outputSummary,
          retried: finalRetried,
          fallbackUsed,
        });
      }
    } catch (error: any) {
      console.error("Gemini analysis error:", error);
      return sendApiError(res, 500, "An error occurred during Gemini multimodal analysis.");
    }
  });

  // Server-side Gemini Duplicate Checking Endpoint
  app.post("/api/check-duplicate", async (req, res) => {
    const { newReport, candidates } = req.body;

    if (!newReport || !candidates || !Array.isArray(candidates)) {
      return res.status(400).json({ success: false, error: "Missing newReport or candidates array." });
    }

    try {
      const promptText = `Compare this newly saved CivicLens prototype issue report with these potential candidate duplicate issues located in close proximity.
New Report details:
- Category: ${newReport.category}
- AI Title: ${newReport.title}
- AI Summary: ${newReport.summary}

Candidate prototype reports:
${candidates.map((c: any, index: number) => `${index + 1}. Candidate ID: ${c.id}\n - Category: ${c.category}\n - Title: ${c.title || "Untitled"}\n - Summary: ${c.summary || c.description}`).join("\n\n")}

Your goal is to recommend whether the new report is a duplicate of one of the existing candidates and should be merged, or if it is a separate distinct issue that warrants a brand new incident report, or if there is some ambiguity so we should ask the user to decide.

Guidelines:
- "merge": Recommend this if the new report is clearly describing the exact same physical issue (e.g. the exact same pothole, street light, or flood) as one of the candidates.
- "ask_user": Recommend this if there is a strong possibility of it being a duplicate but some details match and others differ, so we want the user to clarify. There is minor ambiguity.
- "create_new": Recommend this if the issue is a separate, distinct occurrence (e.g. a different pothole downstream, a different broken light nearby, or a different category of issue entirely).

Output STRICT, VALID JSON conforming exactly to the response schema.`;

      const startTime = Date.now();
      const result = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendation: {
                type: Type.STRING,
                enum: ["merge", "create_new", "ask_user"],
                description: "Recommendation: merge, create_new, or ask_user.",
              },
              bestCandidateId: {
                type: Type.STRING,
                description: "The ID of the best matching candidate from the list, or empty string if recommendation is create_new.",
              },
              similarity: {
                type: Type.NUMBER,
                description: "Similarity score between 0.0 and 1.0.",
              },
              reasons: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "A few clear reasons detailing why you recommend this path.",
              },
            },
            required: ["recommendation", "bestCandidateId", "similarity", "reasons"],
          },
        },
      });

      const durationMs = Date.now() - startTime;
      const response = result.response;
      const retried = result.retried;

      const responseText = (response.text || "").trim();
      let parsedData = JSON.parse(responseText);
      
      // Map bestCandidateId from empty string/empty check to null if create_new
      if (parsedData.recommendation === "create_new" || !parsedData.bestCandidateId || parsedData.bestCandidateId === "") {
        parsedData.bestCandidateId = null;
      }

      const inputDigest = `Compare: ${newReport.category} vs ${candidates.length} candidates`;
      const outputSummary = `Rec: ${parsedData.recommendation} · similarity: ${(parsedData.similarity || 0).toFixed(2)}`;

      return res.json({ 
        success: true, 
        data: parsedData,
        durationMs,
        confidence: parsedData.similarity,
        inputDigest,
        outputSummary,
        retried
      });
    } catch (error: any) {
      console.error("Duplicate detection error:", error);
      return sendApiError(res, 500, "An error occurred during Gemini duplicate analysis.");
    }
  });

  // Server-side Gemini Resolution Plan Generator (with Google Search Grounding)
  app.post("/api/resolution-plan", async (req, res) => {
    const { category, title, summary, locationName, lat, lng, ticketId } = req.body;

    if (!category || !title || !summary) {
      return res.status(400).json({ success: false, error: "Missing required category, title, or summary parameters." });
    }

    try {
      const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const promptText = `Suggest a likely responsible Indian municipal authority or department and draft a complaint packet for human review for this reported civic issue.
Use Google Search grounding to look up likely real-world departments, municipal corporations, or utility boards that may handle this category of issue in this specific Indian city or state (based on the location/address description: "${locationName || "India"}", and coordinates if provided: lat: ${lat || "unknown"}, lng: ${lng || "unknown"}).

Issue details:
- Category: ${category}
- Title: ${title}
- Summary: ${summary}
- CivicLens prototype ticket ID: ${ticketId || "N/A"}
- Reporting Date (Today): ${todayStr}

Perform a grounded lookup for this Indian location. If the city or municipality is identified (e.g. Bangalore/Bengaluru -> BBMP/BWSSB, Mumbai -> BMC, Delhi -> MCD/DJB, Pune -> PMC, Chennai -> GCC, etc.), determine:
1. The likely municipal corporation, public works body, or utility contact to verify (recommendedAuthority).
2. A public citizen grievance portal, email, app name, or citizen helpline toll-free number if grounded (contactChannel).
3. A published or typical citizen follow-up window in days for resolving such issue in that region (slaDays, integer). If uncertain, provide a conservative estimate and make that uncertainty clear.
4. A drafted complaint email or letter for human review:
   - subject: A concise professional subject line
   - body: The full body of a draft letter, starting with a polite salutation (e.g., "To the Public Grievance Officer / Commissioner..."), laying out the ticket summary, citing safety concerns, precise location, and asking for review within the suggested follow-up window.
   - bodyHindi: A translated version of the draft complaint body in fluent Hindi (हिन्दी), starting with polite greetings, outlining the grievance clearly, and asking for remedial action.
   - summaryHindi: A brief 1-2 sentence Hindi (हिन्दी) summary of the problem, suitable for the complainant to read.
   - nextActions: 3 actionable steps for the citizen to verify before acting (e.g., "Check the ward contact page", "Call the civic helpline", "Follow up via Ward Committee").

CRITICAL COMPLIANCE DIRECTIVE:
You MUST use ONLY the actual ticketId ('${ticketId || "N/A"}') and the actual current date ('${todayStr}') for any reference numbers, complaint IDs, or reporting dates in the drafted emails/documents.
NEVER invent, simulate, or hallucinate different reference numbers, other case tracking IDs, dates, or fake past event histories/follow-ups.

Output STRICT, VALID JSON conforming exactly to this schema:
{
  "recommendedAuthority": "string",
  "contactChannel": "string",
  "slaDays": 10,
  "actionPacket": {
    "subject": "string",
    "body": "string",
    "bodyHindi": "string",
    "summaryHindi": "string",
    "nextActions": ["string", "string", "string"]
  }
}

Output ONLY valid JSON and nothing else.`;

      const startTime = Date.now();
      const result = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: promptText,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const durationMs = Date.now() - startTime;
      const response = result.response;
      const retried = result.retried;

      const responseText = (response.text || "").trim();
      let cleanText = responseText;
      // Strip markdown code fences if present
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      let parsedData: any;
      try {
        parsedData = JSON.parse(cleanText);
      } catch (e) {
        // Fallback: try regex-extract JSON
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Unable to parse Gemini resolution plan result as JSON.");
        }
      }

      // Extract search grounding metadata sources
      const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundingSources: string[] = searchChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter(Boolean);

      const uniqueSources = Array.from(new Set(groundingSources));

      // Append sources to parsed data
      parsedData.groundingSources = uniqueSources;

      const inputDigest = `${category}: "${title}"`;
      const outputSummary = `Suggested authority: ${parsedData.recommendedAuthority} · follow-up: ${parsedData.slaDays} days`;

      return res.json({ 
        success: true, 
        data: parsedData,
        durationMs,
        confidence: 0.95,
        inputDigest,
        outputSummary,
        retried
      });
    } catch (error: any) {
      console.error("Resolution plan generation error:", error);
      return sendApiError(res, 500, "An error occurred during Gemini resolution plan generation.");
    }
  });

  // Multimodal before/after resolution verification analyzer
  app.post("/api/verify-resolution", async (req: any, res) => {
    let { beforeImageUrl, afterImage, summary } = req.body;
    const actor = req.actor as RequestActor | undefined;
    const issueId = isSafeDocumentId(req.body?.issueId) ? req.body.issueId : null;
    const afterImageUrl = cleanText(req.body?.afterImageUrl, "", 2000);
    let issueRef: any = null;
    let issueData: any = null;

    if (!afterImage) {
      return res.status(400).json({ success: false, error: "Missing afterImage payload." });
    }

    try {
      if (issueId) {
        if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
        issueRef = adminDb.collection("issues").doc(issueId);
        const snap = await issueRef.get();
        if (!snap.exists) return sendApiError(res, 404, "Issue not found.");
        issueData = snap.data();
        if (!requireOperatorForIssue(issueData, actor, res)) return;
        beforeImageUrl = issueData.image || beforeImageUrl;
        summary = issueData.summary || issueData.description || summary;
      }

      const contentsList: any[] = [];

      // 1. Process beforeImageUrl (with SSRF protection checking host safety)
      if (beforeImageUrl && /^https:\/\/firebasestorage\.googleapis\.com\//.test(beforeImageUrl)) {
        try {
          const fetchRes = await fetch(beforeImageUrl, {
            signal: AbortSignal.timeout(8000),
          });
          if (fetchRes.ok) {
            const contentType = fetchRes.headers.get("content-type") || "";
            if (contentType.startsWith("image/")) {
              const buffer = await fetchRes.arrayBuffer();
              const base64 = Buffer.from(buffer).toString("base64");
              contentsList.push({
                inlineData: {
                  mimeType: contentType,
                  data: base64,
                },
              });
            } else {
              console.warn("SSRF protection: ignored non-image content type:", contentType);
            }
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch beforeImageUrl to base64, proceeding without it:", fetchErr);
        }
      }

      // 2. Process afterImage (base64)
      const afterMime = afterImage.match(/data:([^;]+);/)?.[1] || "image/jpeg";
      const afterBase64 = afterImage.split(",")[1] || afterImage;
      contentsList.push({
        inlineData: {
          mimeType: afterMime,
          data: afterBase64,
        },
      });

      // 3. Prompt and analyze
      const promptText = `Compare these visual states of a reported civic issue in India.
Original report context/summary: "${summary || "Check for resolved hazard"}"

The first image (if provided) is the 'before' state.
The latest image is the 'after' state.

Inspect and evaluate the repair/clearance work. Determine:
1. Is the issue completely resolved (resolved = true/false)?
2. Confidence score (number from 0.0 to 1.0).
3. Detailed observedChanges (array of strings, e.g. ["Pothole filled with fresh asphalt", "Worker tools removed"]).
4. Draft recommendation. Must be exactly one of: "resolve" (appears fully completed), "request_more_evidence" (need clearer zoom/angle), or "reopen" (appears incomplete or failed repair).
5. Comprehensive structural explanation of your findings in a friendly/professional engineering tone.

Return a STRICT JSON response adhering precisely to this schema. Do not include markdown wraps or code fences in the JSON structure.`;

      contentsList.push({ text: promptText });

      const startTime = Date.now();
      const result = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: contentsList,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              resolved: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              observedChanges: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendation: {
                type: Type.STRING,
                enum: ["resolve", "request_more_evidence", "reopen"],
              },
              explanation: { type: Type.STRING },
            },
            required: ["resolved", "confidence", "observedChanges", "recommendation", "explanation"],
          },
        },
      });

      const durationMs = Date.now() - startTime;
      const response = result.response;
      const retried = result.retried;

      const responseText = (response.text || "").trim();
      let cleanResponseText = responseText;
      // Strip markdown code fences if present
      cleanResponseText = cleanResponseText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      const parsedResult = JSON.parse(cleanResponseText);

      const inputDigest = `Compare original vs afterImage`;
      const closureAssessment = {
        resolved: parsedResult.resolved === true,
        confidence: cleanNumber(parsedResult.confidence, 0, 0, 1),
        observedChanges: cleanStringArray(parsedResult.observedChanges, 12, 240),
        recommendation: ["resolve", "request_more_evidence", "reopen"].includes(parsedResult.recommendation)
          ? parsedResult.recommendation
          : "request_more_evidence",
        explanation: cleanText(parsedResult.explanation, "Gemini returned no explanation.", 1200),
        afterImage: afterImageUrl || undefined,
      };
      const outputSummary = `Resolved: ${closureAssessment.resolved} - Rec: ${closureAssessment.recommendation} - conf: ${closureAssessment.confidence.toFixed(2)}`;

      if (issueRef) {
        const nowIso = new Date().toISOString();
        await issueRef.update({
          closureAssessment,
          closureSubmittedAt: nowIso,
          agentTrace: [
            ...(Array.isArray(issueData?.agentTrace) ? issueData.agentTrace : []),
            {
              step: "verify_closure",
              tool: "agent.verify_closure",
              status: closureAssessment.resolved ? "done" : "failed",
              rationale: closureAssessment.explanation,
              ts: nowIso,
              durationMs,
              confidence: closureAssessment.confidence,
              inputDigest,
              outputSummary,
              retried,
            },
          ].slice(-30),
          updatedAt: nowIso,
        });
        await addServerActivity(issueRef, {
          actorType: "operator",
          eventType: "closure_assessment",
          message: "Closure assessment generated by Gemini and saved by the server for human review.",
          timestamp: nowIso,
          byUid: actor?.uid,
          byRole: actor?.role,
        });
      }

      return res.json({ 
        success: true, 
        data: closureAssessment,
        durationMs,
        confidence: parsedResult.confidence,
        inputDigest,
        outputSummary,
        retried
      });
    } catch (error: any) {
      console.error("verify-resolution error:", error);
      return sendApiError(res, 500, "An error occurred during Gemini multimodal verification.");
    }
  });

  // Auto-Escalation + RTI generator endpoint
  app.post("/api/escalation", async (req, res) => {
    const { title, summary, locationName, category, recommendedAuthority, ticketId } = req.body;

    try {
      const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const promptText = `Draft a public grievance escalation letter and a draft RTI request for this unresolved civic complaint. The output is for human review only and is not submitted by CivicLens.
      
Complaint Title: ${title || "Civic Grievance"}
Category: ${category || "General"}
Context Summary: ${summary || "Unresolved infrastructure/civic problem"}
Location description: ${locationName || "India"}
Recommended Initial Department: ${recommendedAuthority || "Municipal Corporation"}
CivicLens prototype ticket ID: ${ticketId || "N/A"}
Reporting Reference Date (Today): ${todayStr}

Draft two separate documents:
1. escalationLetter: A professional draft grievance escalation letter directed to a plausible next-higher administrative authority (such as the Municipal Commissioner, District Magistrate, or Department Secretary). It should cite the initial delay, impact on public safety/sanity, and ask for urgent intervention.
2. rtiRequest: A draft RTI request under Section 6(1) of the RTI Act 2005 to the Public Information Officer (PIO) of the municipal corporation/department. It should request details regarding:
   - The current daily tracking status of the complaint.
   - The names, designations, and contact numbers of the officers responsible for addressing this grievance.
   - Any comments, reports, or file notes recorded by the inspecting authorities.
   - The published timeframe or expected follow-up period for this category of work and explanation for the delay.

CRITICAL COMPLIANCE DIRECTIVE:
You MUST use ONLY the actual ticketId ('${ticketId || "N/A"}') and the actual current date ('${todayStr}') for any reference numbers, complaint IDs, or reporting dates in the letters/petitions. 
NEVER invent, simulate, or generate outer reference numbers, other case tracking IDs, dates, or fake past event histories/follow-ups that do not exist.

Return a STRICT JSON response adhering precisely to this schema:
{
  "escalationLetter": "string",
  "rtiRequest": "string"
}`;

      const startTime = Date.now();
      const result = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              escalationLetter: { type: Type.STRING },
              rtiRequest: { type: Type.STRING },
            },
            required: ["escalationLetter", "rtiRequest"],
          },
        },
      });

      const durationMs = Date.now() - startTime;
      const response = result.response;
      const retried = result.retried;

      const responseText = (response.text || "").trim();
      let cleanText = responseText;
      // Strip markdown code fences if present
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      const parsedResult = JSON.parse(cleanText);

      const inputDigest = `Escalate ticket ${ticketId || "N/A"}`;
      const outputSummary = `Drafted Escalation Letter + RTI Request`;

      return res.json({ 
        success: true, 
        data: parsedResult,
        durationMs,
        confidence: 0.90,
        inputDigest,
        outputSummary,
        retried
      });
    } catch (error: any) {
      console.error("escalation generation error:", error);
      return sendApiError(res, 500, "An error occurred during Gemini escalation generation.");
    }
  });

  // Server-side Gemini Translation Endpoint
  app.post("/api/translate", async (req, res) => {
    const { title, summary } = req.body;
    if (!title || !summary) {
      return res.status(400).json({ success: false, error: "Missing title or summary to translate." });
    }
    try {
      const promptText = `Translate the following civic issue title and summary from English to Hindi (हिन्दी).
Title: "${title}"
Summary: "${summary}"

Ensure the translation is natural and easy for Indian citizens to understand.
Output STRICT, VALID JSON conforming exactly to this schema:
{
  "titleHi": "string",
  "summaryHi": "string"
}
Output ONLY valid JSON and nothing else.`;

      const result = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titleHi: { type: Type.STRING, description: "The Hindi translation of the title." },
              summaryHi: { type: Type.STRING, description: "The Hindi translation of the summary." },
            },
            required: ["titleHi", "summaryHi"],
          },
        },
      });

      const responseText = (result.response.text || "").trim();
      let cleanText = responseText;
      // Strip markdown code fences if present
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      const parsedData = JSON.parse(cleanText);
      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Translation error:", error);
      // Fallback: return the original English strings
      return res.json({
        success: false,
        error: "Translation failed.",
        data: { titleHi: title, summaryHi: summary }
      });
    }
  });

  // Helper to generate the structured action packet & native Hindi translations
  async function generateActionPacket(aiClient: any, issue: any, authority: string, channel: string, slaDays: number): Promise<any> {
    const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const promptText = `Draft a complaint packet for human review for this reported civic issue in India.
Responsible Authority: ${authority}
Contact Channel: ${channel}
Suggested follow-up window: ${slaDays} days
Issue details:
- Category: ${issue.category}
- Title: ${issue.title}
- Summary: ${issue.summary}
- Reference Date (Today): ${todayStr}

Output a drafted complaint email/letter:
- subject: A concise professional subject line
- body: The full body of a draft letter, starting with a polite salutation (e.g., "To the Public Grievance Officer / Commissioner..."), laying out the ticket summary, citing safety concerns, precise location, and asking for review within the suggested follow-up window.
- bodyHindi: A translated version of the draft complaint body in fluent Hindi (हिन्दी).
- summaryHindi: A brief 1-2 sentence Hindi (हिन्दी) summary of the problem, suitable for the complainant to read.
- nextActions: 3 actionable steps for the citizen to verify before acting.

Output STRICT, VALID JSON conforming exactly to this schema:
{
  "subject": "string",
  "body": "string",
  "bodyHindi": "string",
  "summaryHindi": "string",
  "nextActions": ["string", "string", "string"]
}
Output ONLY valid JSON and nothing else.`;

    const result = await generateContentWithRetry(aiClient, {
      model: "gemini-2.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
            bodyHindi: { type: Type.STRING },
            summaryHindi: { type: Type.STRING },
            nextActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["subject", "body", "bodyHindi", "summaryHindi", "nextActions"],
        },
      },
    });

    const text = (result.response.text || "").trim();
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean);
  }

  function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const radius = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  async function loadNearbyCandidates(issueId: string, issue: any): Promise<any[]> {
    if (typeof issue.lat !== "number" || typeof issue.lng !== "number") return [];
    const snap = await adminDb.collection("issues").orderBy("timestamp", "desc").limit(80).get();
    const candidates: any[] = [];
    snap.forEach((docSnap: any) => {
      if (docSnap.id === issueId) return;
      const data = docSnap.data();
      if (typeof data.lat !== "number" || typeof data.lng !== "number") return;
      const distanceM = distanceMeters(issue.lat, issue.lng, data.lat, data.lng);
      if (distanceM <= 250) {
        candidates.push({
          id: docSnap.id,
          title: data.title,
          category: data.category,
          summary: data.summary || data.description,
          locationName: data.locationName,
          status: data.status,
          distanceM: Math.round(distanceM),
        });
      }
    });
    return candidates.slice(0, 8);
  }

  async function persistAgentRun(issueRef: any, runRef: any, run: any, steps: any[], resolutionPlan: any, final: any) {
    const batch = adminDb.batch();
    batch.set(runRef, run, { merge: true });
    for (const step of steps) {
      batch.set(issueRef.collection("agentSteps").doc(step.id), step);
      batch.set(runRef.collection("steps").doc(step.id), step);
    }
    batch.update(issueRef, {
      latestAgentRunId: run.id,
      agentTrace: steps.map(({ id, runId, issueId, order, model, ...trace }) => trace),
      resolutionPlan,
      priorityScore: typeof final?.priorityScore === "number" ? cleanNumber(final.priorityScore, 0, 0, 100) : FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
    await batch.commit();
  }

  app.get("/api/issues/:issueId/agent-runs/latest", async (req, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const { issueId } = req.params;
    if (!isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid issue id.");

    try {
      const runSnap = await adminDb.collection("agentRuns")
        .where("issueId", "==", issueId)
        .orderBy("startedAt", "desc")
        .limit(1)
        .get();
      if (runSnap.empty) return res.json({ success: true, run: null, steps: [] });
      const runDoc = runSnap.docs[0];
      const stepsSnap = await runDoc.ref.collection("steps").orderBy("order", "asc").get();
      const steps = stepsSnap.docs.map((docSnap: any) => docSnap.data());
      return res.json({ success: true, run: runDoc.data(), steps });
    } catch (error) {
      return sendApiError(res, 500, "Failed to load agent run.", error);
    }
  });

  // Real Gemini Function-Calling Agentic Triage Loop
  app.post("/api/agent/run", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.body || {};
    const idempotencyKey = isSafeDocumentId(req.body?.idempotencyKey) ? req.body.idempotencyKey : adminDb.collection("agentRuns").doc().id;
    if (!actor || !isSafeDocumentId(issueId)) {
      return sendApiError(res, 400, "Missing or invalid issueId.");
    }

    const issueRef = adminDb.collection("issues").doc(issueId);
    const runRef = adminDb.collection("agentRuns").doc(`${issueId}_${idempotencyKey}`);

    try {
      const existingRun = await runRef.get();
      if (existingRun.exists) {
        const stepsSnap = await runRef.collection("steps").orderBy("order", "asc").get();
        return res.json({
          success: true,
          run: existingRun.data(),
          steps: stepsSnap.docs.map((docSnap: any) => docSnap.data()),
          idempotent: true,
        });
      }

      const issueSnap = await issueRef.get();
      if (!issueSnap.exists) return sendApiError(res, 404, "Issue not found.");
      const issue = { id: issueSnap.id, ...issueSnap.data() };
      const safeCandidates = await loadNearbyCandidates(issueId, issue);

      const agentTools = [{
        functionDeclarations: [
          {
            name: "search_nearby_cases",
            description: "Return nearby candidate reports loaded from Firestore by deterministic application code.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                radiusM: { type: Type.NUMBER },
              },
            }
          },
          {
            name: "calculate_priority",
            description: "Compute the deterministic 0-100 civic priority score for this issue.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                severity: { type: Type.NUMBER },
                urgency: { type: Type.STRING },
                confirmCount: { type: Type.NUMBER },
                reportCount: { type: Type.NUMBER }
              },
              required: ["severity", "urgency"]
            }
          },
          {
            name: "compare_candidate_evidence",
            description: "Decide whether this issue duplicates one of the provided nearby candidates. Return the candidate id to merge into, or 'none'.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                candidateId: { type: Type.STRING },
                similarity: { type: Type.NUMBER },
                reasoning: { type: Type.STRING }
              },
              required: ["candidateId", "reasoning"]
            }
          },
          {
            name: "find_responsible_authority",
            description: "Suggest a responsible municipal authority and typical follow-up window for this category and location.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                locationName: { type: Type.STRING }
              },
              required: ["category", "locationName"]
            }
          },
          {
            name: "draft_action_packet",
            description: "Draft a safe complaint/action packet summary for human review. This does not submit anything externally.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING },
                summary: { type: Type.STRING },
                nextAction: { type: Type.STRING }
              },
              required: ["subject", "summary"]
            }
          },
          {
            name: "verify_closure",
            description: "Check whether closure evidence exists and report that final closure still needs human approval.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                recommendation: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["recommendation", "reason"]
            }
          },
          {
            name: "record_event",
            description: "Record the final triage summary for the persisted agent run.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                routeTo: { type: Type.STRING },
                priorityScore: { type: Type.NUMBER },
                rationale: { type: Type.STRING }
              },
              required: ["routeTo", "rationale"]
            }
          },
          {
            name: "request_human_approval",
            description: "Record that a consequential recommendation must wait for human approval.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["action", "reason"]
            }
          }
        ]
      }];

      // Server-side tool implementations
      async function execTool(name: string, args: any) {
        if (name === "search_nearby_cases") {
          return { candidates: safeCandidates, radiusM: args.radiusM || 250 };
        }
        if (name === "calculate_priority") {
          const severity = args.severity || 1;
          const urgency = args.urgency || "routine";
          const confirmCount = args.confirmCount || 0;
          const reportCount = args.reportCount || 1;
          let urgencyBonus = 0;
          if (urgency === "urgent") urgencyBonus = 10;
          else if (urgency === "priority") urgencyBonus = 5;
          const score = severity * 12 + urgencyBonus + Math.min(confirmCount * 3, 15) + Math.min(reportCount * 4, 15);
          const clampedScore = Math.max(0, Math.min(100, score));
          const roundedScore = Math.round(clampedScore * 10) / 10;
          return { score: roundedScore };
        }
        if (name === "compare_candidate_evidence") {
          const candidateId = cleanText(args.candidateId, "none", 160);
          if (!candidateId || candidateId === "none") {
            return { candidateId: "none", similarity: null };
          }
          if (!safeCandidates.some((candidate) => candidate.id === candidateId)) {
            return {
              candidateId: "none",
              similarity: null,
              rejected: true,
              reason: "Candidate id was not part of the server-loaded candidate set.",
            };
          }
          return { candidateId, similarity: cleanNumber(args.similarity, 0, 0, 1) };
        }
        if (name === "find_responsible_authority") {
          try {
            const searchPrompt = `Suggest the likely responsible Indian municipal authority/department, a public contact channel (helpline/portal/email), and a published or typical follow-up window in days for category: "${args.category || "general"}" in location: "${args.locationName || "India"}".
            
            You must output a strict JSON object conforming exactly to this schema:
            {
              "authority": "string (e.g. BBMP, BMC, MCD, etc.)",
              "sla": number (follow-up window in days, e.g. 7),
              "channel": "string (contact portal/helpline/email)"
            }
            
            Return ONLY the raw JSON block inside markdown code fences:
            \`\`\`json
            { ... }
            \`\`\``;

            const searchRes = await generateContentWithRetry(ai, {
              model: "gemini-2.5-flash",
              contents: searchPrompt,
              config: {
                tools: [{ googleSearch: {} }]
              }
            });

            const responseText = (searchRes.response.text || "").trim();
            let cleanText = responseText;
            cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
            
            const jsonStart = cleanText.indexOf("{");
            const jsonEnd = cleanText.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) {
              cleanText = cleanText.slice(jsonStart, jsonEnd + 1);
            }
            
            const parsed = JSON.parse(cleanText);
            const authVal = parsed.authority || "Municipal Corporation";
            const slaVal = typeof parsed.sla === "number" ? parsed.sla : parseInt(parsed.sla) || 7;
            const chanVal = parsed.channel || "Public grievance channel";
            
            return { authority: authVal, sla: slaVal, channel: chanVal };
          } catch (searchErr: any) {
            console.warn("find_responsible_authority grounded search failed, returning fallback:", searchErr);
            return { authority: "Municipal Corporation", sla: 7, channel: "Public grievance channel" };
          }
        }
        if (name === "draft_action_packet") {
          return {
            subject: cleanText(args.subject, `Draft Civic Grievance: ${issue.title || issue.category}`, 240),
            summary: cleanText(args.summary, issue.summary || issue.description || "Draft summary pending human review.", 1000),
            nextAction: cleanText(args.nextAction, "Human operator reviews this draft before any outside-app action.", 240),
          };
        }
        if (name === "verify_closure") {
          return {
            closureEvidencePresent: !!issue.closureAssessment,
            recommendation: cleanText(args.recommendation, issue.closureAssessment?.recommendation || "request_more_evidence", 80),
            humanDecisionRequired: true,
            reason: cleanText(args.reason, "Closure cannot be finalized without a human operator decision.", 400),
          };
        }
        if (name === "request_human_approval") {
          return { approvalRequired: true, action: args.action || "review", reason: args.reason || "Human review required" };
        }
        if (name === "record_event") {
          return { recorded: true, eventType: "agent_triage_completed" };
        }
        return { error: `Unknown tool: ${name}` };
      }

      let contents: any[] = [{ role: "user", parts: [{ text:
        `You are CivicLens's server-side triage agent. Use only server-provided issue data and tools.
Issue: ${JSON.stringify(issue)}
Steps: 1) call search_nearby_cases, 2) call compare_candidate_evidence using candidates if any, 3) call calculate_priority, 4) call find_responsible_authority, 5) call draft_action_packet, 6) call request_human_approval for any merge/routing/resolution recommendation, 7) call verify_closure to record that closure still needs human review, 8) call record_event. Call exactly one tool per turn.` }]}];

      const steps: any[] = [];
      let final: any = null;
      let guard = 0;

      let authority = "Municipal Corporation";
      let channel = "Public grievance channel";
      let slaDays = 7;

      let duplicateCandidateId: string | null = null;
      let duplicateSimilarity: number | null = null;
      let duplicateReasoning: string | null = null;

      while (guard++ < 8) {
        const t0 = Date.now();
        const { response, retried } = await generateContentWithRetry(ai, {
          model: "gemini-2.5-flash",
          contents,
          config: { tools: agentTools }
        });
        const calls = response.functionCalls || [];
        if (!calls.length) break;
        const fc = calls[0];
        const result = await execTool(fc.name, fc.args || {});

        // Save tool execution findings
        if (fc.name === "find_responsible_authority" && result) {
          authority = result.authority || authority;
          channel = result.channel || channel;
          slaDays = typeof result.sla === "number" ? result.sla : slaDays;
        }

        if (fc.name === "compare_candidate_evidence") {
          const cid = result?.candidateId;
          if (cid && cid !== "none" && cid !== "") {
            duplicateCandidateId = cid;
            duplicateSimilarity = result?.similarity ?? null;
            duplicateReasoning = cleanText(fc.args?.reasoning, "", 1000) || null;
          }
        }

        const stepId = `${runRef.id}_${steps.length + 1}_${fc.name}`;
        steps.push({
          id: stepId,
          runId: runRef.id,
          issueId,
          order: steps.length + 1,
          step: fc.name,
          tool: `agent.${fc.name}`,
          status: "done",
          inputDigest: JSON.stringify(fc.args).slice(0, 160),
          outputSummary: JSON.stringify(result).slice(0, 160),
          durationMs: Date.now() - t0,
          ts: new Date().toISOString(),
          rationale: fc.args?.reasoning || fc.args?.rationale || fc.args?.reason || `Called ${fc.name}`,
          model: "gemini-2.5-flash",
          retried,
          sources: fc.name === "search_nearby_cases"
            ? safeCandidates.map((candidate) => ({
                title: candidate.title || candidate.id,
                url: `firestore://issues/${candidate.id}`,
                claimSupported: "Nearby candidate loaded by server search",
                sourceType: "sourced",
              }))
            : [],
        });

        contents.push({ role: "model", parts: [{ functionCall: fc } as any] });
        contents.push({ role: "user", parts: [{ functionResponse: { name: fc.name, response: { result } } } as any] });

        if (fc.name === "record_event") {
          final = fc.args;
          break;
        }
      }

      // Generate the final rich resolution plan
      let resolutionPlan = null;
      try {
        const actionPacket = await generateActionPacket(ai, issue, authority, channel, slaDays);
        resolutionPlan = {
          recommendedAuthority: authority,
          contactChannel: channel,
          slaDays,
          actionPacket,
          groundingSources: [{
            title: authority,
            url: typeof channel === "string" && /^https?:\/\//.test(channel) ? channel : "",
            claimSupported: "Responsible authority/contact suggestion generated by server-side Gemini grounding or fallback.",
            sourceType: channel === "Public grievance channel" ? "estimated" : "sourced",
          }]
        };
      } catch (planErr: any) {
        console.error("Failed to generate action packet in agent run, using fallback:", planErr);
        resolutionPlan = {
          recommendedAuthority: authority,
          contactChannel: channel,
          slaDays,
          actionPacket: {
            subject: `Draft Civic Grievance: ${issue.title || "Civic Incident"}`,
            body: `To the Commissioner / Officer,\n\nWe would like to share a civic grievance draft regarding ${issue.category} at ${issue.locationName || "the location"}.\nSummary: ${issue.summary || "No details provided."}\n\nPlease review and advise on next steps within the suggested follow-up window of ${slaDays} days.\n\nSincerely,\nCivicLens Prototype`,
            bodyHindi: `आयुक्त / अधिकारी के लिए,\n\nहम ${issue.locationName || "स्थान"} पर ${issue.category} के संबंध में यह नागरिक शिकायत मसौदा साझा करना चाहते हैं।\nसारांश: ${issue.summary || "कोई विवरण प्रदान नहीं किया गया।"}\n\nकृपया इस मुद्दे की समीक्षा करें और ${slaDays} दिनों की सुझाई गई फॉलो-अप अवधि के भीतर अगले कदम बताएं।\n\nसादर,\nCivicLens Prototype`,
            summaryHindi: `${issue.category} की शिकायत दर्ज की गई है।`,
            nextActions: [
              "Post on social media / X tagging the authorities.",
              "Manually verify the appropriate public grievance channel before acting outside CivicLens.",
              "Follow up with local ward committee."
            ]
          },
          groundingSources: [{
            title: authority,
            url: "",
            claimSupported: "Fallback authority/contact suggestion; verify manually before outside-app action.",
            sourceType: "estimated",
          }]
        };
      }

      const nowIso = new Date().toISOString();
      const run = {
        id: runRef.id,
        issueId,
        status: "completed",
        startedAt: steps[0]?.ts || nowIso,
        completedAt: nowIso,
        model: "gemini-2.5-flash",
        actorUid: actor.uid,
        actorRole: actor.role,
        duplicateCandidateId,
        duplicateSimilarity,
        duplicateReasoning,
        final,
        resolutionPlan,
        stepCount: steps.length,
      };

      await persistAgentRun(issueRef, runRef, run, steps, resolutionPlan, final);

      return res.json({
        success: true,
        run,
        steps,
        final,
        duplicateCandidateId,
        duplicateSimilarity,
        duplicateReasoning,
        resolutionPlan
      });
    } catch (error: any) {
      console.error("Agent run error:", error);
      return sendApiError(res, 500, "An unexpected error occurred during the agent triage run.");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    structuredLog("info", "server_listening", {
      port: PORT,
      mode: runtimeConfig.mode,
      localAppCheckBypassEnabled,
      requireAppCheck,
      demoOperatorEnabled,
      firebaseProjectId: firebaseAdminConfig.projectId || "adc-discovered",
      firestoreDatabaseId: firebaseAdminConfig.databaseId,
    });
  });
}

startServer();

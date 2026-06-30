import express from "express";
import path from "path";
import { createHash } from "node:crypto";
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
  parsePositiveInt,
  parseCsvEnv,
  quotaWindowStart,
  resolveActorFromDecoded,
  type QuotaConfig,
  type QuotaResult,
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

  function configuredGeminiModel(envName: string, fallback: string) {
    const configured = String(process.env[envName] || "").trim();
    return configured || fallback;
  }

  const geminiModels = {
    cheapClassification: configuredGeminiModel("CIVICLENS_GEMINI_CHEAP_MODEL", "gemini-2.5-flash-lite"),
    reasoning: configuredGeminiModel("CIVICLENS_GEMINI_REASONING_MODEL", "gemini-2.5-flash"),
    vision: configuredGeminiModel("CIVICLENS_GEMINI_VISION_MODEL", "gemini-2.5-flash"),
    audio: configuredGeminiModel("CIVICLENS_GEMINI_AUDIO_MODEL", "gemini-2.5-flash"),
    grounding: configuredGeminiModel("CIVICLENS_GEMINI_GROUNDING_MODEL", "gemini-2.5-flash"),
    planner: configuredGeminiModel("CIVICLENS_PLANNER_MODEL", configuredGeminiModel("CIVICLENS_GEMINI_PLANNER_MODEL", "gemini-2.5-pro")),
    embedding: configuredGeminiModel("CIVICLENS_GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
  };

  function geminiModelTierSummary() {
    return {
      cheapClassification: geminiModels.cheapClassification,
      reasoning: geminiModels.reasoning,
      vision: geminiModels.vision,
      audio: geminiModels.audio,
      grounding: geminiModels.grounding,
      planner: geminiModels.planner,
      embedding: geminiModels.embedding,
    };
  }

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

  function makeAbortError(signal?: AbortSignal): Error {
    const reason = signal?.reason;
    const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Operation aborted.";
    const error = new Error(message || "Operation aborted.");
    error.name = "AbortError";
    return error;
  }

  function isAbortError(error: any): boolean {
    const message = String(error?.message || "").toLowerCase();
    return error?.name === "AbortError" || error?.code === "ABORT_ERR" || message.includes("aborted") || message.includes("timeout");
  }

  function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw makeAbortError(signal);
    }
  }

  async function sleepWithAbort(ms: number, signal?: AbortSignal) {
    throwIfAborted(signal);
    if (!signal) {
      await sleep(ms);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", onAbort);
        reject(makeAbortError(signal));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  async function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    throwIfAborted(signal);
    if (!signal) return promise;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        reject(makeAbortError(signal));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        }
      );
    });
  }

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

  function safeLogText(value: unknown, fallback = "unknown", maxLength = 300): string {
    const raw = String(value || fallback);
    const googleWebKeyPattern = new RegExp(`${["A", "Iza"].join("")}[0-9A-Za-z_-]{20,}`, "g");
    return raw
      .replace(googleWebKeyPattern, "[redacted-google-key]")
      .replace(/sk-[0-9A-Za-z_-]{20,}/g, "[redacted-key]")
      .slice(0, maxLength);
  }

  function hasGoogleSearchTool(args: any): boolean {
    const tools = args?.config?.tools;
    return Array.isArray(tools) && tools.some((tool) => !!tool?.googleSearch);
  }

  function hasInteractionGoogleSearchTool(args: any): boolean {
    const tools = args?.tools;
    return Array.isArray(tools) && tools.some((tool) => tool?.type === "google_search");
  }

  type GeminiUsageAccumulator = {
    callCount: number;
    pricedCallCount: number;
    unpricedCallCount: number;
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    inputTokenCount: number;
    outputTokenCount: number;
    estimatedCostUsd: number;
  };

  type GeminiCallUsage = {
    promptTokenCount: number;
    candidatesTokenCount: number;
    thoughtsTokenCount: number;
    toolUsePromptTokenCount: number;
    cachedContentTokenCount: number;
    totalTokenCount: number;
    inputTokenCount: number;
    outputTokenCount: number;
    estimatedCostUsd: number | null;
    costPricingSource: "env" | "unconfigured" | "usage-metadata-unavailable";
  };

  type GeminiGenerateOptions = {
    signal?: AbortSignal;
    usageAccumulator?: GeminiUsageAccumulator;
    onRetry?: (event: { model: string; attempt: number; maxAttempts: number; delayMs: number; error: string }) => void | Promise<void>;
  };

  const geminiInputUsdPerMillionTokens = parseNonNegativeFloatEnv(process.env.CIVICLENS_GEMINI_INPUT_USD_PER_MILLION_TOKENS);
  const geminiOutputUsdPerMillionTokens = parseNonNegativeFloatEnv(process.env.CIVICLENS_GEMINI_OUTPUT_USD_PER_MILLION_TOKENS);

  function parseNonNegativeFloatEnv(value: string | undefined): number | null {
    if (value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function cleanTokenCount(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
  }

  function roundCostUsd(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
  }

  function summarizeGeminiUsage(response: any): GeminiCallUsage {
    const interactionUsage = response?.usage;
    if (interactionUsage) {
      const inputTokenCount = cleanTokenCount(interactionUsage.total_input_tokens);
      const outputTokenCount = cleanTokenCount(interactionUsage.total_output_tokens) + cleanTokenCount(interactionUsage.total_thought_tokens);
      const toolUsePromptTokenCount = cleanTokenCount(interactionUsage.total_tool_use_tokens);
      const cachedContentTokenCount = cleanTokenCount(interactionUsage.total_cached_tokens);
      const totalTokenCount = cleanTokenCount(interactionUsage.total_tokens) || inputTokenCount + outputTokenCount + toolUsePromptTokenCount;
      const pricingConfigured = geminiInputUsdPerMillionTokens !== null && geminiOutputUsdPerMillionTokens !== null;
      return {
        promptTokenCount: inputTokenCount,
        candidatesTokenCount: cleanTokenCount(interactionUsage.total_output_tokens),
        thoughtsTokenCount: cleanTokenCount(interactionUsage.total_thought_tokens),
        toolUsePromptTokenCount,
        cachedContentTokenCount,
        totalTokenCount,
        inputTokenCount: inputTokenCount + toolUsePromptTokenCount,
        outputTokenCount,
        estimatedCostUsd: pricingConfigured
          ? roundCostUsd(
              ((inputTokenCount + toolUsePromptTokenCount) / 1_000_000) * geminiInputUsdPerMillionTokens +
              (outputTokenCount / 1_000_000) * geminiOutputUsdPerMillionTokens
            )
          : null,
        costPricingSource: pricingConfigured ? "env" : "unconfigured",
      };
    }

    const metadata = response?.usageMetadata || {};
    const promptTokenCount = cleanTokenCount(metadata.promptTokenCount);
    const candidatesTokenCount = cleanTokenCount(metadata.candidatesTokenCount);
    const thoughtsTokenCount = cleanTokenCount(metadata.thoughtsTokenCount);
    const toolUsePromptTokenCount = cleanTokenCount(metadata.toolUsePromptTokenCount);
    const cachedContentTokenCount = cleanTokenCount(metadata.cachedContentTokenCount);
    const derivedTotal = promptTokenCount + candidatesTokenCount + thoughtsTokenCount + toolUsePromptTokenCount;
    const totalTokenCount = cleanTokenCount(metadata.totalTokenCount) || derivedTotal;
    const hasUsageMetadata = !!metadata && (
      promptTokenCount > 0 ||
      candidatesTokenCount > 0 ||
      thoughtsTokenCount > 0 ||
      toolUsePromptTokenCount > 0 ||
      totalTokenCount > 0
    );
    const inputTokenCount = promptTokenCount + toolUsePromptTokenCount;
    const outputTokenCount = candidatesTokenCount + thoughtsTokenCount;
    const pricingConfigured = geminiInputUsdPerMillionTokens !== null && geminiOutputUsdPerMillionTokens !== null;
    const estimatedCostUsd = hasUsageMetadata && pricingConfigured
      ? roundCostUsd(
          (inputTokenCount / 1_000_000) * geminiInputUsdPerMillionTokens +
          (outputTokenCount / 1_000_000) * geminiOutputUsdPerMillionTokens
        )
      : null;
    return {
      promptTokenCount,
      candidatesTokenCount,
      thoughtsTokenCount,
      toolUsePromptTokenCount,
      cachedContentTokenCount,
      totalTokenCount,
      inputTokenCount,
      outputTokenCount,
      estimatedCostUsd,
      costPricingSource: hasUsageMetadata ? (pricingConfigured ? "env" : "unconfigured") : "usage-metadata-unavailable",
    };
  }

  function geminiUsageLogFields(usage: GeminiCallUsage) {
    return {
      promptTokenCount: usage.promptTokenCount,
      candidatesTokenCount: usage.candidatesTokenCount,
      totalTokenCount: usage.totalTokenCount,
      inputTokenCount: usage.inputTokenCount,
      outputTokenCount: usage.outputTokenCount,
      estimatedCostUsd: usage.estimatedCostUsd,
      costPricingSource: usage.costPricingSource,
    };
  }

  function createGeminiUsageAccumulator(): GeminiUsageAccumulator {
    return {
      callCount: 0,
      pricedCallCount: 0,
      unpricedCallCount: 0,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
      inputTokenCount: 0,
      outputTokenCount: 0,
      estimatedCostUsd: 0,
    };
  }

  function recordGeminiUsage(accumulator: GeminiUsageAccumulator | undefined, usage: GeminiCallUsage) {
    if (!accumulator) return;
    accumulator.callCount += 1;
    accumulator.promptTokenCount += usage.promptTokenCount;
    accumulator.candidatesTokenCount += usage.candidatesTokenCount;
    accumulator.totalTokenCount += usage.totalTokenCount;
    accumulator.inputTokenCount += usage.inputTokenCount;
    accumulator.outputTokenCount += usage.outputTokenCount;
    if (typeof usage.estimatedCostUsd === "number") {
      accumulator.pricedCallCount += 1;
      accumulator.estimatedCostUsd += usage.estimatedCostUsd;
    } else {
      accumulator.unpricedCallCount += 1;
    }
  }

  function snapshotGeminiUsage(accumulator: GeminiUsageAccumulator) {
    return {
      geminiCallCount: accumulator.callCount,
      geminiPricedCallCount: accumulator.pricedCallCount,
      geminiUnpricedCallCount: accumulator.unpricedCallCount,
      geminiPromptTokenCount: accumulator.promptTokenCount,
      geminiCandidatesTokenCount: accumulator.candidatesTokenCount,
      geminiTotalTokenCount: accumulator.totalTokenCount,
      geminiInputTokenCount: accumulator.inputTokenCount,
      geminiOutputTokenCount: accumulator.outputTokenCount,
      geminiEstimatedCostUsd: accumulator.pricedCallCount > 0 ? roundCostUsd(accumulator.estimatedCostUsd) : null,
    };
  }

  async function generateContentWithRetry(aiClient: any, args: any, options: GeminiGenerateOptions = {}): Promise<{ response: any; retried: boolean; usage: GeminiCallUsage }> {
    const delays = [1500, 3000, 6000];
    let attempt = 0;
    const startedAt = Date.now();
    const model = safeLogText(args?.model, "unknown-model", 120);
    while (true) {
      try {
        throwIfAborted(options.signal);
        const callArgs = options.signal
          ? { ...args, config: { ...(args.config || {}), abortSignal: options.signal } }
          : args;
        const response = await withAbort(aiClient.models.generateContent(callArgs), options.signal);
        const usage = summarizeGeminiUsage(response);
        recordGeminiUsage(options.usageAccumulator, usage);
        structuredLog("info", "gemini_call_completed", {
          model,
          durationMs: Date.now() - startedAt,
          attempts: attempt + 1,
          retried: attempt > 0,
          googleSearchGrounding: hasGoogleSearchTool(args),
          structuredResponse: !!args?.config?.responseSchema,
          ...geminiUsageLogFields(usage),
        });
        return { response, retried: attempt > 0, usage };
      } catch (error: any) {
        if (isAbortError(error)) {
          throw error;
        }
        if (attempt < delays.length && isRetryableError(error)) {
          const delayTime = delays[attempt];
          structuredLog("warn", "gemini_retry", {
            attempt: attempt + 1,
            maxAttempts: delays.length + 1,
            delayMs: delayTime,
            model,
            error: safeLogText(error?.message || String(error)),
          });
          await options.onRetry?.({
            model,
            attempt: attempt + 1,
            maxAttempts: delays.length + 1,
            delayMs: delayTime,
            error: safeLogText(error?.message || String(error)),
          });
          await sleepWithAbort(delayTime, options.signal);
          attempt++;
        } else {
          structuredLog("error", "gemini_call_failed", {
            model,
            durationMs: Date.now() - startedAt,
            attempts: attempt + 1,
            retryable: isRetryableError(error),
            googleSearchGrounding: hasGoogleSearchTool(args),
            structuredResponse: !!args?.config?.responseSchema,
            estimatedCostUsd: null,
            costPricingSource: "usage-metadata-unavailable",
            error: safeLogText(error?.message || String(error)),
          });
          throw error;
        }
      }
    }
  }

  async function createInteractionWithRetry(aiClient: any, args: any, options: GeminiGenerateOptions = {}): Promise<{ interaction: any; retried: boolean; usage: GeminiCallUsage }> {
    const delays = [1500, 3000, 6000];
    let attempt = 0;
    const startedAt = Date.now();
    const model = safeLogText(args?.model, "unknown-model", 120);
    while (true) {
      try {
        throwIfAborted(options.signal);
        const interaction = await withAbort(aiClient.interactions.create(args), options.signal);
        const usage = summarizeGeminiUsage(interaction);
        recordGeminiUsage(options.usageAccumulator, usage);
        structuredLog("info", "gemini_call_completed", {
          model,
          apiSurface: "interactions",
          durationMs: Date.now() - startedAt,
          attempts: attempt + 1,
          retried: attempt > 0,
          googleSearchGrounding: hasInteractionGoogleSearchTool(args),
          structuredResponse: !!args?.response_format,
          ...geminiUsageLogFields(usage),
        });
        return { interaction, retried: attempt > 0, usage };
      } catch (error: any) {
        if (isAbortError(error)) {
          throw error;
        }
        if (attempt < delays.length && isRetryableError(error)) {
          const delayTime = delays[attempt];
          structuredLog("warn", "gemini_retry", {
            attempt: attempt + 1,
            maxAttempts: delays.length + 1,
            delayMs: delayTime,
            model,
            apiSurface: "interactions",
            error: safeLogText(error?.message || String(error)),
          });
          await sleepWithAbort(delayTime, options.signal);
          attempt++;
        } else {
          structuredLog("error", "gemini_call_failed", {
            model,
            apiSurface: "interactions",
            durationMs: Date.now() - startedAt,
            attempts: attempt + 1,
            retryable: isRetryableError(error),
            googleSearchGrounding: hasInteractionGoogleSearchTool(args),
            structuredResponse: !!args?.response_format,
            estimatedCostUsd: null,
            costPricingSource: "usage-metadata-unavailable",
            error: safeLogText(error?.message || String(error)),
          });
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

  function isJobSecretRoute(path: string): boolean {
    return path === "/api/jobs/run" || path === "/api/smoke/deploy" || path === "/api/smoke/model-tiers";
  }

  function hasValidJobSecret(req: any): boolean {
    const jobSecret = process.env.CIVICLENS_JOB_SECRET || "";
    return isJobSecretRoute(apiPath(req)) && !!jobSecret && req.headers["x-civiclens-job-secret"] === jobSecret;
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

    if (hasValidJobSecret(req)) {
      res.setHeader("X-CivicLens-AppCheck", "job-secret");
      return next();
    }

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
    if (hasValidJobSecret(req)) return next();

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

  const quotaFallbackBuckets = new Map<string, { count: number; resetTime: number }>();
  const quotaConfig = {
    session: {
      limit: parsePositiveInt(process.env.CIVICLENS_SESSION_QUOTA_LIMIT, 60),
      windowMs: parsePositiveInt(process.env.CIVICLENS_SESSION_QUOTA_WINDOW_MS, 60_000),
    },
    gemini: {
      limit: parsePositiveInt(process.env.CIVICLENS_GEMINI_QUOTA_LIMIT, 20),
      windowMs: parsePositiveInt(process.env.CIVICLENS_GEMINI_QUOTA_WINDOW_MS, 60_000),
    },
    mutation: {
      limit: parsePositiveInt(process.env.CIVICLENS_MUTATION_QUOTA_LIMIT, 30),
      windowMs: parsePositiveInt(process.env.CIVICLENS_MUTATION_QUOTA_WINDOW_MS, 60_000),
    },
  } as const;
  const quotaCollectionName = process.env.CIVICLENS_QUOTA_COLLECTION || "rateLimitBuckets";
  const quotaBackend = String(process.env.CIVICLENS_QUOTA_BACKEND || "firestore").toLowerCase();

  function hashQuotaValue(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  function memoryQuota(key: string, config: QuotaConfig, backend: "memory" | "memory-fallback"): QuotaResult & { backend: string } {
    return {
      ...consumeQuota(quotaFallbackBuckets, key, config),
      backend,
    };
  }

  async function consumeDistributedQuota(
    routeKind: string,
    key: string,
    config: QuotaConfig
  ): Promise<QuotaResult & { backend: string; unavailable?: boolean }> {
    const fallbackWindowStart = quotaWindowStart(Date.now(), config.windowMs);
    const fallbackResetTime = fallbackWindowStart + config.windowMs;
    if (!adminDb) {
      if (isProduction) {
        return { allowed: false, remaining: 0, resetTime: fallbackResetTime, backend: "firestore-unavailable", unavailable: true };
      }
      return memoryQuota(key, config, "memory-fallback");
    }

    if (quotaBackend === "memory") {
      return memoryQuota(key, config, "memory");
    }

    const now = Date.now();
    const windowStartMs = quotaWindowStart(now, config.windowMs);
    const resetTime = windowStartMs + config.windowMs;
    const keyHash = hashQuotaValue(key);
    const docId = hashQuotaValue(`${key}:${windowStartMs}`);
    const ref = adminDb.collection(quotaCollectionName).doc(docId);

    try {
      const result = await adminDb.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        const currentCount = snap.exists && Number(snap.get("resetTime")) === resetTime
          ? Math.max(0, Number(snap.get("count") || 0))
          : 0;
        const nextCount = currentCount + 1;
        tx.set(ref, {
          routeKind,
          keyHash,
          windowStartMs,
          resetTime,
          windowMs: config.windowMs,
          limit: config.limit,
          count: nextCount,
          expiresAt: new Date(resetTime + config.windowMs),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
          allowed: nextCount <= config.limit,
          remaining: Math.max(0, config.limit - nextCount),
          resetTime,
        };
      });

      return { ...result, backend: "firestore" };
    } catch (error: any) {
      structuredLog(isProduction ? "error" : "warn", "distributed_quota_unavailable", {
        routeKind,
        backend: "firestore",
        fallback: !isProduction,
        error: error?.message || String(error),
      });
      if (isProduction) {
        return { allowed: false, remaining: 0, resetTime, backend: "firestore-unavailable", unavailable: true };
      }
      return memoryQuota(key, config, "memory-fallback");
    }
  }

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

  app.use("/api/*", async (req: any, res, next) => {
    const routeKind = classifyProtectedRoute(req.method, apiPath(req));
    if (routeKind === "health") return next();
    const config = routeKind === "gemini" ? quotaConfig.gemini : routeKind === "session" ? quotaConfig.session : quotaConfig.mutation;
    const actorKey = hasValidJobSecret(req) ? "job-secret" : req.actor?.uid || "anonymous";
    const key = `${routeKind}:${actorKey}:${clientIp(req)}`;
    const quota = await consumeDistributedQuota(routeKind, key, config);
    res.setHeader("X-RateLimit-Limit", String(config.limit));
    res.setHeader("X-RateLimit-Remaining", String(quota.remaining));
    res.setHeader("X-RateLimit-Reset", new Date(quota.resetTime).toISOString());
    res.setHeader("X-RateLimit-Backend", quota.backend);
    if (quota.unavailable) {
      return sendApiError(res, 503, "Quota enforcement is temporarily unavailable.");
    }
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

  type DeploySmokeCheck = {
    ok: boolean;
    name: string;
    status: string;
    durationMs?: number;
    detail?: Record<string, unknown>;
    error?: string;
  };

  async function runDeploySmokeChecks() {
    const startedAt = Date.now();
    const checks: Record<"readyz" | "auth" | "gemini" | "maps", DeploySmokeCheck> = {
      readyz: {
        name: "readyz",
        ok: false,
        status: "not_checked",
      },
      auth: {
        name: "auth",
        ok: false,
        status: "not_checked",
      },
      gemini: {
        name: "gemini",
        ok: false,
        status: "not_checked",
      },
      maps: {
        name: "maps",
        ok: false,
        status: "not_checked",
      },
    };

    const readiness = readinessPayload();
    checks.readyz = {
      name: "readyz",
      ok: readiness.ready,
      status: readiness.status,
      detail: {
        adminDb: readiness.checks.adminDb,
        geminiConfigured: readiness.checks.geminiConfigured,
        configValid: readiness.checks.configValid,
      },
    };

    const authStartedAt = Date.now();
    try {
      const authResult = await getAdminAuth().listUsers(1);
      checks.auth = {
        name: "auth",
        ok: true,
        status: "ok",
        durationMs: Date.now() - authStartedAt,
        detail: {
          userSampleCount: authResult.users.length,
          nextPageTokenPresent: !!authResult.pageToken,
        },
      };
    } catch (error: any) {
      checks.auth = {
        name: "auth",
        ok: false,
        status: "failed",
        durationMs: Date.now() - authStartedAt,
        error: safeLogText(error?.message || String(error)),
      };
    }

    const smokeUsage = createGeminiUsageAccumulator();
    const geminiStartedAt = Date.now();
    try {
      if (!geminiApiKey) {
        throw new Error("Gemini API key is not configured.");
      }
      const result = await generateContentWithRetry(ai, {
        model: geminiModels.cheapClassification,
        contents: "Return strict JSON proving this deploy smoke reached Gemini: {\"ok\":true,\"service\":\"gemini\"}.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ok: { type: Type.BOOLEAN },
              service: { type: Type.STRING },
            },
            required: ["ok", "service"],
          },
        },
      }, { signal: AbortSignal.timeout(20_000), usageAccumulator: smokeUsage });
      const responseText = (result.response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(responseText);
      checks.gemini = {
        name: "gemini",
        ok: parsed.ok === true,
        status: parsed.ok === true ? "ok" : "unexpected_response",
        durationMs: Date.now() - geminiStartedAt,
        detail: {
          service: safeLogText(parsed.service, "unknown", 80),
          model: geminiModels.cheapClassification,
          retried: result.retried,
          totalTokenCount: result.usage.totalTokenCount,
          estimatedCostUsd: result.usage.estimatedCostUsd,
        },
      };
    } catch (error: any) {
      checks.gemini = {
        name: "gemini",
        ok: false,
        status: "failed",
        durationMs: Date.now() - geminiStartedAt,
        error: safeLogText(error?.message || String(error)),
      };
    }

    const mapsStartedAt = Date.now();
    try {
      const mapsKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || "";
      if (!mapsKey) {
        throw new Error("Google Maps Platform key is not configured.");
      }
      const mapsUrl = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      mapsUrl.searchParams.set("input", "Indiranagar Metro Station Bengaluru");
      mapsUrl.searchParams.set("components", "country:in");
      mapsUrl.searchParams.set("key", mapsKey);
      const mapsResponse = await fetch(mapsUrl, { signal: AbortSignal.timeout(12_000) });
      const mapsJson: any = await mapsResponse.json().catch(() => ({}));
      const predictions = Array.isArray(mapsJson.predictions) ? mapsJson.predictions : [];
      const mapsOk = mapsResponse.ok && mapsJson.status === "OK" && predictions.length > 0;
      if (mapsOk) {
        checks.maps = {
          name: "maps",
          ok: true,
          status: "OK",
          durationMs: Date.now() - mapsStartedAt,
          detail: {
            api: "places-autocomplete-web-service",
            httpStatus: mapsResponse.status,
            predictionCount: predictions.length,
            firstPrediction: safeLogText(predictions[0]?.description, "", 160) || null,
          },
        };
      } else {
        const webServiceError = safeLogText(mapsJson.error_message || mapsResponse.statusText || "Maps smoke did not return predictions.");
        const appReferer = String(process.env.APP_URL || "").trim() || "http://localhost";
        const mapsJsUrl = new URL("https://maps.googleapis.com/maps/api/js");
        mapsJsUrl.searchParams.set("key", mapsKey);
        mapsJsUrl.searchParams.set("libraries", "places");
        mapsJsUrl.searchParams.set("v", "weekly");
        mapsJsUrl.searchParams.set("callback", "__civiclensDeploySmoke");
        const mapsJsResponse = await fetch(mapsJsUrl, {
          headers: { Referer: appReferer.endsWith("/") ? appReferer : `${appReferer}/` },
          signal: AbortSignal.timeout(12_000),
        });
        const mapsJsText = await mapsJsResponse.text();
        const mapsJsError = /(?:InvalidKeyMapError|RefererNotAllowedMapError|ApiNotActivatedMapError|ClientBillingNotEnabledMapError|ApiTargetBlockedMapError)/.exec(mapsJsText)?.[0] || "";
        const mapsJsOk = mapsJsResponse.ok && !mapsJsError && mapsJsText.includes("__civiclensDeploySmoke");
        checks.maps = {
          name: "maps",
          ok: mapsJsOk,
          status: mapsJsOk ? "OK" : safeLogText(mapsJson.status || mapsJsResponse.statusText || mapsJsResponse.status, "unknown", 80),
          durationMs: Date.now() - mapsStartedAt,
          detail: {
            api: mapsJsOk ? "maps-javascript-places-bootstrap" : "places-autocomplete-web-service",
            httpStatus: mapsJsResponse.status,
            predictionCount: predictions.length,
            firstPrediction: safeLogText(predictions[0]?.description, "", 160) || null,
            placesLibraryRequested: true,
            javascriptBytes: mapsJsText.length,
          },
          error: mapsJsOk ? undefined : safeLogText(mapsJsError || webServiceError || "Maps smoke did not load."),
        };
      }
    } catch (error: any) {
      checks.maps = {
        name: "maps",
        ok: false,
        status: "failed",
        durationMs: Date.now() - mapsStartedAt,
        error: safeLogText(error?.message || String(error)),
      };
    }

    const success = Object.values(checks).every((check) => check.ok);
    return {
      success,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      checks,
      geminiUsage: snapshotGeminiUsage(smokeUsage),
    };
  }

  type ModelTierSmokeName = "cheapClassification" | "vision" | "reasoning" | "planner" | "embedding";

  async function runModelTierSmokeChecks() {
    const startedAt = Date.now();
    const usage = createGeminiUsageAccumulator();
    const checks: Record<ModelTierSmokeName, DeploySmokeCheck> = {
      cheapClassification: { name: "cheapClassification", ok: false, status: "not_checked" },
      vision: { name: "vision", ok: false, status: "not_checked" },
      reasoning: { name: "reasoning", ok: false, status: "not_checked" },
      planner: { name: "planner", ok: false, status: "not_checked" },
      embedding: { name: "embedding", ok: false, status: "not_checked" },
    };

    const runJsonTier = async (
      name: Exclude<ModelTierSmokeName, "embedding">,
      model: string,
      contents: any,
      timeoutMs: number,
      responseSchema: any,
      validate: (parsed: any) => boolean,
    ) => {
      const tierStartedAt = Date.now();
      try {
        if (!geminiApiKey) throw new Error("Gemini API key is not configured.");
        const result = await generateContentWithRetry(ai, {
          model,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema,
          },
        }, { signal: AbortSignal.timeout(timeoutMs), usageAccumulator: usage });
        const responseText = (result.response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
        const parsed = JSON.parse(responseText);
        const ok = validate(parsed);
        checks[name] = {
          name,
          ok,
          status: ok ? "ok" : "unexpected_response",
          durationMs: Date.now() - tierStartedAt,
          detail: {
            model,
            retried: result.retried,
            totalTokenCount: result.usage.totalTokenCount,
            estimatedCostUsd: result.usage.estimatedCostUsd,
          },
        };
      } catch (error: any) {
        checks[name] = {
          name,
          ok: false,
          status: "failed",
          durationMs: Date.now() - tierStartedAt,
          detail: { model },
          error: safeLogText(error?.message || String(error)),
        };
      }
    };

    await runJsonTier(
      "cheapClassification",
      geminiModels.cheapClassification,
      "Classify this short civic text as civic or non_civic: 'streetlight is broken near a bus stop'. Return JSON only.",
      20_000,
      {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, enum: ["civic", "non_civic"] },
          confidence: { type: Type.NUMBER },
        },
        required: ["label", "confidence"],
      },
      (parsed) => parsed.label === "civic",
    );

    await runJsonTier(
      "vision",
      geminiModels.vision,
      [
        {
          inlineData: {
            mimeType: "image/png",
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
          },
        },
        { text: "Confirm that an image payload was received. Return JSON only." },
      ],
      30_000,
      {
        type: Type.OBJECT,
        properties: {
          sawImage: { type: Type.BOOLEAN },
          note: { type: Type.STRING },
        },
        required: ["sawImage", "note"],
      },
      (parsed) => parsed.sawImage === true,
    );

    await runJsonTier(
      "reasoning",
      geminiModels.reasoning,
      "Given one civic case with severity 4, near a school, and rain forecast, recommend one next operator action. Return JSON only.",
      25_000,
      {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
        required: ["action", "rationale"],
      },
      (parsed) => !!cleanText(parsed.action, "", 120) && !!cleanText(parsed.rationale, "", 300),
    );

    await runJsonTier(
      "planner",
      geminiModels.planner,
      "Create a tiny execution plan for a civic triage agent that must inspect context then record an event. Return JSON only.",
      45_000,
      {
        type: Type.OBJECT,
        properties: {
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          stopWhen: { type: Type.STRING },
        },
        required: ["steps", "stopWhen"],
      },
      (parsed) => Array.isArray(parsed.steps) && parsed.steps.length >= 2 && !!cleanText(parsed.stopWhen, "", 200),
    );

    const embeddingStartedAt = Date.now();
    try {
      if (!geminiApiKey) throw new Error("Gemini API key is not configured.");
      const embeddingResponse: any = await ai.models.embedContent({
        model: geminiModels.embedding,
        contents: "semantic duplicate check for a pothole near a bus stop",
      });
      const values = embeddingResponse?.embeddings?.[0]?.values || embeddingResponse?.embedding?.values || [];
      const dimension = Array.isArray(values) ? values.length : 0;
      checks.embedding = {
        name: "embedding",
        ok: dimension > 0,
        status: dimension > 0 ? "ok" : "unexpected_response",
        durationMs: Date.now() - embeddingStartedAt,
        detail: {
          model: geminiModels.embedding,
          dimension,
        },
      };
    } catch (error: any) {
      checks.embedding = {
        name: "embedding",
        ok: false,
        status: "failed",
        durationMs: Date.now() - embeddingStartedAt,
        detail: { model: geminiModels.embedding },
        error: safeLogText(error?.message || String(error)),
      };
    }

    const separation = {
      cheapVsReasoningDistinct: geminiModels.cheapClassification !== geminiModels.reasoning,
      plannerVsReasoningDistinct: geminiModels.planner !== geminiModels.reasoning,
      embeddingDedicated: geminiModels.embedding !== geminiModels.reasoning && geminiModels.embedding !== geminiModels.cheapClassification,
    };
    const success = Object.values(checks).every((check) => check.ok) && Object.values(separation).every(Boolean);
    return {
      success,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      modelTiers: geminiModelTierSummary(),
      separation,
      checks,
      geminiUsage: snapshotGeminiUsage(usage),
    };
  }

  app.post("/api/smoke/deploy", async (req: any, res) => {
    if (!hasValidJobSecret(req)) return sendApiError(res, 403, "Deploy smoke requires a valid job secret.");
    const result = await runDeploySmokeChecks();
    structuredLog(result.success ? "info" : "error", "deploy_smoke_completed", {
      status: result.success ? "passed" : "failed",
      durationMs: result.durationMs,
      readyz: result.checks.readyz.status,
      auth: result.checks.auth.status,
      gemini: result.checks.gemini.status,
      maps: result.checks.maps.status,
      geminiTotalTokenCount: result.geminiUsage.geminiTotalTokenCount,
      geminiEstimatedCostUsd: result.geminiUsage.geminiEstimatedCostUsd,
    });
    return res.status(result.success ? 200 : 503).json(result);
  });

  app.post("/api/smoke/model-tiers", async (req: any, res) => {
    if (!hasValidJobSecret(req)) return sendApiError(res, 403, "Model-tier smoke requires a valid job secret.");
    const result = await runModelTierSmokeChecks();
    structuredLog(result.success ? "info" : "error", "model_tier_smoke_completed", {
      status: result.success ? "passed" : "failed",
      durationMs: result.durationMs,
      cheapClassification: result.checks.cheapClassification.status,
      vision: result.checks.vision.status,
      reasoning: result.checks.reasoning.status,
      planner: result.checks.planner.status,
      embedding: result.checks.embedding.status,
      ...result.separation,
    });
    return res.status(result.success ? 200 : 503).json(result);
  });

  function cloudLoggingQueries() {
    return [
      {
        name: "Gemini call latency and retries",
        filter: 'jsonPayload.service="civiclens" AND jsonPayload.event="gemini_call_completed"',
      },
      {
        name: "Gemini failures",
        filter: 'jsonPayload.service="civiclens" AND jsonPayload.event="gemini_call_failed"',
      },
      {
        name: "Agent run completion",
        filter: 'jsonPayload.service="civiclens" AND jsonPayload.event="agent_run_metric"',
      },
      {
        name: "API request latency and status",
        filter: 'jsonPayload.service="civiclens" AND jsonPayload.event="api_request"',
      },
    ];
  }

  function incrementCount(counts: Record<string, number>, key: unknown) {
    const normalized = safeLogText(key || "unknown", "unknown", 80);
    counts[normalized] = (counts[normalized] || 0) + 1;
  }

  app.get("/api/ops/observability", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor?.isRealOperator && !actor?.isDemoOperator) {
      return sendApiError(res, 403, "Operator authorization is required.");
    }

    const sinceHours = Math.min(168, parsePositiveInt(req.query?.hours, 24));
    const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
    try {
      const [eventsSnap, runsSnap] = await Promise.all([
        adminDb.collection("events").where("timestamp", ">=", sinceIso).limit(250).get(),
        adminDb.collection("agentRuns").where("completedAt", ">=", sinceIso).limit(100).get(),
      ]);

      const byStatus: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      const byEventType: Record<string, number> = {};
      eventsSnap.docs.forEach((doc: any) => {
        const data = doc.data() || {};
        incrementCount(byStatus, data.status);
        incrementCount(bySource, data.source);
        incrementCount(byEventType, data.eventType);
      });

      const completedRuns = runsSnap.docs
        .map((doc: any) => doc.data() || {})
        .filter((run: any) => run.status === "completed");
      const durations = completedRuns
        .map((run: any) => Date.parse(run.completedAt || "") - Date.parse(run.startedAt || ""))
        .filter((duration: number) => Number.isFinite(duration) && duration >= 0);
      const stepCounts = completedRuns
        .map((run: any) => Number(run.stepCount || 0))
        .filter((count: number) => Number.isFinite(count) && count > 0);
      const average = (values: number[]) => values.length
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : null;

      structuredLog("info", "observability_snapshot", {
        sinceHours,
        eventCount: eventsSnap.size,
        agentRunCount: runsSnap.size,
        actorRole: actor.role,
      });

      return res.json({
        success: true,
        generatedAt: new Date().toISOString(),
        window: { sinceHours, sinceIso },
        eventCounts: {
          total: eventsSnap.size,
          byStatus,
          bySource,
          byEventType,
        },
        agentRuns: {
          total: runsSnap.size,
          completed: completedRuns.length,
          averageDurationMs: average(durations),
          averageStepCount: average(stepCounts),
        },
        cloudLoggingQueries: cloudLoggingQueries(),
        dashboardTemplate: "docs/monitoring/civiclens-cloud-monitoring-dashboard.json",
      });
    } catch (error) {
      return sendApiError(res, 500, "Failed to load observability snapshot.", error);
    }
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
    if (typeof data.isCivicIssue !== "boolean") return false;
    return true;
  }

  function applyCivicImageGuardrail(data: any): any {
    if (!data || typeof data !== "object") return data;
    const normalized = { ...data };
    normalized.confidence = cleanNumber(normalized.confidence, 0, 0, 1);
    normalized.severity = Math.round(cleanNumber(normalized.severity, 1, 1, 5));

    if (normalized.isCivicIssue === false) {
      normalized.category = "other";
      normalized.severity = Math.min(normalized.severity, 2);
      normalized.urgency = "routine";
      normalized.affectedArea = "unknown";
      normalized.visibleHazards = [];
      normalized.confidence = Math.min(normalized.confidence, 0.35);
      normalized.title = cleanText(normalized.title, "Non-civic image needs confirmation", 120) || "Non-civic image needs confirmation";
      normalized.summary = cleanText(
        normalized.summary,
        "The uploaded image does not clearly show a civic infrastructure issue. Please provide clearer civic evidence before saving.",
        600
      );
      normalized.clarificationQuestion = cleanText(
        normalized.clarificationQuestion,
        "This image does not clearly show a civic issue. Please upload clearer pothole, drainage, waste, water, lighting, or road-damage evidence, or explain what civic hazard is visible.",
        260
      );
      normalized.nonCivicReason = cleanText(
        normalized.nonCivicReason,
        "The image appears unrelated to civic infrastructure.",
        220
      );
    } else if (normalized.confidence < 0.6 && !normalized.clarificationQuestion) {
      normalized.clarificationQuestion = "Please confirm what civic hazard is visible and whether the photo clearly shows the issue to report.";
    }

    return normalized;
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

  function extractGroundingSources(response: any, claimSupported: string) {
    const searchChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const seenSources = new Set<string>();
    return searchChunks
      .map((chunk: any) => ({
        title: cleanText(chunk.web?.title, "Grounding source", 180),
        url: cleanText(chunk.web?.uri, "", 2000),
        claimSupported,
        sourceType: "sourced",
      }))
      .filter((source: any) => {
        if (!source.url || seenSources.has(source.url)) return false;
        seenSources.add(source.url);
        return true;
      });
  }

  function extractInteractionCitationSources(interaction: any, claimSupported: string) {
    const seenSources = new Set<string>();
    const sources: Array<{ title: string; url: string; claimSupported: string; sourceType: string }> = [];
    const steps = Array.isArray(interaction?.steps) ? interaction.steps : [];
    for (const step of steps) {
      const contentBlocks = Array.isArray(step?.content) ? step.content : [];
      for (const block of contentBlocks) {
        const annotations = Array.isArray(block?.annotations) ? block.annotations : [];
        for (const annotation of annotations) {
          if (annotation?.type !== "url_citation") continue;
          const url = cleanText(annotation.url, "", 2000);
          if (!url || seenSources.has(url)) continue;
          seenSources.add(url);
          sources.push({
            title: cleanText(annotation.title, "Grounding source", 180),
            url,
            claimSupported,
            sourceType: "sourced",
          });
        }
      }
    }
    return sources;
  }

  async function findGroundingCitationSources(aiClient: any, input: {
    category: string;
    title: string;
    summary: string;
    locationName?: string;
    lat?: unknown;
    lng?: unknown;
  }, options: GeminiGenerateOptions = {}) {
    const prompt = `Use Google Search to identify official or highly reliable public references for this Indian civic issue. Return one short sentence with citations.
Category: ${input.category}
Title: ${input.title}
Summary: ${input.summary}
Location: ${input.locationName || "India"}
Coordinates: lat ${input.lat || "unknown"}, lng ${input.lng || "unknown"}`;
    const result = await createInteractionWithRetry(aiClient, {
      model: geminiModels.grounding,
      input: prompt,
      tools: [{ type: "google_search" }],
      store: false,
    }, options);
    return extractInteractionCitationSources(
      result.interaction,
      "Suggested authority/contact reference returned by Google Search grounding."
    );
  }

  async function imageSourceToInlinePart(source: unknown, label: string): Promise<any | null> {
    const value = cleanText(source, "", 1_200_000);
    if (!value) return null;

    const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      return {
        inlineData: {
          mimeType: dataUrlMatch[1],
          data: dataUrlMatch[2],
        },
      };
    }

    if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 80) {
      return {
        inlineData: {
          mimeType: "image/jpeg",
          data: value,
        },
      };
    }

    if (/^https:\/\/firebasestorage\.googleapis\.com\//.test(value)) {
      try {
        const fetchRes = await fetch(value, { signal: AbortSignal.timeout(8000) });
        if (!fetchRes.ok) return null;
        const contentType = fetchRes.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) {
          console.warn(`SSRF protection: ignored non-image content type for ${label}:`, contentType);
          return null;
        }
        const buffer = await fetchRes.arrayBuffer();
        return {
          inlineData: {
            mimeType: contentType,
            data: Buffer.from(buffer).toString("base64"),
          },
        };
      } catch (error: any) {
        console.warn(`Failed to fetch ${label} image for Gemini:`, error?.message || error);
      }
    }

    return null;
  }

  function audioSourceToInlinePart(source: unknown, explicitMimeType?: unknown): any | null {
    const value = cleanText(source, "", 6_000_000);
    if (!value) return null;
    const cleanMime = cleanText(explicitMimeType, "", 80);
    const safeMime = /^audio\/[a-zA-Z0-9.+-]+$/.test(cleanMime) ? cleanMime : "audio/wav";
    const dataUrlMatch = value.match(/^data:(audio\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      return {
        inlineData: {
          mimeType: dataUrlMatch[1],
          data: dataUrlMatch[2],
        },
      };
    }
    if (/^[a-zA-Z0-9+/=\s]+$/.test(value) && value.replace(/\s+/g, "").length > 120) {
      return {
        inlineData: {
          mimeType: safeMime,
          data: value.replace(/\s+/g, ""),
        },
      };
    }
    return null;
  }

  function serverPriorityScore(issue: any): number {
    const severity = cleanNumber(issue.severity, 1, 1, 5);
    const urgencyBonus = issue.urgency === "urgent" ? 10 : issue.urgency === "priority" ? 5 : 0;
    const confirmBonus = Math.min(cleanNumber(issue.confirmCount, 0, 0, 999) * 3, 15);
    const reportBonus = Math.min(cleanNumber(issue.reportCount, 1, 1, 999) * 4, 15);
    return Math.round(Math.min(100, severity * 12 + urgencyBonus + confirmBonus + reportBonus) * 10) / 10;
  }

  const SLA_STAGE_ORDER = ["reminder", "escalation", "rti", "first_appeal"] as const;
  type SlaStage = typeof SLA_STAGE_ORDER[number];
  const SLA_MATRIX_HOURS: Record<string, number[]> = {
    pothole: [336, 240, 168, 72, 24],
    water_leak: [240, 168, 72, 24, 12],
    streetlight: [240, 168, 120, 72, 24],
    waste: [168, 120, 72, 48, 24],
    drainage: [168, 96, 48, 24, 12],
    road_damage: [336, 240, 120, 48, 24],
    other: [336, 240, 168, 96, 48],
  };

  function resolveSlaPolicy(issue: any) {
    const category = categoriesList.includes(issue?.category) ? issue.category : "other";
    const severity = Math.round(cleanNumber(issue?.severity, 3, 1, 5));
    const urgency = urgenciesList.includes(issue?.urgency) ? issue.urgency : "routine";
    const baseHours = SLA_MATRIX_HOURS[category]?.[severity - 1] || SLA_MATRIX_HOURS.other[severity - 1] || 168;
    const urgencyFactor = urgency === "urgent" ? 0.5 : urgency === "priority" ? 0.75 : 1;
    const slaHours = Math.max(6, Math.round(baseHours * urgencyFactor));
    return {
      category,
      severity,
      urgency,
      slaHours,
      slaDays: Math.round((slaHours / 24) * 10) / 10,
      matrixVersion: "category-severity-v1",
      source: "category_severity_matrix",
    };
  }

  function issueSlaStartMs(issue: any): number {
    const parsed = Date.parse(issue?.createdAt || issue?.triagedAt || issue?.timestamp || "");
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function buildSlaSchedule(issue: any, policy = resolveSlaPolicy(issue), overrideThresholdHours?: number) {
    const startMs = issueSlaStartMs(issue);
    const forcedHours = Number.isFinite(overrideThresholdHours as number)
      ? Math.max(0, overrideThresholdHours as number)
      : null;
    const reminderHours = forcedHours ?? Math.max(1, Math.round(policy.slaHours * 0.5));
    const escalationHours = forcedHours ?? policy.slaHours;
    const rtiHours = forcedHours ?? Math.max(policy.slaHours * 2, policy.slaHours + 72);
    const firstAppealHours = forcedHours ?? Math.max(policy.slaHours * 4, policy.slaHours + 720);

    return {
      reminderDueAt: new Date(startMs + reminderHours * 3600000).toISOString(),
      escalationDueAt: new Date(startMs + escalationHours * 3600000).toISOString(),
      rtiDueAt: new Date(startMs + rtiHours * 3600000).toISOString(),
      firstAppealDueAt: new Date(startMs + firstAppealHours * 3600000).toISOString(),
    };
  }

  function nextStageAfter(stage: SlaStage): SlaStage | null {
    const index = SLA_STAGE_ORDER.indexOf(stage);
    return index >= 0 ? SLA_STAGE_ORDER[index + 1] || null : null;
  }

  function buildSlaIssueFields(issue: any, nowIso: string, overrideThresholdHours?: number) {
    const policy = resolveSlaPolicy(issue);
    const deadlines = buildSlaSchedule(issue, policy, overrideThresholdHours);
    const ladder = issue?.slaLadder && typeof issue.slaLadder === "object" ? issue.slaLadder : {};
    return {
      slaPolicy: { ...policy, computedAt: nowIso },
      slaDeadline: deadlines.escalationDueAt,
      slaLadder: {
        ...ladder,
        deadlines,
        currentStage: ladder.currentStage || "none",
        nextStage: ladder.nextStage || "reminder",
        updatedAt: nowIso,
      },
    };
  }

  type BaseAgentStage<TContext> = {
    name: string;
    retries?: number;
    optional?: boolean;
    run: (context: TContext) => Promise<string | void> | string | void;
  };

  class BaseAgent<TContext extends { steps: any[] }> {
    constructor(private readonly name: string, private readonly stages: BaseAgentStage<TContext>[]) {}

    async run(context: TContext) {
      const startedAt = Date.now();
      for (const stage of this.stages) {
        const maxAttempts = Math.max(1, (stage.retries || 0) + 1);
        let attempt = 0;
        while (attempt < maxAttempts) {
          attempt++;
          const stageStartedAt = Date.now();
          try {
            const outputSummary = await stage.run(context);
            context.steps.push({
              stage: stage.name,
              status: "done",
              attempt,
              maxAttempts,
              durationMs: Date.now() - stageStartedAt,
              outputSummary: cleanText(outputSummary, `${stage.name} completed`, 500),
            });
            break;
          } catch (error: any) {
            const isFinalAttempt = attempt >= maxAttempts;
            context.steps.push({
              stage: stage.name,
              status: isFinalAttempt ? "failed" : "retry",
              attempt,
              maxAttempts,
              durationMs: Date.now() - stageStartedAt,
              errorMsg: cleanText(error?.message || String(error), "stage failed", 500),
            });
            if (isFinalAttempt) {
              if (stage.optional) break;
              throw error;
            }
          }
        }
      }
      return {
        name: this.name,
        version: "base-agent-v1",
        durationMs: Date.now() - startedAt,
        completedAt: new Date().toISOString(),
        steps: context.steps,
      };
    }
  }

  type ReportCreatePipelineContext = {
    issueId: string;
    actor: RequestActor;
    report: any;
    nowIso: string;
    steps: any[];
    shared: Record<string, unknown>;
  };

  function summarizeGroundingForReport(grounding: any) {
    return {
      weather: grounding?.weather || null,
      nearbyAmenitiesCount: Array.isArray(grounding?.nearbyAmenities) ? grounding.nearbyAmenities.length : 0,
      recurrence: grounding?.recurrence || null,
      sources: Array.isArray(grounding?.sources) ? grounding.sources.slice(0, 6) : [],
      errors: Array.isArray(grounding?.errors) ? grounding.errors.slice(0, 4) : [],
    };
  }

  async function runReportCreatePipeline(context: ReportCreatePipelineContext) {
    const pipeline = new BaseAgent<ReportCreatePipelineContext>("report_create_pipeline", [
      {
        name: "Vision",
        run: (ctx) => {
          ctx.shared.vision = {
            category: ctx.report.category,
            title: ctx.report.title,
            confidence: ctx.report.confidence,
            visibleHazards: ctx.report.visibleHazards,
            source: "client_gemini_or_manual_intake",
          };
          return `Vision intake accepted ${ctx.report.category} at confidence ${ctx.report.confidence}.`;
        },
      },
      {
        name: "Self-Verify",
        run: (ctx) => {
          ctx.report.category = categoriesList.includes(ctx.report.category) ? ctx.report.category : "other";
          ctx.report.urgency = urgenciesList.includes(ctx.report.urgency) ? ctx.report.urgency : "routine";
          ctx.report.severity = Math.round(cleanNumber(ctx.report.severity, 3, 1, 5));
          ctx.shared.selfVerify = {
            category: ctx.report.category,
            urgency: ctx.report.urgency,
            severity: ctx.report.severity,
          };
          return `Self-verified ${ctx.report.category}, severity ${ctx.report.severity}, ${ctx.report.urgency}.`;
        },
      },
      {
        name: "Geo",
        run: (ctx) => {
          const hash = geoHash7(ctx.report.lat, ctx.report.lng);
          if (hash) ctx.report.geohash7 = hash;
          ctx.shared.geo = {
            geohash7: hash,
            hasCoordinates: typeof ctx.report.lat === "number" && typeof ctx.report.lng === "number",
          };
          return hash ? `Computed geohash ${hash}.` : "No geohash because coordinates were incomplete.";
        },
      },
      {
        name: "Context",
        retries: 1,
        optional: true,
        run: async (ctx) => {
          if (typeof ctx.report.lat !== "number" || typeof ctx.report.lng !== "number") {
            ctx.shared.localContext = { skipped: true, reason: "coordinates unavailable" };
            return "Skipped external context because coordinates were unavailable.";
          }
          const grounding = await fetchExternalGrounding(ctx.report.lat, ctx.report.lng, ctx.report.category, ctx.issueId);
          const summary = summarizeGroundingForReport(grounding);
          ctx.shared.localContext = summary;
          ctx.report.localContext = summary;
          return `Grounded context from ${summary.sources.length} source(s).`;
        },
      },
      {
        name: "Risk",
        run: (ctx) => {
          ctx.report.priorityScore = serverPriorityScore(ctx.report);
          Object.assign(ctx.report, buildSlaIssueFields(ctx.report, ctx.nowIso));
          ctx.shared.risk = {
            priorityScore: ctx.report.priorityScore,
            slaDeadline: ctx.report.slaDeadline,
            slaPolicy: ctx.report.slaPolicy,
          };
          return `Priority ${ctx.report.priorityScore}; SLA ${ctx.report.slaPolicy?.slaHours}h.`;
        },
      },
      {
        name: "Route",
        run: (ctx) => {
          const route = validateAuthorityAgainstRegistry(ctx.report.locationName, {
            authority: "",
            sla: ctx.report.slaPolicy?.slaDays || 7,
            channel: "",
          });
          ctx.shared.route = route;
          ctx.report.routingHint = {
            recommendedAuthority: route.authority,
            contactChannel: route.channel,
            slaDays: route.sla,
            registryValidated: route.registryValidated,
            registryId: route.registryId,
          };
          return `Route hint ${route.authority}; registry ${route.registryId}.`;
        },
      },
      {
        name: "Draft",
        run: (ctx) => {
          ctx.report.pipelineDraft = {
            subject: `Draft Civic Grievance: ${ctx.report.title || ctx.report.category}`,
            summary: ctx.report.summary || ctx.report.description,
            nextAction: "Human operator reviews route and escalation draft before any outside-app action.",
          };
          return "Prepared internal draft packet preview.";
        },
      },
      {
        name: "Monitor",
        run: (ctx) => {
          ctx.report.monitoring = {
            nextWorker: "sla",
            slaDeadline: ctx.report.slaDeadline || null,
            followUpSource: "report_create_pipeline",
            createdAt: ctx.nowIso,
          };
          return "Registered SLA monitoring handoff.";
        },
      },
    ]);

    const result = await pipeline.run(context);
    context.report.createPipeline = {
      ...result,
      sharedContext: {
        vision: context.shared.vision || null,
        selfVerify: context.shared.selfVerify || null,
        geo: context.shared.geo || null,
        localContext: context.shared.localContext || null,
        risk: context.shared.risk || null,
        route: context.shared.route || null,
      },
    };
    return context;
  }

  function nextPendingSlaStage(issue: any, nowMs: number, overrideThresholdHours?: number): { stage: SlaStage; dueAt: string; policy: any; deadlines: any } | null {
    const policy = resolveSlaPolicy(issue);
    const deadlines = buildSlaSchedule(issue, policy, overrideThresholdHours);
    const ladder = issue?.slaLadder || {};
    const escalation = issue?.escalation || {};
    const checks: Array<{ stage: SlaStage; dueAt: string; done: boolean }> = [
      { stage: "reminder", dueAt: deadlines.reminderDueAt, done: !!ladder.reminderAt },
      { stage: "escalation", dueAt: deadlines.escalationDueAt, done: !!ladder.escalatedAt || !!escalation.autoDraftedAt },
      { stage: "rti", dueAt: deadlines.rtiDueAt, done: !!ladder.rtiDraftedAt || !!escalation.rtiPdfGeneratedAt },
      { stage: "first_appeal", dueAt: deadlines.firstAppealDueAt, done: !!ladder.firstAppealDraftedAt || !!escalation.firstAppealDraftedAt },
    ];
    for (const check of checks) {
      if (check.done) continue;
      const dueMs = Date.parse(check.dueAt);
      if (!Number.isFinite(dueMs) || nowMs >= dueMs) {
        return { stage: check.stage, dueAt: check.dueAt, policy, deadlines };
      }
      return null;
    }
    return null;
  }

  function pdfEscape(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r/g, "");
  }

  function wrapPdfLine(line: string, maxLength = 88): string[] {
    const words = line.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (`${current} ${word}`.length <= maxLength) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function buildRtiPdfArtifact(issue: any, rtiRequest: string, generatedAt: string) {
    const ticket = cleanText(issue?.ticketId || issue?.id, "civiclens-ticket", 80).replace(/[^a-zA-Z0-9_-]+/g, "-");
    const headerLines = [
      "CivicLens RTI Application Draft",
      `Ticket: ${issue?.ticketId || issue?.id || "N/A"}`,
      `Generated: ${generatedAt.slice(0, 10)}`,
      `Location: ${cleanText(issue?.locationName, "Unspecified location", 160)}`,
      "",
      "Draft status: for human review only; not submitted by CivicLens.",
      "",
    ];
    const bodyLines = cleanText(rtiRequest, "No RTI request text was available.", 5000)
      .split("\n")
      .flatMap((line) => wrapPdfLine(line));
    const lines = [...headerLines, ...bodyLines].slice(0, 58);
    if (bodyLines.length > 58 - headerLines.length) {
      lines.push("...");
      lines.push("Draft truncated for one-page PDF preview; use the text draft for the full copy.");
    }

    const textStream = [
      "BT",
      "/F1 10 Tf",
      "50 790 Td",
      "13 TL",
      ...lines.map((line) => `(${pdfEscape(line)}) Tj T*`),
      "ET",
    ].join("\n");

    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
      `4 0 obj\n<< /Length ${Buffer.byteLength(textStream, "utf8")} >>\nstream\n${textStream}\nendstream\nendobj\n`,
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += object;
    }
    const xrefAt = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (const offset of offsets.slice(1)) {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
    const base64 = Buffer.from(pdf, "utf8").toString("base64");
    return {
      dataUri: `data:application/pdf;base64,${base64}`,
      filename: `CivicLens-${ticket}-RTI-draft.pdf`,
      byteLength: Buffer.byteLength(pdf, "utf8"),
    };
  }

  function buildFirstAppealDraft(issue: any, generatedAt: string): string {
    const ticketId = issue?.ticketId || issue?.id || "N/A";
    const location = issue?.locationName || "the reported location";
    return `To the First Appellate Authority,\n\nSubject: Draft first appeal for delayed RTI response related to CivicLens ticket ${ticketId}\n\nThis is a draft first appeal for human review. The underlying civic complaint concerns ${issue?.category || "a civic issue"} at ${location}. The draft asks the appellate authority to review delay or non-response to the related RTI application and to direct the Public Information Officer to provide status, responsible officer details, file notes, and expected action timelines.\n\nGenerated on ${generatedAt.slice(0, 10)} by CivicLens for manual review only. Nothing has been filed or submitted outside the app.`;
  }

  function makeTicketId(): string {
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `CL-${datePart}-${randomPart}`;
  }

  function publicIssueFromDoc(id: string, data: any) {
    const { embedding, ...publicData } = data || {};
    return { id, ...publicData };
  }

  type EventActorType = "citizen" | "operator" | "ai" | "worker" | "system";
  type EventSource = "api" | "agent" | "worker" | "gemini" | "system";
  type EventStatus = "attempted" | "succeeded" | "failed";
  type EventSeverity = "debug" | "info" | "warn" | "error";
  type ServerActivity = {
    actorType: "operator" | "citizen" | "ai";
    eventType: string;
    message: string;
    timestamp: string;
    byUid?: string;
    byRole?: string;
  };
  type CivicEventInput = {
    issueId?: string;
    issueRef?: any;
    actorType: EventActorType;
    eventType: string;
    message: string;
    timestamp?: string;
    actor?: Partial<RequestActor> | null;
    byUid?: string;
    byRole?: string;
    source: EventSource;
    payload?: Record<string, unknown>;
    requestId?: string;
    severity?: EventSeverity;
    status?: EventStatus;
    idempotencyKey?: string;
  };

  function sanitizeEventPayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
    try {
      const serialized = JSON.stringify(payload);
      if (serialized.length > 6000) {
        return {
          truncated: true,
          jsonPreview: serialized.slice(0, 6000),
        };
      }
      return JSON.parse(serialized);
    } catch {
      return { note: cleanText(String(payload), "unserializable payload", 500) };
    }
  }

  function buildEventDocument(eventId: string, input: CivicEventInput) {
    const actorUid = cleanText(input.byUid || input.actor?.uid, "", 128) || null;
    const actorRole = cleanText(input.byRole || input.actor?.role, "", 64) || null;
    const issueId = cleanText(input.issueId || input.issueRef?.id, "", 160) || null;
    const eventType = cleanText(input.eventType, "event", 120) || "event";
    const severity = input.severity || "info";
    const status = input.status || "succeeded";
    const timestamp = input.timestamp || new Date().toISOString();
    return {
      id: eventId,
      eventType,
      actorType: input.actorType,
      source: input.source,
      status,
      severity,
      message: cleanText(input.message, "CivicLens event recorded.", 1600),
      timestamp,
      createdAt: new Date().toISOString(),
      issueId,
      actor: {
        uid: actorUid,
        role: actorRole,
        isDemoOperator: input.actor?.isDemoOperator === true,
        isRealOperator: input.actor?.isRealOperator === true,
      },
      requestId: cleanText(input.requestId, "", 160) || null,
      idempotencyKey: cleanText(input.idempotencyKey, "", 160) || null,
      payload: sanitizeEventPayload(input.payload),
    };
  }

  async function recordEvent(input: CivicEventInput) {
    if (!adminDb) {
      structuredLog("warn", "civic_event_skipped", {
        eventType: input.eventType,
        reason: "adminDb unavailable",
      });
      return null;
    }
    try {
      const eventRef = adminDb.collection("events").doc();
      const eventDoc = buildEventDocument(eventRef.id, input);
      const batch = adminDb.batch();
      batch.set(eventRef, eventDoc);
      const issueRef = input.issueRef || (eventDoc.issueId ? adminDb.collection("issues").doc(eventDoc.issueId) : null);
      if (issueRef) {
        batch.set(issueRef.collection("events").doc(eventRef.id), eventDoc);
      }
      await batch.commit();
      structuredLog(eventDoc.severity === "error" ? "error" : eventDoc.severity === "warn" ? "warn" : "info", "civic_event_recorded", {
        eventId: eventDoc.id,
        eventType: eventDoc.eventType,
        issueId: eventDoc.issueId,
        actorType: eventDoc.actorType,
        source: eventDoc.source,
        status: eventDoc.status,
      });
      return eventDoc;
    } catch (error: any) {
      structuredLog("error", "civic_event_failed", {
        eventType: input.eventType,
        issueId: input.issueId || input.issueRef?.id || null,
        error: error?.message || String(error),
      });
      return null;
    }
  }

  type AgentStreamSubscriber = (event: Record<string, unknown>) => void;
  const agentStreamSubscribers = new Map<string, Set<AgentStreamSubscriber>>();

  function publishAgentStreamEvent(issueId: string, event: Record<string, unknown>) {
    const subscribers = agentStreamSubscribers.get(issueId);
    if (!subscribers || subscribers.size === 0) return;
    const payload = {
      issueId,
      ts: new Date().toISOString(),
      ...event,
    };
    for (const send of subscribers) {
      try {
        send(payload);
      } catch {
        // Dead clients are cleaned up by the request close handler.
      }
    }
  }

  function sendSseEvent(res: any, event: Record<string, unknown>) {
    const type = cleanText(event.type, "message", 80) || "message";
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  app.get("/api/issues/:issueId/agent-events/stream", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid agent stream request.");

    try {
      const issueSnap = await adminDb.collection("issues").doc(issueId).get();
      if (!issueSnap.exists) return sendApiError(res, 404, "Issue not found.");
      if (!requireOperatorForIssue(issueSnap.data(), actor, res)) return;

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const send: AgentStreamSubscriber = (event) => sendSseEvent(res, event);
      const subscribers = agentStreamSubscribers.get(issueId) || new Set<AgentStreamSubscriber>();
      subscribers.add(send);
      agentStreamSubscribers.set(issueId, subscribers);

      send({
        type: "agent_stream_ready",
        message: "Connected to live server agent stream.",
        issueId,
        actorRole: actor.role,
        ts: new Date().toISOString(),
      });

      const heartbeat = setInterval(() => {
        send({ type: "agent_heartbeat", issueId, ts: new Date().toISOString() });
      }, 15_000);

      req.on("close", () => {
        clearInterval(heartbeat);
        subscribers.delete(send);
        if (subscribers.size === 0) agentStreamSubscribers.delete(issueId);
      });
    } catch (error) {
      return sendApiError(res, 500, "Failed to open agent event stream.", error);
    }
  });

  async function addServerActivity(issueRef: any, activity: ServerActivity) {
    const activityRef = issueRef.collection("activity").doc();
    if (!adminDb) {
      await activityRef.set(activity);
      return;
    }
    const source: EventSource = activity.byRole === "system" ? "worker" : activity.actorType === "ai" ? "agent" : "api";
    const eventRef = adminDb.collection("events").doc();
    const eventDoc = buildEventDocument(eventRef.id, {
      issueRef,
      actorType: activity.actorType,
      eventType: activity.eventType,
      message: activity.message,
      timestamp: activity.timestamp,
      byUid: activity.byUid,
      byRole: activity.byRole,
      source,
      status: "succeeded",
      payload: { activityId: activityRef.id },
    });
    const batch = adminDb.batch();
    batch.set(activityRef, activity);
    batch.set(eventRef, eventDoc);
    batch.set(issueRef.collection("events").doc(eventRef.id), eventDoc);
    await batch.commit();
    structuredLog(eventDoc.severity === "error" ? "error" : eventDoc.severity === "warn" ? "warn" : "info", "civic_event_recorded", {
      eventId: eventDoc.id,
      eventType: eventDoc.eventType,
      issueId: eventDoc.issueId,
      actorType: eventDoc.actorType,
      source: eventDoc.source,
      status: eventDoc.status,
    });
  }

  // ---- Phase 4: Gamification (civic reputation) -------------------------
  // Server-authoritative point award + badge/level recompute for a contributor.
  // Best-effort: failures here never block the underlying civic action.
  function roundTrust(value: number): number {
    return Math.round(cleanNumber(value, 0, 0, 1) * 100) / 100;
  }

  function computeTrustScore(profile: any, role?: string): number {
    const points = cleanNumber(profile?.points, 0, 0, 100_000);
    const reportCount = cleanNumber(profile?.reportCount, 0, 0, 10_000);
    const supportCount = cleanNumber(profile?.supportCount, 0, 0, 10_000);
    const verifyCount = cleanNumber(profile?.verifyCount, 0, 0, 10_000);
    const successfulAppeals = cleanNumber(profile?.successfulAppeals, 0, 0, 1_000);
    const trustPenalties = cleanNumber(profile?.trustPenalties, 0, 0, 1_000);
    const roleBoost = role === "operator" || profile?.role === "operator" ? 0.04 : 0;
    const score =
      0.32 +
      Math.min(reportCount * 0.035, 0.16) +
      Math.min(supportCount * 0.012, 0.10) +
      Math.min(verifyCount * 0.045, 0.24) +
      Math.min(points / 450, 0.18) +
      Math.min(successfulAppeals * 0.03, 0.09) +
      roleBoost -
      Math.min(trustPenalties * 0.05, 0.30);
    return roundTrust(Math.max(0.08, Math.min(0.98, score)));
  }

  function summarizeIssueForTrustAudit(issueData: any) {
    return {
      title: cleanText(issueData?.title, "Untitled civic issue", 140),
      category: cleanText(issueData?.category, "other", 60),
      status: normalizeIssueStatus(issueData?.status),
      summary: cleanText(issueData?.summary || issueData?.description, "", 600),
      severity: cleanNumber(issueData?.severity, 3, 1, 5),
      urgency: cleanText(issueData?.urgency, "routine", 30),
      confirmCount: cleanNumber(issueData?.confirmCount, 0, 0, 100_000),
      disputeCount: cleanNumber(issueData?.disputeCount, 0, 0, 100_000),
      trustConsensus: issueData?.trustConsensus || null,
    };
  }

  async function auditTrustWeightedVerification(input: {
    issueData: any;
    voteType: "confirm" | "dispute";
    trustScore: number;
    profile: any;
    actor?: RequestActor;
    reason?: string;
  }) {
    const fallback = {
      voteQuality: input.trustScore < 0.22 ? "weak" : "valid",
      weightMultiplier: input.trustScore < 0.22 ? 0.65 : 0.9,
      confidence: 0.58,
      signals: input.trustScore < 0.22 ? ["Low-history voter; deterministic audit weight reduced."] : ["Deterministic audit accepted the community signal."],
      explanation: "Deterministic trust audit used because Gemini audit was unavailable.",
      model: "deterministic-fallback",
      aiFallback: true,
      retried: false,
      durationMs: 0,
    };

    if (!geminiApiKey) return fallback;

    const promptText = `Audit this community verification signal for a public civic issue.
Return strict JSON only.
Issue snapshot: ${JSON.stringify(summarizeIssueForTrustAudit(input.issueData))}
Vote type: ${input.voteType}
Voter trust score: ${input.trustScore}
Voter counters: ${JSON.stringify({
  reportCount: cleanNumber(input.profile?.reportCount, 0, 0, 10_000),
  supportCount: cleanNumber(input.profile?.supportCount, 0, 0, 10_000),
  verifyCount: cleanNumber(input.profile?.verifyCount, 0, 0, 10_000),
  points: cleanNumber(input.profile?.points, 0, 0, 100_000),
})}
Optional voter note: ${cleanText(input.reason, "none", 500)}
Mark suspicious only for obvious mismatch, pile-on, or unverifiable reasoning. Keep weightMultiplier between 0 and 1.15.`;

    const startTime = Date.now();
    try {
      const result = await generateContentWithRetry(ai, {
        model: geminiModels.cheapClassification,
        contents: [{ text: promptText }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              voteQuality: { type: Type.STRING, enum: ["valid", "weak", "suspicious"] },
              weightMultiplier: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER },
              signals: { type: Type.ARRAY, items: { type: Type.STRING } },
              explanation: { type: Type.STRING },
            },
            required: ["voteQuality", "weightMultiplier", "confidence", "signals", "explanation"],
          },
        },
      }, { signal: AbortSignal.timeout(12_000) });
      const responseText = (result.response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(responseText);
      const quality = ["valid", "weak", "suspicious"].includes(parsed.voteQuality) ? parsed.voteQuality : "weak";
      return {
        voteQuality: quality,
        weightMultiplier: cleanNumber(parsed.weightMultiplier, quality === "suspicious" ? 0.25 : 0.9, 0, 1.15),
        confidence: cleanNumber(parsed.confidence, 0.6, 0, 1),
        signals: cleanStringArray(parsed.signals, 6, 180),
        explanation: cleanText(parsed.explanation, "Gemini trust audit completed.", 900),
        model: geminiModels.cheapClassification,
        aiFallback: false,
        retried: result.retried,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      structuredLog("warn", "trust_audit_fallback", { error: error?.message || String(error) });
      return { ...fallback, durationMs: Date.now() - startTime };
    }
  }

  function computeBrigadingGuard(input: {
    voteType: "confirm" | "dispute";
    trustScore: number;
    audit: any;
    recentVotes: any[];
    nowMs: number;
  }) {
    const fifteenMinutesMs = 15 * 60 * 1000;
    const recentSame = input.recentVotes.filter((vote) => {
      const ts = Date.parse(String(vote.timestamp || ""));
      return vote.type === input.voteType && Number.isFinite(ts) && input.nowMs - ts <= fifteenMinutesMs;
    });
    const lowTrustSame = recentSame.filter((vote) => cleanNumber(vote.baseTrustScore ?? vote.trustScore, 0.3, 0, 1) < 0.35);
    const suspiciousAudit = input.audit.voteQuality === "suspicious" || input.audit.weightMultiplier <= 0.25;
    const burst = recentSame.length >= 3 && (lowTrustSame.length >= 2 || input.trustScore < 0.28);
    const collapsed = suspiciousAudit || burst;
    const risk = collapsed ? "high" : recentSame.length >= 2 || input.trustScore < 0.3 ? "watch" : "low";
    const signals = [
      ...(burst ? [`${recentSame.length + 1} rapid ${input.voteType} votes detected in a 15 minute window.`] : []),
      ...(lowTrustSame.length >= 2 ? [`${lowTrustSame.length + 1} low-trust ${input.voteType} signals clustered together.`] : []),
      ...(suspiciousAudit ? ["Gemini audit marked this vote suspicious or very weak."] : []),
    ];
    return { collapsed, risk, signals };
  }

  function buildTrustConsensusUpdate(currentConsensus: any, voteType: "confirm" | "dispute", finalWeight: number, guard: any, nowIso: string) {
    const previous = currentConsensus && typeof currentConsensus === "object" ? currentConsensus : {};
    const confirmWeight = cleanNumber(previous.confirmWeight, 0, 0, 100_000) + (voteType === "confirm" ? finalWeight : 0);
    const disputeWeight = cleanNumber(previous.disputeWeight, 0, 0, 100_000) + (voteType === "dispute" ? finalWeight : 0);
    const confirmVotes = cleanNumber(previous.confirmVotes, 0, 0, 100_000) + (voteType === "confirm" ? 1 : 0);
    const disputeVotes = cleanNumber(previous.disputeVotes, 0, 0, 100_000) + (voteType === "dispute" ? 1 : 0);
    const collapsedVotes = cleanNumber(previous.collapsedVotes, 0, 0, 100_000) + (guard.collapsed ? 1 : 0);
    const totalWeight = confirmWeight + disputeWeight;
    const consensusRatio = totalWeight > 0 ? confirmWeight / totalWeight : 0;
    const autoResolveThreshold = cleanNumber(previous.autoResolveThreshold, 2.4, 1, 20);
    const brigadingRisk = guard.risk === "high" ? "high" : previous.brigadingRisk === "high" ? "watch" : guard.risk;
    return {
      ...previous,
      confirmWeight: Math.round(confirmWeight * 100) / 100,
      disputeWeight: Math.round(disputeWeight * 100) / 100,
      totalWeight: Math.round(totalWeight * 100) / 100,
      confirmVotes,
      disputeVotes,
      collapsedVotes,
      consensusRatio: Math.round(consensusRatio * 100) / 100,
      brigadingRisk,
      autoResolveThreshold,
      appealable: true,
      publicExplanation: guard.collapsed
        ? "A cluster of low-trust or suspicious votes was detected, so the newest signal received reduced weight."
        : "Community confirmations are weighted by contributor trust and a Gemini audit before affecting case status.",
      lastVoteAt: nowIso,
      updatedAt: nowIso,
      version: "trust-consensus-v1",
    };
  }

  async function awardPoints(uid: string | undefined, role: string | undefined, delta: number, counterField?: "reportCount" | "supportCount" | "verifyCount") {
    if (!adminDb || !uid) return;
    try {
      const ref = adminDb.collection("profiles").doc(uid);
      await adminDb.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        const cur: any = snap.exists ? snap.data() : {};
        const counters: Record<string, number> = {
          reportCount: cur.reportCount || 0,
          supportCount: cur.supportCount || 0,
          verifyCount: cur.verifyCount || 0,
        };
        if (counterField) counters[counterField] = (counters[counterField] || 0) + 1;
        const points = Math.max(0, (cur.points || 0) + delta);
        const level = Math.floor(points / 50) + 1;
        const badges: string[] = [];
        if (counters.reportCount >= 1) badges.push("First Report");
        if (counters.reportCount >= 5) badges.push("Active Reporter");
        if (counters.verifyCount >= 3) badges.push("Community Verifier");
        if (counters.supportCount >= 5) badges.push("Neighborhood Ally");
        if (points >= 100) badges.push("Civic Champion");
        const trustScore = computeTrustScore({ ...cur, ...counters, points }, role || cur.role);
        tx.set(ref, {
          uid,
          points,
          level,
          badges,
          ...counters,
          trustScore,
          trustUpdatedAt: new Date().toISOString(),
          role: role || cur.role || "citizen",
          handle: cur.handle || `Hero-${String(uid).slice(0, 4).toUpperCase()}`,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      });
    } catch (err: any) {
      console.warn("awardPoints failed (non-blocking):", err?.message || err);
    }
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
      let previousStatus: IssueStatusKey | null = null;
      await adminDb.runTransaction(async (tx: any) => {
        const txSnap = await tx.get(ref);
        if (!txSnap.exists) throw new Error("NOT_FOUND");
        const issueData = txSnap.data() || {};
        if (!(actor?.isRealOperator || (actor?.isDemoOperator && issueData?.isDemoData === true))) {
          throw new Error("FORBIDDEN_OPERATOR");
        }

        const current = normalizeIssueStatus(issueData.status);
        previousStatus = current;
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

      await recordEvent({
        issueRef: ref,
        actorType: "operator",
        eventType: "status_changed",
        message: `Status advanced to ${issueStatusLabel(newStatus)} by server-authorized operator. Rationale: ${rationale}`,
        timestamp: nowIso,
        actor,
        source: "api",
        payload: { fromStatus: previousStatus, toStatus: newStatus, resolvedAt: responsePayload?.resolvedAt || null },
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
    const pipelineContext = await runReportCreatePipeline({
      issueId: issueRef.id,
      actor,
      report,
      nowIso,
      steps: [],
      shared: {},
    });

    const queryEmbedding = await embedText(issueEmbeddingText(report));
    if (queryEmbedding) {
      (report as any).embedding = queryEmbedding;
    }
    const reportGeohash7 = cleanText((report as any).geohash7, "", 16) || geoHash7(report.lat, report.lng);
    if (reportGeohash7) {
      (report as any).geohash7 = reportGeohash7;
    }

    try {
      const mergeCandidate = queryEmbedding ? await findAutoMergeCandidate(report, queryEmbedding, issueRef.id) : null;
      const createResultRef = adminDb.collection("issueCreateResults").doc(idempotencyKey);
      const outcome = await adminDb.runTransaction(async (tx: any) => {
        const markerSnap = await tx.get(createResultRef);
        if (markerSnap.exists) {
          const marker = markerSnap.data() || {};
          const canonicalIssueId = cleanText(marker.canonicalIssueId, "", 128);
          if (!isSafeDocumentId(canonicalIssueId)) throw new Error("CREATE_MARKER_INVALID");
          const canonicalRef = adminDb.collection("issues").doc(canonicalIssueId);
          const canonicalSnap = await tx.get(canonicalRef);
          if (!canonicalSnap.exists) throw new Error("CREATE_MARKER_TARGET_MISSING");
          return {
            canonicalIssueId,
            data: canonicalSnap.data(),
            autoMerged: marker.status === "auto_merged",
            duplicateSimilarity: typeof marker.duplicateSimilarity === "number" ? marker.duplicateSimilarity : null,
            duplicateDistanceM: typeof marker.duplicateDistanceM === "number" ? marker.duplicateDistanceM : null,
            contributionCreated: false,
            createdNew: false,
          };
        }

        const existing = await tx.get(issueRef);
        if (existing.exists) {
          const existingData = existing.data();
          if (existingData.userId !== actor.uid) {
            throw new Error("IDEMPOTENCY_CONFLICT");
          }
          tx.set(createResultRef, {
            status: "created",
            canonicalIssueId: issueRef.id,
            requestedIssueId: issueRef.id,
            createdAt: nowIso,
            byUid: actor.uid,
          });
          return {
            canonicalIssueId: issueRef.id,
            data: existingData,
            autoMerged: false,
            duplicateSimilarity: null,
            duplicateDistanceM: null,
            contributionCreated: false,
            createdNew: false,
          };
        }

        let candidateRef: any = null;
        let evidenceRef: any = null;
        let candidateSnap: any = null;
        let evidenceSnap: any = null;
        if (mergeCandidate?.id && isSafeDocumentId(mergeCandidate.id)) {
          candidateRef = adminDb.collection("issues").doc(mergeCandidate.id);
          evidenceRef = candidateRef.collection("evidence").doc(idempotencyKey);
          candidateSnap = await tx.get(candidateRef);
          evidenceSnap = await tx.get(evidenceRef);
        }

        if (candidateRef && candidateSnap?.exists) {
          const candidateData = candidateSnap.data() || {};
          const evidenceCreated = !evidenceSnap?.exists;
          const nextReportCount = evidenceCreated ? cleanNumber(candidateData.reportCount, 1, 1, 999) + 1 : cleanNumber(candidateData.reportCount, 1, 1, 999);
          const nextPriorityScore = serverPriorityScore({ ...candidateData, reportCount: nextReportCount });
          const updatedCandidate = {
            ...candidateData,
            reportCount: nextReportCount,
            priorityScore: nextPriorityScore,
            updatedAt: nowIso,
            geohash7: cleanText(candidateData.geohash7, "", 16) || mergeCandidate.geohash7,
            dedup: {
              ...(candidateData.dedup || {}),
              lastAutoMergedAt: nowIso,
              lastAutoMergedBy: actor.uid,
              lastSimilarity: mergeCandidate.similarity,
              lastDistanceM: mergeCandidate.distanceM,
              method: mergeCandidate.sameEvidenceImage ? "geohash7_embedding_cosine_or_same_image" : "geohash7_embedding_cosine",
              sameEvidenceImage: !!mergeCandidate.sameEvidenceImage,
            },
          };
          if (evidenceCreated) {
            tx.set(evidenceRef, {
              imageUrl: imageValue,
              description: report.description || report.summary || "Co-supporting evidence auto-merged by server.",
              lat: report.lat,
              lng: report.lng,
              severity: report.severity,
              submittedBy: actor.uid,
              timestamp: nowIso,
              source: "auto_merge_on_create",
              requestedIssueId: issueRef.id,
              duplicateSimilarity: mergeCandidate.similarity,
              duplicateDistanceM: mergeCandidate.distanceM,
              sameEvidenceImage: !!mergeCandidate.sameEvidenceImage,
              category: report.category,
              title: report.title,
              summary: report.summary,
              createPipeline: (report as any).createPipeline,
            });
            tx.update(candidateRef, {
              reportCount: nextReportCount,
              priorityScore: nextPriorityScore,
              updatedAt: nowIso,
              geohash7: updatedCandidate.geohash7,
              dedup: updatedCandidate.dedup,
            });
            tx.set(candidateRef.collection("activity").doc(), {
              actorType: "citizen",
              eventType: "auto_merged_on_create",
              message: `Server auto-merged a near-identical report (${Math.round(mergeCandidate.distanceM)}m, cosine ${mergeCandidate.similarity}).`,
              timestamp: nowIso,
              byUid: actor.uid,
              byRole: actor.role,
            });
          }
          tx.set(createResultRef, {
            status: "auto_merged",
            canonicalIssueId: candidateRef.id,
            requestedIssueId: issueRef.id,
            createdAt: nowIso,
            byUid: actor.uid,
            duplicateSimilarity: mergeCandidate.similarity,
            duplicateDistanceM: mergeCandidate.distanceM,
            evidenceId: idempotencyKey,
            sameEvidenceImage: !!mergeCandidate.sameEvidenceImage,
            pipelineStageCount: pipelineContext.report.createPipeline?.steps?.length || 0,
          });
          return {
            canonicalIssueId: candidateRef.id,
            data: updatedCandidate,
            autoMerged: true,
            duplicateSimilarity: mergeCandidate.similarity,
            duplicateDistanceM: mergeCandidate.distanceM,
            contributionCreated: evidenceCreated,
            createdNew: false,
          };
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
        tx.set(createResultRef, {
          status: "created",
          canonicalIssueId: issueRef.id,
          requestedIssueId: issueRef.id,
          createdAt: nowIso,
          byUid: actor.uid,
          embeddingAvailable: !!queryEmbedding,
          geohash7: reportGeohash7,
          pipelineStageCount: pipelineContext.report.createPipeline?.steps?.length || 0,
        });
        return {
          canonicalIssueId: issueRef.id,
          data: report,
          autoMerged: false,
          duplicateSimilarity: null,
          duplicateDistanceM: null,
          contributionCreated: true,
          createdNew: true,
        };
      });

      if (outcome.contributionCreated) await awardPoints(actor.uid, actor.role, 10, "reportCount");
      if (outcome.createdNew) {
        await recordEvent({
          issueRef,
          actorType: "citizen",
          eventType: "created",
          message: "Prototype report saved by server.",
          timestamp: nowIso,
          actor,
          source: "api",
          idempotencyKey,
          payload: {
            ticketId: outcome.data?.ticketId || null,
            category: outcome.data?.category || null,
            priorityScore: outcome.data?.priorityScore || null,
            embeddingAvailable: !!queryEmbedding,
            geohash7: reportGeohash7,
            pipelineStageCount: pipelineContext.report.createPipeline?.steps?.length || 0,
          },
        });
      } else if (outcome.autoMerged && outcome.contributionCreated) {
        const canonicalRef = adminDb.collection("issues").doc(outcome.canonicalIssueId);
        await recordEvent({
          issueRef: canonicalRef,
          actorType: "citizen",
          eventType: "auto_merged_on_create",
          message: "Server auto-merged a near-identical report into this canonical case.",
          timestamp: nowIso,
          actor,
          source: "api",
          idempotencyKey,
          payload: {
            requestedIssueId: issueRef.id,
            canonicalIssueId: outcome.canonicalIssueId,
            duplicateSimilarity: outcome.duplicateSimilarity,
            duplicateDistanceM: outcome.duplicateDistanceM,
            reportCount: outcome.data?.reportCount || null,
            pipelineStageCount: pipelineContext.report.createPipeline?.steps?.length || 0,
          },
        });
      }
      if (outcome.contributionCreated || outcome.createdNew) {
        await recordEvent({
          issueRef: adminDb.collection("issues").doc(outcome.canonicalIssueId),
          actorType: "ai",
          eventType: "report_create_pipeline_completed",
          message: "Report-create BaseAgent pipeline completed.",
          timestamp: nowIso,
          actor,
          source: "agent",
          idempotencyKey,
          payload: {
            canonicalIssueId: outcome.canonicalIssueId,
            requestedIssueId: issueRef.id,
            autoMerged: outcome.autoMerged,
            stageCount: pipelineContext.report.createPipeline?.steps?.length || 0,
            durationMs: pipelineContext.report.createPipeline?.durationMs || null,
            stages: (pipelineContext.report.createPipeline?.steps || []).map((step: any) => ({
              stage: step.stage,
              status: step.status,
              durationMs: step.durationMs,
              attempt: step.attempt,
            })),
          },
        });
      }
      return res.json({
        success: true,
        data: publicIssueFromDoc(outcome.canonicalIssueId, outcome.data),
        autoMerged: outcome.autoMerged,
        canonicalIssueId: outcome.canonicalIssueId,
        duplicateSimilarity: outcome.duplicateSimilarity,
        duplicateDistanceM: outcome.duplicateDistanceM,
      });
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

    let evidenceCreated = false;
    try {
      await adminDb.runTransaction(async (tx: any) => {
        const issueSnap = await tx.get(issueRef);
        if (!issueSnap.exists) throw new Error("NOT_FOUND");
        const existingEvidence = await tx.get(evidenceRef);
        if (existingEvidence.exists) return;
        evidenceCreated = true;

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

      if (evidenceCreated) {
        await recordEvent({
          issueRef,
          actorType: "citizen",
          eventType: "evidence_submitted",
          message: "Supporting evidence linked by server.",
          timestamp: nowIso,
          actor,
          source: "api",
          idempotencyKey: evidenceId,
          payload: { evidenceId },
        });
      }
      return res.json({ success: true, evidenceId });
    } catch (error: any) {
      if (error?.message === "NOT_FOUND") return sendApiError(res, 404, "Issue not found.");
      return sendApiError(res, 500, "Failed to attach evidence.", error);
    }
  });

  app.post("/api/issues/:issueId/merge-proposals/:proposalId/approve", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor) return sendApiError(res, 401, "Firebase ID token is required.");
    const { issueId, proposalId } = req.params;
    if (!isSafeDocumentId(issueId) || !isSafeDocumentId(proposalId)) return sendApiError(res, 400, "Invalid merge approval request.");
    const sourceRef = adminDb.collection("issues").doc(issueId);
    const sourceAuthSnap = await sourceRef.get();
    if (!sourceAuthSnap.exists) return sendApiError(res, 404, "Issue not found.");
    if (!requireOperatorForIssue(sourceAuthSnap.data(), actor, res)) return;

    const proposalRef = sourceRef.collection("mergeProposals").doc(proposalId);
    const nowIso = new Date().toISOString();
    let targetIssueId = "";
    try {
      await adminDb.runTransaction(async (tx: any) => {
        const proposalSnap = await tx.get(proposalRef);
        if (!proposalSnap.exists) throw new Error("PROPOSAL_NOT_FOUND");
        const proposal = proposalSnap.data() || {};
        if (proposal.sourceIssueId !== issueId || !isSafeDocumentId(proposal.targetIssueId)) throw new Error("INVALID_PROPOSAL");
        if (proposal.status === "approved") {
          targetIssueId = proposal.targetIssueId;
          return;
        }
        const targetRef = adminDb.collection("issues").doc(proposal.targetIssueId);
        const targetSnap = await tx.get(targetRef);
        if (!targetSnap.exists) throw new Error("TARGET_NOT_FOUND");
        const targetData = targetSnap.data() || {};
        targetIssueId = targetSnap.id;
        const nextReportCount = cleanNumber(targetData.reportCount, 1, 1, 999) + 1;
        const mergeEvidenceId = `agent_merge_${proposalId}`.slice(0, 140);
        tx.set(targetRef.collection("evidence").doc(mergeEvidenceId), {
          sourceIssueId: issueId,
          mergeProposalId: proposalId,
          description: cleanText(proposal.reason, "Agent merge proposal approved by operator.", 1200),
          similarity: cleanNumber(proposal.similarity, 0, 0, 1),
          imageUrl: cleanText(sourceAuthSnap.get("image"), "", 1200),
          source: "agent_merge_proposal",
          approvedBy: actor.uid,
          approvedAt: nowIso,
        }, { merge: true });
        tx.update(targetRef, {
          reportCount: nextReportCount,
          priorityScore: serverPriorityScore({ ...targetData, reportCount: nextReportCount }),
          updatedAt: nowIso,
        });
        tx.update(sourceRef, {
          status: "resolved",
          mergeStatus: "merged",
          mergedInto: targetIssueId,
          mergeApprovedAt: nowIso,
          updatedAt: nowIso,
        });
        tx.set(proposalRef, {
          status: "approved",
          approvedAt: nowIso,
          approvedBy: actor.uid,
          executedAt: nowIso,
          targetIssueId,
        }, { merge: true });
      });

      await recordEvent({
        issueRef: sourceRef,
        actorType: "operator",
        eventType: "merge_proposal_approved",
        message: "Operator approved and executed an agent merge proposal.",
        actor,
        source: "api",
        status: "succeeded",
        idempotencyKey: proposalId,
        payload: { proposalId, sourceIssueId: issueId, targetIssueId },
      });
      if (targetIssueId) {
        await recordEvent({
          issueRef: adminDb.collection("issues").doc(targetIssueId),
          actorType: "operator",
          eventType: "merge_proposal_approved",
          message: "Agent merge proposal added supporting evidence to this canonical case.",
          actor,
          source: "api",
          status: "succeeded",
          idempotencyKey: proposalId,
          payload: { proposalId, sourceIssueId: issueId, targetIssueId },
        });
      }
      return res.json({ success: true, proposalId, sourceIssueId: issueId, targetIssueId, status: "approved" });
    } catch (error: any) {
      if (error?.message === "PROPOSAL_NOT_FOUND") return sendApiError(res, 404, "Merge proposal not found.");
      if (error?.message === "TARGET_NOT_FOUND") return sendApiError(res, 404, "Merge target not found.");
      if (error?.message === "INVALID_PROPOSAL") return sendApiError(res, 400, "Merge proposal is invalid.");
      return sendApiError(res, 500, "Failed to approve merge proposal.", error);
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
      await awardPoints(actor.uid, actor.role, 2, "supportCount");
      await addServerActivity(issueRef, {
        actorType: "citizen",
        eventType: "support_recorded",
        message: "Community support vote recorded by server.",
        timestamp: nowIso,
        byUid: actor.uid,
        byRole: actor.role,
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
    const reason = cleanText(req.body?.reason || req.body?.rationale, "", 700);
    if (!isSafeDocumentId(issueId) || !["confirm", "dispute"].includes(type)) {
      return sendApiError(res, 400, "Invalid verification request.");
    }
    const issueRef = adminDb.collection("issues").doc(issueId);
    const verificationRef = issueRef.collection("verifications").doc(actor.uid);
    const profileRef = adminDb.collection("profiles").doc(actor.uid);
    const nowIso = new Date().toISOString();

    try {
      const [issueSnapForAudit, existingVoteForAudit, profileSnapForAudit] = await Promise.all([
        issueRef.get(),
        verificationRef.get(),
        profileRef.get(),
      ]);
      if (!issueSnapForAudit.exists) return sendApiError(res, 404, "Issue not found.");
      if (existingVoteForAudit.exists) return sendApiError(res, 409, "You have already verified or disputed this issue.");

      const issueDataForAudit = issueSnapForAudit.data() || {};
      const profileForAudit = profileSnapForAudit.exists ? profileSnapForAudit.data() || {} : {};
      const trustScore = computeTrustScore(profileForAudit, actor.role);
      const trustAudit = await auditTrustWeightedVerification({
        issueData: issueDataForAudit,
        voteType: type,
        trustScore,
        profile: profileForAudit,
        actor,
        reason,
      });
      let responsePayload: any = null;

      await adminDb.runTransaction(async (tx: any) => {
        const issueSnap = await tx.get(issueRef);
        if (!issueSnap.exists) throw new Error("NOT_FOUND");
        const existingVote = await tx.get(verificationRef);
        if (existingVote.exists) throw new Error("ALREADY_VERIFIED");
        const profileSnap = await tx.get(profileRef);
        const profile = profileSnap.exists ? profileSnap.data() || {} : profileForAudit;
        const freshTrustScore = computeTrustScore(profile, actor.role);
        const recentVotesSnap = await tx.get(issueRef.collection("verifications").orderBy("timestamp", "desc").limit(25));
        const recentVotes = recentVotesSnap.docs.map((doc: any) => doc.data() || {});
        const guard = computeBrigadingGuard({
          voteType: type,
          trustScore: freshTrustScore,
          audit: trustAudit,
          recentVotes,
          nowMs: Date.now(),
        });
        const baseWeight = roundTrust(type === "dispute" ? Math.min(1, freshTrustScore + 0.03) : freshTrustScore);
        const auditedWeight = roundTrust(baseWeight * cleanNumber(trustAudit.weightMultiplier, 0.9, 0, 1.15));
        const finalWeight = guard.collapsed ? roundTrust(Math.min(0.08, auditedWeight * 0.15)) : auditedWeight;
        const issueData = issueSnap.data() || {};
        const currentStatus = normalizeIssueStatus(issueData.status);
        const consensus = buildTrustConsensusUpdate(issueData.trustConsensus, type, finalWeight, guard, nowIso);
        const shouldAutoResolve =
          type === "confirm" &&
          !guard.collapsed &&
          ["verified", "in_progress"].includes(currentStatus) &&
          consensus.confirmVotes >= 3 &&
          consensus.confirmWeight >= consensus.autoResolveThreshold &&
          consensus.consensusRatio >= 0.75;

        if (shouldAutoResolve) {
          consensus.autoResolvedAt = nowIso;
          consensus.autoResolvedBy = "weighted_community_consensus";
          consensus.publicExplanation = "A weighted, audited community consensus crossed the public auto-resolution threshold.";
        }

        tx.set(verificationRef, {
          userId: actor.uid,
          type,
          timestamp: nowIso,
          reason,
          baseTrustScore: freshTrustScore,
          trustWeight: finalWeight,
          brigadingCollapsed: guard.collapsed,
          brigadingRisk: guard.risk,
          trustAudit,
        });
        const updates: any = {
          confirmCount: type === "confirm" ? FieldValue.increment(1) : FieldValue.increment(0),
          disputeCount: type === "dispute" ? FieldValue.increment(1) : FieldValue.increment(0),
          weightedConfirmScore: type === "confirm" ? FieldValue.increment(finalWeight) : FieldValue.increment(0),
          weightedDisputeScore: type === "dispute" ? FieldValue.increment(finalWeight) : FieldValue.increment(0),
          verificationStatus: shouldAutoResolve ? "trust_consensus_resolved" : type === "confirm" ? "community_confirmed" : "community_disputed",
          trustConsensus: consensus,
          updatedAt: nowIso,
        };
        if (shouldAutoResolve) {
          updates.status = "resolved";
          updates.resolvedAt = issueData.resolvedAt || nowIso;
        }
        tx.update(issueRef, updates);
        tx.set(profileRef, {
          uid: actor.uid,
          role: actor.role || profile.role || "citizen",
          handle: profile.handle || `Hero-${String(actor.uid).slice(0, 4).toUpperCase()}`,
          trustScore: freshTrustScore,
          trustUpdatedAt: nowIso,
          updatedAt: nowIso,
        }, { merge: true });
        tx.set(issueRef.collection("activity").doc(), {
          actorType: "citizen",
          eventType: shouldAutoResolve ? "trust_consensus_resolved" : "verification",
          message: shouldAutoResolve
            ? "Weighted community consensus auto-resolved this case."
            : `Community ${type} recorded by server.`,
          timestamp: nowIso,
          byUid: actor.uid,
          byRole: actor.role,
          trustWeight: finalWeight,
        });
        responsePayload = {
          success: true,
          trust: {
            trustScore: freshTrustScore,
            weight: finalWeight,
            brigadingCollapsed: guard.collapsed,
            brigadingRisk: guard.risk,
            audit: trustAudit,
          },
          consensus,
          autoResolved: shouldAutoResolve,
        };
      });
      if (type === "confirm") await awardPoints(actor.uid, actor.role, 5, "verifyCount");
      await recordEvent({
        issueRef,
        actorType: "citizen",
        eventType: "verification",
        message: `Community ${type} recorded by server.`,
        timestamp: nowIso,
        actor,
        source: "api",
        payload: { verificationType: type, trust: responsePayload?.trust || null, autoResolved: responsePayload?.autoResolved === true },
      });
      await recordEvent({
        issueRef,
        actorType: "ai",
        eventType: "trust_verification_audited",
        message: "Community verification was audited and converted into a trust-weighted signal.",
        timestamp: nowIso,
        actor,
        source: "agent",
        payload: { verificationType: type, trust: responsePayload?.trust || null, consensus: responsePayload?.consensus || null },
      });
      if (responsePayload?.trust?.brigadingCollapsed) {
        await recordEvent({
          issueRef,
          actorType: "ai",
          eventType: "trust_brigading_collapsed",
          message: "Brigading guard collapsed a suspicious or low-trust vote burst.",
          timestamp: nowIso,
          actor,
          source: "agent",
          severity: "warn",
          payload: { verificationType: type, trust: responsePayload.trust },
        });
      }
      if (responsePayload?.autoResolved) {
        await recordEvent({
          issueRef,
          actorType: "ai",
          eventType: "trust_consensus_resolved",
          message: "Weighted community consensus auto-resolved this case.",
          timestamp: nowIso,
          actor,
          source: "agent",
          payload: { verificationType: type, consensus: responsePayload.consensus },
        });
      }
      return res.json(responsePayload || { success: true });
    } catch (error: any) {
      if (error?.message === "NOT_FOUND") return sendApiError(res, 404, "Issue not found.");
      if (error?.message === "ALREADY_VERIFIED") return sendApiError(res, 409, "You have already verified or disputed this issue.");
      return sendApiError(res, 500, "Failed to submit verification.", error);
    }
  });

  app.post("/api/issues/:issueId/trust-appeal", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor) return sendApiError(res, 401, "Firebase ID token is required.");
    const { issueId } = req.params;
    if (!isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid issue id.");
    const reason = cleanText(req.body?.reason, "", 900);
    if (reason.length < 12) return sendApiError(res, 400, "Appeal reason must be at least 12 characters.");
    const issueRef = adminDb.collection("issues").doc(issueId);
    const appealRef = issueRef.collection("trustAppeals").doc(actor.uid);
    const nowIso = new Date().toISOString();

    try {
      let reopened = false;
      await adminDb.runTransaction(async (tx: any) => {
        const issueSnap = await tx.get(issueRef);
        if (!issueSnap.exists) throw new Error("NOT_FOUND");
        const issueData = issueSnap.data() || {};
        const consensus = issueData.trustConsensus || {};
        if (!consensus.autoResolvedAt) throw new Error("NOT_AUTO_RESOLVED");
        const appeal = {
          byUid: actor.uid,
          byRole: actor.role,
          reason,
          status: "pending",
          appealedAt: nowIso,
        };
        reopened = normalizeIssueStatus(issueData.status) === "resolved";
        tx.set(appealRef, appeal, { merge: true });
        tx.update(issueRef, {
          status: reopened ? "in_progress" : issueData.status,
          reopenedAt: reopened ? nowIso : issueData.reopenedAt || null,
          verificationStatus: "trust_consensus_appealed",
          trustAppeal: appeal,
          trustConsensus: {
            ...consensus,
            appealedAt: nowIso,
            appealStatus: "pending",
            appealable: true,
          },
          updatedAt: nowIso,
        });
        tx.set(issueRef.collection("activity").doc(), {
          actorType: "citizen",
          eventType: "trust_consensus_appealed",
          message: "A citizen appealed the weighted consensus decision.",
          timestamp: nowIso,
          byUid: actor.uid,
          byRole: actor.role,
        });
      });
      await recordEvent({
        issueRef,
        actorType: "citizen",
        eventType: "trust_consensus_appealed",
        message: "Weighted consensus auto-resolution was appealed for human review.",
        timestamp: nowIso,
        actor,
        source: "api",
        payload: { reopened },
      });
      return res.json({ success: true, reopened });
    } catch (error: any) {
      if (error?.message === "NOT_FOUND") return sendApiError(res, 404, "Issue not found.");
      if (error?.message === "NOT_AUTO_RESOLVED") return sendApiError(res, 409, "This issue was not auto-resolved by trust consensus.");
      return sendApiError(res, 500, "Failed to appeal trust consensus.", error);
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
      await addServerActivity(issueRef, {
        actorType: actor.isRealOperator || actor.isDemoOperator ? "operator" : "citizen",
        eventType: "translations_saved",
        message: "Issue translations saved by server.",
        timestamp: new Date().toISOString(),
        byUid: actor.uid,
        byRole: actor.role,
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
      model: geminiModels.grounding,
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

    let groundingSources = extractGroundingSources(
      response,
      "Suggested authority/contact reference for a draft action packet."
    );
    if (groundingSources.length === 0) {
      groundingSources = await findGroundingCitationSources(ai, {
        category: cleanText(issueData?.category, "civic issue", 80),
        title: cleanText(issueData?.title, "Civic issue", 180),
        summary: cleanText(issueData?.summary || issueData?.description, "", 600),
        locationName: cleanText(issueData?.locationName, "", 240),
        lat: issueData?.lat,
        lng: issueData?.lng,
      });
    }
    parsedData.groundingSources = groundingSources;

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
        Object.assign(updateData, buildSlaIssueFields({ ...issueData, resolutionPlan: planResult.data }, updateData.updatedAt));
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
      const issueData = snap.data();
      if (!requireOperatorForIssue(issueData, actor, res)) return;
      const nowIso = new Date().toISOString();
      const escalationLetter = cleanText(req.body?.escalationLetter, "", 8000);
      const rtiRequest = cleanText(req.body?.rtiRequest, "", 8000);
      const rtiPdf = buildRtiPdfArtifact({ id: issueId, ...issueData }, rtiRequest, nowIso);
      const escalation = {
        escalatedAt: nowIso,
        escalationLetter,
        rtiRequest,
        rtiPdfDataUri: rtiPdf.dataUri,
        rtiPdfFilename: rtiPdf.filename,
        rtiPdfGeneratedAt: nowIso,
        rtiPdfBytes: rtiPdf.byteLength,
        source: "manual-gemini-draft",
      };
      await issueRef.update({
        escalation,
        agentTrace: [
          ...(Array.isArray(issueData.agentTrace) ? issueData.agentTrace : []),
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
        ...buildSlaIssueFields(data, nowIso),
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

  // ---- Phase 4: real outbound dispatch of an approved escalation ----------
  // Actually SENDS the escalation to a configured authority webhook (municipal
  // intake / Zapier / n8n) and records a delivery receipt. No webhook configured
  // => honest 400; failed delivery => recorded as failed (never faked as sent).
  app.post("/api/issues/:issueId/escalation-dispatch", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid dispatch request.");
    const webhook = process.env.CIVICLENS_OUTBOUND_WEBHOOK || "";
    if (!/^https?:\/\//.test(webhook)) return sendApiError(res, 400, "No outbound authority channel is configured (set CIVICLENS_OUTBOUND_WEBHOOK).");
    const issueRef = adminDb.collection("issues").doc(issueId);
    try {
      const snap = await issueRef.get();
      if (!snap.exists) return sendApiError(res, 404, "Issue not found.");
      const data: any = snap.data();
      if (!requireOperatorForIssue(data, actor, res)) return;
      if (!data.escalation?.escalationLetter) return sendApiError(res, 409, "An escalation draft is required before dispatch.");
      if (data.dispatch?.status === "delivered") return res.json({ success: true, dispatch: data.dispatch, idempotent: true });

      const payload = {
        source: "CivicLens",
        ticketId: issueId,
        title: data.title || data.category,
        category: data.category,
        location: data.locationName || null,
        coordinates: (typeof data.lat === "number" && typeof data.lng === "number") ? { lat: data.lat, lng: data.lng } : null,
        escalationLetter: data.escalation.escalationLetter,
        rtiRequest: data.escalation.rtiRequest || null,
        escalationLevel: data.escalation.escalationLevel || 1,
        dispatchedAt: new Date().toISOString(),
      };
      let httpStatus = 0; let ok = false; let errText = "";
      try {
        const resp = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
        httpStatus = resp.status; ok = resp.ok;
        if (!ok) errText = (await resp.text().catch(() => "")).slice(0, 200);
      } catch (e: any) {
        errText = e?.message || "network error";
      }
      const nowIso = new Date().toISOString();
      let endpointHost = "configured-endpoint";
      try { endpointHost = new URL(webhook).host; } catch { /* keep default */ }
      const dispatch = {
        deliveryId: `${issueId}_${nowIso}`,
        channel: "webhook",
        endpoint: endpointHost,
        status: ok ? "delivered" : "failed",
        httpStatus: httpStatus || null,
        error: ok ? null : (errText || "delivery failed"),
        dispatchedAt: nowIso,
        dispatchedBy: actor.uid,
      };
      await issueRef.set({ dispatch }, { merge: true });
      await addServerActivity(issueRef, {
        actorType: "operator",
        eventType: ok ? "escalation_dispatched" : "escalation_dispatch_failed",
        message: ok ? `Escalation dispatched to authority channel (${endpointHost}, HTTP ${httpStatus}).` : `Escalation dispatch to ${endpointHost} FAILED: ${dispatch.error}`,
        timestamp: nowIso,
        byUid: actor.uid,
        byRole: actor.role,
      });
      if (!ok) return res.status(502).json({ success: false, dispatch, error: "Authority channel rejected or was unreachable." });
      return res.json({ success: true, dispatch });
    } catch (error) {
      return sendApiError(res, 500, "Failed to dispatch escalation.", error);
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
      const seededReports: Array<{ ref: any; report: any }> = [];
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
        Object.assign(report, buildSlaIssueFields(report, report.updatedAt));
        seededReports.push({ ref, report });
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
      await Promise.all(seededReports.map(({ ref, report }) => recordEvent({
        issueRef: ref,
        actorType: "operator",
        eventType: "demo_seeded",
        message: "Synthetic demo report seeded by server.",
        timestamp: report.updatedAt,
        actor,
        source: "api",
        payload: {
          title: report.title,
          category: report.category,
          status: report.status,
          priorityScore: report.priorityScore,
        },
      })));
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
      await recordEvent({
        actorType: "operator",
        eventType: "demo_cleared",
        message: "Synthetic demo reports cleared by server.",
        actor,
        source: "api",
        payload: { cleared: snap.size },
      });
      return res.json({ success: true, cleared: snap.size });
    } catch (error) {
      return sendApiError(res, 500, "Failed to clear demo data.", error);
    }
  });


  // Server-side Gemini Multimodal Report Analysis Endpoint
  app.post("/api/analyze-report", async (req, res) => {
    const { image, description } = req.body;
    const actor = (req as any).actor as RequestActor | undefined;

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
First decide whether the image itself clearly shows a civic infrastructure or public-space issue such as a pothole, road damage, drainage, waste, water leak, or streetlight problem.
If the image appears to be food, a waffle, a household object, a selfie, a decorative image, or otherwise not civic evidence, set isCivicIssue=false, category="other", severity=1, urgency="routine", affectedArea="unknown", confidence <= 0.35, and ask a targeted clarificationQuestion before saving.
If confidence is low (under 0.6) or ambiguity exists, ask a targeted clarificationQuestion to verify if this is the citizen's intended issue to report.`;

      const startTime = Date.now();
      // Main Gemini Content Generation
      const mainResult = await generateContentWithRetry(ai, {
        model: geminiModels.vision,
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
              isCivicIssue: {
                type: Type.BOOLEAN,
                description: "True only when the image clearly shows civic infrastructure or public-space issue evidence. False for food, waffle, household, decorative, or unrelated images.",
              },
              nonCivicReason: {
                type: Type.STRING,
                description: "Short reason when isCivicIssue is false (optional).",
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
              "isCivicIssue",
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
- isCivicIssue: boolean (false for waffle, food, household, decorative, or unrelated images)
- nonCivicReason?: optional short reason when isCivicIssue is false
- clarificationQuestion?: optional string

Malformed Response output:
${responseText}

Respond ONLY with the corrected, valid JSON object.`;

          const repairResult = await generateContentWithRetry(ai, {
            model: geminiModels.cheapClassification,
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
      if (parseSuccess) {
        parsedData = applyCivicImageGuardrail(parsedData);
      }
      const outputSummary = parseSuccess
        ? `${parsedData.category || "issue"} · severity ${parsedData.severity || 1}/5 · ${parsedData.visibleHazards?.length || 0} hazards · ${(parsedData.confidence || 0).toFixed(2)} conf`
        : "Fallback to manual form";

      if (parseSuccess) {
        await recordEvent({
          actorType: "ai",
          eventType: "ai_report_analysis",
          message: "Gemini multimodal report analysis completed.",
          actor,
          source: "gemini",
          status: "succeeded",
          payload: {
            durationMs,
            confidence: parsedData.confidence,
            category: parsedData.category,
            isCivicIssue: parsedData.isCivicIssue,
            retried: finalRetried,
            fallbackUsed,
          },
        });
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
        await recordEvent({
          actorType: "ai",
          eventType: "ai_report_analysis",
          message: "Gemini multimodal report analysis fell back to manual form after schema validation failed.",
          actor,
          source: "gemini",
          status: "failed",
          severity: "warn",
          payload: {
            durationMs,
            confidence: 0,
            retried: finalRetried,
            fallbackUsed,
          },
        });
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
      await recordEvent({
        actorType: "ai",
        eventType: "ai_report_analysis",
        message: "Gemini multimodal report analysis failed.",
        actor,
        source: "gemini",
        status: "failed",
        severity: "error",
        payload: { error: error?.message || String(error) },
      });
      return sendApiError(res, 500, "An error occurred during Gemini multimodal analysis.");
    }
  });

  app.post("/api/voice-intake", async (req, res) => {
    const actor = (req as any).actor as RequestActor | undefined;
    const audioPart = audioSourceToInlinePart(req.body?.audio || req.body?.audioBase64, req.body?.mimeType);
    if (!audioPart) {
      return res.status(400).json({ success: false, error: "Audio data URL or base64 audio payload is required." });
    }

    const localeHint = cleanText(req.body?.localeHint, "auto", 80);
    const descriptionHint = cleanText(req.body?.descriptionHint, "", 1200);
    const startTime = Date.now();
    try {
      const promptText = `You are CivicLens multilingual voice intake for a hyperlocal civic reporting app.
Listen to the audio, detect the spoken language, transcribe it, translate the meaning to English, and extract a draft civic report in one pass.
Use exactly one of these categories: ${categoriesList.join(", ")}.
Use urgency exactly one of: ${urgenciesList.join(", ")}.
Locale hint: ${localeHint}
Existing typed context, if any: ${descriptionHint || "none"}
Return strict JSON only with:
{
  "transcriptOriginal": "string in the spoken language or transliteration",
  "detectedLanguage": "string",
  "englishTranslation": "clear English translation",
  "category": "pothole|water_leak|streetlight|waste|drainage|road_damage|other",
  "title": "short civic title",
  "summary": "one or two sentence report summary",
  "severity": number 1 to 5,
  "urgency": "routine|priority|urgent",
  "readbackText": "short confirmation sentence for text-to-speech readback",
  "confidence": number 0 to 1
}`;

      const result = await generateContentWithRetry(ai, {
        model: geminiModels.audio,
        contents: [
          audioPart,
          { text: promptText },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcriptOriginal: { type: Type.STRING },
              detectedLanguage: { type: Type.STRING },
              englishTranslation: { type: Type.STRING },
              category: { type: Type.STRING, enum: categoriesList },
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              severity: { type: Type.INTEGER },
              urgency: { type: Type.STRING, enum: urgenciesList },
              readbackText: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: ["transcriptOriginal", "detectedLanguage", "englishTranslation", "category", "title", "summary", "severity", "urgency", "readbackText", "confidence"],
          },
        },
      }, { signal: AbortSignal.timeout(20_000) });

      const responseText = (result.response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(responseText);
      const category = categoriesList.includes(parsed.category) ? parsed.category : "other";
      const urgency = urgenciesList.includes(parsed.urgency) ? parsed.urgency : "routine";
      const normalized = {
        transcriptOriginal: cleanText(parsed.transcriptOriginal, "", 1800),
        detectedLanguage: cleanText(parsed.detectedLanguage, "unknown", 80),
        englishTranslation: cleanText(parsed.englishTranslation, descriptionHint, 1800),
        category,
        title: cleanText(parsed.title, "Voice-described civic issue", 140),
        summary: cleanText(parsed.summary, parsed.englishTranslation || descriptionHint || "Voice-described civic issue.", 700),
        severity: Math.round(cleanNumber(parsed.severity, 3, 1, 5)),
        urgency,
        readbackText: cleanText(parsed.readbackText, `Drafted ${category.replace("_", " ")} report.`, 400),
        confidence: cleanNumber(parsed.confidence, 0.6, 0, 1),
        model: geminiModels.audio,
        retried: result.retried,
        durationMs: Date.now() - startTime,
        aiFallback: false,
      };

      await recordEvent({
        actorType: "ai",
        eventType: "ai_voice_intake",
        message: "Gemini multilingual voice intake completed.",
        actor,
        source: "gemini",
        status: "succeeded",
        payload: {
          category: normalized.category,
          detectedLanguage: normalized.detectedLanguage,
          confidence: normalized.confidence,
          durationMs: normalized.durationMs,
          retried: normalized.retried,
        },
      });

      return res.json({ success: true, data: normalized });
    } catch (error: any) {
      const fallback = {
        transcriptOriginal: "",
        detectedLanguage: "unknown",
        englishTranslation: descriptionHint,
        category: "other",
        title: "Voice intake needs typed confirmation",
        summary: descriptionHint || "Voice audio could not be transcribed. Please type the report details.",
        severity: 3,
        urgency: "routine",
        readbackText: "Voice intake needs typed confirmation before saving.",
        confidence: 0,
        model: "deterministic-fallback",
        retried: false,
        durationMs: Date.now() - startTime,
        aiFallback: true,
      };
      await recordEvent({
        actorType: "ai",
        eventType: "ai_voice_intake",
        message: "Gemini multilingual voice intake failed and returned an honest fallback.",
        actor,
        source: "gemini",
        status: "failed",
        severity: "warn",
        payload: { error: error?.message || String(error), durationMs: fallback.durationMs },
      });
      return res.json({ success: false, fallback: true, data: fallback, error: "Voice intake could not be transcribed automatically." });
    }
  });

  // Server-side Gemini Duplicate Checking Endpoint
  app.post("/api/check-duplicate", async (req, res) => {
    const { newReport, candidates } = req.body;
    const actor = (req as any).actor as RequestActor | undefined;

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
        model: geminiModels.cheapClassification,
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

      await recordEvent({
        actorType: "ai",
        eventType: "ai_duplicate_check",
        message: "Gemini duplicate comparison completed.",
        actor,
        source: "gemini",
        status: "succeeded",
        payload: {
          durationMs,
          recommendation: parsedData.recommendation,
          bestCandidateId: parsedData.bestCandidateId || null,
          similarity: parsedData.similarity,
          candidateCount: candidates.length,
          retried,
        },
      });
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
      await recordEvent({
        actorType: "ai",
        eventType: "ai_duplicate_check",
        message: "Gemini duplicate comparison failed.",
        actor,
        source: "gemini",
        status: "failed",
        severity: "error",
        payload: { error: error?.message || String(error) },
      });
      return sendApiError(res, 500, "An error occurred during Gemini duplicate analysis.");
    }
  });

  // Server-side Gemini Resolution Plan Generator (with Google Search Grounding)
  app.post("/api/resolution-plan", async (req, res) => {
    const { category, title, summary, locationName, lat, lng, ticketId } = req.body;
    const actor = (req as any).actor as RequestActor | undefined;

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
        model: geminiModels.grounding,
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

      let uniqueSources = extractGroundingSources(
        response,
        "Suggested authority/contact reference for a draft action packet."
      );
      if (uniqueSources.length === 0) {
        uniqueSources = await findGroundingCitationSources(ai, {
          category,
          title,
          summary,
          locationName,
          lat,
          lng,
        });
      }
      parsedData.groundingSources = uniqueSources;

      const inputDigest = `${category}: "${title}"`;
      const outputSummary = `Suggested authority: ${parsedData.recommendedAuthority} · follow-up: ${parsedData.slaDays} days`;

      await recordEvent({
        actorType: "ai",
        eventType: "ai_resolution_plan",
        message: "Gemini grounded resolution plan completed.",
        actor,
        source: "gemini",
        status: "succeeded",
        payload: {
          durationMs,
          category,
          ticketId: ticketId || null,
          recommendedAuthority: parsedData.recommendedAuthority || null,
          slaDays: parsedData.slaDays || null,
          groundingSourceCount: uniqueSources.length,
          retried,
        },
      });
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
      await recordEvent({
        actorType: "ai",
        eventType: "ai_resolution_plan",
        message: "Gemini grounded resolution plan failed.",
        actor,
        source: "gemini",
        status: "failed",
        severity: "error",
        payload: {
          category: category || null,
          ticketId: ticketId || null,
          error: error?.message || String(error),
        },
      });
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
      const beforePart = await imageSourceToInlinePart(beforeImageUrl, "beforeImageUrl");
      if (beforePart) contentsList.push(beforePart);

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
        model: geminiModels.vision,
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
      const closureAssessment: any = {
        resolved: parsedResult.resolved === true,
        confidence: cleanNumber(parsedResult.confidence, 0, 0, 1),
        observedChanges: cleanStringArray(parsedResult.observedChanges, 12, 240),
        recommendation: ["resolve", "request_more_evidence", "reopen"].includes(parsedResult.recommendation)
          ? parsedResult.recommendation
          : "request_more_evidence",
        explanation: cleanText(parsedResult.explanation, "Gemini returned no explanation.", 1200),
      };
      if (afterImageUrl) closureAssessment.afterImage = afterImageUrl;
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

      await recordEvent({
        issueRef,
        issueId: issueId || undefined,
        actorType: "ai",
        eventType: "ai_closure_verification",
        message: "Gemini closure verification completed.",
        actor,
        source: "gemini",
        status: "succeeded",
        payload: {
          durationMs,
          confidence: closureAssessment.confidence,
          recommendation: closureAssessment.recommendation,
          resolved: closureAssessment.resolved,
          retried,
        },
      });
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
      await recordEvent({
        issueRef,
        issueId: issueId || undefined,
        actorType: "ai",
        eventType: "ai_closure_verification",
        message: "Gemini closure verification failed.",
        actor,
        source: "gemini",
        status: "failed",
        severity: "error",
        payload: { error: error?.message || String(error) },
      });
      return sendApiError(res, 500, "An error occurred during Gemini multimodal verification.");
    }
  });

  app.post("/api/issues/:issueId/ghost-forensics", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const { issueId } = req.params;
    if (!actor || !isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid ghost-forensics request.");

    const auditImage = cleanText(req.body?.auditImage || req.body?.fieldAuditImage, "", 1_200_000);
    const auditImageUrl = cleanText(req.body?.auditImageUrl || req.body?.fieldAuditImageUrl, "", 2000);
    const fieldAuditSummary = cleanText(req.body?.fieldAuditSummary, "", 1500);
    if (!auditImage) return sendApiError(res, 400, "Fresh audit image is required.");

    const issueRef = adminDb.collection("issues").doc(issueId);
    let issueData: any = null;
    try {
      const issueSnap = await issueRef.get();
      if (!issueSnap.exists) return sendApiError(res, 404, "Issue not found.");
      issueData = issueSnap.data() || {};
      if (!requireOperatorForIssue(issueData, actor, res)) return;

      const beforePart = await imageSourceToInlinePart(issueData.image, "ghost-before-image");
      const closureAfterImage = cleanText(req.body?.closureAfterImage || issueData.closureAssessment?.afterImage, "", 1_200_000);
      const closurePart = await imageSourceToInlinePart(closureAfterImage, "ghost-closure-image");
      const auditPart = await imageSourceToInlinePart(auditImage, "ghost-audit-image");
      if (!beforePart || !closurePart || !auditPart) {
        return sendApiError(res, 400, "Ghost forensics requires original, closure, and fresh audit images.");
      }

      const promptText = `You are CivicLens's ghost-closure forensics auditor.
Compare exactly these three images in order:
1. Original citizen report before repair.
2. Claimed closure or officer after-repair image.
3. Fresh field audit image captured after the closure claim.

Issue context: ${JSON.stringify({
        title: issueData.title || null,
        summary: issueData.summary || issueData.description || null,
        category: issueData.category || null,
        status: issueData.status || null,
        closureRecommendation: issueData.closureAssessment?.recommendation || null,
        fieldAuditSummary,
      })}

Decide whether this is a ghost/fake closure: the claimed closure image looks resolved, but the fresh audit image still shows the original hazard or no durable repair.
Only recommend "reopen" when the fresh audit image materially contradicts the closure claim. Penalize only on strong evidence.
Return STRICT JSON with:
{
  "ghostClosureLikely": boolean,
  "confidence": number from 0 to 1,
  "signals": string[],
  "recommendation": "keep_resolved" | "request_more_evidence" | "reopen",
  "explanation": string,
  "officerPenaltyPoints": number from 0 to 25
}`;

      const startTime = Date.now();
      const result = await generateContentWithRetry(ai, {
        model: geminiModels.vision,
        contents: [
          { text: "Image 1: original report before repair." },
          beforePart,
          { text: "Image 2: claimed closure or after-repair evidence." },
          closurePart,
          { text: "Image 3: fresh field audit evidence after the closure claim." },
          auditPart,
          { text: promptText },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ghostClosureLikely: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              signals: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendation: { type: Type.STRING, enum: ["keep_resolved", "request_more_evidence", "reopen"] },
              explanation: { type: Type.STRING },
              officerPenaltyPoints: { type: Type.NUMBER },
            },
            required: ["ghostClosureLikely", "confidence", "signals", "recommendation", "explanation", "officerPenaltyPoints"],
          },
        },
      });
      const durationMs = Date.now() - startTime;
      const responseText = (result.response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(responseText);
      const recommendation = ["keep_resolved", "request_more_evidence", "reopen"].includes(parsed.recommendation)
        ? parsed.recommendation
        : "request_more_evidence";
      const confidence = cleanNumber(parsed.confidence, 0, 0, 1);
      const ghostClosureLikely = parsed.ghostClosureLikely === true || recommendation === "reopen";
      const officerId = cleanText(
        issueData.assignedOfficerId ||
          issueData.assignedOperatorUid ||
          issueData.closureAssessment?.byUid ||
          issueData.closureSubmittedByUid ||
          "unassigned",
        "unassigned",
        128
      );
      const shouldReopen = ghostClosureLikely && recommendation === "reopen" && confidence >= 0.65;
      const penaltyPoints = shouldReopen ? cleanNumber(parsed.officerPenaltyPoints, 10, 0, 25) : 0;
      const nowIso = new Date().toISOString();
      const ghostForensics = {
        ghostClosureLikely,
        confidence,
        signals: cleanStringArray(parsed.signals, 8, 240),
        recommendation,
        explanation: cleanText(parsed.explanation, "Ghost-closure forensics completed.", 1600),
        checkedAt: nowIso,
        auditImage: auditImageUrl || null,
        autoReopened: shouldReopen,
        officerId,
        officerPenaltyPoints: penaltyPoints,
        model: geminiModels.vision,
        retried: result.retried,
        durationMs,
      };

      await adminDb.runTransaction(async (tx: any) => {
        const freshSnap = await tx.get(issueRef);
        if (!freshSnap.exists) throw new Error("NOT_FOUND");
        const freshIssue = freshSnap.data() || {};
        const currentStatus = normalizeIssueStatus(freshIssue.status);
        const agentTrace = Array.isArray(freshIssue.agentTrace) ? freshIssue.agentTrace : [];
        const updates: any = {
          ghostForensics,
          updatedAt: nowIso,
          agentTrace: [
            ...agentTrace,
            {
              step: "ghost_forensics",
              tool: "agent.ghost_forensics",
              status: shouldReopen ? "failed" : "done",
              rationale: ghostForensics.explanation,
              ts: nowIso,
              confidence,
              durationMs,
              inputDigest: "Compared original, closure, and fresh audit images",
              outputSummary: `${recommendation} (${Math.round(confidence * 100)}% confidence)`,
              retried: result.retried,
            },
          ].slice(-30),
        };
        if (shouldReopen) {
          updates.status = currentStatus === "resolved" ? "in_progress" : currentStatus;
          updates.reopenedAt = nowIso;
          updates.verificationStatus = "ghost_closure_flagged";
          updates.closureAssessment = {
            ...(freshIssue.closureAssessment || {}),
            ghostFlaggedAt: nowIso,
            ghostRecommendation: recommendation,
          };
        }
        tx.update(issueRef, updates);
        if (shouldReopen && officerId !== "unassigned") {
          tx.set(adminDb.collection("officerAccountability").doc(officerId), {
            officerId,
            ghostClosureCount: FieldValue.increment(1),
            ghostPenaltyPoints: FieldValue.increment(penaltyPoints),
            lastGhostClosureAt: nowIso,
            updatedAt: nowIso,
          }, { merge: true });
        }
      });

      await addServerActivity(issueRef, {
        actorType: "ai",
        eventType: shouldReopen ? "ghost_closure_reopened" : "ghost_closure_checked",
        message: shouldReopen
          ? `Ghost-closure forensics reopened the case and assigned ${penaltyPoints} accountability penalty point(s).`
          : "Ghost-closure forensics completed without an automatic reopen.",
        timestamp: nowIso,
        byUid: actor.uid,
        byRole: actor.role,
      });
      await recordEvent({
        issueRef,
        actorType: "ai",
        eventType: "ai_ghost_forensics",
        message: "Gemini ghost-closure forensics completed.",
        actor,
        source: "gemini",
        status: "succeeded",
        payload: ghostForensics,
      });

      return res.json({ success: true, data: ghostForensics });
    } catch (error: any) {
      await recordEvent({
        issueRef,
        actorType: "ai",
        eventType: "ai_ghost_forensics",
        message: "Gemini ghost-closure forensics failed.",
        actor,
        source: "gemini",
        status: "failed",
        severity: "error",
        payload: { error: error?.message || String(error) },
      });
      if (error?.message === "NOT_FOUND") return sendApiError(res, 404, "Issue not found.");
      return sendApiError(res, 500, "Ghost-closure forensics failed.", error);
    }
  });

  // Auto-Escalation + RTI generator endpoint
  app.post("/api/escalation", async (req, res) => {
    const { title, summary, locationName, category, recommendedAuthority, ticketId } = req.body;
    const actor = (req as any).actor as RequestActor | undefined;

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
        model: geminiModels.reasoning,
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

      await recordEvent({
        actorType: "ai",
        eventType: "ai_escalation_draft",
        message: "Gemini escalation and RTI draft completed.",
        actor,
        source: "gemini",
        status: "succeeded",
        payload: {
          durationMs,
          category: category || null,
          ticketId: ticketId || null,
          recommendedAuthority: recommendedAuthority || null,
          retried,
        },
      });
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
      await recordEvent({
        actorType: "ai",
        eventType: "ai_escalation_draft",
        message: "Gemini escalation and RTI draft failed.",
        actor,
        source: "gemini",
        status: "failed",
        severity: "error",
        payload: {
          category: category || null,
          ticketId: ticketId || null,
          error: error?.message || String(error),
        },
      });
      return sendApiError(res, 500, "An error occurred during Gemini escalation generation.");
    }
  });

  // Server-side Gemini Translation Endpoint
  app.post("/api/translate", async (req, res) => {
    const { title, summary } = req.body;
    const actor = (req as any).actor as RequestActor | undefined;
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
        model: geminiModels.cheapClassification,
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
      await recordEvent({
        actorType: "ai",
        eventType: "ai_translation",
        message: "Gemini Hindi translation completed.",
        actor,
        source: "gemini",
        status: "succeeded",
        payload: { titleLength: String(title || "").length, summaryLength: String(summary || "").length },
      });
      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Translation error:", error);
      await recordEvent({
        actorType: "ai",
        eventType: "ai_translation",
        message: "Gemini Hindi translation failed; original text returned.",
        actor,
        source: "gemini",
        status: "failed",
        severity: "warn",
        payload: { error: error?.message || String(error) },
      });
      // Fallback: return the original English strings
      return res.json({
        success: false,
        error: "Translation failed.",
        data: { titleHi: title, summaryHi: summary }
      });
    }
  });

  // Helper to generate the structured action packet & native Hindi translations
  async function generateActionPacket(aiClient: any, issue: any, authority: string, channel: string, slaDays: number, options: GeminiGenerateOptions = {}): Promise<any> {
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
      model: geminiModels.reasoning,
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
    }, options);

    const text = (result.response.text || "").trim();
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean);
  }

  async function runAgentSelfCritique(aiClient: any, issue: any, steps: any[], final: any, options: GeminiGenerateOptions = {}) {
    const originalCategory = categoriesList.includes(issue.category) ? issue.category : "other";
    const originalSeverity = Math.round(cleanNumber(issue.severity, 1, 1, 5));
    const originalUrgency = urgenciesList.includes(issue.urgency) ? issue.urgency : "routine";
    const traceSummary = steps.slice(-8).map((step) => ({
      step: step.step,
      rationale: cleanText(step.rationale, "", 280),
      outputSummary: cleanText(step.outputSummary, "", 220),
    }));
    const prompt = `You are CivicLens's QA self-critique pass for one server-side triage run.
Review only the Firestore-loaded issue fields and the actual tool trace. Check whether category, severity, and urgency are defensible. If a correction is needed, return the corrected values and one concise reason. Do not invent facts outside this issue/trace.

Issue:
${JSON.stringify({
  category: issue.category,
  title: issue.title,
  summary: issue.summary || issue.description,
  severity: issue.severity,
  urgency: issue.urgency,
  affectedArea: issue.affectedArea,
  visibleHazards: issue.visibleHazards,
  confidence: issue.confidence,
  reportCount: issue.reportCount,
  confirmCount: issue.confirmCount,
  final,
})}

Actual trace:
${JSON.stringify(traceSummary)}

Return STRICT JSON only:
{
  "anomaly": true,
  "correctedCategory": "pothole|water_leak|streetlight|waste|drainage|road_damage|other",
  "correctedSeverity": 1,
  "correctedUrgency": "routine|priority|urgent",
  "rationale": "one concise grounded sentence",
  "confidence": 0.0
}`;

    const startedAt = Date.now();
    const result = await generateContentWithRetry(aiClient, {
      model: geminiModels.cheapClassification,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            anomaly: { type: Type.BOOLEAN },
            correctedCategory: { type: Type.STRING, enum: categoriesList },
            correctedSeverity: { type: Type.INTEGER },
            correctedUrgency: { type: Type.STRING, enum: urgenciesList },
            rationale: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ["anomaly", "correctedCategory", "correctedSeverity", "correctedUrgency", "rationale", "confidence"],
        },
      },
    }, options);

    const responseText = (result.response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(responseText);
    const correctedCategory = categoriesList.includes(parsed.correctedCategory) ? parsed.correctedCategory : originalCategory;
    const correctedSeverity = Math.round(cleanNumber(parsed.correctedSeverity, originalSeverity, 1, 5));
    const correctedUrgency = urgenciesList.includes(parsed.correctedUrgency) ? parsed.correctedUrgency : originalUrgency;
    const correctedIssue = {
      ...issue,
      category: correctedCategory,
      severity: correctedSeverity,
      urgency: correctedUrgency,
    };
    const priorityScore = serverPriorityScore(correctedIssue);
    const changed =
      correctedCategory !== originalCategory ||
      correctedSeverity !== originalSeverity ||
      correctedUrgency !== originalUrgency;
    const anomaly = parsed.anomaly === true || changed;
    const rationale = cleanText(parsed.rationale, anomaly ? "Self-critique flagged a triage correction." : "Self-critique found no correction needed.", 800);

    return {
      anomaly,
      correctedCategory,
      correctedSeverity,
      correctedUrgency,
      priorityScore,
      confidence: cleanNumber(parsed.confidence, 0, 0, 1),
      rationale,
      durationMs: Date.now() - startedAt,
      retried: result.retried,
      model: geminiModels.cheapClassification,
      outputSummary: anomaly
        ? `QA corrected to ${correctedCategory}, severity ${correctedSeverity}, ${correctedUrgency}`
        : "QA self-critique found no correction needed",
    };
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

  const AGENT_EXECUTION_TOOL_NAMES = [
    "search_nearby_cases",
    "get_local_context",
    "compare_candidate_evidence",
    "propose_merge",
    "find_responsible_authority",
    "draft_action_packet",
    "verify_closure",
    "request_human_approval",
    "record_event",
  ] as const;

  type AgentExecutionToolName = typeof AGENT_EXECUTION_TOOL_NAMES[number];
  type AgentPlanStep = {
    id: string;
    tool: AgentExecutionToolName;
    why: string;
    required: boolean;
    condition?: string | null;
    dependsOn?: string[];
  };
  type AgentExecutionPlan = {
    summary: string;
    plannerModel: string;
    fallback: boolean;
    generatedAt: string;
    stopWhen: string;
    priorityBreakdown: ReturnType<typeof buildPriorityBreakdown>;
    steps: AgentPlanStep[];
    rawStepCount?: number;
    error?: string;
  };

  const AGENT_EXECUTION_TOOL_SET = new Set<string>(AGENT_EXECUTION_TOOL_NAMES);

  const JURISDICTION_REGISTRY = [
    {
      id: "bengaluru_bbmp",
      keywords: ["bengaluru", "bangalore", "bbmp"],
      aliases: ["bbmp", "bruha bengaluru mahanagara palike"],
      authority: "BBMP",
      channel: "BBMP public grievance portal / Sahaaya",
      slaDays: 7,
    },
    {
      id: "mumbai_bmc",
      keywords: ["mumbai", "brihanmumbai", "bmc", "mcgm"],
      aliases: ["bmc", "mcgm", "brihanmumbai municipal corporation"],
      authority: "Brihanmumbai Municipal Corporation",
      channel: "BMC 1916 / public grievance portal",
      slaDays: 7,
    },
    {
      id: "delhi_mcd",
      keywords: ["delhi", "mcd", "new delhi"],
      aliases: ["mcd", "municipal corporation of delhi"],
      authority: "Municipal Corporation of Delhi",
      channel: "MCD 311 / public grievance portal",
      slaDays: 7,
    },
    {
      id: "pune_pmc",
      keywords: ["pune", "pmc"],
      aliases: ["pmc", "pune municipal corporation"],
      authority: "Pune Municipal Corporation",
      channel: "PMC Care / public grievance portal",
      slaDays: 7,
    },
    {
      id: "hyderabad_ghmc",
      keywords: ["hyderabad", "ghmc"],
      aliases: ["ghmc", "greater hyderabad municipal corporation"],
      authority: "Greater Hyderabad Municipal Corporation",
      channel: "GHMC grievance portal / helpline",
      slaDays: 7,
    },
    {
      id: "chennai_gcc",
      keywords: ["chennai", "gcc"],
      aliases: ["gcc", "greater chennai corporation"],
      authority: "Greater Chennai Corporation",
      channel: "GCC public grievance portal / helpline",
      slaDays: 7,
    },
    {
      id: "kolkata_kmc",
      keywords: ["kolkata", "kmc"],
      aliases: ["kmc", "kolkata municipal corporation"],
      authority: "Kolkata Municipal Corporation",
      channel: "KMC public grievance portal / helpline",
      slaDays: 7,
    },
  ];

  function buildPriorityBreakdown(issue: any, nearbyCandidateCount = 0) {
    const severity = cleanNumber(issue?.severity, 1, 1, 5);
    const urgency = urgenciesList.includes(issue?.urgency) ? issue.urgency : "routine";
    const urgencyBonus = urgency === "urgent" ? 10 : urgency === "priority" ? 5 : 0;
    const confirmCount = cleanNumber(issue?.verificationCount ?? issue?.confirmCount, 0, 0, 999);
    const reportCount = Math.max(cleanNumber(issue?.reportCount, 1, 1, 999), nearbyCandidateCount + 1);
    const confirmBonus = Math.min(confirmCount * 3, 15);
    const reportBonus = Math.min(reportCount * 4, 15);
    const score = Math.round(Math.min(100, severity * 12 + urgencyBonus + confirmBonus + reportBonus) * 10) / 10;
    return {
      score,
      basis: {
        severity,
        urgency,
        urgencyBonus,
        confirmCount,
        confirmBonus,
        reportCount,
        reportBonus,
        source: "canonical issue + server-loaded candidates",
      },
      explanation: `severity ${severity}, ${urgency} urgency, ${confirmCount} confirmations, ${reportCount} related report(s)`,
    };
  }

  function parseJsonObject(text: string): any {
    const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) throw new Error("No JSON object found.");
      return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
    }
  }

  function fallbackAgentExecutionPlan(issue: any, safeCandidates: any[], priorityBreakdown: ReturnType<typeof buildPriorityBreakdown>, error?: unknown): AgentExecutionPlan {
    const steps: AgentPlanStep[] = [
      {
        id: "context",
        tool: "get_local_context",
        why: "Ground severity and urgency with live local weather, sensitive amenities, and recurrence.",
        required: true,
      },
    ];
    if (safeCandidates.length > 0) {
      steps.push({
        id: "nearby",
        tool: "search_nearby_cases",
        why: "Expose server-loaded nearby cases before duplicate reasoning.",
        required: true,
      });
      steps.push({
        id: "compare",
        tool: "compare_candidate_evidence",
        why: "Use server-side embeddings and available vision evidence to decide whether a nearby case is the same physical issue.",
        required: true,
        dependsOn: ["nearby"],
      });
      steps.push({
        id: "merge",
        tool: "propose_merge",
        why: "Only if comparison is confident, create a pending human-approved merge action instead of merging automatically.",
        required: false,
        condition: "compare_candidate_evidence returns a confident duplicate",
        dependsOn: ["compare"],
      });
    }
    steps.push(
      {
        id: "authority",
        tool: "find_responsible_authority",
        why: "Validate the responsible authority against the local jurisdiction registry.",
        required: true,
      },
      {
        id: "draft",
        tool: "draft_action_packet",
        why: "Prepare a human-reviewable action packet for non-duplicate routing.",
        required: false,
        condition: "issue is not a confident duplicate",
        dependsOn: ["authority"],
      },
      {
        id: "approval",
        tool: "request_human_approval",
        why: "Consequential routing, merge, or closure recommendations require operator approval.",
        required: true,
      },
      {
        id: "finish",
        tool: "record_event",
        why: "Persist the final route, deterministic priority score, and rationale.",
        required: true,
      },
    );
    if (issue?.closureAssessment) {
      steps.splice(steps.length - 2, 0, {
        id: "closure",
        tool: "verify_closure",
        why: "Closure evidence exists, so verify it before any final status recommendation.",
        required: true,
      });
    }
    return {
      summary: "Deterministic fallback plan generated because the planning model did not return a valid plan.",
      plannerModel: "deterministic-fallback",
      fallback: true,
      generatedAt: new Date().toISOString(),
      stopWhen: "record_event has persisted the route and rationale",
      priorityBreakdown,
      steps,
      rawStepCount: steps.length,
      error: error instanceof Error ? error.message : error ? String(error) : undefined,
    };
  }

  function sanitizeAgentExecutionPlan(parsed: any, plannerModel: string, safeCandidates: any[], priorityBreakdown: ReturnType<typeof buildPriorityBreakdown>) {
    const rawSteps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    const steps: AgentPlanStep[] = [];
    for (const raw of rawSteps) {
      const tool = cleanText(raw?.tool, "", 120);
      if (!AGENT_EXECUTION_TOOL_SET.has(tool)) continue;
      if (tool === "compare_candidate_evidence" && safeCandidates.length === 0) continue;
      const id = cleanText(raw?.id, `step_${steps.length + 1}`, 80) || `step_${steps.length + 1}`;
      steps.push({
        id,
        tool: tool as AgentExecutionToolName,
        why: cleanText(raw?.why, `Use ${tool} when evidence requires it.`, 500),
        required: raw?.required !== false,
        condition: cleanText(raw?.condition, "", 300) || null,
        dependsOn: Array.isArray(raw?.dependsOn)
          ? raw.dependsOn.map((item: unknown) => cleanText(item, "", 80)).filter(Boolean).slice(0, 5)
          : [],
      });
    }
    const hasRecordEvent = steps.some((step) => step.tool === "record_event");
    if (!hasRecordEvent) {
      steps.push({
        id: "finish",
        tool: "record_event",
        why: "Persist the final route and rationale.",
        required: true,
      });
    }
    if (!steps.length) throw new Error("Planner returned no allowed tools.");
    return {
      summary: cleanText(parsed?.summary, "Gemini generated a conditional execution plan for this issue.", 800),
      plannerModel,
      fallback: false,
      generatedAt: new Date().toISOString(),
      stopWhen: cleanText(parsed?.stopWhen, "record_event has persisted the route and rationale", 300),
      priorityBreakdown,
      steps,
      rawStepCount: rawSteps.length,
    } satisfies AgentExecutionPlan;
  }

  async function buildAgentExecutionPlan(
    aiClient: any,
    issue: any,
    safeCandidates: any[],
    priorityBreakdown: ReturnType<typeof buildPriorityBreakdown>,
    options: GeminiGenerateOptions = {},
  ): Promise<{ plan: AgentExecutionPlan; retried: boolean; durationMs: number }> {
    const plannerModel = geminiModels.planner;
    const startedAt = Date.now();
    const plannerPrompt = `Create a JSON execution plan for a CivicLens server-side triage agent.

Allowed tools, exactly as names:
${AGENT_EXECUTION_TOOL_NAMES.map((name) => `- ${name}`).join("\n")}

Rules:
- Do not include calculate_priority; deterministic priority is already provided as context.
- Include only tools justified by the issue state.
- Use conditional steps when a tool should run only after a prior result, for example propose_merge only after a confident duplicate.
- The runtime may execute more than one independent tool in a Gemini turn.
- The plan must finish with record_event once enough evidence exists.

Issue: ${JSON.stringify(issue)}
Nearby candidate count: ${safeCandidates.length}
Deterministic priority context: ${JSON.stringify(priorityBreakdown)}

Return strict JSON with:
{
  "summary": "one sentence",
  "stopWhen": "condition",
  "steps": [
    { "id": "short_id", "tool": "allowed_tool_name", "why": "reason", "required": true, "condition": "optional", "dependsOn": ["optional ids"] }
  ]
}`;
    try {
      const result = await generateContentWithRetry(aiClient, {
        model: plannerModel,
        contents: plannerPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              stopWhen: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    tool: { type: Type.STRING, enum: [...AGENT_EXECUTION_TOOL_NAMES] },
                    why: { type: Type.STRING },
                    required: { type: Type.BOOLEAN },
                    condition: { type: Type.STRING },
                    dependsOn: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ["id", "tool", "why", "required"],
                },
              },
            },
            required: ["summary", "stopWhen", "steps"],
          },
        },
      }, options);
      const parsed = parseJsonObject(result.response.text || "");
      const plan = sanitizeAgentExecutionPlan(parsed, plannerModel, safeCandidates, priorityBreakdown);
      return { plan, retried: result.retried, durationMs: Date.now() - startedAt };
    } catch (error) {
      return {
        plan: fallbackAgentExecutionPlan(issue, safeCandidates, priorityBreakdown, error),
        retried: false,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  function validateAuthorityAgainstRegistry(locationName: unknown, suggested: any) {
    const location = cleanText(locationName, "", 300).toLowerCase();
    const suggestion = cleanText(suggested?.authority, "", 240);
    const suggestionLower = suggestion.toLowerCase();
    const registryEntry = JURISDICTION_REGISTRY.find((entry) =>
      entry.keywords.some((keyword) => location.includes(keyword) || suggestionLower.includes(keyword))
    );
    if (!registryEntry) {
      return {
        authority: suggestion || "Municipal Corporation",
        sla: cleanNumber(suggested?.sla, 7, 1, 60),
        channel: cleanText(suggested?.channel, "Public grievance channel", 240),
        registryValidated: false,
        registryId: "generic_india_municipal",
        suggestedAuthority: suggestion || null,
        validationReason: "No precise city registry match; using generic municipal fallback for human review.",
      };
    }
    const aliasMatched = registryEntry.aliases.some((alias) => suggestionLower.includes(alias));
    return {
      authority: aliasMatched || !suggestion ? registryEntry.authority : suggestion,
      sla: cleanNumber(suggested?.sla, registryEntry.slaDays, 1, 60),
      channel: cleanText(suggested?.channel, registryEntry.channel, 240),
      registryValidated: aliasMatched || !suggestion,
      registryId: registryEntry.id,
      suggestedAuthority: suggestion || null,
      validationReason: aliasMatched || !suggestion
        ? "Authority matched the jurisdiction registry."
        : `Registry matched location; review suggested authority against ${registryEntry.authority}.`,
    };
  }

  async function compareCandidateEvidenceSignals(issueId: string, issue: any, safeCandidates: any[], requestedCandidateId: string, options: GeminiGenerateOptions = {}) {
    if (!safeCandidates.length) {
      return { candidateId: "none", similarity: null, reason: "No server-loaded nearby candidates were available." };
    }
    const candidateSet = new Set(safeCandidates.map((candidate) => candidate.id));
    const requestedSafe = requestedCandidateId && requestedCandidateId !== "none" && candidateSet.has(requestedCandidateId);
    if (requestedCandidateId && requestedCandidateId !== "none" && !requestedSafe) {
      return {
        candidateId: "none",
        similarity: null,
        rejected: true,
        reason: "Candidate id was not part of the server-loaded candidate set.",
      };
    }

    const queryEmbedding = Array.isArray(issue.embedding) && issue.embedding.length
      ? issue.embedding
      : await embedText(issueEmbeddingText(issue));
    const candidateDocs = await Promise.all(
      safeCandidates
        .filter((candidate) => !requestedSafe || candidate.id === requestedCandidateId)
        .slice(0, requestedSafe ? 1 : 5)
        .map(async (candidate) => {
          const snap = await adminDb.collection("issues").doc(candidate.id).get();
          return snap.exists ? { ...candidate, data: snap.data() || {} } : { ...candidate, data: {} };
        })
    );

    let best: any = null;
    for (const candidate of candidateDocs) {
      const data = candidate.data || {};
      let candidateEmbedding = Array.isArray(data.embedding) && data.embedding.length ? data.embedding : null;
      if (!candidateEmbedding) {
        candidateEmbedding = await embedText(issueEmbeddingText(data));
      }
      const semanticSimilarity = queryEmbedding && candidateEmbedding
        ? Math.round(cosineSim(queryEmbedding, candidateEmbedding) * 1000) / 1000
        : null;
      const distanceM = typeof candidate.distanceM === "number"
        ? candidate.distanceM
        : typeof issue.lat === "number" && typeof issue.lng === "number" && typeof data.lat === "number" && typeof data.lng === "number"
          ? Math.round(havMeters(issue.lat, issue.lng, data.lat, data.lng))
          : null;
      const categoryCompatible = data.category === issue.category || data.category === "other" || issue.category === "other";
      const score = semanticSimilarity ?? 0;
      if (!best || score > best.semanticSimilarity || (score === best.semanticSimilarity && (distanceM ?? 9999) < (best.distanceM ?? 9999))) {
        best = {
          id: candidate.id,
          title: data.title || candidate.title || candidate.id,
          semanticSimilarity,
          distanceM,
          categoryCompatible,
          issueImage: cleanText(issue.image, "", 1_200_000),
          candidateImage: cleanText(data.image, "", 1_200_000),
        };
      }
    }

    let vision: any = null;
    if (best?.issueImage && best?.candidateImage) {
      try {
        const issuePart = await imageSourceToInlinePart(best.issueImage, "agent-compare-issue-image");
        const candidatePart = await imageSourceToInlinePart(best.candidateImage, "agent-compare-candidate-image");
        if (issuePart && candidatePart) {
          const visionResult = await generateContentWithRetry(ai, {
            model: geminiModels.vision,
            contents: [
              { text: "Compare these two civic issue photos. Return whether they appear to show the same physical issue/location and a 0-1 visual similarity score. Return strict JSON only." },
              issuePart,
              candidatePart,
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  samePhysicalIssue: { type: Type.BOOLEAN },
                  visualSimilarity: { type: Type.NUMBER },
                  rationale: { type: Type.STRING },
                },
                required: ["samePhysicalIssue", "visualSimilarity", "rationale"],
              },
            },
          }, options);
          const parsedVision = parseJsonObject(visionResult.response.text || "");
          vision = {
            available: true,
            samePhysicalIssue: parsedVision.samePhysicalIssue === true,
            visualSimilarity: cleanNumber(parsedVision.visualSimilarity, 0, 0, 1),
            rationale: cleanText(parsedVision.rationale, "Gemini vision compared the two evidence images.", 500),
            retried: visionResult.retried,
          };
        }
      } catch (error: any) {
        vision = {
          available: false,
          error: cleanText(error?.message || String(error), "vision compare unavailable", 300),
        };
      }
    }

    if (!best) {
      return { candidateId: "none", similarity: null, reason: "No candidate evidence could be evaluated." };
    }
    const visualSimilarity = vision?.available ? vision.visualSimilarity : null;
    const combinedSimilarity = Math.round((((best.semanticSimilarity ?? 0) * 0.7) + ((visualSimilarity ?? best.semanticSimilarity ?? 0) * 0.3)) * 1000) / 1000;
    const duplicate = combinedSimilarity >= 0.85 && (best.distanceM == null || best.distanceM <= 50) && best.categoryCompatible !== false;
    return {
      candidateId: duplicate ? best.id : "none",
      evaluatedCandidateId: best.id,
      similarity: combinedSimilarity,
      semanticSimilarity: best.semanticSimilarity,
      visualSimilarity,
      distanceM: best.distanceM,
      categoryCompatible: best.categoryCompatible,
      method: "gemini_embedding_cosine_plus_optional_vision",
      embeddingAvailable: !!queryEmbedding,
      visionCompared: vision?.available === true,
      vision,
      threshold: { similarity: 0.85, distanceM: 50 },
      requiresHumanApproval: duplicate,
      reason: duplicate
        ? "Embedding/location signals meet duplicate threshold; merge must still be approved by a human operator."
        : "Candidate did not meet the embedding/location duplicate threshold.",
    };
  }

  async function persistAgentRun(issueRef: any, runRef: any, run: any, steps: any[], resolutionPlan: any, final: any, issueUpdates: Record<string, unknown> = {}) {
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
      ...issueUpdates,
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

  // ---- Phase 2: Autonomous SLA escalation worker -------------------------
  // Generates an escalation letter + RTI draft for ONE issue using real Gemini,
  // with an HONEST deterministic fallback (clearly labelled, never faked as AI).
  async function generateEscalationAndRti(issue: any): Promise<{ escalationLetter: string; rtiRequest: string; aiFallback: boolean }> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const ticketId = issue.id;
    try {
      const promptText = `Draft a public grievance escalation letter and a draft RTI request (Section 6(1), RTI Act 2005) for this unresolved civic complaint. For human review only; CivicLens does not submit anything.
Complaint Title: ${issue.title || issue.category || "Civic Grievance"}
Category: ${issue.category || "General"}
Context Summary: ${issue.summary || issue.description || "Unresolved civic problem"}
Location: ${issue.locationName || "India"}
Recommended Initial Department: ${issue.resolutionPlan?.recommendedAuthority || "Municipal Corporation"}
Prototype ticket ID: ${ticketId}
Date: ${todayStr}
Use ONLY the real ticketId and date above; never invent reference numbers or fake histories.
Return STRICT JSON: { "escalationLetter": "string", "rtiRequest": "string" }`;
      const result = await generateContentWithRetry(ai, {
        model: geminiModels.reasoning,
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.OBJECT, properties: { escalationLetter: { type: Type.STRING }, rtiRequest: { type: Type.STRING } }, required: ["escalationLetter", "rtiRequest"] },
        },
      });
      const txt = (result.response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(txt);
      return { escalationLetter: String(parsed.escalationLetter || ""), rtiRequest: String(parsed.rtiRequest || ""), aiFallback: false };
    } catch (err) {
      const letter = `To the Municipal Commissioner,\n\nThis is an escalation regarding an unresolved ${issue.category || "civic"} complaint (ref ${ticketId}) at ${issue.locationName || "the reported location"}, first reported on ${(issue.createdAt || "").slice(0, 10)}. Despite the elapsed follow-up window the issue remains open. We request urgent intervention.\n\n(Drafted by CivicLens for human review - AI generation unavailable.)`;
      const rti = `To the Public Information Officer,\n\nUnder Section 6(1) of the RTI Act 2005, please provide the current status, responsible officer details, file notes, and published timeframe for complaint ref ${ticketId} (${issue.category || "civic"}) at ${issue.locationName || "the location"}.\n\n(Drafted by CivicLens for human review - AI generation unavailable.)`;
      return { escalationLetter: letter, rtiRequest: rti, aiFallback: true };
    }
  }

  // Scans open issues and advances the idempotent SLA ladder one rung at a time:
  // reminder -> escalation draft -> RTI PDF -> first appeal draft.
  async function runSlaEscalationWorker(opts: { thresholdHours?: number; limit?: number; issueId?: string }) {
    const thresholdHours = Number.isFinite(opts.thresholdHours as number) ? Math.max(0, opts.thresholdHours as number) : undefined;
    const limit = Math.min(50, Math.max(1, opts.limit || 25));
    const nowMs = Date.now();
    let docs: any[] = [];
    if (opts.issueId) {
      const doc = await adminDb.collection("issues").doc(opts.issueId).get();
      docs = doc.exists ? [doc] : [];
    } else {
      const snap = await adminDb.collection("issues").where("status", "in", ["submitted", "verified", "in_progress"]).limit(limit).get();
      docs = snap.docs;
    }
    const details: any[] = [];
    let advanced = 0;
    let escalated = 0;
    let rtiPdfs = 0;
    let appeals = 0;
    for (const doc of docs) {
      const issue: any = { id: doc.id, ...doc.data() };
      const nowIso = new Date().toISOString();
      const baseFields = buildSlaIssueFields(issue, nowIso);
      const pending = nextPendingSlaStage({ ...issue, ...baseFields }, nowMs, thresholdHours);
      if (!pending) {
        if (!issue.slaDeadline || !issue.slaPolicy) {
          await doc.ref.set(baseFields, { merge: true });
        }
        details.push({ id: issue.id, action: "skip", reason: "next SLA ladder stage not due", slaDeadline: baseFields.slaDeadline });
        continue;
      }

      const ageHours = Math.max(0, Math.round(((nowMs - issueSlaStartMs(issue)) / 3600000) * 10) / 10);
      const ladder = {
        ...baseFields.slaLadder,
        currentStage: pending.stage,
        nextStage: nextStageAfter(pending.stage),
        updatedAt: nowIso,
      };
      const updateFields: any = {
        ...baseFields,
        slaLadder: ladder,
        updatedAt: nowIso,
      };
      let eventType = "sla_ladder_reminder";
      let message = `SLA worker recorded a reminder after ${ageHours}h open.`;
      let outputSummary = "SLA reminder recorded";
      let aiFallback: boolean | null = null;

      if (pending.stage === "reminder") {
        ladder.reminderAt = nowIso;
      } else if (pending.stage === "escalation") {
        const draft = await generateEscalationAndRti(issue);
        const existing = issue.escalation || {};
        updateFields.escalation = {
          ...existing,
          escalatedAt: existing.escalatedAt || nowIso,
          autoDraftedAt: existing.autoDraftedAt || nowIso,
          escalationLetter: draft.escalationLetter || existing.escalationLetter || "",
          rtiRequest: draft.rtiRequest || existing.rtiRequest || "",
          escalationLevel: Math.max(cleanNumber(existing.escalationLevel, 0, 0, 9), 2),
          source: "sla-worker",
          aiFallback: draft.aiFallback,
          reason: `SLA ladder escalation: case open ${ageHours}h; policy ${pending.policy.slaHours}h for ${pending.policy.category}/severity ${pending.policy.severity}.`,
        };
        ladder.escalatedAt = nowIso;
        eventType = "sla_ladder_escalated";
        message = `SLA worker auto-drafted escalation and RTI text after ${ageHours}h open. Awaiting human review.`;
        outputSummary = "Escalation and RTI text drafted";
        aiFallback = draft.aiFallback;
        escalated++;
      } else if (pending.stage === "rti") {
        const existing = issue.escalation || {};
        let rtiRequest = cleanText(existing.rtiRequest, "", 8000);
        aiFallback = typeof existing.aiFallback === "boolean" ? existing.aiFallback : null;
        if (!rtiRequest) {
          const draft = await generateEscalationAndRti(issue);
          rtiRequest = draft.rtiRequest;
          aiFallback = draft.aiFallback;
        }
        const rtiPdf = buildRtiPdfArtifact(issue, rtiRequest, nowIso);
        updateFields.escalation = {
          ...existing,
          escalatedAt: existing.escalatedAt || nowIso,
          autoDraftedAt: existing.autoDraftedAt || nowIso,
          rtiRequest,
          rtiPdfDataUri: rtiPdf.dataUri,
          rtiPdfFilename: rtiPdf.filename,
          rtiPdfGeneratedAt: nowIso,
          rtiPdfBytes: rtiPdf.byteLength,
          escalationLevel: Math.max(cleanNumber(existing.escalationLevel, 0, 0, 9), 3),
          source: "sla-worker",
          aiFallback: aiFallback === null ? false : aiFallback,
          reason: existing.reason || `SLA ladder RTI draft: case open ${ageHours}h; policy ${pending.policy.slaHours}h.`,
        };
        ladder.rtiDraftedAt = nowIso;
        eventType = "sla_ladder_rti_pdf";
        message = `SLA worker generated a downloadable RTI PDF draft after ${ageHours}h open.`;
        outputSummary = "RTI PDF draft generated";
        rtiPdfs++;
      } else if (pending.stage === "first_appeal") {
        const existing = issue.escalation || {};
        const firstAppealLetter = buildFirstAppealDraft(issue, nowIso);
        updateFields.escalation = {
          ...existing,
          firstAppealLetter,
          firstAppealDraftedAt: nowIso,
          escalationLevel: Math.max(cleanNumber(existing.escalationLevel, 0, 0, 9), 4),
          source: "sla-worker",
          reason: existing.reason || `SLA ladder first appeal draft: case open ${ageHours}h; policy ${pending.policy.slaHours}h.`,
        };
        ladder.firstAppealDraftedAt = nowIso;
        eventType = "sla_ladder_first_appeal";
        message = `SLA worker drafted a first appeal text after ${ageHours}h open. Manual review is required before use.`;
        outputSummary = "First appeal draft generated";
        appeals++;
      }

      await doc.ref.set(updateFields, { merge: true });
      await addServerActivity(doc.ref, {
        actorType: "ai",
        eventType,
        message,
        timestamp: nowIso,
        byRole: "system",
      });
      advanced++;
      details.push({ id: issue.id, action: "advanced", stage: pending.stage, ageHours, dueAt: pending.dueAt, outputSummary, aiFallback });
    }
    await recordEvent({
      actorType: "worker",
      eventType: "worker_sla_completed",
      message: "SLA escalation worker completed.",
      source: "worker",
      byRole: "system",
      payload: { scanned: docs.length, advanced, escalated, rtiPdfs, appeals, thresholdHours: thresholdHours ?? null, issueId: opts.issueId || null, detailCount: details.length },
    });
    return { worker: "sla", scanned: docs.length, advanced, escalated: advanced, rtiPdfs, appeals, thresholdHours: thresholdHours ?? null, issueId: opts.issueId || null, details };
  }

  // Deterministic aggregates over all issues (math in code, never invented by the LLM).
  async function computeIssueAggregates() {
    const snap = await adminDb.collection("issues").limit(1000).get();
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const areaCategory: Record<string, number> = {};
    let total = 0, open = 0, resolved = 0, prioritySum = 0, priorityN = 0;
    for (const doc of snap.docs) {
      const i: any = doc.data(); total++;
      const status = String(i.status || "submitted");
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (status === "resolved") resolved++; else open++;
      const cat = String(i.category || "other").toLowerCase();
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      if (typeof i.priorityScore === "number") { prioritySum += i.priorityScore; priorityN++; }
      const parts = String(i.locationName || "").split(",").map((s) => s.trim()).filter(Boolean);
      const area = parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || "Unknown");
      areaCategory[`${area} | ${cat}`] = (areaCategory[`${area} | ${cat}`] || 0) + 1;
    }
    const hotspots = Object.entries(areaCategory)
      .map(([k, count]) => { const [area, category] = k.split(" | "); return { area, category, count }; })
      .sort((a, b) => b.count - a.count).slice(0, 8);
    return { total, open, resolved, avgPriority: priorityN ? Math.round((prioritySum / priorityN) * 10) / 10 : 0, byStatus, byCategory, hotspots };
  }

  // Predictive-insights worker: deterministic aggregation feeds a schema-constrained
  // Gemini forecast; persists to analytics/predictive; honest fallback on failure.
  async function runPredictiveInsightsWorker() {
    const aggregates = await computeIssueAggregates();
    let insight: any; let aiFallback = false;
    try {
      const prompt = `You are a civic operations analyst. From these REAL aggregated civic-issue statistics, produce a short forward-looking briefing. Use ONLY the data provided; never invent specific numbers.
Data: ${JSON.stringify(aggregates)}
Return STRICT JSON: { "summary": "2-3 sentences", "predictedHotspots": [{"area":"string","category":"string","riskLevel":"low|medium|high","rationale":"string"}], "priorityCategories": ["string"], "recommendedActions": ["string"] }`;
      const result = await generateContentWithRetry(ai, {
        model: geminiModels.reasoning, contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: {
          summary: { type: Type.STRING },
          predictedHotspots: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { area: { type: Type.STRING }, category: { type: Type.STRING }, riskLevel: { type: Type.STRING }, rationale: { type: Type.STRING } }, required: ["area", "category", "riskLevel"] } },
          priorityCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
        }, required: ["summary", "predictedHotspots", "priorityCategories", "recommendedActions"] } },
      });
      const txt = (result.response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      insight = JSON.parse(txt);
    } catch (err: any) {
      console.warn("predictive worker: Gemini forecast unavailable, using deterministic fallback:", err?.message || err);
      aiFallback = true;
      const topCats = Object.entries(aggregates.byCategory).sort((a: any, b: any) => b[1] - a[1]).map(([c]) => c);
      insight = {
        summary: `Tracking ${aggregates.total} issues (${aggregates.open} open, ${aggregates.resolved} resolved). Highest activity in ${topCats.slice(0, 2).join(" and ") || "various categories"}. (AI forecast unavailable - deterministic summary.)`,
        predictedHotspots: aggregates.hotspots.slice(0, 5).map((h) => ({ area: h.area, category: h.category, riskLevel: h.count >= 2 ? "high" : "medium", rationale: `${h.count} report(s) in ${h.area} for ${h.category}.` })),
        priorityCategories: topCats.slice(0, 3),
        recommendedActions: ["Prioritize categories with repeat reports", "Inspect recurring hotspots proactively"],
      };
    }
    const generatedAt = new Date().toISOString();
    await adminDb.collection("analytics").doc("predictive").set({ generatedAt, aggregates, insight, model: aiFallback ? "deterministic-fallback" : geminiModels.reasoning, aiFallback }, { merge: true });
    await recordEvent({
      actorType: "worker",
      eventType: "worker_predictive_completed",
      message: "Predictive insights worker completed.",
      timestamp: generatedAt,
      source: "worker",
      byRole: "system",
      payload: {
        aiFallback,
        total: aggregates.total,
        open: aggregates.open,
        resolved: aggregates.resolved,
        hotspots: insight.predictedHotspots?.length || 0,
      },
    });
    return { worker: "predict", generatedAt, aiFallback, hotspots: insight.predictedHotspots?.length || 0 };
  }

  // Follow-up sentinel: an autonomous LLM control loop. For each open case it
  // reads the chronological timeline + elapsed time and decides the single best
  // next action (wait / escalate / request_evidence / ready_to_close), persists
  // the decision + reasoning, and logs it. Deterministic fallback on AI failure.
  async function runFollowUpSentinel(opts: { limit?: number }) {
    const limit = Math.min(25, Math.max(1, opts.limit || 15));
    const nowMs = Date.now();
    const snap = await adminDb.collection("issues").where("status", "in", ["submitted", "verified", "in_progress"]).limit(limit).get();
    const ACTIONS = ["wait", "escalate", "request_evidence", "ready_to_close"];
    const details: any[] = [];
    for (const doc of snap.docs) {
      const issue: any = { id: doc.id, ...doc.data() };
      const createdMs = Date.parse(issue.createdAt || issue.triagedAt || "");
      const ageHours = Number.isFinite(createdMs) ? Math.round((nowMs - createdMs) / 3600000) : null;
      let timeline: string[] = [];
      try {
        const actSnap = await doc.ref.collection("activity").get();
        timeline = actSnap.docs.map((d: any) => d.data())
          .sort((a: any, b: any) => String(a.timestamp).localeCompare(String(b.timestamp)))
          .slice(-8).map((a: any) => `${a.timestamp}: [${a.actorType}] ${a.message}`);
      } catch { /* timeline best-effort */ }
      const ctx = {
        status: issue.status, ageHours, category: issue.category, severity: issue.severity,
        priorityScore: issue.priorityScore, confirmCount: issue.confirmCount, citizenUpvotes: issue.citizenUpvotes,
        hasEscalation: !!issue.escalation, escalationLevel: issue.escalation?.escalationLevel || 0,
        hasClosureAssessment: !!issue.closureAssessment, timeline,
      };
      let decision: any; let aiFallback = false;
      try {
        const prompt = `You are CivicLens's autonomous follow-up sentinel for ONE open civic case. Read the context + chronological timeline and choose the single best NEXT action ONLY from: "wait" (progressing/too recent), "escalate" (stalled past a reasonable window), "request_evidence" (needs citizen/officer proof), "ready_to_close" (evidence indicates resolved; a human should confirm). Ground the decision in the timeline and elapsed time; never invent facts.
Context: ${JSON.stringify(ctx)}
Return STRICT JSON: { "action": "wait|escalate|request_evidence|ready_to_close", "reasoning": "one sentence grounded in the timeline/age", "confidence": 0.0 to 1.0 }`;
        const result = await generateContentWithRetry(ai, {
          model: geminiModels.cheapClassification, contents: prompt,
          config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { action: { type: Type.STRING }, reasoning: { type: Type.STRING }, confidence: { type: Type.NUMBER } }, required: ["action", "reasoning"] } },
        });
        const txt = (result.response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
        const parsed = JSON.parse(txt);
        const action = ACTIONS.includes(String(parsed.action)) ? parsed.action : "wait";
        decision = { action, reasoning: String(parsed.reasoning || "").slice(0, 500), confidence: typeof parsed.confidence === "number" ? parsed.confidence : null };
      } catch (err: any) {
        console.warn("follow-up sentinel: Gemini unavailable, deterministic fallback:", err?.message || err);
        aiFallback = true;
        const action = (ageHours != null && ageHours > 168 && !issue.escalation) ? "escalate" : "wait";
        decision = { action, reasoning: `Deterministic fallback: case open ${ageHours}h; escalation ${issue.escalation ? "present" : "absent"}.`, confidence: null };
      }
      const nowIso = new Date().toISOString();
      await doc.ref.set({ followUp: { ...decision, decidedAt: nowIso, aiFallback, source: "followup-sentinel" } }, { merge: true });
      await addServerActivity(doc.ref, {
        actorType: "ai", eventType: "followup_decision",
        message: `Follow-up sentinel decided: ${String(decision.action).toUpperCase()} - ${decision.reasoning}`,
        timestamp: nowIso, byRole: "system",
      });
      details.push({ id: issue.id, action: decision.action, ageHours, aiFallback });
    }
    await recordEvent({
      actorType: "worker",
      eventType: "worker_followup_completed",
      message: "Follow-up sentinel worker completed.",
      source: "worker",
      byRole: "system",
      payload: { scanned: snap.size, decisionCount: details.length },
    });
    return { worker: "followup", scanned: snap.size, decisions: details };
  }

  // ---- Phase 3: real external grounding (keyless public data) -------------
  // Grounds AI reasoning in real-world context: live weather (Open-Meteo),
  // nearby sensitive amenities (OpenStreetMap/Overpass), and historical
  // recurrence (Firestore). All sources fail gracefully (Promise.allSettled).
  async function fetchExternalGrounding(lat: number, lng: number, category: string, selfId?: string) {
    const out: any = { weather: null, nearbyAmenities: [], recurrence: null, sources: [], errors: [] };
    if (typeof lat !== "number" || typeof lng !== "number") { out.errors.push("no coordinates"); return out; }
    const hav = (la1: number, lo1: number, la2: number, lo2: number) => {
      const R = 6371000, toR = (d: number) => (d * Math.PI) / 180;
      const dLa = toR(la2 - la1), dLo = toR(lo2 - lo1);
      const a = Math.sin(dLa / 2) ** 2 + Math.cos(toR(la1)) * Math.cos(toR(la2)) * Math.sin(dLo / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    };
    await Promise.allSettled([
      (async () => {
        try {
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code,wind_speed_10m`, { signal: AbortSignal.timeout(6000) });
          const d: any = await r.json();
          if (d.current) out.weather = { temperatureC: d.current.temperature_2m, precipitationMm: d.current.precipitation, windKmh: d.current.wind_speed_10m, weatherCode: d.current.weather_code };
          out.sources.push("open-meteo");
        } catch (e: any) { out.errors.push("weather: " + (e?.message || e)); }
      })(),
      (async () => {
        try {
          const q = `[out:json][timeout:8];(node["amenity"~"school|hospital|clinic"](around:400,${lat},${lng});way["amenity"~"school|hospital|clinic"](around:400,${lat},${lng}););out center 12;`;
          const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(9000) });
          const d: any = await r.json();
          out.nearbyAmenities = (d.elements || []).filter((el: any) => el.tags?.amenity).slice(0, 8).map((el: any) => ({ type: el.tags.amenity, name: el.tags.name || null }));
          out.sources.push("overpass-osm");
        } catch (e: any) { out.errors.push("amenities: " + (e?.message || e)); }
      })(),
      (async () => {
        try {
          const snap = await adminDb.collection("issues").where("category", "==", category).limit(50).get();
          let near = 0;
          snap.docs.forEach((doc: any) => { if (doc.id === selfId) return; const i = doc.data(); if (typeof i.lat === "number" && typeof i.lng === "number" && hav(lat, lng, i.lat, i.lng) <= 1000) near++; });
          out.recurrence = { sameCategoryWithin1km: near };
          out.sources.push("firestore-history");
        } catch (e: any) { out.errors.push("recurrence: " + (e?.message || e)); }
      })(),
    ]);
    return out;
  }

  // Public grounding for an issue (open data).
  app.get("/api/issues/:issueId/grounding", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const { issueId } = req.params;
    if (!isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid issue id.");
    try {
      const doc = await adminDb.collection("issues").doc(issueId).get();
      if (!doc.exists) return sendApiError(res, 404, "Issue not found.");
      const i: any = doc.data();
      const grounding = await fetchExternalGrounding(i.lat, i.lng, i.category, doc.id);
      return res.json({ grounding });
    } catch (error) {
      return sendApiError(res, 500, "Failed to load grounding.", error);
    }
  });

  // ---- Phase 3: semantic duplicate detection (gemini-embedding-001 + cosine) --
  async function embedText(text: string): Promise<number[] | null> {
    try {
      const r: any = await ai.models.embedContent({ model: geminiModels.embedding, contents: text });
      const vals = r?.embeddings?.[0]?.values || r?.embedding?.values || (Array.isArray(r?.embeddings) ? r.embeddings[0] : null);
      return Array.isArray(vals) ? vals : null;
    } catch (e: any) {
      console.warn("embedText failed:", e?.message || e);
      return null;
    }
  }
  function cosineSim(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }
  function issueEmbeddingText(i: any): string {
    return `${i.category || ""} ${i.title || ""} ${i.summary || i.description || ""}`.trim();
  }
  function evidenceFingerprint(value: unknown): string {
    const text = cleanText(value, "", 1_200_000);
    return text ? createHash("sha256").update(text).digest("hex") : "";
  }
  function havMeters(la1: number, lo1: number, la2: number, lo2: number): number {
    const R = 6371000, toR = (d: number) => (d * Math.PI) / 180;
    const dLa = toR(la2 - la1), dLo = toR(lo2 - lo1);
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(toR(la1)) * Math.cos(toR(la2)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function geoHash7(lat: unknown, lng: unknown): string | null {
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
    let idx = 0, bit = 0, evenBit = true;
    let geohash = "";
    let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
    while (geohash.length < 7) {
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2;
        if (lng >= mid) { idx = idx * 2 + 1; lngMin = mid; } else { idx *= 2; lngMax = mid; }
      } else {
        const mid = (latMin + latMax) / 2;
        if (lat >= mid) { idx = idx * 2 + 1; latMin = mid; } else { idx *= 2; latMax = mid; }
      }
      evenBit = !evenBit;
      if (++bit === 5) {
        geohash += base32.charAt(idx);
        bit = 0;
        idx = 0;
      }
    }
    return geohash;
  }
  function nearbyGeoHash7Set(lat: number, lng: number): Set<string> {
    const delta = 0.00045; // roughly 50m latitude; enough to include adjacent geohash-7 cells near boundaries.
    const hashes = new Set<string>();
    for (const latDelta of [-delta, 0, delta]) {
      for (const lngDelta of [-delta, 0, delta]) {
        const hash = geoHash7(lat + latDelta, lng + lngDelta);
        if (hash) hashes.add(hash);
      }
    }
    return hashes;
  }
  async function findAutoMergeCandidate(issue: any, queryEmbedding: number[], excludeIssueId: string) {
    if (typeof issue.lat !== "number" || typeof issue.lng !== "number") return null;
    const candidateHashes = nearbyGeoHash7Set(issue.lat, issue.lng);
    const issueEvidenceFingerprint = evidenceFingerprint(issue.image);
    const snap = await adminDb.collection("issues").limit(500).get();
    let best: any = null;
    for (const doc of snap.docs) {
      if (doc.id === excludeIssueId) continue;
      const candidate = doc.data();
      const status = normalizeIssueStatus(candidate.status);
      if (!["submitted", "verified", "in_progress", "reopened"].includes(status)) continue;
      if (!Array.isArray(candidate.embedding)) continue;
      if (typeof candidate.lat !== "number" || typeof candidate.lng !== "number") continue;
      const candidateHash = cleanText(candidate.geohash7, "", 16) || geoHash7(candidate.lat, candidate.lng);
      if (!candidateHash || !candidateHashes.has(candidateHash)) continue;
      const distanceM = Math.round(havMeters(issue.lat, issue.lng, candidate.lat, candidate.lng));
      if (distanceM > 50) continue;
      const embeddingSimilarity = cosineSim(queryEmbedding, candidate.embedding);
      const sameEvidenceImage = !!issueEvidenceFingerprint && issueEvidenceFingerprint === evidenceFingerprint(candidate.image);
      const similarity = Math.round(Math.max(embeddingSimilarity, sameEvidenceImage ? 0.985 : 0) * 1000) / 1000;
      const categoryCompatible = candidate.category === issue.category || candidate.category === "other" || issue.category === "other";
      if (similarity < 0.85 || (!categoryCompatible && similarity < 0.93)) continue;
      if (!best || similarity > best.similarity || (similarity === best.similarity && distanceM < best.distanceM)) {
        best = {
          id: doc.id,
          data: candidate,
          similarity,
          distanceM,
          geohash7: candidateHash,
          sameEvidenceImage,
        };
      }
    }
    return best;
  }
  // Backfill embeddings for issues missing them.
  async function runEmbedBackfill(opts: { limit?: number }) {
    const limit = Math.min(100, Math.max(1, opts.limit || 50));
    const snap = await adminDb.collection("issues").limit(limit).get();
    let embedded = 0, skipped = 0;
    for (const doc of snap.docs) {
      const i: any = doc.data();
      if (Array.isArray(i.embedding) && i.embedding.length) { skipped++; continue; }
      const v = await embedText(issueEmbeddingText(i));
      if (v) { await doc.ref.set({ embedding: v }, { merge: true }); embedded++; }
    }
    await recordEvent({
      actorType: "worker",
      eventType: "worker_embed_completed",
      message: "Embedding backfill worker completed.",
      source: "worker",
      byRole: "system",
      payload: { scanned: snap.size, embedded, skipped },
    });
    return { worker: "embed", scanned: snap.size, embedded, skipped };
  }

  // Semantic duplicate detection over existing issues (RAG-style cosine + geo).
  app.post("/api/dedup/semantic", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor) return sendApiError(res, 401, "Firebase ID token is required.");
    const text = cleanText(req.body?.text, "", 1000);
    const lat = typeof req.body?.lat === "number" ? req.body.lat : null;
    const lng = typeof req.body?.lng === "number" ? req.body.lng : null;
    const threshold = typeof req.body?.threshold === "number" ? req.body.threshold : 0.85;
    const maxDistanceM = typeof req.body?.maxDistanceM === "number" ? Math.max(1, Math.min(250, req.body.maxDistanceM)) : 50;
    const geohashes = lat != null && lng != null ? nearbyGeoHash7Set(lat, lng) : null;
    if (!text) return sendApiError(res, 400, "text is required.");
    const qv = await embedText(text);
    if (!qv) return sendApiError(res, 502, "Embedding service unavailable.");
    try {
      const snap = await adminDb.collection("issues").limit(300).get();
      const matches: any[] = [];
      snap.docs.forEach((doc: any) => {
        const i = doc.data();
        if (!Array.isArray(i.embedding)) return;
        const candidateHash = cleanText(i.geohash7, "", 16) || geoHash7(i.lat, i.lng);
        if (geohashes && (!candidateHash || !geohashes.has(candidateHash))) return;
        const similarity = Math.round(cosineSim(qv, i.embedding) * 1000) / 1000;
        let distanceM: number | null = null;
        if (lat != null && lng != null && typeof i.lat === "number" && typeof i.lng === "number") distanceM = Math.round(havMeters(lat, lng, i.lat, i.lng));
        matches.push({ id: doc.id, title: i.title, category: i.category, similarity, distanceM, geohash7: candidateHash || null });
      });
      matches.sort((a, b) => b.similarity - a.similarity);
      const duplicates = matches.filter((m) => m.similarity >= threshold && (m.distanceM == null || m.distanceM <= maxDistanceM));
      return res.json({ query: text, threshold, maxDistanceM, topMatches: matches.slice(0, 5), duplicates });
    } catch (error) {
      return sendApiError(res, 500, "Semantic dedup failed.", error);
    }
  });

  // Latest predictive insight (open analytics, publicly readable).
  app.get("/api/insights/predictive", async (_req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    try {
      const doc = await adminDb.collection("analytics").doc("predictive").get();
      return res.json(doc.exists ? doc.data() : { insight: null });
    } catch (error) {
      return sendApiError(res, 500, "Failed to load predictive insight.", error);
    }
  });

  // Public community leaderboard (anonymized handles, no uids).
  app.get("/api/leaderboard", async (_req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    try {
      const snap = await adminDb.collection("profiles").orderBy("points", "desc").limit(10).get();
      const leaders = snap.docs.map((d: any, i: number) => {
        const p: any = d.data();
        return {
          rank: i + 1,
          handle: p.handle || "Civic Hero",
          points: p.points || 0,
          level: p.level || 1,
          badges: p.badges || [],
          reportCount: p.reportCount || 0,
          verifyCount: p.verifyCount || 0,
          trustScore: typeof p.trustScore === "number" ? p.trustScore : computeTrustScore(p),
        };
      });
      return res.json({ leaders });
    } catch (error) {
      return sendApiError(res, 500, "Failed to load leaderboard.", error);
    }
  });

  // Current user's gamification profile.
  app.get("/api/profile", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    if (!actor) return sendApiError(res, 401, "Firebase ID token is required.");
    try {
      const doc = await adminDb.collection("profiles").doc(actor.uid).get();
      const p: any = doc.exists ? doc.data() : { points: 0, level: 1, badges: [], reportCount: 0, supportCount: 0, verifyCount: 0 };
      if (typeof p.trustScore !== "number") p.trustScore = computeTrustScore(p, actor.role);
      delete p.uid;
      return res.json({ profile: p });
    } catch (error) {
      return sendApiError(res, 500, "Failed to load profile.", error);
    }
  });

  // Auth-gated job runner. In production a Cloud Scheduler -> Cloud Run job (or a
  // shared CIVICLENS_JOB_SECRET header) invokes this; operators may trigger it too.
  app.post("/api/jobs/run", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const actor = req.actor as RequestActor | undefined;
    const jobSecret = process.env.CIVICLENS_JOB_SECRET || "";
    const secretOk = !!jobSecret && req.headers["x-civiclens-job-secret"] === jobSecret;
    const operatorOk = !!actor && (actor.isRealOperator || actor.isDemoOperator);
    if (!secretOk && !operatorOk) return sendApiError(res, 403, "Job runner requires an operator session or a valid job secret.");
    const worker = String(req.query.worker || req.body?.worker || "").toLowerCase();
    const workerActorType: EventActorType = secretOk && !operatorOk ? "worker" : "operator";
    await recordEvent({
      actorType: workerActorType,
      eventType: "worker_job_requested",
      message: `Worker job requested: ${worker || "unknown"}.`,
      actor,
      byRole: secretOk && !operatorOk ? "system" : actor?.role,
      source: "worker",
      status: "attempted",
      payload: { worker, secretAuthenticated: secretOk, operatorAuthenticated: operatorOk },
    });
    const sendWorkerResult = async (result: any) => {
      await recordEvent({
        actorType: "worker",
        eventType: "worker_job_completed",
        message: `Worker job completed: ${result.worker || worker}.`,
        actor,
        byRole: secretOk && !operatorOk ? "system" : actor?.role,
        source: "worker",
        status: "succeeded",
        payload: result,
      });
      return res.json({ success: true, ...result });
    };
    try {
      if (worker === "sla") {
        const result = await runSlaEscalationWorker({
          thresholdHours: Number(req.body?.thresholdHours),
          limit: Number(req.body?.limit),
          issueId: isSafeDocumentId(req.body?.issueId) ? req.body.issueId : undefined,
        });
        return sendWorkerResult(result);
      }
      if (worker === "predict") {
        const result = await runPredictiveInsightsWorker();
        return sendWorkerResult(result);
      }
      if (worker === "followup") {
        const result = await runFollowUpSentinel({ limit: Number(req.body?.limit) });
        return sendWorkerResult(result);
      }
      if (worker === "embed") {
        const result = await runEmbedBackfill({ limit: Number(req.body?.limit) });
        return sendWorkerResult(result);
      }
      await recordEvent({
        actorType: workerActorType,
        eventType: "worker_job_failed",
        message: `Unknown worker requested: ${worker || "unknown"}.`,
        actor,
        byRole: secretOk && !operatorOk ? "system" : actor?.role,
        source: "worker",
        status: "failed",
        severity: "warn",
        payload: { worker },
      });
      return sendApiError(res, 400, `Unknown worker: "${worker}". Supported: sla, predict, followup, embed.`);
    } catch (error: any) {
      await recordEvent({
        actorType: workerActorType,
        eventType: "worker_job_failed",
        message: `Worker job failed: ${worker || "unknown"}.`,
        actor,
        byRole: secretOk && !operatorOk ? "system" : actor?.role,
        source: "worker",
        status: "failed",
        severity: "error",
        payload: { worker, error: error?.message || String(error) },
      });
      return sendApiError(res, 500, "Job runner failed.", error);
    }
  });

  // ---- Phase 4: Open311 GeoReport v2 export (municipal interoperability) ----
  const OPEN311_SERVICE_CODES: Record<string, { code: string; name: string }> = {
    pothole: { code: "POTHOLE", name: "Pothole / Road Damage" },
    water_leak: { code: "WATER_LEAK", name: "Water Leak / Pipeline" },
    streetlight: { code: "STREETLIGHT", name: "Street Light Outage" },
    waste: { code: "SANITATION", name: "Garbage / Sanitation" },
    garbage: { code: "SANITATION", name: "Garbage / Sanitation" },
    drainage: { code: "DRAIN_SEWER", name: "Drain / Sewerage" },
  };
  function toOpen311(issue: any) {
    const key = String(issue.category || "").toLowerCase().trim();
    const map = OPEN311_SERVICE_CODES[key] || { code: "OTHER", name: key ? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Other Civic Issue" };
    const req: any = {
      service_request_id: issue.id,
      status: issue.status === "resolved" ? "closed" : "open",
      service_name: map.name,
      service_code: map.code,
      description: issue.summary || issue.description || issue.title || "",
      requested_datetime: issue.createdAt || undefined,
      updated_datetime: issue.resolvedAt || issue.workStartedAt || issue.triagedAt || issue.createdAt || undefined,
      address: issue.locationName || undefined,
      lat: typeof issue.lat === "number" ? issue.lat : undefined,
      long: typeof issue.lng === "number" ? issue.lng : undefined,
      agency_responsible: issue.resolutionPlan?.recommendedAuthority || undefined,
      priority_score: typeof issue.priorityScore === "number" ? issue.priorityScore : undefined,
    };
    Object.keys(req).forEach((k) => req[k] === undefined && delete req[k]);
    return req;
  }
  // Bulk open-data export in Open311 GeoReport v2 shape (publicly readable civic data).
  app.get("/api/export/open311", async (_req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    try {
      const snap = await adminDb.collection("issues").limit(500).get();
      const out = snap.docs.map((d: any) => toOpen311({ id: d.id, ...d.data() }));
      return res.json({ service_requests: out, count: out.length, format: "open311-georeport-v2" });
    } catch (error) {
      return sendApiError(res, 500, "Open311 export failed.", error);
    }
  });
  // Single-issue Open311 export.
  app.get("/api/issues/:issueId/open311", async (req: any, res) => {
    if (!adminDb) return sendApiError(res, 503, "Server data layer unavailable.");
    const { issueId } = req.params;
    if (!isSafeDocumentId(issueId)) return sendApiError(res, 400, "Invalid issue id.");
    try {
      const doc = await adminDb.collection("issues").doc(issueId).get();
      if (!doc.exists) return sendApiError(res, 404, "Issue not found.");
      return res.json({ service_requests: [toOpen311({ id: doc.id, ...doc.data() })] });
    } catch (error) {
      return sendApiError(res, 500, "Open311 export failed.", error);
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
    const configuredAgentTimeoutMs = Number(process.env.CIVICLENS_AGENT_TIMEOUT_MS || 90_000);
    const agentTimeoutMs = Number.isFinite(configuredAgentTimeoutMs)
      ? Math.max(15_000, Math.min(180_000, configuredAgentTimeoutMs))
      : 90_000;
    const agentSignal = AbortSignal.timeout(agentTimeoutMs);
    const agentRunStartedAt = Date.now();
    const agentGeminiUsage = createGeminiUsageAccumulator();
    const agentGeminiOptions: GeminiGenerateOptions = {
      signal: agentSignal,
      usageAccumulator: agentGeminiUsage,
      onRetry: (retry) => {
        publishAgentStreamEvent(issueId, {
          type: "agent_retry",
          runId: runRef.id,
          message: "Gemini call retry scheduled.",
          retry,
        });
      },
    };

    try {
      const existingRun = await runRef.get();
      if (existingRun.exists) {
        const stepsSnap = await runRef.collection("steps").orderBy("order", "asc").get();
        await recordEvent({
          issueRef,
          actorType: "operator",
          eventType: "agent_run_reused",
          message: "Existing idempotent agent run returned.",
          actor,
          source: "api",
          status: "succeeded",
          idempotencyKey,
          payload: { runId: runRef.id, stepCount: stepsSnap.size },
        });
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
      const priorityBreakdown = buildPriorityBreakdown(issue, safeCandidates.length);
      publishAgentStreamEvent(issueId, {
        type: "agent_start",
        runId: runRef.id,
        message: "Server-side triage agent started.",
        model: geminiModels.reasoning,
        modelTiers: geminiModelTierSummary(),
        timeoutMs: agentTimeoutMs,
      });
      await recordEvent({
        issueRef,
        actorType: "ai",
        eventType: "agent_run_started",
        message: "Server-side triage agent run started.",
        actor,
        source: "agent",
        status: "attempted",
        idempotencyKey,
        payload: {
          runId: runRef.id,
          timeoutMs: agentTimeoutMs,
          nearbyCandidateCount: safeCandidates.length,
        },
      });
      const plannerResult = await buildAgentExecutionPlan(
        ai,
        issue,
        safeCandidates,
        priorityBreakdown,
        agentGeminiOptions,
      );
      const executionPlan = plannerResult.plan;

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
            name: "compare_candidate_evidence",
            description: "Use server-side embeddings, location, and available Gemini vision evidence to decide whether this issue duplicates a provided nearby candidate.",
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
            name: "propose_merge",
            description: "Create a server-side pending merge proposal that can only be executed after human operator approval.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                candidateId: { type: Type.STRING },
                similarity: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["candidateId", "reason"]
            }
          },
          {
            name: "find_responsible_authority",
            description: "Suggest and registry-validate the responsible municipal authority and typical follow-up window for this category and location.",
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
          },
          {
            name: "get_local_context",
            description: "Fetch real external context for this issue's location: live weather (Open-Meteo), nearby sensitive amenities like schools/hospitals (OpenStreetMap), and same-category recurrence within 1km. Use it to ground severity/priority (e.g. rain worsens flooding; a school nearby raises urgency).",
            parameters: { type: Type.OBJECT, properties: {} }
          }
        ]
      }];

      // Server-side tool implementations
      async function execTool(name: string, args: any) {
        if (name === "search_nearby_cases") {
          return { candidates: safeCandidates, radiusM: args.radiusM || 250 };
        }
        if (name === "get_local_context") {
          return await fetchExternalGrounding((issue as any).lat, (issue as any).lng, (issue as any).category, issueId);
        }
        if (name === "compare_candidate_evidence") {
          const candidateId = cleanText(args.candidateId, "none", 160);
          return await compareCandidateEvidenceSignals(issueId, issue, safeCandidates, candidateId, agentGeminiOptions);
        }
        if (name === "propose_merge") {
          const candidateId = cleanText(args.candidateId || duplicateCandidateId, "", 160);
          if (!candidateId || !safeCandidates.some((candidate) => candidate.id === candidateId)) {
            return {
              proposed: false,
              reason: "Merge proposal rejected because the target candidate was not in the server-loaded nearby candidate set.",
            };
          }
          const proposalId = `${issueId}_into_${candidateId}`;
          const nowIso = new Date().toISOString();
          const proposal = {
            id: proposalId,
            sourceIssueId: issueId,
            targetIssueId: candidateId,
            status: "pending_human_approval",
            similarity: cleanNumber(args.similarity ?? duplicateSimilarity, 0, 0, 1),
            reason: cleanText(args.reason || duplicateReasoning, "Agent proposed merge for operator review.", 1000),
            createdAt: nowIso,
            createdBy: "agent.propose_merge",
            executableAction: {
              type: "merge_into_canonical",
              approvalRequired: true,
              approveEndpoint: `/api/issues/${issueId}/merge-proposals/${proposalId}/approve`,
            },
          };
          await issueRef.collection("mergeProposals").doc(proposalId).set(proposal, { merge: true });
          await recordEvent({
            issueRef,
            actorType: "ai",
            eventType: "merge_proposed",
            message: "Agent created a pending merge proposal for human approval.",
            actor,
            source: "agent",
            status: "succeeded",
            idempotencyKey,
            payload: {
              runId: runRef.id,
              proposalId,
              sourceIssueId: issueId,
              targetIssueId: candidateId,
              similarity: proposal.similarity,
            },
          });
          return {
            proposed: true,
            proposalId,
            status: proposal.status,
            targetIssueId: candidateId,
            approvalRequired: true,
          };
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
              model: geminiModels.grounding,
              contents: searchPrompt,
              config: {
                tools: [{ googleSearch: {} }]
              }
            }, agentGeminiOptions);

            const responseText = (searchRes.response.text || "").trim();
            let cleanText = responseText;
            cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
            
            const jsonStart = cleanText.indexOf("{");
            const jsonEnd = cleanText.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) {
              cleanText = cleanText.slice(jsonStart, jsonEnd + 1);
            }
            
            const parsed = JSON.parse(cleanText);
            return validateAuthorityAgainstRegistry(args.locationName || issue.locationName, parsed);
          } catch (searchErr: any) {
            console.warn("find_responsible_authority grounded search failed, returning fallback:", searchErr);
            return validateAuthorityAgainstRegistry(args.locationName || issue.locationName, {
              authority: "Municipal Corporation",
              sla: 7,
              channel: "Public grievance channel",
            });
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
          const eventDoc = await recordEvent({
            issueRef,
            actorType: "ai",
            eventType: "agent_triage_completed",
            message: cleanText(args.rationale, "Agent triage completed.", 1000),
            actor,
            source: "agent",
            status: "succeeded",
            idempotencyKey,
            payload: {
              runId: runRef.id,
              routeTo: cleanText(args.routeTo, "", 160) || null,
              priorityScore: typeof args.priorityScore === "number" ? cleanNumber(args.priorityScore, 0, 0, 100) : null,
            },
          });
          return { recorded: !!eventDoc, eventType: "agent_triage_completed", eventId: eventDoc?.id || null };
        }
        return { error: `Unknown tool: ${name}` };
      }

      const steps: any[] = [{
        id: `${runRef.id}_1_planner`,
        runId: runRef.id,
        issueId,
        order: 1,
        step: "planner",
        tool: "agent.planner",
        status: executionPlan.fallback ? "fallback" : "done",
        inputDigest: `issue ${issueId}; ${safeCandidates.length} nearby candidate(s)`,
        outputSummary: `${executionPlan.steps.length} planned tool step(s): ${executionPlan.steps.map((step) => step.tool).join(", ")}`.slice(0, 300),
        durationMs: plannerResult.durationMs,
        ts: executionPlan.generatedAt,
        rationale: executionPlan.summary,
        reasoning: executionPlan.summary,
        model: executionPlan.plannerModel,
        retried: plannerResult.retried,
        plannedTools: executionPlan.steps.map((step) => step.tool),
        priorityBreakdown,
        sources: [],
      }];
      publishAgentStreamEvent(issueId, {
        type: "agent_step",
        runId: runRef.id,
        message: "Planner step persisted.",
        step: steps[0],
      });
      await recordEvent({
        issueRef,
        actorType: "ai",
        eventType: executionPlan.fallback ? "agent_plan_fallback" : "agent_plan_created",
        message: executionPlan.fallback ? "Agent planner fell back to deterministic execution plan." : "Gemini planner created a conditional execution plan.",
        actor,
        source: "agent",
        status: executionPlan.fallback ? "failed" : "succeeded",
        severity: executionPlan.fallback ? "warn" : "info",
        idempotencyKey,
        payload: {
          runId: runRef.id,
          plannerModel: executionPlan.plannerModel,
          plannedTools: executionPlan.steps.map((step) => step.tool),
          priorityScore: priorityBreakdown.score,
          fallback: executionPlan.fallback,
        },
      });

      let contents: any[] = [{ role: "user", parts: [{ text:
        `You are CivicLens's autonomous server-side triage agent for ONE civic issue. There is NO fixed script: you decide which tools to call, in what order, and how many, based on the issue's actual state. Choose only the tools that the evidence justifies.

Goal: produce a defensible triage - detect duplicates, ground the priority, identify the responsible authority, and prepare a human-reviewable action draft - then finish by calling record_event with your routing decision and rationale, and stop.

Persisted execution plan:
${JSON.stringify(executionPlan)}

Deterministic priority breakdown (context only; not a tool):
${JSON.stringify(priorityBreakdown)}

Decision guidance (branch on evidence; do NOT blindly run every tool):
- ${safeCandidates.length} nearby candidate(s) are available. Call search_nearby_cases only if duplicate detection is warranted; if there are 0 candidates do NOT call compare_candidate_evidence.
- Follow the persisted execution plan unless new evidence from a tool justifies a deviation, and explain any deviation in your reasoning.
- If you find a confident duplicate, call propose_merge and request_human_approval; you may SKIP draft_action_packet and instead record_event routing it as a merge that needs human approval.
- Call get_local_context to ground severity/priority in real-world conditions (live weather, nearby schools/hospitals, recurrence) before settling on a priority.
- Use the deterministic priority breakdown above for priorityScore; do not invent a new score.
- Call find_responsible_authority when you need the department/contact for a non-duplicate issue.
- Call draft_action_packet only for non-duplicate issues that need an outbound draft.
- Call request_human_approval for any consequential recommendation (merge, routing, closure).
- Call verify_closure ONLY if closure evidence already exists on the issue (closureAssessment present: ${issue.closureAssessment ? "yes" : "no"}).
- When you have enough to route, call record_event(routeTo, priorityScore, rationale) and stop.

You may call more than one independent tool in a turn when the plan and current evidence support it. Briefly state your reasoning before tool calls - it is recorded. Use only server-provided data and tools; never invent facts.

Issue: ${JSON.stringify(issue)}` }]}];

      let final: any = null;
      let guard = 0;

      let authority = "Municipal Corporation";
      let channel = "Public grievance channel";
      let slaDays = 7;

      let duplicateCandidateId: string | null = null;
      let duplicateSimilarity: number | null = null;
      let duplicateReasoning: string | null = null;
      let selfCritique: any = null;
      let issueForPlan: any = { ...issue };
      let agentIssueUpdates: Record<string, unknown> = { agentPlan: executionPlan };

      const MAX_AGENT_TURNS = 12; // safety backstop only; the model decides when to stop
      while (guard++ < MAX_AGENT_TURNS) {
        throwIfAborted(agentSignal);
        const t0 = Date.now();
        const { response, retried } = await generateContentWithRetry(ai, {
          model: geminiModels.reasoning,
          contents,
          config: { tools: agentTools }
        }, agentGeminiOptions);
        const turnReasoning = (response.text || "").trim();
        const calls = response.functionCalls || [];
        if (!calls.length) break;
        const functionResponses: any[] = [];
        let stopAfterTurn = false;
        contents.push({ role: "model", parts: calls.map((fc: any) => ({ functionCall: fc } as any)) });
        for (const fc of calls) {
          const toolStartedAt = Date.now();
          const result = await execTool(fc.name, fc.args || {});
          functionResponses.push({ functionResponse: { name: fc.name, response: { result } } } as any);

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
              duplicateReasoning = cleanText(result?.reason || fc.args?.reasoning, "", 1000) || null;
            }
          }

          const plannedIndex = executionPlan.steps.findIndex((step) => step.tool === fc.name);
          const stepId = `${runRef.id}_${steps.length + 1}_${fc.name}`;
          const stepRecord = {
            id: stepId,
            runId: runRef.id,
            issueId,
            order: steps.length + 1,
            step: fc.name,
            tool: `agent.${fc.name}`,
            status: result?.error ? "failed" : "done",
            inputDigest: JSON.stringify(fc.args).slice(0, 160),
            outputSummary: JSON.stringify(result).slice(0, 220),
            durationMs: Date.now() - toolStartedAt,
            modelTurnDurationMs: Date.now() - t0,
            ts: new Date().toISOString(),
            rationale: turnReasoning || fc.args?.reasoning || fc.args?.rationale || fc.args?.reason || `Called ${fc.name}`,
            reasoning: turnReasoning || null,
            model: geminiModels.reasoning,
            retried,
            turn: guard,
            planned: plannedIndex >= 0,
            planOrder: plannedIndex >= 0 ? plannedIndex + 1 : null,
            sources: fc.name === "search_nearby_cases"
              ? safeCandidates.map((candidate) => ({
                  title: candidate.title || candidate.id,
                  url: `firestore://issues/${candidate.id}`,
                  claimSupported: "Nearby candidate loaded by server search",
                  sourceType: "sourced",
                }))
              : [],
          };
          steps.push(stepRecord);
          publishAgentStreamEvent(issueId, {
            type: "agent_step",
            runId: runRef.id,
            message: `Agent executed ${fc.name}.`,
            step: stepRecord,
          });

          if (fc.name === "record_event") {
            final = {
              ...fc.args,
              priorityScore: typeof fc.args?.priorityScore === "number"
                ? cleanNumber(fc.args.priorityScore, 0, 0, 100)
                : priorityBreakdown.score,
            };
            stopAfterTurn = true;
          }
        }
        contents.push({ role: "user", parts: functionResponses });

        if (stopAfterTurn) break;
      }

      // The persisted trace reflects exactly the tools the agent chose to call,
      // in the order it called them - no forced canonical sequence, no padded
      // "skipped" rows. Two different issues produce two different, real traces.

      try {
        selfCritique = await runAgentSelfCritique(ai, issueForPlan, steps, final, agentGeminiOptions);
        const critiqueTs = new Date().toISOString();
        const critiqueStep = {
          id: `${runRef.id}_${steps.length + 1}_self_critique`,
          runId: runRef.id,
          issueId,
          order: steps.length + 1,
          step: "self_critique",
          tool: "agent.self_critique",
          status: "done",
          inputDigest: "QA review of category, severity, urgency, and actual trace",
          outputSummary: selfCritique.outputSummary,
          durationMs: selfCritique.durationMs,
          ts: critiqueTs,
          rationale: selfCritique.rationale,
          confidence: selfCritique.confidence,
          model: selfCritique.model || geminiModels.cheapClassification,
          retried: selfCritique.retried,
          qaAnomaly: selfCritique.anomaly,
          sources: [],
        };
        steps.push(critiqueStep);
        publishAgentStreamEvent(issueId, {
          type: "agent_step",
          runId: runRef.id,
          message: "Self-critique step persisted.",
          step: critiqueStep,
        });

        final = {
          ...(final || {}),
          priorityScore: selfCritique.priorityScore,
          selfCritique: {
            anomaly: selfCritique.anomaly,
            confidence: selfCritique.confidence,
            rationale: selfCritique.rationale,
          },
        };

        if (selfCritique.anomaly) {
          issueForPlan = {
            ...issueForPlan,
            category: selfCritique.correctedCategory,
            severity: selfCritique.correctedSeverity,
            urgency: selfCritique.correctedUrgency,
            priorityScore: selfCritique.priorityScore,
          };
          agentIssueUpdates = {
            ...agentIssueUpdates,
            category: selfCritique.correctedCategory,
            severity: selfCritique.correctedSeverity,
            urgency: selfCritique.correctedUrgency,
            qaAnomaly: {
              correctedAt: critiqueTs,
              correctedBy: "agent.self_critique",
              confidence: selfCritique.confidence,
              rationale: selfCritique.rationale,
            },
          };
        }

        await recordEvent({
          issueRef,
          actorType: "ai",
          eventType: selfCritique.anomaly ? "agent_self_critique_corrected" : "agent_self_critique_passed",
          message: selfCritique.anomaly ? "Agent self-critique corrected triage fields." : "Agent self-critique found no triage correction needed.",
          actor,
          source: "agent",
          status: "succeeded",
          idempotencyKey,
          payload: {
            runId: runRef.id,
            anomaly: selfCritique.anomaly,
            correctedCategory: selfCritique.correctedCategory,
            correctedSeverity: selfCritique.correctedSeverity,
            correctedUrgency: selfCritique.correctedUrgency,
            priorityScore: selfCritique.priorityScore,
            confidence: selfCritique.confidence,
          },
        });
      } catch (critiqueError: any) {
        const critiqueTs = new Date().toISOString();
        const critiqueStep = {
          id: `${runRef.id}_${steps.length + 1}_self_critique`,
          runId: runRef.id,
          issueId,
          order: steps.length + 1,
          step: "self_critique",
          tool: "agent.self_critique",
          status: "failed",
          inputDigest: "QA review of category, severity, urgency, and actual trace",
          outputSummary: "Self-critique unavailable; original triage retained",
          durationMs: 0,
          ts: critiqueTs,
          rationale: critiqueError?.message || String(critiqueError),
          model: geminiModels.cheapClassification,
          retried: false,
          sources: [],
        };
        steps.push(critiqueStep);
        publishAgentStreamEvent(issueId, {
          type: "agent_step",
          runId: runRef.id,
          message: "Self-critique step failed.",
          step: critiqueStep,
        });
        await recordEvent({
          issueRef,
          actorType: "ai",
          eventType: "agent_self_critique_failed",
          message: "Agent self-critique failed; original triage retained.",
          actor,
          source: "agent",
          status: "failed",
          severity: isAbortError(critiqueError) ? "warn" : "error",
          idempotencyKey,
          payload: { runId: runRef.id, error: critiqueError?.message || String(critiqueError) },
        });
        if (isAbortError(critiqueError)) {
          throw critiqueError;
        }
      }

      if (!final) {
        final = {
          routeTo: duplicateCandidateId ? "merge_review" : authority,
          priorityScore: priorityBreakdown.score,
          rationale: "Agent stopped before record_event; server persisted deterministic priority and manual-review route.",
        };
      } else if (typeof final.priorityScore !== "number") {
        final = {
          ...final,
          priorityScore: priorityBreakdown.score,
        };
      }

      // Generate the final rich resolution plan
      let resolutionPlan = null;
      try {
        const actionPacket = await generateActionPacket(ai, issueForPlan, authority, channel, slaDays, agentGeminiOptions);
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
            subject: `Draft Civic Grievance: ${issueForPlan.title || "Civic Incident"}`,
            body: `To the Commissioner / Officer,\n\nWe would like to share a civic grievance draft regarding ${issueForPlan.category} at ${issueForPlan.locationName || "the location"}.\nSummary: ${issueForPlan.summary || "No details provided."}\n\nPlease review and advise on next steps within the suggested follow-up window of ${slaDays} days.\n\nSincerely,\nCivicLens Prototype`,
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
      Object.assign(agentIssueUpdates, buildSlaIssueFields({ ...issueForPlan, resolutionPlan }, nowIso));
      const geminiUsage = snapshotGeminiUsage(agentGeminiUsage);
      const run = {
        id: runRef.id,
        issueId,
        status: "completed",
        startedAt: steps[0]?.ts || nowIso,
        completedAt: nowIso,
        model: geminiModels.reasoning,
        modelTiers: geminiModelTierSummary(),
        actorUid: actor.uid,
        actorRole: actor.role,
        duplicateCandidateId,
        duplicateSimilarity,
        duplicateReasoning,
        planner: executionPlan,
        priorityBreakdown,
        selfCritique,
        final,
        resolutionPlan,
        stepCount: steps.length,
        timeoutMs: agentTimeoutMs,
        geminiUsage,
      };

      await persistAgentRun(issueRef, runRef, run, steps, resolutionPlan, final, agentIssueUpdates);
      await recordEvent({
        issueRef,
        actorType: "ai",
        eventType: "agent_run_completed",
        message: "Server-side triage agent run completed and persisted.",
        actor,
        source: "agent",
        status: "succeeded",
        idempotencyKey,
        payload: {
          runId: runRef.id,
          plannerFallback: executionPlan.fallback,
          plannedToolCount: executionPlan.steps.length,
          stepCount: steps.length,
          duplicateCandidateId,
          duplicateSimilarity,
          priorityScore: typeof final?.priorityScore === "number" ? cleanNumber(final.priorityScore, 0, 0, 100) : null,
          finalRouteTo: cleanText(final?.routeTo, "", 160) || null,
          geminiCallCount: geminiUsage.geminiCallCount,
          geminiEstimatedCostUsd: geminiUsage.geminiEstimatedCostUsd,
        },
      });
      structuredLog("info", "agent_run_metric", {
        runId: runRef.id,
        issueId,
        status: "completed",
        durationMs: Date.now() - agentRunStartedAt,
        stepCount: steps.length,
        duplicateDetected: !!duplicateCandidateId,
        timeoutMs: agentTimeoutMs,
        actorRole: actor.role,
        ...geminiUsage,
      });
      publishAgentStreamEvent(issueId, {
        type: "agent_complete",
        runId: runRef.id,
        status: "completed",
        message: "Server-side triage agent run completed and persisted.",
        run,
        stepCount: steps.length,
        geminiUsage,
      });

      return res.json({
        success: true,
        run,
        steps,
        final,
        duplicateCandidateId,
        duplicateSimilarity,
        duplicateReasoning,
        agentPlan: executionPlan,
        priorityBreakdown,
        resolutionPlan
      });
    } catch (error: any) {
      console.error("Agent run error:", error);
      const timedOut = isAbortError(error);
      const geminiUsage = snapshotGeminiUsage(agentGeminiUsage);
      await recordEvent({
        issueRef,
        actorType: "ai",
        eventType: timedOut ? "agent_run_timed_out" : "agent_run_failed",
        message: timedOut ? "Server-side triage agent run timed out." : "Server-side triage agent run failed.",
        actor,
        source: "agent",
        status: "failed",
        severity: timedOut ? "warn" : "error",
        idempotencyKey,
        payload: {
          error: error?.message || String(error),
          timeoutMs: agentTimeoutMs,
          geminiCallCount: geminiUsage.geminiCallCount,
          geminiEstimatedCostUsd: geminiUsage.geminiEstimatedCostUsd,
        },
      });
      structuredLog(timedOut ? "warn" : "error", "agent_run_metric", {
        runId: runRef.id,
        issueId,
        status: timedOut ? "timed_out" : "failed",
        durationMs: Date.now() - agentRunStartedAt,
        timeoutMs: agentTimeoutMs,
        actorRole: actor.role,
        ...geminiUsage,
        error: safeLogText(error?.message || String(error)),
      });
      publishAgentStreamEvent(issueId, {
        type: "agent_complete",
        runId: runRef.id,
        status: timedOut ? "timed_out" : "failed",
        message: timedOut ? "Server-side triage agent run timed out." : "Server-side triage agent run failed.",
        error: safeLogText(error?.message || String(error)),
        geminiUsage,
      });
      return sendApiError(res, timedOut ? 504 : 500, timedOut ? "Agent run timed out before completing." : "An unexpected error occurred during the agent triage run.");
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

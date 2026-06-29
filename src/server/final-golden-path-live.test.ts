import http, { type Server } from "node:http";
import { writeFileSync } from "node:fs";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const runGoldenPath = process.env.CIVICLENS_FINAL_GOLDEN_PATH_TESTS === "true";
const describeGoldenPath = runGoldenPath ? describe : describe.skip;

interface AuthSession {
  idToken: string;
  localId: string;
}

interface ApiResult {
  response: Response;
  body: any;
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "demo-civiclens";
const baseUrl = (process.env.CIVICLENS_TEST_BASE_URL || "").replace(/\/$/, "");
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "";
const jobSecret = process.env.CIVICLENS_TEST_JOB_SECRET || process.env.CIVICLENS_JOB_SECRET || "";
const webhookPort = Number(process.env.CIVICLENS_TEST_WEBHOOK_PORT || 4576);
const summaryPath = process.env.CIVICLENS_FINAL_GOLDEN_PATH_SUMMARY_PATH || "";
const runPrefix = `golden_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let db: Firestore;
let webhookServer: Server | null = null;
const webhookDeliveries: any[] = [];

function jsonHeaders(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    ...extra,
  };
}

function actorHeaders(session: AuthSession) {
  return jsonHeaders({
    Authorization: `Bearer ${session.idToken}`,
    "x-civiclens-local-appcheck-bypass": "true",
  });
}

async function api(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || "GET",
    headers: init.headers || undefined,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

function expectOk(result: ApiResult, label: string) {
  expect(result.response.ok, `${label}: ${JSON.stringify(result.body).slice(0, 1200)}`).toBe(true);
}

async function signUpAnonymous(): Promise<AuthSession> {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const body: any = await response.json();
  expect(response.ok, JSON.stringify(body)).toBe(true);
  return { idToken: body.idToken, localId: body.localId };
}

async function signUpOperator(): Promise<AuthSession> {
  const email = `${runPrefix}@operators.test`;
  const password = `CivicLens-${Date.now()}!`;
  const signUp = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const created: any = await signUp.json();
  expect(signUp.ok, JSON.stringify(created)).toBe(true);
  await getAuth().setCustomUserClaims(created.localId, { operator: true });

  const signIn = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const refreshed: any = await signIn.json();
  expect(signIn.ok, JSON.stringify(refreshed)).toBe(true);
  return { idToken: refreshed.idToken, localId: refreshed.localId };
}

async function civicPotholePng(label: string, variant: "open" | "repaired" | "audit-open"): Promise<string> {
  const isOpen = variant !== "repaired";
  const background = isOpen ? "#374151" : "#475569";
  const patch = isOpen
    ? '<ellipse cx="330" cy="385" rx="150" ry="55" fill="#111827"/><ellipse cx="330" cy="380" rx="105" ry="30" fill="#030712"/>'
    : '<rect x="185" y="330" width="300" height="110" rx="24" fill="#1f2937"/><rect x="205" y="350" width="260" height="70" rx="16" fill="#6b7280"/>';
  const subtitle = isOpen ? "DEEP ROAD POTHOLE" : "REPAIRED ROAD SURFACE";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512">
    <rect width="768" height="512" fill="${background}"/>
    <path d="M0 380 C160 315 278 323 392 382 C514 445 632 443 768 388 L768 512 L0 512 Z" fill="#1f2937"/>
    <path d="M0 292 C140 256 300 254 462 296 C584 327 674 324 768 294" fill="none" stroke="#f9fafb" stroke-width="18" stroke-dasharray="54 40" opacity="0.8"/>
    ${patch}
    <polygon points="100,410 132,410 116,338" fill="#f97316"/><rect x="88" y="410" width="56" height="14" fill="#fed7aa"/>
    <polygon points="585,424 620,424 602,345" fill="#f97316"/><rect x="572" y="424" width="62" height="16" fill="#fed7aa"/>
    <text x="384" y="82" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" fill="#ffffff">${label}</text>
    <text x="384" y="134" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800" fill="#fde68a">${subtitle}</text>
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function readEventSummary(issueId: string) {
  const snap = await db.collection("issues").doc(issueId).collection("events").get();
  const types = snap.docs.map((doc) => String(doc.get("eventType") || ""));
  const issueGeminiCount = snap.docs.filter((doc) => String(doc.get("source") || "") === "gemini").length;
  const topGeminiSnap = await db.collection("events").where("source", "==", "gemini").get();
  const topGeminiTypes = topGeminiSnap.docs.map((doc) => String(doc.get("eventType") || ""));
  return { eventCount: snap.size, types, issueGeminiCount, topGeminiCount: topGeminiSnap.size, topGeminiTypes };
}

describeGoldenPath("final golden path live API verification", () => {
  beforeAll(async () => {
    if (!baseUrl) throw new Error("CIVICLENS_TEST_BASE_URL is required.");
    if (!authHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST is required.");
    if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
    if (!jobSecret) throw new Error("CIVICLENS_TEST_JOB_SECRET or CIVICLENS_JOB_SECRET is required.");
    if (!getApps().length) initializeApp({ projectId });
    db = getFirestore();
    webhookServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          webhookDeliveries.push(JSON.parse(raw || "{}"));
        } catch {
          webhookDeliveries.push({ raw });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, received: true }));
      });
    });
    await new Promise<void>((resolve, reject) => {
      webhookServer?.once("error", reject);
      webhookServer?.listen(webhookPort, "127.0.0.1", () => resolve());
    });
  }, 30_000);

  afterAll(async () => {
    if (webhookServer) {
      await new Promise<void>((resolve) => webhookServer?.close(() => resolve()));
      webhookServer = null;
    }
  });

  it("runs report to triage, merge, route, dispatch, ghost reopen, resolve, dashboard, and Open311", async () => {
    const citizen = await signUpAnonymous();
    const operator = await signUpOperator();
    const openImage = await civicPotholePng("CIVIC REPORT", "open");
    const repairedImage = await civicPotholePng("CLOSURE EVIDENCE", "repaired");
    const auditOpenImage = await civicPotholePng("FIELD AUDIT", "audit-open");

    const analyze = await api("/api/analyze-report", {
      method: "POST",
      headers: actorHeaders(citizen),
      body: {
        image: openImage,
        description: "Large dangerous pothole beside the HSR Layout bus stop causing two wheelers to swerve.",
      },
    });
    expectOk(analyze, "analyze-report");
    expect(analyze.body.success).toBe(true);
    expect(analyze.body.data?.isCivicIssue, JSON.stringify(analyze.body.data)).not.toBe(false);

    const baseId = `${runPrefix}_base`;
    const duplicateId = `${runPrefix}_dupe`;
    const createBase = await api("/api/issues/create", {
      method: "POST",
      headers: actorHeaders(citizen),
      body: {
        idempotencyKey: baseId,
        imageUrl: openImage,
        category: analyze.body.data.category || "pothole",
        title: analyze.body.data.title || "Large pothole beside HSR Layout bus stop",
        summary: analyze.body.data.summary || "Large pothole beside the HSR Layout bus stop causing traffic risk.",
        description: "Large pothole beside the HSR Layout bus stop causing two wheelers to swerve during peak traffic.",
        lat: 12.9112,
        lng: 77.6385,
        locationName: "24th Main, HSR Layout Sector 2, Bengaluru",
        severity: Math.max(3, Number(analyze.body.data.severity || 4)),
        urgency: analyze.body.data.urgency === "urgent" ? "urgent" : "priority",
        affectedArea: analyze.body.data.affectedArea || "street",
        visibleHazards: analyze.body.data.visibleHazards || ["pothole", "traffic hazard"],
        privacyFlags: analyze.body.data.privacyFlags || [],
        confidence: Math.max(0.8, Number(analyze.body.data.confidence || 0.9)),
      },
    });
    expectOk(createBase, "create-base");
    expect(createBase.body.autoMerged).toBe(false);
    const issueId = createBase.body.data.id;

    const createDuplicate = await api("/api/issues/create", {
      method: "POST",
      headers: actorHeaders(citizen),
      body: {
        idempotencyKey: duplicateId,
        imageUrl: openImage,
        category: "pothole",
        title: "Large pothole near HSR Layout bus stop",
        summary: "Large pothole near the HSR Layout bus stop forcing two wheelers to swerve.",
        description: "Large pothole near the HSR Layout bus stop forcing two wheelers to swerve during traffic.",
        lat: 12.91128,
        lng: 77.63858,
        locationName: "24th Main, HSR Layout Sector 2, Bengaluru",
        severity: 4,
        urgency: "priority",
        affectedArea: "street",
        visibleHazards: ["pothole", "traffic hazard"],
        privacyFlags: [],
        confidence: 0.93,
      },
    });
    expectOk(createDuplicate, "create-duplicate");
    expect(createDuplicate.body.autoMerged).toBe(true);
    expect(createDuplicate.body.canonicalIssueId).toBe(issueId);
    expect(createDuplicate.body.duplicateSimilarity).toBeGreaterThanOrEqual(0.85);
    expect(createDuplicate.body.duplicateDistanceM).toBeLessThanOrEqual(50);

    const verifyStatus = await api("/api/issues/update-status", {
      method: "POST",
      headers: actorHeaders(operator),
      body: { issueId, newStatus: "verified", rationale: "Final golden path triage verification." },
    });
    expectOk(verifyStatus, "verify-status");

    const routePlan = await api(`/api/issues/${issueId}/agent-trace-plan`, {
      method: "POST",
      headers: actorHeaders(operator),
      body: { draftResolutionPlan: true },
    });
    expectOk(routePlan, "agent-trace-plan");
    expect(routePlan.body.data?.recommendedAuthority).toBeTruthy();

    const approveRoute = await api(`/api/issues/${issueId}/routing-approval`, {
      method: "POST",
      headers: actorHeaders(operator),
      body: { rationale: "Final golden path operator approves the Gemini draft routing packet." },
    });
    expectOk(approveRoute, "routing-approval");

    const inProgress = await api("/api/issues/update-status", {
      method: "POST",
      headers: actorHeaders(operator),
      body: { issueId, newStatus: "in_progress", rationale: "Final golden path dispatch work is starting." },
    });
    expectOk(inProgress, "in-progress-status");

    const issueAfterRoute = (await db.collection("issues").doc(issueId).get()).data() || {};
    const escalation = await api("/api/escalation", {
      method: "POST",
      headers: actorHeaders(operator),
      body: {
        title: issueAfterRoute.title,
        summary: issueAfterRoute.summary || issueAfterRoute.description,
        locationName: issueAfterRoute.locationName,
        category: issueAfterRoute.category,
        recommendedAuthority: issueAfterRoute.resolutionPlan?.recommendedAuthority,
        ticketId: issueAfterRoute.ticketId,
      },
    });
    expectOk(escalation, "escalation");
    expect(escalation.body.data?.escalationLetter).toMatch(/CivicLens|pothole|grievance/i);

    const escalationRecord = await api(`/api/issues/${issueId}/escalation-record`, {
      method: "POST",
      headers: actorHeaders(operator),
      body: {
        escalationLetter: escalation.body.data.escalationLetter,
        rtiRequest: escalation.body.data.rtiRequest,
      },
    });
    expectOk(escalationRecord, "escalation-record");

    const escalationFinalize = await api(`/api/issues/${issueId}/escalation-finalize`, {
      method: "POST",
      headers: actorHeaders(operator),
      body: { rationale: "Final golden path operator finalized the escalation and RTI draft." },
    });
    expectOk(escalationFinalize, "escalation-finalize");

    const dispatch = await api(`/api/issues/${issueId}/escalation-dispatch`, {
      method: "POST",
      headers: actorHeaders(operator),
      body: {},
    });
    expectOk(dispatch, "escalation-dispatch");
    expect(dispatch.body.dispatch.status).toBe("delivered");
    expect(webhookDeliveries.length).toBeGreaterThanOrEqual(1);

    const closure = await api("/api/verify-resolution", {
      method: "POST",
      headers: actorHeaders(operator),
      body: {
        issueId,
        afterImage: repairedImage,
        summary: "Fresh closure photo shows the pothole has been filled and traffic cones removed.",
      },
    });
    expectOk(closure, "verify-resolution");
    expect(closure.body.data?.resolved, JSON.stringify(closure.body.data)).toBe(true);

    const resolved = await api("/api/issues/update-status", {
      method: "POST",
      headers: actorHeaders(operator),
      body: { issueId, newStatus: "resolved", rationale: "Final golden path operator accepts the Gemini closure assessment." },
    });
    expectOk(resolved, "resolved-status");

    const ghost = await api(`/api/issues/${issueId}/ghost-forensics`, {
      method: "POST",
      headers: actorHeaders(operator),
      body: {
        closureAfterImage: repairedImage,
        auditImage: auditOpenImage,
        fieldAuditSummary: "Fresh audit image shows the same road hazard remains after the claimed closure.",
      },
    });
    expectOk(ghost, "ghost-forensics");
    expect(ghost.body.data?.autoReopened).toBe(true);
    expect(ghost.body.data?.recommendation).toBe("reopen");

    const closureAgain = await api("/api/verify-resolution", {
      method: "POST",
      headers: actorHeaders(operator),
      body: {
        issueId,
        afterImage: repairedImage,
        summary: "Second closure review confirms the final repair image shows a filled pothole.",
      },
    });
    expectOk(closureAgain, "verify-resolution-again");
    expect(closureAgain.body.data?.resolved, JSON.stringify(closureAgain.body.data)).toBe(true);

    const resolvedAgain = await api("/api/issues/update-status", {
      method: "POST",
      headers: actorHeaders(operator),
      body: { issueId, newStatus: "resolved", rationale: "Final golden path operator resolves after fresh repair evidence." },
    });
    expectOk(resolvedAgain, "resolved-status-again");

    const predict = await api("/api/jobs/run", {
      method: "POST",
      headers: jsonHeaders({ "x-civiclens-job-secret": jobSecret }),
      body: { worker: "predict" },
    });
    expectOk(predict, "predict-worker");

    const predictive = await api("/api/insights/predictive");
    expectOk(predictive, "predictive");
    expect(predictive.body.insight || predictive.body.aggregates).toBeTruthy();

    const leaderboard = await api("/api/leaderboard");
    expectOk(leaderboard, "leaderboard");
    expect(Array.isArray(leaderboard.body.leaders)).toBe(true);

    const open311 = await api(`/api/issues/${issueId}/open311`);
    expectOk(open311, "single-open311");
    expect(open311.body.service_requests?.[0]?.service_request_id).toBe(issueId);

    const export311 = await api("/api/export/open311");
    expectOk(export311, "bulk-open311");
    expect(export311.body.service_requests.some((entry: any) => entry.service_request_id === issueId)).toBe(true);

    const finalSnap = await db.collection("issues").doc(issueId).get();
    const finalIssue = finalSnap.data() || {};
    const eventSummary = await readEventSummary(issueId);
    const requiredEvents = [
      "created",
      "auto_merged_on_create",
      "status_changed",
      "agent_trace_updated",
      "routing_approved",
      "escalation_draft",
      "escalation_finalized",
      "escalation_dispatched",
      "ai_closure_verification",
      "ghost_closure_reopened",
      "ai_ghost_forensics",
    ];
    for (const eventType of requiredEvents) {
      expect(eventSummary.types, `missing ${eventType}`).toContain(eventType);
    }

    expect(finalIssue.status).toBe("resolved");
    expect(finalIssue.reportCount).toBeGreaterThanOrEqual(2);
    expect(finalIssue.dispatch?.status).toBe("delivered");
    expect(finalIssue.ghostForensics?.autoReopened).toBe(true);
    expect(finalIssue.routingApprovedAt).toBeTruthy();
    expect(eventSummary.issueGeminiCount).toBeGreaterThanOrEqual(2);
    expect(eventSummary.topGeminiTypes).toContain("ai_report_analysis");
    expect(eventSummary.topGeminiTypes).toContain("ai_escalation_draft");
    expect(eventSummary.topGeminiCount).toBeGreaterThanOrEqual(5);

    const proofLine =
      `FINAL_GOLDEN_PATH_LIVE issueId=${issueId} merged=${createDuplicate.body.autoMerged} similarity=${Number(createDuplicate.body.duplicateSimilarity).toFixed(3)} ` +
      `dispatch=${finalIssue.dispatch.status} ghostReopened=${finalIssue.ghostForensics.autoReopened} finalStatus=${finalIssue.status} ` +
      `open311=${open311.body.service_requests.length} predictive=${predict.body.worker || "predict"} webhookDeliveries=${webhookDeliveries.length} ` +
      `events=${eventSummary.eventCount} geminiEvents=${eventSummary.topGeminiCount}`;
    if (summaryPath) writeFileSync(summaryPath, `${proofLine}\n`, "utf8");
    console.log(proofLine);
  }, 360_000);
});

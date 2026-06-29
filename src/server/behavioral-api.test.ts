import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { beforeAll, describe, expect, it } from "vitest";

const runBehavioral = process.env.CIVICLENS_BEHAVIORAL_API_TESTS === "true";
const describeBehavioral = runBehavioral ? describe : describe.skip;

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
const runPrefix = `behavioral_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let db: Firestore;
let citizen: AuthSession;
let demoOperator: AuthSession;

function jsonHeaders(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    ...extra,
  };
}

function actorHeaders(session: AuthSession, options: { demoOperator?: boolean } = {}) {
  return jsonHeaders({
    Authorization: `Bearer ${session.idToken}`,
    "x-civiclens-local-appcheck-bypass": "true",
    ...(options.demoOperator ? { "x-civiclens-demo-operator": "true" } : {}),
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

async function signUp(): Promise<AuthSession> {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const body: any = await response.json();
  expect(response.ok, JSON.stringify(body)).toBe(true);
  return { idToken: body.idToken, localId: body.localId };
}

async function readIssueEventCounts(issueId: string) {
  const events = await db.collection("issues").doc(issueId).collection("events").get();
  return events.docs.reduce<Record<string, number>>((counts, doc) => {
    const eventType = String(doc.get("eventType") || "");
    counts[eventType] = (counts[eventType] || 0) + 1;
    return counts;
  }, {});
}

describeBehavioral("behavioral API emulator suite", () => {
  beforeAll(async () => {
    if (!baseUrl) throw new Error("CIVICLENS_TEST_BASE_URL is required.");
    if (!authHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST is required.");
    if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
    if (!jobSecret) throw new Error("CIVICLENS_TEST_JOB_SECRET or CIVICLENS_JOB_SECRET is required.");
    if (!getApps().length) initializeApp({ projectId });
    db = getFirestore();
    citizen = await signUp();
    demoOperator = await signUp();
  }, 30_000);

  it("enforces authz for unauthenticated, citizen, secret, and demo-operator requests", async () => {
    const noAppCheck = await api("/api/jobs/run", {
      method: "POST",
      headers: jsonHeaders(),
      body: { worker: "sla", issueId: `${runPrefix}_missing`, thresholdHours: 0 },
    });
    expect(noAppCheck.response.status).toBe(401);
    expect(noAppCheck.body.error).toMatch(/App Check token is required/);

    const noAuth = await api("/api/jobs/run", {
      method: "POST",
      headers: jsonHeaders({ "x-civiclens-local-appcheck-bypass": "true" }),
      body: { worker: "sla", issueId: `${runPrefix}_missing`, thresholdHours: 0 },
    });
    expect(noAuth.response.status).toBe(401);
    expect(noAuth.body.error).toMatch(/Firebase ID token is required/);

    const secretOnly = await api("/api/jobs/run", {
      method: "POST",
      headers: jsonHeaders({ "x-civiclens-job-secret": jobSecret }),
      body: { worker: "sla", issueId: `${runPrefix}_missing`, thresholdHours: 0 },
    });
    expect(secretOnly.response.status, JSON.stringify(secretOnly.body)).toBe(200);
    expect(secretOnly.response.headers.get("x-civiclens-appcheck")).toBe("job-secret");
    expect(secretOnly.body).toMatchObject({ success: true, worker: "sla", scanned: 0, advanced: 0 });

    const citizenJob = await api("/api/jobs/run", {
      method: "POST",
      headers: actorHeaders(citizen),
      body: { worker: "sla", issueId: `${runPrefix}_missing`, thresholdHours: 0 },
    });
    expect(citizenJob.response.status).toBe(403);
    expect(citizenJob.body.error).toMatch(/operator session or a valid job secret/);

    const realIssueId = `${runPrefix}_real_case`;
    await db.collection("issues").doc(realIssueId).set({
      ticketId: `T-${runPrefix}`,
      title: "Real civic case for authz matrix",
      category: "pothole",
      status: "submitted",
      isDemoData: false,
      createdAt: new Date(Date.now() - 36 * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      severity: 3,
      urgency: "routine",
      lat: 12.9716,
      lng: 77.5946,
    });
    const demoUpdate = await api("/api/issues/update-status", {
      method: "POST",
      headers: actorHeaders(demoOperator, { demoOperator: true }),
      body: {
        issueId: realIssueId,
        newStatus: "verified",
        rationale: "Behavioral authz guard check",
      },
    });
    expect(demoUpdate.response.status).toBe(403);
    expect(demoUpdate.body.error).toMatch(/synthetic demo cases/);
  }, 45_000);

  it("advances the SLA worker one rung at a time and then stops without duplicate events", async () => {
    const issueId = `${runPrefix}_sla_case`;
    await db.collection("issues").doc(issueId).set({
      ticketId: `SLA-${runPrefix}`,
      image: "https://example.com/civiclens/behavioral-sla.jpg",
      title: "Blocked storm drain near test ward",
      summary: "Storm drain is blocked and flooding the corner after rain.",
      description: "Storm drain is blocked and flooding the corner after rain.",
      category: "garbage",
      status: "submitted",
      isDemoData: true,
      createdAt: new Date(Date.now() - 96 * 3600000).toISOString(),
      timestamp: new Date(Date.now() - 96 * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      severity: 4,
      urgency: "priority",
      lat: 12.934,
      lng: 77.62,
      priorityScore: 72,
      reportCount: 1,
    });

    const expectedStages = ["reminder", "escalation", "rti", "first_appeal"];
    for (const stage of expectedStages) {
      const result = await api("/api/jobs/run", {
        method: "POST",
        headers: jsonHeaders({ "x-civiclens-job-secret": jobSecret }),
        body: { worker: "sla", issueId, thresholdHours: 0, limit: 1 },
      });
      expect(result.response.status, JSON.stringify(result.body)).toBe(200);
      expect(result.body.advanced).toBe(1);
      expect(result.body.details[0].stage).toBe(stage);
    }

    const finalRun = await api("/api/jobs/run", {
      method: "POST",
      headers: jsonHeaders({ "x-civiclens-job-secret": jobSecret }),
      body: { worker: "sla", issueId, thresholdHours: 0, limit: 1 },
    });
    expect(finalRun.response.status, JSON.stringify(finalRun.body)).toBe(200);
    expect(finalRun.body.advanced).toBe(0);
    expect(finalRun.body.details[0]).toMatchObject({ action: "skip", reason: "next SLA ladder stage not due" });

    const issue = (await db.collection("issues").doc(issueId).get()).data() || {};
    expect(issue.slaLadder.currentStage).toBe("first_appeal");
    expect(issue.escalation.rtiPdfDataUri).toMatch(/^data:application\/pdf;base64,/);
    expect(issue.escalation.firstAppealLetter).toMatch(/first appeal/i);

    const eventCounts = await readIssueEventCounts(issueId);
    expect(eventCounts.sla_ladder_reminder).toBe(1);
    expect(eventCounts.sla_ladder_escalated).toBe(1);
    expect(eventCounts.sla_ladder_rti_pdf).toBe(1);
    expect(eventCounts.sla_ladder_first_appeal).toBe(1);
  }, 120_000);

  it("detects semantic duplicates only when both embedding similarity and locality match", async () => {
    const issueId = `${runPrefix}_dedup_base`;
    const create = await api("/api/issues/create", {
      method: "POST",
      headers: actorHeaders(citizen),
      body: {
        idempotencyKey: issueId,
        imageUrl: "https://example.com/civiclens/behavioral-pothole.jpg",
        category: "pothole",
        title: "Large pothole beside HSR Layout bus stop",
        summary: "Large pothole beside the HSR Layout bus stop causing two wheelers to swerve.",
        description: "Large pothole beside the HSR Layout bus stop causing two wheelers to swerve during peak traffic.",
        lat: 12.9112,
        lng: 77.6385,
        locationName: "24th Main, HSR Layout Sector 2, Bengaluru",
        severity: 4,
        urgency: "priority",
        affectedArea: "street",
        visibleHazards: ["pothole", "traffic hazard"],
        privacyFlags: [],
        confidence: 0.94,
      },
    });
    expect(create.response.status, JSON.stringify(create.body)).toBe(200);
    expect(create.body).toMatchObject({ success: true, autoMerged: false });

    const near = await api("/api/dedup/semantic", {
      method: "POST",
      headers: actorHeaders(citizen),
      body: {
        text: "Large pothole near the HSR Layout bus stop forcing two wheelers to swerve",
        lat: 12.91128,
        lng: 77.63857,
        threshold: 0.85,
        maxDistanceM: 50,
      },
    });
    expect(near.response.status, JSON.stringify(near.body)).toBe(200);
    const nearMatch = near.body.duplicates.find((duplicate: any) => duplicate.id === issueId);
    expect(nearMatch).toBeTruthy();
    expect(nearMatch.similarity).toBeGreaterThanOrEqual(0.85);
    expect(nearMatch.distanceM).toBeLessThanOrEqual(50);

    const far = await api("/api/dedup/semantic", {
      method: "POST",
      headers: actorHeaders(citizen),
      body: {
        text: "Large pothole near the HSR Layout bus stop forcing two wheelers to swerve",
        lat: 13.05,
        lng: 77.59,
        threshold: 0.85,
        maxDistanceM: 50,
      },
    });
    expect(far.response.status, JSON.stringify(far.body)).toBe(200);
    expect(far.body.duplicates.some((duplicate: any) => duplicate.id === issueId)).toBe(false);
  }, 180_000);
});

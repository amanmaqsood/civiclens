import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const root = process.cwd();
const baseUrl = (process.env.CIVICLENS_PUBLIC_URL || "https://civiclens-py7ixxgroq-as.a.run.app").replace(/\/$/, "");
const projectId = process.env.CIVICLENS_PROJECT_ID || "gen-lang-client-0871796745";
const databaseId = process.env.FIRESTORE_DATABASE_ID || "ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa";
const outDir = path.join(root, "qa-results", "public-phase-gaps");
const summaryPath = path.join(outDir, "public-phase-gaps-headed.json");
const voiceFixture = path.join(root, "tests", "fixtures", "voice-intake-pothole.wav");
const sampleImagePath = path.join(root, "images (1).jpg");

const evidence = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  projectId,
  databaseId,
  mode: "headed Chromium via Playwright plus live Cloud Run APIs",
  syntheticPrefix: "",
  screenshots: [],
  results: [],
};

function mark(id, status, details, data = {}) {
  evidence.results.push({ id, status, details, ...data });
  console.log(`${status} ${id} - ${details}`);
}

function runGcloud(args) {
  const command = process.platform === "win32" ? "powershell.exe" : "gcloud";
  const commandArgs = process.platform === "win32"
    ? [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "$ErrorActionPreference = 'Stop'; & gcloud @args",
        ...args,
      ]
    : args;
  return execFileSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function readEnvValue(name) {
  const envPath = path.join(root, ".env.production.local");
  const text = await fs.readFile(envPath, "utf8");
  const line = text.split(/\r?\n/).find((entry) => new RegExp(`^\\s*${name}\\s*=`).test(entry));
  if (!line) return "";
  return line.replace(new RegExp(`^\\s*${name}\\s*=\\s*`), "").trim().replace(/^['"]|['"]$/g, "");
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: firestoreFields(value) } };
  }
  return { stringValue: String(value) };
}

function firestoreFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, firestoreValue(value)]));
}

function firestoreDocumentName(collectionPath) {
  return `projects/${projectId}/databases/${databaseId}/documents/${collectionPath}`;
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ("mapValue" in value) return decodeFirestoreFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFirestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

async function firestoreCommit(accessToken, writes) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:commit`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ writes }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Firestore commit failed ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function setDoc(accessToken, collectionPath, data) {
  await firestoreCommit(accessToken, [{
    update: {
      name: firestoreDocumentName(collectionPath),
      fields: firestoreFields(data),
    },
  }]);
}

async function getDoc(accessToken, collectionPath) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${firestoreDocumentName(collectionPath)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return null;
  const text = await response.text();
  if (!response.ok) throw new Error(`Firestore get failed ${response.status}: ${text.slice(0, 500)}`);
  const body = JSON.parse(text);
  return decodeFirestoreFields(body.fields || {});
}

async function signUp(webApiKey) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(webApiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.idToken || !body.localId) {
    throw new Error(`Firebase anonymous sign-up failed ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return { uid: body.localId, idToken: body.idToken };
}

async function apiPost(pathname, session, body, options = {}) {
  const headers = { "content-type": "application/json" };
  if (session?.idToken) headers.authorization = `Bearer ${session.idToken}`;
  if (options.demoOperator) headers["x-civiclens-demo-operator"] = "true";
  if (options.jobSecret) headers["x-civiclens-job-secret"] = options.jobSecret;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { response, data, text };
}

async function apiGet(pathname, session, options = {}) {
  const headers = {};
  if (session?.idToken) headers.authorization = `Bearer ${session.idToken}`;
  if (options.demoOperator) headers["x-civiclens-demo-operator"] = "true";
  const response = await fetch(`${baseUrl}${pathname}`, { headers });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { response, data, text };
}

async function retryApiPost(pathname, session, body, options = {}, attempts = 3) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    last = await apiPost(pathname, session, body, options);
    if (last.response.ok) return last;
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
  return last;
}

async function labeledPng(background, title, subtitle) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640">
    <rect width="960" height="640" fill="${background}"/>
    <rect x="42" y="42" width="876" height="556" rx="28" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.75)" stroke-width="8"/>
    <text x="480" y="285" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="800" fill="#ffffff">${title}</text>
    <text x="480" y="374" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="#ffffff">${subtitle}</text>
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function baseIssue(id, image, overrides = {}) {
  const now = new Date().toISOString();
  return {
    ticketId: `HEAD-${id.slice(-10).toUpperCase()}`,
    image,
    title: "Headed verifier synthetic civic case",
    summary: "Synthetic demo case created by the public headed verifier.",
    description: "Synthetic demo case created by the public headed verifier.",
    category: "pothole",
    status: "in_progress",
    isDemoData: true,
    createdAt: now,
    timestamp: now,
    updatedAt: now,
    severity: 4,
    urgency: "priority",
    lat: 12.9716,
    lng: 77.5946,
    locationName: "MG Road near Trinity Metro, Bengaluru",
    citizenUpvotes: 3,
    confirmCount: 0,
    disputeCount: 0,
    reportCount: 1,
    priorityScore: 92,
    userId: "headed-public-verifier",
    visibleHazards: ["traffic hazard"],
    privacyFlags: [],
    affectedArea: "road_lane",
    ...overrides,
  };
}

async function screenshot(page, name) {
  const filePath = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  evidence.screenshots.push(path.relative(root, filePath).replace(/\\/g, "/"));
}

async function waitForAnyText(page, patterns, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.locator("body").innerText().catch(() => "");
    if (patterns.some((pattern) => pattern.test(text))) return text;
    await page.waitForTimeout(600);
  }
  const text = await page.locator("body").innerText().catch(() => "");
  throw new Error(`Timed out waiting for ${patterns.map(String).join(", ")}. Body: ${text.slice(0, 700)}`);
}

async function openIssue(page, issueId, screenshotName, requiredPatterns) {
  await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.goto(`${baseUrl}/#issue/${encodeURIComponent(issueId)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const text = await waitForAnyText(page, requiredPatterns, 90000);
  await screenshot(page, screenshotName);
  return text;
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });
  const accessToken = runGcloud(["auth", "print-access-token", "--quiet"]);
  const jobSecret = runGcloud(["secrets", "versions", "access", "latest", "--secret=civiclens-job-secret", "--project", projectId]);
  const webApiKey = await readEnvValue("VITE_FIREBASE_API_KEY");
  if (!webApiKey) throw new Error("VITE_FIREBASE_API_KEY missing from .env.production.local");
  await fs.access(voiceFixture);
  const voiceAudioBase64 = await fs.readFile(voiceFixture, "base64");

  const ready = await fetch(`${baseUrl}/readyz`).then((r) => r.json());
  mark("phase0.readyz-live", ready.ready === true ? "PASS" : "FAIL", `ready=${ready.ready} adminDb=${ready.checks?.adminDb} geminiConfigured=${ready.checks?.geminiConfigured}`);

  const stamp = Date.now();
  evidence.syntheticPrefix = `headed_gap_${stamp}`;
  const redImage = await labeledPng("#991b1b", "OPEN POTHOLE", "FRESH HAZARD");
  const greenImage = await labeledPng("#047857", "REPAIRED", "CLAIMED FIX");
  const auditImage = await labeledPng("#991b1b", "OPEN POTHOLE", "AUDIT STILL UNSAFE");

  const operator = await signUp(webApiKey);
  const voiceApi = await apiPost("/api/voice-intake", operator, {
    audio: `data:audio/wav;base64,${voiceAudioBase64}`,
    mimeType: "audio/wav",
    localeHint: "hi-IN",
    descriptionHint: "",
  });
  const voiceDraft = voiceApi.data?.data || {};
  const voiceTranslation = String(voiceDraft.englishTranslation || voiceDraft.summary || "");
  if (
    voiceApi.response.ok &&
    voiceApi.data?.success &&
    !voiceDraft.aiFallback &&
    ["pothole", "road_damage"].includes(voiceDraft.category) &&
    /pothole|road/i.test(voiceTranslation)
  ) {
    mark(
      "phase4.5.voice-intake-live",
      "PASS",
      `category=${voiceDraft.category} language=${voiceDraft.detectedLanguage} transcriptChars=${String(voiceDraft.transcriptOriginal || "").length} readbackChars=${String(voiceDraft.readbackText || "").length}`,
    );
  } else {
    mark("phase4.5.voice-intake-live", "FAIL", `HTTP ${voiceApi.response.status}; ${JSON.stringify(voiceApi.data).slice(0, 500)}`);
  }

  const ghostId = `headed_gap_${stamp}_ghost`;
  await setDoc(accessToken, `issues/${ghostId}`, baseIssue(ghostId, redImage, {
    title: "Headed Ghost Closure Pothole Audit",
    summary: "Claimed road repair still appears unsafe in the field audit image.",
    status: "resolved",
    assignedOfficerId: `officer_${stamp}`,
    closureSubmittedByUid: `officer_${stamp}`,
    closureAssessment: {
      resolved: true,
      confidence: 0.92,
      observedChanges: ["Claimed patch visible"],
      recommendation: "resolve",
      explanation: "Closure evidence claimed the road hazard was repaired.",
      afterImage: greenImage,
    },
  }));
  const ghost = await apiPost(`/api/issues/${ghostId}/ghost-forensics`, operator, {
    auditImage,
    fieldAuditSummary: "Fresh audit image shows the same open pothole remains after the claimed closure.",
  }, { demoOperator: true });
  if (ghost.response.ok && ghost.data?.success && ghost.data?.data?.autoReopened) {
    mark("phase2.3.ghost-forensics-live", "PASS", `recommendation=${ghost.data.data.recommendation} confidence=${ghost.data.data.confidence}`);
  } else {
    mark("phase2.3.ghost-forensics-live", "FAIL", `HTTP ${ghost.response.status}; ${JSON.stringify(ghost.data).slice(0, 500)}`);
  }

  const trustId = `headed_gap_${stamp}_trust`;
  await setDoc(accessToken, `issues/${trustId}`, baseIssue(trustId, redImage, {
    title: "Headed Trust Consensus Pothole Case",
    summary: "Community verification should produce weighted consensus and appeal state.",
    status: "in_progress",
  }));
  const trustedSessions = [];
  for (let i = 0; i < 3; i += 1) {
    const session = await signUp(webApiKey);
    trustedSessions.push(session);
    await setDoc(accessToken, `profiles/${session.uid}`, {
      uid: session.uid,
      handle: `Trusted-${i + 1}-${stamp}`,
      role: "citizen",
      points: 420,
      level: 8,
      badges: ["Community Verifier", "Civic Champion"],
      reportCount: 6,
      supportCount: 9,
      verifyCount: 14,
      trustScore: 0.96,
      updatedAt: new Date().toISOString(),
    });
  }
  let trustWeight = 0;
  for (const session of trustedSessions) {
    const vote = await apiPost(`/api/issues/${trustId}/verification`, session, {
      type: "confirm",
      reason: "I can verify the reported hazard still blocks safe travel at this location.",
    });
    if (!vote.response.ok || !vote.data?.success) throw new Error(`Trusted verification failed: ${vote.response.status} ${JSON.stringify(vote.data).slice(0, 400)}`);
    trustWeight = vote.data?.consensus?.confirmWeight || trustWeight;
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  const appeal = await apiPost(`/api/issues/${trustId}/trust-appeal`, trustedSessions[0], {
    reason: "The location was checked again and still needs human review despite consensus.",
  });
  const trustDoc = await getDoc(accessToken, `issues/${trustId}`);
  if (appeal.response.ok && trustDoc?.trustAppeal?.status === "pending") {
    mark("phase4.1.trust-consensus-appeal-live", "PASS", `confirmWeight=${trustWeight} status=${trustDoc.status} appeal=${trustDoc.trustAppeal.status}`);
  } else {
    mark("phase4.1.trust-consensus-appeal-live", "FAIL", `HTTP ${appeal.response.status}; status=${trustDoc?.status}; appeal=${trustDoc?.trustAppeal?.status}`);
  }

  const brigadeId = `headed_gap_${stamp}_brigade`;
  await setDoc(accessToken, `issues/${brigadeId}`, baseIssue(brigadeId, redImage, {
    title: "Headed Low Trust Brigade Case",
    summary: "Low-trust clustered confirmations should be collapsed by the brigading guard.",
    status: "in_progress",
  }));
  for (let i = 0; i < 4; i += 1) {
    const session = await signUp(webApiKey);
    await setDoc(accessToken, `profiles/${session.uid}`, {
      uid: session.uid,
      handle: `New-${i + 1}-${stamp}`,
      role: "citizen",
      points: 0,
      level: 1,
      badges: [],
      reportCount: 0,
      supportCount: 0,
      verifyCount: 0,
      trustScore: 0.18,
      updatedAt: new Date().toISOString(),
    });
    const vote = await apiPost(`/api/issues/${brigadeId}/verification`, session, {
      type: "confirm",
      reason: "Same short confirmation from a brand new account.",
    });
    if (!vote.response.ok || !vote.data?.success) throw new Error(`Low-trust verification failed: ${vote.response.status} ${JSON.stringify(vote.data).slice(0, 400)}`);
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  const brigadeDoc = await getDoc(accessToken, `issues/${brigadeId}`);
  const collapsed = brigadeDoc?.trustConsensus?.collapsedVotes || 0;
  if (collapsed > 0) {
    mark("phase4.1.brigading-guard-live", "PASS", `risk=${brigadeDoc.trustConsensus?.brigadingRisk} collapsed=${collapsed}`);
  } else {
    mark("phase4.1.brigading-guard-live", "FAIL", `collapsed=${collapsed} risk=${brigadeDoc?.trustConsensus?.brigadingRisk}`);
  }

  const workerId = `aaa_headed_gap_${stamp}_worker`;
  const oldIso = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  await setDoc(accessToken, `issues/${workerId}`, baseIssue(workerId, redImage, {
    title: "Headed SLA Follow-up Dispatch Worker Case",
    summary: "Old unresolved water leak case for SLA, follow-up, dispatch, and ledger headed verification.",
    description: "Old unresolved water leak case for SLA, follow-up, dispatch, and ledger headed verification.",
    category: "water_leak",
    status: "in_progress",
    createdAt: oldIso,
    timestamp: oldIso,
    updatedAt: oldIso,
    severity: 5,
    urgency: "urgent",
    priorityScore: 100,
    locationName: "ITPL Main Road, Bengaluru",
    resolutionPlan: {
      recommendedAuthority: "Municipal Corporation",
      contactChannel: "Draft channel for verifier",
      slaDays: 7,
      actionPacket: {
        subject: "Urgent water leak escalation",
        body: "Draft action packet for human approval.",
        bodyHindi: "मानव समीक्षा के लिए मसौदा।",
        summaryHindi: "पानी की पाइपलाइन रिसाव।",
        nextActions: ["Verify ward", "Confirm photos", "Dispatch after approval"],
      },
      groundingSources: [],
    },
  }));
  for (let i = 0; i < 4; i += 1) {
    const sla = await apiPost(`/api/jobs/run?worker=sla`, null, { issueId: workerId, thresholdHours: 0, limit: 1 }, { jobSecret });
    if (!sla.response.ok || !sla.data?.success) throw new Error(`SLA worker failed: ${sla.response.status} ${JSON.stringify(sla.data).slice(0, 500)}`);
  }
  const followup = await apiPost(`/api/jobs/run?worker=followup`, null, { issueId: workerId, limit: 25 }, { jobSecret });
  if (!followup.response.ok || !followup.data?.success) throw new Error(`Follow-up worker failed: ${followup.response.status} ${JSON.stringify(followup.data).slice(0, 500)}`);
  const predict = await apiPost(`/api/jobs/run?worker=predict`, null, {}, { jobSecret });
  if (!predict.response.ok || !predict.data?.success) throw new Error(`Predictive worker failed: ${predict.response.status} ${JSON.stringify(predict.data).slice(0, 500)}`);

  const dispatch = await retryApiPost(`/api/issues/${workerId}/escalation-dispatch`, operator, {}, { demoOperator: true }, 3);
  const workerDoc = await getDoc(accessToken, `issues/${workerId}`);
  if (workerDoc?.escalation?.rtiPdfDataUri && workerDoc?.followUp?.action) {
    mark("phase2.1.phase2.2.sla-followup-live", "PASS", `stage=${workerDoc.slaLadder?.currentStage} followup=${workerDoc.followUp.action} rtiPdfBytes=${workerDoc.escalation?.rtiPdfBytes || 0}`);
  } else {
    mark("phase2.1.phase2.2.sla-followup-live", "FAIL", `stage=${workerDoc?.slaLadder?.currentStage} followup=${workerDoc?.followUp?.action} rti=${!!workerDoc?.escalation?.rtiPdfDataUri}`);
  }
  if (dispatch.response.ok && dispatch.data?.dispatch?.status === "delivered") {
    mark("phase4.4.dispatch-live", "PASS", `status=${dispatch.data.dispatch.status} endpoint=${dispatch.data.dispatch.endpoint} http=${dispatch.data.dispatch.httpStatus}`);
  } else {
    mark("phase4.4.dispatch-live", "FAIL", `HTTP ${dispatch.response.status}; ${JSON.stringify(dispatch.data).slice(0, 500)}`);
  }
  const predictive = await fetch(`${baseUrl}/api/insights/predictive`).then((r) => r.json());
  mark(
    "phase2.4.predictive-live",
    predictive?.insight?.predictedHotspots?.length >= 0 ? "PASS" : "FAIL",
    `model=${predictive?.model || "unknown"} hotspots=${predictive?.insight?.predictedHotspots?.length ?? "missing"}`
  );

  const grounding = await apiGet(`/api/issues/${workerId}/grounding`, null);
  const groundingSources = grounding.data?.grounding?.sources || [];
  const reverseGeocode = grounding.data?.grounding?.reverseGeocode || null;
  if (
    grounding.response.ok &&
    reverseGeocode &&
    groundingSources.includes("nominatim-osm") &&
    groundingSources.includes("open-meteo") &&
    groundingSources.includes("firestore-history")
  ) {
    mark(
      "phase3.2.keyless-grounding-live",
      "PASS",
      `sources=${groundingSources.join(",")} place=${[reverseGeocode.road, reverseGeocode.neighbourhood, reverseGeocode.city || reverseGeocode.district].filter(Boolean).join(" | ") || "resolved"}`,
    );
  } else {
    mark("phase3.2.keyless-grounding-live", "FAIL", `HTTP ${grounding.response.status}; ${JSON.stringify(grounding.data).slice(0, 600)}`);
  }

  const weeklyLeaderboard = await apiGet("/api/leaderboard?period=weekly", null);
  const weeklyLeader = (weeklyLeaderboard.data?.leaders || []).find((leader) => leader.weeklyPoints > 0 && leader.currentStreak >= 1);
  if (weeklyLeaderboard.response.ok && weeklyLeaderboard.data?.period === "weekly" && weeklyLeaderboard.data?.weekKey && weeklyLeader) {
    mark("phase4.2.weekly-streak-gamification-live", "PASS", `week=${weeklyLeaderboard.data.weekKey} topWeekly=${weeklyLeader.weeklyPoints} streak=${weeklyLeader.currentStreak}`);
  } else {
    mark("phase4.2.weekly-streak-gamification-live", "FAIL", `HTTP ${weeklyLeaderboard.response.status}; ${JSON.stringify(weeklyLeaderboard.data).slice(0, 600)}`);
  }

  const mergeTargetId = `headed_gap_${stamp}_merge_target`;
  const mergeSourceId = `headed_gap_${stamp}_merge_source`;
  const proposalId = `proposal_${stamp}`;
  await setDoc(accessToken, `issues/${mergeTargetId}`, baseIssue(mergeTargetId, redImage, {
    title: "Headed Canonical Merge Target",
    summary: "Canonical target for headed merge approval.",
    status: "in_progress",
    reportCount: 1,
  }));
  await setDoc(accessToken, `issues/${mergeSourceId}`, baseIssue(mergeSourceId, redImage, {
    title: "Headed Merge Source Duplicate",
    summary: "Duplicate source case waiting for human merge approval.",
    status: "verified",
    reportCount: 1,
  }));
  await setDoc(accessToken, `issues/${mergeSourceId}/mergeProposals/${proposalId}`, {
    sourceIssueId: mergeSourceId,
    targetIssueId: mergeTargetId,
    status: "pending",
    reason: "Headed verifier proposal: duplicate issue at the same location.",
    similarity: 0.93,
    createdAt: new Date().toISOString(),
  });
  const merge = await apiPost(`/api/issues/${mergeSourceId}/merge-proposals/${proposalId}/approve`, operator, {}, { demoOperator: true });
  const mergeSource = await getDoc(accessToken, `issues/${mergeSourceId}`);
  const mergeTarget = await getDoc(accessToken, `issues/${mergeTargetId}`);
  if (merge.response.ok && mergeSource?.mergeStatus === "merged" && mergeTarget?.reportCount >= 2) {
    mark("phase1.2.manual-merge-approval-live", "PASS", `source=${mergeSource.mergeStatus} targetReportCount=${mergeTarget.reportCount}`);
  } else {
    mark("phase1.2.manual-merge-approval-live", "FAIL", `HTTP ${merge.response.status}; source=${mergeSource?.mergeStatus}; targetReportCount=${mergeTarget?.reportCount}`);
  }

  const obs = await apiGet("/api/ops/observability?hours=24", operator, { demoOperator: true });
  if (obs.response.ok && obs.data?.success && obs.data?.cloudLoggingQueries?.length >= 4) {
    mark("phase6.3.observability-live", "PASS", `events=${obs.data.eventCounts?.total} queries=${obs.data.cloudLoggingQueries.length}`);
  } else {
    mark("phase6.3.observability-live", "FAIL", `HTTP ${obs.response.status}; ${JSON.stringify(obs.data).slice(0, 500)}`);
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
    args: [
      "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${voiceFixture}`,
    ],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, ignoreHTTPSErrors: true });
    await context.grantPermissions(["microphone"], { origin: baseUrl });
    await context.addInitScript((wavBase64) => {
      localStorage.setItem("has_seen_onboarding", "true");
      const wavBytes = Uint8Array.from(atob(wavBase64), (char) => char.charCodeAt(0));
      class CivicLensFixtureMediaRecorder extends EventTarget {
        constructor() {
          super();
          this.mimeType = "audio/wav";
          this.state = "inactive";
        }

        static isTypeSupported() {
          return false;
        }

        start() {
          this.state = "recording";
          setTimeout(() => {
            const event = new Event("dataavailable");
            Object.defineProperty(event, "data", {
              value: new Blob([wavBytes], { type: "audio/wav" }),
            });
            this.dispatchEvent(event);
            if (typeof this.ondataavailable === "function") this.ondataavailable(event);
          }, 50);
        }

        stop() {
          this.state = "inactive";
          setTimeout(() => {
            const event = new Event("stop");
            this.dispatchEvent(event);
            if (typeof this.onstop === "function") this.onstop(event);
          }, 80);
        }
      }
      Object.defineProperty(window, "MediaRecorder", {
        value: CivicLensFixtureMediaRecorder,
        configurable: true,
      });
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: async () => ({
            getTracks: () => [{ stop() {} }],
          }),
        },
        configurable: true,
      });
    }, voiceAudioBase64);
    const page = await context.newPage();
    const browserConsoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        browserConsoleErrors.push(message.text().slice(0, 400));
      }
    });

    await page.goto(`${baseUrl}/#report`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForAnyText(page, [/Proof photograph|Report what you see|AI-assisted civic reports/i], 45000);
    await page.locator("#report-gallery-upload-input").setInputFiles(sampleImagePath);
    await page.getByAltText("Civic preview").waitFor({ state: "visible", timeout: 30000 });
    await page.getByRole("button", { name: /Drop pin manually/i }).click({ timeout: 30000 });
    await waitForAnyText(page, [/Coordinates locked/i], 30000);
    await waitForAnyText(page, [/Voice input|Start voice/i], 30000);
    const startVoice = page.getByRole("button", { name: /start voice|voice/i }).first();
    await startVoice.click({ timeout: 30000 });
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /stop recording|stop/i }).click({ timeout: 30000 });
    const voiceText = await waitForAnyText(page, [/Voice draft ready|Transcript|Translation|Voice intake needs typed confirmation/i], 120000);
    await screenshot(page, "01-voice-intake-headed");
    mark("phase4.5.voice-intake-headed", /Voice draft ready|Transcript|Translation/i.test(voiceText) ? "PASS" : "FAIL", voiceText.replace(/\s+/g, " ").slice(0, 500));

    const ghostText = await openIssue(page, ghostId, "02-ghost-forensics-detail", [/Ghost Closure Forensics/i, /auto reopened/i, /Recommendation/i]);
    mark("phase2.3.ghost-card-headed", /Ghost Closure Forensics/i.test(ghostText) && /auto reopened/i.test(ghostText) ? "PASS" : "FAIL", ghostText.replace(/\s+/g, " ").slice(0, 500));

    const trustText = await openIssue(page, trustId, "03-trust-consensus-detail", [/Weighted consensus/i, /appeal/i, /Community verification/i]);
    mark("phase4.1.trust-ui-headed", /Weighted consensus/i.test(trustText) && /appeal/i.test(trustText) ? "PASS" : "FAIL", trustText.replace(/\s+/g, " ").slice(0, 500));

    const brigadeText = await openIssue(page, brigadeId, "04-brigading-guard-detail", [/Weighted consensus/i, /collapsed/i, /high|watch/i]);
    mark("phase4.1.brigading-ui-headed", /collapsed/i.test(brigadeText) ? "PASS" : "FAIL", brigadeText.replace(/\s+/g, " ").slice(0, 500));

    const workerText = await openIssue(page, workerId, "05-sla-followup-dispatch-ledger", [/AI follow-up recommendation|Sla Ladder|Escalation Dispatched|Followup Decision|RTI Pdf/i]);
    mark("phase2.phase4.worker-dispatch-ui-headed", /AI follow-up recommendation|Sla Ladder|RTI Pdf|Escalation Dispatched|Followup Decision/i.test(workerText) ? "PASS" : "FAIL", workerText.replace(/\s+/g, " ").slice(0, 500));

    const mergeText = await openIssue(page, mergeSourceId, "06-merge-approval-ledger", [/merged|Merge|Accountability|resolved/i]);
    mark("phase1.2.merge-approval-ui-headed", /merged|merge proposal approved|resolved/i.test(mergeText) ? "PASS" : "FAIL", mergeText.replace(/\s+/g, " ").slice(0, 500));

    await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.goto(`${baseUrl}/#dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const dashboardText = await waitForAnyText(page, [/Predictive|Open311|Community leaderboard/i], 60000);
    const weeklyText = await waitForAnyText(page, [/wk pts|all-time|Streak \d+d/i], 60000);
    await screenshot(page, "07-dashboard-predictive-leaderboard");
    const combinedDashboardText = `${dashboardText}\n${weeklyText}`;
    mark("phase2.4.phase4.2.dashboard-headed", /Predictive|Weekly community leaderboard/i.test(combinedDashboardText) && /wk pts|all-time|Streak \d+d/i.test(combinedDashboardText) ? "PASS" : "FAIL", combinedDashboardText.replace(/\s+/g, " ").slice(0, 500));
    mark(
      "phase0.public-gap-browser-cleanliness",
      browserConsoleErrors.length === 0 ? "PASS" : "FAIL",
      browserConsoleErrors.length === 0 ? "consoleErrors=0" : `consoleErrors=${browserConsoleErrors.length}; first=${browserConsoleErrors[0]}`,
      { consoleErrors: browserConsoleErrors },
    );
  } finally {
    await browser.close();
  }

  await fs.writeFile(summaryPath, JSON.stringify(evidence, null, 2));
  console.log(`SUMMARY ${summaryPath}`);
}

run().catch(async (error) => {
  mark("public-phase-gaps-run", "FAIL", error?.stack || error?.message || String(error));
  await fs.mkdir(outDir, { recursive: true }).catch(() => {});
  await fs.writeFile(summaryPath, JSON.stringify(evidence, null, 2)).catch(() => {});
  process.exitCode = 1;
});

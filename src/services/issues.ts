import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  getDoc,
  startAfter
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, auth, storage, handleFirestoreError, OperationType } from "../lib/firebase";
import { IssueReport, AgentTraceEntry, ResolutionPlan, IssueActivity, ClosureAssessment } from "../types";
import { apiFetch } from "./api";
import { IssueStatusKey, normalizeIssueStatus } from "../constants/status";

const COLLECTION_NAME = "issues";

export interface PriorityBreakdown {
  score: number;
  severityComponent: number;
  urgencyComponent: number;
  timeComponent: number;
  confirmComponent: number;
  reportComponent: number;
  disputeComponent: number;
  hoursSinceReported: number;
}

export interface IssuePageCursor {
  timestamp: string;
}

export interface IssuePage {
  issues: IssueReport[];
  nextCursor: IssuePageCursor | null;
  hasMore: boolean;
  pageSize: number;
}

export function calculatePriorityScore(issue: {
  severity?: number;
  urgency?: string;
  timestamp: string;
  confirmCount?: number;
  disputeCount?: number;
  reportCount?: number;
}): number {
  const severity = issue.severity || 1;
  const urgency = issue.urgency || "routine";
  const confirmCount = issue.confirmCount || 0;
  const disputeCount = issue.disputeCount || 0;
  const reportCount = issue.reportCount || 1;

  let urgencyBonus = 0;
  if (urgency === "urgent") urgencyBonus = 10;
  else if (urgency === "priority") urgencyBonus = 5;

  const past = Date.parse(issue.timestamp);
  const hoursSinceReported = isNaN(past) ? 0 : Math.max(0, (Date.now() - past) / (1000 * 60 * 60));

  const timeComponent = Math.min(hoursSinceReported / 12, 10);
  const confirmComponent = Math.min(confirmCount * 3, 15);
  const reportComponent = Math.min(reportCount * 4, 15);
  const disputeComponent = disputeCount * 5;

  const score = severity * 12 + urgencyBonus + timeComponent + confirmComponent + reportComponent - disputeComponent;
  const clampedScore = Math.max(0, Math.min(100, score));
  return Math.round(clampedScore * 10) / 10; // Round to 1 decimal place
}

export function isDuplicateCandidate(
  newReport: Partial<IssueReport>,
  existing: Partial<IssueReport>,
  nowMs: number = Date.now()
): boolean {
  if (
    typeof newReport.lat !== "number" ||
    typeof newReport.lng !== "number" ||
    isNaN(newReport.lat) ||
    isNaN(newReport.lng)
  ) {
    return false;
  }
  
  if (existing.category !== newReport.category) return false;
  if (normalizeIssueStatus(existing.status) === "resolved") return false;
  if (!existing.timestamp) return false;
  const createdTime = Date.parse(existing.timestamp);
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  if (isNaN(createdTime) || nowMs - createdTime > fourteenDaysMs) return false;

  if (
    typeof existing.lat !== "number" ||
    typeof existing.lng !== "number" ||
    isNaN(existing.lat) ||
    isNaN(existing.lng)
  ) {
    return false;
  }

  const distance = getDistance(newReport.lat, newReport.lng, existing.lat, existing.lng);
  return distance <= 150;
}

export function isValidStatusTransition(
  currentStatus: IssueStatusKey,
  nextStatus: IssueStatusKey,
  isAiVerified: boolean,
  manualOverride: boolean
): boolean {
  if (currentStatus === "submitted") {
    return nextStatus === "verified";
  }
  if (currentStatus === "verified") {
    return nextStatus === "in_progress";
  }
  if (currentStatus === "in_progress") {
    if (nextStatus === "resolved") {
      return isAiVerified || manualOverride;
    }
    return false;
  }
  return false;
}

export function getPriorityBreakdown(issue: {
  severity?: number;
  urgency?: string;
  timestamp: string;
  confirmCount?: number;
  disputeCount?: number;
  reportCount?: number;
}): PriorityBreakdown {
  const severity = issue.severity || 1;
  const urgency = issue.urgency || "routine";
  const confirmCount = issue.confirmCount || 0;
  const disputeCount = issue.disputeCount || 0;
  const reportCount = issue.reportCount || 1;

  const severityComponent = severity * 12;

  let urgencyComponent = 0;
  if (urgency === "urgent") urgencyComponent = 10;
  else if (urgency === "priority") urgencyComponent = 5;

  const past = Date.parse(issue.timestamp);
  const hoursSinceReported = isNaN(past) ? 0 : Math.max(0, (Date.now() - past) / (1000 * 60 * 60));

  const timeComponent = Math.min(hoursSinceReported / 12, 10);
  const confirmComponent = Math.min(confirmCount * 3, 15);
  const reportComponent = Math.min(reportCount * 4, 15);
  const disputeComponent = disputeCount * 5;

  const scoreRaw = severityComponent + urgencyComponent + timeComponent + confirmComponent + reportComponent - disputeComponent;
  const score = Math.round(Math.max(0, Math.min(100, scoreRaw)) * 10) / 10;

  return {
    score,
    severityComponent,
    urgencyComponent,
    timeComponent,
    confirmComponent,
    reportComponent,
    disputeComponent,
    hoursSinceReported
  };
}


// Generate unique human ticket ID on submission side
export function generateTicketId(): string {
  const letters = "CIVIC";
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `${letters}-${digits}`;
}

function issueReportFromSnapshot(id: string, data: any): IssueReport {
  const issueReport: IssueReport = {
    id,
    ticketId: data.ticketId,
    image: data.image,
    category: data.category,
    description: data.description,
    lat: data.lat,
    lng: data.lng,
    locationName: data.locationName,
    status: normalizeIssueStatus(data.status),
    citizenUpvotes: data.citizenUpvotes || 0,
    userId: data.userId,
    timestamp: data.timestamp,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    triagedAt: data.triagedAt,
    verifiedAt: data.verifiedAt,
    assignedAt: data.assignedAt,
    workStartedAt: data.workStartedAt,
    closureSubmittedAt: data.closureSubmittedAt,
    resolvedAt: data.resolvedAt,
    reopenedAt: data.reopenedAt,
    title: data.title,
    summary: data.summary,
    severity: data.severity,
    urgency: data.urgency,
    visibleHazards: data.visibleHazards,
    affectedArea: data.affectedArea,
    privacyFlags: data.privacyFlags,
    confidence: data.confidence,
    reportCount: data.reportCount || 1,
    dedup: data.dedup || undefined,
    confirmCount: data.confirmCount || 0,
    disputeCount: data.disputeCount || 0,
    priorityScore: data.priorityScore,
    verificationStatus: data.verificationStatus || "unverified",
    agentTrace: data.agentTrace || [],
    resolutionPlan: data.resolutionPlan || undefined,
    closureAssessment: data.closureAssessment || undefined,
    ghostForensics: data.ghostForensics || undefined,
    slaDeadline: data.slaDeadline || undefined,
    slaPolicy: data.slaPolicy || undefined,
    slaLadder: data.slaLadder || undefined,
    escalation: data.escalation || undefined,
    dispatch: data.dispatch || undefined,
    followUp: data.followUp || undefined,
    isDemoData: data.isDemoData || false,
  };

  if (issueReport.priorityScore === undefined) {
    issueReport.priorityScore = calculatePriorityScore(issueReport);
  }

  return issueReport;
}

// Fetch a single page of issue records. The returned page is not a complete history.
export async function fetchIssuesPage(options: { pageSize?: number; after?: IssuePageCursor | null } = {}): Promise<IssuePage> {
  const pageSize = Math.max(10, Math.min(100, Math.floor(options.pageSize || 50)));
  try {
    const issuesRef = collection(db, COLLECTION_NAME);
    const q = options.after?.timestamp
      ? query(issuesRef, orderBy("timestamp", "desc"), startAfter(options.after.timestamp), limit(pageSize + 1))
      : query(issuesRef, orderBy("timestamp", "desc"), limit(pageSize + 1));
    const snapshot = await getDocs(q);

    const pageDocs = snapshot.docs.slice(0, pageSize);
    const results = pageDocs.map((doc) => issueReportFromSnapshot(doc.id, doc.data()));

    // Deterministic sort: sort home feed by priorityScore descending
    results.sort((a, b) => {
      const scoreA = a.priorityScore ?? 0;
      const scoreB = b.priorityScore ?? 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return Date.parse(b.timestamp) - Date.parse(a.timestamp); // Secondary tie break by newer timestamp
    });

    const lastDoc = pageDocs[pageDocs.length - 1];
    return {
      issues: results,
      pageSize,
      hasMore: snapshot.docs.length > pageSize,
      nextCursor: lastDoc ? { timestamp: String(lastDoc.data().timestamp || "") } : null,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    return { issues: [], nextCursor: null, hasMore: false, pageSize };
  }
}

// Compatibility wrapper for callers that only need the first loaded page.
export async function fetchRecentIssues(): Promise<IssueReport[]> {
  const page = await fetchIssuesPage({ pageSize: 50 });
  return page.issues;
}

export async function fetchIssueById(issueId: string): Promise<IssueReport | null> {
  try {
    const issueRef = doc(db, COLLECTION_NAME, issueId);
    const snap = await getDoc(issueRef);
    if (!snap.exists()) return null;
    return issueReportFromSnapshot(snap.id, snap.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${COLLECTION_NAME}/${issueId}`);
    throw err;
  }
}

// Create a new Issue Report through the server-owned data endpoint.
export async function submitIssueReport(
  params: Omit<IssueReport, "id" | "ticketId" | "status" | "citizenUpvotes" | "userId" | "timestamp">
): Promise<IssueReport> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required. Please sign in to report.");
  }

  const issueId = doc(collection(db, COLLECTION_NAME)).id;

  let finalImageUrl = params.image;
  if (params.image && params.image.startsWith("data:")) {
    try {
      const storageRef = ref(storage, `reports/${currentUser.uid}/${issueId}/original.jpg`);
      await uploadString(storageRef, params.image, "data_url");
      finalImageUrl = await getDownloadURL(storageRef);
    } catch (storageErr) {
      console.error("Firebase Storage Upload Error:", storageErr);
      throw new Error("Failed to secure image storage link. Confirm Storage config.");
    }
  }

  const response = await apiFetch("/api/issues/create", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: issueId,
      imageUrl: finalImageUrl,
      category: params.category,
      description: params.description,
      lat: params.lat,
      lng: params.lng,
      locationName: params.locationName,
      title: params.title,
      summary: params.summary,
      severity: params.severity,
      urgency: params.urgency,
      visibleHazards: params.visibleHazards,
      affectedArea: params.affectedArea,
      privacyFlags: params.privacyFlags,
      confidence: params.confidence,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create issue report.");
  }
  const result = await response.json();
  return {
    ...result.data,
    autoMerged: !!result.autoMerged,
    duplicateSimilarity: result.duplicateSimilarity ?? null,
    duplicateDistanceM: result.duplicateDistanceM ?? null,
  } as IssueReport;
}

// Distance calculator using Haversine formula
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Filter recent candidates inside user context (JavaScript processing)
export async function findDuplicateCandidates(
  newReport: Partial<IssueReport>
): Promise<{ issue: IssueReport; distance: number }[]> {
  if (
    typeof newReport.lat !== "number" ||
    typeof newReport.lng !== "number" ||
    isNaN(newReport.lat) ||
    isNaN(newReport.lng)
  ) {
    return [];
  }

  try {
    const issuesRef = collection(db, COLLECTION_NAME);
    const q = query(issuesRef, orderBy("timestamp", "desc"), limit(50));
    const snapshot = await getDocs(q);

    const candidates: { issue: IssueReport; distance: number }[] = [];
    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    snapshot.forEach((doc) => {
      const data = doc.data() as Partial<IssueReport>;
      if (!isDuplicateCandidate(newReport, data, now)) return;

      const distance = getDistance(newReport.lat!, newReport.lng!, data.lat!, data.lng!);
      candidates.push({
        issue: {
          id: doc.id,
          ticketId: data.ticketId!,
          image: data.image!,
          category: data.category!,
          description: data.description!,
          lat: data.lat!,
          lng: data.lng!,
          locationName: data.locationName,
          status: normalizeIssueStatus(data.status),
          citizenUpvotes: data.citizenUpvotes || 0,
          userId: data.userId!,
          timestamp: data.timestamp!,
          title: data.title,
          summary: data.summary,
          severity: data.severity,
          urgency: data.urgency,
          visibleHazards: data.visibleHazards,
          affectedArea: data.affectedArea,
          privacyFlags: data.privacyFlags,
          confidence: data.confidence,
          reportCount: data.reportCount || 1,
          dedup: data.dedup || undefined,
          agentTrace: data.agentTrace || [],
          resolutionPlan: data.resolutionPlan || undefined,
          closureAssessment: data.closureAssessment || undefined,
          ghostForensics: data.ghostForensics || undefined,
          slaDeadline: data.slaDeadline || undefined,
          slaPolicy: data.slaPolicy || undefined,
          slaLadder: data.slaLadder || undefined,
          escalation: data.escalation || undefined,
          dispatch: data.dispatch || undefined,
          followUp: data.followUp || undefined,
          isDemoData: data.isDemoData || false,
        },
        distance,
      });
    });

    // Sort nearest first, keep top 5
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, 5);
  } catch (error) {
    console.error("findDuplicateCandidates error:", error);
    return [];
  }
}

export interface DuplicateResponse {
  recommendation: "merge" | "create_new" | "ask_user";
  bestCandidateId: string | null;
  similarity: number;
  reasons: string[];
}

export async function checkDuplicateWithAI(
  newReport: Partial<IssueReport>,
  candidates: IssueReport[]
): Promise<DuplicateResponse> {
  const response = await apiFetch("/api/check-duplicate", {
    method: "POST",
    body: JSON.stringify({
      newReport: {
        category: newReport.category,
        title: newReport.title || "Civic Incident",
        summary: newReport.summary || newReport.description,
      },
      candidates: candidates.map((c) => ({
        id: c.id,
        category: c.category,
        title: c.title,
        summary: c.summary || c.description,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to check duplicates with AI.");
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to analyze duplicates.");
  }

  return result.data;
}

// Compatibility wrapper: asks the server to draft and persist a plan from stored issue state.
export async function generateResolutionPlan(issue: IssueReport): Promise<ResolutionPlan> {
  return updateIssueResolutionPlan(issue.id);
}

// Submits evidence and hooks into existing issue
export async function submitEvidenceForIssue(
  canonicalId: string,
  params: {
    imageUrl: string;
    description: string;
    lat?: number;
    lng?: number;
    severity: number;
  }
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required.");
  }

  // Reference to canonical issue
  const canonicalRef = doc(db, COLLECTION_NAME, canonicalId);
  const canonicalSnap = await getDoc(canonicalRef);
  if (!canonicalSnap.exists()) {
    throw new Error("The selected original issue does not exist.");
  }

  // First upload image if it's base64 data to Storage
  let finalImageUrl = params.imageUrl;
  // Create evidence subcollection document reference to get unique ID
  const evidenceId = doc(collection(canonicalRef, "evidence")).id;
  if (params.imageUrl && params.imageUrl.startsWith("data:")) {
    try {
      const storageRef = ref(storage, `evidence/${currentUser.uid}/${canonicalId}/${evidenceId}.jpg`);
      await uploadString(storageRef, params.imageUrl, "data_url");
      finalImageUrl = await getDownloadURL(storageRef);
    } catch (storageErr) {
      console.error("Storage upload error for evidence:", storageErr);
      throw new Error("Failed to secure image storage link for new evidence.");
    }
  }

  const response = await apiFetch(`/api/issues/${canonicalId}/evidence`, {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: evidenceId,
      imageUrl: finalImageUrl,
      description: params.description || "Supporting evidence",
      lat: params.lat,
      lng: params.lng,
      severity: params.severity,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to attach evidence.");
  }
}

// Submits verification (Confirm / Dispute)
export async function submitVerification(
  issueId: string,
  type: "confirm" | "dispute"
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required to verify or dispute reports.");
  }

  const response = await apiFetch(`/api/issues/${issueId}/verification`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit verification.");
  }
}

// Check user status for verification
export async function checkUserVerification(issueId: string): Promise<"confirm" | "dispute" | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  try {
    const verificationRef = doc(db, COLLECTION_NAME, issueId, "verifications", currentUser.uid);
    const snap = await getDoc(verificationRef);
    if (snap.exists()) {
      return snap.data().type as "confirm" | "dispute";
    }
  } catch (error) {
    console.error("error checking verification status:", error);
  }
  return null;
}

// Update state of lifecycle
export async function updateIssueStatus(
  issueId: string,
  newStatus: IssueStatusKey,
  options: { demoOperator?: boolean; rationale?: string } = {}
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to change status.");
  const resp = await apiFetch("/api/issues/update-status", {
    method: "POST",
    body: JSON.stringify({ issueId, newStatus, rationale: options.rationale }),
  }, options);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "Status update failed.");
  }
}

export async function approveRoutingPlan(issueId: string, rationale: string, options: { demoOperator?: boolean } = {}): Promise<void> {
  const response = await apiFetch(`/api/issues/${issueId}/routing-approval`, {
    method: "POST",
    body: JSON.stringify({ rationale }),
  }, options);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to approve routing plan.");
  }
}

export async function finalizeEscalation(issueId: string, rationale: string, options: { demoOperator?: boolean } = {}): Promise<void> {
  const response = await apiFetch(`/api/issues/${issueId}/escalation-finalize`, {
    method: "POST",
    body: JSON.stringify({ rationale }),
  }, options);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to finalize escalation.");
  }
}

export async function dispatchEscalation(issueId: string, options: { demoOperator?: boolean } = {}): Promise<any> {
  const response = await apiFetch(`/api/issues/${issueId}/escalation-dispatch`, {
    method: "POST",
  }, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to dispatch escalation to the authority channel.");
  return data.dispatch;
}


// Update cached translations
export async function updateIssueTranslations(
  issueId: string,
  titleHi: string,
  summaryHi: string
): Promise<void> {
  const response = await apiFetch(`/api/issues/${issueId}/translations`, {
    method: "POST",
    body: JSON.stringify({ titleHi, summaryHi }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save translations.");
  }
}

// Increment citizen upvotes
export async function upvoteIssue(issueId: string): Promise<void> {
  const response = await apiFetch(`/api/issues/${issueId}/support`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to support issue.");
  }
}

// Ask the server to persist a server-generated resolution-plan record.
export async function updateIssueResolutionPlan(
  issueId: string
): Promise<ResolutionPlan> {
  const response = await apiFetch(`/api/issues/${issueId}/agent-trace-plan`, {
    method: "POST",
    body: JSON.stringify({ draftResolutionPlan: true }),
  }, { demoOperator: true });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save resolution plan.");
  }
  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to save resolution plan.");
  }
  return result.data as ResolutionPlan;
}

// Compatibility wrapper: the server owns agent traces and may draft a plan/score.
export async function updateIssueAgentTraceAndPlan(
  issueId: string,
  _agentTrace: AgentTraceEntry[],
  resolutionPlan?: any,
  priorityScore?: number
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (resolutionPlan) body.draftResolutionPlan = true;
  if (typeof priorityScore === "number") body.priorityScore = priorityScore;
  const response = await apiFetch(`/api/issues/${issueId}/agent-trace-plan`, {
    method: "POST",
    body: JSON.stringify(body),
  }, { demoOperator: true });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save agent trace.");
  }
}

// Record subcollection activity log
export async function recordIssueActivity(
  issueId: string,
  activity: {
    actorType: "operator" | "citizen" | "ai";
    eventType: string;
    message: string;
    timestamp: string;
  }
): Promise<void> {
  const response = await apiFetch(`/api/issues/${issueId}/activity`, {
    method: "POST",
    body: JSON.stringify(activity),
  }, { demoOperator: activity.actorType === "operator" });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to record activity.");
  }
}

// Fetch subcollection activity logs
export async function fetchIssueActivities(issueId: string): Promise<IssueActivity[]> {
  const activityCollectionRef = collection(db, COLLECTION_NAME, issueId, "activity");
  try {
    const q = query(activityCollectionRef, orderBy("timestamp", "asc"));
    const snap = await getDocs(q);
    const result: IssueActivity[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      result.push({
        id: doc.id,
        actorType: data.actorType,
        eventType: data.eventType,
        message: data.message,
        timestamp: data.timestamp,
      });
    });
    return result;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `${COLLECTION_NAME}/${issueId}/activity`);
    throw err;
  }
}

// Upload completion image and request the server to verify and persist closure evidence.
export async function submitClosureAssessment(
  issueId: string,
  beforeImageUrl: string,
  afterImageBase64: string,
  summary: string
): Promise<ClosureAssessment> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Authentication required to submit closure evidence.");

  // 1. Upload raw afterImage state to a user-scoped Storage path.
  let afterImageUrl = "";
  try {
    const storageRef = ref(storage, `closures/${currentUser.uid}/${issueId}/after_${Date.now()}.jpg`);
    await uploadString(storageRef, afterImageBase64, "data_url");
    afterImageUrl = await getDownloadURL(storageRef);
  } catch (storageErr) {
    console.error("Firebase Storage afterImage upload error:", storageErr);
    throw new Error("Failed to upload completion image to Firebase Storage.");
  }

  // 2. Call server-side compare endpoint
  const response = await apiFetch("/api/verify-resolution", {
    method: "POST",
    body: JSON.stringify({
      issueId,
      beforeImageUrl,
      afterImage: afterImageBase64,
      afterImageUrl,
      summary,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI verification failed: ${errText || response.statusText}`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to receive AI verification audit results.");
  }

  const assessment: ClosureAssessment = {
    resolved: result.data.resolved,
    confidence: result.data.confidence,
    observedChanges: result.data.observedChanges,
    recommendation: result.data.recommendation,
    explanation: result.data.explanation,
    afterImage: result.data.afterImage || afterImageUrl,
  };

  return assessment;
}

export async function triggerAutoEscalation(issue: IssueReport): Promise<any> {
  const response = await apiFetch("/api/escalation", {
    method: "POST",
    body: JSON.stringify({
      title: issue.title || issue.category,
      summary: issue.summary || issue.description,
      locationName: issue.locationName || "Unspecified Location",
      category: issue.category,
      recommendedAuthority: issue.resolutionPlan?.recommendedAuthority || "Municipal Corporation",
      ticketId: issue.ticketId || "N/A",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Escalation request failed: ${errText || response.statusText}`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to generate escalation details from Gemini.");
  }

  const { escalationLetter, rtiRequest } = result.data;
  const escalatedAt = new Date().toISOString();

  const saveResponse = await apiFetch(`/api/issues/${issue.id}/escalation-record`, {
    method: "POST",
    body: JSON.stringify({
      escalationLetter,
      rtiRequest,
    }),
  }, { demoOperator: true });

  if (!saveResponse.ok) {
    const err = await saveResponse.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save escalation draft.");
  }

  const saved = await saveResponse.json().catch(() => null);
  return saved?.data || { escalatedAt, escalationLetter, rtiRequest };
}

export async function seedDemoIssuesBengaluru(): Promise<boolean> {
  const response = await apiFetch("/api/demo/seed", {
    method: "POST",
    body: JSON.stringify({}),
  }, { demoOperator: true });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to seed demo data.");
  }
  return true;
}

export async function clearDemoIssues(): Promise<void> {
  const response = await apiFetch("/api/demo/clear", {
    method: "POST",
    body: JSON.stringify({}),
  }, { demoOperator: true });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to clear demo data.");
  }
  return;
}

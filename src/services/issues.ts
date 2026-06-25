import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  query, 
  orderBy, 
  where, 
  limit, 
  increment,
  getDoc,
  deleteDoc
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, auth, storage, handleFirestoreError, OperationType } from "../lib/firebase";
import { IssueReport, AgentTraceEntry, ResolutionPlan, IssueActivity, ClosureAssessment } from "../types";
import { apiFetch } from "./api";

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
  if (existing.status === "Resolved") return false;
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
  currentStatus: "Submitted" | "Verified" | "In Progress" | "Resolved",
  nextStatus: "Submitted" | "Verified" | "In Progress" | "Resolved",
  isAiVerified: boolean,
  manualOverride: boolean
): boolean {
  if (currentStatus === "Submitted") {
    return nextStatus === "Verified";
  }
  if (currentStatus === "Verified") {
    return nextStatus === "In Progress";
  }
  if (currentStatus === "In Progress") {
    if (nextStatus === "Resolved") {
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

// Fetch recently submitted issues
export async function fetchRecentIssues(): Promise<IssueReport[]> {
  try {
    const issuesRef = collection(db, COLLECTION_NAME);
    const q = query(issuesRef, orderBy("timestamp", "desc"), limit(50));
    const snapshot = await getDocs(q);
    
    const results: IssueReport[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const issueReport: IssueReport = {
        id: doc.id,
        ticketId: data.ticketId,
        image: data.image,
        category: data.category,
        description: data.description,
        lat: data.lat,
        lng: data.lng,
        locationName: data.locationName,
        status: data.status,
        citizenUpvotes: data.citizenUpvotes || 0,
        userId: data.userId,
        timestamp: data.timestamp,
        title: data.title,
        summary: data.summary,
        severity: data.severity,
        urgency: data.urgency,
        visibleHazards: data.visibleHazards,
        affectedArea: data.affectedArea,
        privacyFlags: data.privacyFlags,
        confidence: data.confidence,
        reportCount: data.reportCount || 1,
        confirmCount: data.confirmCount || 0,
        disputeCount: data.disputeCount || 0,
        priorityScore: data.priorityScore,
        verificationStatus: data.verificationStatus || "unverified",
        agentTrace: data.agentTrace || [],
        resolutionPlan: data.resolutionPlan || undefined,
        closureAssessment: data.closureAssessment || undefined,
        escalation: data.escalation || undefined,
        isDemoData: data.isDemoData || false,
      };

      // Add dynamic fallback of priorityScore if not explicitly stored
      if (issueReport.priorityScore === undefined) {
        issueReport.priorityScore = calculatePriorityScore(issueReport);
      }

      results.push(issueReport);
    });

    // Deterministic sort: sort home feed by priorityScore descending
    results.sort((a, b) => {
      const scoreA = a.priorityScore ?? 0;
      const scoreB = b.priorityScore ?? 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return Date.parse(b.timestamp) - Date.parse(a.timestamp); // Secondary tie break by newer timestamp
    });

    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    return [];
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
  return result.data as IssueReport;
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
          status: data.status!,
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
          agentTrace: data.agentTrace || [],
          resolutionPlan: data.resolutionPlan || undefined,
          closureAssessment: data.closureAssessment || undefined,
          escalation: data.escalation || undefined,
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

// Client-side call to resolution plan API
export async function generateResolutionPlan(issue: IssueReport): Promise<ResolutionPlan> {
  const response = await apiFetch("/api/resolution-plan", {
    method: "POST",
    body: JSON.stringify({
      category: issue.category,
      title: issue.title || "Civic Incident",
      summary: issue.summary || issue.description,
      locationName: issue.locationName || "Default Civic Landmark",
      lat: issue.lat,
      lng: issue.lng,
      ticketId: issue.ticketId || "N/A",
    }),
  });

  if (!response.ok) {
    const errObj = await response.json().catch(() => ({}));
    throw new Error(errObj.error || "Failed to generate resolution plan.");
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to generate resolution plan.");
  }

  return result.data as ResolutionPlan;
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
  newStatus: "Submitted" | "Verified" | "In Progress" | "Resolved",
  options: { demoOperator?: boolean } = {}
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to change status.");
  const resp = await apiFetch("/api/issues/update-status", {
    method: "POST",
    body: JSON.stringify({ issueId, newStatus }),
  }, options);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "Status update failed.");
  }
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

// Update resolution plan and append agent trace steps
export async function updateIssueResolutionPlan(
  issueId: string,
  resolutionPlan: ResolutionPlan,
  extraTraces: AgentTraceEntry[]
): Promise<void> {
  const response = await apiFetch(`/api/issues/${issueId}/agent-trace-plan`, {
    method: "POST",
    body: JSON.stringify({ resolutionPlan, agentTrace: extraTraces }),
  }, { demoOperator: true });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save resolution plan.");
  }
}

// Overwrite/update agent trace, plan, and priority score
export async function updateIssueAgentTraceAndPlan(
  issueId: string,
  agentTrace: AgentTraceEntry[],
  resolutionPlan?: any,
  priorityScore?: number
): Promise<void> {
  const response = await apiFetch(`/api/issues/${issueId}/agent-trace-plan`, {
    method: "POST",
    body: JSON.stringify({ agentTrace, resolutionPlan, priorityScore }),
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

// Upload completion image and request AI verify-resolution analysis, then save closureAssessment & agentTrace
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
      beforeImageUrl,
      afterImage: afterImageBase64,
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
    afterImage: afterImageUrl, // Persist download URL
  };

  const verifyTrace: AgentTraceEntry = {
    step: "Verify Resolution",
    tool: "Gemini Vision Integrity Inspector (/api/verify-resolution)",
    status: assessment.resolved ? "done" : "failed",
    rationale: `AI checked work with ${(assessment.confidence * 100).toFixed(0)}% confidence. recommendation: "${assessment.recommendation.toUpperCase()}". Changes: ${assessment.observedChanges.join(", ") || "none"}. Details: ${assessment.explanation}`,
    ts: new Date().toISOString(),
    durationMs: result.durationMs || 1500,
    confidence: result.confidence || assessment.confidence,
    inputDigest: result.inputDigest || `Compare original vs afterImage`,
    outputSummary: result.outputSummary || `Resolved: ${assessment.resolved} · Rec: ${assessment.recommendation}`,
    retried: result.retried || false,
  };

  const saveResponse = await apiFetch(`/api/issues/${issueId}/closure-assessment`, {
    method: "POST",
    body: JSON.stringify({
      closureAssessment: assessment,
      agentTrace: [verifyTrace],
    }),
  }, { demoOperator: true });

  if (!saveResponse.ok) {
    const err = await saveResponse.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save closure assessment.");
  }

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

  const escalationTrace: AgentTraceEntry = {
    step: "Auto-Escalation / RTI",
    tool: "Gemini 2.5 Civil Escalation Engine (/api/escalation)",
    status: "done",
    rationale: `Drafted higher-authority appeal and Section 6(1) RTI text for human review. Nothing was submitted outside CivicLens. Drafted at ${new Date(escalatedAt).toLocaleString()}`,
    ts: escalatedAt,
    durationMs: result.durationMs || 1200,
    confidence: result.confidence || 0.90,
    inputDigest: result.inputDigest || `Escalate ticket ${issue.ticketId || "N/A"}`,
    outputSummary: result.outputSummary || `Drafted Escalation Letter + RTI Request`,
    retried: result.retried || false,
  };

  const saveResponse = await apiFetch(`/api/issues/${issue.id}/escalation-record`, {
    method: "POST",
    body: JSON.stringify({
      escalationLetter,
      rtiRequest,
      agentTrace: [escalationTrace],
    }),
  }, { demoOperator: true });

  if (!saveResponse.ok) {
    const err = await saveResponse.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save escalation draft.");
  }

  return { escalatedAt, escalationLetter, rtiRequest };
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

  const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
  if (querySnapshot.size >= 3) {
    throw new Error("Seeding skipped: database already has 3 or more issues.");
  }

  const currentUser = auth.currentUser;
  const userId = currentUser ? currentUser.uid : "demo_operator_user";

  const templates = [
    {
      title: "Clogged Stormwater Drain on Koramangala 80 Feet Road",
      description: "During light rain, water backs up completely onto the road due to plastic blocking the inlet slab.",
      category: "drainage",
      locationName: "80 Feet Rd, Koramangala, Bengaluru",
      lat: 12.9348,
      lng: 77.6251,
      image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80",
      severity: 4,
      status: "In Progress" as const,
      reportCount: 3,
      confirmCount: 4,
      urgency: "priority" as const,
    },
    {
      title: "Massive Crater Pothole outside Indiranagar Metro Station",
      description: "Large deep pothole on the main road. Two wheelers constantly swerving to avoid it, endangering other vehicles.",
      category: "pothole",
      locationName: "CMH Road, Indiranagar, Bengaluru",
      lat: 12.9785,
      lng: 77.6385,
      image: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
      severity: 5,
      status: "Submitted" as const,
      reportCount: 1,
      confirmCount: 0,
      urgency: "urgent" as const,
    },
    {
      title: "Broken Streetlight Street 14 Jayanagar 4th Block",
      description: "Streetlight SL-J-98 has been broken for 10 days, leaving the corner near the park completely pitch black.",
      category: "streetlight",
      locationName: "14th Cross Rd, Jayanagar 4th Block, Bengaluru",
      lat: 12.9282,
      lng: 77.5831,
      image: "https://images.unsplash.com/photo-1509024640106-cf78faeb99b2?auto=format&fit=crop&w=600&q=80",
      severity: 2,
      status: "Verified" as const,
      reportCount: 2,
      confirmCount: 3,
      urgency: "routine" as const,
    },
    {
      title: "Overflowing Garbage Pile in Malleshwaram 8th Cross",
      description: "Garbage hasn't been cleared for many days. Strays are scattering it everywhere and blocking pedestrians.",
      category: "waste",
      locationName: "8th Cross, Malleshwaram, Bengaluru",
      lat: 13.0031,
      lng: 77.5694,
      image: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
      severity: 3,
      status: "Verified" as const,
      reportCount: 4,
      confirmCount: 5,
      urgency: "priority" as const,
    },
    {
      title: "Leaking Drinking Water Pipeline on ITPL Main Road",
      description: "High-pressure clean water is bursting out of a main joint, flooding the street and creating deep mud puddles.",
      category: "water_leak",
      locationName: "ITPL Main Rd, Whitefield, Bengaluru",
      lat: 12.9866,
      lng: 77.6950,
      image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
      severity: 5,
      status: "Resolved" as const,
      reportCount: 5,
      confirmCount: 8,
      urgency: "urgent" as const,
    },
    {
      title: "Clogged Sewer line on outer ring road Yeswanthpur",
      description: "Sewer line is overflowing onto the highway lane. High speed traffic splashing smelly water on bystanders.",
      category: "drainage",
      locationName: "Pipeline Rd, Yeswanthpur, Bengaluru",
      lat: 13.0232,
      lng: 77.5550,
      image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80",
      severity: 4,
      status: "In Progress" as const,
      reportCount: 2,
      confirmCount: 2,
      urgency: "priority" as const,
    },
    {
      title: "Deep Pavement Cavity in HSR Layout Sector 2",
      description: "Footpath pavement block has caved in, creating a 3-foot drop directly adjacent to the commercial shops entrance.",
      category: "pothole",
      locationName: "24th Main, HSR Layout Sector 2, Bengaluru",
      lat: 12.9112,
      lng: 77.6385,
      image: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
      severity: 3,
      status: "Submitted" as const,
      reportCount: 1,
      confirmCount: 1,
      urgency: "routine" as const,
    }
  ];

  for (const t of templates) {
    const issueId = doc(collection(db, COLLECTION_NAME)).id;
    const ticketId = `#BLR-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date(Date.now() - (2 + Math.random() * 4) * 24 * 3600 * 1000).toISOString();

    const initialReport: IssueReport = {
      id: issueId,
      ticketId,
      image: t.image,
      lat: t.lat,
      lng: t.lng,
      locationName: t.locationName,
      category: t.category,
      description: t.description,
      status: "Submitted",
      citizenUpvotes: t.confirmCount || 0, // seed display count for synthetic sample
      userId,
      timestamp,
      title: t.title,
      summary: t.description,
      severity: 3,
      urgency: "routine",
      visibleHazards: [],
      affectedArea: "unknown",
      privacyFlags: [],
      confidence: 1.0,
      reportCount: 1,
      confirmCount: 0,
      disputeCount: 0,
      verificationStatus: "unverified",
      isDemoData: true,
    };

    initialReport.priorityScore = calculatePriorityScore(initialReport);

    const baseMs = Date.parse(timestamp);
    const nowMs = Date.now();
    const capTimestamp = (targetMs: number) => {
      const capped = Math.min(targetMs, nowMs - 60 * 1000);
      return new Date(capped).toISOString();
    };

    // Dynamic rationales tailored using issue's category, title, severity, and location
    const categoryLabel = t.category.replace(/_/g, " ");
    const rationales = {
      perceive: `Synthetic demo trace: sample classified as ${categoryLabel} at severity ${t.severity}/5 for "${t.title}".`,
      locate: `Synthetic demo trace: sample location set to "${t.locationName}" (${t.lat.toFixed(4)} N, ${t.lng.toFixed(4)} E).`,
      deduplicate: `Synthetic demo trace: no duplicate sample linked around ${t.locationName}.`,
      prioritize: `Synthetic demo trace: priority score set to ${t.severity * 12} using the prototype display formula.`,
      decide: `Synthetic demo trace: marked ready for prototype operator review at ${t.urgency} urgency.`,
      findAuthority: `Synthetic demo trace: suggested Bruhat Bengaluru Mahanagara Palike (BBMP) for human review.`,
      draftActionPacket: `Synthetic demo trace: draft complaint summary prepared for manual review of "${t.title}".`
    };

    const blrAgentTrace: AgentTraceEntry[] = [
      {
        step: "Perceive",
        tool: "demo.syntheticVisionTrace",
        status: "done",
        rationale: rationales.perceive,
        ts: capTimestamp(baseMs + 5 * 1000),
        durationMs: 1450,
        confidence: 0.94,
        inputDigest: `photo (${t.category})`,
        outputSummary: `Detected: ${t.title}`
      },
      {
        step: "Locate",
        tool: "demo.syntheticGeocode",
        status: "done",
        rationale: rationales.locate,
        ts: capTimestamp(baseMs + 10 * 1000),
        durationMs: 250,
        confidence: 1.0,
        inputDigest: `lat: ${t.lat.toFixed(4)}, lng: ${t.lng.toFixed(4)}`,
        outputSummary: `Located: ${t.locationName}`
      },
      {
        step: "Deduplicate",
        tool: "demo.syntheticDuplicateScan",
        status: "done",
        rationale: rationales.deduplicate,
        ts: capTimestamp(baseMs + 15 * 1000),
        durationMs: 410,
        confidence: 0.98,
        inputDigest: `Scan radius 150m from center`,
        outputSummary: `0 matching candidates found`
      },
      {
        step: "Prioritize",
        tool: "demo.syntheticPriorityScore",
        status: "done",
        rationale: rationales.prioritize,
        ts: capTimestamp(baseMs + 20 * 1000),
        durationMs: 120,
        confidence: 1.0,
        inputDigest: `severity: ${t.severity}, urgency: ${t.urgency}`,
        outputSummary: `priorityScore: ${t.severity * 12}`
      },
      {
        step: "Decide",
        tool: "demo.syntheticReviewGate",
        status: "done",
        rationale: rationales.decide,
        ts: capTimestamp(baseMs + 25 * 1000),
        durationMs: 180,
        confidence: 0.95,
        inputDigest: `severity >= 4 or urgency: ${t.urgency}`,
        outputSummary: `Action: Ready for prototype review`
      },
      {
        step: "Find Authority",
        tool: "demo.syntheticAuthoritySuggestion",
        status: "done",
        rationale: rationales.findAuthority,
        ts: capTimestamp(baseMs + 30 * 1000),
        durationMs: 1850,
        confidence: 0.92,
        inputDigest: `Search local bodies in "${t.locationName}"`,
        outputSummary: `Authority: BBMP`
      },
      {
        step: "Draft Action Packet",
        tool: "demo.syntheticDraftPacket",
        status: "done",
        rationale: rationales.draftActionPacket,
        ts: capTimestamp(baseMs + 35 * 1000),
        durationMs: 2200,
        confidence: 0.96,
        inputDigest: `category: ${t.category}`,
        outputSummary: `Draft email templates compiled`
      }
    ];

    const docRef = doc(db, COLLECTION_NAME, issueId);
    await setDoc(docRef, initialReport);

    const demoUpdates: Partial<IssueReport> = {
      category: t.category,
      severity: t.severity,
      status: t.status,
      reportCount: t.reportCount,
      confirmCount: t.confirmCount,
      urgency: t.urgency,
      isDemoData: true,
      agentTrace: blrAgentTrace,
    };

    const finalState = { ...initialReport, ...demoUpdates };
    demoUpdates.priorityScore = calculatePriorityScore(finalState);

    await updateDoc(docRef, demoUpdates);

    // Seeding synthetic activity history to preview the workflow.
    const activityCollectionRef = collection(db, COLLECTION_NAME, issueId, "activity");
    const activitiesToSeed: {
      actorType: "citizen" | "ai" | "operator";
      eventType: string;
      message: string;
      timestamp: string;
    }[] = [
      {
        actorType: "citizen" as const,
        eventType: "created",
        message: `Synthetic demo report saved for "${t.title}".`,
        timestamp: capTimestamp(baseMs)
      },
      {
        actorType: "ai" as const,
        eventType: "triage",
        message: `Synthetic demo triage note: severity ${t.severity}/5 and urgency ${t.urgency}.`,
        timestamp: capTimestamp(baseMs + 2 * 60 * 1000)
      }
    ];

    if (t.status === "Verified") {
      if (t.confirmCount && t.confirmCount > 0) {
        activitiesToSeed.push({
          actorType: "citizen" as const,
          eventType: "verification",
          message: `Synthetic demo community signal: ${t.confirmCount} confirmations shown for sample data.`,
          timestamp: capTimestamp(baseMs + 3 * 60 * 60 * 1000)
        });
      }
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Synthetic demo status set to Verified for workflow preview.",
        timestamp: capTimestamp(baseMs + 28 * 60 * 60 * 1000)
      });
    } else if (t.status === "In Progress") {
      if (t.confirmCount && t.confirmCount > 0) {
        activitiesToSeed.push({
          actorType: "citizen" as const,
          eventType: "verification",
          message: `Synthetic demo community signal: ${t.confirmCount} confirmations shown for sample data.`,
          timestamp: capTimestamp(baseMs + 3 * 60 * 60 * 1000)
        });
      }
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Synthetic demo status set to In Progress for workflow preview.",
        timestamp: capTimestamp(baseMs + 6 * 60 * 60 * 1000)
      });
    } else if (t.status === "Resolved") {
      if (t.confirmCount && t.confirmCount > 0) {
        activitiesToSeed.push({
          actorType: "citizen" as const,
          eventType: "verification",
          message: `Synthetic demo community signal: ${t.confirmCount} confirmations shown for sample data.`,
          timestamp: capTimestamp(baseMs + 3 * 60 * 60 * 1000)
        });
      }
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Synthetic demo status set to In Progress for workflow preview.",
        timestamp: capTimestamp(baseMs + 6 * 60 * 60 * 1000)
      });
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Synthetic demo closure marked resolved for sample data only.",
        timestamp: capTimestamp(baseMs + 28 * 60 * 60 * 1000)
      });
    } else {
      // Submitted status
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Synthetic demo report added to prototype ledger.",
        timestamp: capTimestamp(baseMs + 5 * 1000)
      });
    }

    for (const act of activitiesToSeed) {
      const actDocRef = doc(activityCollectionRef);
      await setDoc(actDocRef, act);
    }
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

  try {
    const q = query(collection(db, COLLECTION_NAME), where("isDemoData", "==", true));
    const querySnapshot = await getDocs(q);
    for (const docSnap of querySnapshot.docs) {
      await deleteDoc(doc(db, COLLECTION_NAME, docSnap.id));
    }
  } catch (err: any) {
    console.error("Error clearing demo issues:", err);
    throw handleFirestoreError(err, OperationType.DELETE, COLLECTION_NAME);
  }
}

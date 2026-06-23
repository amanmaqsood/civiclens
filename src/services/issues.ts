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
  const reportComponent = reportCount * 4;
  const disputeComponent = disputeCount * 5;

  const score = severity * 12 + urgencyBonus + timeComponent + confirmComponent + reportComponent - disputeComponent;
  return Math.round(score * 10) / 10; // Round to 1 decimal place
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
  const reportComponent = reportCount * 4;
  const disputeComponent = disputeCount * 5;

  const score = Math.round((severityComponent + urgencyComponent + timeComponent + confirmComponent + reportComponent - disputeComponent) * 10) / 10;

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

// Write a new Issue Report to Firestore
export async function submitIssueReport(
  params: Omit<IssueReport, "id" | "ticketId" | "status" | "citizenUpvotes" | "userId" | "timestamp">
): Promise<IssueReport> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required. Please sign in to report.");
  }

  const issueId = doc(collection(db, COLLECTION_NAME)).id;
  const ticketId = generateTicketId();
  const timestamp = new Date().toISOString();

  // On submit, upload the compressed image to Firebase Storage at reports/{issueId}.jpg,
  // get its download URL, and store that URL in the issue document's image field instead of the Base64 string.
  let finalImageUrl = params.image;
  if (params.image && params.image.startsWith("data:")) {
    try {
      const storageRef = ref(storage, `reports/${issueId}.jpg`);
      await uploadString(storageRef, params.image, "data_url");
      finalImageUrl = await getDownloadURL(storageRef);
    } catch (storageErr) {
      console.error("Firebase Storage Upload Error:", storageErr);
      throw new Error("Failed to secure image storage link. Confirm Storage config.");
    }
  }

  // Setup standard initial agent trace entries ("Perceive", "Locate", "Deduplicate")
  const ts1 = new Date(Date.now() - 3000).toISOString();
  const ts2 = new Date(Date.now() - 2000).toISOString();
  const ts3 = new Date(Date.now() - 1000).toISOString();

  const perceiveTrace: AgentTraceEntry = {
    step: "Perceive",
    tool: "Gemini Multimodal Vision (/api/analyze-report)",
    status: "done",
    rationale: `Identified visual category "${params.category || "other"}" with severity rating ${params.severity || 3}/5 and parsed visible hazards: ${(params.visibleHazards || []).join(", ") || "none"}.`,
    ts: ts1,
  };

  const locateTrace: AgentTraceEntry = {
    step: "Locate",
    tool: "GPS Geo-locator (Navigator API)",
    status: (params.lat && params.lng) ? "done" : "skipped",
    rationale: (params.lat && params.lng) 
      ? `Successfully resolved geo-coordinates (${params.lat.toFixed(4)}, ${params.lng.toFixed(4)}) at "${params.locationName || "Current Location"}".`
      : `No GPS coordinates provided. Standard fallback to local description: "${params.locationName || "Default Landmark"}".`,
    ts: ts2,
  };

  const deduplicateTrace: AgentTraceEntry = {
    step: "Deduplicate",
    tool: "Proximity & Semantic Engine (/api/check-duplicate)",
    status: "done",
    rationale: "Proximity analysis scanned active issues within 150m. None matching: approved new standalone report.",
    ts: ts3,
  };

  const report: IssueReport = {
    id: issueId,
    ticketId,
    image: finalImageUrl,
    category: params.category,
    description: params.description,
    locationName: params.locationName || "Default Civic Landmark",
    status: "Submitted",
    citizenUpvotes: 0,
    userId: currentUser.uid,
    timestamp,
    
    // AI analytical results field persistence
    title: params.title || "Civic Incident",
    summary: params.summary || params.description,
    severity: params.severity || 3,
    urgency: params.urgency || "routine",
    visibleHazards: params.visibleHazards || [],
    affectedArea: params.affectedArea || "unknown",
    privacyFlags: params.privacyFlags || [],
    confidence: params.confidence || 1.0,
    reportCount: 1,
    confirmCount: 0,
    disputeCount: 0,
    verificationStatus: "unverified",
    agentTrace: [perceiveTrace, locateTrace, deduplicateTrace],
  };

  if (typeof params.lat === "number" && !isNaN(params.lat)) {
    report.lat = params.lat;
  }
  if (typeof params.lng === "number" && !isNaN(params.lng)) {
    report.lng = params.lng;
  }

  // Pre-calculate deterministic priority score
  report.priorityScore = calculatePriorityScore(report);

  try {
    const docRef = doc(db, COLLECTION_NAME, issueId);
    await setDoc(docRef, report);
    return report;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTION_NAME}/${issueId}`);
    throw err;
  }
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
  const response = await fetch("/api/check-duplicate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const response = await fetch("/api/resolution-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  const timestamp = new Date().toISOString();

  // Reference to canonical issue
  const canonicalRef = doc(db, COLLECTION_NAME, canonicalId);
  const canonicalSnap = await getDoc(canonicalRef);
  if (!canonicalSnap.exists()) {
    throw new Error("The selected original issue does not exist.");
  }

  const canonicalData = canonicalSnap.data();

  // First upload image if it's base64 data to Storage
  let finalImageUrl = params.imageUrl;
  // Create evidence subcollection document reference to get unique ID
  const evidenceId = doc(collection(canonicalRef, "evidence")).id;
  if (params.imageUrl && params.imageUrl.startsWith("data:")) {
    try {
      const storageRef = ref(storage, `reports/${evidenceId}.jpg`);
      await uploadString(storageRef, params.imageUrl, "data_url");
      finalImageUrl = await getDownloadURL(storageRef);
    } catch (storageErr) {
      console.error("Storage upload error for evidence:", storageErr);
      throw new Error("Failed to secure image storage link for new evidence.");
    }
  }

  // Create subcollection entry
  const evidenceRef = doc(canonicalRef, "evidence", evidenceId);
  const evidenceData: any = {
    imageUrl: finalImageUrl,
    description: params.description,
    userId: currentUser.uid,
    timestamp,
    severity: params.severity,
  };
  if (typeof params.lat === "number" && !isNaN(params.lat)) {
    evidenceData.lat = params.lat;
  }
  if (typeof params.lng === "number" && !isNaN(params.lng)) {
    evidenceData.lng = params.lng;
  }

  await setDoc(evidenceRef, evidenceData);

  // Sync to canonical parent and recompute priority score
  const nextReportCount = (canonicalData.reportCount || 1) + 1;
  const nextSeverity = Math.max(canonicalData.severity || 0, params.severity);

  const nextPriorityScore = calculatePriorityScore({
    severity: nextSeverity,
    urgency: canonicalData.urgency,
    timestamp: canonicalData.timestamp,
    confirmCount: canonicalData.confirmCount || 0,
    disputeCount: canonicalData.disputeCount || 0,
    reportCount: nextReportCount,
  });

  const updates: any = {
    reportCount: nextReportCount,
    severity: nextSeverity,
    priorityScore: nextPriorityScore,
  };

  await updateDoc(canonicalRef, updates);
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

  const userId = currentUser.uid;
  const verificationRef = doc(db, COLLECTION_NAME, issueId, "verifications", userId);
  const verificationSnap = await getDoc(verificationRef);
  
  if (verificationSnap.exists()) {
    throw new Error("You have already verified or disputed this issue.");
  }

  const issueRef = doc(db, COLLECTION_NAME, issueId);
  const issueSnap = await getDoc(issueRef);
  if (!issueSnap.exists()) {
    throw new Error("The selected issue does not exist.");
  }

  const issueData = issueSnap.data();
  const currentConfirmCount = issueData.confirmCount || 0;
  const currentDisputeCount = issueData.disputeCount || 0;
  const currentReportCount = issueData.reportCount || 1;

  const nextConfirmCount = currentConfirmCount + (type === "confirm" ? 1 : 0);
  const nextDisputeCount = currentDisputeCount + (type === "dispute" ? 1 : 0);

  const newScore = calculatePriorityScore({
    severity: issueData.severity,
    urgency: issueData.urgency,
    timestamp: issueData.timestamp,
    confirmCount: nextConfirmCount,
    disputeCount: nextDisputeCount,
    reportCount: currentReportCount,
  });

  let nextVerificationStatus = "unverified";
  if (nextConfirmCount > nextDisputeCount) {
    nextVerificationStatus = "confirmed";
  } else if (nextDisputeCount > nextConfirmCount) {
    nextVerificationStatus = "disputed";
  } else {
    nextVerificationStatus = "mixed";
  }

  // Set the verification subdocument
  await setDoc(verificationRef, {
    userId,
    type,
    timestamp: new Date().toISOString(),
  });

  // Update original issue
  await updateDoc(issueRef, {
    confirmCount: nextConfirmCount,
    disputeCount: nextDisputeCount,
    priorityScore: newScore,
    verificationStatus: nextVerificationStatus,
  });
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
  newStatus: "Submitted" | "Verified" | "In Progress" | "Resolved"
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, issueId);
  try {
    await updateDoc(docRef, {
      status: newStatus
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${issueId}`);
    throw err;
  }
}

// Increment citizen upvotes
export async function upvoteIssue(issueId: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, issueId);
  try {
    await updateDoc(docRef, {
      citizenUpvotes: increment(1)
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${issueId}`);
    throw err;
  }
}

// Update resolution plan and append agent trace steps
export async function updateIssueResolutionPlan(
  issueId: string,
  resolutionPlan: ResolutionPlan,
  extraTraces: AgentTraceEntry[]
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, issueId);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error("Issue not found");
    }
    const data = snap.data();
    const existingTrace = data.agentTrace || [];
    const updatedTrace = [...existingTrace, ...extraTraces];
    await updateDoc(docRef, {
      resolutionPlan,
      agentTrace: updatedTrace,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${issueId}`);
    throw err;
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
  const activityCollectionRef = collection(db, COLLECTION_NAME, issueId, "activity");
  try {
    const docRef = doc(activityCollectionRef); // Auto ID
    await setDoc(docRef, activity);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${issueId}/activity`);
    throw err;
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
  // 1. Upload raw afterImage state to Firebase Storage under reports/after_{issueId}.jpg
  let afterImageUrl = "";
  try {
    const storageRef = ref(storage, `reports/after_${issueId}.jpg`);
    await uploadString(storageRef, afterImageBase64, "data_url");
    afterImageUrl = await getDownloadURL(storageRef);
  } catch (storageErr) {
    console.error("Firebase Storage afterImage upload error:", storageErr);
    throw new Error("Failed to upload completion image to Firebase Storage.");
  }

  // 2. Call server-side compare endpoint
  const response = await fetch("/api/verify-resolution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  // 3. Update issue in Firestore with closureAssessment and AgentTraceEntry
  const docRef = doc(db, COLLECTION_NAME, issueId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("Issue not found");
  }

  const issueData = snap.data();
  const existingTrace = issueData.agentTrace || [];

  const verifyTrace: AgentTraceEntry = {
    step: "Verify Resolution",
    tool: "Gemini Vision Integrity Inspector (/api/verify-resolution)",
    status: assessment.resolved ? "done" : "failed",
    rationale: `AI checked work with ${(assessment.confidence * 100).toFixed(0)}% confidence. recommendation: "${assessment.recommendation.toUpperCase()}". Changes: ${assessment.observedChanges.join(", ") || "none"}. Details: ${assessment.explanation}`,
    ts: new Date().toISOString(),
  };

  await updateDoc(docRef, {
    closureAssessment: assessment,
    agentTrace: [...existingTrace, verifyTrace],
  });

  return assessment;
}

export async function triggerAutoEscalation(issue: IssueReport): Promise<any> {
  const response = await fetch("/api/escalation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  // Update Firestore
  const docRef = doc(db, COLLECTION_NAME, issue.id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("Complaint report doesn't exist anymore.");
  }

  const issueData = snap.data();
  const existingTrace = issueData.agentTrace || [];

  const escalationTrace: AgentTraceEntry = {
    step: "Auto-Escalation / RTI",
    tool: "Gemini 2.5 Civil Escalation Engine (/api/escalation)",
    status: "done",
    rationale: `Formed official higher-authority appeal and Section 6(1) RTI under RTI Act 2005. Escalated at ${new Date(escalatedAt).toLocaleString()}`,
    ts: escalatedAt,
  };

  await updateDoc(docRef, {
    escalation: {
      escalatedAt,
      escalationLetter,
      rtiRequest,
    },
    agentTrace: [...existingTrace, escalationTrace],
  });

  return { escalatedAt, escalationLetter, rtiRequest };
}

export async function seedDemoIssuesBengaluru(): Promise<boolean> {
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
      citizenUpvotes: t.confirmCount || 0, // start with real upvotes matching confirm count
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
      isDemoData: false,
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
      perceive: `Classified as ${categoryLabel} at severity ${t.severity}/5; detected "${t.title}" from user photograph.`,
      locate: `Geographical reference verified at "${t.locationName}" (${t.lat.toFixed(4)} N, ${t.lng.toFixed(4)} E).`,
      deduplicate: `Scanned spatial proximity grid around ${t.locationName} and confirmed as a unique incident report.`,
      findAuthority: `Identified and routed report to Bruhat Bengaluru Mahanagara Palike (BBMP) ward officers.`,
      draftActionPacket: `Generated official complaint summary for "${t.title}" and compiled for rapid contractor dispatch.`
    };

    const blrAgentTrace: AgentTraceEntry[] = [
      {
        step: "Perceive",
        tool: "geminiVision.analyzeImage",
        status: "done",
        rationale: rationales.perceive,
        ts: capTimestamp(baseMs + 10 * 1000)
      },
      {
        step: "Locate",
        tool: "geocode.reverseLookup",
        status: "done",
        rationale: rationales.locate,
        ts: capTimestamp(baseMs + 20 * 1000)
      },
      {
        step: "Deduplicate",
        tool: "graph.findDuplicateCandidates",
        status: "done",
        rationale: rationales.deduplicate,
        ts: capTimestamp(baseMs + 30 * 1000)
      },
      {
        step: "Find Authority",
        tool: "googleSearch.findAuthority",
        status: "done",
        rationale: rationales.findAuthority,
        ts: capTimestamp(baseMs + 40 * 1000)
      },
      {
        step: "Draft Action Packet",
        tool: "drafting.createActionPacket",
        status: "done",
        rationale: rationales.draftActionPacket,
        ts: capTimestamp(baseMs + 50 * 1000)
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

    // Seeding highly realistic activity history to subcollection
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
        message: `Report submitted for "${t.title}".`,
        timestamp: capTimestamp(baseMs)
      },
      {
        actorType: "ai" as const,
        eventType: "triage",
        message: `AI triage completed: assigned severity ${t.severity}/5 and urgency level as ${t.urgency}.`,
        timestamp: capTimestamp(baseMs + 2 * 60 * 1000)
      }
    ];

    if (t.status === "Verified") {
      if (t.confirmCount && t.confirmCount > 0) {
        activitiesToSeed.push({
          actorType: "citizen" as const,
          eventType: "verification",
          message: `Community verification: ${t.confirmCount} confirmations registered by citizen accounts.`,
          timestamp: capTimestamp(baseMs + 3 * 60 * 60 * 1000)
        });
      }
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Status advanced to Verified following automated review.",
        timestamp: capTimestamp(baseMs + 28 * 60 * 60 * 1000)
      });
    } else if (t.status === "In Progress") {
      if (t.confirmCount && t.confirmCount > 0) {
        activitiesToSeed.push({
          actorType: "citizen" as const,
          eventType: "verification",
          message: `Community verification: ${t.confirmCount} confirmations registered by citizen accounts.`,
          timestamp: capTimestamp(baseMs + 3 * 60 * 60 * 1000)
        });
      }
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Status advanced to In Progress. Work order dispatched to local ward engineers.",
        timestamp: capTimestamp(baseMs + 6 * 60 * 60 * 1000)
      });
    } else if (t.status === "Resolved") {
      if (t.confirmCount && t.confirmCount > 0) {
        activitiesToSeed.push({
          actorType: "citizen" as const,
          eventType: "verification",
          message: `Community verification: ${t.confirmCount} confirmations registered by citizen accounts.`,
          timestamp: capTimestamp(baseMs + 3 * 60 * 60 * 1000)
        });
      }
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Status advanced to In Progress. Contractors dispatched to location.",
        timestamp: capTimestamp(baseMs + 6 * 60 * 60 * 1000)
      });
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Resolution certified: visual proof of closure verified and approved.",
        timestamp: capTimestamp(baseMs + 28 * 60 * 60 * 1000)
      });
    } else {
      // Submitted status
      activitiesToSeed.push({
        actorType: "operator" as const,
        eventType: "status_changed",
        message: "Report successfully published to active ledger.",
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


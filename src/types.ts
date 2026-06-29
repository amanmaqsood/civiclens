import type { IssueStatusKey } from "./constants/status";

export type ActiveView = "landing" | "report" | "success" | "issues" | "detail" | "duplicate" | "dashboard" | "submitting";

export interface AgentTraceEntry {
  step: string;
  tool: string;
  status: "done" | "skipped" | "failed";
  rationale: string;
  ts: string;
  inputDigest?: string;        // short summary of what went into the step
  outputSummary?: string;      // short summary of the structured result
  confidence?: number;         // 0..1 where the model returns one
  durationMs?: number;         // measured latency of the step
  retried?: boolean;           // a retry/repair was needed
  fallbackUsed?: boolean;      // a fallback path was taken
  errorMsg?: string;           // present if the step failed
}

export interface ResolutionPlan {
  recommendedAuthority: string;
  contactChannel: string;
  slaDays: number;
  actionPacket: {
    subject: string;
    body: string;
    bodyHindi?: string;
    summaryHindi?: string;
    nextActions: string[];
  };
  groundingSources: Array<string | {
    title: string;
    url: string;
    claimSupported: string;
    sourceType: "sourced" | "estimated";
  }>;
}

export interface ClosureAssessment {
  resolved: boolean;
  confidence: number;
  observedChanges: string[];
  recommendation: "resolve" | "request_more_evidence" | "reopen";
  explanation: string;
  afterImage?: string;
}

export interface IssueReport {
  id: string;
  ticketId: string;
  image: string; // Base64 or ObjectURL preview
  lat?: number;
  lng?: number;
  locationName?: string;
  category: string;
  description: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
  triagedAt?: string;
  verifiedAt?: string;
  assignedAt?: string;
  workStartedAt?: string;
  closureSubmittedAt?: string;
  resolvedAt?: string;
  reopenedAt?: string;
  status: IssueStatusKey;
  citizenUpvotes: number;
  userId: string;
  isDemoData?: boolean;
  
  // AI-Enhanced Analysis Fields
  title?: string;
  summary?: string;
  titleHi?: string;
  summaryHi?: string;
  severity?: number;
  urgency?: "routine" | "priority" | "urgent";
  visibleHazards?: string[];
  affectedArea?: "single_property" | "street" | "neighborhood" | "unknown";
  privacyFlags?: string[];
  confidence?: number;
  reportCount?: number;
  priorityScore?: number;
  confirmCount?: number;
  disputeCount?: number;
  verificationStatus?: string;
  agentTrace?: AgentTraceEntry[];
  perceiveMeta?: any;
  resolutionPlan?: ResolutionPlan;
  closureAssessment?: ClosureAssessment;
  slaDeadline?: string;
  slaPolicy?: {
    category: string;
    severity: number;
    urgency: "routine" | "priority" | "urgent";
    slaHours: number;
    slaDays: number;
    matrixVersion: string;
    source: string;
    computedAt?: string;
  };
  slaLadder?: {
    currentStage?: string;
    nextStage?: string | null;
    updatedAt?: string;
    reminderAt?: string;
    escalatedAt?: string;
    rtiDraftedAt?: string;
    firstAppealDraftedAt?: string;
    deadlines?: {
      reminderDueAt?: string;
      escalationDueAt?: string;
      rtiDueAt?: string;
      firstAppealDueAt?: string;
    };
  };
  escalation?: {
    escalatedAt: string;
    escalationLetter: string;
    rtiRequest: string;
    autoDraftedAt?: string;
    escalationLevel?: number;
    source?: string;
    rtiPdfDataUri?: string;
    rtiPdfFilename?: string;
    rtiPdfGeneratedAt?: string;
    rtiPdfBytes?: number;
    firstAppealLetter?: string;
    firstAppealDraftedAt?: string;
  };
  dispatch?: {
    deliveryId: string;
    channel: string;
    endpoint: string;
    status: string;
    httpStatus?: number | null;
    dispatchedAt?: string;
  };
  followUp?: {
    action: string;
    reasoning: string;
    confidence?: number | null;
    decidedAt?: string;
    aiFallback?: boolean;
    source?: string;
  };
}

export interface IssueActivity {
  id: string;
  actorType: "operator" | "citizen" | "ai";
  eventType: string; // e.g. "status_changed", "created", "evidence_submitted"
  message: string;
  timestamp: string;
}

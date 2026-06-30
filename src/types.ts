import type { IssueStatusKey } from "./constants/status";

export type ActiveView = "landing" | "report" | "success" | "issues" | "detail" | "duplicate" | "dashboard" | "submitting";

export interface AgentTraceEntry {
  step: string;
  tool: string;
  status: "done" | "skipped" | "failed" | "fallback" | "running";
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
  ghostFlaggedAt?: string;
  ghostRecommendation?: string;
}

export interface GhostForensics {
  ghostClosureLikely: boolean;
  confidence: number;
  signals: string[];
  recommendation: "keep_resolved" | "request_more_evidence" | "reopen";
  explanation: string;
  checkedAt?: string;
  auditImage?: string | null;
  autoReopened?: boolean;
  officerId?: string;
  officerPenaltyPoints?: number;
  model?: string;
  retried?: boolean;
  durationMs?: number;
}

export interface TrustConsensus {
  confirmWeight: number;
  disputeWeight: number;
  totalWeight: number;
  confirmVotes: number;
  disputeVotes: number;
  collapsedVotes: number;
  consensusRatio: number;
  brigadingRisk: "low" | "watch" | "high";
  autoResolveThreshold: number;
  appealable: boolean;
  publicExplanation: string;
  autoResolvedAt?: string;
  autoResolvedBy?: string;
  appealedAt?: string;
  appealStatus?: "pending" | "accepted" | "rejected";
  lastVoteAt?: string;
  updatedAt?: string;
  version?: string;
}

export interface TrustAppeal {
  byUid?: string;
  byRole?: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  appealedAt: string;
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
  autoMerged?: boolean;
  duplicateSimilarity?: number | null;
  duplicateDistanceM?: number | null;
  dedup?: {
    lastAutoMergedAt?: string;
    lastAutoMergedBy?: string;
    lastSimilarity?: number;
    lastDistanceM?: number;
    method?: string;
  };
  priorityScore?: number;
  confirmCount?: number;
  disputeCount?: number;
  weightedConfirmScore?: number;
  weightedDisputeScore?: number;
  verificationStatus?: string;
  trustConsensus?: TrustConsensus;
  trustAppeal?: TrustAppeal;
  agentTrace?: AgentTraceEntry[];
  perceiveMeta?: any;
  resolutionPlan?: ResolutionPlan;
  closureAssessment?: ClosureAssessment;
  ghostForensics?: GhostForensics;
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

export interface CivicEvent {
  id: string;
  issueId?: string | null;
  actorType: "citizen" | "operator" | "ai" | "worker" | "system";
  source: "api" | "agent" | "worker" | "gemini" | "system";
  status: "attempted" | "succeeded" | "failed";
  severity: "debug" | "info" | "warn" | "error";
  eventType: string;
  message: string;
  timestamp: string;
  createdAt?: string;
  requestId?: string | null;
  idempotencyKey?: string | null;
}

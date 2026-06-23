export type ActiveView = "landing" | "report" | "success" | "issues" | "detail" | "duplicate" | "dashboard";

export interface AgentTraceEntry {
  step: string;
  tool: string;
  status: "done" | "skipped" | "failed";
  rationale: string;
  ts: string;
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
  groundingSources: string[];
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
  status: "Submitted" | "Verified" | "In Progress" | "Resolved";
  citizenUpvotes: number;
  userId: string;
  isDemoData?: boolean;
  
  // AI-Enhanced Analysis Fields
  title?: string;
  summary?: string;
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
  resolutionPlan?: ResolutionPlan;
  closureAssessment?: ClosureAssessment;
  escalation?: {
    escalatedAt: string;
    escalationLetter: string;
    rtiRequest: string;
  };
}

export interface IssueActivity {
  id: string;
  actorType: "operator" | "citizen" | "ai";
  eventType: string; // e.g. "status_changed", "created", "evidence_submitted"
  message: string;
  timestamp: string;
}



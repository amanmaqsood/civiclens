export const ISSUE_STATUS_KEYS = ["submitted", "verified", "in_progress", "resolved"] as const;

export type IssueStatusKey = (typeof ISSUE_STATUS_KEYS)[number];

export const ISSUE_STATUS_LABELS: Record<IssueStatusKey, string> = {
  submitted: "Submitted",
  verified: "Verified",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export const ISSUE_STATUS_DESCRIPTIONS: Record<IssueStatusKey, string> = {
  submitted: "Report saved and awaiting operator review",
  verified: "Evidence checked and accepted for action",
  in_progress: "Assigned work is in progress",
  resolved: "Closure evidence has been accepted",
};

const legacyStatusMap: Record<string, IssueStatusKey> = {
  submitted: "submitted",
  Submitted: "submitted",
  verified: "verified",
  Verified: "verified",
  in_progress: "in_progress",
  "In Progress": "in_progress",
  resolved: "resolved",
  Resolved: "resolved",
};

export function coerceIssueStatus(value: unknown): IssueStatusKey | null {
  if (typeof value !== "string") return null;
  return legacyStatusMap[value] || null;
}

export function normalizeIssueStatus(value: unknown): IssueStatusKey {
  return coerceIssueStatus(value) || "submitted";
}

export function issueStatusLabel(value: unknown): string {
  return ISSUE_STATUS_LABELS[normalizeIssueStatus(value)];
}

export function issueStatusDescription(value: unknown): string {
  return ISSUE_STATUS_DESCRIPTIONS[normalizeIssueStatus(value)];
}

export function issueStatusToneClass(value: unknown): string {
  switch (normalizeIssueStatus(value)) {
    case "verified":
      return "bg-status-verified/10 border-status-verified/30 text-status-verified-ink";
    case "in_progress":
      return "bg-status-progress/15 border-status-progress/35 text-status-progress-ink";
    case "resolved":
      return "bg-status-resolved/10 border-status-resolved/30 text-status-resolved-ink";
    default:
      return "bg-status-submitted/10 border-status-submitted/30 text-status-submitted-ink";
  }
}

export function issueStatusBarClass(value: unknown): string {
  switch (normalizeIssueStatus(value)) {
    case "verified":
      return "bg-status-verified";
    case "in_progress":
      return "bg-status-progress";
    case "resolved":
      return "bg-status-resolved";
    default:
      return "bg-status-submitted";
  }
}

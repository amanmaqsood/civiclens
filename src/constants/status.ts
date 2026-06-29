export const ISSUE_STATUS_KEYS = ["submitted", "verified", "in_progress", "resolved"] as const;

export type IssueStatusKey = (typeof ISSUE_STATUS_KEYS)[number];

export const ISSUE_STATUS_LABELS: Record<IssueStatusKey, string> = {
  submitted: "Submitted",
  verified: "Verified",
  in_progress: "In Progress",
  resolved: "Resolved",
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

export function issueStatusToneClass(value: unknown): string {
  switch (normalizeIssueStatus(value)) {
    case "verified":
      return "bg-marigold/10 border-marigold/25 text-marigold-ink";
    case "in_progress":
      return "bg-[#3B82F6]/10 border-[#3B82F6]/25 text-[#1D4ED8]";
    case "resolved":
      return "bg-verify/10 border-verify/25 text-[#047857]";
    default:
      return "bg-slate/10 border-slate/25 text-ink-2";
  }
}

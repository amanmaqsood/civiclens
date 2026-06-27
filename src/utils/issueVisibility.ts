import type { IssueReport } from "../types";

type IssueVisibilityFields = Partial<
  Pick<IssueReport, "ticketId" | "title" | "summary" | "description" | "locationName">
>;

const INTERNAL_TEST_PATTERNS = [
  /\bsynthetic cloud run smoke test\b/i,
  /\bcloud run smoke\b/i,
  /\bsmoke[-_\s]?test\b/i,
  /\binternal[-_\s]?test\b/i,
];

export function isInternalSmokeTestIssue(issue: IssueVisibilityFields): boolean {
  const searchableText = [
    issue.ticketId,
    issue.title,
    issue.summary,
    issue.description,
    issue.locationName,
  ]
    .filter(Boolean)
    .join(" ");

  if (!searchableText) return false;

  return INTERNAL_TEST_PATTERNS.some((pattern) => pattern.test(searchableText));
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("lifecycle status accessibility", () => {
  it("centralizes lifecycle status metadata, contrast-safe tones, and bar colors", () => {
    const status = readProjectFile("src/constants/status.ts");
    const css = readProjectFile("src/index.css");

    expect(status).toContain("ISSUE_STATUS_DESCRIPTIONS");
    expect(status).toContain("issueStatusDescription");
    expect(status).toContain("issueStatusBarClass");
    expect(status).toContain("text-status-submitted-ink");
    expect(status).toContain("text-status-verified-ink");
    expect(status).toContain("text-status-progress-ink");
    expect(status).toContain("text-status-resolved-ink");
    expect(status).not.toContain("#3B82F6");

    for (const token of [
      "--color-status-submitted-ink",
      "--color-status-verified-ink",
      "--color-status-progress-ink",
      "--color-status-resolved-ink",
    ]) {
      expect(css).toContain(token);
    }
  });

  it("renders lifecycle badges with icons, labels, and accessible descriptions", () => {
    const badge = readProjectFile("src/components/LifecycleStatusBadge.tsx");

    expect(badge).toContain("STATUS_ICONS");
    expect(badge).toContain("data-lifecycle-status");
    expect(badge).toContain("aria-label={`Lifecycle status:");
    expect(badge).toContain("LifecycleStatusIcon");
    expect(badge).toContain("showDescription");
  });

  it("uses the lifecycle badge on public, operator, and dashboard status surfaces", () => {
    const issueList = readProjectFile("src/components/IssueListWithFilter.tsx");
    const queue = readProjectFile("src/components/OperatorQueue.tsx");
    const detail = readProjectFile("src/components/IssueDetailPage.tsx");
    const operatorDetail = readProjectFile("src/components/OperatorDetailView.tsx");
    const dashboard = readProjectFile("src/components/ImpactDashboard.tsx");

    expect(issueList).toContain("LifecycleStatusBadge");
    expect(queue).toContain("LifecycleStatusBadge");
    expect(detail).toContain("LifecycleStatusBadge");
    expect(detail).toContain("LifecycleStatusIcon");
    expect(operatorDetail).toContain("LifecycleStatusBadge");
    expect(dashboard).toContain("LifecycleStatusBadge");
    expect(dashboard).toContain("issueStatusBarClass");
    expect(dashboard).not.toContain("bg-[#3B82F6]");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("release golden path and accessibility coverage", () => {
  it("keeps the report to duplicate decision to persisted case flow wired", () => {
    const app = readProjectFile("src/App.tsx");
    const report = readProjectFile("src/components/ReportPage.tsx");

    expect(report).toContain('/api/analyze-report');
    expect(report).toContain("compressImage(file)");
    expect(app).toContain("findDuplicateCandidates(reportData)");
    expect(app).toContain("checkDuplicateWithAI(reportData");
    expect(app).toContain("DuplicateCheckPage");
    expect(app).toContain("handleMergeDuplicate");
    expect(app).toContain("handleCreateStandaloneAnyway");
    expect(app).toContain("submitEvidenceForIssue");
    expect(app).toContain("saveNewStandaloneReport");
  });

  it("keeps persisted agent runs and lifecycle controls behind the operator boundary", () => {
    const detail = readProjectFile("src/components/IssueDetailPage.tsx");
    const api = readProjectFile("src/services/api.ts");
    const operator = readProjectFile("src/components/OperatorDetailView.tsx");

    expect(detail).toContain("fetchLatestAgentRun(issue.id)");
    expect(detail).toContain("This public detail page only displays persisted server-generated tool records");
    expect(detail).toContain("VerificationPanel");
    expect(detail).not.toContain("runAgentForIssue(issue.id)");
    expect(detail).not.toContain("ResolutionPlanWidget");
    expect(detail).not.toContain("AutoEscalationPanel");
    expect(api).toContain("/api/agent/run");
    expect(api).toContain("/agent-runs/latest");
    expect(operator).toContain("runAgentForIssue(issue.id, { demoOperator })");
    expect(operator).toContain("Watch agents think");
    expect(operator).toContain("ClosureVerificationPanel");
    expect(operator).toContain("AutoEscalationPanel");
    expect(operator).toContain("Approve draft routing/action packet");
    expect(operator).toContain("Finalize escalation/RTI draft");
    expect(operator).toContain("Written rationale is required");
  });

  it("keeps core keyboard/accessibility landmarks and target-size markers", () => {
    const app = readProjectFile("src/App.tsx");
    const header = readProjectFile("src/components/Header.tsx");
    const queue = readProjectFile("src/components/OperatorQueue.tsx");
    const detail = readProjectFile("src/components/OperatorDetailView.tsx");
    const dashboard = readProjectFile("src/components/ImpactDashboard.tsx");

    expect(app).toContain("Skip to main content");
    expect(app).toContain('id="main-content"');
    expect(header).toContain("aria-pressed");
    expect(header.match(/aria-label/g)?.length || 0).toBeGreaterThanOrEqual(6);
    expect(queue).toContain("aria-pressed={selectedIssueId === issue.id}");
    expect(queue).toContain("min-h-[44px]");
    expect(detail).toContain('role="dialog"');
    expect(detail).toContain('aria-modal="true"');
    expect(detail).toContain("min-h-[44px]");
    expect(dashboard).toContain("aria-pressed");
  });
});

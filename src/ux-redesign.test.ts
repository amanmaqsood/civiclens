import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("UX redesign contract", () => {
  it("keeps the responsive shell and mobile actions wired", () => {
    const app = readProjectFile("src/App.tsx");
    const bottomNav = readProjectFile("src/components/AppBottomNav.tsx");
    const floatingAction = readProjectFile("src/components/FloatingReportAction.tsx");
    const header = readProjectFile("src/components/Header.tsx");

    expect(app).toContain("AppBottomNav");
    expect(app).toContain("FloatingReportAction");
    expect(app).toContain('id="operator-command-center"');
    expect(bottomNav).toContain('id="mobile-bottom-nav"');
    expect(floatingAction).toContain('id="floating-report-cta"');
    expect(header).toContain("sticky top-0");
    expect(header).toContain("min-h-[44px]");
    expect(header).toContain('id="header-account-button"');
    expect(header).toContain('id="account-menu"');
    expect(header).toContain("Citizen session");
    expect(header).toContain("Operator access status");
    expect(header).toContain("Sign in with Google");
  });

  it("keeps the landing page map-first and truthful about synthetic demo data", () => {
    const landing = readProjectFile("src/components/LandingPage.tsx");

    expect(landing).toContain("CivicLens Field Command Center");
    expect(landing).toContain("Review map cases");
    expect(landing).toContain("Demo stories");
    expect(landing).toContain("Synthetic demo visible");
    expect(landing).toContain("slice(0, 3)");
    expect(landing).toContain('id="show-all-demo-data"');
    expect(landing).toContain("isInternalSmokeTestIssue");
    expect(landing).toContain("They are not live civic complaints");
    expect(landing).toContain("Independent civic pilot. Drafts stay inside CivicLens until a human acts outside the app.");
  });

  it("keeps the report flow stepper, location denial, and manual pin fallback", () => {
    const report = readProjectFile("src/components/ReportPage.tsx");
    const clarification = readProjectFile("src/components/ReportClarificationView.tsx");

    expect(report).toContain('id="report-stepper"');
    expect(report).toContain("Use my location");
    expect(report).toContain('id="manual-pin-fallback"');
    expect(report).toContain("Use manual map pin");
    expect(report).toContain("Coordinates missing. Use location or manual pin.");
    expect(report).toContain("Take photo or upload proof");
    expect(report.match(/capture="environment"/g)?.length || 0).toBeGreaterThanOrEqual(2);
    expect(clarification).toContain("Low-confidence Gemini triage");
  });

  it("keeps persisted agent trace and operator demo boundary visible", () => {
    const trace = readProjectFile("src/components/AgentTraceTimeline.tsx");
    const detail = readProjectFile("src/components/IssueDetailPage.tsx");
    const queue = readProjectFile("src/components/OperatorQueue.tsx");
    const closure = readProjectFile("src/components/ClosureVerificationPanel.tsx");

    expect(trace).toContain("Agent tool timeline");
    expect(trace).toContain("Persisted server run");
    expect(trace).toContain("request_human_approval");
    expect(detail).toContain("fetchLatestAgentRun(issue.id)");
    expect(detail).toContain("Persisted run");
    expect(detail).toContain("finiteNumber(issue.confidence)");
    expect(detail).toContain("hasCoordinates");
    expect(queue).toContain("Demo actions are server-limited");
    expect(closure).toContain("recommendation");
    expect(closure).toContain("capture=\"environment\"");
    expect(closure).not.toContain("auto-resolve");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

describe("truth boundary copy", () => {
  it("does not reintroduce high-risk positive claims removed in milestone 1", () => {
    const files = [
      "README.md",
      "security_spec.md",
      "server.ts",
      "src/i18n.ts",
      "src/services/issues.ts",
      "src/components/AgentTraceTimeline.tsx",
      "src/components/Header.tsx",
      "src/components/ReportFallbackForm.tsx",
      "src/components/ReportProgressView.tsx",
      "src/components/ResolutionPlanWidget.tsx",
    ];

    const bannedSnippets = [
      "autonomous civic-issue resolution agent",
      "SLA Locked",
      "Government SLA Routing",
      "routes a formal complaint packet directly",
      "Official grievance escalated",
      "Autonomous routing decision:",
      "Generated official complaint summary",
      "Report successfully published to active ledger",
      "AI Analysis Active",
      "Running analysis...",
      "India · Operator Portal",
      "realistic mock data",
      "Official Resolution SLA",
      "Escalation & RTI Filing",
      "Confirm & Submit grievance",
      "Report submitted successfully!",
      "Official Ticket ID / Reference ID",
    ];

    const combined = files.map((path) => readProjectFile(path)).join("\n");

    for (const snippet of bannedSnippets) {
      expect(combined).not.toContain(snippet);
    }
  });
});

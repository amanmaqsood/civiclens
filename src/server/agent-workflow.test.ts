import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("persisted server agent workflow", () => {
  it("loads canonical issue data by issueId and persists run/step records", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('app.post("/api/agent/run"');
    expect(server).toContain("const { issueId } = req.body || {}");
    expect(server).toContain("loadNearbyCandidates(issueId, issue)");
    expect(server).toContain('adminDb.collection("agentRuns")');
    expect(server).toContain('issueRef.collection("agentSteps")');
    expect(server).toContain('app.get("/api/issues/:issueId/agent-runs/latest"');
    expect(server).toContain('name: "search_nearby_cases"');
    expect(server).toContain('name: "record_event"');
    expect(server).toContain("claimSupported");
    expect(server).toContain("server-loaded candidate set");
    expect(server).toContain("const cid = result?.candidateId");
    expect(server).toContain("const requiredAgentSteps = [");
    expect(server).toContain('status: "skipped"');
    expect(server).toContain("No nearby candidates were available to compare");
    expect(server).toContain("steps.splice(0, steps.length, ...normalizedSteps)");
    expect(server).not.toContain("const { issue, candidates } = req.body");
  });

  it("uses the server agent API from the issue detail page without sending candidates", () => {
    const detail = readProjectFile("src/components/IssueDetailPage.tsx");

    expect(detail).toContain("runAgentForIssue(issue.id)");
    expect(detail).toContain("fetchLatestAgentRun(issue.id)");
    expect(detail).not.toContain("findDuplicateCandidates(issue)");
    expect(detail).not.toContain("updateIssueAgentTraceAndPlan(");
  });
});

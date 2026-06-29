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
    expect(server).not.toContain("const { issue, candidates } = req.body");
  });

  it("is a genuine planner-driven agent, not a scripted fixed-sequence with a fabricated trace", () => {
    const server = readProjectFile("server.ts");

    // The agent must NOT be told a fixed step order, and must NOT pad/overwrite the trace.
    expect(server).not.toContain("Steps: 1) call search_nearby_cases");
    expect(server).not.toContain("const requiredAgentSteps = [");
    expect(server).not.toContain("steps.splice(0, steps.length, ...normalizedSteps)");

    // It must decide for itself, with a dynamic (not 8-capped) loop, and persist the real trace.
    expect(server).toContain("There is NO fixed script");
    expect(server).toContain("MAX_AGENT_TURNS");
    expect(server).toContain("reflects exactly the tools the agent chose to call");

    // calculate_priority must compute from canonical data, not echo model args.
    expect(server).toContain("canonical issue + server-loaded candidates");

    // The model's own reasoning text is captured per turn.
    expect(server).toContain("const turnReasoning = (response.text");

    // A second Gemini QA pass reviews the trace and can persist corrections.
    expect(server).toContain("runAgentSelfCritique");
    expect(server).toContain('step: "self_critique"');
    expect(server).toContain("agent_self_critique_corrected");
    expect(server).toContain("qaAnomaly");
  });

  it("bounds agent execution with an abortable timeout", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("CIVICLENS_AGENT_TIMEOUT_MS");
    expect(server).toContain("AbortSignal.timeout(agentTimeoutMs)");
    expect(server).toContain("generateContentWithRetry(ai, {");
    expect(server).toContain("signal: agentSignal");
    expect(server).toContain("usageAccumulator: agentGeminiUsage");
    expect(server).toContain("agent_run_timed_out");
    expect(server).toContain("Agent run timed out before completing.");
  });

  it("uses the server agent API from the operator detail page without sending candidates", () => {
    const detail = readProjectFile("src/components/IssueDetailPage.tsx");
    const operator = readProjectFile("src/components/OperatorDetailView.tsx");

    expect(detail).toContain("fetchLatestAgentRun(issue.id)");
    expect(detail).not.toContain("runAgentForIssue(issue.id)");
    expect(operator).toContain("runAgentForIssue(issue.id, { demoOperator })");
    expect(operator).toContain("fetchLatestAgentRun(issue.id)");
    expect(detail).not.toContain("findDuplicateCandidates(issue)");
    expect(detail).not.toContain("updateIssueAgentTraceAndPlan(");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("live agent event stream", () => {
  it("exposes an authenticated server-sent event stream for agent runs", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('app.get("/api/issues/:issueId/agent-events/stream"');
    expect(server).toContain('"Content-Type", "text/event-stream; charset=utf-8"');
    expect(server).toContain("publishAgentStreamEvent");
    expect(server).toContain('type: "agent_start"');
    expect(server).toContain('type: "agent_step"');
    expect(server).toContain('type: "agent_retry"');
    expect(server).toContain('type: "agent_complete"');
    expect(server).toContain('eventType: "agent_run_started"');
  });

  it("reads the stream from the operator UI using authenticated fetch headers", () => {
    const api = readProjectFile("src/services/api.ts");
    const operator = readProjectFile("src/components/OperatorDetailView.tsx");
    const trace = readProjectFile("src/components/AgentTraceTimeline.tsx");

    expect(api).toContain("streamAgentRunEvents");
    expect(api).toContain('headers: { Accept: "text/event-stream" }');
    expect(api).toContain("response.body.getReader()");
    expect(operator).toContain("streamAgentRunEvents(issue.id");
    expect(operator).toContain("handleAgentStreamEvent");
    expect(operator).toContain("Watch agents think");
    expect(trace).toContain('planner: "Execution planner"');
    expect(trace).toContain('propose_merge: "Merge proposal"');
    expect(trace).not.toContain('"calculate_priority"');
  });
});

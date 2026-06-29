import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("server event spine", () => {
  it("records append-only civic events beside existing activity docs", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('type EventActorType = "citizen" | "operator" | "ai" | "worker" | "system"');
    expect(server).toContain("function sanitizeEventPayload");
    expect(server).toContain("function buildEventDocument");
    expect(server).toContain("async function recordEvent");
    expect(server).toContain('adminDb.collection("events").doc()');
    expect(server).toContain('issueRef.collection("events").doc');
    expect(server).toContain('"civic_event_recorded"');

    expect(server).toContain("async function addServerActivity");
    expect(server).toContain('issueRef.collection("activity").doc()');
    expect(server).toContain("batch.set(activityRef, activity)");
    expect(server).toContain("payload: { activityId: activityRef.id }");
  });

  it("threads events through human, AI, agent, and worker actions", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('eventType: "created"');
    expect(server).toContain('eventType: "status_changed"');
    expect(server).toContain('eventType: "support_recorded"');
    expect(server).toContain('eventType: "translations_saved"');
    expect(server).toContain('eventType: "ai_report_analysis"');
    expect(server).toContain('eventType: "ai_duplicate_check"');
    expect(server).toContain('eventType: "ai_resolution_plan"');
    expect(server).toContain('eventType: "ai_closure_verification"');
    expect(server).toContain('eventType: "ai_escalation_draft"');
    expect(server).toContain('eventType: "ai_translation"');
    expect(server).toContain('eventType: "agent_triage_completed"');
    expect(server).toContain('eventType: "agent_run_completed"');
    expect(server).toContain('eventType: "worker_job_requested"');
    expect(server).toContain('eventType: "worker_job_completed"');
    expect(server).toContain('eventType: "worker_sla_completed"');
    expect(server).toContain('eventType: "worker_followup_completed"');
    expect(server).toContain('eventType: "worker_predictive_completed"');
    expect(server).toContain('eventType: "worker_embed_completed"');
  });

  it("keeps event writes server-owned in Firestore rules", () => {
    const rules = readProjectFile("firestore.rules");

    expect(rules).toContain("match /events/{eventId}");
    expect(rules).toContain("allow get, list: if isSignedIn();");
    expect(rules).toContain("allow create, update, delete: if false;");
    expect(rules).toContain("allow read, write: if false;");
  });
});

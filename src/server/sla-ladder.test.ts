import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("SLA ladder worker", () => {
  it("stamps a category/severity SLA policy and deadline on report and routing flows", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("const SLA_MATRIX_HOURS");
    expect(server).toContain("function resolveSlaPolicy");
    expect(server).toContain("source: \"category_severity_matrix\"");
    expect(server).toContain("Object.assign(report, buildSlaIssueFields(report, nowIso))");
    expect(server).toContain("Object.assign(updateData, buildSlaIssueFields({ ...issueData, resolutionPlan: planResult.data }, updateData.updatedAt))");
    expect(server).toContain("...buildSlaIssueFields(data, nowIso)");
    expect(server).toContain("Object.assign(agentIssueUpdates, buildSlaIssueFields({ ...issueForPlan, resolutionPlan }, nowIso))");
    expect(server).toContain("slaDeadline: deadlines.escalationDueAt");
  });

  it("advances the worker through reminder, escalation, RTI PDF, and first appeal stages", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("reminder -> escalation draft -> RTI PDF -> first appeal draft");
    expect(server).toContain("function nextPendingSlaStage");
    expect(server).toContain("eventType = \"sla_ladder_reminder\"");
    expect(server).toContain("eventType = \"sla_ladder_escalated\"");
    expect(server).toContain("eventType = \"sla_ladder_rti_pdf\"");
    expect(server).toContain("eventType = \"sla_ladder_first_appeal\"");
    expect(server).toContain("buildRtiPdfArtifact(issue, rtiRequest, nowIso)");
    expect(server).toContain("buildFirstAppealDraft(issue, nowIso)");
    expect(server).toContain("issueId: isSafeDocumentId(req.body?.issueId) ? req.body.issueId : undefined");
  });

  it("surfaces SLA ladder artifacts in the client issue model and escalation panel", () => {
    const types = readProjectFile("src/types.ts");
    const service = readProjectFile("src/services/issues.ts");
    const panel = readProjectFile("src/components/AutoEscalationPanel.tsx");

    expect(types).toContain("slaPolicy?:");
    expect(types).toContain("slaLadder?:");
    expect(types).toContain("rtiPdfDataUri?: string");
    expect(types).toContain("firstAppealLetter?: string");
    expect(service).toContain("slaDeadline: data.slaDeadline || undefined");
    expect(service).toContain("slaLadder: data.slaLadder || undefined");
    expect(panel).toContain("download={escalation.rtiPdfFilename || \"CivicLens-RTI-draft.pdf\"}");
    expect(panel).toContain("First Appeal Draft");
  });
});

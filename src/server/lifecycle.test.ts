import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("civic lifecycle approvals", () => {
  it("requires closure evidence and records approval documents for status transitions", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("Closure evidence and assessment are required before resolving.");
    expect(server).toContain('tx.set(ref.collection("approvals").doc()');
    expect(server).toContain("closure_resolution");
    expect(server).toContain("routing_action_packet");
    expect(server).toContain("escalation_finalization");
    expect(server).toContain("Operator rationale is required");
    expect(server).toContain("adminDb.runTransaction");
  });

  it("threads operator rationale through frontend lifecycle actions", () => {
    const service = readProjectFile("src/services/issues.ts");
    const operatorDetail = readProjectFile("src/components/OperatorDetailView.tsx");

    expect(service).toContain("rationale: options.rationale");
    expect(service).toContain("/routing-approval");
    expect(service).toContain("/escalation-finalize");
    expect(operatorDetail).toContain("approvalRationale");
    expect(operatorDetail).toContain("Approve draft routing/action packet");
    expect(operatorDetail).toContain("Finalize escalation/RTI draft");
  });

  it("keeps approval records server-owned in Firestore rules", () => {
    const rules = readProjectFile("firestore.rules");

    expect(rules).toContain("match /approvals/{approvalId}");
    expect(rules).toContain("allow create, update, delete: if false;");
  });
});

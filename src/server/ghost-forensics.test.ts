import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("ghost closure forensics", () => {
  it("compares original, closure, and audit images before an automatic reopen", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('app.post("/api/issues/:issueId/ghost-forensics"');
    expect(server).toContain("Image 1: original report before repair.");
    expect(server).toContain("Image 2: claimed closure or after-repair evidence.");
    expect(server).toContain("Image 3: fresh field audit evidence after the closure claim.");
    expect(server).toContain('recommendation === "reopen" && confidence >= 0.65');
    expect(server).toContain('updates.status = currentStatus === "resolved" ? "in_progress" : currentStatus');
  });

  it("records the ghost finding, event spine, and officer accountability penalty", () => {
    const server = readProjectFile("server.ts");
    const perimeter = readProjectFile("src/server/perimeter.ts");

    expect(server).toContain("ghostForensics");
    expect(server).toContain('eventType: shouldReopen ? "ghost_closure_reopened" : "ghost_closure_checked"');
    expect(server).toContain('eventType: "ai_ghost_forensics"');
    expect(server).toContain('adminDb.collection("officerAccountability").doc(officerId)');
    expect(server).toContain("ghostPenaltyPoints: FieldValue.increment(penaltyPoints)");
    expect(perimeter).toContain('path.endsWith("/ghost-forensics")');
  });

  it("threads ghost forensics into issue reads and public detail UI", () => {
    const types = readProjectFile("src/types.ts");
    const service = readProjectFile("src/services/issues.ts");
    const detail = readProjectFile("src/components/IssueDetailPage.tsx");

    expect(types).toContain("export interface GhostForensics");
    expect(types).toContain("ghostForensics?: GhostForensics");
    expect(service).toContain("ghostForensics: data.ghostForensics || undefined");
    expect(detail).toContain('id="ghost-forensics-card"');
    expect(detail).toContain("Ghost Closure Forensics");
  });
});

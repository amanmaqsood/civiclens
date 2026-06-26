import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("server-owned data integrity", () => {
  it("denies direct client writes to issue-owned Firestore documents", () => {
    const rules = readProjectFile("firestore.rules");

    expect(rules).toContain("match /issues/{issueId}");
    expect(rules).toContain("allow create, update, delete: if false;");
    expect(rules).toContain("match /evidence/{evidenceId}");
    expect(rules).toContain("match /verifications/{userId}");
    expect(rules).toContain("match /support/{userId}");
    expect(rules).toContain("match /activity/{activityId}");
  });

  it("limits Storage writes to signed-in user image paths", () => {
    const rules = readProjectFile("storage.rules");

    expect(rules).toContain("match /reports/{userId}/{issueId}/{fileName}");
    expect(rules).toContain("match /evidence/{userId}/{issueId}/{fileName}");
    expect(rules).toContain("match /closures/{userId}/{issueId}/{fileName}");
    expect(rules).toContain("request.auth.uid == userId");
    expect(rules).toContain("request.resource.size <= 5 * 1024 * 1024");
    expect(rules).toContain("image/(jpeg|png|webp)");
  });

  it("keeps count-affecting server writes transactional", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('app.post("/api/issues/create"');
    expect(server).toContain('app.post("/api/issues/:issueId/evidence"');
    expect(server).toContain('app.post("/api/issues/:issueId/support"');
    expect(server).toContain('app.post("/api/issues/:issueId/verification"');
    expect(server.match(/runTransaction/g)?.length || 0).toBeGreaterThanOrEqual(5);
  });
});

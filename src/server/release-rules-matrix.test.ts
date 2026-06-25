import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("release rules matrix", () => {
  it("keeps privileged issue, audit, approval, and agent fields server-owned in Firestore rules", () => {
    const rules = readProjectFile("firestore.rules");

    expect(rules).toContain("match /issues/{issueId}");
    expect(rules).toContain("allow get, list: if isSignedIn();");
    expect(rules).toContain("allow create, update, delete: if false;");
    expect(rules).toContain("match /activity/{activityId}");
    expect(rules).toContain("match /approvals/{approvalId}");
    expect(rules).toContain("match /agentSteps/{stepId}");
    expect(rules).toContain("match /{document=**}");
    expect(rules).toContain("allow read, write: if false;");
  });

  it("prevents clients from self-assigning privileged user roles", () => {
    const rules = readProjectFile("firestore.rules");

    expect(rules).toContain("match /users/{userId}");
    expect(rules).toContain("!request.resource.data.keys().hasAny(['role', 'roles', 'operator', 'admin'])");
  });

  it("limits Storage writes to signed-in owner image paths with MIME and size checks", () => {
    const rules = readProjectFile("storage.rules");

    expect(rules).toContain("request.auth.uid == userId");
    expect(rules).toContain("request.resource.size <= 5 * 1024 * 1024");
    expect(rules).toContain("request.resource.contentType.matches('image/(jpeg|png|webp)')");
    expect(rules).toContain("match /reports/{userId}/{issueId}/{fileName}");
    expect(rules).toContain("match /evidence/{userId}/{issueId}/{fileName}");
    expect(rules).toContain("match /closures/{userId}/{issueId}/{fileName}");
    expect(rules).toContain("match /{allPaths=**}");
    expect(rules).toContain("allow read, write: if false;");
  });
});

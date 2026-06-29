import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("citizen accountability ledger", () => {
  it("types and fetches issue-scoped server event records", () => {
    const types = readProjectFile("src/types.ts");
    const service = readProjectFile("src/services/issues.ts");

    expect(types).toContain("export interface CivicEvent");
    expect(types).toContain('"citizen" | "operator" | "ai" | "worker" | "system"');
    expect(service).toContain("export async function fetchIssueEvents");
    expect(service).toContain('collection(db, COLLECTION_NAME, issueId, "events")');
    expect(service).toContain('orderBy("timestamp", "asc")');
    expect(service).toContain('OperationType.LIST, `${COLLECTION_NAME}/${issueId}/events`');
  });

  it("renders a dedicated append-only ledger on the public issue detail page", () => {
    const detail = readProjectFile("src/components/IssueDetailPage.tsx");
    const ledger = readProjectFile("src/components/AccountabilityLedger.tsx");

    expect(detail).toContain("fetchIssueEvents(issue.id)");
    expect(detail).toContain("<AccountabilityLedger");
    expect(detail).toContain("ledgerError");
    expect(ledger).toContain('id="case-accountability-ledger"');
    expect(ledger).toContain("Server-owned append-only events for this case.");
    expect(ledger).toContain("Accountability ledger table fallback");
    expect(ledger).toContain("actorMeta(event.actorType)");
    expect(ledger).toContain("statusMeta(event)");
  });

  it("keeps issue events citizen-readable and server-owned in Firestore Rules", () => {
    const rules = readProjectFile("firestore.rules");

    expect(rules).toContain("match /events/{eventId}");
    expect(rules).toContain("allow get, list: if isSignedIn();");
    expect(rules).toContain("allow create, update, delete: if false;");
    expect(rules).toMatch(/match \/events\/\{eventId\} \{\s+allow read, write: if false;/);
  });
});

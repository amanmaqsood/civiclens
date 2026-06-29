import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("release security gate coverage", () => {
  it("guards protected API calls with configurable App Check, Firebase auth, quota, and body-size controls", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("CIVICLENS_REQUIRE_APP_CHECK");
    expect(server).toContain("X-CivicLens-AppCheck");
    expect(server).toContain("not-enforced");
    expect(server).toContain("App Check token is required.");
    expect(server).toContain("Firebase ID token is required.");
    expect(server).toContain("findOversizedStringField");
    expect(server).toContain("exceeds the maximum allowed size.");
    expect(server).toContain("X-RateLimit-Limit");
    expect(server).toContain("X-RateLimit-Backend");
    expect(server).toContain("consumeDistributedQuota");
    expect(server).toContain('adminDb.collection(quotaCollectionName)');
    expect(server).toContain("runTransaction");
    expect(server).toContain("Quota enforcement is temporarily unavailable.");
    expect(server).toContain("Too many requests. Please try again later.");
  });

  it("uses environment-driven Firebase Admin project and database config", () => {
    const server = readProjectFile("server.ts");
    const adminConfig = readProjectFile("src/server/admin-config.ts");
    const envExample = readProjectFile(".env.example");

    expect(server).toContain("resolveFirebaseAdminConfig(process.env)");
    expect(server).toContain("firebaseAdminConfig.appOptions");
    expect(server).toContain("firebaseAdminConfig.databaseId");
    expect(server).not.toContain("gen-lang-client-0871796745");
    expect(server).not.toContain("ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa");
    expect(adminConfig).toContain("FIREBASE_PROJECT_ID");
    expect(adminConfig).toContain("GOOGLE_CLOUD_PROJECT");
    expect(adminConfig).toContain("GCLOUD_PROJECT");
    expect(adminConfig).toContain('"(default)"');
    expect(envExample).toContain("FIREBASE_PROJECT_ID");
    expect(envExample).toContain("FIRESTORE_DATABASE_ID");
  });

  it("keeps real operator work server-authorized and limits demo operators to synthetic demo cases", () => {
    const server = readProjectFile("server.ts");
    const app = readProjectFile("src/App.tsx");
    const header = readProjectFile("src/components/Header.tsx");

    expect(server).toContain("function requireOperatorForIssue");
    expect(server).toContain("actor?.isRealOperator");
    expect(server).toContain("actor?.isDemoOperator && issueData?.isDemoData === true");
    expect(server).toContain("Demo operator actions are limited to synthetic demo cases.");
    expect(app).toContain('operatorAccess === "real" ? issues : issues.filter((issue) => issue.isDemoData)');
    expect(header).not.toContain("setPersona(\"operator\")");
  });

  it("guards support and verification against duplicate votes per user inside transactions", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('issueRef.collection("support").doc(actor.uid)');
    expect(server).toContain("existingSupport.exists");
    expect(server).toContain("ALREADY_SUPPORTED");
    expect(server).toContain('issueRef.collection("verifications").doc(actor.uid)');
    expect(server).toContain("existingVote.exists");
    expect(server).toContain("ALREADY_VERIFIED");
    expect(server.match(/runTransaction/g)?.length || 0).toBeGreaterThanOrEqual(4);
  });

  it("blocks illegal lifecycle transitions and closure without closure evidence", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('app.post("/api/issues/update-status"');
    expect(server).toContain("Illegal transition:");
    expect(server).toContain("Closure evidence and assessment are required before resolving.");
    expect(server).toContain('tx.set(ref.collection("approvals").doc()');
    expect(server).toContain("humanApproved: true");
    expect(server).toContain("Operator rationale is required.");
  });

  it("keeps SSRF-prone image fetching constrained to Firebase Storage images", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('/^https:\\/\\/firebasestorage\\.googleapis\\.com\\//');
    expect(server).toContain("AbortSignal.timeout(8000)");
    expect(server).toContain('contentType.startsWith("image/")');
    expect(server).toContain("ignored non-image content type");
  });

  it("persists real server-executed agent steps with idempotency and human approval tools", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('app.post("/api/agent/run"');
    expect(server).toContain("const { issueId } = req.body || {}");
    expect(server).toContain("isSafeDocumentId(issueId)");
    expect(server).toContain('adminDb.collection("agentRuns")');
    expect(server).toContain('issueRef.collection("agentSteps")');
    expect(server).toContain("idempotent: true");
    expect(server).toContain('name: "search_nearby_cases"');
    expect(server).toContain('name: "compare_candidate_evidence"');
    expect(server).toContain('name: "find_responsible_authority"');
    expect(server).toContain('name: "draft_action_packet"');
    expect(server).toContain('name: "request_human_approval"');
    expect(server).toContain('name: "verify_closure"');
    expect(server).toContain('name: "record_event"');
    expect(server).toContain("Unknown tool:");
    expect(server).toContain("server-loaded candidate set");
    expect(server).toContain("const cid = result?.candidateId");
  });

  it("stores canonical status keys and rejects browser-authored agent traces", () => {
    const server = readProjectFile("server.ts");
    const types = readProjectFile("src/types.ts");
    const service = readProjectFile("src/services/issues.ts");

    expect(types).toContain("IssueStatusKey");
    expect(server).toContain("coerceIssueStatus(req.body?.newStatus)");
    expect(server).toContain('status: "submitted"');
    expect(server).not.toContain("req.body?.agentTrace");
    expect(service).not.toContain("agentTrace: [verifyTrace]");
    expect(service).not.toContain("agentTrace: [escalationTrace]");
    expect(service).not.toContain("demo.synthetic");
    expect(service).not.toContain("setDoc(");
    expect(service).not.toContain("updateDoc(");
    expect(service).not.toContain("deleteDoc(");
  });

  it("generates persisted resolution plans from server-loaded issue state", () => {
    const server = readProjectFile("server.ts");
    const service = readProjectFile("src/services/issues.ts");
    const widget = readProjectFile("src/components/ResolutionPlanWidget.tsx");

    expect(server).toContain("Resolution plans are generated from server-loaded issue state.");
    expect(server).toContain("draftResolutionPlanFromIssue(issueData, issueId)");
    expect(server).not.toContain("updateData.resolutionPlan = req.body.resolutionPlan");
    expect(server).not.toContain("req.body.resolutionPlan.recommendedAuthority");
    expect(service).toContain("draftResolutionPlan: true");
    expect(service).not.toContain("JSON.stringify({ resolutionPlan })");
    expect(service).not.toContain('apiFetch("/api/resolution-plan"');
    expect(widget).not.toContain("generateResolutionPlan(issue)");
  });
});

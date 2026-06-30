import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("semantic auto merge on create", () => {
  it("uses geohash, embeddings, and a transaction before creating a standalone issue", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("function geoHash7");
    expect(server).toContain("function nearbyGeoHash7Set");
    expect(server).toContain("function evidenceFingerprint");
    expect(server).toContain("async function findAutoMergeCandidate");
    expect(server).toContain("similarity < 0.85");
    expect(server).toContain("distanceM > 50");
    expect(server).toContain("sameEvidenceImage ? 0.985 : 0");
    expect(server).toContain("const mergeCandidate = queryEmbedding ? await findAutoMergeCandidate(report, queryEmbedding, issueRef.id) : null");
    expect(server).toContain('adminDb.collection("issueCreateResults").doc(idempotencyKey)');
    expect(server).toContain("await adminDb.runTransaction");
  });

  it("auto-merges into the canonical case and records durable evidence", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('status: "auto_merged"');
    expect(server).toContain('source: "auto_merge_on_create"');
    expect(server).toContain('eventType: "auto_merged_on_create"');
    expect(server).toContain("reportCount: nextReportCount");
    expect(server).toContain("priorityScore: nextPriorityScore");
    expect(server).toContain('method: mergeCandidate.sameEvidenceImage ? "geohash7_embedding_cosine_or_same_image" : "geohash7_embedding_cosine"');
    expect(server).toContain("sameEvidenceImage: !!mergeCandidate.sameEvidenceImage");
    expect(server).toContain("duplicateSimilarity: outcome.duplicateSimilarity");
    expect(server).toContain("duplicateDistanceM: outcome.duplicateDistanceM");
  });

  it("threads the auto-merged create response into the client success state", () => {
    const service = readProjectFile("src/services/issues.ts");
    const app = readProjectFile("src/App.tsx");
    const types = readProjectFile("src/types.ts");

    expect(service).toContain("autoMerged: !!result.autoMerged");
    expect(service).toContain("duplicateDistanceM: result.duplicateDistanceM ?? null");
    expect(app).toContain("if ((savedReport as any).autoMerged)");
    expect(app).toContain("setDedupConfirmedMerged(true)");
    expect(types).toContain("autoMerged?: boolean");
    expect(types).toContain("dedup?:");
  });
});

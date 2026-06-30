import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("trust economy and brigading guard", () => {
  it("audits citizen verification with Gemini and stores weighted consensus fields", () => {
    const server = readProjectFile("server.ts");
    const perimeter = readProjectFile("src/server/perimeter.ts");

    expect(server).toContain("async function auditTrustWeightedVerification");
    expect(server).toContain("model: geminiModels.cheapClassification");
    expect(server).toContain("trust_verification_audited");
    expect(server).toContain("weightedConfirmScore");
    expect(server).toContain("weightedDisputeScore");
    expect(server).toContain("trustConsensus");
    expect(perimeter).toContain('path.endsWith("/verification")');
  });

  it("collapses brigading bursts and gates weighted-consensus auto-resolution", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("function computeBrigadingGuard");
    expect(server).toContain("trust_brigading_collapsed");
    expect(server).toContain("recentSame.length >= 3");
    expect(server).toContain("consensus.confirmWeight >= consensus.autoResolveThreshold");
    expect(server).toContain('updates.status = "resolved"');
    expect(server).toContain('verificationStatus: shouldAutoResolve ? "trust_consensus_resolved"');
  });

  it("makes trust consensus public and appealable", () => {
    const server = readProjectFile("server.ts");
    const types = readProjectFile("src/types.ts");
    const services = readProjectFile("src/services/issues.ts");
    const panel = readProjectFile("src/components/VerificationPanel.tsx");
    const dashboard = readProjectFile("src/components/ImpactDashboard.tsx");

    expect(server).toContain('app.post("/api/issues/:issueId/trust-appeal"');
    expect(server).toContain("trust_consensus_appealed");
    expect(types).toContain("export interface TrustConsensus");
    expect(types).toContain("trustAppeal?: TrustAppeal");
    expect(services).toContain("appealTrustConsensus");
    expect(services).toContain("trustConsensus: data.trustConsensus || undefined");
    expect(panel).toContain('id="trust-consensus-panel"');
    expect(panel).toContain("Consensus auto-resolution is appealable.");
    expect(dashboard).toContain("Trust {typeof l.trustScore");
  });

  it("keeps gamification weekly, streak-aware, and visually scoped", () => {
    const server = readProjectFile("server.ts");
    const dashboard = readProjectFile("src/components/ImpactDashboard.tsx");

    expect(server).toContain("function isoWeekKey");
    expect(server).toContain("function nextContributionStreak");
    expect(server).toContain("weeklyPoints");
    expect(server).toContain("currentStreak");
    expect(server).toContain('"Weekly Standout"');
    expect(server).toContain('"3-Day Streak"');
    expect(server).toContain('String(req.query?.period || "all") === "weekly"');
    expect(dashboard).toContain("/api/leaderboard?period=weekly");
    expect(dashboard).toContain("gamify-leaderboard");
    expect(dashboard).toContain("gamify-badge");
    expect(dashboard).toContain("gamify-points");
    expect(dashboard).toContain("Weekly community leaderboard");
  });

  it("supports deterministic follow-up sentinel targeting for demos and tests", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("async function runFollowUpSentinel(opts: { limit?: number; issueId?: string })");
    expect(server).toContain("adminDb.collection(\"issues\").doc(opts.issueId).get()");
    expect(server).toContain("issueId: cleanText(req.body?.issueId");
    expect(server).toContain("payload: { scanned: docs.length, decisionCount: details.length, issueId: opts.issueId || null }");
  });
});

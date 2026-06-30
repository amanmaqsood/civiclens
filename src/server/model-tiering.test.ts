import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("Gemini model tiering", () => {
  it("centralizes Gemini model selection into explicit tiers", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("const geminiModels = {");
    expect(server).toContain('cheapClassification: configuredGeminiModel("CIVICLENS_GEMINI_CHEAP_MODEL", "gemini-2.5-flash-lite")');
    expect(server).toContain('reasoning: configuredGeminiModel("CIVICLENS_GEMINI_REASONING_MODEL", "gemini-2.5-flash")');
    expect(server).toContain('vision: configuredGeminiModel("CIVICLENS_GEMINI_VISION_MODEL", "gemini-2.5-flash")');
    expect(server).toContain('planner: configuredGeminiModel("CIVICLENS_PLANNER_MODEL", configuredGeminiModel("CIVICLENS_GEMINI_PLANNER_MODEL", "gemini-2.5-pro"))');
    expect(server).toContain('embedding: configuredGeminiModel("CIVICLENS_GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")');
    expect(server).toContain("function geminiModelTierSummary");
  });

  it("uses the correct tier names at Gemini call sites", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("model: geminiModels.cheapClassification");
    expect(server).toContain("model: geminiModels.vision");
    expect(server).toContain("model: geminiModels.audio");
    expect(server).toContain("model: geminiModels.grounding");
    expect(server).toContain("model: geminiModels.reasoning");
    expect(server).toContain("const plannerModel = geminiModels.planner");
    expect(server).toContain("model: geminiModels.embedding");
    expect(server).not.toContain('model: "gemini-2.5-flash"');
  });

  it("has a live model-tier smoke proof with enforced tier separation", () => {
    const server = readProjectFile("server.ts");
    const packageJson = readProjectFile("package.json");
    const plannerVerifier = readProjectFile("scripts/verify-agent-planner-live.ps1");
    const streamVerifier = readProjectFile("scripts/verify-agent-stream-live.ps1");

    expect(server).toContain('app.post("/api/smoke/model-tiers"');
    expect(server).toContain("runModelTierSmokeChecks");
    expect(server).toContain("cheapVsReasoningDistinct");
    expect(server).toContain("plannerVsReasoningDistinct");
    expect(server).toContain("embeddingDedicated");
    expect(packageJson).toContain('"test:model-tiering"');
    expect(plannerVerifier).toContain('"gemini-2.5-pro"');
    expect(streamVerifier).toContain('"gemini-2.5-pro"');
  });
});

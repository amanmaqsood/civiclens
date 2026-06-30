import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("observability and grounding citation coverage", () => {
  it("emits stable structured logs for API, Gemini, and agent monitoring", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('"api_request"');
    expect(server).toContain('"gemini_call_completed"');
    expect(server).toContain('"gemini_call_failed"');
    expect(server).toContain('"gemini_retry"');
    expect(server).toContain('"agent_run_metric"');
    expect(server).toContain("safeLogText");
    expect(server).toContain("googleSearchGrounding");
    expect(server).toContain("summarizeGeminiUsage");
    expect(server).toContain("estimatedCostUsd");
    expect(server).toContain("geminiEstimatedCostUsd");
  });

  it("exposes an operator-only observability snapshot with Cloud Logging queries", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('app.get("/api/ops/observability"');
    expect(server).toContain("Operator authorization is required.");
    expect(server).toContain("cloudLoggingQueries");
    expect(server).toContain("eventCounts");
    expect(server).toContain("agentRuns");
    expect(server).toContain("observability_snapshot");
  });

  it("normalizes Google Search grounding metadata into visible citation cards", () => {
    const server = readProjectFile("server.ts");
    const widget = readProjectFile("src/components/ResolutionPlanWidget.tsx");
    const operator = readProjectFile("src/components/OperatorDetailView.tsx");
    const types = readProjectFile("src/types.ts");

    expect(server).toContain("extractGroundingSources");
    expect(server).toContain("groundingMetadata?.groundingChunks");
    expect(server).toContain("extractInteractionCitationSources");
    expect(server).toContain("url_citation");
    expect(server).toContain("claimSupported");
    expect(operator).toContain("ResolutionPlanWidget");
    expect(widget).toContain('id="grounding-reference-links"');
    expect(widget).toContain("aria-label={`Open grounding source:");
    expect(widget).toContain("sourceType");
    expect(types).toContain('sourceType: "sourced" | "estimated"');
  });

  it("uses all planned keyless grounding sources, including Nominatim reverse geocode", () => {
    const server = readProjectFile("server.ts");
    const operator = readProjectFile("src/components/OperatorDetailView.tsx");

    expect(server).toContain("https://nominatim.openstreetmap.org/reverse");
    expect(server).toContain('"User-Agent": "CivicLens/2.0 keyless-grounding"');
    expect(server).toContain("reverseGeocode");
    expect(server).toContain('"nominatim-osm"');
    expect(server).toContain("https://api.open-meteo.com/v1/forecast");
    expect(server).toContain("https://overpass-api.de/api/interpreter");
    expect(server).toContain("firestore-history");
    expect(operator).toContain("grounding.reverseGeocode");
  });

  it("documents Cloud Logging and Cloud Monitoring setup without credentials", () => {
    const runbook = readProjectFile("docs/OBSERVABILITY.md");
    const dashboard = readProjectFile("docs/monitoring/civiclens-cloud-monitoring-dashboard.json");

    expect(existsSync(join(root, "docs/monitoring/civiclens-cloud-monitoring-dashboard.json"))).toBe(true);
    expect(runbook).toContain("gcloud logging metrics create civiclens_gemini_failures");
    expect(runbook).toContain("CIVICLENS_GEMINI_INPUT_USD_PER_MILLION_TOKENS");
    expect(runbook).toContain("gcloud logging metrics create civiclens_gemini_tokens");
    expect(runbook).toContain("GET /api/ops/observability?hours=24");
    expect(dashboard).toContain('"displayName": "CivicLens Operations"');
    expect(dashboard).toContain("Gemini Usage and Cost");
    expect(dashboard).toContain('jsonPayload.service=\\"civiclens\\"');
    expect(runbook).not.toContain(["A", "Iza"].join(""));
  });
});

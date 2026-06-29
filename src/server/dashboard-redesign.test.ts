import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("dashboard redesign", () => {
  it("uses D3 modules for persisted-data sparklines and heatmap scales", () => {
    const dashboard = readProjectFile("src/components/ImpactDashboard.tsx");
    const pkg = readProjectFile("package.json");

    expect(dashboard).toContain('from "d3-array"');
    expect(dashboard).toContain('from "d3-scale"');
    expect(dashboard).toContain('from "d3-scale-chromatic"');
    expect(dashboard).toContain("scaleSequential(interpolateYlOrRd)");
    expect(dashboard).toContain("function Sparkline");
    expect(pkg).toContain('"d3-array"');
    expect(pkg).toContain('"d3-scale"');
    expect(pkg).toContain('"d3-scale-chromatic"');
  });

  it("keeps public and agency dashboard modes with KPI deltas and live feed", () => {
    const dashboard = readProjectFile("src/components/ImpactDashboard.tsx");

    expect(dashboard).toContain('type DashboardMode = "public" | "agency"');
    expect(dashboard).toContain('id="dashboard-kpi-row"');
    expect(dashboard).toContain("Delta vs prior 7d");
    expect(dashboard).toContain("tabular-nums");
    expect(dashboard).toContain('id="dashboard-live-feed"');
    expect(dashboard).toContain("buildActivityFeed");
    expect(dashboard).toContain("aria-pressed={mode === option.id}");
  });

  it("renders heatmap and response distribution with accessible table fallbacks", () => {
    const dashboard = readProjectFile("src/components/ImpactDashboard.tsx");

    expect(dashboard).toContain("function buildHeatmapCells");
    expect(dashboard).toContain('id="dashboard-heatmap"');
    expect(dashboard).toContain("Severity weighted civic heatmap");
    expect(dashboard).toContain("Heatmap table fallback");
    expect(dashboard).toContain("function buildResponseBuckets");
    expect(dashboard).toContain('id="dashboard-response-distribution"');
    expect(dashboard).toContain("Agency dashboard table fallback");
  });
});

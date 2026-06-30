import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("report create BaseAgent pipeline", () => {
  it("routes report creation through named stages on a shared context", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("class BaseAgent");
    expect(server).toContain('new BaseAgent<ReportCreatePipelineContext>("report_create_pipeline"');
    for (const stage of ["Vision", "Self-Verify", "Geo", "Context", "Risk", "Route", "Draft", "Monitor"]) {
      expect(server).toContain(`name: "${stage}"`);
    }
    expect(server).toContain("const pipelineContext = await runReportCreatePipeline");
    expect(server).toContain("context.report.createPipeline");
    expect(server).toContain("sharedContext");
    expect(server).toContain("report_create_pipeline_completed");
  });

  it("keeps the pipeline useful instead of cosmetic", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("fetchExternalGrounding(ctx.report.lat, ctx.report.lng, ctx.report.category, ctx.issueId)");
    expect(server).toContain("ctx.report.priorityScore = serverPriorityScore(ctx.report)");
    expect(server).toContain("Object.assign(ctx.report, buildSlaIssueFields(ctx.report, ctx.nowIso))");
    expect(server).toContain("validateAuthorityAgainstRegistry(ctx.report.locationName");
    expect(server).toContain("ctx.report.pipelineDraft");
    expect(server).toContain("ctx.report.monitoring");
    expect(server).toContain("createPipeline: (report as any).createPipeline");
  });
});

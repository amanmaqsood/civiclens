import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("milestone 7 reliability and metrics", () => {
  it("uses a paged issue query instead of treating the first recent page as full history", () => {
    const service = readProjectFile("src/services/issues.ts");
    const app = readProjectFile("src/App.tsx");

    expect(service).toContain("export async function fetchIssuesPage");
    expect(service).toContain("startAfter(options.after.timestamp)");
    expect(service).toContain("hasMore: snapshot.docs.length > pageSize");
    expect(service).toContain("nextCursor");
    expect(app).toContain("loadMoreIssues");
    expect(app).toContain("setHasMoreIssues(page.hasMore)");
  });

  it("separates demo metrics and shows unavailable values without persisted lifecycle data", () => {
    const dashboard = readProjectFile("src/components/ImpactDashboard.tsx");

    expect(dashboard).toContain('type DashboardScope = "real" | "demo"');
    expect(dashboard).toContain("issue.isDemoData");
    expect(dashboard).toContain("Not enough data");
    expect(dashboard).toContain("issue.createdAt || issue.timestamp");
    expect(dashboard).toContain("issue.resolvedAt");
  });

  it("adds readiness checks, structured API logs, and deployment-safe port/config handling", () => {
    const server = readProjectFile("server.ts");
    const perimeter = readProjectFile("src/server/perimeter.ts");

    expect(server).toContain("process.env.PORT || 3000");
    expect(server).toContain("runtimeConfig");
    expect(server).toContain("structuredLog");
    expect(server).toContain('app.get("/api/readyz"');
    expect(server).toContain('"api_request"');
    expect(server).toContain("geminiConfigured");
    expect(perimeter).toContain('path === "/api/readyz"');
  });

  it("code-splits heavy UI paths and compresses closure evidence before upload", () => {
    const app = readProjectFile("src/App.tsx");
    const landing = readProjectFile("src/components/LandingPage.tsx");
    const closure = readProjectFile("src/components/ClosureVerificationPanel.tsx");
    const viteConfig = readProjectFile("vite.config.ts");

    expect(app).toContain('lazy(() => import("./components/OperatorQueue"))');
    expect(app).toContain('lazy(() => import("./components/ImpactDashboard"))');
    expect(landing).toContain('lazy(() => import("./HomeMap"))');
    expect(closure).toContain("compressImage(file, 1024, 1024, 0.72)");
    expect(viteConfig).toContain("manualChunks");
    expect(viteConfig).toContain("firebase");
    expect(viteConfig).toContain("maps");
  });
});

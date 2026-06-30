import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("deploy smoke coverage", () => {
  it("exposes a job-secret deploy smoke endpoint with real service probes", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain('path === "/api/smoke/deploy"');
    expect(server).toContain('app.post("/api/smoke/deploy"');
    expect(server).toContain("deploy_smoke_completed");
    expect(server).toContain("getAdminAuth().listUsers(1)");
    expect(server).toContain("generateContentWithRetry(ai, {");
    expect(server).toContain("maps.googleapis.com/maps/api/place/autocomplete/json");
    expect(server).toContain("maps.googleapis.com/maps/api/js");
    expect(server).toContain("x-civiclens-job-secret");
  });

  it("ships a URL-targeted deploy smoke script and local verifier", () => {
    const packageJson = readProjectFile("package.json");
    const deploySmoke = readProjectFile("scripts/deploy-smoke.ps1");
    const verifier = readProjectFile("scripts/verify-deploy-smoke-live.ps1");

    expect(existsSync(join(root, "scripts/deploy-smoke.ps1"))).toBe(true);
    expect(existsSync(join(root, "scripts/verify-deploy-smoke-live.ps1"))).toBe(true);
    expect(packageJson).toContain('"smoke:deploy"');
    expect(deploySmoke).toContain("DEPLOY_SMOKE_LIVE");
    expect(deploySmoke).toContain("mapsApi=");
    expect(deploySmoke).toContain("/readyz");
    expect(deploySmoke).toContain("/api/smoke/deploy");
    expect(verifier).toContain("GOOGLE_MAPS_PLATFORM_KEY");
    expect(verifier).toContain("GEMINI_API_KEY");
  });

  it("documents deploy smoke usage without embedding credentials", () => {
    const deployment = readProjectFile("docs/DEPLOYMENT_CLOUD_RUN.md");

    expect(deployment).toContain("npm run smoke:deploy");
    expect(deployment).toContain("DEPLOY_SMOKE_LIVE");
    expect(deployment).toContain("scripts\\deploy-smoke.ps1");
    expect(deployment).not.toContain(["A", "Iza"].join(""));
  });
});

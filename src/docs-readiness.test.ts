import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("documentation release readiness", () => {
  it("includes required release documents", () => {
    const requiredFiles = [
      "LICENSE",
      "ATTRIBUTIONS.md",
      "ARCHITECTURE.md",
      "security_spec.md",
      "docs/DEPLOYMENT_CLOUD_RUN.md",
      "docs/AI_STUDIO_EVIDENCE.md",
      "docs/DEMO_SCRIPT.md",
      "docs/GOOGLE_DOC_DRAFT.md",
      "docs/FINAL_EVIDENCE_REPORT.md",
      "Dockerfile",
      "cloudbuild.yaml",
    ];

    for (const file of requiredFiles) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  it("does not ship fake secret values or pending license/attribution copy", () => {
    const envExample = readProjectFile(".env.example");
    const readme = readProjectFile("README.md");

    expect(envExample).not.toContain("MY_GEMINI_API_KEY");
    expect(envExample).not.toContain("MY_APP_URL");
    expect(readme).not.toContain("License and full attribution files are part");
    expect(readme).toContain("[LICENSE](LICENSE)");
    expect(readme).toContain("[ATTRIBUTIONS.md](ATTRIBUTIONS.md)");
  });

  it("records deployed app URL while keeping unpublished artifacts unclaimed", () => {
    const evidence = readProjectFile("docs/FINAL_EVIDENCE_REPORT.md");
    const demo = readProjectFile("docs/DEMO_SCRIPT.md");
    const docDraft = readProjectFile("docs/GOOGLE_DOC_DRAFT.md");

    expect(evidence).toContain("Public app URL: `https://civiclens-py7ixxgroq-as.a.run.app`.");
    expect(evidence).toContain("Public Google Doc URL: not created in this checkpoint.");
    expect(evidence).toContain("Demo video URL: not created in this checkpoint.");
    expect(demo).toContain("not created in this local rebuild");
    expect(docDraft).toContain("Live application: https://civiclens-py7ixxgroq-as.a.run.app");
    expect(docDraft).toContain("GitHub repository: https://github.com/amanmaqsood/civiclens");
    expect(docDraft).toContain("Optional demo video not included.");
    expect(docDraft).toContain("Do not claim authenticated console screenshot capture until those files exist");
  });

  it("documents production Firebase, App Check, and Cloud Run configuration truthfully", () => {
    const envExample = readProjectFile(".env.example");
    const readme = readProjectFile("README.md");
    const deployment = readProjectFile("docs/DEPLOYMENT_CLOUD_RUN.md");
    const dockerfile = readProjectFile("Dockerfile");

    for (const required of [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_APP_ID",
      "VITE_FIREBASE_APP_CHECK_SITE_KEY",
      "CIVICLENS_REQUIRE_APP_CHECK",
      "FIREBASE_PROJECT_ID",
      "FIRESTORE_DATABASE_ID",
    ]) {
      expect(envExample).toContain(required);
      expect(deployment).toContain(required);
    }

    expect(readme).toContain("Vite reads `VITE_*` variables at build time");
    expect(deployment).toContain("Do not create, commit, or bake service-account JSON into the image.");
    expect(deployment).toContain("Set `CIVICLENS_REQUIRE_APP_CHECK=true` only after");
    expect(dockerfile).toContain("ARG VITE_FIREBASE_API_KEY");
    expect(dockerfile).not.toContain("GEMINI_API_KEY");
  });

  it("does not ship unsupported government affiliation wording", () => {
    const files = [
      "README.md",
      "security_spec.md",
      "ARCHITECTURE.md",
      "docs/GOOGLE_DOC_DRAFT.md",
      "src/components/LandingPage.tsx",
      "server.ts",
    ];
    const combined = files.map((path) => readProjectFile(path)).join("\n");

    expect(combined).not.toContain("Digital India Citizen Initiative");
    expect(combined).not.toContain("official government");
    expect(combined).not.toContain("government board responsible");
    expect(combined).not.toContain("File a grievance via the local department portal.");
  });
});

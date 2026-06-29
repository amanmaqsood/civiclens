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
      "docs/RUBRIC_SELF_SCORE.md",
      "docs/OBSERVABILITY.md",
      "docs/monitoring/civiclens-cloud-monitoring-dashboard.json",
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

  it("records deployed app and Google Doc URLs while keeping hackathon submission unclaimed", () => {
    const evidence = readProjectFile("docs/FINAL_EVIDENCE_REPORT.md");
    const demo = readProjectFile("docs/DEMO_SCRIPT.md");
    const docDraft = readProjectFile("docs/GOOGLE_DOC_DRAFT.md");
    const score = readProjectFile("docs/RUBRIC_SELF_SCORE.md");

    expect(evidence).toContain("Public URL: https://civiclens-py7ixxgroq-as.a.run.app");
    expect(evidence).toContain("FINAL_GOLDEN_PATH_LIVE");
    expect(score).toContain("97/100");
    expect(score).toContain("FINAL_GOLDEN_PATH_LIVE");
    expect(evidence).toContain(
      "Public Google Doc body was replaced with `docs/GOOGLE_DOC_DRAFT.md`, formatted with headings/lists/links, and public text export was rechecked.",
    );
    expect(evidence).toContain("Hackathon submission has not been performed.");
    expect(demo).toContain("Public app URL: https://civiclens-py7ixxgroq-as.a.run.app");
    expect(docDraft).toContain("Primary URL: https://civiclens-py7ixxgroq-as.a.run.app");
    expect(docDraft).toContain("Repository: https://github.com/amanmaqsood/civiclens");
    expect(docDraft).toContain("Demo video link can be added by the submitter if available.");
    expect(docDraft).toContain("Screenshots that require authenticated consoles are treated carefully");
  });

  it("documents production Firebase, App Check, and Cloud Run configuration truthfully", () => {
    const envExample = readProjectFile(".env.example");
    const readme = readProjectFile("README.md");
    const deployment = readProjectFile("docs/DEPLOYMENT_CLOUD_RUN.md");
    const dockerfile = readProjectFile("Dockerfile");
    const firebaseAppletConfig = readProjectFile("firebase-applet-config.json");

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
    expect(readme).toContain("The tracked `firebase-applet-config.json` is metadata-only");
    expect(envExample).toContain("firebase-applet-config.json is metadata-only");
    expect(firebaseAppletConfig).not.toContain("apiKey");
    expect(firebaseAppletConfig).not.toContain(["A", "Iza"].join(""));
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

    expect(combined).not.toMatch(new RegExp(["Digital", "India", "Citizen", "Initiative"].join("\\s+")));
    expect(combined).not.toContain("official government partner");
    expect(combined).not.toContain("official government filing");
    expect(combined).not.toContain("government board responsible");
    expect(combined).not.toContain("File a grievance via the local department portal.");
  });
});

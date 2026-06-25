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

  it("records deployment blockers without inventing public URLs", () => {
    const evidence = readProjectFile("docs/FINAL_EVIDENCE_REPORT.md");
    const demo = readProjectFile("docs/DEMO_SCRIPT.md");
    const docDraft = readProjectFile("docs/GOOGLE_DOC_DRAFT.md");

    expect(evidence).toContain("Public app URL: not created in this local rebuild.");
    expect(evidence).toContain("Public Google Doc URL: not created in this local rebuild.");
    expect(evidence).toContain("Demo video URL: not created in this local rebuild.");
    expect(demo).toContain("not created in this local rebuild");
    expect(docDraft).toContain("Do not add public URLs until they exist.");
  });
});

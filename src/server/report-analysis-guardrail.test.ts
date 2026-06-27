import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("report analysis non-civic image guardrail", () => {
  it("requires Gemini to flag waffle or unrelated images as low-confidence clarification cases", () => {
    const server = readProjectFile("server.ts");

    expect(server).toContain("If the image appears to be food, a waffle");
    expect(server).toContain("isCivicIssue=false");
    expect(server).toContain("confidence <= 0.35");
    expect(server).toContain("isCivicIssue: {");
    expect(server).toContain('type: Type.BOOLEAN');
    expect(server).toContain('"isCivicIssue"');
    expect(server).toContain("function applyCivicImageGuardrail");
    expect(server).toContain("normalized.confidence = Math.min(normalized.confidence, 0.35)");
    expect(server).toContain("This image does not clearly show a civic issue");
  });
});

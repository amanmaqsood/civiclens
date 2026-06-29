import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("multilingual voice intake", () => {
  it("exposes a Gemini audio route for transcription, translation, category extraction, and readback", () => {
    const server = readProjectFile("server.ts");
    const perimeter = readProjectFile("src/server/perimeter.ts");

    expect(server).toContain('app.post("/api/voice-intake"');
    expect(server).toContain("function audioSourceToInlinePart");
    expect(server).toContain("transcriptOriginal");
    expect(server).toContain("englishTranslation");
    expect(server).toContain("readbackText");
    expect(server).toContain("ai_voice_intake");
    expect(perimeter).toContain('path === "/api/voice-intake"');
  });

  it("wires report-page recording and browser readback to the voice route", () => {
    const reportPage = readProjectFile("src/components/ReportPage.tsx");
    const i18n = readProjectFile("src/i18n.ts");

    expect(reportPage).toContain("MediaRecorder");
    expect(reportPage).toContain('/api/voice-intake');
    expect(reportPage).toContain("speechSynthesis");
    expect(reportPage).toContain('id="voice-intake-draft"');
    expect(i18n).toContain("report.voiceReadback");
    expect(i18n).toContain("report.voiceTranslation");
  });

  it("ships a committed audio fixture for live verification", () => {
    const fixturePath = join(root, "tests/fixtures/voice-intake-pothole.wav");

    expect(existsSync(fixturePath)).toBe(true);
    expect(statSync(fixturePath).size).toBeGreaterThan(100_000);
  });
});

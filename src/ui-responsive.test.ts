import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("responsive operator interface", () => {
  it("uses a real responsive app shell instead of the previous fake phone frame", () => {
    const shell = readProjectFile("src/components/MobileFrame.tsx");

    expect(shell).toContain("min-h-screen w-full bg-paper");
    expect(shell).not.toContain("09:41");
    expect(shell).not.toContain("5G");
    expect(shell).not.toContain("100%");
    expect(shell).not.toContain("max-w-md");
    expect(shell).not.toContain("sm:h-[840px]");
  });

  it("keeps the operator desk as a desktop queue/detail workspace with mobile fallback", () => {
    const app = readProjectFile("src/App.tsx");
    const queue = readProjectFile("src/components/OperatorQueue.tsx");
    const detail = readProjectFile("src/components/OperatorDetailView.tsx");

    expect(app).toContain("lg:grid lg:grid-cols-[380px_minmax(0,1fr)]");
    expect(app).toContain('aria-label="Operator case queue"');
    expect(app).toContain('aria-label="Selected operator case"');
    expect(app).toContain("selectedIssueId={operatorSelectedIssueId}");
    expect(app).toContain("embedded");

    expect(queue).toContain('aria-label={`Open case');
    expect(queue).toContain("aria-pressed={selectedIssueId === issue.id}");
    expect(queue).toContain("min-h-[112px]");
    expect(queue).toContain("Refresh operator case queue");

    expect(detail).toContain("xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]");
    expect(detail).toContain('aria-label="Back to operator queue"');
    expect(detail).toContain('role="dialog"');
    expect(detail).toContain('aria-modal="true"');
  });
});

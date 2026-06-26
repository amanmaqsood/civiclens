import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const issueId = "e2e-demo-pothole";
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "demo-civiclens";
const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";

async function seedDemoIssue() {
  const app = getApps()[0] || initializeApp({ projectId });
  const db = databaseId === "(default)" ? getFirestore(app) : getFirestore(app, databaseId);
  await db.collection("issues").doc(issueId).set({
    id: issueId,
    ticketId: "CVL-E2E-001",
    title: "E2E demo pothole",
    summary: "Synthetic pothole case for the browser release gate.",
    description: "Synthetic pothole case for the browser release gate.",
    image: "",
    lat: 12.9716,
    lng: 77.5946,
    locationName: "MG Road, Bengaluru",
    category: "pothole",
    status: "submitted",
    timestamp: new Date("2026-06-26T00:00:00.000Z").toISOString(),
    createdAt: new Date("2026-06-26T00:00:00.000Z").toISOString(),
    userId: "seeded-e2e",
    citizenUpvotes: 0,
    reportCount: 1,
    confirmCount: 0,
    disputeCount: 0,
    severity: 4,
    urgency: "priority",
    priorityScore: 58,
    isDemoData: true,
  });
}

async function preparePage(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    window.localStorage.setItem("has_seen_onboarding", "true");
  });
  await page.goto("/");
  await expect(page.locator("#main-content")).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNoHighImpactAxeViolations(page: Page) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const result = await (window as any).axe.run(document);
    return result.violations.map((violation: any) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node: any) => node.target.join(" ")).slice(0, 3),
    }));
  });
  const highImpact = violations.filter((violation) => ["critical", "serious"].includes(violation.impact || ""));
  expect(highImpact).toEqual([]);
}

test.beforeEach(async () => {
  await seedDemoIssue();
});

for (const viewport of [
  { name: "mobile", width: 360, height: 740 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`landing page is usable and accessible at ${viewport.name}`, async ({ page }) => {
    await preparePage(page, viewport);

    await expect(page.getByRole("heading", { name: /Civic\s*Lens/i })).toBeVisible();
    await expect(page.locator("#report-issue-btn")).toBeVisible();
    await expect(page.getByText("Sample data")).toBeVisible();
    await expect(page.getByText("E2E demo pothole")).toBeVisible();
    await expect(page.getByText("Metrics are calculated from the records currently loaded")).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectNoHighImpactAxeViolations(page);
  });
}

test("demo operator queue uses emulator data and labels synthetic cases", async ({ page }) => {
  await preparePage(page, { width: 1280, height: 900 });

  await expect(page.getByText("E2E demo pothole")).toBeVisible();
  await expect(page.getByRole("button", { name: /Switch to synthetic demo desk/i })).toBeVisible();
  await page.getByRole("button", { name: /Switch to synthetic demo desk/i }).click();

  await expect(page.getByText("Synthetic Demo Desk")).toBeVisible();
  await expect(page.locator("#operator-queue-container")).toBeVisible();
  await expect(page.locator("#operator-issue-row-e2e-demo-pothole")).toBeVisible();
  await expect(page.getByText("Demo actions are server-limited")).toBeVisible();
  await expect(page.locator("#operator-issue-row-e2e-demo-pothole").getByText(/^Demo$/)).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await expectNoHighImpactAxeViolations(page);
});

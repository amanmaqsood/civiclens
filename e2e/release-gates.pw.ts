import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const issueId = "e2e-demo-pothole";
const extraDemoIssueIds = ["e2e-demo-water", "e2e-demo-light", "e2e-demo-hidden"];
const smokeIssueId = "e2e-smoke-hidden";
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "demo-civiclens";
const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

async function seedDemoIssue() {
  const app = getApps()[0] || initializeApp({ projectId });
  const db = databaseId === "(default)" ? getFirestore(app) : getFirestore(app, databaseId);
  const createdAt = new Date("2026-06-26T00:00:00.000Z").toISOString();
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

  await db.collection("issues").doc(smokeIssueId).set({
    id: smokeIssueId,
    ticketId: "CVL-E2E-SMOKE",
    title: "Synthetic Cloud Run smoke test pothole",
    summary: "Internal smoke-test record that must not appear in public feed or metrics.",
    description: "Internal-test record from release validation.",
    image: "",
    lat: 12.9916,
    lng: 77.6146,
    locationName: "Cloud Run smoke test area",
    category: "pothole",
    status: "submitted",
    timestamp: createdAt,
    createdAt,
    userId: "seeded-e2e",
    citizenUpvotes: 0,
    reportCount: 1,
    confirmCount: 0,
    disputeCount: 0,
    severity: 2,
    urgency: "routine",
    priorityScore: 99,
    isDemoData: false,
  });

  const extraDemoCases = [
    {
      id: extraDemoIssueIds[0],
      ticketId: "CVL-E2E-002",
      title: "E2E demo water leak",
      category: "water_leak",
      priorityScore: 52,
      lat: 12.9816,
      lng: 77.6046,
    },
    {
      id: extraDemoIssueIds[1],
      ticketId: "CVL-E2E-003",
      title: "E2E demo streetlight",
      category: "streetlight",
      priorityScore: 44,
      lat: 12.9616,
      lng: 77.5846,
    },
    {
      id: extraDemoIssueIds[2],
      ticketId: "CVL-E2E-004",
      title: "E2E hidden demo overflow",
      category: "waste",
      priorityScore: 10,
      lat: 12.9516,
      lng: 77.5746,
    },
  ];

  await Promise.all(extraDemoCases.map((demoCase) => db.collection("issues").doc(demoCase.id).set({
    id: demoCase.id,
    ticketId: demoCase.ticketId,
    title: demoCase.title,
    summary: "Synthetic overflow case for default demo curation checks.",
    description: "Synthetic overflow case for default demo curation checks.",
    image: "",
    lat: demoCase.lat,
    lng: demoCase.lng,
    locationName: "Bengaluru synthetic demo area",
    category: demoCase.category,
    status: "submitted",
    timestamp: createdAt,
    createdAt,
    userId: "seeded-e2e",
    citizenUpvotes: 0,
    reportCount: 1,
    confirmCount: 0,
    disputeCount: 0,
    severity: 3,
    urgency: "routine",
    priorityScore: demoCase.priorityScore,
    isDemoData: true,
  })));

  const runId = `${issueId}_persisted-e2e`;
  const startedAt = new Date("2026-06-26T00:05:00.000Z").toISOString();
  const completedAt = new Date("2026-06-26T00:05:08.000Z").toISOString();
  const stepNames = [
    "search_nearby_cases",
    "compare_candidate_evidence",
    "calculate_priority",
    "find_responsible_authority",
    "draft_action_packet",
    "request_human_approval",
    "verify_closure",
    "record_event",
  ];
  const runRef = db.collection("agentRuns").doc(runId);
  await runRef.set({
    id: runId,
    issueId,
    status: "completed",
    model: "gemini-2.5-flash",
    startedAt,
    completedAt,
    stepCount: stepNames.length,
  });

  const batch = db.batch();
  stepNames.forEach((step, index) => {
    const stepDoc = {
      id: `${runId}_${String(index + 1).padStart(2, "0")}`,
      runId,
      issueId,
      order: index,
      model: "gemini-2.5-flash",
      step,
      tool: `agent.${step}`,
      status: "done",
      rationale: index === 5
        ? "Consequential routing remains gated for a human operator decision."
        : `Synthetic persisted ${step.replace(/_/g, " ")} result for the browser release gate.`,
      ts: new Date(Date.parse(startedAt) + index * 1000).toISOString(),
      inputDigest: `Case ${issueId} with safe summarized inputs.`,
      outputSummary: index === 5 ? "Human approval required before external action." : "Tool completed with safe summary output.",
      confidence: 0.82,
      durationMs: 700 + index * 50,
    };
    batch.set(runRef.collection("steps").doc(stepDoc.id), stepDoc);
    batch.set(db.collection("issues").doc(issueId).collection("agentSteps").doc(stepDoc.id), stepDoc);
  });
  await batch.commit();
}

async function preparePage(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    window.localStorage.setItem("has_seen_onboarding", "true");
    if (!window.localStorage.getItem("preferred_language")) {
      window.localStorage.setItem("preferred_language", "en");
    }
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

async function expectHeaderPinnedAfterScroll(page: Page) {
  const header = page.locator("header");
  await expect(header).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, Math.min(900, document.documentElement.scrollHeight - window.innerHeight)));
  await expect.poll(async () => {
    return Math.round(await header.evaluate((element) => element.getBoundingClientRect().top));
  }).toBe(0);
}

test.beforeEach(async () => {
  await seedDemoIssue();
});

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`landing page is usable and accessible at ${viewport.name}`, async ({ page }) => {
    await preparePage(page, viewport);

    await expect(page.getByRole("heading", { name: "CivicLens Field Command Center" })).toBeVisible();
    await expect(page.locator("#report-issue-btn")).toBeVisible();
    await expect(page.getByText("Synthetic demo story", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E demo pothole")).toBeVisible();
    await expect(page.getByText("E2E hidden demo overflow")).toHaveCount(0);
    await expect(page.getByText("Synthetic Cloud Run smoke test pothole")).toHaveCount(0);
    await expect(page.getByText("Metrics are calculated from the records currently loaded")).toBeVisible();
    await expect(page.locator("header")).toHaveCSS("position", "sticky");
    await expectHeaderPinnedAfterScroll(page);

    if (viewport.name === "mobile") {
      await expect(page.locator("#mobile-bottom-nav")).toBeVisible();
      await expect(page.locator("#mobile-bottom-nav")).toHaveCSS("position", "fixed");
      await expect(page.locator("#floating-report-cta")).toHaveCount(0);
      await expect(page.locator("#mobile-bottom-nav").getByRole("button", { name: "Report" })).toBeVisible();
      const bottomNavBox = await page.locator("#mobile-bottom-nav").boundingBox();
      expect(bottomNavBox?.y || 0).toBeGreaterThan(0);
      expect((bottomNavBox?.y || 0) + (bottomNavBox?.height || 0)).toBeLessThanOrEqual(viewport.height + 2);
    }

    await expectNoHorizontalOverflow(page);
    await expectNoHighImpactAxeViolations(page);
  });
}

test("mobile report flow exposes stepper, location denial, and manual pin fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1,
            message: "denied",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        },
      },
    });

    (window as any).google = {
      maps: {
        importLibrary: async () => ({
          PlaceAutocompleteElement: function FakePlaceAutocompleteElement(this: any) {
            const element = document.createElement("div") as any;
            element.className = "mock-place-autocomplete";
            const input = document.createElement("input");
            input.id = "mock-google-places-input";
            input.setAttribute("aria-label", "Search location manually");
            input.setAttribute("role", "combobox");
            input.setAttribute("aria-autocomplete", "list");
            input.setAttribute("aria-controls", "mock-google-places-listbox");
            input.setAttribute("aria-expanded", "false");
            input.style.minHeight = "44px";
            input.style.width = "100%";
            const listbox = document.createElement("div");
            listbox.id = "mock-google-places-listbox";
            listbox.setAttribute("role", "listbox");
            const option = document.createElement("button");
            option.type = "button";
            option.setAttribute("role", "option");
            option.textContent = "Indiranagar Metro Station, CMH Road, Bengaluru";
            option.style.display = "none";
            input.addEventListener("input", () => {
              option.style.display = input.value ? "block" : "none";
              input.setAttribute("aria-expanded", input.value ? "true" : "false");
            });
            option.addEventListener("click", () => {
              input.setAttribute("aria-expanded", "false");
              const event = new Event("gmp-select", { bubbles: true });
              Object.defineProperty(event, "placePrediction", {
                value: {
                  placeId: "mock-indiranagar",
                  mainText: { text: "Indiranagar Metro Station" },
                  secondaryText: { text: "CMH Road, Bengaluru" },
                  toPlace: () => ({
                    id: "mock-indiranagar",
                    displayName: { text: "Indiranagar Metro Station" },
                    formattedAddress: "Indiranagar Metro Station, CMH Road, Bengaluru",
                    location: { toJSON: () => ({ lat: 12.97837, lng: 77.64084 }) },
                    fetchFields: async () => undefined,
                  }),
                },
              });
              element.dispatchEvent(event);
            });
            Object.defineProperty(element, "placeholder", {
              set(value: string) {
                input.placeholder = value;
              },
            });
            Object.defineProperty(element, "value", {
              get() {
                return input.value;
              },
              set(value: string) {
                input.value = value || "";
              },
            });
            listbox.append(option);
            element.append(input, listbox);
            return element;
          },
        }),
      },
    };
  });
  await preparePage(page, { width: 390, height: 844 });

  await page.locator("#mobile-bottom-nav").getByRole("button", { name: "Report" }).click();
  await expect(page.locator("#report-stepper")).toBeVisible();
  await expect(page.getByRole("button", { name: "Take live photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload from gallery" })).toBeVisible();

  const liveInput = page.locator("#report-live-photo-input");
  const galleryInput = page.locator("#report-gallery-upload-input");
  await expect(liveInput).toHaveAttribute("accept", "image/*");
  await expect(liveInput).toHaveAttribute("capture", "environment");
  await expect(galleryInput).toHaveAttribute("accept", "image/*");
  await expect(galleryInput).not.toHaveAttribute("capture", /.+/);

  await galleryInput.setInputFiles({ name: "gallery-pothole.png", mimeType: "image/png", buffer: tinyPng });
  await expect(page.getByAltText("Civic preview")).toBeVisible();
  await page.getByRole("button", { name: "Remove proof photograph" }).click();
  await liveInput.setInputFiles({ name: "live-pothole.png", mimeType: "image/png", buffer: tinyPng });
  await expect(page.getByAltText("Civic preview")).toBeVisible();

  await expect(page.getByRole("button", { name: /Use my current location/i })).toBeVisible();
  await expect(page.getByText("Location permission is blocked or unavailable. Search for a location, drop a pin manually, or type a nearby landmark.")).toBeVisible();
  await expect(page.locator("#manual-pin-fallback")).toBeVisible();
  await page.getByRole("button", { name: /Drop pin manually/i }).click();
  await expect(page.getByText("Coordinates locked.")).toBeVisible();
  await expect(page.locator("#google-places-autocomplete")).toBeVisible();
  await expect(page.getByText("Powered by Google Places autocomplete")).toBeVisible();
  await page.locator("#mock-google-places-input").fill("Indira");
  await expect(page.getByRole("option", { name: /Indiranagar Metro Station/i })).toBeVisible();
  await page.getByRole("option", { name: /Indiranagar Metro Station/i }).click();
  await expect(page.locator("#mock-google-places-input")).toHaveValue("Indiranagar Metro Station, CMH Road, Bengaluru");
  await expect(page.getByText("Coordinates locked.")).toBeVisible();
  await expectHeaderPinnedAfterScroll(page);
  await expectNoHorizontalOverflow(page);
  await expectNoHighImpactAxeViolations(page);
});

test("header account menu explains citizen session and operator access", async ({ page }) => {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await preparePage(page, { width: 1280, height: 900 });

  await expect(page.locator("#header-account-button")).toBeVisible();
  await expect(page.locator("#header-account-button")).toHaveAccessibleName("Open account menu");
  await page.locator("#header-account-button").click();

  await expect(page.locator("#account-menu")).toBeVisible();
  await expect(page.getByText("Citizen session")).toBeVisible();
  await expect(page.getByText("Public access")).toBeVisible();
  await expect(page.getByText("Sign in with Google to attach a verified identity")).toBeVisible();
  await expect(page.getByText("Language")).toBeVisible();
  await expect(page.locator("#lang-hi-btn")).toBeVisible();
  await page.locator("#lang-hi-btn").click();
  await expect(page.getByText("AI-सहायित नागरिक रिपोर्ट")).toBeVisible();
  await page.reload();
  await expect(page.getByText("AI-सहायित नागरिक रिपोर्ट")).toBeVisible();
  await page.locator("#header-account-button").click();
  await page.locator("#lang-en-btn").click();
  await expect(page.getByText("AI-assisted civic reports")).toBeVisible();
  await expect(page.getByText(/Operator access status: (none|demo|real)/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google sign-in unavailable" })).toHaveCount(0);
  await expect(page.locator("#account-auth-error")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.locator("#account-menu")).toHaveCount(0);
  await page.locator("#header-account-button").click();
  await expect(page.locator("#account-menu")).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.locator("#account-menu")).toHaveCount(0);

  await page.locator("#header-account-button").click();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.locator("#account-auth-error")).toHaveCount(0);
});

test("persisted agent run remains visible after refresh", async ({ page }) => {
  await preparePage(page, { width: 1280, height: 900 });

  await page.getByLabel("View details of ticket CVL-E2E-001").click();
  await expect(page.locator("#issue-detail-page")).toBeVisible();
  await expect(page.locator("#agent-trace-section")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Agent tool timeline/i })).toBeVisible();
  await expect(page.getByText("8/8")).toBeVisible();
  await expect(page.getByText("Human approval gate")).toBeVisible();

  await page.reload();
  await expect(page.locator("#agent-trace-section")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Agent tool timeline/i })).toBeVisible();
  await expect(page.getByText("8/8")).toBeVisible();
});

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

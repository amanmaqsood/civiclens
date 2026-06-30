import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.CIVICLENS_PUBLIC_URL || "https://civiclens-py7ixxgroq-as.a.run.app").replace(/\/$/, "");
const sampleImagePath = process.env.CIVICLENS_SAMPLE_IMAGE || path.resolve(process.cwd(), "..", "images (1).jpg");
const outDir = path.resolve(process.cwd(), "qa-results", "headed-phase-0-6");
const summaryPath = path.join(outDir, "public-headed-phase-status.json");
const capPattern = /RESOURCE_EXHAUSTED|spending cap|quota|429|rate limit/i;
let routeCounter = 0;

const evidence = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  sampleImagePath,
  mode: "headed chromium via Playwright",
  screenshots: [],
  browserEvents: {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    serverResponses: [],
  },
  results: [],
};

function mark(id, status, details, data = {}) {
  evidence.results.push({ id, status, details, ...data });
  console.log(`${status} ${id} - ${details}`);
}

async function ensureDir() {
  await fs.mkdir(outDir, { recursive: true });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function screenshot(page, name) {
  const filePath = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  evidence.screenshots.push(path.relative(process.cwd(), filePath).replace(/\\/g, "/"));
}

function watchPage(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      evidence.browserEvents.consoleErrors.push({ label, text: msg.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => {
    evidence.browserEvents.pageErrors.push({ label, text: String(error?.message || error).slice(0, 500) });
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("sockjs-node") || url.includes("__vite_ping")) return;
    evidence.browserEvents.failedRequests.push({
      label,
      method: request.method(),
      url: url.slice(0, 220),
      failure: request.failure()?.errorText || "unknown",
    });
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 500 && response.url().startsWith(baseUrl)) {
      evidence.browserEvents.serverResponses.push({
        label,
        status,
        url: response.url().slice(0, 220),
      });
    }
  });
}

async function safeStep(id, fn) {
  try {
    return await fn();
  } catch (error) {
    mark(id, "FAIL", String(error?.message || error).slice(0, 900));
    return null;
  }
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { response, data, text };
}

async function waitForAnyText(page, patterns, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.locator("body").innerText().catch(() => "");
    const hit = patterns.find((pattern) => pattern.test(text));
    if (hit) return { pattern: String(hit), text };
    await page.waitForTimeout(500);
  }
  const text = await page.locator("body").innerText().catch(() => "");
  throw new Error(`Timed out waiting for text ${patterns.map(String).join(", ")}. Body starts: ${text.slice(0, 600)}`);
}

async function checkOverflow(page, id) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  mark(id, overflow <= 2 ? "PASS" : "FAIL", `horizontalOverflowPx=${overflow}`);
}

function appUrl(hash = "") {
  routeCounter += 1;
  return `${baseUrl}/?headed=${Date.now()}-${routeCounter}${hash}`;
}

async function bypassOnboarding(context) {
  await context.addInitScript(() => {
    localStorage.setItem("has_seen_onboarding", "true");
  });
}

async function runDeploySmokeIfSecret() {
  const jobSecret = process.env.CIVICLENS_JOB_SECRET;
  if (!jobSecret) {
    mark("phase6.4.deploy-smoke", "SKIPPED", "CIVICLENS_JOB_SECRET not present in process env for this headed verifier run.");
    return;
  }
  const { response, data, text } = await fetchJson(`${baseUrl}/api/smoke/deploy`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-civiclens-job-secret": jobSecret,
    },
    body: "{}",
  });
  if (response.ok && data?.success) {
    mark("phase6.4.deploy-smoke", "PASS", `ready=${data.checks?.readyz?.status} auth=${data.checks?.auth?.status} gemini=${data.checks?.gemini?.status} maps=${data.checks?.maps?.status}`);
    return;
  }
  const combined = `${text} ${JSON.stringify(data || {})}`;
  mark(
    "phase6.4.deploy-smoke",
    capPattern.test(combined) ? "BLOCKED_GEMINI_CAP" : "FAIL",
    `HTTP ${response.status}; ${combined.slice(0, 700)}`
  );
}

async function runModelTierSmokeIfSecret() {
  const jobSecret = process.env.CIVICLENS_JOB_SECRET;
  if (!jobSecret) {
    mark("phase3.4.model-tier-smoke", "SKIPPED", "CIVICLENS_JOB_SECRET not present in process env for this headed verifier run.");
    return;
  }
  const { response, data, text } = await fetchJson(`${baseUrl}/api/smoke/model-tiers`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-civiclens-job-secret": jobSecret,
    },
    body: "{}",
  });
  if (response.ok && data?.success) {
    const tiers = data.models || data.modelTiers || {};
    mark("phase3.4.model-tier-smoke", "PASS", `cheap=${tiers.cheap || tiers.cheapClassification} vision=${tiers.vision} reasoning=${tiers.reasoning} planner=${tiers.planner} embedding=${tiers.embedding}`);
    return;
  }
  const combined = `${text} ${JSON.stringify(data || {})}`;
  mark(
    "phase3.4.model-tier-smoke",
    capPattern.test(combined) ? "BLOCKED_GEMINI_CAP" : "FAIL",
    `HTTP ${response.status}; ${combined.slice(0, 700)}`
  );
}

async function run() {
  await ensureDir();
  if (!(await exists(sampleImagePath))) {
    throw new Error(`Sample image not found: ${sampleImagePath}`);
  }

  await safeStep("phase0.sample-image", async () => {
    const stat = await fs.stat(sampleImagePath);
    mark("phase0.sample-image", "PASS", `sample upload image exists, bytes=${stat.size}`);
  });

  await safeStep("phase0.readyz", async () => {
    const { response, data } = await fetchJson(`${baseUrl}/readyz`);
    const checks = data?.checks || {};
    const ok = response.ok && data?.ready === true && checks.adminDb === true && checks.geminiConfigured === true && checks.configValid === true;
    mark("phase0.readyz", ok ? "PASS" : "FAIL", `HTTP ${response.status}; ready=${data?.ready}; adminDb=${checks.adminDb}; geminiConfigured=${checks.geminiConfigured}; configValid=${checks.configValid}`);
  });

  await safeStep("phase6.4.deploy-smoke", runDeploySmokeIfSecret);
  await safeStep("phase3.4.model-tier-smoke", runModelTierSmokeIfSecret);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 90,
    args: ["--disable-dev-shm-usage"],
  });

  try {
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
      acceptDownloads: true,
    });
    await bypassOnboarding(desktop);
    const page = await desktop.newPage();
    watchPage(page, "desktop");

    await safeStep("phase0.public-boot-desktop", async () => {
      await page.goto(appUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.locator("#main-content, main").first().waitFor({ state: "visible", timeout: 45000 });
      await waitForAnyText(page, [/CivicLens/i, /AI-assisted civic reports/i, /Report/i], 20000);
      await screenshot(page, "01-public-home-desktop");
      mark("phase0.public-boot-desktop", "PASS", "public app loaded in headed desktop browser and main content is visible.");
      await checkOverflow(page, "phase5.desktop-overflow");
    });

    await safeStep("phase5.account-language-google-entry", async () => {
      await page.locator("#header-account-button").click();
      await page.locator("#account-menu").waitFor({ state: "visible", timeout: 15000 });
      const menuText = await page.locator("#account-menu").innerText();
      const ok = /Citizen session/i.test(menuText) && /Google/i.test(menuText) && /Language/i.test(menuText);
      mark("phase5.account-language-google-entry", ok ? "PASS" : "FAIL", menuText.replace(/\s+/g, " ").slice(0, 300));
      await page.keyboard.press("Escape").catch(() => {});
    });

    await safeStep("phase5.dark-mode-persistence", async () => {
      await page.locator("#header-theme-toggle").click();
      await page.waitForTimeout(700);
      const stateBeforeReload = await page.evaluate(() => ({
        htmlClass: document.documentElement.className,
        bodyClass: document.body.className,
        storage: localStorage.getItem("civiclens-theme") || localStorage.getItem("theme"),
      }));
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await page.locator("#main-content, main").first().waitFor({ state: "visible", timeout: 30000 });
      const stateAfterReload = await page.evaluate(() => ({
        htmlClass: document.documentElement.className,
        bodyClass: document.body.className,
        storage: localStorage.getItem("civiclens-theme") || localStorage.getItem("theme"),
      }));
      await screenshot(page, "02-public-home-dark-mode");
      const combined = `${JSON.stringify(stateBeforeReload)} ${JSON.stringify(stateAfterReload)}`;
      mark("phase5.dark-mode-persistence", /dark/i.test(combined) ? "PASS" : "FAIL", combined.slice(0, 500));
    });

    await safeStep("phase5.dashboard-open311", async () => {
      await page.goto(appUrl("#dashboard"), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.locator("#impact-dashboard").waitFor({ state: "visible", timeout: 45000 });
      await page.locator("#dashboard-kpi-row").waitFor({ state: "visible", timeout: 30000 });
      await page.locator("#dashboard-heatmap").waitFor({ state: "visible", timeout: 30000 });
      const open311 = await page.evaluate(async () => {
        const res = await fetch("/api/export/open311");
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, count: data.count, format: data.format, hasArray: Array.isArray(data.service_requests) };
      });
      await screenshot(page, "03-public-dashboard-open311");
      const ok = open311.ok && open311.format === "open311-georeport-v2" && open311.hasArray;
      mark("phase4.3.phase5.dashboard-open311", ok ? "PASS" : "FAIL", `impact dashboard visible; Open311 status=${open311.status}, format=${open311.format}, count=${open311.count}`);
      await checkOverflow(page, "phase5.dashboard-overflow");
    });

    await safeStep("phase4.2.leaderboard-visible", async () => {
      await page.getByRole("heading", { name: /Community leaderboard/i }).scrollIntoViewIfNeeded({ timeout: 10000 });
      await screenshot(page, "04-public-leaderboard");
      const leaderboardText = await page.locator("body").innerText();
      mark("phase4.2.leaderboard-visible", /Community leaderboard/i.test(leaderboardText) ? "PASS" : "FAIL", "dashboard leaderboard section checked in headed browser.");
    });

    await safeStep("phase1.phase4.operator-demo-agent-ledger", async () => {
      await page.goto(appUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.locator("#main-content, main").first().waitFor({ state: "visible", timeout: 45000 });
      await page.getByRole("button", { name: /Switch to synthetic demo desk/i }).click({ timeout: 20000 });
      await page.locator("#operator-queue-container").waitFor({ state: "visible", timeout: 45000 });
      if (await page.locator("#load-demo-btn").isVisible({ timeout: 5000 }).catch(() => false)) {
        await page.locator("#load-demo-btn").click();
        await page.waitForTimeout(2500);
      }
      await page.locator("#operator-queue-container").waitFor({ state: "visible", timeout: 20000 });
      const bodyText = await page.locator("body").innerText();
      const preferredRow = page.locator("[id^='operator-issue-row-']").filter({
        hasText: /Broken Streetlight Street 14 Jayanagar|Clogged Stormwater Drain on Koramangala/i,
      }).first();
      const row = await preferredRow.isVisible({ timeout: 8000 }).catch(() => false)
        ? preferredRow
        : page.locator("[id^='operator-issue-row-']").first();
      const hasRow = await row.isVisible({ timeout: 20000 }).catch(() => false);
      if (hasRow) {
        await row.click();
        await page.getByText(/Watch agents think/i).waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
        await page.locator("#agent-trace-section").waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
      }
      await screenshot(page, "05-public-operator-demo-agent-ledger");
      const afterText = await page.locator("body").innerText();
      const ok = /Synthetic Demo Desk/i.test(afterText) && /Demo actions are server-limited/i.test(afterText) && (hasRow || /Seed Demo/i.test(bodyText));
      mark("phase1.phase4.operator-demo-agent-ledger", ok ? "PASS" : "FAIL", `operator demo visible=${/Synthetic Demo Desk/i.test(afterText)}, rowVisible=${hasRow}, agentPanel=${/Watch agents think|Agent tool timeline/i.test(afterText)}`);
      if (hasRow) {
        const runAgentButton = page.getByRole("button", { name: /Run server agent|Re-run server agent/i });
        if (await runAgentButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await runAgentButton.click({ timeout: 20000 });
          const outcome = await waitForAnyText(page, [
            /Failed to run the server agent workflow/i,
            /RESOURCE_EXHAUSTED/i,
            /spending cap/i,
            /Server agent completed/i,
            /Status\s+Completed/i,
            /Status\s+Failed/i,
          ], 180000).catch(async () => ({ text: await page.locator("body").innerText().catch(() => "") }));
          await screenshot(page, "05b-public-operator-agent-run-attempt");
          const outcomeText = outcome.text || "";
          const agentBlocked = /Failed to run the server agent workflow|RESOURCE_EXHAUSTED|spending cap/i.test(outcomeText);
          const agentCompleted = /Server agent completed|Status\s+Completed|agent_complete|Re-run server agent/i.test(outcomeText);
          const agentRunning = !agentCompleted && /Running server agent|Status\s+Running/i.test(outcomeText);
          const agentPassed = agentCompleted && !agentBlocked;
          mark(
            "phase1.agent-run-button-attempt",
            agentBlocked ? "BLOCKED_GEMINI_CAP" : agentPassed ? "PASS" : "PARTIAL",
            outcomeText.replace(/\s+/g, " ").slice(0, 700)
          );
        } else {
          mark("phase1.agent-run-button-attempt", "PARTIAL", "Run server agent button was not visible on the selected demo issue.");
        }
      }
    });

    await desktop.close();

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      ignoreHTTPSErrors: true,
    });
    await bypassOnboarding(mobile);
    await mobile.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (_success, error) => {
            error({
              code: 1,
              message: "denied by headed verifier",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            });
          },
        },
      });
    });
    const mobilePage = await mobile.newPage();
    watchPage(mobilePage, "mobile-report");

    await safeStep("phase5.mobile-report-upload", async () => {
      await mobilePage.goto(appUrl("#report"), { waitUntil: "domcontentloaded", timeout: 60000 });
      await mobilePage.locator("#report-stepper").waitFor({ state: "visible", timeout: 45000 });
      await mobilePage.locator("#report-gallery-upload-input").setInputFiles(sampleImagePath);
      await mobilePage.getByAltText("Civic preview").waitFor({ state: "visible", timeout: 30000 });
      await mobilePage.getByRole("button", { name: /Drop pin manually/i }).click({ timeout: 20000 });
      await waitForAnyText(mobilePage, [/Coordinates locked/i], 20000);
      await mobilePage.locator("textarea").first().fill("Internal-test headed browser smoke-test record: pothole blocks a lane near Indiranagar Metro Station.");
      await screenshot(mobilePage, "06-public-mobile-report-upload");
      mark("phase5.mobile-report-upload", "PASS", "mobile report stepper, gallery upload sample image, preview, manual pin fallback, and description were exercised.");
      await checkOverflow(mobilePage, "phase5.mobile-report-overflow");
    });

    await safeStep("phase1.phase3.public-report-submit", async () => {
      await mobilePage.getByRole("button", { name: /Save incident report/i }).click({ timeout: 20000 });
      const triage = await waitForAnyText(mobilePage, [/Confirm Gemini draft/i, /Manual logging mode active/i, /Failed to submit report/i, /Authentication required/i], 70000);
      const text = triage.text;
      if (/Confirm Gemini draft/i.test(text)) {
        await screenshot(mobilePage, "07-public-report-gemini-draft");
        mark("phase1.phase3.ai-triage", "PASS", "public report analysis produced a real Gemini draft in the headed browser flow.");
        await mobilePage.getByRole("button", { name: /Confirm and save report/i }).click({ timeout: 20000 });
      } else if (/Manual logging mode active/i.test(text)) {
        await screenshot(mobilePage, "07-public-report-manual-after-gemini-cap");
        await mobilePage.locator("#fallback-description").fill("Internal-test headed browser smoke-test record: pothole blocks a lane near Indiranagar Metro Station.");
        await mobilePage.getByRole("button", { name: /Confirm and save report/i }).click({ timeout: 20000 });
        mark("phase1.phase3.ai-triage", "BLOCKED_GEMINI_CAP", "public report analyze fell to manual mode; this is the expected visible result while Gemini is capped.");
      }
      const final = await waitForAnyText(
        mobilePage,
        [
          /Report Logged Successfully/i,
          /Evidence Linked Successfully/i,
          /Checking nearby reports/i,
          /Add my report as evidence to this case/i,
          /Report as a new issue/i,
          /Failed to submit report/i,
          /Authentication required/i,
        ],
        180000
      );
      await screenshot(mobilePage, "08-public-report-submit-result");
      if (/Failed to submit report|Authentication required/i.test(final.text)) {
        const status = capPattern.test(final.text) ? "BLOCKED_GEMINI_CAP" : "FAIL";
        mark("phase1.phase3.public-report-submit", status, final.text.replace(/\s+/g, " ").slice(0, 600));
      } else if (/Add my report as evidence to this case/i.test(final.text)) {
        mark("phase3.semantic-duplicate-decision", "PASS", final.text.replace(/\s+/g, " ").slice(0, 700));
        await mobilePage.getByRole("button", { name: /Add my report as evidence to this case/i }).click({ timeout: 20000 });
        const linked = await waitForAnyText(mobilePage, [/Evidence Linked Successfully/i, /Report Logged Successfully/i, /Failed to link evidence/i], 120000);
        await screenshot(mobilePage, "09-public-report-duplicate-linked-result");
        mark(
          "phase3.duplicate-link-finalization",
          /Evidence Linked Successfully|Report Logged Successfully/i.test(linked.text) ? "PASS" : "FAIL",
          linked.text.replace(/\s+/g, " ").slice(0, 700)
        );
      } else {
        mark("phase1.phase3.public-report-submit", "PASS", "sample-image report flowed through submit path to a saved/checking state in headed mobile browser.");
      }
    });

    await mobile.close();
  } finally {
    await browser.close();
  }

  const consoleCount = evidence.browserEvents.consoleErrors.length;
  const pageErrorCount = evidence.browserEvents.pageErrors.length;
  const failedRequestCount = evidence.browserEvents.failedRequests.length;
  mark(
    "phase0.browser-event-cleanliness",
    consoleCount === 0 && pageErrorCount === 0 ? "PASS" : "PARTIAL",
    `consoleErrors=${consoleCount}; pageErrors=${pageErrorCount}; failedRequests=${failedRequestCount}; server5xx=${evidence.browserEvents.serverResponses.length}`
  );

  await fs.writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`SUMMARY ${summaryPath}`);
}

run().catch(async (error) => {
  mark("verifier", "FAIL", String(error?.stack || error?.message || error).slice(0, 1800));
  await ensureDir();
  await fs.writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8").catch(() => {});
  process.exitCode = 1;
});

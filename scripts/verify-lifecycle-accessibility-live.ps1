$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-lifecycle-a11y-server.out.log"
$serverErr = Join-Path $root "tmp-lifecycle-a11y-server.err.log"
Remove-Item -LiteralPath $serverOut, $serverErr -ErrorAction SilentlyContinue

function Wait-Http {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 90
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 3
      if ($null -ne $response) {
        return $response
      }
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }

  throw "Timed out waiting for $Url"
}

$server = $null
$tempNodeScript = $null
try {
  $env:PORT = "3021"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:GOOGLE_CLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:GEMINI_API_KEY = "local-lifecycle-a11y-test"
  $env:VITE_CIVICLENS_USE_FIREBASE_EMULATORS = "true"
  $env:VITE_FIREBASE_EMULATOR_HOST = "127.0.0.1"
  $env:VITE_FIREBASE_AUTH_EMULATOR_PORT = "9099"
  $env:VITE_FIRESTORE_EMULATOR_PORT = "8080"
  $env:VITE_FIREBASE_STORAGE_EMULATOR_PORT = "9199"
  $env:VITE_FIREBASE_API_KEY = "demo-api-key"
  $env:VITE_FIREBASE_AUTH_DOMAIN = "demo-civiclens.firebaseapp.com"
  $env:VITE_FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:VITE_FIREBASE_APP_ID = "1:123456789:web:demo"
  $env:VITE_FIREBASE_STORAGE_BUCKET = "demo-civiclens.appspot.com"
  $env:VITE_FIRESTORE_DATABASE_ID = "(default)"

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Http "http://127.0.0.1:3021/health" 90 | Out-Null

  $nodeScript = @'
const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { chromium } = require("playwright");

const requireFromHere = createRequire(process.cwd() + "/");
const axeSource = readFileSync(requireFromHere.resolve("axe-core/axe.min.js"), "utf8");
const projectId = process.env.FIREBASE_PROJECT_ID || "demo-civiclens";
const baseUrl = "http://127.0.0.1:3021";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();
const dataImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function seedIssues() {
  const batch = db.batch();
  const records = [
    {
      id: "lifecycle-a11y-submitted",
      ticketId: "LIFE-A11Y-001",
      status: "submitted",
      title: "Lifecycle submitted pothole",
      category: "pothole",
      severity: 4,
      urgency: "priority",
      priorityScore: 72,
      createdAt: isoHoursAgo(6),
      timestamp: isoHoursAgo(6),
      updatedAt: isoHoursAgo(6),
      lat: 12.9716,
      lng: 77.5946,
    },
    {
      id: "lifecycle-a11y-verified",
      ticketId: "LIFE-A11Y-002",
      status: "verified",
      title: "Lifecycle verified streetlight",
      category: "streetlight",
      severity: 2,
      urgency: "routine",
      priorityScore: 42,
      createdAt: isoHoursAgo(20),
      timestamp: isoHoursAgo(20),
      updatedAt: isoHoursAgo(18),
      lat: 12.976,
      lng: 77.6001,
    },
    {
      id: "lifecycle-a11y-progress",
      ticketId: "LIFE-A11Y-003",
      status: "in_progress",
      title: "Lifecycle in-progress water leak",
      category: "water_leak",
      severity: 5,
      urgency: "urgent",
      priorityScore: 88,
      createdAt: isoHoursAgo(30),
      timestamp: isoHoursAgo(30),
      updatedAt: isoHoursAgo(4),
      lat: 12.965,
      lng: 77.61,
    },
    {
      id: "lifecycle-a11y-resolved",
      ticketId: "LIFE-A11Y-004",
      status: "resolved",
      title: "Lifecycle resolved drainage",
      category: "drainage",
      severity: 3,
      urgency: "priority",
      priorityScore: 66,
      createdAt: isoHoursAgo(72),
      timestamp: isoHoursAgo(72),
      updatedAt: isoHoursAgo(8),
      resolvedAt: isoHoursAgo(8),
      lat: 12.982,
      lng: 77.607,
    },
  ];

  for (const issue of records) {
    batch.set(db.collection("issues").doc(issue.id), {
      image: dataImage,
      description: `${issue.title} seeded for lifecycle accessibility verification.`,
      summary: `${issue.title} seeded for lifecycle accessibility verification.`,
      locationName: "Bengaluru lifecycle verifier",
      userId: "lifecycle-a11y-seed",
      citizenUpvotes: 2,
      confirmCount: 1,
      disputeCount: 0,
      reportCount: 1,
      confidence: 0.91,
      isDemoData: false,
      ...issue,
    });
    batch.set(db.collection("issues").doc(issue.id).collection("events").doc("created"), {
      actorId: "system",
      actorType: "api",
      eventType: "created",
      message: "Lifecycle accessibility verifier seed event.",
      source: "api",
      status: "succeeded",
      timestamp: issue.createdAt,
    });
  }
  await batch.commit();
}

async function runAxe(page, selector) {
  await page.addScriptTag({ content: axeSource });
  return await page.evaluate(async (scopeSelector) => {
    const scope = document.querySelector(scopeSelector) || document;
    const result = await window.axe.run(scope, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
      resultTypes: ["violations"],
    });
    return result.violations
      .filter((violation) => ["serious", "critical"].includes(violation.impact || ""))
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        target: violation.nodes[0]?.target || [],
        html: violation.nodes[0]?.html || "",
      }));
  }, selector);
}

async function main() {
  await seedIssues();
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  let reportViolations = [];
  let detailViolations = [];
  let dashboardViolations = [];
  let detailBadges = 0;
  let dashboardBadges = 0;
  let badgeIcons = 0;
  let stepIcons = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("has_seen_onboarding", "true");
        window.localStorage.setItem("preferred_language", "en");
        window.localStorage.setItem("civiclens-theme", "light");
      } catch {
        // about:blank documents can deny localStorage during hash-route resets.
      }
    });

    await page.goto(`${baseUrl}/#report`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#report-stepper", { timeout: 30000 });
    reportViolations = await runAxe(page, "#main-content");

    await page.goto("about:blank");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${baseUrl}/#issue/lifecycle-a11y-progress`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#issue-detail-page", { timeout: 30000 });
    await page.waitForSelector("[data-lifecycle-status='in_progress']", { timeout: 30000 });
    detailBadges = await page.locator("#issue-detail-page [data-lifecycle-status]").count();
    badgeIcons += await page.locator("#issue-detail-page [data-lifecycle-status] svg").count();
    stepIcons = await page.locator("#issue-detail-page [title*='Report saved'] svg").count();
    detailViolations = await runAxe(page, "#issue-detail-page");

    await page.goto("about:blank");
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto(`${baseUrl}/#dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#impact-dashboard", { timeout: 30000 });
    await page.waitForSelector("#dashboard-kpi-row", { timeout: 30000 });
    await page.waitForSelector("[data-lifecycle-status='submitted']", { timeout: 30000 });
    dashboardBadges = await page.locator("#impact-dashboard [data-lifecycle-status]").count();
    badgeIcons += await page.locator("#impact-dashboard [data-lifecycle-status] svg").count();
    dashboardViolations = await runAxe(page, "#impact-dashboard");
  } finally {
    await browser.close();
  }

  const seriousCritical = [...reportViolations, ...detailViolations, ...dashboardViolations];
  const actionableConsoleErrors = consoleErrors.filter((line) => {
    return !/favicon|manifest|ResizeObserver|Could not reach Cloud Firestore backend|client will operate in offline mode|localStorage.*Access is denied/i.test(line);
  });
  if (detailBadges < 1) throw new Error(`Expected detail lifecycle badge, saw ${detailBadges}.`);
  if (dashboardBadges < 4) throw new Error(`Expected dashboard lifecycle badges, saw ${dashboardBadges}.`);
  if (badgeIcons < 5) throw new Error(`Expected lifecycle badge icons, saw ${badgeIcons}.`);
  if (stepIcons < 1) throw new Error("Expected lifecycle step icons on the issue detail progress rail.");
  if (seriousCritical.length > 0) throw new Error(`Axe serious/critical violations: ${JSON.stringify(seriousCritical)}`);
  if (actionableConsoleErrors.length > 0) throw new Error(`Browser errors: ${actionableConsoleErrors.slice(0, 3).join(" | ")}`);

  console.log(`LIFECYCLE_A11Y_LIVE reportAxe=0 detailAxe=0 dashboardAxe=0 detailBadges=${detailBadges} dashboardBadges=${dashboardBadges} badgeIcons=${badgeIcons} stepIcons=${stepIcons}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
'@

  $tempNodeScript = Join-Path $root "tmp-lifecycle-a11y-verifier.cjs"
  Set-Content -LiteralPath $tempNodeScript -Value $nodeScript -Encoding UTF8
  & node $tempNodeScript
  if ($LASTEXITCODE -ne 0) {
    throw "Lifecycle accessibility live verifier failed."
  }
} catch {
  Write-Output "LIFECYCLE_A11Y_LIVE_FAILED $($_.Exception.Message)"
  Get-Content $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 120
  Get-Content $serverOut -ErrorAction SilentlyContinue | Select-Object -Last 180
  exit 1
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }

  if ($tempNodeScript) {
    Remove-Item -LiteralPath $tempNodeScript -ErrorAction SilentlyContinue
  }

  Get-CimInstance Win32_Process |
    Where-Object {
      $_.CommandLine -match "tsx" -and
      $_.CommandLine -match "server.ts" -and
      $_.CommandLine -match "civiclens-"
    } |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

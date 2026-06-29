$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-dashboard-server.out.log"
$serverErr = Join-Path $root "tmp-dashboard-server.err.log"
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
  $env:PORT = "3020"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:GOOGLE_CLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:GEMINI_API_KEY = "local-dashboard-test"
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

  Wait-Http "http://127.0.0.1:3020/health" 90 | Out-Null

  $nodeScript = @'
const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { chromium } = require("playwright");

const requireFromHere = createRequire(process.cwd() + "/");
const axeSource = readFileSync(requireFromHere.resolve("axe-core/axe.min.js"), "utf8");
const projectId = process.env.FIREBASE_PROJECT_ID || "demo-civiclens";
const baseUrl = "http://127.0.0.1:3020";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();

function isoDaysAgo(days, hour = 9) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

async function seedDashboardIssues() {
  const batch = db.batch();
  const issues = [
    {
      id: "dash-live-real-1",
      ticketId: "DASH-LIVE-001",
      title: "Dashboard pothole resolved",
      category: "pothole",
      status: "resolved",
      createdAt: isoDaysAgo(1, 8),
      timestamp: isoDaysAgo(1, 8),
      resolvedAt: isoDaysAgo(0, 10),
      updatedAt: isoDaysAgo(0, 10),
      reportCount: 3,
      severity: 4,
      urgency: "priority",
      lat: 12.9716,
      lng: 77.5946,
    },
    {
      id: "dash-live-real-2",
      ticketId: "DASH-LIVE-002",
      title: "Dashboard water leak active",
      category: "water_leak",
      status: "in_progress",
      createdAt: isoDaysAgo(2, 11),
      timestamp: isoDaysAgo(2, 11),
      updatedAt: isoDaysAgo(1, 12),
      reportCount: 1,
      severity: 3,
      urgency: "urgent",
      lat: 12.976,
      lng: 77.6001,
    },
    {
      id: "dash-live-real-3",
      ticketId: "DASH-LIVE-003",
      title: "Dashboard streetlight resolved",
      category: "streetlight",
      status: "resolved",
      createdAt: isoDaysAgo(4, 9),
      timestamp: isoDaysAgo(4, 9),
      resolvedAt: isoDaysAgo(3, 14),
      updatedAt: isoDaysAgo(3, 14),
      reportCount: 1,
      severity: 2,
      urgency: "routine",
      lat: 12.968,
      lng: 77.585,
    },
    {
      id: "dash-live-real-4",
      ticketId: "DASH-LIVE-004",
      title: "Dashboard drainage submitted",
      category: "drainage",
      status: "submitted",
      createdAt: isoDaysAgo(8, 10),
      timestamp: isoDaysAgo(8, 10),
      updatedAt: isoDaysAgo(8, 10),
      reportCount: 2,
      severity: 5,
      urgency: "urgent",
      lat: 12.982,
      lng: 77.607,
    },
    {
      id: "dash-live-real-5",
      ticketId: "DASH-LIVE-005",
      title: "Dashboard waste prior resolved",
      category: "waste",
      status: "resolved",
      createdAt: isoDaysAgo(11, 10),
      timestamp: isoDaysAgo(11, 10),
      resolvedAt: isoDaysAgo(8, 16),
      updatedAt: isoDaysAgo(8, 16),
      reportCount: 1,
      severity: 3,
      urgency: "priority",
      lat: 12.965,
      lng: 77.61,
    },
    {
      id: "dash-live-demo-1",
      ticketId: "DASH-DEMO-001",
      title: "Dashboard synthetic demo case",
      category: "road_damage",
      status: "verified",
      createdAt: isoDaysAgo(0, 7),
      timestamp: isoDaysAgo(0, 7),
      updatedAt: isoDaysAgo(0, 7),
      reportCount: 1,
      severity: 3,
      urgency: "routine",
      lat: 12.955,
      lng: 77.58,
      isDemoData: true,
    },
  ];

  for (const issue of issues) {
    batch.set(db.collection("issues").doc(issue.id), {
      image: "https://example.com/civiclens/dashboard.jpg",
      summary: issue.title,
      description: issue.title,
      locationName: "Bengaluru dashboard verifier",
      userId: "dashboard-live-seed",
      citizenUpvotes: 0,
      confirmCount: 0,
      disputeCount: 0,
      priorityScore: 55,
      isDemoData: false,
      ...issue,
    });
  }
  await batch.commit();
}

async function main() {
  await seedDashboardIssues();
  const browser = await chromium.launch({ headless: true });
  let seriousCritical = [];
  let kpiCards = 0;
  let sparklineCount = 0;
  let heatCells = 0;
  let responseRows = 0;
  let tableRows = 0;
  const consoleErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem("has_seen_onboarding", "true");
      window.localStorage.setItem("preferred_language", "en");
    });
    await page.goto(`${baseUrl}/#dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#impact-dashboard", { timeout: 30000 });
    await page.waitForSelector("#dashboard-kpi-row", { timeout: 30000 });
    await page.waitForSelector("#dashboard-heatmap rect", { timeout: 30000 });
    await page.waitForSelector("#dashboard-live-feed", { timeout: 30000 });

    kpiCards = await page.locator("#dashboard-kpi-row > div").count();
    sparklineCount = await page.locator("#dashboard-kpi-row svg").count();
    heatCells = await page.locator("#dashboard-heatmap rect").count();
    await page.getByRole("button", { name: "Agency triage" }).click();
    await page.waitForSelector("#dashboard-response-distribution", { timeout: 30000 });
    await page.waitForSelector("#dashboard-agency-table tbody tr", { timeout: 30000 });
    responseRows = await page.locator("#dashboard-response-distribution [role='img']").count();
    tableRows = await page.locator("#dashboard-agency-table tbody tr").count();

    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document);
      return result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.slice(0, 3).map((node) => ({
          target: node.target,
          html: node.html,
        })),
      }));
    });
    seriousCritical = violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""));
  } finally {
    await browser.close();
  }

  if (kpiCards < 4) throw new Error(`Expected 4 KPI cards, saw ${kpiCards}.`);
  if (sparklineCount < 4) throw new Error(`Expected KPI sparklines, saw ${sparklineCount}.`);
  if (heatCells < 16) throw new Error(`Expected 16 heatmap cells, saw ${heatCells}.`);
  if (responseRows < 4) throw new Error(`Expected 4 response distribution bars, saw ${responseRows}.`);
  if (tableRows < 4) throw new Error(`Expected agency table rows, saw ${tableRows}.`);
  if (seriousCritical.length > 0) throw new Error(`Axe serious/critical violations: ${JSON.stringify(seriousCritical)}`);
  if (consoleErrors.length > 0) throw new Error(`Browser errors: ${consoleErrors.slice(0, 3).join(" | ")}`);

  console.log(`DASHBOARD_REDESIGN_LIVE kpis=${kpiCards} sparklines=${sparklineCount} heatCells=${heatCells} responseBars=${responseRows} agencyRows=${tableRows} axeSeriousCritical=0`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
'@

  $tempNodeScript = Join-Path $root "tmp-dashboard-verifier.cjs"
  Set-Content -LiteralPath $tempNodeScript -Value $nodeScript -Encoding UTF8
  & node $tempNodeScript
  if ($LASTEXITCODE -ne 0) {
    throw "Dashboard redesign live verifier failed."
  }
} catch {
  Write-Output "DASHBOARD_REDESIGN_LIVE_FAILED $($_.Exception.Message)"
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

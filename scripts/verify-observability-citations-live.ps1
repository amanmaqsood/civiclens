$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-observability-server.out.log"
$serverErr = Join-Path $root "tmp-observability-server.err.log"
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

function Read-LocalEnvValue {
  param([Parameter(Mandatory = $true)][string]$Name)
  $envPath = Join-Path $root ".env.production.local"
  if (-not (Test-Path $envPath)) {
    return $null
  }

  $line = Get-Content $envPath | Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  $value = ($line -replace "^\s*$([regex]::Escape($Name))\s*=\s*", "").Trim()
  return $value.Trim('"').Trim("'")
}

$server = $null
$tempNodeScript = $null
$failed = $false
try {
  $geminiKey = $env:GEMINI_API_KEY
  if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    $geminiKey = Read-LocalEnvValue "GEMINI_API_KEY"
  }
  if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    throw "GEMINI_API_KEY is required in the environment or .env.production.local."
  }

  $env:PORT = "3024"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:GOOGLE_CLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:CIVICLENS_QUOTA_BACKEND = "memory"
  $env:CIVICLENS_GEMINI_INPUT_USD_PER_MILLION_TOKENS = "0.10"
  $env:CIVICLENS_GEMINI_OUTPUT_USD_PER_MILLION_TOKENS = "0.40"
  $env:GEMINI_API_KEY = $geminiKey
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

  Wait-Http "http://127.0.0.1:3024/health" 90 | Out-Null

  $nodeScript = @'
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { chromium } = require("playwright");

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-civiclens";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const baseUrl = "http://127.0.0.1:3024";
if (!authHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST is required.");
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();

async function signUp() {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`signUp failed ${JSON.stringify(body)}`);
  return { uid: body.localId, token: body.idToken };
}

async function createIssue(session, issueId) {
  const response = await fetch(`${baseUrl}/api/issues/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
      "x-civiclens-local-appcheck-bypass": "true",
    },
    body: JSON.stringify({
      idempotencyKey: issueId,
      imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      category: "pothole",
      title: "Observability citation pothole",
      summary: "A deep pothole near the ward office is dangerous after rain.",
      description: "A deep pothole near the ward office is dangerous after rain.",
      lat: 12.9716,
      lng: 77.5946,
      locationName: "MG Road, Bengaluru",
      severity: 4,
      urgency: "priority",
      confidence: 0.91,
    }),
  });
  const body = await response.json();
  if (!response.ok || !body?.success) throw new Error(`create failed ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function generateRealResolutionPlan(session, issueId) {
  const response = await fetch(`${baseUrl}/api/resolution-plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
      "x-civiclens-local-appcheck-bypass": "true",
    },
    body: JSON.stringify({
      ticketId: issueId,
      category: "pothole",
      title: "Observability citation pothole",
      summary: "A deep pothole near the ward office is dangerous after rain.",
      lat: 12.9716,
      lng: 77.5946,
      locationName: "MG Road, Bengaluru",
    }),
  });
  const body = await response.json();
  if (!response.ok || !body?.success) throw new Error(`resolution plan failed ${response.status}: ${JSON.stringify(body)}`);
  const returnedSources = Array.isArray(body?.data?.groundingSources) ? body.data.groundingSources : [];
  const realSources = returnedSources
    .filter((src) => src && typeof src.url === "string" && /^https?:\/\//.test(src.url))
    .slice(0, 3)
    .map((src) => ({
      title: src.title || "Grounded public reference",
      url: src.url,
      claimSupported: src.claimSupported || "Reference returned by Google Search grounding metadata.",
      sourceType: "sourced",
    }));
  if (realSources.length < 1) {
    throw new Error(`Expected at least one real Google Search grounding source, saw ${returnedSources.length}.`);
  }
  const plan = {
    ...body.data,
    groundingSources: [
      ...realSources,
      {
        title: "Manual ward verification required",
        url: "",
        claimSupported: "Fallback reminder to verify jurisdiction before outside-app action.",
        sourceType: "estimated",
      },
    ],
  };
  return { plan, realGroundingSourceCount: realSources.length };
}

async function attachResolutionPlan(issueId, plan) {
  await db.collection("issues").doc(issueId).set({
    resolutionPlan: plan,
    isDemoData: true,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function readObservability(session) {
  const response = await fetch(`${baseUrl}/api/ops/observability?hours=1`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.token}`,
      "x-civiclens-local-appcheck-bypass": "true",
      "x-civiclens-demo-operator": "true",
    },
  });
  const body = await response.json();
  if (!response.ok || !body?.success) throw new Error(`observability failed ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function inspectCitationUi(issueId) {
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem("has_seen_onboarding", "true");
      window.localStorage.setItem("preferred_language", "en");
    });
    await page.goto(`${baseUrl}/#issue/${encodeURIComponent(issueId)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#issue-detail-page", { timeout: 30000 });
    await page.getByRole("button", { name: /Switch to synthetic demo desk/i }).click();
    await page.waitForSelector("#operator-command-center", { timeout: 30000 });
    await page.locator(`#operator-issue-row-${issueId}`).click({ timeout: 30000 });
    await page.waitForSelector("#operator-detail-scroll-view", { timeout: 30000 });
    await page.waitForSelector("#grounding-reference-links a", { timeout: 30000 });
    const citationLinks = await page.locator("#grounding-reference-links a").count();
    const citationText = await page.locator("#grounding-reference-links").innerText();
    if (citationLinks < 2) throw new Error(`Expected at least two citation links, saw ${citationLinks}.`);
    if (!/sourced/.test(citationText) || !/estimated/.test(citationText)) {
      throw new Error(`Citation UI missing expected text: ${citationText}`);
    }
    if (consoleErrors.length > 0) throw new Error(`Browser errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
    return { citationLinks, consoleErrors: consoleErrors.length };
  } finally {
    await browser.close();
  }
}

async function main() {
  const runId = `obscite${Date.now()}`;
  const session = await signUp();
  await createIssue(session, runId);
  const realPlan = await generateRealResolutionPlan(session, runId);
  await attachResolutionPlan(runId, realPlan.plan);
  const observability = await readObservability(session);
  const ui = await inspectCitationUi(runId);

  const events = Number(observability?.eventCounts?.total || 0);
  const monitoringQueries = Array.isArray(observability?.cloudLoggingQueries) ? observability.cloudLoggingQueries.length : 0;
  if (events < 1) throw new Error("Expected at least one recent event in observability snapshot.");
  if (monitoringQueries < 4) throw new Error(`Expected Cloud Logging query templates, saw ${monitoringQueries}.`);

  console.log(`OBSERVABILITY_CITATIONS_LIVE issueId=${runId} events=${events} realGroundingSources=${realPlan.realGroundingSourceCount} citationLinks=${ui.citationLinks} monitoringQueries=${monitoringQueries} consoleErrors=${ui.consoleErrors}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
'@

  $tempNodeScript = Join-Path $root "tmp-observability-citations-verifier.cjs"
  Set-Content -LiteralPath $tempNodeScript -Value $nodeScript -Encoding UTF8
  & node $tempNodeScript
  if ($LASTEXITCODE -ne 0) {
    throw "Observability and citation live verifier failed."
  }
} catch {
  $failed = $true
  Write-Output "OBSERVABILITY_CITATIONS_LIVE_FAILED $($_.Exception.Message)"
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

  if (-not $failed) {
    Remove-Item -LiteralPath $serverOut, $serverErr -ErrorAction SilentlyContinue
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

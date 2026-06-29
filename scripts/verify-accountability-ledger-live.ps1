$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-ledger-server.out.log"
$serverErr = Join-Path $root "tmp-ledger-server.err.log"
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
  $env:PORT = "3019"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:GOOGLE_CLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:GEMINI_API_KEY = "local-ledger-test"
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

  Wait-Http "http://127.0.0.1:3019/health" 90 | Out-Null

  $nodeScript = @'
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { chromium } = require("playwright");

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-civiclens";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const baseUrl = "http://127.0.0.1:3019";
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
      title: "Ledger live pothole",
      summary: "A pothole near the bus stand is blocking two-wheelers.",
      description: "A pothole near the bus stand is blocking two-wheelers.",
      lat: 12.9716,
      lng: 77.5946,
      locationName: "MG Road, Bengaluru",
      severity: 4,
      urgency: "priority",
      confidence: 0.91,
    }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) throw new Error(`create failed ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function readIssueEvents(issueId) {
  const snap = await db.collection("issues").doc(issueId).collection("events").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function main() {
  const runId = `ledgerlive${Date.now()}`;
  const session = await signUp();
  const created = await createIssue(session, runId);
  if (!created?.success || created?.autoMerged) {
    throw new Error(`Unexpected create result ${JSON.stringify(created)}`);
  }

  const events = await readIssueEvents(runId);
  const createdEvent = events.find((event) => event.eventType === "created" && event.source === "api");
  if (!createdEvent) throw new Error("Missing server-created issue event.");

  const browser = await chromium.launch({ headless: true });
  let renderedText = "";
  let tableRows = 0;
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
    await page.goto(`${baseUrl}/#issue/${encodeURIComponent(runId)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#issue-detail-page", { timeout: 30000 });
    await page.waitForSelector("#case-accountability-ledger", { timeout: 30000 });
    await page.waitForFunction(() => {
      const node = document.querySelector("#case-accountability-ledger");
      return !!node && /Created/.test(node.textContent || "") && /Prototype report saved by server/.test(node.textContent || "");
    }, null, { timeout: 30000 });
    renderedText = await page.locator("#case-accountability-ledger").innerText();
    tableRows = await page.locator("#case-accountability-ledger tbody tr").count();
  } finally {
    await browser.close();
  }

  if (tableRows < 1) throw new Error("Ledger table fallback did not render event rows.");
  if (consoleErrors.length > 0) throw new Error(`Browser errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
  console.log(`ACCOUNTABILITY_LEDGER_LIVE issueId=${runId} eventCount=${events.length} firstEvent=${createdEvent.eventType} source=${createdEvent.source} rendered=${/Created/.test(renderedText)} tableRows=${tableRows}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
'@

  $tempNodeScript = Join-Path $root "tmp-ledger-verifier.cjs"
  Set-Content -LiteralPath $tempNodeScript -Value $nodeScript -Encoding UTF8
  & node $tempNodeScript
  if ($LASTEXITCODE -ne 0) {
    throw "Accountability ledger live verifier failed."
  }
} catch {
  Write-Output "ACCOUNTABILITY_LEDGER_LIVE_FAILED $($_.Exception.Message)"
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

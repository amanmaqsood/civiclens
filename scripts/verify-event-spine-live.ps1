$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-events-server.out.log"
$serverErr = Join-Path $root "tmp-events-server.err.log"
Remove-Item -LiteralPath $serverOut, $serverErr -ErrorAction SilentlyContinue

function Wait-Http {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 60
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

function Read-EventSummary {
  $adminReadScript = @'
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ projectId: "demo-civiclens" });
}

(async () => {
  const db = getFirestore();
  const eventsSnap = await db.collection("events").limit(20).get();
  if (eventsSnap.empty) {
    throw new Error("No top-level events were written.");
  }

  const first = eventsSnap.docs.find((doc) => doc.get("eventType") === "demo_seeded");
  if (!first) {
    throw new Error("No demo_seeded event found.");
  }

  const issueId = first.get("issueId");
  if (!issueId) {
    throw new Error("demo_seeded event has no issueId.");
  }

  const issueEventsSnap = await db.collection("issues").doc(issueId).collection("events").limit(20).get();
  const issueHasDemoEvent = issueEventsSnap.docs.some((doc) => doc.get("eventType") === "demo_seeded");
  if (!issueHasDemoEvent) {
    throw new Error("No per-issue demo_seeded event found.");
  }

  console.log(JSON.stringify({
    topEvents: eventsSnap.size,
    firstEvent: first.get("eventType"),
    issueId,
    issueEvents: issueEventsSnap.size
  }));
})().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
'@

  $json = $adminReadScript | node -
  return $json | ConvertFrom-Json
}

$server = $null
try {
  $env:PORT = "3010"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:GEMINI_API_KEY = "local-event-spine-test"

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Http "http://127.0.0.1:3010/health" 75 | Out-Null

  $signup = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo" `
    -ContentType "application/json" `
    -Body '{"returnSecureToken":true}'

  $headers = @{
    Authorization = "Bearer $($signup.idToken)"
    "x-civiclens-local-appcheck-bypass" = "true"
    "x-civiclens-demo-operator" = "true"
  }

  $seed = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3010/api/demo/seed" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body "{}"

  Start-Sleep -Seconds 1

  $summary = Read-EventSummary
  Write-Output "EVENT_SPINE_LIVE seed=$($seed.seeded) topEvents=$($summary.topEvents) firstEvent=$($summary.firstEvent) issueId=$($summary.issueId) issueEvents=$($summary.issueEvents)"
} catch {
  Write-Output "EVENT_SPINE_LIVE_FAILED $($_.Exception.Message)"
  Get-Content $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 60
  Get-Content $serverOut -ErrorAction SilentlyContinue | Select-Object -Last 80
  exit 1
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
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

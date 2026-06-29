$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-sla-ladder-server.out.log"
$serverErr = Join-Path $root "tmp-sla-ladder-server.err.log"
Remove-Item -LiteralPath $serverOut, $serverErr -ErrorAction SilentlyContinue

function Wait-Http {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 75
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

  $line = Get-Content $envPath |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))=" } |
    Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return ($line -replace "^\s*$([regex]::Escape($Name))=", "").Trim().Trim('"').Trim("'")
}

function Read-FirstOpenDemoIssueId {
  $adminReadScript = @'
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ projectId: "demo-civiclens" });
}

(async () => {
  const db = getFirestore();
  const snap = await db.collection("issues").where("isDemoData", "==", true).limit(20).get();
  const doc = snap.docs.find((candidate) => ["submitted", "verified", "in_progress"].includes(candidate.get("status")));
  if (!doc) {
    throw new Error("No open demo issue found.");
  }
  console.log(doc.id);
})().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
'@

  $output = $adminReadScript | node -
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read first open demo issue id."
  }
  return ($output | Select-Object -First 1).Trim()
}

function Read-LadderSummary {
  param([Parameter(Mandatory = $true)][string]$IssueId)

  $adminReadScript = @'
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ projectId: "demo-civiclens" });
}

(async () => {
  const db = getFirestore();
  const doc = await db.collection("issues").doc("__ISSUE_ID__").get();
  if (!doc.exists) {
    throw new Error("Issue not found after SLA worker runs.");
  }
  const issue = doc.data();
  const eventSnap = await doc.ref.collection("events").limit(80).get();
  const eventTypes = eventSnap.docs.map((eventDoc) => eventDoc.get("eventType"));
  const required = ["sla_ladder_reminder", "sla_ladder_escalated", "sla_ladder_rti_pdf", "sla_ladder_first_appeal"];
  const missing = required.filter((eventType) => !eventTypes.includes(eventType));
  if (missing.length) {
    throw new Error("Missing SLA ladder events: " + missing.join(","));
  }
  if (!issue.slaDeadline || !issue.slaPolicy || !issue.slaPolicy.slaHours) {
    throw new Error("Issue is missing SLA policy/deadline fields.");
  }
  if (!issue.escalation || !String(issue.escalation.rtiPdfDataUri || "").startsWith("data:application/pdf;base64,")) {
    throw new Error("Issue is missing downloadable RTI PDF data URI.");
  }
  if (!issue.escalation.firstAppealLetter || !issue.escalation.firstAppealDraftedAt) {
    throw new Error("Issue is missing first appeal draft fields.");
  }

  console.log(JSON.stringify({
    issueId: doc.id,
    currentStage: issue.slaLadder && issue.slaLadder.currentStage,
    nextStage: issue.slaLadder && (issue.slaLadder.nextStage || "complete"),
    slaHours: issue.slaPolicy.slaHours,
    slaDeadline: issue.slaDeadline,
    pdfBytes: issue.escalation.rtiPdfBytes || 0,
    eventCount: eventSnap.size
  }));
})().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
'@

  $json = $adminReadScript.Replace("__ISSUE_ID__", $IssueId) | node -
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read SLA ladder summary."
  }
  return $json | ConvertFrom-Json
}

$server = $null
try {
  $geminiKey = $env:GEMINI_API_KEY
  if (-not $geminiKey) {
    $geminiKey = Read-LocalEnvValue "GEMINI_API_KEY"
  }
  if (-not $geminiKey) {
    throw "GEMINI_API_KEY is required in the environment or .env.production.local."
  }

  $env:PORT = "3012"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:GEMINI_API_KEY = $geminiKey

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Http "http://127.0.0.1:3012/health" 90 | Out-Null

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

  Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3012/api/demo/clear" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body "{}" | Out-Null

  Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3012/api/demo/seed" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body "{}" | Out-Null

  $issueId = Read-FirstOpenDemoIssueId
  if (-not $issueId) {
    throw "Unable to read seeded issue id."
  }

  for ($i = 1; $i -le 4; $i++) {
    $body = @{
      worker = "sla"
      issueId = $issueId
      thresholdHours = 0
      limit = 1
    } | ConvertTo-Json -Compress

    $result = Invoke-RestMethod `
      -Method Post `
      -Uri "http://127.0.0.1:3012/api/jobs/run" `
      -Headers $headers `
      -ContentType "application/json" `
      -Body $body `
      -TimeoutSec 120

    if (-not $result.success -or $result.advanced -lt 1) {
      throw "SLA worker run $i did not advance the targeted issue."
    }
    Start-Sleep -Milliseconds 500
  }

  $summary = Read-LadderSummary $issueId
  Write-Output "SLA_LADDER_LIVE issueId=$($summary.issueId) stage=$($summary.currentStage) next=$($summary.nextStage) slaHours=$($summary.slaHours) pdfBytes=$($summary.pdfBytes) eventCount=$($summary.eventCount)"
} catch {
  Write-Output "SLA_LADDER_LIVE_FAILED $($_.Exception.Message)"
  Get-Content $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 80
  Get-Content $serverOut -ErrorAction SilentlyContinue | Select-Object -Last 120
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

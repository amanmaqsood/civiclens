$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-agent-self-critique-server.out.log"
$serverErr = Join-Path $root "tmp-agent-self-critique-server.err.log"
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

function Read-FirstIssueId {
  $adminReadScript = @'
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ projectId: "demo-civiclens" });
}

(async () => {
  const db = getFirestore();
  const snap = await db.collection("issues").limit(1).get();
  if (snap.empty) {
    throw new Error("No seeded issues found.");
  }
  console.log(snap.docs[0].id);
})().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
'@

  return (($adminReadScript | node -) | Select-Object -First 1).Trim()
}

function Read-AgentEventSummary {
  param([Parameter(Mandatory = $true)][string]$IssueId)

  $adminReadScript = @"
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ projectId: "demo-civiclens" });
}

(async () => {
  const db = getFirestore();
  const snap = await db.collection("issues").doc("$IssueId").collection("events").limit(50).get();
  const eventTypes = snap.docs.map((doc) => doc.get("eventType"));
  const critique = eventTypes.find((type) => String(type).startsWith("agent_self_critique_")) || null;
  const completed = eventTypes.includes("agent_run_completed");
  if (!critique) {
    throw new Error("No agent_self_critique event found.");
  }
  if (!completed) {
    throw new Error("No agent_run_completed event found.");
  }
  console.log(JSON.stringify({ eventCount: snap.size, critique, completed }));
})().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
"@

  $json = $adminReadScript | node -
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

  $env:PORT = "3011"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:CIVICLENS_AGENT_TIMEOUT_MS = "120000"
  $env:GEMINI_API_KEY = $geminiKey

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Http "http://127.0.0.1:3011/health" 90 | Out-Null

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
    -Uri "http://127.0.0.1:3011/api/demo/seed" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body "{}" | Out-Null

  $issueId = Read-FirstIssueId
  if (-not $issueId) {
    throw "Unable to read seeded issue id."
  }

  $body = @{
    issueId = $issueId
    idempotencyKey = "selfcritique_live_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  } | ConvertTo-Json -Compress

  $agent = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3011/api/agent/run" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 150

  $steps = @($agent.steps)
  $selfStep = $steps | Where-Object { $_.step -eq "self_critique" } | Select-Object -First 1
  if (-not $selfStep) {
    throw "Agent response did not include a self_critique step."
  }
  if (-not $agent.run.selfCritique) {
    throw "Agent run did not include selfCritique metadata."
  }
  if (-not $agent.run.timeoutMs -or $agent.run.timeoutMs -lt 15000) {
    throw "Agent run did not include timeoutMs."
  }

  $eventSummary = Read-AgentEventSummary $issueId
  Write-Output "AGENT_SELF_CRITIQUE_LIVE issueId=$issueId steps=$($steps.Count) selfStepStatus=$($selfStep.status) anomaly=$($agent.run.selfCritique.anomaly) critiqueEvent=$($eventSummary.critique) eventCount=$($eventSummary.eventCount) timeoutMs=$($agent.run.timeoutMs)"
} catch {
  Write-Output "AGENT_SELF_CRITIQUE_LIVE_FAILED $($_.Exception.Message)"
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

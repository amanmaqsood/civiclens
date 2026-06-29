$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-agent-planner-server.out.log"
$serverErr = Join-Path $root "tmp-agent-planner-server.err.log"
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

function Read-AgentPlannerPersistence {
  param(
    [Parameter(Mandatory = $true)][string]$IssueId,
    [Parameter(Mandatory = $true)][string]$RunId
  )

  $adminReadScript = @"
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ projectId: "demo-civiclens" });
}

(async () => {
  const db = getFirestore();
  const issueRef = db.collection("issues").doc("$IssueId");
  const runRef = db.collection("agentRuns").doc("$RunId");
  const [issueSnap, runSnap, stepsSnap, eventsSnap] = await Promise.all([
    issueRef.get(),
    runRef.get(),
    runRef.collection("steps").orderBy("order", "asc").get(),
    issueRef.collection("events").limit(80).get(),
  ]);
  if (!issueSnap.exists) throw new Error("Issue was not persisted.");
  if (!runSnap.exists) throw new Error("Run was not persisted.");
  const issue = issueSnap.data() || {};
  const run = runSnap.data() || {};
  const steps = stepsSnap.docs.map((doc) => doc.data());
  const events = eventsSnap.docs.map((doc) => doc.get("eventType"));
  const plannerStep = steps.find((step) => step.step === "planner") || null;
  const calculateSteps = steps.filter((step) => step.step === "calculate_priority");
  console.log(JSON.stringify({
    issuePlanPersisted: !!issue.agentPlan,
    runPlanPersisted: !!run.planner,
    plannerFallback: !!(run.planner && run.planner.fallback),
    plannerStepStatus: plannerStep ? plannerStep.status : null,
    plannedToolCount: run.planner && Array.isArray(run.planner.steps) ? run.planner.steps.length : 0,
    persistedStepCount: steps.length,
    calculateStepCount: calculateSteps.length,
    eventPlanCreated: events.includes("agent_plan_created"),
    eventRunCompleted: events.includes("agent_run_completed")
  }));
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
  $env:DEBUG = ""

  $geminiKey = $env:GEMINI_API_KEY
  if (-not $geminiKey) {
    $geminiKey = Read-LocalEnvValue "GEMINI_API_KEY"
  }
  if (-not $geminiKey) {
    throw "GEMINI_API_KEY is required in the environment or .env.production.local."
  }

  $env:PORT = "3026"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:CIVICLENS_AGENT_TIMEOUT_MS = "120000"
  $env:CIVICLENS_PLANNER_MODEL = $(if ($env:CIVICLENS_PLANNER_MODEL) { $env:CIVICLENS_PLANNER_MODEL } else { "gemini-2.5-flash" })
  $env:GEMINI_API_KEY = $geminiKey

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Http "http://127.0.0.1:3026/health" 90 | Out-Null

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
    -Uri "http://127.0.0.1:3026/api/demo/seed" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body "{}" | Out-Null

  $issueId = Read-FirstIssueId
  if (-not $issueId) {
    throw "Unable to read seeded issue id."
  }

  $body = @{
    issueId = $issueId
    idempotencyKey = "planner_live_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  } | ConvertTo-Json -Compress

  $agent = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3026/api/agent/run" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 150

  if (-not $agent.run.planner) {
    throw "Agent response did not include run.planner."
  }
  if ($agent.run.planner.fallback) {
    throw "Agent planner fell back instead of returning a live Gemini plan."
  }
  if (-not $agent.agentPlan -or -not $agent.agentPlan.steps -or @($agent.agentPlan.steps).Count -lt 1) {
    throw "Agent response did not include a non-empty agentPlan."
  }
  $steps = @($agent.steps)
  $plannerStep = $steps | Where-Object { $_.step -eq "planner" } | Select-Object -First 1
  if (-not $plannerStep) {
    throw "Agent response did not include a planner step."
  }
  $calculateStep = $steps | Where-Object { $_.step -eq "calculate_priority" } | Select-Object -First 1
  if ($calculateStep) {
    throw "calculate_priority was executed as a tool."
  }

  $persisted = Read-AgentPlannerPersistence $issueId $agent.run.id
  if (-not $persisted.issuePlanPersisted -or -not $persisted.runPlanPersisted) {
    throw "Planner persistence missing. issuePlanPersisted=$($persisted.issuePlanPersisted) runPlanPersisted=$($persisted.runPlanPersisted)"
  }
  if ($persisted.plannerFallback) {
    throw "Persisted planner indicates fallback."
  }
  if ($persisted.calculateStepCount -ne 0) {
    throw "Persisted steps include calculate_priority."
  }
  if (-not $persisted.eventPlanCreated -or -not $persisted.eventRunCompleted) {
    throw "Planner/run events were not recorded."
  }

  Write-Output "AGENT_PLANNER_LIVE issueId=$issueId runId=$($agent.run.id) plannerModel=$($agent.run.planner.plannerModel) plannedTools=$($persisted.plannedToolCount) persistedSteps=$($persisted.persistedStepCount) plannerStep=$($persisted.plannerStepStatus) planPersisted=$($persisted.issuePlanPersisted -and $persisted.runPlanPersisted) calculateToolSteps=$($persisted.calculateStepCount) eventPlanCreated=$($persisted.eventPlanCreated)"
} catch {
  Write-Output "AGENT_PLANNER_LIVE_FAILED $($_.Exception.Message)"
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

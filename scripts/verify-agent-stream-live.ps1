$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-agent-stream-server.out.log"
$serverErr = Join-Path $root "tmp-agent-stream-server.err.log"
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

  $env:PORT = "3027"
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

  Wait-Http "http://127.0.0.1:3027/health" 90 | Out-Null

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
    -Uri "http://127.0.0.1:3027/api/demo/seed" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body "{}" | Out-Null

  $issueId = Read-FirstIssueId
  if (-not $issueId) {
    throw "Unable to read seeded issue id."
  }

  $env:AGENT_STREAM_TOKEN = $signup.idToken
  $env:AGENT_STREAM_ISSUE_ID = $issueId
  $env:AGENT_STREAM_PORT = "3027"
  $env:AGENT_STREAM_IDEMPOTENCY = "stream_live_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

  $nodeScript = @'
const token = process.env.AGENT_STREAM_TOKEN;
const issueId = process.env.AGENT_STREAM_ISSUE_ID;
const port = process.env.AGENT_STREAM_PORT || "3027";
const idempotencyKey = process.env.AGENT_STREAM_IDEMPOTENCY;
const base = `http://127.0.0.1:${port}`;
const headers = {
  Authorization: `Bearer ${token}`,
  "x-civiclens-local-appcheck-bypass": "true",
  "x-civiclens-demo-operator": "true",
};
const events = [];
let posted = false;
let postPromise = null;
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 150000);

function parseFrame(frame) {
  const lines = frame.replace(/\r/g, "").split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
  if (!data) return null;
  const parsed = JSON.parse(data);
  return { type: eventLine ? eventLine.slice(6).trim() : parsed.type || "message", ...parsed };
}

async function startAgent() {
  const response = await fetch(`${base}/api/agent/run`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ issueId, idempotencyKey }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(body.error || `Agent run failed with HTTP ${response.status}`);
  }
  return body;
}

(async () => {
  const stream = await fetch(`${base}/api/issues/${issueId}/agent-events/stream`, {
    headers: { ...headers, Accept: "text/event-stream" },
    signal: controller.signal,
  });
  if (!stream.ok || !stream.body) throw new Error(`Stream failed with HTTP ${stream.status}`);
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseFrame(frame);
        if (event) {
          events.push(event);
          if (event.type === "agent_stream_ready" && !posted) {
            posted = true;
            postPromise = startAgent();
          }
          if (event.type === "agent_complete") {
            controller.abort();
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } catch (error) {
    if (error && error.name !== "AbortError") throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!postPromise) throw new Error("Stream never became ready.");
  const agent = await postPromise;
  const types = events.map((event) => event.type);
  const stepEvents = events.filter((event) => event.type === "agent_step");
  const retryEvents = events.filter((event) => event.type === "agent_retry");
  const summary = {
    issueId,
    runId: agent.run && agent.run.id,
    hasReady: types.includes("agent_stream_ready"),
    hasStart: types.includes("agent_start"),
    hasComplete: types.includes("agent_complete"),
    stepEvents: stepEvents.length,
    retryEvents: retryEvents.length,
    persistedSteps: Array.isArray(agent.steps) ? agent.steps.length : 0,
    plannerStep: stepEvents.some((event) => event.step && event.step.step === "planner"),
  };
  if (!summary.hasReady || !summary.hasStart || !summary.hasComplete || summary.stepEvents < 1 || !summary.plannerStep) {
    throw new Error(`Missing stream evidence: ${JSON.stringify(summary)}`);
  }
  console.log(JSON.stringify(summary));
})().catch((error) => {
  clearTimeout(timeout);
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
'@

  $summary = ($nodeScript | node -) | ConvertFrom-Json
  Write-Output "AGENT_STREAM_LIVE issueId=$($summary.issueId) runId=$($summary.runId) ready=$($summary.hasReady) start=$($summary.hasStart) stepEvents=$($summary.stepEvents) plannerStep=$($summary.plannerStep) complete=$($summary.hasComplete) retryEvents=$($summary.retryEvents) persistedSteps=$($summary.persistedSteps)"
} catch {
  Write-Output "AGENT_STREAM_LIVE_FAILED $($_.Exception.Message)"
  Get-Content $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 80
  Get-Content $serverOut -ErrorAction SilentlyContinue | Select-Object -Last 120
  exit 1
} finally {
  Remove-Item Env:\AGENT_STREAM_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:\AGENT_STREAM_ISSUE_ID -ErrorAction SilentlyContinue
  Remove-Item Env:\AGENT_STREAM_PORT -ErrorAction SilentlyContinue
  Remove-Item Env:\AGENT_STREAM_IDEMPOTENCY -ErrorAction SilentlyContinue

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

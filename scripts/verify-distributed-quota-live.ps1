$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-distributed-quota-server.out.log"
$serverErr = Join-Path $root "tmp-distributed-quota-server.err.log"
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
  $jobSecret = "distributed-quota-secret-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  $quotaCollection = "quotaBucketsLive"

  $env:PORT = "3022"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:GOOGLE_CLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:CIVICLENS_JOB_SECRET = $jobSecret
  $env:CIVICLENS_QUOTA_BACKEND = "firestore"
  $env:CIVICLENS_QUOTA_COLLECTION = $quotaCollection
  $env:CIVICLENS_MUTATION_QUOTA_LIMIT = "2"
  $env:CIVICLENS_MUTATION_QUOTA_WINDOW_MS = "600000"
  $env:GEMINI_API_KEY = "local-distributed-quota-test"
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

  Wait-Http "http://127.0.0.1:3022/health" 90 | Out-Null

  $nodeScript = @'
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-civiclens";
const baseUrl = "http://127.0.0.1:3022";
const secret = process.env.CIVICLENS_JOB_SECRET;
const quotaCollection = process.env.CIVICLENS_QUOTA_COLLECTION;
if (!secret) throw new Error("CIVICLENS_JOB_SECRET is required.");
if (!quotaCollection) throw new Error("CIVICLENS_QUOTA_COLLECTION is required.");
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();

async function callJob() {
  const response = await fetch(`${baseUrl}/api/jobs/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-civiclens-job-secret": secret,
    },
    body: JSON.stringify({
      worker: "sla",
      issueId: "distributed-quota-missing",
      thresholdHours: 0,
      limit: 1,
    }),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {}
  return {
    status: response.status,
    backend: response.headers.get("x-ratelimit-backend"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    body,
  };
}

async function main() {
  const results = [];
  for (let index = 0; index < 3; index += 1) {
    results.push(await callJob());
  }

  const statuses = results.map((result) => result.status);
  if (statuses[0] !== 200 || statuses[1] !== 200 || statuses[2] !== 429) {
    throw new Error(`Unexpected quota statuses: ${statuses.join(",")} ${JSON.stringify(results.map((result) => result.body))}`);
  }
  if (!results.every((result) => result.backend === "firestore")) {
    throw new Error(`Expected firestore quota backend headers: ${JSON.stringify(results.map((result) => result.backend))}`);
  }

  const snapshot = await db.collection(quotaCollection).get();
  const quotaDocs = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((doc) => doc.routeKind === "mutation");
  if (quotaDocs.length !== 1) {
    throw new Error(`Expected one mutation quota bucket, saw ${quotaDocs.length}.`);
  }
  const count = Number(quotaDocs[0].count || 0);
  if (count !== 3) {
    throw new Error(`Expected persisted count 3, saw ${count}.`);
  }

  console.log(`DISTRIBUTED_QUOTA_LIVE statuses=${statuses.join(",")} backend=firestore count=${count} bucketDocs=${quotaDocs.length} remaining=${results[2].remaining}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
'@

  $tempNodeScript = Join-Path $root "tmp-distributed-quota-verifier.cjs"
  Set-Content -LiteralPath $tempNodeScript -Value $nodeScript -Encoding UTF8
  & node $tempNodeScript
  if ($LASTEXITCODE -ne 0) {
    throw "Distributed quota live verifier failed."
  }
} catch {
  Write-Output "DISTRIBUTED_QUOTA_LIVE_FAILED $($_.Exception.Message)"
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

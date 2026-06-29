$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-trust-economy-server.out.log"
$serverErr = Join-Path $root "tmp-trust-economy-server.err.log"
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

  $line = Get-Content $envPath |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))=" } |
    Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return ($line -replace "^\s*$([regex]::Escape($Name))=", "").Trim().Trim('"').Trim("'")
}

$server = $null
$tempNodeScript = $null
try {
  $geminiKey = $env:GEMINI_API_KEY
  if (-not $geminiKey) {
    $geminiKey = Read-LocalEnvValue "GEMINI_API_KEY"
  }
  if (-not $geminiKey) {
    throw "GEMINI_API_KEY is required in the environment or .env.production.local."
  }

  $env:PORT = "3017"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:GOOGLE_CLOUD_PROJECT = "demo-civiclens"
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

  Wait-Http "http://127.0.0.1:3017/readyz" 90 | Out-Null

  $nodeScript = @'
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-civiclens";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const baseUrl = "http://127.0.0.1:3017";
if (!authHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST is required.");
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();
const runId = `trustlive${Date.now()}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function headers(session) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
    "x-civiclens-local-appcheck-bypass": "true",
  };
}

async function postJson(path, session, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: headers(session),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) throw new Error(`${path} failed ${response.status}: ${JSON.stringify(parsed)}`);
  return parsed;
}

async function seedIssue(issueId, title) {
  const now = new Date().toISOString();
  await db.collection("issues").doc(issueId).set({
    ticketId: `TRUST-${issueId.slice(-8)}`,
    image: "https://example.com/civiclens/trust-economy.jpg",
    title,
    summary: "A verified pothole blocks a neighborhood access lane and needs closure review.",
    description: "A verified pothole blocks a neighborhood access lane and needs closure review.",
    category: "pothole",
    status: "in_progress",
    isDemoData: true,
    createdAt: now,
    timestamp: now,
    updatedAt: now,
    severity: 4,
    urgency: "priority",
    lat: 12.9716,
    lng: 77.5946,
    citizenUpvotes: 0,
    confirmCount: 0,
    disputeCount: 0,
    reportCount: 1,
    userId: "trust-live-seed",
  });
}

async function seedProfile(session, trusted, index) {
  await db.collection("profiles").doc(session.uid).set({
    uid: session.uid,
    handle: `${trusted ? "Trusted" : "New"}-${index}-${runId.slice(-4)}`,
    role: "citizen",
    points: trusted ? 360 : 0,
    level: trusted ? 8 : 1,
    badges: trusted ? ["Community Verifier", "Civic Champion"] : [],
    reportCount: trusted ? 6 : 0,
    supportCount: trusted ? 9 : 0,
    verifyCount: trusted ? 14 : 0,
    trustScore: trusted ? 0.96 : 0.18,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function eventCounts(issueId) {
  const snap = await db.collection("issues").doc(issueId).collection("events").get();
  return snap.docs.reduce((acc, doc) => {
    const type = String(doc.get("eventType") || "");
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const trusted = [];
  for (let i = 0; i < 3; i += 1) {
    const session = await signUp();
    await seedProfile(session, true, i + 1);
    trusted.push(session);
  }
  const lowTrust = [];
  for (let i = 0; i < 4; i += 1) {
    const session = await signUp();
    await seedProfile(session, false, i + 1);
    lowTrust.push(session);
  }

  const consensusIssueId = `${runId}_consensus`;
  await seedIssue(consensusIssueId, "Weighted consensus pothole case");
  const auditModels = [];
  for (let i = 0; i < trusted.length; i += 1) {
    const result = await postJson(`/api/issues/${consensusIssueId}/verification`, trusted[i], {
      type: "confirm",
      reason: "I can verify the reported pothole still blocks vehicle movement at this location.",
    });
    if (result?.trust?.audit?.aiFallback) {
      throw new Error("Trust audit fell back during trusted consensus verification.");
    }
    auditModels.push(result.trust.audit.model);
    await sleep(1800);
  }

  const consensusAfterResolve = (await db.collection("issues").doc(consensusIssueId).get()).data();
  if (consensusAfterResolve.status !== "resolved") throw new Error(`Expected consensus issue resolved, got ${consensusAfterResolve.status}`);
  if (consensusAfterResolve.verificationStatus !== "trust_consensus_resolved") throw new Error(`Unexpected verificationStatus ${consensusAfterResolve.verificationStatus}`);
  if ((consensusAfterResolve.trustConsensus?.confirmWeight || 0) < 2.4) throw new Error("Confirm weight did not cross threshold.");
  if (!consensusAfterResolve.trustConsensus?.autoResolvedAt) throw new Error("Missing trustConsensus.autoResolvedAt.");

  const appeal = await postJson(`/api/issues/${consensusIssueId}/trust-appeal`, trusted[0], {
    reason: "The pothole was checked again after the consensus result and still needs human review.",
  });
  if (!appeal.reopened) throw new Error("Expected appeal to reopen the auto-resolved case.");
  const consensusAfterAppeal = (await db.collection("issues").doc(consensusIssueId).get()).data();
  if (consensusAfterAppeal.status !== "in_progress") throw new Error(`Expected appealed issue in_progress, got ${consensusAfterAppeal.status}`);
  if (consensusAfterAppeal.trustAppeal?.status !== "pending") throw new Error("Missing pending trust appeal.");

  const brigadeIssueId = `${runId}_brigade`;
  await seedIssue(brigadeIssueId, "Low-trust brigade pothole case");
  for (let i = 0; i < lowTrust.length; i += 1) {
    const result = await postJson(`/api/issues/${brigadeIssueId}/verification`, lowTrust[i], {
      type: "confirm",
      reason: "Same short confirmation from a new account.",
    });
    if (result?.trust?.audit?.aiFallback) {
      throw new Error("Trust audit fell back during brigading verification.");
    }
    await sleep(1800);
  }
  const brigade = (await db.collection("issues").doc(brigadeIssueId).get()).data();
  if (brigade.status === "resolved") throw new Error("Low-trust burst should not auto-resolve the issue.");
  if ((brigade.trustConsensus?.collapsedVotes || 0) < 1) throw new Error("Expected at least one collapsed brigading vote.");
  if (!["high", "watch"].includes(brigade.trustConsensus?.brigadingRisk)) throw new Error(`Unexpected brigading risk ${brigade.trustConsensus?.brigadingRisk}`);

  const consensusEvents = await eventCounts(consensusIssueId);
  const brigadeEvents = await eventCounts(brigadeIssueId);
  if (!consensusEvents.trust_consensus_resolved) throw new Error("Missing trust_consensus_resolved event.");
  if (!consensusEvents.trust_consensus_appealed) throw new Error("Missing trust_consensus_appealed event.");
  if (!brigadeEvents.trust_brigading_collapsed) throw new Error("Missing trust_brigading_collapsed event.");

  console.log(`TRUST_ECONOMY_LIVE issueId=${consensusIssueId} status=${consensusAfterAppeal.status} auditModel=${auditModels[0]} fallback=false confirmWeight=${consensusAfterResolve.trustConsensus.confirmWeight} appeal=${consensusAfterAppeal.trustAppeal.status} brigadeRisk=${brigade.trustConsensus.brigadingRisk} collapsed=${brigade.trustConsensus.collapsedVotes}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
'@

  $tempNodeScript = Join-Path $root "tmp-trust-economy-verifier.cjs"
  Set-Content -LiteralPath $tempNodeScript -Value $nodeScript -Encoding UTF8
  & node $tempNodeScript
  if ($LASTEXITCODE -ne 0) {
    throw "Trust economy live verifier failed."
  }
} catch {
  Write-Output "TRUST_ECONOMY_LIVE_FAILED $($_.Exception.Message)"
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

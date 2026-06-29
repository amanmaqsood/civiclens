$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-ghost-forensics-server.out.log"
$serverErr = Join-Path $root "tmp-ghost-forensics-server.err.log"
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

$server = $null
try {
  $geminiKey = $env:GEMINI_API_KEY
  if (-not $geminiKey) {
    $geminiKey = Read-LocalEnvValue "GEMINI_API_KEY"
  }
  if (-not $geminiKey) {
    throw "GEMINI_API_KEY is required in the environment or .env.production.local."
  }

  $env:PORT = "3016"
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

  Wait-Http "http://127.0.0.1:3016/health" 90 | Out-Null

  $nodeScript = @'
const sharp = require("sharp");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ projectId: "demo-civiclens" });
}

async function labeledPng(background, title, subtitle) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640">
    <rect width="960" height="640" fill="${background}"/>
    <rect x="42" y="42" width="876" height="556" rx="28" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.75)" stroke-width="8"/>
    <text x="480" y="285" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="78" font-weight="800" fill="#ffffff">${title}</text>
    <text x="480" y="374" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#ffffff">${subtitle}</text>
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

(async () => {
  const db = getFirestore();
  const signup = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true })
  });
  const auth = await signup.json();
  if (!signup.ok || !auth.idToken) {
    throw new Error("Failed to mint emulator auth token: " + JSON.stringify(auth));
  }

  const stamp = Date.now();
  const issueId = `ghostlive${stamp}`;
  const officerId = `officerGhost${stamp}`;
  const before = await labeledPng("#991b1b", "OPEN POTHOLE", "ORIGINAL REPORT");
  const closure = await labeledPng("#047857", "REPAIRED", "CLAIMED CLOSURE");
  const audit = await labeledPng("#991b1b", "OPEN POTHOLE", "FRESH AUDIT STILL UNSAFE");

  await db.collection("issues").doc(issueId).set({
    ticketId: `GHOST-${stamp}`,
    image: before,
    title: "Ghost closure pothole audit",
    summary: "Claimed pothole repair needs a fresh field audit.",
    description: "Claimed pothole repair needs a fresh field audit.",
    category: "pothole",
    status: "resolved",
    isDemoData: true,
    assignedOfficerId: officerId,
    closureSubmittedByUid: officerId,
    closureAssessment: {
      resolved: true,
      confidence: 0.93,
      observedChanges: ["Claimed asphalt patch visible"],
      recommendation: "resolve",
      explanation: "Closure evidence claimed the road hazard was repaired.",
      afterImage: closure,
      byUid: officerId
    },
    createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    severity: 4,
    urgency: "priority",
    lat: 12.9112,
    lng: 77.6385,
    citizenUpvotes: 4,
    reportCount: 1,
    priorityScore: 76
  });

  const response = await fetch(`http://127.0.0.1:3016/api/issues/${issueId}/ghost-forensics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`,
      "x-civiclens-local-appcheck-bypass": "true",
      "x-civiclens-demo-operator": "true"
    },
    body: JSON.stringify({
      auditImage: audit,
      fieldAuditSummary: "Fresh audit image shows the same open pothole remains after the claimed closure."
    })
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error("Ghost forensics request failed: " + JSON.stringify(result));
  }
  if (!result.data.autoReopened || result.data.recommendation !== "reopen" || result.data.confidence < 0.65) {
    throw new Error("Ghost forensics did not auto-reopen with sufficient confidence: " + JSON.stringify(result.data));
  }

  const issueSnap = await db.collection("issues").doc(issueId).get();
  const issue = issueSnap.data();
  if (issue.status !== "in_progress" || issue.verificationStatus !== "ghost_closure_flagged" || !issue.reopenedAt) {
    throw new Error("Issue was not reopened and flagged correctly: " + JSON.stringify({ status: issue.status, verificationStatus: issue.verificationStatus, reopenedAt: issue.reopenedAt }));
  }
  const officerSnap = await db.collection("officerAccountability").doc(officerId).get();
  const officer = officerSnap.data() || {};
  if ((officer.ghostClosureCount || 0) < 1 || (officer.ghostPenaltyPoints || 0) < 1) {
    throw new Error("Officer accountability penalty was not persisted.");
  }
  const events = await db.collection("issues").doc(issueId).collection("events").get();
  const eventTypes = events.docs.map((doc) => doc.get("eventType"));
  for (const expected of ["ghost_closure_reopened", "ai_ghost_forensics"]) {
    if (!eventTypes.includes(expected)) {
      throw new Error("Missing ghost forensics event: " + expected);
    }
  }

  console.log(JSON.stringify({
    issueId,
    status: issue.status,
    recommendation: result.data.recommendation,
    confidence: result.data.confidence,
    penalty: officer.ghostPenaltyPoints,
    eventCount: events.size
  }));
})().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
'@

  $json = $nodeScript | node -
  if ($LASTEXITCODE -ne 0) {
    throw "Ghost-forensics browserless live verification failed."
  }
  $summary = $json | ConvertFrom-Json
  Write-Output "GHOST_FORENSICS_LIVE issueId=$($summary.issueId) status=$($summary.status) recommendation=$($summary.recommendation) confidence=$($summary.confidence) penalty=$($summary.penalty) eventCount=$($summary.eventCount)"
} catch {
  Write-Output "GHOST_FORENSICS_LIVE_FAILED $($_.Exception.Message)"
  Get-Content $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 100
  Get-Content $serverOut -ErrorAction SilentlyContinue | Select-Object -Last 160
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

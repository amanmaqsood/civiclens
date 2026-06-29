$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-semantic-auto-merge-server.out.log"
$serverErr = Join-Path $root "tmp-semantic-auto-merge-server.err.log"
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

function Read-MergeSummary {
  param(
    [Parameter(Mandatory = $true)][string]$CanonicalId,
    [Parameter(Mandatory = $true)][string]$EvidenceId
  )

  $adminReadScript = @'
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ projectId: "demo-civiclens" });
}

(async () => {
  const db = getFirestore();
  const issueRef = db.collection("issues").doc("__CANONICAL_ID__");
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) {
    throw new Error("Canonical issue not found.");
  }
  const issue = issueSnap.data();
  if ((issue.reportCount || 0) < 2) {
    throw new Error("Canonical reportCount was not incremented.");
  }
  if (!issue.dedup || issue.dedup.method !== "geohash7_embedding_cosine") {
    throw new Error("Canonical issue is missing dedup metadata.");
  }
  const evidenceSnap = await issueRef.collection("evidence").doc("__EVIDENCE_ID__").get();
  if (!evidenceSnap.exists) {
    throw new Error("Auto-merged evidence doc not found.");
  }
  const markerSnap = await db.collection("issueCreateResults").doc("__EVIDENCE_ID__").get();
  if (!markerSnap.exists || markerSnap.get("status") !== "auto_merged") {
    throw new Error("Create result marker was not persisted as auto_merged.");
  }
  const eventSnap = await issueRef.collection("events").where("eventType", "==", "auto_merged_on_create").limit(5).get();
  if (eventSnap.empty) {
    throw new Error("auto_merged_on_create event not found.");
  }
  console.log(JSON.stringify({
    reportCount: issue.reportCount,
    priorityScore: issue.priorityScore,
    similarity: markerSnap.get("duplicateSimilarity"),
    distanceM: markerSnap.get("duplicateDistanceM"),
    eventCount: eventSnap.size
  }));
})().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
'@

  $script = $adminReadScript.Replace("__CANONICAL_ID__", $CanonicalId).Replace("__EVIDENCE_ID__", $EvidenceId)
  $json = $script | node -
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read semantic auto-merge summary."
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

  $env:PORT = "3013"
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

  Wait-Http "http://127.0.0.1:3013/health" 90 | Out-Null

  $signup = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo" `
    -ContentType "application/json" `
    -Body '{"returnSecureToken":true}'

  $headers = @{
    Authorization = "Bearer $($signup.idToken)"
    "x-civiclens-local-appcheck-bypass" = "true"
  }

  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $baseId = "automergebase$stamp"
  $mergeId = "automergematch$stamp"
  $bodyBase = @{
    idempotencyKey = $baseId
    imageUrl = "https://example.com/civiclens/pothole-base.jpg"
    category = "pothole"
    title = "Large pothole beside HSR Layout bus stop"
    summary = "Large pothole beside the HSR Layout bus stop causing two wheelers to swerve."
    description = "Large pothole beside the HSR Layout bus stop causing two wheelers to swerve during peak traffic."
    lat = 12.91120
    lng = 77.63850
    locationName = "24th Main, HSR Layout Sector 2, Bengaluru"
    severity = 4
    urgency = "priority"
    affectedArea = "street"
    visibleHazards = @("pothole", "traffic hazard")
    privacyFlags = @()
    confidence = 0.94
  } | ConvertTo-Json -Compress

  $base = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3013/api/issues/create" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $bodyBase `
    -TimeoutSec 120

  if (-not $base.success -or $base.autoMerged) {
    throw "Base issue was not created as a standalone canonical case."
  }

  $bodyMerge = @{
    idempotencyKey = $mergeId
    imageUrl = "https://example.com/civiclens/pothole-second.jpg"
    category = "pothole"
    title = "Large pothole near HSR Layout bus stop"
    summary = "Large pothole near the HSR Layout bus stop forcing two wheelers to swerve."
    description = "Large pothole near the HSR Layout bus stop forcing two wheelers to swerve during traffic."
    lat = 12.91130
    lng = 77.63858
    locationName = "24th Main, HSR Layout Sector 2, Bengaluru"
    severity = 4
    urgency = "priority"
    affectedArea = "street"
    visibleHazards = @("pothole", "traffic hazard")
    privacyFlags = @()
    confidence = 0.93
  } | ConvertTo-Json -Compress

  $merged = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3013/api/issues/create" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $bodyMerge `
    -TimeoutSec 120

  if (-not $merged.success -or -not $merged.autoMerged) {
    throw "Second issue did not auto-merge."
  }
  if ($merged.canonicalIssueId -ne $base.data.id) {
    throw "Auto-merge returned a different canonical issue."
  }
  if ($merged.duplicateSimilarity -lt 0.85 -or $merged.duplicateDistanceM -gt 50) {
    throw "Auto-merge similarity/distance did not satisfy threshold."
  }

  $summary = Read-MergeSummary -CanonicalId $base.data.id -EvidenceId $mergeId
  Write-Output "SEMANTIC_AUTO_MERGE_LIVE canonical=$($base.data.id) merged=$($merged.autoMerged) similarity=$($summary.similarity) distanceM=$($summary.distanceM) reportCount=$($summary.reportCount) eventCount=$($summary.eventCount)"
} catch {
  Write-Output "SEMANTIC_AUTO_MERGE_LIVE_FAILED $($_.Exception.Message)"
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

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-model-tiering-server.out.log"
$serverErr = Join-Path $root "tmp-model-tiering-server.err.log"
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
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
    Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return ($line -replace "^\s*$([regex]::Escape($Name))\s*=\s*", "").Trim().Trim('"').Trim("'")
}

function Set-DefaultEnv {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name, "Process"))) {
    [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
  }
}

$server = $null
$failed = $false
try {
  $env:DEBUG = ""

  $geminiKey = $env:GEMINI_API_KEY
  if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    $geminiKey = Read-LocalEnvValue "GEMINI_API_KEY"
  }
  if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    throw "GEMINI_API_KEY is required in the environment or .env.production.local."
  }

  $jobSecret = "model-tiering-secret-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

  $env:PORT = "3028"
  $env:NODE_ENV = "development"
  $env:APP_URL = "http://localhost:3028"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:GOOGLE_CLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:CIVICLENS_QUOTA_BACKEND = "memory"
  $env:CIVICLENS_JOB_SECRET = $jobSecret
  $env:GEMINI_API_KEY = $geminiKey
  $env:CIVICLENS_GEMINI_INPUT_USD_PER_MILLION_TOKENS = "0.10"
  $env:CIVICLENS_GEMINI_OUTPUT_USD_PER_MILLION_TOKENS = "0.40"

  Set-DefaultEnv "CIVICLENS_GEMINI_CHEAP_MODEL" "gemini-2.5-flash-lite"
  Set-DefaultEnv "CIVICLENS_GEMINI_REASONING_MODEL" "gemini-2.5-flash"
  Set-DefaultEnv "CIVICLENS_GEMINI_VISION_MODEL" "gemini-2.5-flash"
  Set-DefaultEnv "CIVICLENS_GEMINI_AUDIO_MODEL" "gemini-2.5-flash"
  Set-DefaultEnv "CIVICLENS_GEMINI_GROUNDING_MODEL" "gemini-2.5-flash"
  Set-DefaultEnv "CIVICLENS_PLANNER_MODEL" "gemini-2.5-pro"
  Set-DefaultEnv "CIVICLENS_GEMINI_EMBEDDING_MODEL" "gemini-embedding-001"

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Http "http://127.0.0.1:3028/readyz" 90 | Out-Null

  $headers = @{
    "x-civiclens-job-secret" = $jobSecret
  }
  $result = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3028/api/smoke/model-tiers" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body "{}" `
    -TimeoutSec 180

  if (-not $result.success) {
    throw "Model-tier smoke returned success=false."
  }
  foreach ($name in @("cheapClassification", "vision", "reasoning", "planner", "embedding")) {
    if (-not $result.checks.$name.ok) {
      throw "Model-tier smoke check failed for $name."
    }
  }
  if (-not $result.separation.cheapVsReasoningDistinct -or -not $result.separation.plannerVsReasoningDistinct -or -not $result.separation.embeddingDedicated) {
    throw "Model tier separation was not proven."
  }

  Write-Output "MODEL_TIERING_LIVE cheap=$($result.modelTiers.cheapClassification) vision=$($result.modelTiers.vision) reasoning=$($result.modelTiers.reasoning) planner=$($result.modelTiers.planner) embedding=$($result.modelTiers.embedding) cheapStatus=$($result.checks.cheapClassification.status) visionStatus=$($result.checks.vision.status) reasoningStatus=$($result.checks.reasoning.status) plannerStatus=$($result.checks.planner.status) embeddingStatus=$($result.checks.embedding.status) embeddingDim=$($result.checks.embedding.detail.dimension) cheapVsReasoning=$($result.separation.cheapVsReasoningDistinct) plannerVsReasoning=$($result.separation.plannerVsReasoningDistinct) tokens=$($result.geminiUsage.geminiTotalTokenCount)"
} catch {
  $failed = $true
  Write-Output "MODEL_TIERING_LIVE_FAILED $($_.Exception.Message)"
  Get-Content $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 120
  Get-Content $serverOut -ErrorAction SilentlyContinue | Select-Object -Last 180
  exit 1
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }

  if (-not $failed) {
    Remove-Item -LiteralPath $serverOut, $serverErr -ErrorAction SilentlyContinue
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

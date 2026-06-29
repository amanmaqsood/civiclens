$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-deploy-smoke-server.out.log"
$serverErr = Join-Path $root "tmp-deploy-smoke-server.err.log"
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

$server = $null
$failed = $false
try {
  $geminiKey = $env:GEMINI_API_KEY
  if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    $geminiKey = Read-LocalEnvValue "GEMINI_API_KEY"
  }
  if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    throw "GEMINI_API_KEY is required in the environment or .env.production.local."
  }

  $mapsKey = $env:GOOGLE_MAPS_PLATFORM_KEY
  if ([string]::IsNullOrWhiteSpace($mapsKey)) {
    $mapsKey = Read-LocalEnvValue "GOOGLE_MAPS_PLATFORM_KEY"
  }
  if ([string]::IsNullOrWhiteSpace($mapsKey)) {
    $mapsKey = Read-LocalEnvValue "VITE_GOOGLE_MAPS_PLATFORM_KEY"
  }
  if ([string]::IsNullOrWhiteSpace($mapsKey)) {
    throw "GOOGLE_MAPS_PLATFORM_KEY or VITE_GOOGLE_MAPS_PLATFORM_KEY is required in the environment or .env.production.local."
  }

  $jobSecret = "deploy-smoke-secret-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

  $env:PORT = "3025"
  $env:NODE_ENV = "development"
  $env:APP_URL = "http://localhost:3025"
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
  $env:GOOGLE_MAPS_PLATFORM_KEY = $mapsKey
  $env:CIVICLENS_GEMINI_INPUT_USD_PER_MILLION_TOKENS = "0.10"
  $env:CIVICLENS_GEMINI_OUTPUT_USD_PER_MILLION_TOKENS = "0.40"

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Http "http://127.0.0.1:3025/readyz" 90 | Out-Null

  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\deploy-smoke.ps1") `
    -BaseUrl "http://127.0.0.1:3025" `
    -JobSecret $jobSecret `
    -TimeoutSeconds 120
  if ($LASTEXITCODE -ne 0) {
    throw "Deploy smoke verifier failed."
  }
} catch {
  $failed = $true
  Write-Output "DEPLOY_SMOKE_LIVE_FAILED $($_.Exception.Message)"
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

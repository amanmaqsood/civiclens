$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-final-golden-path-server.out.log"
$serverErr = Join-Path $root "tmp-final-golden-path-server.err.log"
$summaryPath = Join-Path $root "tmp-final-golden-path-summary.txt"
Remove-Item -LiteralPath $serverOut, $serverErr, $summaryPath -ErrorAction SilentlyContinue

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

  $jobSecret = "final-golden-path-secret-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  $webhookPort = "4576"

  $env:PORT = "3026"
  $env:NODE_ENV = "development"
  $env:APP_URL = "http://localhost:3026"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:GOOGLE_CLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "false"
  $env:CIVICLENS_QUOTA_BACKEND = "memory"
  $env:CIVICLENS_JOB_SECRET = $jobSecret
  $env:CIVICLENS_TEST_JOB_SECRET = $jobSecret
  $env:CIVICLENS_TEST_BASE_URL = "http://127.0.0.1:3026"
  $env:CIVICLENS_FINAL_GOLDEN_PATH_TESTS = "true"
  $env:CIVICLENS_TEST_WEBHOOK_PORT = $webhookPort
  $env:CIVICLENS_FINAL_GOLDEN_PATH_SUMMARY_PATH = $summaryPath
  $env:CIVICLENS_OUTBOUND_WEBHOOK = "http://127.0.0.1:$webhookPort/authority-intake"
  $env:GEMINI_API_KEY = $geminiKey
  $env:CIVICLENS_GEMINI_INPUT_USD_PER_MILLION_TOKENS = "0.10"
  $env:CIVICLENS_GEMINI_OUTPUT_USD_PER_MILLION_TOKENS = "0.40"

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Http "http://127.0.0.1:3026/readyz" 90 | Out-Null

  & ".\node_modules\.bin\vitest.cmd" run "src\server\final-golden-path-live.test.ts"
  if ($LASTEXITCODE -ne 0) {
    throw "Final golden path Vitest suite failed."
  }
  if (-not (Test-Path $summaryPath)) {
    throw "Final golden path summary was not written."
  }
  Get-Content -LiteralPath $summaryPath
} catch {
  $failed = $true
  Write-Output "FINAL_GOLDEN_PATH_LIVE_FAILED $($_.Exception.Message)"
  Get-Content $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 140
  Get-Content $serverOut -ErrorAction SilentlyContinue | Select-Object -Last 220
  exit 1
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }

  if (-not $failed) {
    Remove-Item -LiteralPath $serverOut, $serverErr, $summaryPath -ErrorAction SilentlyContinue
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

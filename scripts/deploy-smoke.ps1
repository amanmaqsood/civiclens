param(
  [string]$BaseUrl = $env:CIVICLENS_DEPLOY_SMOKE_URL,
  [string]$JobSecret = $env:CIVICLENS_JOB_SECRET,
  [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = $env:APP_URL
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  throw "BaseUrl is required. Pass -BaseUrl or set CIVICLENS_DEPLOY_SMOKE_URL / APP_URL."
}

if ([string]::IsNullOrWhiteSpace($JobSecret)) {
  throw "JobSecret is required. Pass -JobSecret or set CIVICLENS_JOB_SECRET."
}

$base = $BaseUrl.TrimEnd("/")
$headers = @{
  "Content-Type" = "application/json"
  "x-civiclens-job-secret" = $JobSecret
}

function Wait-Readyz {
  param([string]$Url, [int]$Timeout)
  $deadline = (Get-Date).AddSeconds($Timeout)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Method Get -Uri "$Url/readyz" -TimeoutSec 8
      if ($response.ready -eq $true) {
        return $response
      }
      $lastError = "readyz returned ready=$($response.ready)"
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Seconds 2
  }
  throw "Timed out waiting for $Url/readyz. Last error: $lastError"
}

$readyz = Wait-Readyz -Url $base -Timeout $TimeoutSeconds
if ($readyz.checks.adminDb -ne $true -or $readyz.checks.geminiConfigured -ne $true -or $readyz.checks.configValid -ne $true) {
  throw "readyz did not prove adminDb, geminiConfigured, and configValid."
}

$smoke = Invoke-RestMethod -Method Post -Uri "$base/api/smoke/deploy" -Headers $headers -Body "{}" -TimeoutSec $TimeoutSeconds
if ($smoke.success -ne $true) {
  throw "Deploy smoke failed."
}

$checks = $smoke.checks
foreach ($name in @("readyz", "auth", "gemini", "maps")) {
  if ($checks.$name.ok -ne $true) {
    throw "Deploy smoke check '$name' failed with status '$($checks.$name.status)'."
  }
}

$tokenCount = [int]($smoke.geminiUsage.geminiTotalTokenCount)
$mapsPredictions = [int]($checks.maps.detail.predictionCount)
$mapsApi = [string]($checks.maps.detail.api)
Write-Output "DEPLOY_SMOKE_LIVE url=$base ready=$($checks.readyz.status) auth=$($checks.auth.status) gemini=$($checks.gemini.status) maps=$($checks.maps.status) mapsApi=$mapsApi geminiTokens=$tokenCount mapsPredictions=$mapsPredictions durationMs=$($smoke.durationMs)"

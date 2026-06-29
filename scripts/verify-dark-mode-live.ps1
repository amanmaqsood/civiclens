$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-dark-mode-server.out.log"
$serverErr = Join-Path $root "tmp-dark-mode-server.err.log"
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

$server = $null
try {
  $env:PORT = "3014"
  $env:NODE_ENV = "development"
  $env:GCLOUD_PROJECT = "demo-civiclens"
  $env:FIREBASE_PROJECT_ID = "demo-civiclens"
  $env:FIREBASE_CONFIG = '{"projectId":"demo-civiclens","storageBucket":"demo-civiclens.appspot.com"}'
  $env:CIVICLENS_REQUIRE_APP_CHECK = "true"
  $env:CIVICLENS_LOCAL_APP_CHECK_BYPASS = "true"
  $env:CIVICLENS_DEMO_OPERATOR_ENABLED = "true"
  $env:GEMINI_API_KEY = "local-dark-mode-test"

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-Http "http://127.0.0.1:3014/health" 90 | Out-Null

  $browserScript = @'
const { chromium } = require("playwright");
const axe = require("axe-core");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("civiclens-theme", "light"));
  await page.goto("http://127.0.0.1:3014", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("#header-theme-toggle").waitFor({ state: "visible", timeout: 30000 });
  const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  if (initialTheme !== "light") {
    throw new Error(`Expected light theme at boot, got ${initialTheme}`);
  }
  await page.locator("#header-theme-toggle").evaluate((button) => button.click());
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  const summary = await page.evaluate(() => {
    const card = document.querySelector(".bg-white");
    const toggle = document.querySelector("#header-theme-toggle");
    return {
      theme: document.documentElement.dataset.theme,
      stored: localStorage.getItem("civiclens-theme"),
      darkClass: document.documentElement.classList.contains("dark"),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      cardBg: card ? getComputedStyle(card).backgroundColor : "",
      toggleLabel: toggle ? toggle.getAttribute("aria-label") : "",
      togglePressed: toggle ? toggle.getAttribute("aria-pressed") : "",
    };
  });
  if (summary.theme !== "dark" || summary.stored !== "dark" || !summary.darkClass) {
    throw new Error(`Theme did not persist correctly: ${JSON.stringify(summary)}`);
  }
  if (summary.cardBg === "rgb(255, 255, 255)") {
    throw new Error("Dark mode left a bg-white card fully white.");
  }
  await page.addScriptTag({ content: axe.source });
  const axeResult = await page.evaluate(async () => {
    const header = document.querySelector("header");
    return await axe.run(header || document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      resultTypes: ["violations"]
    });
  });
  const seriousOrCritical = axeResult.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (seriousOrCritical.length) {
    throw new Error(`Axe serious/critical violations: ${seriousOrCritical.map((v) => v.id).join(",")}`);
  }
  const actionableConsoleErrors = consoleErrors.filter((line) => !/favicon|manifest/i.test(line));
  if (actionableConsoleErrors.length || pageErrors.length) {
    throw new Error(`Console/page errors: ${[...actionableConsoleErrors, ...pageErrors].join(" | ")}`);
  }
  console.log(JSON.stringify({
    theme: summary.theme,
    stored: summary.stored,
    bodyBg: summary.bodyBg,
    cardBg: summary.cardBg,
    toggleLabel: summary.toggleLabel,
    axeSeriousCritical: seriousOrCritical.length,
    consoleErrors: actionableConsoleErrors.length,
    pageErrors: pageErrors.length
  }));
  await browser.close();
})().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
'@

  $json = $browserScript | node -
  if ($LASTEXITCODE -ne 0) {
    throw "Dark-mode browser verification failed."
  }
  $summary = $json | ConvertFrom-Json
  Write-Output "DARK_MODE_LIVE theme=$($summary.theme) stored=$($summary.stored) cardBg='$($summary.cardBg)' axeSeriousCritical=$($summary.axeSeriousCritical) consoleErrors=$($summary.consoleErrors) pageErrors=$($summary.pageErrors)"
} catch {
  Write-Output "DARK_MODE_LIVE_FAILED $($_.Exception.Message)"
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

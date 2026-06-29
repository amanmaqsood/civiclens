$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverOut = Join-Path $root "tmp-voice-intake-server.out.log"
$serverErr = Join-Path $root "tmp-voice-intake-server.err.log"
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

  $env:PORT = "3018"
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

  Wait-Http "http://127.0.0.1:3018/readyz" 90 | Out-Null

  $nodeScript = @'
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-civiclens";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const root = process.cwd();
const baseUrl = "http://127.0.0.1:3018";
if (!authHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST is required.");
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();

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

async function main() {
  const fixturePath = join(root, "tests", "fixtures", "voice-intake-pothole.wav");
  const audio = `data:audio/wav;base64,${readFileSync(fixturePath).toString("base64")}`;
  const session = await signUp();
  const response = await fetch(`${baseUrl}/api/voice-intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
      "x-civiclens-local-appcheck-bypass": "true",
    },
    body: JSON.stringify({
      audio,
      mimeType: "audio/wav",
      localeHint: "hi-IN",
      descriptionHint: "",
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`voice intake failed ${response.status}: ${JSON.stringify(body)}`);
  if (!body.success || !body.data) throw new Error(`voice intake did not succeed: ${JSON.stringify(body)}`);
  if (body.data.aiFallback) throw new Error("voice intake unexpectedly used fallback");
  if (!["pothole", "road_damage"].includes(body.data.category)) throw new Error(`unexpected category ${body.data.category}`);
  const english = String(body.data.englishTranslation || body.data.summary || "").toLowerCase();
  if (!english.includes("pothole") && !english.includes("road")) throw new Error(`translation missing road issue: ${english}`);
  if (String(body.data.readbackText || "").length < 20) throw new Error("readbackText was too short");
  const eventSnap = await db.collection("events").where("eventType", "==", "ai_voice_intake").limit(5).get();
  if (eventSnap.empty) throw new Error("missing ai_voice_intake event");
  console.log(`VOICE_INTAKE_LIVE category=${body.data.category} language=${String(body.data.detectedLanguage).replace(/\s+/g, "_")} transcriptChars=${String(body.data.transcriptOriginal || "").length} readbackChars=${String(body.data.readbackText || "").length} fallback=false eventCount=${eventSnap.size}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
'@

  $tempNodeScript = Join-Path $root "tmp-voice-intake-verifier.cjs"
  Set-Content -LiteralPath $tempNodeScript -Value $nodeScript -Encoding UTF8
  & node $tempNodeScript
  if ($LASTEXITCODE -ne 0) {
    throw "Voice intake live verifier failed."
  }
} catch {
  Write-Output "VOICE_INTAKE_LIVE_FAILED $($_.Exception.Message)"
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

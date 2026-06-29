# Cloud Run Deployment Runbook

Do not deploy from this repository unless Firebase/GCP credentials, billing, and explicit user approval are available. This runbook is a checklist and command template only.

## What Is Build-Time Vs Runtime

- Vite browser variables (`VITE_*`) are baked into the frontend during `npm run build` or Docker image build. Rebuild when Firebase web config, Maps browser key, Firestore database ID, emulator flags, or App Check site key change.
- Server variables (`GEMINI_API_KEY`, `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, operator config, and App Check enforcement) are read by Cloud Run at runtime.
- Cloud Run should use Application Default Credentials for Firebase Admin SDK. Do not create, commit, or bake service-account JSON into the image.

## Required Google Console Setup

1. Choose the Google Cloud project and enable billing.
2. Enable Cloud Run, Artifact Registry, Cloud Build, Secret Manager, Firebase Auth, Firestore, Storage, and Maps JavaScript API.
3. Connect or create the Firebase project for the same Google Cloud project.
4. Create a Firebase Web App and copy its public browser config into `.env.production.local`.
5. Enable Anonymous Auth for citizen reporting and Google sign-in for real operators.
6. Create Firestore in Native mode. Record the database ID; use `(default)` unless you created a named database.
7. Create/configure the Firebase Storage bucket and rules.
8. Restrict the Maps browser key to the deployed origin after the Cloud Run URL exists.
9. Optional before public release: create a Firebase App Check reCAPTCHA v3 site key for the deployed domain.
10. Store `GEMINI_API_KEY` in Secret Manager. Do not paste secrets into chat or commit them.
11. Configure real operator authorization with custom claims or `CIVICLENS_OPERATOR_EMAILS`.

## `.env.production.local` Fields

Create this file locally for deployment preparation only. Do not commit it.

```bash
GEMINI_API_KEY=""
APP_URL=""

FIREBASE_PROJECT_ID=""
FIRESTORE_DATABASE_ID="(default)"

VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_APP_ID=""
VITE_FIREBASE_STORAGE_BUCKET=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_MEASUREMENT_ID=""
VITE_FIRESTORE_DATABASE_ID="(default)"

GOOGLE_MAPS_PLATFORM_KEY=""
VITE_GOOGLE_MAPS_PLATFORM_KEY=""

VITE_FIREBASE_APP_CHECK_SITE_KEY=""
CIVICLENS_REQUIRE_APP_CHECK="false"

CIVICLENS_OPERATOR_EMAILS=""
CIVICLENS_LOCAL_APP_CHECK_BYPASS="false"
CIVICLENS_DEMO_OPERATOR_ENABLED="false"

CIVICLENS_QUOTA_BACKEND="firestore"
CIVICLENS_QUOTA_COLLECTION="rateLimitBuckets"
CIVICLENS_SESSION_QUOTA_LIMIT="60"
CIVICLENS_SESSION_QUOTA_WINDOW_MS="60000"
CIVICLENS_GEMINI_QUOTA_LIMIT="20"
CIVICLENS_GEMINI_QUOTA_WINDOW_MS="60000"
CIVICLENS_MUTATION_QUOTA_LIMIT="30"
CIVICLENS_MUTATION_QUOTA_WINDOW_MS="60000"
```

Set `CIVICLENS_REQUIRE_APP_CHECK=true` only after the deployed frontend has `VITE_FIREBASE_APP_CHECK_SITE_KEY` baked into the image and smoke tests confirm requests include `X-Firebase-AppCheck`.
Keep `CIVICLENS_QUOTA_BACKEND=firestore` for Cloud Run so API quota buckets are shared across instances; production fails closed if Firestore quota storage is unavailable.

## Local Production Check

PowerShell:

```powershell
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev

$env:NODE_ENV = "production"
$env:PORT = "3000"
npm run start
```

Smoke locally in another PowerShell window:

```powershell
Invoke-WebRequest http://localhost:3000/health
Invoke-WebRequest http://localhost:3000/readyz
```

`/health` is liveness. `/readyz` reports Admin SDK, Gemini config, and runtime config readiness. A local `/readyz` 503 is expected if production secrets are intentionally absent.

## Docker Image Build

The repository includes a `Dockerfile`. Build args are public browser config only; do not pass `GEMINI_API_KEY` as a Docker build arg.

PowerShell local Docker example:

```powershell
$PROJECT_ID = "YOUR_PROJECT_ID"
$REGION = "us-central1"
$REPOSITORY = "civiclens"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/civiclens:manual"

docker build `
  --build-arg VITE_FIREBASE_API_KEY="$env:VITE_FIREBASE_API_KEY" `
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="$env:VITE_FIREBASE_AUTH_DOMAIN" `
  --build-arg VITE_FIREBASE_PROJECT_ID="$env:VITE_FIREBASE_PROJECT_ID" `
  --build-arg VITE_FIREBASE_APP_ID="$env:VITE_FIREBASE_APP_ID" `
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="$env:VITE_FIREBASE_STORAGE_BUCKET" `
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="$env:VITE_FIREBASE_MESSAGING_SENDER_ID" `
  --build-arg VITE_FIREBASE_MEASUREMENT_ID="$env:VITE_FIREBASE_MEASUREMENT_ID" `
  --build-arg VITE_FIRESTORE_DATABASE_ID="$env:VITE_FIRESTORE_DATABASE_ID" `
  --build-arg VITE_GOOGLE_MAPS_PLATFORM_KEY="$env:VITE_GOOGLE_MAPS_PLATFORM_KEY" `
  --build-arg VITE_FIREBASE_APP_CHECK_SITE_KEY="$env:VITE_FIREBASE_APP_CHECK_SITE_KEY" `
  -t $IMAGE .
```

Cloud Build example using `cloudbuild.yaml`:

```powershell
$PROJECT_ID = "YOUR_PROJECT_ID"
$REGION = "us-central1"
$REPOSITORY = "civiclens"
$TAG = "manual"

gcloud artifacts repositories create $REPOSITORY --repository-format=docker --location=$REGION --project=$PROJECT_ID

gcloud builds submit . `
  --project=$PROJECT_ID `
  --config=cloudbuild.yaml `
  --substitutions="_REGION=$REGION,_REPOSITORY=$REPOSITORY,_TAG=$TAG,_VITE_FIREBASE_API_KEY=$env:VITE_FIREBASE_API_KEY,_VITE_FIREBASE_AUTH_DOMAIN=$env:VITE_FIREBASE_AUTH_DOMAIN,_VITE_FIREBASE_PROJECT_ID=$env:VITE_FIREBASE_PROJECT_ID,_VITE_FIREBASE_APP_ID=$env:VITE_FIREBASE_APP_ID,_VITE_FIREBASE_STORAGE_BUCKET=$env:VITE_FIREBASE_STORAGE_BUCKET,_VITE_FIREBASE_MESSAGING_SENDER_ID=$env:VITE_FIREBASE_MESSAGING_SENDER_ID,_VITE_FIREBASE_MEASUREMENT_ID=$env:VITE_FIREBASE_MEASUREMENT_ID,_VITE_FIRESTORE_DATABASE_ID=$env:VITE_FIRESTORE_DATABASE_ID,_VITE_GOOGLE_MAPS_PLATFORM_KEY=$env:VITE_GOOGLE_MAPS_PLATFORM_KEY,_VITE_FIREBASE_APP_CHECK_SITE_KEY=$env:VITE_FIREBASE_APP_CHECK_SITE_KEY"
```

## Cloud Run Deploy Shape

Run only after explicit approval:

```powershell
$PROJECT_ID = "YOUR_PROJECT_ID"
$REGION = "us-central1"
$REPOSITORY = "civiclens"
$TAG = "manual"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/civiclens:$TAG"

gcloud run deploy civiclens `
  --project=$PROJECT_ID `
  --image=$IMAGE `
  --region=$REGION `
  --platform=managed `
  --allow-unauthenticated `
  --set-env-vars="NODE_ENV=production,FIREBASE_PROJECT_ID=$PROJECT_ID,FIRESTORE_DATABASE_ID=$env:FIRESTORE_DATABASE_ID,APP_URL=$env:APP_URL,GOOGLE_MAPS_PLATFORM_KEY=$env:GOOGLE_MAPS_PLATFORM_KEY,CIVICLENS_OPERATOR_EMAILS=$env:CIVICLENS_OPERATOR_EMAILS,CIVICLENS_LOCAL_APP_CHECK_BYPASS=false,CIVICLENS_DEMO_OPERATOR_ENABLED=false,CIVICLENS_REQUIRE_APP_CHECK=$env:CIVICLENS_REQUIRE_APP_CHECK,CIVICLENS_QUOTA_BACKEND=firestore,CIVICLENS_QUOTA_COLLECTION=rateLimitBuckets" `
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

Set `CIVICLENS_DEMO_OPERATOR_ENABLED=true` only for a deliberately public synthetic demo deployment. Demo mutations remain limited to `isDemoData == true` cases.

## Required Smoke Tests After Deploy

- Open the public app URL in a clean browser profile.
- Verify `/health` returns 200.
- Verify `/readyz` returns 200 before calling the deployment release-ready.
- If App Check is enforced, confirm browser API requests include `X-Firebase-AppCheck`.
- Submit a synthetic report.
- Run AI triage for the saved report.
- Confirm support/verification actions persist.
- Open operator desk with an authorized account.
- Approve routing/action packet.
- Upload closure evidence and confirm resolve requires human action.
- As an operator, call `/api/ops/observability?hours=1` and verify recent event counts plus Cloud Logging query templates.
- Test mobile width around 360 px, tablet, and desktop.
- Restrict the Maps browser key to the verified public origin.

Record the deployed URL, Cloud Run revision, smoke results, screenshots, and any warnings in `docs/FINAL_EVIDENCE_REPORT.md`.
After the first smoke test emits logs, use `docs/OBSERVABILITY.md` to create logs-based metrics and import the Cloud Monitoring dashboard template.

## Rollback

Use Cloud Run revisions:

```powershell
gcloud run revisions list --service=civiclens --region=$REGION --project=$PROJECT_ID
gcloud run services update-traffic civiclens --region=$REGION --project=$PROJECT_ID --to-revisions=REVISION=100
```

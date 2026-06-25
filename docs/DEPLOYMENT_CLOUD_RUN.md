# Cloud Run Deployment Runbook

Do not deploy from this repository unless Firebase/GCP credentials, billing, and explicit user approval are available.

## Prerequisites

- Google Cloud project with billing enabled.
- Firebase project connected to the same environment.
- Secret Manager or Cloud Run secrets for `GEMINI_API_KEY`.
- Google Maps browser key configured for the deployed origin.
- Verified operator identity via Firebase custom claim or `CIVICLENS_OPERATOR_EMAILS`.
- App Check production token path configured for the frontend and server.

## Local Production Check

```bash
npm ci
npm run build
$env:NODE_ENV="production"
$env:PORT="3000"
npm run start
```

Smoke locally:

```bash
Invoke-WebRequest http://localhost:3000/health
Invoke-WebRequest http://localhost:3000/readyz
```

`/health` is liveness. `/readyz` reports Admin SDK, Gemini config, and runtime config readiness.

## Build And Deploy Shape

Example command shape, to run only after selecting a real project and image registry:

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/civiclens:REVISION
gcloud run deploy civiclens `
  --image REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/civiclens:REVISION `
  --region REGION `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars NODE_ENV=production,CIVICLENS_LOCAL_APP_CHECK_BYPASS=false,CIVICLENS_DEMO_OPERATOR_ENABLED=false `
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

Set `CIVICLENS_DEMO_OPERATOR_ENABLED=true` only for a deliberately public synthetic demo deployment.

## Required Smoke Tests After Deploy

- Open the public app URL in a clean browser profile.
- Verify `/health` returns 200.
- Verify `/readyz` returns 200 before calling the deployment release-ready.
- Submit a synthetic report.
- Run AI triage for the saved report.
- Confirm support/verification actions persist.
- Open operator desk with an authorized account.
- Approve routing/action packet.
- Upload closure evidence and confirm resolve requires human action.
- Test mobile width around 360 px and desktop width.

## Rollback

Use Cloud Run revisions:

```bash
gcloud run revisions list --service civiclens --region REGION
gcloud run services update-traffic civiclens --region REGION --to-revisions REVISION=100
```

Record the deployed URL, revision, smoke results, and rollback revision in `docs/FINAL_EVIDENCE_REPORT.md`.

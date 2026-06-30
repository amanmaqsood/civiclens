# CivicLens v2 — Deploy & Autonomous-Worker Runbook

This extends the base deploy guide (`docs/DEPLOYMENT_CLOUD_RUN.md`) with the v2
additions: real outbound dispatch, the four autonomous workers, semantic dedup,
grounding, gamification, and open analytics. Follow it to ship `master` to Google
Cloud Run and schedule the autonomous agents.

## 1. New configuration (vs v1)

| Variable | Where | Purpose |
|---|---|---|
| `CIVICLENS_OUTBOUND_WEBHOOK` | Cloud Run runtime env | Authority intake URL for **real escalation dispatch**. Empty ⇒ escalations stay draft-only. |
| `CIVICLENS_JOB_SECRET` | Secret Manager → Cloud Run | Shared secret Cloud Scheduler sends (`x-civiclens-job-secret`) to run workers without an operator login. |
| `CIVICLENS_QUOTA_BACKEND` | Cloud Run runtime env | `firestore` for distributed fixed-window API quotas; production fails closed if Firestore quota storage is unavailable. |
| `CIVICLENS_QUOTA_COLLECTION` | Cloud Run runtime env | Firestore collection for quota buckets. Defaults to `rateLimitBuckets`. |
| `CIVICLENS_SESSION_QUOTA_LIMIT`, `CIVICLENS_GEMINI_QUOTA_LIMIT`, `CIVICLENS_MUTATION_QUOTA_LIMIT` | Cloud Run runtime env | Per-window limits for session, Gemini, and mutation routes. |
| `CIVICLENS_SESSION_QUOTA_WINDOW_MS`, `CIVICLENS_GEMINI_QUOTA_WINDOW_MS`, `CIVICLENS_MUTATION_QUOTA_WINDOW_MS` | Cloud Run runtime env | Fixed-window duration for the matching quota class. |
| `CIVICLENS_GEMINI_INPUT_USD_PER_MILLION_TOKENS`, `CIVICLENS_GEMINI_OUTPUT_USD_PER_MILLION_TOKENS` | Cloud Run runtime env | Optional model-pricing values used only for structured log cost estimates. Token counts are logged even when unset. |
| `CIVICLENS_GEMINI_CHEAP_MODEL`, `CIVICLENS_GEMINI_REASONING_MODEL`, `CIVICLENS_GEMINI_VISION_MODEL`, `CIVICLENS_GEMINI_AUDIO_MODEL`, `CIVICLENS_GEMINI_GROUNDING_MODEL`, `CIVICLENS_PLANNER_MODEL`, `CIVICLENS_GEMINI_EMBEDDING_MODEL` | Cloud Run runtime env | Optional Gemini model tier overrides. Defaults are Flash-Lite for cheap classification, Flash for vision/reasoning/audio/grounding, Pro for planning, and `gemini-embedding-001` for dedup. |
| `GEMINI_API_KEY` | Secret Manager (unchanged) | Gemini + `gemini-embedding-001` for triage, workers, dedup, grounding. |

Everything else (Firebase, `GOOGLE_MAPS_PLATFORM_KEY`, operator allowlist, App Check) is unchanged from v1.

## 2. Create the job secret

```bash
PROJECT=<your-gcp-project>
# generate + store a strong secret
openssl rand -hex 32 | gcloud secrets create civiclens-job-secret --data-file=- --project "$PROJECT"
# allow the Cloud Run runtime service account to read it
gcloud secrets add-iam-policy-binding civiclens-job-secret \
  --member="serviceAccount:$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --project "$PROJECT"
```

## 3. Build & deploy `master`

```bash
# from repo root, on master
gcloud builds submit --config cloudbuild.yaml --project "$PROJECT"

gcloud run deploy civiclens \
  --image <artifact-registry-image-from-build> \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-secrets "GEMINI_API_KEY=civiclens-gemini-key:latest,CIVICLENS_JOB_SECRET=civiclens-job-secret:latest" \
  --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT,FIRESTORE_DATABASE_ID=(default),CIVICLENS_OUTBOUND_WEBHOOK=<authority-webhook-or-blank>,CIVICLENS_REQUIRE_APP_CHECK=true,CIVICLENS_DEMO_OPERATOR_ENABLED=false,CIVICLENS_QUOTA_BACKEND=firestore,CIVICLENS_QUOTA_COLLECTION=rateLimitBuckets" \
  --project "$PROJECT"
```

Notes:
- Set `CIVICLENS_REQUIRE_APP_CHECK=true` and `CIVICLENS_DEMO_OPERATOR_ENABLED=false` for the public production cut (keep demo on only for a judging demo instance).
- `VITE_*` browser values are baked at build time (already wired in `cloudbuild.yaml`).
- After deploy, smoke-check: `GET /readyz` should report `adminDb:true, geminiConfigured:true, configValid:true`.
- Run `scripts\deploy-smoke.ps1` or `npm run smoke:deploy` against the deployed URL with `CIVICLENS_JOB_SECRET`; the proof line must include `DEPLOY_SMOKE_LIVE` with `auth=ok`, `gemini=ok`, `maps=OK`, and `mapsApi=...`.
- Run `npm run test:model-tiering` locally before release, or call `POST /api/smoke/model-tiers` with the job-secret header after deploy, to prove cheap/reasoning/planner/embedding tier separation.
- Keep `CIVICLENS_QUOTA_BACKEND=firestore` in production so quota buckets are shared across Cloud Run instances. Development may use `memory`, but it is process-local.
- Follow `docs/OBSERVABILITY.md` after the first smoke run to create logs-based metrics and import `docs/monitoring/civiclens-cloud-monitoring-dashboard.json`.

## 4. Schedule the four autonomous workers (Cloud Scheduler)

Each worker is `POST /api/jobs/run` with `{"worker":"<name>"}` and the job-secret header. Replace `RUN_URL` with your Cloud Run URL and `SECRET` with the job secret value.

```bash
RUN_URL=https://civiclens-xxxx.a.run.app
SECRET=<the civiclens-job-secret value>
mk() { # name  schedule  bodyjson
  gcloud scheduler jobs create http "civiclens-$1" \
    --location asia-south1 --schedule "$2" \
    --uri "$RUN_URL/api/jobs/run" --http-method POST \
    --headers "Content-Type=application/json,x-civiclens-job-secret=$SECRET" \
    --message-body "$3" --project "$PROJECT"
}
mk sla       "0 * * * *"   '{"worker":"sla"}'        # hourly: SLA-breach escalation + auto-RTI
mk followup  "0 */6 * * *" '{"worker":"followup"}'   # every 6h: LLM follow-up decisions
mk predict   "0 2 * * *"   '{"worker":"predict"}'    # daily 02:00: predictive insights
mk embed     "*/30 * * * *" '{"worker":"embed"}'     # every 30m: backfill new-issue embeddings
```

Hardening options: instead of a shared secret, use an OIDC service-account token
(`--oidc-service-account-email`) and verify it server-side; or run the workers as
a separate authenticated Cloud Run **job**. The secret-header path above is the
simplest that keeps the runner non-public.

## 5. Verify in production

```bash
# workers (operator session or job secret)
curl -s -XPOST "$RUN_URL/api/jobs/run" -H "x-civiclens-job-secret:$SECRET" \
  -H 'Content-Type: application/json' -d '{"worker":"predict"}'
# open analytics (public)
curl -s "$RUN_URL/api/insights/predictive"
curl -s "$RUN_URL/api/leaderboard"
curl -s "$RUN_URL/api/export/open311"
```

## 6. App Check (production)

Add a reCAPTCHA v3 site key (`VITE_FIREBASE_APP_CHECK_SITE_KEY`) at build time and
set `CIVICLENS_REQUIRE_APP_CHECK=true` only after the deployed frontend is sending
`X-Firebase-AppCheck` and the smoke checks above pass.

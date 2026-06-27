# Final Evidence Report

Generated during the CivicLens rebuild and deployment checkpoints on 2026-06-26 and 2026-06-27.

## Scope

This report records local validation, GitHub sync, Firebase Rules deployment, Secret Manager verification, and Cloud Run deployment evidence. It does not claim Google Doc publication, demo video publication, or hackathon submission.

## Repository State

- Original prototype baseline tag: `baseline/original-prototype`
- Completed rebuild tags:
  - `milestone-0-baseline`
  - `milestone-1-truth-boundary`
  - `milestone-2-api-perimeter`
  - `milestone-3-server-data-integrity`
  - `milestone-4-persisted-agent`
  - `milestone-5-lifecycle-approvals`
  - `milestone-6-responsive-ux`
  - `milestone-7-reliability-metrics`
  - `milestone-8-release-gates`
  - `milestone-9-docs-readiness`
- `docs/CODEX_MASTER_PLAN.md` is updated as the final release checklist. Locally verifiable items and the approved Cloud Run deployment smoke are recorded. Remaining publication/submission items still require explicit external approval.

## Production Firebase Rules and Secret Manager Checkpoint

This checkpoint was performed on 2026-06-26 against project `gen-lang-client-0871796745`. It deployed only Firebase Rules and created/verified one Secret Manager secret. It did not deploy Cloud Run, publish a public URL, change billing, delete resources, publish docs/video, or submit the project.

- Firestore database ID used: `ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa`.
- Firestore Rules: dry-run compiled successfully, then deployed successfully to `cloud.firestore/ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa`.
- Storage Rules: dry-run compiled successfully, then deployed successfully to the Firebase Storage rules release for the project.
- Secret Manager: `GEMINI_API_KEY` exists with version `1` in state `ENABLED`. The secret value came from ignored local `.env.production.local` and is not recorded in this report.
- Config change: `firebase.json` now pins the Firestore Rules target to the named production database so Firebase CLI does not default to `(default)`.
- Later follow-up: Cloud Run deployment and public `/health` plus `/readyz` smoke tests were completed in the Cloud Run Deployment Checkpoint below.

## GitHub Sync Checkpoint

This checkpoint was performed on 2026-06-27 against `https://github.com/amanmaqsood/civiclens`. It synchronized the local CivicLens release to GitHub only; it did not deploy Cloud Run, change billing, rotate keys, delete resources, publish docs/video, or submit the project.

- Remote branch pushed: `main`.
- Local production checkpoint included: `522e5b1 chore: record production firebase checkpoint`.
- GitHub sync commit: `9474060 chore: sync local release with github history`.
- Sync method: preserved the older unrelated GitHub history as a merge parent while keeping the local audited release tree, then pushed to `main` without force.
- Tags: milestone and release tags were pushed to GitHub.
- GitHub browser verification: repository was public; README rendered; latest commit was visible; `docs/`, `LICENSE`, and `ATTRIBUTIONS.md` were visible; the root repository listing did not show `.env.production.local`.
- Secret scan: tracked-file scans found no private key marker, Firebase Admin SDK service-account string, or tracked local production env file. A public Firebase browser config key-shaped value exists in `firebase-applet-config.json`; the value is not recorded here.
- Later follow-up: Cloud Run deployment and public smoke tests were completed in the Cloud Run Deployment Checkpoint below.

## Cloud Run Deployment Checkpoint

This checkpoint was performed on 2026-06-27 after explicit user approval to run `gcloud auth login` and deploy with an empty Firebase measurement ID. It deployed the app to Cloud Run and smoke-tested the public URL. It did not publish a Google Doc, publish a demo video, or submit the project.

- Project ID: `gen-lang-client-0871796745`.
- Region: `asia-southeast1`.
- Service: `civiclens`.
- Firestore database: `ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa`.
- Final deployed commit: `fcf8946 fix: make app title prototype scoped`.
- Final Cloud Build ID: `13a7b4ed-50a2-438b-b139-5020ccb1f0c4`.
- Final image: `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:fcf8946`.
- Final image digest: `sha256:5970094fceabbec2a244c4552a252664110c7f95556ecf541a45d6eb108f9ba8`.
- Final Cloud Run revision: `civiclens-00034-82x`, serving 100 percent traffic.
- Canonical public URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Alternate public URL: `https://civiclens-802067002365.asia-southeast1.run.app`.
- Deployment evidence timestamp: `2026-06-27T06:15:47.5789177+05:30`.
- Runtime secret handling: Cloud Run uses `GEMINI_API_KEY=GEMINI_API_KEY:latest`; the secret value is not recorded here.
- Runtime warning: `/readyz` reports `CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled.`

Deployment actions:

- Enabled/used Cloud Run, Artifact Registry, Cloud Build, Secret Manager, and related Google services for the approved deployment flow.
- Created Artifact Registry repository `civiclens` in `asia-southeast1`.
- Granted the Cloud Run runtime service account least-privilege `roles/secretmanager.secretAccessor` on `GEMINI_API_KEY`.
- Removed stale AI Studio/source-build annotations from the existing Cloud Run service metadata so an Artifact Registry image could serve normally.
- Deployed with `VITE_FIREBASE_MEASUREMENT_ID` intentionally empty because the Firebase web config did not include a measurement ID and the user explicitly approved that condition.

Release-blocking fixes found during deployed smoke:

- `b2c24b5`: waited for Firebase auth before loading the issue feed, fixing production Firestore read-denial UI errors.
- `5032145`: fixed closure verifier response parsing so it no longer shadowed the `cleanText` sanitizer.
- `602fb57`: omitted undefined optional closure image fields before Firestore writes.
- `fcf8946`: changed the document title to prototype-scoped language.

## Latest Completed Validation

Final deployment validation results:

- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (15 test files passed, 2 emulator-only files skipped by default; 71 tests passed, 7 skipped).
- `npm run build`: passed. Warnings remain: Firebase chunk is larger than 500 kB (`assets/firebase-Ct40zCNZ.js`, 718.27 kB / 179.73 kB gzip), and `src/services/issues.ts` is still both dynamically and statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 Firestore/Storage emulator test file, 3 tests).
- `npm run test:concurrency`: passed (1 Firestore emulator test file, 4 tests).
- Cloud Run `/health`: 200 on both public hostnames.
- Cloud Run `/readyz`: 200 on both public hostnames with `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`, and no missing config values.
- Browser smoke on the final deployed URL: title `CivicLens - Civic Issue Reporting Prototype`; CivicLens branding visible; synthetic/prototype labels visible; map surface visible; report action visible; issue/feed text visible; console errors empty; unsupported autonomous/official/government filing language absent.
- Playwright viewport smoke: desktop `1440x900` and mobile `390x844` both passed with no console errors, no horizontal overflow, map/report action visible, synthetic/prototype labels visible, and unsupported language absent.
- Final live API smoke on commit `fcf8946`: Gemini triage success with confidence `0.9`; synthetic issue `smoke-fcf8946-7319a90e` saved as `submitted`; persisted agent run `smoke-fcf8946-7319a90e_agent-smoke-fcf8946-7319a90e` returned 8 server tool steps; latest agent run fetched twice with persisted trace intact.
- Operator boundary smoke: anonymous citizen lifecycle transition denied with 403; demo operator denied with 403 on the non-demo smoke issue; demo operator successfully transitioned synthetic demo issue `JOaqBXiJNnyWgWqfqpwI` from `in_progress` to `submitted`.
- Closure smoke: Gemini returned recommendation `resolve`, closure assessment persisted, and the demo issue remained `submitted` rather than auto-resolving.

## Local Release Evidence

- Truth boundary docs and copy are present.
- Server API perimeter verifies Firebase identity, quotas, body-size limits, and role boundaries. App Check enforcement is available behind `CIVICLENS_REQUIRE_APP_CHECK=true`; local tests keep it disabled unless the frontend site key and token path are configured.
- Firestore issue-owned writes are server-owned.
- Storage Rules restrict owner paths, image MIME types, and file size.
- Agent runs are persisted as server-authored `agentRuns` and `agentSteps`.
- Stored issue statuses use canonical enum keys; UI derives display labels.
- Browser-supplied privileged trace arrays are no longer accepted for resolution, closure, or escalation saves.
- Stored resolution plans are generated from server-loaded issue state rather than browser-posted plan objects.
- The agent tool contract includes the required server tool names for nearby search, evidence comparison, priority calculation, authority lookup, action packet drafting, human approval request, closure verification, and event recording.
- Operator lifecycle decisions require server-authorized identity and rationale.
- Dashboard metrics separate real records from synthetic demo data.
- Responsive shell replaces the fake phone frame.
- Release-gate source tests cover named security, rules, lifecycle, agent, and UI golden-path cases.
- Firebase Emulator Suite tests execute the deployed Firestore and Storage rule files for representative allow/deny cases.
- A focused Firestore emulator concurrency gate races same-user support, verification, duplicate evidence, and status-transition writes and verifies only one persisted action/count or approval wins.
- Playwright/axe browser tests execute responsive landing and synthetic demo operator flows at mobile, tablet, and desktop sizes.
- License, attribution, architecture, deployment, AI Studio evidence, demo script, Google Doc draft, and final evidence docs are present.
- Pre-deployment closeout removed unsupported government-adjacent initiative wording from the landing page and added regression tests for that phrase.
- Firebase Admin SDK project/database selection is env-driven via `FIREBASE_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT`, and `FIRESTORE_DATABASE_ID`; no service-account JSON is required or committed.
- Frontend Firebase config supports `VITE_FIREBASE_*` build-time env vars, with fallback to the checked-in public `firebase-applet-config.json`.
- Frontend App Check initializes when `VITE_FIREBASE_APP_CHECK_SITE_KEY` is present, and API requests send `X-Firebase-AppCheck` when a token is available.
- A `Dockerfile`, `.dockerignore`, `cloudbuild.yaml`, and Windows PowerShell Cloud Run runbook are present.
- Old unreachable client-side synthetic demo seed/clear Firestore write branches were removed from `src/services/issues.ts`; those flows use server endpoints.
- `docs/evidence/README.md` records the real-screenshot capture rules and filenames to use after approved account/deployment actions.
- The built server starts locally in production mode and serves `/health`; full readiness remains gated by real production secrets.

## External Blockers

- Explicit user approval is still required before demo video publication, Google Doc publication, final public screenshot packaging, or hackathon submission.
- Real final screenshots for AI Studio/GCP/Cloud Run evidence still need capture and packaging.
- Public GitHub URL: `https://github.com/amanmaqsood/civiclens`.
- Public app URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Public Google Doc URL: not created in this checkpoint.
- Demo video URL: not created in this checkpoint.

## Remaining Local Gaps

- Transaction/concurrency behavior has focused parallel emulator coverage for support, verification, duplicate evidence, and status-transition writes; a full API-level race matrix remains future hardening.
- Browser E2E uses seeded synthetic emulator data; the deployed smoke used live Gemini/API calls and synthetic images, but final judge-facing screenshot/video packaging is still pending.
- Local production `/readyz` fails without production secrets, as expected. Cloud Run `/readyz` is passing in the deployed environment.
- Production App Check enforcement has not been deployed or smoke-tested. Keep `CIVICLENS_REQUIRE_APP_CHECK=false` until a Firebase App Check site key is configured and browser requests are verified to send `X-Firebase-AppCheck`.
- Restrict the Maps browser key to the final Cloud Run origin before broader public sharing.
- Cloud Build install stage still reports 3 moderate dev-dependency vulnerabilities. Runtime install and `npm audit --omit=dev` report 0 production vulnerabilities.
- Chrome UI file upload automation was blocked by the Codex extension file URL setting; API-backed smoke covered report save/Gemini/agent/closure with synthetic inline image payloads, and manual photo upload should still be checked in Chrome.

## Historical Milestone 9 Validation

This earlier local gate ran after adding the release documentation set, docs-readiness test, Firebase Emulator Suite rules gate, focused concurrency gate, and Playwright/axe browser gate. The latest validation is the pre-deployment closeout gate above and below:

- `npm ci`: passed in about 2 minutes; 880 packages installed and 881 audited. Install audit reported 3 moderate dev-dependency vulnerabilities; production dependency audit remained clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (12 test files passed, 2 emulator-only files skipped by default; 57 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size and `src/services/issues.ts` mixed import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 file, 3 tests) against Firestore/Storage emulators.
- `npm run test:concurrency`: passed (1 file, 4 tests) against the Firestore emulator.
- `npm run test:e2e`: passed (4 Playwright/Chromium tests) against Auth/Firestore/Storage emulators.
- Local production start probe: `/health` returned 200; `/readyz` returned 503 because `GEMINI_API_KEY` was missing in the local production environment.
- Placeholder/secret scan: release-facing docs and `.env.example` did not contain fake key values or pending license/attribution copy.
- Stale-source scan: browser-authored resolution-plan/privileged-trace patterns were absent from implementation code; matches remained only in negative test assertions.

## Pre-Deployment Closeout Validation

This final local gate ran after the environment-driven Admin config, Firebase web config resolver, App Check header path, Docker/Cloud Build support, docs updates, E2E demo-project cleanup, and stale client demo seed/clear removal:

- `npm ci`: passed; 880 packages installed and 881 audited. Install audit reported 3 moderate dev-dependency vulnerabilities; production dependency audit remained clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (15 files passed, 2 emulator-only files skipped; 71 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size and `src/services/issues.ts` mixed import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 file, 3 tests) against Firestore/Storage emulators.
- `npm run test:concurrency`: passed (1 file, 4 tests) against the Firestore emulator.
- `npm run test:e2e`: passed (4 Playwright/Chromium tests) against `demo-civiclens` Auth/Firestore/Storage emulators.
- Local production start probe: `/health` returned 200; `/readyz` returned 503 because production secrets/config were intentionally absent.
- Unsupported-copy/config scan: no implementation hits remained for the removed government-adjacent initiative phrase, old hardcoded Admin project/database IDs, or old client-side issue seed/clear write helpers; matches remain only in regression tests or explicitly synthetic server demo markers.

Cloud Run deployment and public URL smoke testing were performed after explicit approval. Google Doc publication, demo video publication, final public screenshot packaging, and hackathon submission were not performed.

# Final Evidence Report

Generated during the local CivicLens rebuild on 2026-06-26.

## Scope

This report records local validation and readiness evidence. It does not claim public deployment, public GitHub availability, public Google Doc publication, demo video publication, or hackathon submission.

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
- `docs/CODEX_MASTER_PLAN.md` is updated as the final release checklist. Locally verifiable items are checked. The only unchecked items are deployed smoke testing, real screenshot capture, and public URL/evidence recording, each blocked on external credentials/account actions and explicit approval.

## Latest Completed Validation

Pre-deployment closeout validation results:

- `npm ci`: passed in about 1 minute; 880 packages installed and 881 audited. The install audit reported 3 moderate dev-dependency vulnerabilities; the production audit below is clean. Warnings: deprecated `json-ptr@3.1.1`, `node-domexception@1.0.0`, and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (15 test files passed, 2 emulator-only files skipped by default; 71 tests passed, 7 skipped).
- `npm run build`: passed. Warnings remain: Firebase chunk is larger than 500 kB (`assets/firebase-Ct40zCNZ.js`, 718.27 kB / 179.73 kB gzip), and `src/services/issues.ts` is still both dynamically and statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 emulator rules test file, 3 tests) against the Firebase Firestore and Storage emulators. Expected deny-rule warnings appeared for negative cases.
- `npm run test:concurrency`: passed (1 Firestore emulator test file, 4 tests). Expected duplicate/conflict warnings appeared for intentionally raced writes.
- `npm run test:e2e`: passed (4 Playwright/Chromium tests) against `demo-civiclens` Auth/Firestore/Storage emulators and the Vite dev server; the run checks mobile, tablet, desktop, synthetic demo operator queue, horizontal overflow, and axe serious/critical accessibility violations.
- Local production start probe: `node dist/server.cjs` started with `NODE_ENV=production`, `PORT=3199`, `FIREBASE_PROJECT_ID=demo-civiclens`, `FIRESTORE_DATABASE_ID=(default)`, and no secrets. `GET /health` returned 200. `GET /readyz` returned 503 because production secrets/config were intentionally absent.

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

- Firebase/GCP credentials and billing are required before Cloud Run deployment.
- Explicit user approval is required before deployment, public URL publication, demo video publication, Google Doc publication, or hackathon submission.
- Real screenshots are not present because no approved AI Studio/GCP/deployment account action was performed in this local rebuild.
- Public app URL: not created in this local rebuild.
- Public GitHub URL: not provided in this local rebuild.
- Public Google Doc URL: not created in this local rebuild.
- Demo video URL: not created in this local rebuild.

## Remaining Local Gaps

- Transaction/concurrency behavior has focused parallel emulator coverage for support, verification, duplicate evidence, and status-transition writes; a full API-level race matrix remains future hardening.
- Browser E2E uses seeded synthetic emulator data; a live Gemini/Maps golden path still requires real production secrets and deployment approval.
- Local production `/readyz` fails without production secrets, as expected. Cloud Run `/readyz` has not been smoke-tested in a deployed environment.
- Production App Check enforcement has not been deployed or smoke-tested. Keep `CIVICLENS_REQUIRE_APP_CHECK=false` until a Firebase App Check site key is configured and browser requests are verified to send `X-Firebase-AppCheck`.

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

No deployment, public URL smoke test, Google Doc publication, demo video publication, or hackathon submission was performed.

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

## Latest Completed Validation

Milestone 9 validation results:

- `npm ci`: passed in about 1 minute; 880 packages installed and 881 audited. The install audit reported 3 moderate dev-dependency vulnerabilities; the production audit below is clean. Warnings: deprecated `json-ptr@3.1.1`, `node-domexception@1.0.0`, and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (12 test files passed, 1 emulator-only file skipped by default; 55 tests passed, 3 skipped).
- `npm run build`: passed. Warnings remain: Firebase chunk is larger than 500 kB (`assets/firebase-DO9hihec.js`, 717.41 kB / 179.53 kB gzip), and `src/services/issues.ts` is still both dynamically and statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 emulator rules test file, 3 tests) against the Firebase Firestore and Storage emulators.
- `npm run test:e2e`: passed (4 Playwright/Chromium tests) against Firebase emulators and the Vite dev server; the run checks mobile, tablet, desktop, synthetic demo operator queue, horizontal overflow, and axe serious/critical accessibility violations.
- Local production start probe: `node dist/server.cjs` started with `NODE_ENV=production` and `PORT=3101`; `GET /health` returned 200. `GET /readyz` returned 503 because `GEMINI_API_KEY` was not set; startup warnings also noted empty `CIVICLENS_OPERATOR_EMAILS` and missing server-side `GOOGLE_MAPS_PLATFORM_KEY`.

## Local Release Evidence

- Truth boundary docs and copy are present.
- Server API perimeter verifies Firebase identity and App Check or local-only bypass.
- Firestore issue-owned writes are server-owned.
- Storage Rules restrict owner paths, image MIME types, and file size.
- Agent runs are persisted as server-authored `agentRuns` and `agentSteps`.
- Operator lifecycle decisions require server-authorized identity and rationale.
- Dashboard metrics separate real records from synthetic demo data.
- Responsive shell replaces the fake phone frame.
- Release-gate source tests cover named security, rules, lifecycle, agent, and UI golden-path cases.
- Firebase Emulator Suite tests execute the deployed Firestore and Storage rule files for representative allow/deny cases.
- Playwright/axe browser tests execute responsive landing and synthetic demo operator flows at mobile, tablet, and desktop sizes.
- License, attribution, architecture, deployment, AI Studio evidence, demo script, Google Doc draft, and final evidence docs are present.
- The built server starts locally in production mode and serves `/health`; full readiness remains gated by real production secrets.

## External Blockers

- Firebase/GCP credentials and billing are required before Cloud Run deployment.
- Explicit user approval is required before deployment, public URL publication, demo video publication, Google Doc publication, or hackathon submission.
- Public app URL: not created in this local rebuild.
- Public GitHub URL: not provided in this local rebuild.
- Public Google Doc URL: not created in this local rebuild.
- Demo video URL: not created in this local rebuild.

## Remaining Local Gaps

- Transaction/concurrency behavior is covered by source/idempotency tests but is not yet race-tested with a parallel emulator harness.
- Browser E2E uses seeded synthetic emulator data; a live Gemini/Maps golden path still requires real production secrets and deployment approval.
- Local production `/readyz` fails without production secrets, as expected. Cloud Run `/readyz` has not been smoke-tested in a deployed environment.

## Milestone 9 Validation

The final local gate ran after adding the release documentation set, docs-readiness test, Firebase Emulator Suite rules gate, and Playwright/axe browser gate:

- `npm ci`: passed in about 1 minute; 880 packages installed and 881 audited. Install audit reported 3 moderate dev-dependency vulnerabilities; production dependency audit remained clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (12 test files passed, 1 emulator-only file skipped by default; 55 tests passed, 3 skipped).
- `npm run build`: passed with the known Firebase chunk-size and `src/services/issues.ts` mixed import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 file, 3 tests) against Firestore/Storage emulators.
- `npm run test:e2e`: passed (4 Playwright/Chromium tests) against Auth/Firestore/Storage emulators.
- Local production start probe: `/health` returned 200; `/readyz` returned 503 because `GEMINI_API_KEY` was missing in the local production environment.

No deployment, public URL smoke test, Google Doc publication, demo video publication, or hackathon submission was performed.

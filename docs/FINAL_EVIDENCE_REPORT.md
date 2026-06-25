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

- `npm ci`: passed in 44 seconds; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (12 test files, 55 tests).
- `npm run build`: passed. Warnings remain: Firebase chunk is larger than 500 kB (`assets/firebase-DfUh0SdN.js`, 716.39 kB / 179.17 kB gzip), and `src/services/issues.ts` is still both dynamically and statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
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

- Firestore and Storage Rules are not yet executed in Emulator Suite tests.
- Transaction/concurrency behavior is not yet race-tested with emulators.
- Browser E2E and automated accessibility tests are not wired.
- Local production `/readyz` fails without production secrets, as expected. Cloud Run `/readyz` has not been smoke-tested in a deployed environment.

## Milestone 9 Validation

The final local gate ran after adding the release documentation set and docs-readiness test:

- `npm ci`: passed in 44 seconds; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (12 test files, 55 tests).
- `npm run build`: passed with the known Firebase chunk-size and `src/services/issues.ts` mixed import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- Local production start probe: `/health` returned 200; `/readyz` returned 503 because `GEMINI_API_KEY` was missing in the local production environment.

No deployment, public URL smoke test, Google Doc publication, demo video publication, or hackathon submission was performed.

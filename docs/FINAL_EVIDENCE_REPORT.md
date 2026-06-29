# CivicLens Final Evidence Report

Date: 2026-06-28

## Current Public Deployment

- Project: `gen-lang-client-0871796745`
- Region: `asia-southeast1`
- Cloud Run service: `civiclens`
- Active revision: `civiclens-00047-5kr`
- Traffic: 100 percent to `civiclens-00047-5kr`
- Public URL: https://civiclens-py7ixxgroq-as.a.run.app
- Alternate URL: https://civiclens-802067002365.asia-southeast1.run.app
- Runtime source commit: `68e9787`
- Repository evidence commit: recorded in the final response after the safe public-tree cleanup commit is pushed.

## Health Checks

- `/health`: HTTP 200, `status: ok`, service `civiclens`, mode `production`.
- `/readyz`: HTTP 200, `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`.
- Expected readiness warning: `CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled.`

App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.

## Evidence Captured

Public app and sanitized infrastructure evidence is stored under `docs/evidence/final/`. The current judge-facing evidence package is centered on:

- `PLACES-AUTH-HINDI-2026-06-28-MANIFEST.json`
- `FLOW-BOUNDARY-2026-06-28-MANIFEST.json`
- `FINAL-HARDENING-2026-06-28-MANIFEST.json`
- `SANITIZED_GCP_FIREBASE_EVIDENCE-2026-06-27.json`

Representative screenshots cover:

- Homepage and responsive layout.
- Sticky header and mobile bottom navigation.
- Profile menu with Google sign-in and language controls.
- Hindi report flow.
- Camera and gallery upload choices.
- Google Places autocomplete.
- Gemini triage or low-confidence clarification.
- Waffle/non-civic low-confidence guardrail.
- Saved issue detail.
- Persisted agent trace after refresh.
- Demo operator workspace and tool steps.
- Public issue detail with read-only persisted evidence.
- Operator rationale requirement.

Screenshots and infrastructure evidence must be reviewed before any future publication to ensure they do not expose secret values, tokens, private emails, billing information, or hidden sensitive data.

## Google Technologies Evidence

- Google AI Studio is recorded as the Gemini development/provenance environment.
- Gemini via `@google/genai` powers multimodal triage, structured output, translation support, duplicate comparison support, draft resolution planning, closure image assessment, and server-side tool workflow.
- Firebase Auth supports anonymous citizen sessions and visible Google sign-in entry points.
- Firestore stores issue lifecycle data, support/verification records, approvals, activity, `agentRuns`, and `agentSteps`.
- Firebase Storage stores report, evidence, and closure images behind Storage Rules.
- Firebase Admin SDK owns privileged writes, transactions, role checks, counters, and lifecycle transitions.
- Google Maps Platform renders the map and Places autocomplete for manual location search.
- Secret Manager stores runtime Gemini configuration for Cloud Run without committing secret values.
- Cloud Run hosts the public service; Cloud Build and Artifact Registry support deployment.

## Public Flow Evidence

Recorded evidence supports:

- Desktop, tablet, mobile, and narrow-mobile responsive checks.
- Header subtitle visible and sticky while scrolling.
- Mobile bottom navigation fixed.
- Map visible.
- Camera and gallery upload controls separated.
- Gallery upload accepts image evidence without a capture attribute.
- Live-photo upload accepts image evidence with environment capture.
- Google Places autocomplete returns live predictions for `Indiranagar Metro Station Bengaluru`.
- Gemini triage handles civic issue reports and low-confidence non-civic images.
- Saved issue detail opens with CivicLens Ticket ID.
- Public detail pages do not claim external agency submission.
- Persisted agent trace survives refresh where expected.
- Demo operator actions are limited to synthetic demo records.
- Demo or anonymous operator mutation is denied on real cases.
- Closure recommendation persists but does not auto-resolve.
- Hindi localization persists through refresh for the core public flow.
- Google sign-in flow starts without the previous inline configuration error; private Google-account credential completion was not performed during verification.

## Maps Key and App Check

- Maps browser key restriction is configured for the public Cloud Run origins and localhost.
- Required browser API access includes Maps and Places for the deployed flow.
- Do not restrict server-side keys as browser keys.
- App Check enforcement remains disabled for the judge-facing deployment until real App Check token delivery is verified without blocking access.

## Validation Summary

Fresh local v2 continuation baseline on 2026-06-29 from `master` at `8e94e6e`:

- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run`: passed; 18 files passed, 2 skipped; 83 tests passed, 7 skipped.
- `npm run build`: passed; Vite transformed 2141 modules, built `dist/server.cjs`, and emitted no chunk over 500 kB. Largest JS chunk was `fb-firestore` at 475.16 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.
- `npm run test:e2e`: passed; 7 Chromium Playwright tests passed against local Firebase Auth, Firestore, and Storage emulators.

Baseline notes:

- The no-attribution hygiene scan found no judged-project references to prohibited assistant/vendor attribution terms.
- The Firebase browser key was still committed at baseline and is tracked for the next hygiene fix.
- The Playwright emulator gate runs with local test config and reports expected development warnings when Gemini and Maps keys are not injected into that test process. Real Gemini/Maps checks remain part of feature-level live verification.

Phase 0.2 Firebase browser-key hygiene verification on 2026-06-30:

- `firebase-applet-config.json` is metadata-only; it no longer contains an `apiKey` field.
- Google API-key prefix scan: no matches in the repository.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src/lib/firebase-config.test.ts src/docs-readiness.test.ts`: passed; 2 files passed, 10 tests passed.
- `.\node_modules\.bin\vitest.cmd run`: passed; 18 files passed, 2 skipped; 83 tests passed, 7 skipped.
- `npm run build`: passed; Vite transformed 2141 modules and emitted no chunk over 500 kB. Largest JS chunk was `fb-firestore` at 475.16 kB.
- Local env boot proof on `http://127.0.0.1:3000`: `/readyz` returned `ready:true`, `checks.adminDb:true`, `checks.geminiConfigured:true`, and `checks.configValid:true`; `/` returned `HTTP/1.1 200 OK` and served the Vite module client.

Phase 0.4 event-spine verification on 2026-06-30:

- Server actions now write append-only event documents to top-level `events` and mirror issue-scoped events to `issues/{issueId}/events`, while preserving existing `activity` documents for the UI timeline.
- `addServerActivity` atomically records both `activity` and `events`; direct routes now record report creation, status transitions, evidence, support, verification, translations, demo seed/clear, Gemini analysis/translation/escalation/closure checks, agent runs, and worker jobs.
- Firestore Rules allow signed-in reads of issue-scoped event ledgers, deny all client writes, and keep top-level `events` server-owned.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src/server/events-spine.test.ts`: passed; 1 file passed, 3 tests passed.
- `.\node_modules\.bin\vitest.cmd run`: passed; 19 files passed, 2 skipped; 86 tests passed, 7 skipped.
- `npm run build`: passed; Vite transformed 2141 modules and emitted no chunk over 500 kB. Largest JS chunk was `fb-firestore` at 475.16 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- Live emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore,storage "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-event-spine-live.ps1"` passed and reported `EVENT_SPINE_LIVE seed=7 topEvents=7 firstEvent=demo_seeded issueEvents=1`.
- Hygiene scans after the change found no prohibited attribution terms and no Google API-key prefix matches.

Latest local validation after public documentation cleanup and current-tree internal artifact removal:

- `npm ci`: passed; install audit reported 3 moderate dev-dependency issues while production audit remained clean.
- `npm run lint`: passed.
- `npm test`: passed; 18 files passed, 2 skipped; 82 tests passed, 7 skipped.
- `npm run build`: passed with the known Firebase vendor chunk-size warning.
- `npm audit --omit=dev`: passed with 0 production vulnerabilities.
- `npm run test:rules`: passed; 3 emulator rules tests passed.
- `npm run test:concurrency`: passed; 4 emulator transaction/concurrency tests passed.
- `npm run test:e2e`: passed; 7 browser E2E tests passed against local Firebase emulators.

Live Cloud Run verification generated under ignored `qa-results/` passed:

- Desktop, tablet, mobile, and narrow-mobile homepage checks with zero app console/page errors.
- Google sign-in flow start without inline app error; no private credential entry was performed.
- Hindi persistence across refresh.
- Metrics dashboard loading with real/demo separation and honest denominator states.
- Public issue-detail read-only boundary, support control visibility, image/location/status display, and persisted server-agent evidence.
- Demo operator workspace visibility and synthetic/demo boundary.
- Anonymous/demo-header mutation denial for a real case.
- Full deployed pothole report E2E with gallery upload, Places autocomplete, Gemini triage, duplicate decision, save, issue detail, and refresh.

## Truth Boundary

CivicLens is an independent civic pilot. It is not an official government portal and does not submit complaints externally.

The app does not claim:

- Government affiliation.
- External agency acceptance.
- Automatic authority submission.
- Court-grade evidence validation.
- Permanent tamper-proof records.
- Statutory SLA enforcement.
- Automatic routing or resolution.

Gemini recommends and drafts. Human approval is required before consequential lifecycle changes.

## Current Known Gaps

- Public Google Doc body was replaced with `docs/GOOGLE_DOC_DRAFT.md`, formatted with headings/lists/links, and public text export was rechecked.
- The ignored `qa-results/final-judge-flow-report.md` and `qa-results/final-live-verification-results.json` record the final deployed verification checkpoint.
- Authenticated console screenshots for any remaining GCP/Firebase/AI Studio pages should be captured only if they can be reviewed safely for secrets and private account data.
- Hackathon submission has not been performed.

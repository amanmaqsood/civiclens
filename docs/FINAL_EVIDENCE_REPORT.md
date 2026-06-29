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

Phase 1.3 + 1.6 agent self-critique and timeout verification on 2026-06-30:

- `/api/agent/run` now runs a Gemini self-critique pass after the dynamic tool loop. The pass reviews the actual trace and Firestore-loaded issue fields, validates corrected category/severity/urgency against server enums, recomputes priority server-side, appends a persisted `self_critique` trace step, and writes `agent_self_critique_*` events.
- Agent execution now uses `AbortSignal.timeout(agentTimeoutMs)` with `CIVICLENS_AGENT_TIMEOUT_MS`, passes the signal into Gemini calls/retry sleeps, and returns HTTP 504 with `agent_run_timed_out` if the run exceeds the configured budget.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src/server/agent-workflow.test.ts src/server/events-spine.test.ts`: passed; 2 files passed, 7 tests passed.
- Real Gemini emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore,storage "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-agent-self-critique-live.ps1"` passed and reported `AGENT_SELF_CRITIQUE_LIVE steps=6 selfStepStatus=done anomaly=True critiqueEvent=agent_self_critique_corrected eventCount=4 timeoutMs=120000`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 19 files passed, 2 skipped; 87 tests passed, 7 skipped.
- `npm run build`: passed; Vite transformed 2141 modules and emitted no chunk over 500 kB. Largest JS chunk was `fb-firestore` at 475.16 kB.
- Hygiene scans after the change found no prohibited attribution terms and no Google API-key prefix matches.

Phase 2.1 SLA ladder and RTI PDF verification on 2026-06-30:

- Issues now receive a category/severity SLA policy, `slaDeadline`, and ladder due dates at report creation, demo seeding, server-generated action-packet drafting, agent-run persistence, and routing approval.
- The SLA worker now advances one idempotent stage at a time: reminder, escalation/RTI text draft, downloadable RTI PDF artifact, then first appeal draft. Each stage writes issue activity and mirrored event-spine records.
- The escalation panel now displays SLA policy/deadline status, exposes an RTI PDF download when generated, and shows the first-appeal draft only after the ladder creates it.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src/server/sla-ladder.test.ts src/server/events-spine.test.ts src/server/lifecycle.test.ts`: passed; 3 files passed, 9 tests passed.
- Live emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore,storage "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-sla-ladder-live.ps1"` passed and reported `SLA_LADDER_LIVE stage=first_appeal slaHours=18 pdfBytes=3179 eventCount=5`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 20 files passed, 2 skipped; 90 tests passed, 7 skipped.
- `npm run build`: passed; Vite transformed 2141 modules and emitted no chunk over 500 kB. Largest JS chunk was `fb-firestore` at 475.16 kB.

Phase 2.3 ghost-closure forensics verification on 2026-06-30:

- Added `POST /api/issues/:issueId/ghost-forensics`, an operator-authorized Gemini route that compares three images in order: original report, claimed closure evidence, and fresh audit evidence.
- The route writes a persisted `ghostForensics` result, records `ghost_closure_reopened` or `ghost_closure_checked` activity/events, and records an `ai_ghost_forensics` event-spine entry.
- High-confidence fake-closure findings (`reopen` with confidence >=0.65) auto-reopen a resolved issue to `in_progress`, set `verificationStatus: "ghost_closure_flagged"`, stamp `reopenedAt`, and increment `officerAccountability/{officerId}` ghost closure count and penalty points.
- Shared API body validation now treats `auditImage` and `fieldAuditImage` as image payload fields. The image loader accepts data URLs/raw base64 and only fetches remote before/closure images from Firebase Storage URLs.
- `ghostForensics` now maps into the client issue model and appears on the public issue detail page as a compact forensics card with recommendation, confidence, signals, and penalty state.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\ghost-forensics.test.ts src\server\perimeter.test.ts src\server\events-spine.test.ts src\server\release-security.test.ts`: passed; 4 files passed, 22 tests passed.
- Real Gemini emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore,storage "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-ghost-forensics-live.ps1"` passed and reported `GHOST_FORENSICS_LIVE status=in_progress recommendation=reopen confidence=1 penalty=20 eventCount=2`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 22 files passed, 3 skipped; 96 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2141 modules, emitted `dist/server.cjs` at 206.5 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB.
- Hygiene scans found no prohibited attribution terms and no Google API-key prefix matches.

Phase 3.3 semantic auto-merge-on-create verification on 2026-06-30:

- `POST /api/issues/create` now embeds the incoming report before persistence, applies a geohash-7 neighborhood prefilter, requires cosine similarity >=0.85 and distance <=50m, then transactionally either creates a new canonical case or auto-merges the report as evidence into the existing canonical case.
- Auto-merge increments canonical `reportCount`, recomputes server priority so duplicate volume affects urgency, writes durable `issueCreateResults` idempotency markers, records `dedup` metadata, and emits `auto_merged_on_create` activity/event records.
- The client create wrapper now preserves the server `autoMerged`, similarity, and distance response fields so the existing success flow can show that the report was merged into a canonical case.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src/server/semantic-auto-merge.test.ts src/server/events-spine.test.ts src/release-golden-path.test.ts`: passed; 3 files passed, 9 tests passed.
- Real Gemini embedding emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore,storage "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-semantic-auto-merge-live.ps1"` passed and reported `SEMANTIC_AUTO_MERGE_LIVE similarity=0.991 distanceM=14 reportCount=2 eventCount=1`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 21 files passed, 2 skipped; 93 tests passed, 7 skipped.
- `npm run build`: passed; Vite transformed 2141 modules and emitted no chunk over 500 kB. Largest JS chunk was `fb-firestore` at 475.16 kB.

Phase 4.1 trust economy and brigading-guard verification on 2026-06-30:

- Community verification now calculates a per-user `trustScore`, audits each confirm/dispute signal with Gemini, stores the vote's audit result and weight, and keeps raw `confirmCount`/`disputeCount` compatibility fields intact.
- Issues now maintain a public `trustConsensus` object with weighted confirm/dispute scores, collapsed-vote count, brigading-risk state, public explanation, auto-resolution threshold, and appeal status.
- Suspicious rapid low-trust vote bursts collapse to near-zero weight and emit `trust_brigading_collapsed`; high-trust weighted consensus can auto-resolve eligible `verified` or `in_progress` cases and emits `trust_consensus_resolved`.
- Auto-resolved consensus decisions are appealable through `POST /api/issues/:issueId/trust-appeal`; a successful appeal reopens the case to `in_progress`, records `trustAppeal`, and emits `trust_consensus_appealed`.
- The public issue detail verification panel now shows weighted consensus, brigading-risk status, collapsed signals, and an appeal control when applicable. The public leaderboard now includes anonymized trust score.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\trust-economy.test.ts src\server\perimeter.test.ts src\server\events-spine.test.ts src\server\release-security.test.ts`: passed; 4 files passed, 22 tests passed.
- Real Gemini emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore,storage "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-trust-economy-live.ps1"` passed and reported `TRUST_ECONOMY_LIVE status=in_progress auditModel=gemini-2.5-flash fallback=false confirmWeight=3 appeal=pending brigadeRisk=high collapsed=4`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 23 files passed, 3 skipped; 99 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2141 modules, emitted `dist/server.cjs` at 223.4 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.

Phase 4.5 multilingual voice-intake verification on 2026-06-30:

- Added `POST /api/voice-intake`, a Gemini audio route that transcribes voice evidence, detects language, translates to English, classifies category/severity/urgency, creates a report draft, and returns readback text.
- The report page now records audio with `MediaRecorder`, submits it to the server voice route, fills an English draft, surfaces transcript/translation/category confidence, and uses browser speech synthesis for readback.
- The committed fixture `tests/fixtures/voice-intake-pothole.wav` preserves a repeatable mixed Hindi/English pothole report for live emulator verification.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\voice-intake.test.ts src\server\perimeter.test.ts src\server\events-spine.test.ts`: passed; 3 files passed, 13 tests passed.
- Real Gemini emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-voice-intake-live.ps1"` passed and reported `VOICE_INTAKE_LIVE category=pothole language=hi transcriptChars=155 readbackChars=124 fallback=false eventCount=1`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 24 files passed, 3 skipped; 102 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2141 modules, emitted `dist/server.cjs` at 229.8 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.

Phase 4.6 citizen accountability-ledger verification on 2026-06-30:

- Added a typed `CivicEvent` client model and `fetchIssueEvents(issueId)`, which reads the server-owned `issues/{issueId}/events` mirror ordered by timestamp.
- Added the public `AccountabilityLedger` panel on issue detail pages with loading/error/empty states, actor/source/status labeling, compact event cards, and a tabular fallback.
- The ledger remains read-only for clients: issue-scoped events are signed-in readable through Firestore Rules, while client create/update/delete and top-level event access remain denied.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\accountability-ledger.test.ts src\server\events-spine.test.ts src\emulator-rules.test.ts`: passed; 2 files passed and 1 skipped outside emulator; 6 tests passed and 3 skipped.
- Browser/emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-accountability-ledger-live.ps1"` passed and reported `ACCOUNTABILITY_LEDGER_LIVE issueId=ledgerlive1782766385642 eventCount=1 firstEvent=created source=api rendered=true tableRows=1`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 25 files passed, 3 skipped; 105 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2142 modules, emitted `dist/server.cjs` at 229.8 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.

Phase 5.1 + 5.5 dark mode and celebration-removal verification on 2026-06-30:

- The app now has a persistent `ThemeProvider` with a header icon toggle, stored `civiclens-theme` preference, system dark-mode default, root `dark` class, `data-theme`, and browser `color-scheme`.
- The stylesheet now exposes semantic surface/text/border/focus tokens and dark overrides for the existing utility classes, including formerly white cards, app paper surfaces, borders, inputs, and Places autocomplete.
- Operator status resolution no longer triggers confetti, and `canvas-confetti` plus its type package were removed from the dependency graph.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\ux-redesign.test.ts src\docs-readiness.test.ts`: passed; 2 files passed, 13 tests passed.
- Live browser proof: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dark-mode-live.ps1` passed and reported `DARK_MODE_LIVE theme=dark stored=dark cardBg='rgb(14, 26, 43)' axeSeriousCritical=0 consoleErrors=0 pageErrors=0`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 21 files passed, 2 skipped; 93 tests passed, 7 skipped.
- `npm run build`: passed; Vite transformed 2141 modules, emitted the dark-mode CSS bundle at 62.69 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB.
- Hygiene scans found no prohibited attribution terms and no Google API-key prefix matches. `rg -n "confetti|canvas-confetti" src package.json package-lock.json` found only the UX contract assertion that `OperatorDetailView` does not contain `confetti`; `npm ls canvas-confetti @types/canvas-confetti` reported an empty dependency tree.

Phase 5.2 D3 impact-dashboard rebuild verification on 2026-06-30:

- `ImpactDashboard` now computes public and agency analytics from persisted real/demo `IssueReport` data only, preserving the real/demo scope split and empty "Not enough data" states.
- The public dashboard includes a KPI row with tabular numerals, seven-day deltas, SVG sparklines, a D3 severity-weighted geospatial heatmap with native SVG tooltips, a visible heatmap table fallback, and a live activity feed.
- The agency dashboard includes response-time distribution bars, status/category queues, SLA and duplicate signals, and a table fallback for assistive technology and non-visual review.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\dashboard-redesign.test.ts src\reliability-performance.test.ts src\release-golden-path.test.ts src\server\trust-economy.test.ts`: passed; 4 files passed, 13 tests passed.
- Browser/emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-dashboard-redesign-live.ps1"` passed and reported `DASHBOARD_REDESIGN_LIVE kpis=4 sparklines=12 heatCells=16 responseBars=4 agencyRows=4 axeSeriousCritical=0`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 26 files passed, 3 skipped; 108 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2339 modules, emitted `dist/server.cjs` at 229.8 kB, emitted the `ImpactDashboard` chunk at 47.05 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.

Phase 5.3 + 5.4 lifecycle status and WCAG state-coverage verification on 2026-06-30:

- Added a shared lifecycle status system with token-backed status labels, descriptions, icon mapping, accessible `aria-label`/`title` text, and icon+label badges for `submitted`, `verified`, `in_progress`, and `resolved`.
- Public issue lists, operator queues, issue detail, operator detail, accountability ledger, verification consensus, priority breakdown, and dashboard status distributions now use contrast-safe lifecycle/status ink tokens instead of low-contrast status text or color-only status cues.
- Dashboard lifecycle distribution now uses status-specific tokenized bars and badge labels; issue-detail progress rails now expose lifecycle icons with label text and do not rely on color alone.
- The live verifier seeds all four lifecycle statuses into the Firestore emulator, opens report/detail/dashboard in Chromium, checks badge/icon counts, and runs `axe-core` WCAG 2.2 AA checks on all three surfaces.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\lifecycle-accessibility.test.ts src\ux-redesign.test.ts src\server\dashboard-redesign.test.ts`: passed; 3 files passed, 14 tests passed.
- Browser/emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-lifecycle-accessibility-live.ps1"` passed and reported `LIFECYCLE_A11Y_LIVE reportAxe=0 detailAxe=0 dashboardAxe=0 detailBadges=1 dashboardBadges=4 badgeIcons=5 stepIcons=1`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 27 files passed, 3 skipped; 111 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2340 modules, emitted `dist/server.cjs` at 229.8 kB, emitted the `ImpactDashboard` chunk at 46.93 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB with no chunk over 500 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.
- `npm run test:e2e`: passed; 7 Chromium Playwright tests passed against local Firebase Auth, Firestore, and Storage emulators.
- `.\node_modules\.bin\vitest.cmd run src\docs-readiness.test.ts`: passed; 1 file passed, 5 tests passed.
- Hygiene scans found no prohibited attribution terms and no Google API-key prefix matches. `git diff --check` returned only line-ending normalization warnings, and the temporary lifecycle verifier script was removed after the live run.

Phase 6.1 behavioral API test verification on 2026-06-30:

- Added `npm run test:behavioral-api`, which starts Firebase Auth/Firestore/Storage emulators, launches the local app server, and runs `src/server/behavioral-api.test.ts` against real HTTP endpoints.
- The behavioral suite covers the API auth matrix: App Check denial, Firebase-auth denial behind local App Check bypass, secret-only scheduled-worker authorization, citizen job denial, and demo-operator denial on a real non-demo case.
- `/api/jobs/run` now honors a configured `x-civiclens-job-secret` before App Check and actor attachment, so Cloud Scheduler-style calls can reach the worker route without a browser App Check token or Firebase ID token. The route marks the response with `X-CivicLens-AppCheck: job-secret`.
- The behavioral suite also verifies SLA worker idempotency by advancing reminder -> escalation -> RTI PDF -> first appeal once, then proving a fifth run skips without duplicate issue events.
- The semantic dedup test creates a real API issue, calls `/api/dedup/semantic`, verifies a nearby same-meaning report is returned above threshold within 50m, and verifies the same text far away is not returned as a duplicate.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `npm run test:behavioral-api`: passed; 1 file passed, 3 tests passed; runner reported `BEHAVIORAL_API_TESTS passed authz=ok workerIdempotency=ok semanticDedup=ok`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 21 files passed, 3 skipped; 93 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2141 modules, emitted `dist/server.cjs` at 197.1 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.
- Hygiene scans found no prohibited attribution terms and no Google API-key prefix matches.

Phase 6.2 distributed quota verification on 2026-06-30:

- API quotas now use Firestore-backed fixed-window buckets by default, with hashed quota keys, transactionally incremented counters, shared Cloud Run instance behavior, and explicit `X-RateLimit-Backend` response headers.
- Quota limits/windows are configurable through `CIVICLENS_SESSION_QUOTA_*`, `CIVICLENS_GEMINI_QUOTA_*`, and `CIVICLENS_MUTATION_QUOTA_*`; `CIVICLENS_QUOTA_COLLECTION` controls the Firestore bucket collection.
- Production fails closed with HTTP 503 if Firestore quota enforcement is unavailable. Development can fall back to process-local memory, and `CIVICLENS_QUOTA_BACKEND=memory` is documented as local-only.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\perimeter.test.ts src\server\release-security.test.ts src\docs-readiness.test.ts`: passed; 3 files passed, 22 tests passed.
- Firestore emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-distributed-quota-live.ps1"` passed and reported `DISTRIBUTED_QUOTA_LIVE statuses=200,200,429 backend=firestore count=3 bucketDocs=1 remaining=0`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 27 files passed, 3 skipped; 112 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2340 modules, emitted `dist/server.cjs` at 233.5 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB with no chunk over 500 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.
- `npm run test:e2e`: passed; 7 Chromium Playwright tests passed against local Firebase Auth, Firestore, and Storage emulators.
- Hygiene scans found no prohibited attribution terms and no Google API-key prefix matches. `git diff --check` returned only line-ending normalization warnings, and generated distributed-quota verifier logs were removed before commit.

Phase 6.3 observability and grounding-citation verification on 2026-06-30:

- Structured logs now include Cloud Logging-ready `api_request`, `gemini_call_completed`, `gemini_call_failed`, `gemini_retry`, `agent_run_metric`, and `observability_snapshot` events.
- Gemini completion logs include model, API surface, duration, attempts, retry state, Google Search grounding flag, structured-response flag, token counts, redacted errors, and configurable estimated USD cost.
- Agent-run metrics aggregate per-run Gemini call count, token totals, estimated cost, step count, duration, timeout, duplicate state, actor role, and failure/timeout errors.
- Added operator-only `GET /api/ops/observability?hours=24` with recent event aggregates, recent agent-run aggregates, Cloud Logging query templates, and the dashboard template path.
- Added `docs/OBSERVABILITY.md` plus `docs/monitoring/civiclens-cloud-monitoring-dashboard.json` with query panels for API requests, Gemini calls, agent runs, operational snapshots, and Gemini usage/cost.
- Resolution-plan citations now normalize `generateContent` grounding chunks; when those chunks are absent, a narrow Interactions API Google Search call extracts `url_citation` annotations into the same `groundingSources` UI model.
- Operator detail now mounts `ResolutionPlanWidget`, and the widget renders visible grounding source cards with source count, title/domain, claim, `sourced`/`estimated` label, and accessible external links.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\observability-citations.test.ts src\docs-readiness.test.ts src\server\release-security.test.ts`: passed; 3 files passed, 18 tests passed.
- Real Gemini/Search emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-observability-citations-live.ps1"` passed and reported `OBSERVABILITY_CITATIONS_LIVE issueId=obscite1782771609659 events=2 realGroundingSources=3 citationLinks=4 monitoringQueries=4 consoleErrors=0`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 28 files passed, 3 skipped; 116 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2341 modules, emitted `dist/server.cjs` at 250.4 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB with no chunk over 500 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.
- `npm run test:e2e`: passed; 7 Chromium Playwright tests passed against local Firebase Auth, Firestore, and Storage emulators.
- Hygiene scans found no prohibited attribution terms and no Google API-key prefix matches. `git diff --check` returned only line-ending normalization warnings, and generated observability verifier logs were removed before commit.

Phase 6.4 deploy-smoke automation verification on 2026-06-30:

- Added a job-secret protected `POST /api/smoke/deploy` endpoint that runs a readiness check, Firebase Admin Auth `listUsers(1)`, a real Gemini structured JSON call with usage/cost accounting, and a live Google Maps Platform call.
- The Maps smoke prefers the Places autocomplete web-service endpoint. If the available key is HTTP-referrer restricted, it falls back to loading the Maps JavaScript endpoint with `libraries=places` and the configured `APP_URL` referrer.
- Added `scripts/deploy-smoke.ps1`, `npm run smoke:deploy`, and `scripts/verify-deploy-smoke-live.ps1`. The script waits on `/readyz`, calls `/api/smoke/deploy`, fails closed on any service failure, and prints one secret-free `DEPLOY_SMOKE_LIVE` proof line.
- Deployment docs now require the automated smoke before release-ready status and document `CIVICLENS_DEPLOY_SMOKE_URL`, `CIVICLENS_JOB_SECRET`, and the expected proof format.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\deploy-smoke.test.ts src\server\perimeter.test.ts src\server\release-security.test.ts src\docs-readiness.test.ts`: passed; 4 files passed, 25 tests passed.
- Real Gemini/Maps/Auth emulator proof: `firebase emulators:exec --project demo-civiclens --only auth,firestore "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-deploy-smoke-live.ps1"` passed and reported `DEPLOY_SMOKE_LIVE url=http://127.0.0.1:3025 ready=ready auth=ok gemini=ok maps=OK mapsApi=maps-javascript-places-bootstrap geminiTokens=97 mapsPredictions=0 durationMs=3042`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 29 files passed, 3 skipped; 119 tests passed, 10 skipped.
- `npm run build`: passed; Vite transformed 2341 modules, emitted `dist/server.cjs` at 258.0 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB with no chunk over 500 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.
- `npm run test:e2e`: passed; 7 Chromium Playwright tests passed against local Firebase Auth, Firestore, and Storage emulators.
- Hygiene scans found no prohibited attribution terms and no Google API-key prefix matches. `git diff --check` returned only line-ending normalization warnings, and deploy-smoke temp logs were removed before commit.

Phase 1.1/1.2 explicit planner and real agent tools closeout on 2026-06-30:

- `/api/agent/run` now starts with a real Gemini JSON planner step. The persisted `agent.planner` step stores planned tools, rationale, deterministic priority context, planner model, retry state, and duration.
- The agent run and issue documents both persist the planner output (`run.planner`, `issue.agentPlan`), including conditional steps such as `propose_merge` only after confident duplicate evidence.
- The function-calling loop now executes every function call returned in a Gemini turn instead of only the first call, so independent tool calls can be batched while still producing separate persisted steps.
- `calculate_priority` is no longer exposed as a callable tool. The server computes the deterministic priority breakdown from canonical issue data and server-loaded candidates, then passes it to Gemini as context.
- `compare_candidate_evidence` now performs server-side duplicate work with Gemini embeddings, geospatial thresholds, and optional Gemini vision comparison when both evidence images are available.
- Added `propose_merge`, which writes a pending human-approved merge proposal, plus `POST /api/issues/:issueId/merge-proposals/:proposalId/approve` to execute the merge transactionally by adding evidence to the canonical case and marking the source case merged/resolved.
- `find_responsible_authority` still uses Gemini + Google Search grounding, then validates the suggestion against a small jurisdiction registry before persisting the authority/channel/SLA fields.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\agent-workflow.test.ts`: passed; 1 file passed, 4 tests passed.
- Real Gemini planner emulator proof: `npm run test:agent-planner` passed and reported `AGENT_PLANNER_LIVE issueId=8zqA4OqEQtcOoX6i21St runId=8zqA4OqEQtcOoX6i21St_planner_live_1782776670021 plannerModel=gemini-2.5-flash plannedTools=4 persistedSteps=6 plannerStep=done planPersisted=True calculateToolSteps=0 eventPlanCreated=True`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 29 files passed, 4 skipped; 119 tests passed, 11 skipped.
- `npm run build`: passed; Vite transformed 2341 modules, emitted `dist/server.cjs` at 285.5 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB with no chunk over 500 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.
- `npm run test:e2e`: passed; 7 Chromium Playwright tests passed against local Firebase Auth, Firestore, and Storage emulators.

Phase 6.5 final golden-path verification on 2026-06-30:

- Added `npm run test:golden-path`, `scripts/verify-final-golden-path-live.ps1`, and a gated live Vitest verifier that starts the app under Firebase Auth/Firestore/Storage emulators with real Gemini and a local authority webhook sink.
- The verifier drives the full civic chain over real HTTP: photo triage -> create report -> semantic auto-merge -> operator status/routing approval -> Gemini escalation/RTI draft -> webhook dispatch -> Gemini closure verification -> ghost-closure reopen -> final closure -> predictive worker -> leaderboard/dashboard data -> Open311 single and bulk export.
- The shared API body-size validator now treats `closureAfterImage` as an image payload field, matching the ghost-forensics route contract found by the final verifier.
- `.\node_modules\.bin\tsc.cmd --noEmit`: passed with 0 errors.
- `.\node_modules\.bin\vitest.cmd run src\server\final-golden-path-live.test.ts src\server\ghost-forensics.test.ts`: passed in normal gated mode; 1 file passed, 1 skipped; 3 tests passed, 1 skipped.
- Full live emulator proof: `npm run test:golden-path` passed; 1 live file passed, 1 test passed; proof line `FINAL_GOLDEN_PATH_LIVE issueId=golden_1782773420223_wtjgax_base merged=true similarity=0.943 dispatch=delivered ghostReopened=true finalStatus=resolved open311=1 predictive=predict webhookDeliveries=1 events=17 geminiEvents=5`.
- `.\node_modules\.bin\vitest.cmd run`: passed; 29 files passed, 4 skipped; 119 tests passed, 11 skipped.
- `npm run build`: passed; Vite transformed 2341 modules, emitted `dist/server.cjs` at 258.0 kB, and kept the largest JS chunk at `fb-firestore` 475.16 kB with no chunk over 500 kB.
- `npm run test:rules`: passed; 1 emulator rules file passed, 3 tests passed.
- `npm run test:concurrency`: passed; 1 emulator concurrency file passed, 4 tests passed.
- `npm run test:e2e`: passed; 7 Chromium Playwright tests passed against local Firebase Auth, Firestore, and Storage emulators.

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

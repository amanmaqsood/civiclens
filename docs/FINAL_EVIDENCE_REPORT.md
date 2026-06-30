# CivicLens Final Evidence Report

Date: 2026-06-30

## Current Public Deployment

- Project: `gen-lang-client-0871796745`
- Region: `asia-southeast1`
- Cloud Run service: `civiclens`
- Active revision: `civiclens-00059-245`
- Traffic: 100 percent to `civiclens-00059-245`
- Public URL: https://civiclens-py7ixxgroq-as.a.run.app
- Alternate URL: https://civiclens-802067002365.asia-southeast1.run.app
- Runtime source: `main@d277989`
- Runtime image: `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:d277989-public-20260630124658`
- Firestore database for final public demo: `(default)`
- Firestore rules: released to `cloud.firestore` / `(default)` with ruleset `c90c68f8-b31e-4e8a-ae4a-4c0cb761cd37`

Important deploy note: the earlier AI Studio Firestore database hit free read quota exhaustion during public testing. The final public image was rebuilt with `VITE_FIRESTORE_DATABASE_ID=(default)` and the Cloud Run server was pointed to `FIRESTORE_DATABASE_ID=(default)`. The final public demo uses `CIVICLENS_QUOTA_BACKEND=memory` and relaxed App Check for judge access; Firestore-backed distributed quotas remain implemented and emulator-verified.

## Final Score

- Evidence-based score before the final public retest: **96/100**.
- Evidence-based score after the final public retest: **97/100**.

Remaining deductions: public-demo App Check/quota posture, final submission/video handoff, and current Gemini spend-cap exhaustion. Core product flows were verified green, but the live app should not be submitted until the AI Studio monthly spend cap is raised and the deep Gemini-heavy verifier is rerun green.

## Health And Smoke

- `/readyz`: HTTP 200, `ready=true`, `adminDb=true`, `geminiConfigured=true`, `configValid=true`.
- Public deploy smoke: `DEPLOY_SMOKE_LIVE url=https://civiclens-py7ixxgroq-as.a.run.app ready=ready auth=ok gemini=ok maps=OK mapsApi=maps-javascript-places-bootstrap geminiTokens=32 mapsPredictions=0 durationMs=1770`.
- Public model-tier smoke: Flash-Lite, Flash, Pro, and `gemini-embedding-001` passed.
- Public JS bundle was rebuilt with emulator mode false and active Firestore database `(default)`.

## Live Headed Evidence

Broad headed verifier:

- Script: `scripts/verify-public-headed-phase-status.mjs`
- Evidence JSON: `qa-results/headed-phase-0-6/public-headed-phase-status.json`
- Result: every check PASS.
- Browser cleanliness: `consoleErrors=0`, `pageErrors=0`, `server5xx=0`.

Deep phase-gap verifier:

- Script: `scripts/verify-public-phase-gaps-headed.mjs`
- Evidence JSON: `qa-results/public-phase-gaps/public-phase-gaps-headed.json`
- Current result: blocked by Gemini API spend cap after repeated public verification runs.
- Current non-pass checks: `phase4.5.voice-intake-live`, `phase2.3.ghost-forensics-live`, and the headed voice run wrapper.
- Cloud Run log proof: Gemini returned HTTP 429 `RESOURCE_EXHAUSTED` with "project has exceeded its monthly spending cap".
- Non-Gemini and deterministic branches still passed, including dispatch, grounding, weekly/streak leaderboard, manual merge, SLA/follow-up/RTI, observability, and dashboard rendering.

## Public Flow Proof

- Desktop app booted and main content rendered.
- Account menu, anonymous session, demo operator status, language controls, and Google sign-in entry rendered.
- Dark mode toggled and persisted after reload.
- Dashboard rendered KPI row even for empty scopes, Open311 export, predictive insights, and community leaderboard.
- Open311 export returned HTTP 200, `format=open311-georeport-v2`, `count=25`.
- Operator synthetic desk rendered demo guardrails, agent ledger, and run-agent button path.
- Mobile report flow uploaded the sample image, previewed evidence, used manual pin fallback, and accepted description.
- Public report analysis produced a real Gemini draft.
- Semantic duplicate detection produced a duplicate decision.
- Duplicate evidence-link finalization completed successfully.

## Phase-Gap Proof

- Voice intake: previously passed live Gemini audio verification; current final rerun is blocked by Gemini spend-cap exhaustion and falls back to typed confirmation.
- Ghost forensics: previously passed live verification; current final rerun is blocked by Gemini spend-cap exhaustion and returns 500.
- Trust economy: weighted consensus, appeal, high brigading risk, and collapsed low-trust votes passed live and rendered in headed detail pages.
- SLA/follow-up/RTI: ladder advanced to `first_appeal`, follow-up returned `wait`, RTI PDF was generated, and public detail rendered the ledger/timeline.
- Dispatch: harmless outbound dispatch delivered to `postman-echo.com`, HTTP 200.
- Predictive worker: currently serves deterministic fallback with 3 hotspots while Gemini is spend-cap blocked; prior Gemini Flash run returned 3 hotspots.
- Keyless grounding: live grounding included `nominatim-osm`, `firestore-history`, and `open-meteo`.
- Weekly/streak gamification: live leaderboard returned `week=2026-W27`, `topWeekly=10`, `streak=1`.
- Manual merge approval: source case marked merged and target report count increased.
- Observability: API returned `events=250` and 4 Cloud Logging query templates.

## Local Verification

Final completed checks:

- `npx tsc --noEmit`: passed.
- Focused regressions: `npx vitest run src/server/agent-workflow.test.ts src/server/trust-economy.test.ts src/server/observability-citations.test.ts src/lib/firebase-config.test.ts` passed; 4 files, 21 tests.
- `npm run build`: passed; largest JS chunk `fb-firestore` 474.21 kB.
- `npx vitest run`: passed; 32 files passed, 4 skipped; 131 tests passed, 11 skipped.
- `npm run test:rules`: passed; 1 file, 3 tests.
- `npm run test:concurrency`: passed; 1 file, 4 tests.
- `npm run test:behavioral-api`: passed; `authz=ok workerIdempotency=ok semanticDedup=ok`.
- `npm run test:golden-path`: passed; golden path merged duplicate evidence, delivered dispatch, reopened ghost closure, resolved final status, exported Open311, produced predictive insight, and recorded events/Gemini events.
- `npm run test:e2e`: passed; 7 Playwright release-gate tests.

Final golden-path proof:

```text
FINAL_GOLDEN_PATH_LIVE issueId=golden_1782801524438_zl0c8b_base merged=true similarity=0.985 dispatch=delivered ghostReopened=true finalStatus=resolved open311=1 predictive=predict webhookDeliveries=1 events=19 geminiEvents=5
```

## Required Submission Truth

- Public Google Doc body was replaced with `docs/GOOGLE_DOC_DRAFT.md`, formatted with headings/lists/links, and public text export was rechecked.
- Hackathon submission has not been performed.
- Demo video link can be added by the submitter if available.

## Screenshot Evidence

Broad headed screenshots:

- `qa-results/headed-phase-0-6/01-public-home-desktop.png`
- `qa-results/headed-phase-0-6/02-public-home-dark-mode.png`
- `qa-results/headed-phase-0-6/03-public-dashboard-open311.png`
- `qa-results/headed-phase-0-6/04-public-leaderboard.png`
- `qa-results/headed-phase-0-6/05-public-operator-demo-agent-ledger.png`
- `qa-results/headed-phase-0-6/05b-public-operator-agent-run-attempt.png`
- `qa-results/headed-phase-0-6/06-public-mobile-report-upload.png`
- `qa-results/headed-phase-0-6/07-public-report-gemini-draft.png`
- `qa-results/headed-phase-0-6/08-public-report-submit-result.png`
- `qa-results/headed-phase-0-6/09-public-report-duplicate-linked-result.png`

Deep gap screenshots:

- `qa-results/public-phase-gaps/01-voice-intake-headed.png`
- `qa-results/public-phase-gaps/02-ghost-forensics-detail.png`
- `qa-results/public-phase-gaps/03-trust-consensus-detail.png`
- `qa-results/public-phase-gaps/04-brigading-guard-detail.png`
- `qa-results/public-phase-gaps/05-sla-followup-dispatch-ledger.png`
- `qa-results/public-phase-gaps/06-merge-approval-ledger.png`
- `qa-results/public-phase-gaps/07-dashboard-predictive-leaderboard.png`

## Remaining Hardening

1. Raise or remove the AI Studio/Gemini monthly spending cap, then rerun the deep phase-gap headed verifier until all Gemini-heavy checks pass again.
2. Enforce App Check only after a verified judge-safe public token path exists.
3. Restore production distributed quota backend when public Firestore quota posture is ready.
4. Capture a real GCP Monitoring screenshot/export if required by submission reviewers.
5. Add the final demo video and submitter-owned hackathon submission link.

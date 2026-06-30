# CivicLens - Community Hero

**CivicLens** is a Google Cloud-deployed civic-resolution pilot for reporting, verifying, and reviewing hyperlocal community issues with Gemini-powered triage and human-governed decision checkpoints.

Live app: https://civiclens-py7ixxgroq-as.a.run.app

Submission doc: https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing

Problem statement: **Community Hero - Hyperlocal Problem Solver**

> CivicLens is an independent civic pilot. It is not an official government portal and does not submit complaints externally.

## Why It Matters

Residents often report potholes, broken streetlights, water leaks, unsafe paths, and waste issues through fragmented channels. Reports may lack clear location context, duplicate awareness, closure evidence, and public status visibility. CivicLens turns those scattered reports into a structured, evidence-led workflow that communities and reviewers can trust.

## What Judges Can Try

- Submit a civic issue with a photo, location, and description.
- Let Gemini classify, summarize, translate, and prioritize the report.
- Review nearby duplicate handling and evidence-linking.
- Open a public issue detail page with a CivicLens Ticket ID.
- Use the synthetic operator desk to inspect server-owned agent traces and human approval gates.
- Open the dashboard for Open311 export, predictive hotspots, community leaderboard, and lifecycle metrics.
- Try Hindi in the public reporting flow.

## Core Features

- **Citizen field reporting** with camera/gallery upload, manual pin fallback, Google Places autocomplete, and responsive mobile flow.
- **Gemini multimodal triage** for category, urgency, severity, confidence, rationale, and citizen-facing summary.
- **Multilingual voice intake** using Gemini transcription, translation, category extraction, and readback.
- **Semantic duplicate control** with nearby candidate detection and evidence-linking instead of duplicate ticket spam.
- **Planner-first server agent workflow** with persisted `agentRuns` and `agentSteps`; the UI renders stored server records, not scripted traces.
- **SLA and follow-up workers** for escalation ladder, follow-up decisioning, and RTI-style PDF generation.
- **Ghost-closure forensics** comparing original, claimed closure, and fresh audit evidence before recommending reopen.
- **Trust economy and brigading guard** for weighted community confirmations, appeal state, and low-trust vote collapse.
- **Predictive hotspot worker** using Gemini to forecast ward-level risk patterns.
- **Open311 GeoReport export** for municipal interoperability.
- **Real outbound dispatch path** to a configured webhook, recorded with delivery receipt.
- **Public accountability ledger** for AI, citizen, operator, worker, and lifecycle events.
- **Weekly leaderboard and streaks** for civic participation while keeping the core workflow serious.

## Human Oversight

Gemini recommends; people decide. Human approval remains required for consequential workflow changes:

- duplicate merge
- routing or action-packet approval
- escalation finalization
- resolve
- reopen

Demo operator actions are server-limited to records explicitly marked as synthetic demo data. Real operator actions require server-authorized Firebase identity.

## Google Technologies

- **Gemini via `@google/genai`**: multimodal triage, structured output, voice intake, duplicate reasoning, closure forensics, predictive insights, and server-side workflow support.
- **Google Maps Platform**: map rendering and Places autocomplete for location context.
- **Firebase Auth**: anonymous citizen sessions and Google sign-in entry point.
- **Firestore**: issues, evidence metadata, approvals, support, verification, lifecycle fields, agent traces, leaderboard state, and audit events.
- **Firebase Storage**: report, evidence, and closure image storage governed by Storage Rules.
- **Firebase Admin SDK**: privileged server writes, transactions, role checks, counters, and lifecycle transitions.
- **Secret Manager**: runtime secrets for Cloud Run without committing secret values.
- **Cloud Run**: public production deployment.
- **Cloud Build and Artifact Registry**: build and container deployment pipeline.

## Architecture

- Frontend: React, TypeScript, Vite, Tailwind CSS.
- Backend: Express TypeScript server bundled with esbuild for Cloud Run.
- Data: Firestore plus Firebase Storage, guarded by Rules and Admin SDK boundaries.
- Validation: Vitest, Firebase Emulator Suite, Playwright headed browser verification, Cloud Run smoke tests.

Key documents:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [security_spec.md](security_spec.md)
- [ATTRIBUTIONS.md](ATTRIBUTIONS.md)
- [docs/DEPLOYMENT_CLOUD_RUN.md](docs/DEPLOYMENT_CLOUD_RUN.md)
- [docs/FINAL_EVIDENCE_REPORT.md](docs/FINAL_EVIDENCE_REPORT.md)
- [docs/IMPLEMENTATION_PLAN_STATUS_2026-06-30.md](docs/IMPLEMENTATION_PLAN_STATUS_2026-06-30.md)
- [docs/HEADED_BROWSER_PHASE_0_6_REPORT_2026-06-30.md](docs/HEADED_BROWSER_PHASE_0_6_REPORT_2026-06-30.md)
- [docs/GOOGLE_DOC_DRAFT.md](docs/GOOGLE_DOC_DRAFT.md)
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)

## Verified Deployment

- Public app URL: `https://civiclens-py7ixxgroq-as.a.run.app`
- Alternate Cloud Run URL: `https://civiclens-802067002365.asia-southeast1.run.app`
- Cloud Run service: `civiclens`
- Region: `asia-southeast1`
- Active revision: `civiclens-00059-245`
- Runtime image: `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:d277989-public-20260630124658`
- Runtime app source: `main@d277989`

Latest public deploy smoke:

```text
DEPLOY_SMOKE_LIVE url=https://civiclens-py7ixxgroq-as.a.run.app ready=ready auth=ok gemini=ok maps=OK mapsApi=maps-javascript-places-bootstrap geminiTokens=32 mapsPredictions=0 durationMs=1770
```

## Verification Snapshot

Final completed checks:

- Broad headed Phase 0-6 verifier: all PASS; `consoleErrors=0`, `pageErrors=0`, `server5xx=0`.
- Deep phase-gap headed verifier: all PASS after Gemini cap increase; `consoleErrors=0`.
- `npx vitest run`: 131 passed, 11 skipped.
- `npm run test:e2e`: 7 Playwright release-gate tests passed.
- `npm run test:rules`: Firestore/Storage rules passed.
- `npm run test:concurrency`: transaction/concurrency tests passed.
- `npm run test:behavioral-api`: `authz=ok workerIdempotency=ok semanticDedup=ok`.
- `npm run test:golden-path`: duplicate merge, dispatch, ghost reopen, final resolution, Open311 export, predictive worker, and event ledger passed.
- `npm audit --omit=dev --audit-level=moderate`: 0 production vulnerabilities.

See [docs/FINAL_EVIDENCE_REPORT.md](docs/FINAL_EVIDENCE_REPORT.md) for the full evidence trail.

## Run Locally

```bash
npm ci
copy .env.example .env
npm run dev
```

Set real values in `.env` as needed:

- `GEMINI_API_KEY`
- `GOOGLE_MAPS_PLATFORM_KEY` or `VITE_GOOGLE_MAPS_PLATFORM_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `FIREBASE_PROJECT_ID`
- `FIRESTORE_DATABASE_ID`
- `VITE_FIREBASE_APP_CHECK_SITE_KEY`
- `CIVICLENS_OPERATOR_EMAILS`
- `CIVICLENS_JOB_SECRET`

Vite reads `VITE_*` variables at build time. Rebuild the frontend after changing Firebase browser config, App Check site key, or Maps browser key.
The tracked `firebase-applet-config.json` is metadata-only and intentionally excludes Firebase API keys or service-account material.

Never commit `.env`, service-account JSON, API keys, tokens, or private credentials.

## Validation Commands

```bash
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev
npm run test:rules
npm run test:concurrency
npm run test:e2e
```

Additional live/evidence scripts:

```bash
npm run smoke:deploy
npm run test:behavioral-api
npm run test:golden-path
node scripts/verify-public-headed-phase-status.mjs
node scripts/verify-public-phase-gaps-headed.mjs
```

## Demo Boundary

The public deployment keeps judge access open:

- App Check support exists, but enforcement is relaxed for the hackathon demo.
- The public hackathon demo uses a conservative in-memory quota fallback to keep judge access open during repeated testing.
- Firestore-backed distributed quotas remain implemented and emulator-verified.
- Synthetic demo records are visibly labelled.

## License and Attributions

This project is licensed under the terms in [LICENSE](LICENSE). Third-party libraries, services, and demo image notes are listed in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

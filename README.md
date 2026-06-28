# CivicLens - Community Hero

CivicLens is a Google Cloud-deployed civic-resolution pilot for reporting, verifying, tracking, and reviewing hyperlocal community issues. It is an independent civic pilot, not an official government portal, and it does not submit complaints externally.

The app demonstrates a Community Hero workflow built around citizen field reports, Google-powered location context, Gemini-assisted triage, community verification, and human operator review.

## What It Does

- Citizens capture a photo, location, and description for a civic issue.
- Gemini helps summarize reports, estimate severity, compare possible duplicates, draft review material, translate summaries, and assess closure evidence.
- Google Maps and Places help residents anchor reports to real locations.
- Community members can support, confirm, or dispute saved cases.
- Server-side agent runs load canonical Firestore issue data, execute bounded tools, and persist `agentRuns` plus `agentSteps`.
- Operators review evidence, draft routing/action packets, escalation text, closure assessments, and approval records.
- Synthetic demo stories are visibly labelled and separated from real records.

## Pilot Boundary

CivicLens recommends and drafts; people decide. Human approval is required before duplicate merge, routing/action packet approval, escalation finalization, resolve, or reopen. The app does not claim government affiliation, external agency acceptance, statutory SLA enforcement, digital signatures, permanent tamper-proof records, or official case status.

## Google Technologies

- Google AI Studio was used during development and provenance of the Gemini-backed pilot.
- Gemini via `@google/genai` powers multimodal triage, structured output, translation support, duplicate comparison support, draft resolution planning, closure image assessment, and server-side tool workflow.
- Google Maps Platform renders map context and Places autocomplete for manual location search.
- Firebase Auth supports anonymous citizen sessions and verified identity entry points.
- Firestore stores issues, lifecycle fields, support and verification actions, approvals, `agentRuns`, and `agentSteps`.
- Firebase Storage stores report, evidence, and closure images behind Storage Rules.
- Firebase Admin SDK owns privileged writes, transactions, role checks, counters, and lifecycle transitions.
- Secret Manager stores runtime secrets for Cloud Run without committing secret values.
- Cloud Run hosts the public production service.
- Cloud Build and Artifact Registry support the deployment flow.

## Application Stack

- React, TypeScript, Vite, and Tailwind CSS for the frontend.
- Express and esbuild for the TypeScript server bundle.
- Firebase Rules and server-side Admin SDK boundaries for data integrity.
- Vitest, Firebase Emulator Suite, and automated browser checks for validation.

## Key Docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [ATTRIBUTIONS.md](ATTRIBUTIONS.md)
- [LICENSE](LICENSE)
- [security_spec.md](security_spec.md)
- [docs/DEPLOYMENT_CLOUD_RUN.md](docs/DEPLOYMENT_CLOUD_RUN.md)
- [docs/AI_STUDIO_EVIDENCE.md](docs/AI_STUDIO_EVIDENCE.md)
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
- [docs/GOOGLE_DOC_DRAFT.md](docs/GOOGLE_DOC_DRAFT.md)
- [docs/FINAL_EVIDENCE_REPORT.md](docs/FINAL_EVIDENCE_REPORT.md)
- Public Google Doc: [CivicLens - Community Hero: Hyperlocal Problem Solver](https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing)

## Run Locally

```bash
npm ci
copy .env.example .env
npm run dev
```

Set real values in `.env` as needed:

- `GEMINI_API_KEY` for Gemini calls.
- `GOOGLE_MAPS_PLATFORM_KEY` or `VITE_GOOGLE_MAPS_PLATFORM_KEY` for Google Maps and Places autocomplete.
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, and optional Firebase browser fields before building the frontend. If these are absent, the app falls back to the public `firebase-applet-config.json`.
- `FIREBASE_PROJECT_ID` or Cloud Run's `GOOGLE_CLOUD_PROJECT` for Firebase Admin SDK project selection.
- `FIRESTORE_DATABASE_ID`, defaulting to `(default)`, when using a named Firestore database.
- `VITE_FIREBASE_APP_CHECK_SITE_KEY` to initialize frontend App Check token generation.
- `CIVICLENS_REQUIRE_APP_CHECK=true` only after the deployed frontend sends `X-Firebase-AppCheck` successfully.
- `CIVICLENS_OPERATOR_EMAILS` for verified real operator email allowlist.
- `CIVICLENS_LOCAL_APP_CHECK_BYPASS=true` for local development only.
- `CIVICLENS_DEMO_OPERATOR_ENABLED=true` only when synthetic demo mutation should be enabled.

Vite reads `VITE_*` variables at build time, not Cloud Run request time. Rebuild the frontend after changing Firebase browser config, App Check site key, or Maps browser key.

Never commit `.env`, service-account JSON, or secret values.

## Validation

Required local gate:

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

`npm test` skips emulator-only files by default; use `npm run test:rules` for Firestore/Storage Emulator Suite coverage and `npm run test:concurrency` for the focused parallel transaction harness. `npm run test:e2e` starts local Firebase emulators and runs the responsive browser release gate.

The latest recorded validation results are in `docs/FINAL_EVIDENCE_REPORT.md`.

## Deployment Status

Cloud Run deployment is documented in `docs/DEPLOYMENT_CLOUD_RUN.md`.

- Public app URL: `https://civiclens-py7ixxgroq-as.a.run.app`
- Current deployed revision: `civiclens-00047-5kr`
- Latest deployed source commit: `68e9787`

Maps browser-key restrictions were applied for the public Cloud Run origins and localhost during the final evidence checkpoint. App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.

The current deployment includes Google Places autocomplete for manual location search, persistent Hindi localization for the core citizen flow, a compact sticky header subtitle, public issue-detail read-only agent evidence, and operator-owned agent/lifecycle controls with required rationale. Firebase Google provider is enabled, the Cloud Run domains are authorized, and public smoke verification confirms the Google sign-in entry point opens the Firebase/Google auth flow without an inline app error. No private Google-account credential flow was completed during verification. App Check enforcement and final hackathon submission remain intentionally separate follow-up actions.

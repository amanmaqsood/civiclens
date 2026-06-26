# CivicLens

CivicLens is a hackathon prototype for reporting, grouping, reviewing, and tracking hyperlocal civic issues. It is not a government portal, does not file complaints with authorities, and does not receive official acknowledgements.

The app demonstrates a Community Hero workflow:

- Citizens capture a photo, location, and description for a civic issue.
- Gemini helps summarize reports, estimate severity, compare possible duplicates, draft authority recommendations, translate summaries, and assess closure evidence.
- Community members can support, confirm, or dispute saved cases.
- Server-side agent runs load canonical Firestore issue data, execute bounded tools, and persist `agentRuns` plus `agentSteps`.
- Operators review evidence, draft routing/action packets, escalation/RTI drafts, closure assessments, and approval records.
- Demo cases are synthetic samples and are labelled as demo data.

## Prototype Boundary

CivicLens only recommends and drafts. A human operator or citizen must review any draft before acting outside the app. No current code proves government submission, government routing, authority acceptance, statutory SLA enforcement, digital signatures, immutable audit logs, or official case status.

## Stack

```text
React 19 + TypeScript + Vite
Express server bundled with esbuild
Gemini through @google/genai
Firebase Auth, Firestore, Storage, Admin SDK, and App Check verification
Google Maps Platform
Target deployment path: Google Cloud Run
```

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
- [docs/CODEX_PROGRESS.md](docs/CODEX_PROGRESS.md)

## Run Locally

```bash
npm ci
copy .env.example .env
npm run dev
```

Set real values in `.env` as needed:

- `GEMINI_API_KEY` for Gemini calls.
- `GOOGLE_MAPS_PLATFORM_KEY` or `VITE_GOOGLE_MAPS_PLATFORM_KEY` for Google Maps.
- `CIVICLENS_OPERATOR_EMAILS` for verified real operator email allowlist.
- `CIVICLENS_LOCAL_APP_CHECK_BYPASS=true` for local development only.
- `CIVICLENS_DEMO_OPERATOR_ENABLED=true` only when synthetic demo mutation should be enabled.

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

`npm test` skips emulator-only files by default; use `npm run test:rules` for Firestore/Storage Emulator Suite coverage and `npm run test:concurrency` for the focused parallel transaction harness. `npm run test:e2e` starts local Firebase emulators and runs the Playwright/axe browser release gate.

The latest local validation results are recorded in `docs/FINAL_EVIDENCE_REPORT.md` and `docs/CODEX_PROGRESS.md`.

## Deployment Status

Cloud Run is the target deployment path, documented in `docs/DEPLOYMENT_CLOUD_RUN.md`. Deployment, public URL smoke tests, demo video publication, Google Doc publication, and final hackathon submission require Firebase/GCP credentials, billing, and explicit approval. They have not been performed in this local rebuild.

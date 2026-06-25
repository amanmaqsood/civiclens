# CivicLens

CivicLens is a hackathon prototype for reporting, grouping, reviewing, and tracking hyperlocal civic issues. It is not a government portal, does not file complaints with authorities, and does not receive official acknowledgements.

The current app demonstrates the intended Community Hero workflow:

- Citizens can capture a photo, location, and description for a civic issue.
- Gemini can help summarize the report, estimate severity, and suggest clarifying questions.
- Nearby reports can be compared for possible duplicates.
- Community members can confirm or dispute a case in the prototype dataset.
- The app can draft authority recommendations, complaint text, escalation letters, RTI text, and closure assessments for human review.
- Demo cases are synthetic samples and must not be treated as live government records or live agent executions.

## Prototype Boundary

CivicLens only recommends and drafts. A human operator or citizen must review any draft before acting on it outside the app. No current code proves government submission, government routing, authority acceptance, statutory SLA enforcement, digital signatures, immutable audit logs, or official case status.

## Current Architecture

```text
React 19 + TypeScript + Vite
Express server bundled with esbuild
Gemini through @google/genai
Firebase Auth, Firestore, Storage, and Admin SDK
Google Maps Platform
Target deployment path: Google Cloud Run
```

Google AI Studio provenance is preserved through the project setup and server Gemini integration. A final public deployment URL, demo video, and Google Doc must be recorded only after they are actually produced and verified.

## Current API Surface

The server currently exposes Gemini and workflow helper endpoints for report analysis, duplicate comparison, draft resolution plans, closure-image comparison, escalation/RTI drafting, translation, and an early function-calling agent loop.

Important limitation: several privileged records are still written by the browser in this baseline. The rebuild plan moves lifecycle fields, audit events, agent traces, counts, closure assessments, escalation records, and operator actions behind authenticated server endpoints.

## Run Locally

```bash
npm ci
cp .env.example .env
npm run dev
```

Set `GEMINI_API_KEY` for Gemini calls. Set `GOOGLE_MAPS_PLATFORM_KEY` or `VITE_GOOGLE_MAPS_PLATFORM_KEY` to render Google Maps. `CIVICLENS_OPERATOR_EMAILS`, `CIVICLENS_LOCAL_APP_CHECK_BYPASS`, and `CIVICLENS_DEMO_OPERATOR_ENABLED` control the current server role/API perimeter. Firebase config in this prototype points at the configured Firebase project, but production credentials and deployment permissions are not committed.

## Validation

Baseline Milestone 0 validation:

```bash
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev
```

See `docs/CODEX_PROGRESS.md` for actual command results, known risks, and milestone status.

## License and Attribution

License and full attribution files are part of the release-readiness milestone and must be completed before public submission.

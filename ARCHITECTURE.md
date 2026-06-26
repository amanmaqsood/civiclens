# CivicLens Architecture

CivicLens is a human-governed civic issue prototype. It saves and reviews reports inside the application; it does not submit records to government systems.

## Runtime Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS.
- Server: Express and TypeScript bundled by esbuild.
- AI: Gemini through `@google/genai`.
- Identity and data: Firebase Auth, Firestore, Storage, Admin SDK, App Check verification.
- Maps: Google Maps Platform through `@vis.gl/react-google-maps`.
- Target deployment: Google Cloud Run.

## Trust Boundary

The browser may create low-privilege report inputs and upload image bytes to user-owned Storage paths. Privileged lifecycle facts are server-owned.

Server-owned fields include status, priority, counters, lifecycle timestamps, activity/audit records, agent runs, agent steps, resolution plans, escalation records, closure assessments, approvals, and demo seed/clear actions.

Stored lifecycle statuses use canonical keys (`submitted`, `verified`, `in_progress`, `resolved`). Display labels are UI-only.

Operator actions require a verified Firebase ID token and a server-resolved role. Demo operator mode is separate and may mutate only records marked `isDemoData === true`.

## Data Flow

1. Citizen signs in anonymously or with Google through Firebase Auth.
2. Citizen captures a photo, description, and optional geolocation.
3. The image is compressed client-side and sent to `/api/analyze-report` for Gemini-assisted draft analysis.
4. The client checks nearby loaded records for duplicate candidates, then asks `/api/check-duplicate` for a recommendation.
5. A new report or duplicate evidence is saved through Admin SDK endpoints.
6. Community support and verification are written through server transactions.
7. `/api/agent/run` loads canonical issue data from Firestore, runs bounded server tools, and persists `agentRuns` plus `agentSteps`.
8. Operators review persisted evidence, draft plans, approvals, escalation drafts, and closure assessments.
9. Resolve/reopen is a human decision recorded by the server. Closure recommendation never auto-resolves a case.

## Primary Collections

- `issues/{issueId}`: canonical report state and server-owned lifecycle fields.
- `issues/{issueId}/activity/{activityId}`: append-only server-authored activity entries.
- `issues/{issueId}/support/{uid}`: one support action per user.
- `issues/{issueId}/verifications/{uid}`: one confirm/dispute action per user.
- `issues/{issueId}/approvals/{approvalId}`: human approval records.
- `issues/{issueId}/agentSteps/{stepId}`: issue-linked server tool steps.
- `agentRuns/{runId}` and `agentRuns/{runId}/steps/{stepId}`: persisted server-side agent run evidence.

## API Groups

- Session and health: `/api/session`, `/health`, `/api/health`, `/readyz`, `/api/readyz`.
- Report and community actions: `/api/issues/create`, `/api/issues/:issueId/evidence`, `/api/issues/:issueId/support`, `/api/issues/:issueId/verification`.
- Operator lifecycle: `/api/issues/update-status`, `/api/issues/:issueId/routing-approval`, `/api/issues/:issueId/escalation-finalize`, `/api/issues/:issueId/closure-assessment`.
- Agent and AI: `/api/analyze-report`, `/api/check-duplicate`, `/api/resolution-plan`, `/api/verify-resolution`, `/api/escalation`, `/api/translate`, `/api/agent/run`, `/api/issues/:issueId/agent-runs/latest`.
- Demo: `/api/demo/seed`, `/api/demo/clear`.

## Security Controls

- Firebase ID token verification for protected APIs.
- App Check verification for API routes, with an explicit local-only bypass header for development.
- Per-user/IP in-memory quotas for session, Gemini, and mutation routes.
- Server-side role resolution from custom claims or verified allowlisted email.
- Firestore Rules deny client writes to issue-owned documents and subcollections.
- Storage Rules restrict writes to user-owned image paths, allowed MIME types, and 5 MB max size.
- SSRF-prone closure image fetching is restricted to Firebase Storage URLs and image content types.

## Known Release Gaps

- Transaction/concurrency behavior has a focused parallel Firestore emulator harness for duplicate same-user support and verification writes; a full API-level race matrix remains future hardening.
- Browser E2E and automated accessibility checks use seeded synthetic emulator data; live Gemini/Maps golden-path evidence requires production secrets and deployment approval.
- Firebase vendor chunk remains above Vite's 500 kB warning threshold.
- Cloud Run deployment and public URL verification require credentials and explicit approval.

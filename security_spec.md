# CivicLens Security Boundary Notes

This document records the local rebuild security posture. It is intentionally conservative: CivicLens is a prototype and does not claim protections, deployments, or government integrations that were not actually verified.

## Current Boundary

- Firebase Auth signs visitors in anonymously for low-friction citizen access.
- Google sign-in is exposed in the account menu for verified citizen/operator identity and uses popup with redirect fallback. Anonymous reporting remains available.
- If Firebase Google provider or Authorized Domains are misconfigured, the app shows an inline sign-in error rather than granting operator permissions.
- Real operator authorization is resolved on the server from verified allowlist email, custom claim, or configured role source.
- Public real-operator switching is not available in the UI. The server-reported session decides whether the operator desk is available.
- Demo operator mode is explicit and request-marked. Demo operators can mutate only documents marked `isDemoData == true`.
- Protected API routes require Firebase ID tokens, request-size checks, public-safe errors, and per-user/IP quotas. App Check enforcement is controlled by `CIVICLENS_REQUIRE_APP_CHECK=true`; when enabled, routes require `X-Firebase-AppCheck` except for the explicit local-only bypass that is refused in production.
- `GET /api/admin/health` requires a real operator.
- `/health` and `/api/health` are liveness endpoints. `/readyz` and `/api/readyz` report runtime readiness and return 503 when required production config or Admin SDK readiness is missing.

## Server-Owned Data

The following data is written by Express/Admin SDK endpoints rather than client Firestore writes:

- Issue creation and duplicate evidence attachment.
- Support and verification actions.
- Status transitions and lifecycle timestamps.
- Activity entries.
- Approval records.
- Agent traces, `agentRuns`, and issue-linked `agentSteps`.
- Resolution plans.
- Escalation drafts and finalization records.
- Closure assessments.
- Synthetic demo seed/clear actions.

Firestore Rules deny direct client create/update/delete access to `/issues/{issueId}` and issue-owned subcollections. Storage Rules allow signed-in users to upload image files only under their own `reports/{uid}`, `evidence/{uid}`, and `closures/{uid}` paths with MIME and size checks.

Issue lifecycle statuses are stored as canonical enum keys (`submitted`, `verified`, `in_progress`, `resolved`). Human-readable status labels are derived in the UI.

## Human Approval Requirements

Human approval is required for:

- Duplicate merge decision.
- Routing/action packet approval.
- Escalation finalization.
- Resolve.
- Reopen.

Closure recommendations never auto-resolve a case. A server-authorized operator must make the final decision and provide rationale.

## Agent Boundary

`POST /api/agent/run` accepts `issueId` and optional idempotency key. The server loads canonical issue data and nearby candidates from Firestore, executes bounded tools, and persists run/step records. The UI renders persisted runs and does not present seeded demo traces as live tool executions.

Browser requests are not accepted as evidence for privileged agent traces or persisted resolution plans. Resolution plans are generated from server-loaded issue data; closure and escalation saves append server-generated trace entries only.

## URL And Upload Safety

- Report and closure images are compressed client-side before upload.
- Storage Rules restrict image MIME types and size.
- Closure before-image fetching accepts only Firebase Storage URLs and image content types, with a timeout.
- Arbitrary remote URL fetching is not allowed for closure verification.

## Validation Evidence

Source-level release tests cover:

- Unauthenticated protected API rejection strings.
- App Check/auth/quota/body-size controls.
- Demo-only operator mutation boundary.
- One support and one verification action per user.
- Illegal lifecycle transitions.
- Resolve without closure evidence.
- SSRF-restricted closure image fetch.
- Firestore and Storage rules matrix.
- Persisted server agent runs/steps and idempotency.
- Focused Firestore emulator transaction/concurrency checks for duplicate same-user support, verification, duplicate evidence, and status-transition writes.
- Golden-path UI wiring and key accessibility markers.

Executed local release gates also include:

- Firebase Emulator Suite Firestore/Storage Rules tests for representative allow/deny cases.
- Playwright/axe browser checks for responsive landing and synthetic demo operator flows at mobile, tablet, and desktop sizes.

Latest command results are recorded in `docs/FINAL_EVIDENCE_REPORT.md`.

## Remaining Security Gaps

- The concurrency emulator gate covers representative support, verification, duplicate evidence, and status-transition races, not every API mutation race path.
- Browser E2E currently uses seeded synthetic emulator data; live Gemini/Maps golden-path evidence requires production secrets and deployment approval.
- Production App Check token wiring and Cloud Run readiness have not been smoke-tested because deployment credentials and explicit approval are not available in this local rebuild. Keep `CIVICLENS_REQUIRE_APP_CHECK=false` until the deployed frontend is configured with `VITE_FIREBASE_APP_CHECK_SITE_KEY` and verified to send `X-Firebase-AppCheck`.

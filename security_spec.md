# CivicLens Security Boundary Notes

This document records the local rebuild security posture. It is intentionally conservative: CivicLens is a prototype and does not claim protections, deployments, or government integrations that were not actually verified.

## Current Boundary

- Firebase Auth signs visitors in anonymously for low-friction citizen access.
- Google sign-in is exposed for users who need a real operator role.
- Real operator authorization is resolved on the server from verified allowlist email, custom claim, or configured role source.
- Public real-operator switching is not available in the UI. The server-reported session decides whether the operator desk is available.
- Demo operator mode is explicit and request-marked. Demo operators can mutate only documents marked `isDemoData == true`.
- Protected API routes require Firebase ID token, App Check or explicit local-only App Check bypass, request-size checks, public-safe errors, and per-user/IP quotas.
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
- Golden-path UI wiring and key accessibility markers.

Latest command results are recorded in `docs/FINAL_EVIDENCE_REPORT.md`.

## Remaining Security Gaps

- Firestore Rules and Storage Rules are not yet executed in Firebase Emulator Suite tests.
- Transaction/concurrency behavior is not yet race-tested in an emulator harness.
- Browser E2E and automated accessibility tests are not wired.
- Production App Check token wiring and Cloud Run readiness have not been smoke-tested because deployment credentials and explicit approval are not available in this local rebuild.

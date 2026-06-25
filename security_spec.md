# CivicLens Security Boundary Notes

This document records the current baseline security posture and the target rebuild boundary. It is intentionally conservative: it does not claim protections that are not yet enforced by code and tests.

## Current Baseline

- Firebase Auth signs visitors in anonymously for low-friction citizen access.
- Google sign-in exists, but real operator authorization is not yet enforced by a server-side role source.
- `POST /api/issues/update-status` verifies a Firebase ID token and writes through the Admin SDK, but it does not yet prove an operator role or demo-only boundary.
- Most Gemini endpoints are unauthenticated and trust browser-supplied issue facts.
- The browser can currently write or update issue fields that should become server-owned, including counts, priority, agent traces, activity records, resolution plans, escalation records, and closure assessments.
- Firestore rules allow signed-in users to broadly update issue documents if `userId` and `ticketId` remain unchanged.
- Activity entries under `/issues/{issueId}/activity` can currently be written by signed-in clients.
- No Storage Rules file is present yet.

## Target Invariants

- Trust no browser-supplied privileged fact.
- Verify Firebase ID token and server-side role before protected work.
- Restrict public demo operator actions to documents explicitly marked `isDemoData == true`.
- Keep status, lifecycle timestamps, counts, priority, agent traces, activity/audit events, resolution plans, escalation records, and closure assessments server-owned.
- Use transactions and idempotency for votes, verification, merges, counters, state changes, and audit writes.
- Require human approval for duplicate merge, final routing/action packet, escalation finalization, resolve, and reopen.
- Persist only real server-executed agent tools as agent traces.
- Add Storage Rules for path ownership, MIME type, and file-size restrictions.
- Prevent arbitrary URL fetching and SSRF in closure verification.
- Add request schemas, quotas, safe errors, App Check verification where deployable, and explicit local-only bypasses.

## Required Evidence Before Release

The release security claim is valid only after tests prove:

- Unauthenticated protected API calls fail.
- Citizens cannot mutate real-case status or system-owned fields.
- Demo operators can mutate demo cases only.
- Real operator authorization is decided server-side.
- Clients cannot write audit or agent trace records.
- One user gets one support and one verification action.
- Concurrent actions preserve correct counts and audit records.
- Illegal state transitions fail.
- Resolve without closure evidence fails.
- Arbitrary remote image URLs and oversized/non-image uploads are rejected.
- Malformed Gemini output falls back safely.
- Closure recommendations wait for human decision.

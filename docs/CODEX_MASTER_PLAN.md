# CivicLens winning rebuild — executable master plan

This document is a release checklist. Codex must mark items only after implementation and evidence-based verification.

## Milestone 0 — baseline, safety, and inventory
- [x] Confirm Git status, create a baseline commit/tag or record why not possible.
- [x] Run and record `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev`.
- [x] Inventory routes, API endpoints, data models, Firestore writes, Storage writes, auth flows, Gemini calls, Maps usage, and claims in UI/docs.
- [x] Create/update `docs/CODEX_PROGRESS.md` with baseline results.
- [x] Preserve a runnable baseline and rollback instructions.

Acceptance:
- Baseline commands and actual outputs are recorded.
- No broad rewrite begins before data ownership and auth boundaries are mapped.

## Milestone 1 — credibility and truthful product boundary
- [x] Remove or rewrite unsupported claims in UI, README, metadata, seeded data, and security docs.
- [x] Add a visible prototype/non-government disclaimer in onboarding/about/operator areas.
- [x] Ensure authority lookup, complaint packet, escalation, and RTI are described as drafts/recommendations unless actually submitted.
- [x] Remove fake hashing, signing, gateway, statutory, official, or government acknowledgement language.
- [x] Mark seeded cases/images/metrics as synthetic or illustrative.
- [x] Replace fixed fake progress labels with truthful stages tied to actual work.
- [x] Ensure no seeded trace is represented as a live agent execution.

Acceptance:
- Repository search for high-risk phrases is reviewed and every occurrence is supported or rewritten.
- Product remains compelling without false claims.

## Milestone 2 — identity, roles, and API perimeter
- [x] Define citizen, demo operator, and real operator capabilities.
- [x] Retain low-friction citizen access, but prevent anonymous/public users from privileged real-case actions.
- [x] Add Google sign-in or equivalent verified identity for real operators.
- [x] Enforce operator authorization on the server using an allowlist/custom claim/configured role source.
- [x] Require and verify Firebase ID tokens on protected APIs.
- [x] Add App Check verification where deployable; support an explicit local-development bypass that cannot silently activate in production.
- [x] Add request schemas, body limits, safe production errors, and rate/quota controls for Gemini endpoints.
- [x] Protect demo actions so they can mutate only `isDemoData == true` cases.
- [x] Remove/hide public operator switching for real data.

Acceptance tests:
- Unauthenticated protected API calls fail.
- Citizen cannot execute operator transitions.
- Demo operator cannot mutate real cases.
- Real operator role is decided server-side.

## Milestone 3 — server-owned data integrity
- [x] Move privileged issue creation/mutation workflows behind authenticated server endpoints as appropriate.
- [x] Prevent direct client writes to status, priority, counts, agent traces, activity, resolution plan, escalation, closure assessment, assignment, and lifecycle timestamps.
- [x] Implement deterministic legal state transitions in application code.
- [x] Use Admin SDK transactions/idempotency for votes, verification, merges, counters, state changes, and event creation.
- [x] Enforce one support/verification action per user with durable action documents.
- [x] Add canonical category/status keys and typed mappings.
- [x] Add complete lifecycle timestamps (`createdAt`, `triagedAt`, `verifiedAt`, `assignedAt`, `workStartedAt`, `closureSubmittedAt`, `resolvedAt`, `reopenedAt` as applicable).
- [x] Rewrite Firestore Rules to match the actual architecture.
- [x] Add Storage Rules for ownership/path, MIME type, and file-size restrictions.
- [x] Make activity/audit events append-only and server-authored.
- [x] Align `security_spec.md` to reality.

Acceptance tests:
- Browser cannot write system fields or audit collections.
- Concurrent actions preserve all valid updates.
- Illegal transitions fail.
- Resolved/reopened rules are deterministic and tested.

## Milestone 4 — genuine persisted agent workflow
- [x] Make `/api/agent/run` accept an `issueId`, not trusted issue facts from the browser.
- [x] Server loads the authoritative issue and candidates from Firestore.
- [x] Implement real Gemini function calling with a bounded model/tool/result loop.
- [x] Implement real tools:
  - [x] `search_nearby_cases`
  - [x] `compare_candidate_evidence`
  - [x] `calculate_priority`
  - [x] `find_responsible_authority`
  - [x] `draft_action_packet`
  - [x] `request_human_approval`
  - [x] `verify_closure`
  - [x] `record_event`
- [x] Validate every tool input on the server and reject invented candidate IDs or invalid state.
- [x] Persist `AgentRun` and each real `AgentStep` server-side with tool, safe input/output summary, timing, status, retry/fallback, model, and timestamps.
- [x] Persist grounding/search sources with title, URL, claim supported, and whether the value is sourced or estimated.
- [x] Require explicit human approval before merge, final routing/action packet, escalation finalization, and closure status change.
- [x] Add bounded retries, timeout handling, failure status, resumability/idempotency, and manual fallback.
- [x] Render the agent trace dynamically from persisted steps; no client-synthesized timing.

Acceptance:
- Demo visibly shows Gemini selecting a tool, the server executing it, the result returning to the model, and the persisted trace surviving refresh.
- A failed agent run preserves the case and offers a truthful retry/manual path.

## Milestone 5 — complete civic-resolution lifecycle
- [x] Report flow captures image, location, description/voice, consent, compression, and upload status.
- [x] Triage outputs category, severity, hazards, confidence, summary, and clarification when uncertain.
- [x] Nearby search uses canonical category/status/time and validated distance logic.
- [x] Duplicate comparison uses text plus multimodal evidence for top candidates when images exist.
- [x] Merge preserves every source report/evidence/reporter and uses human confirmation.
- [x] Community support/confirm/dispute/add-evidence paths are durable and abuse-aware.
- [x] Priority formula is deterministic, explainable, and shared across backend/UI tests.
- [x] Resolution coordinator produces a sourced authority recommendation and draft action packet.
- [x] Operator can approve, assign, move through legal statuses, request evidence, and record work.
- [x] Closure evidence upload is stored securely.
- [x] Multimodal closure tool recommends resolve/request-more-evidence/reopen.
- [x] Human decision controls final resolution/reopening and records rationale.
- [x] Full lifecycle survives refresh and repeated runs.

Acceptance:
- One demo case completes report -> triage -> dedupe -> verification -> routing -> work -> closure -> resolve/reopen without direct Firestore editing.

## Milestone 6 — product design and accessibility rebuild
- [x] Remove the fake phone bezel/status bar from desktop.
- [x] Build a true responsive desktop/tablet/mobile shell while preserving the distinctive palette.
- [x] Desktop citizen home: summary/map + priority/recent cases with clear hierarchy.
- [x] Desktop operator workspace: queue + selected case + evidence/agent panel.
- [x] Mobile: map/feed-first navigation, one dominant report action, sticky context actions.
- [x] Minimum readable text and 44x44 touch targets; restore browser zoom.
- [x] Use semantic buttons, labels, dialogs, keyboard navigation, focus states, and accessible status announcements.
- [x] Simplify jargon and uppercase microcopy.
- [x] Add consistent loading, empty, error, offline/slow, permission-denied, low-confidence, and retry states.
- [x] Add source cards and human-approval cards that explain what AI did and what remains unsubmitted.
- [x] Review all screens at common mobile and desktop widths.

Acceptance:
- Critical workflows are usable by keyboard and at 360px width.
- Operator UI no longer looks like a mobile mockup stretched onto desktop.

## Milestone 7 — trustworthy impact, performance, and reliability
- [x] Derive metrics only from persisted fields and explain the denominator/sample window.
- [x] Add actual resolved/reopened timestamps and real duration calculations.
- [x] Show `Not enough data` rather than fabricated fallback metrics.
- [x] Separate real and demo datasets in metrics.
- [x] Add pagination/query strategy rather than treating the most recent 50 as complete history.
- [x] Code-split routes/heavy map/operator/dashboard features.
- [x] Optimize image loading, map loading, Gemini request payloads, and bundle size.
- [x] Add structured server logs with request/run/issue IDs and sanitized errors.
- [x] Add health/readiness endpoint and deployment-safe configuration validation.

Acceptance:
- No metric is hard-coded as an achieved outcome.
- Build output and performance notes are recorded with before/after evidence.

## Milestone 8 — release-grade tests and security evidence
- [x] Unit tests for canonical enums, distance, priority, transitions, schemas, and mapping.
- [x] API tests for auth, roles, validation, quotas, SSRF/URL restrictions, idempotency, and errors.
- [x] Firestore Rules emulator tests for citizen/operator/demo/system boundaries.
- [x] Storage Rules emulator tests for ownership, type, and size.
- [x] Transaction/concurrency tests for support, verification, merge, and state changes.
- [x] Agent tests for real tool loop, invalid tool arguments, timeout, retry, malformed model output, persisted trace, and failure recovery.
- [x] Closure tests proving recommendation does not auto-resolve.
- [x] UI integration tests for report, duplicate confirmation, operator approval, closure/reopen.
- [x] End-to-end golden path against local/emulated services.
- [ ] Run deployed smoke test when authenticated GCP/Firebase credentials, billing, and explicit deployment approval are available.
- [x] Accessibility checks on critical screens.
- [x] Dependency/security audit triage with upgrades or documented mitigations.

Minimum named release cases:
1. Protected API rejects anonymous request.
2. Citizen cannot change real-case status.
3. Demo operator can change demo cases only.
4. Real operator authorization is server-verified.
5. Client cannot write audit/agent traces.
6. One user gets one support and one verification action.
7. Concurrent actions remain correct.
8. Illegal state transition fails.
9. Resolve without closure evidence fails.
10. Arbitrary remote image URL is rejected.
11. Oversized/non-image upload is rejected.
12. Malformed Gemini output falls back safely.
13. Agent run persists actual tool steps.
14. Duplicate candidate must come from server search.
15. Closure recommendation waits for human decision.
16. Full golden path passes.

Acceptance:
- Test commands and actual results are recorded in `docs/FINAL_EVIDENCE_REPORT.md`.

## Milestone 9 — documentation, demo, GCP release readiness, and submission
- [x] Replace README placeholders and make every claim match code.
- [x] Add `LICENSE` and `ATTRIBUTIONS.md` with libraries, assets, external skills/patterns, and licenses.
- [x] Add `ARCHITECTURE.md` including data ownership, auth, agent loop, human approvals, and deployment diagram.
- [x] Add `.env.example` descriptions without secrets.
- [x] Add setup, emulator, testing, build, Cloud Run deploy, rollback, and troubleshooting steps.
- [x] Add AI Studio evidence folder/instructions.
- [ ] Add real screenshots after approved AI Studio/GCP/deployment account actions; do not use placeholder images.
- [x] Add seeded demo-data explanation and reset workflow.
- [x] Add prototype limitations and privacy/security boundaries.
- [x] Prepare a 90–120 second demo script showing the complete live agent loop and human approvals.
- [x] Prepare Google Doc-ready content covering all mandatory headings plus architecture, innovation, safety, testing, impact, demo instructions, limitations, and links.
- [x] Prepare Cloud Run config/scripts and verify production-start behavior locally.
- [ ] When authenticated GCP access is present, deploy, smoke-test in incognito/mobile, and record the public URL and evidence. Do not perform irreversible submission without user approval.
- [x] Produce `docs/FINAL_EVIDENCE_REPORT.md` and final release checklist.

Acceptance:
- Clean checkout can install, lint, test, build, and start using documented steps.
- No placeholder links or unsupported claims remain.
- Public app/GitHub/Google Doc checklist is explicit even when external credentials must be supplied manually.

## Final stop condition
The goal is complete only when all milestones pass, or every remaining unchecked item is blocked solely by an external credential/account action and the repository contains exact, minimal manual instructions plus all locally verifiable work completed.

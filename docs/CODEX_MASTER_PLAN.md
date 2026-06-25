# CivicLens winning rebuild — executable master plan

This document is a release checklist. Codex must mark items only after implementation and evidence-based verification.

## Milestone 0 — baseline, safety, and inventory
- [ ] Confirm Git status, create a baseline commit/tag or record why not possible.
- [ ] Run and record `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev`.
- [ ] Inventory routes, API endpoints, data models, Firestore writes, Storage writes, auth flows, Gemini calls, Maps usage, and claims in UI/docs.
- [ ] Create/update `docs/CODEX_PROGRESS.md` with baseline results.
- [ ] Preserve a runnable baseline and rollback instructions.

Acceptance:
- Baseline commands and actual outputs are recorded.
- No broad rewrite begins before data ownership and auth boundaries are mapped.

## Milestone 1 — credibility and truthful product boundary
- [ ] Remove or rewrite unsupported claims in UI, README, metadata, seeded data, and security docs.
- [ ] Add a visible prototype/non-government disclaimer in onboarding/about/operator areas.
- [ ] Ensure authority lookup, complaint packet, escalation, and RTI are described as drafts/recommendations unless actually submitted.
- [ ] Remove fake hashing, signing, gateway, statutory, official, or government acknowledgement language.
- [ ] Mark seeded cases/images/metrics as synthetic or illustrative.
- [ ] Replace fixed fake progress labels with truthful stages tied to actual work.
- [ ] Ensure no seeded trace is represented as a live agent execution.

Acceptance:
- Repository search for high-risk phrases is reviewed and every occurrence is supported or rewritten.
- Product remains compelling without false claims.

## Milestone 2 — identity, roles, and API perimeter
- [ ] Define citizen, demo operator, and real operator capabilities.
- [ ] Retain low-friction citizen access, but prevent anonymous/public users from privileged real-case actions.
- [ ] Add Google sign-in or equivalent verified identity for real operators.
- [ ] Enforce operator authorization on the server using an allowlist/custom claim/configured role source.
- [ ] Require and verify Firebase ID tokens on protected APIs.
- [ ] Add App Check verification where deployable; support an explicit local-development bypass that cannot silently activate in production.
- [ ] Add request schemas, body limits, safe production errors, and rate/quota controls for Gemini endpoints.
- [ ] Protect demo actions so they can mutate only `isDemoData == true` cases.
- [ ] Remove/hide public operator switching for real data.

Acceptance tests:
- Unauthenticated protected API calls fail.
- Citizen cannot execute operator transitions.
- Demo operator cannot mutate real cases.
- Real operator role is decided server-side.

## Milestone 3 — server-owned data integrity
- [ ] Move privileged issue creation/mutation workflows behind authenticated server endpoints as appropriate.
- [ ] Prevent direct client writes to status, priority, counts, agent traces, activity, resolution plan, escalation, closure assessment, assignment, and lifecycle timestamps.
- [ ] Implement deterministic legal state transitions in application code.
- [ ] Use Admin SDK transactions/idempotency for votes, verification, merges, counters, state changes, and event creation.
- [ ] Enforce one support/verification action per user with durable action documents.
- [ ] Add canonical category/status keys and typed mappings.
- [ ] Add complete lifecycle timestamps (`createdAt`, `triagedAt`, `verifiedAt`, `assignedAt`, `workStartedAt`, `closureSubmittedAt`, `resolvedAt`, `reopenedAt` as applicable).
- [ ] Rewrite Firestore Rules to match the actual architecture.
- [ ] Add Storage Rules for ownership/path, MIME type, and file-size restrictions.
- [ ] Make activity/audit events append-only and server-authored.
- [ ] Align `security_spec.md` to reality.

Acceptance tests:
- Browser cannot write system fields or audit collections.
- Concurrent actions preserve all valid updates.
- Illegal transitions fail.
- Resolved/reopened rules are deterministic and tested.

## Milestone 4 — genuine persisted agent workflow
- [ ] Make `/api/agent/run` accept an `issueId`, not trusted issue facts from the browser.
- [ ] Server loads the authoritative issue and candidates from Firestore.
- [ ] Implement real Gemini function calling with a bounded model/tool/result loop.
- [ ] Implement real tools:
  - [ ] `search_nearby_cases`
  - [ ] `compare_candidate_evidence`
  - [ ] `calculate_priority`
  - [ ] `find_responsible_authority`
  - [ ] `draft_action_packet`
  - [ ] `request_human_approval`
  - [ ] `verify_closure`
  - [ ] `record_event`
- [ ] Validate every tool input on the server and reject invented candidate IDs or invalid state.
- [ ] Persist `AgentRun` and each real `AgentStep` server-side with tool, safe input/output summary, timing, status, retry/fallback, model, and timestamps.
- [ ] Persist grounding/search sources with title, URL, claim supported, and whether the value is sourced or estimated.
- [ ] Require explicit human approval before merge, final routing/action packet, escalation finalization, and closure status change.
- [ ] Add bounded retries, timeout handling, failure status, resumability/idempotency, and manual fallback.
- [ ] Render the agent trace dynamically from persisted steps; no client-synthesized timing.

Acceptance:
- Demo visibly shows Gemini selecting a tool, the server executing it, the result returning to the model, and the persisted trace surviving refresh.
- A failed agent run preserves the case and offers a truthful retry/manual path.

## Milestone 5 — complete civic-resolution lifecycle
- [ ] Report flow captures image, location, description/voice, consent, compression, and upload status.
- [ ] Triage outputs category, severity, hazards, confidence, summary, and clarification when uncertain.
- [ ] Nearby search uses canonical category/status/time and validated distance logic.
- [ ] Duplicate comparison uses text plus multimodal evidence for top candidates when images exist.
- [ ] Merge preserves every source report/evidence/reporter and uses human confirmation.
- [ ] Community support/confirm/dispute/add-evidence paths are durable and abuse-aware.
- [ ] Priority formula is deterministic, explainable, and shared across backend/UI tests.
- [ ] Resolution coordinator produces a sourced authority recommendation and draft action packet.
- [ ] Operator can approve, assign, move through legal statuses, request evidence, and record work.
- [ ] Closure evidence upload is stored securely.
- [ ] Multimodal closure tool recommends resolve/request-more-evidence/reopen.
- [ ] Human decision controls final resolution/reopening and records rationale.
- [ ] Full lifecycle survives refresh and repeated runs.

Acceptance:
- One demo case completes report -> triage -> dedupe -> verification -> routing -> work -> closure -> resolve/reopen without direct Firestore editing.

## Milestone 6 — product design and accessibility rebuild
- [ ] Remove the fake phone bezel/status bar from desktop.
- [ ] Build a true responsive desktop/tablet/mobile shell while preserving the distinctive palette.
- [ ] Desktop citizen home: summary/map + priority/recent cases with clear hierarchy.
- [ ] Desktop operator workspace: queue + selected case + evidence/agent panel.
- [ ] Mobile: map/feed-first navigation, one dominant report action, sticky context actions.
- [ ] Minimum readable text and 44x44 touch targets; restore browser zoom.
- [ ] Use semantic buttons, labels, dialogs, keyboard navigation, focus states, and accessible status announcements.
- [ ] Simplify jargon and uppercase microcopy.
- [ ] Add consistent loading, empty, error, offline/slow, permission-denied, low-confidence, and retry states.
- [ ] Add source cards and human-approval cards that explain what AI did and what remains unsubmitted.
- [ ] Review all screens at common mobile and desktop widths.

Acceptance:
- Critical workflows are usable by keyboard and at 360px width.
- Operator UI no longer looks like a mobile mockup stretched onto desktop.

## Milestone 7 — trustworthy impact, performance, and reliability
- [ ] Derive metrics only from persisted fields and explain the denominator/sample window.
- [ ] Add actual resolved/reopened timestamps and real duration calculations.
- [ ] Show `Not enough data` rather than fabricated fallback metrics.
- [ ] Separate real and demo datasets in metrics.
- [ ] Add pagination/query strategy rather than treating the most recent 50 as complete history.
- [ ] Code-split routes/heavy map/operator/dashboard features.
- [ ] Optimize image loading, map loading, Gemini request payloads, and bundle size.
- [ ] Add structured server logs with request/run/issue IDs and sanitized errors.
- [ ] Add health/readiness endpoint and deployment-safe configuration validation.

Acceptance:
- No metric is hard-coded as an achieved outcome.
- Build output and performance notes are recorded with before/after evidence.

## Milestone 8 — release-grade tests and security evidence
- [ ] Unit tests for canonical enums, distance, priority, transitions, schemas, and mapping.
- [ ] API tests for auth, roles, validation, quotas, SSRF/URL restrictions, idempotency, and errors.
- [ ] Firestore Rules emulator tests for citizen/operator/demo/system boundaries.
- [ ] Storage Rules emulator tests for ownership, type, and size.
- [ ] Transaction/concurrency tests for support, verification, merge, and state changes.
- [ ] Agent tests for real tool loop, invalid tool arguments, timeout, retry, malformed model output, persisted trace, and failure recovery.
- [ ] Closure tests proving recommendation does not auto-resolve.
- [ ] UI integration tests for report, duplicate confirmation, operator approval, closure/reopen.
- [ ] End-to-end golden path against local/emulated services and, when credentials permit, deployed smoke test.
- [ ] Accessibility checks on critical screens.
- [ ] Dependency/security audit triage with upgrades or documented mitigations.

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
- [ ] Replace README placeholders and make every claim match code.
- [ ] Add `LICENSE` and `ATTRIBUTIONS.md` with libraries, assets, external skills/patterns, and licenses.
- [ ] Add `ARCHITECTURE.md` including data ownership, auth, agent loop, human approvals, and deployment diagram.
- [ ] Add `.env.example` descriptions without secrets.
- [ ] Add setup, emulator, testing, build, Cloud Run deploy, rollback, and troubleshooting steps.
- [ ] Add screenshots and an AI Studio evidence folder/instructions.
- [ ] Add seeded demo-data explanation and reset workflow.
- [ ] Add prototype limitations and privacy/security boundaries.
- [ ] Prepare a 90–120 second demo script showing the complete live agent loop and human approvals.
- [ ] Prepare Google Doc-ready content covering all mandatory headings plus architecture, innovation, safety, testing, impact, demo instructions, limitations, and links.
- [ ] Prepare Cloud Run config/scripts and verify production-start behavior locally.
- [ ] When authenticated GCP access is present, deploy, smoke-test in incognito/mobile, and record the public URL and evidence. Do not perform irreversible submission without user approval.
- [ ] Produce `docs/FINAL_EVIDENCE_REPORT.md` and final release checklist.

Acceptance:
- Clean checkout can install, lint, test, build, and start using documented steps.
- No placeholder links or unsupported claims remain.
- Public app/GitHub/Google Doc checklist is explicit even when external credentials must be supplied manually.

## Final stop condition
The goal is complete only when all milestones pass, or every remaining unchecked item is blocked solely by an external credential/account action and the repository contains exact, minimal manual instructions plus all locally verifiable work completed.

# Codex progress log

## Baseline
Status: completed on 2026-06-26

Current branch/commit:
- Branch: `master`
- Original prototype baseline commit: `ffd4ebc chore: capture original prototype baseline`
- Original prototype rollback tag: `baseline/original-prototype`
- Current rebuild state: milestones 0-9 have been completed locally and the approved Cloud Run deployment/public smoke checkpoint is complete. The Maps browser key has been restricted for the public Cloud Run origins and localhost. Google Doc publication, demo video/public screenshot packaging, App Check enforcement, and final submission remain external approval-gated.

Validation commands:
- `npm install --package-lock-only`: passed; generated a real lockfile from the previously empty `package-lock.json`; initial audit reported 8 moderate vulnerabilities.
- `npm ci`: passed after lockfile generation; initial dependency tree still reported 8 moderate vulnerabilities.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (1 test file, 18 tests).
- `npm run build`: passed; output included a large JS bundle warning (`assets/index-B1lesoIv.js`, 1,287.66 kB / 348.41 kB gzip) and a warning that `src/services/issues.ts` cannot be moved into a dynamic chunk because it is also statically imported.
- `npm audit --omit=dev`: initially failed with moderate `uuid <11.1.1` findings through `firebase-admin` transitive dependencies.
- Dependency fix: upgraded `firebase-admin` from `^12.7.0` to `^14.1.0` and added `overrides.uuid = ^11.1.1`; Node is `v22.22.2`, satisfying `firebase-admin@14.1.0`'s `node >=22` engine.
- `npm ci` after dependency fix: passed; 0 vulnerabilities.
- `npm run lint` after dependency fix: passed.
- `npm test` after dependency fix: passed (1 test file, 18 tests).
- `npm run build` after dependency fix: passed with the same bundle/code-splitting warnings.
- `npm audit --omit=dev` after dependency fix: passed; 0 vulnerabilities.

Baseline architecture and data-ownership map captured before Milestone 2:
- Express server endpoints: `GET /health`, `GET /api/health`, `GET /api/admin/health`, `POST /api/issues/update-status`, `POST /api/analyze-report`, `POST /api/check-duplicate`, `POST /api/resolution-plan`, `POST /api/verify-resolution`, `POST /api/escalation`, `POST /api/translate`, `POST /api/agent/run`, and production static `GET *`.
- Auth: `FirebaseContext` automatically signs visitors in anonymously and creates `/users/{uid}` from the browser. Google sign-in exists, but operator capability is still a public UI persona toggle in `Header`/`App`, not a server-authorized role.
- Server-owned data today: `/api/issues/update-status` verifies a Firebase ID token and writes status/activity through Admin SDK, but it does not yet enforce operator role or demo-only boundaries.
- Browser-owned writes today: `src/services/issues.ts` creates issues, uploads report/evidence/closure images, writes evidence, verification docs, counts, priority, translations, resolution plans, agent traces, closure assessments, escalation records, activity events, demo seed data, and demo deletes.
- Firestore Rules today: signed-in users can broadly update issue docs if `userId` and `ticketId` remain unchanged; signed-in users can write activity; demo deletes are allowed directly by clients. This does not match the server-owned target architecture.
- Storage Rules today: no `storage.rules` file exists.
- Gemini calls today: server uses Gemini for report analysis, duplicate comparison, resolution plan/search grounding, closure verification, escalation/RTI drafting, translation, action-packet drafting, and a function-calling agent loop. Most endpoints are unauthenticated and trust browser-supplied facts.
- Agent traces today: report flow, resolution plan, closure, escalation, seeded demo data, and `/api/agent/run` results can be assembled or persisted by the browser. Agent runs are not durably persisted as server-authored `AgentRun`/`AgentStep` records.
- Google Maps: `HomeMap` uses `@vis.gl/react-google-maps` and reads `GOOGLE_MAPS_PLATFORM_KEY` / `VITE_GOOGLE_MAPS_PLATFORM_KEY`; it shows a setup card if no key is present.
- Current tests: one Vitest file covers distance, priority score, duplicate filtering, status-transition helper, and priority breakdown only. No API, rules, storage, concurrency, agent persistence, UI integration, or E2E coverage exists yet.

Current blockers:
- No external blocker for local work.
- Google Doc URL, demo video/public screenshot packaging, App Check enforcement, and BlockseBlock submission remain external/approval-gated for Milestone 9 follow-up.

Rollback instructions:
- Return to the untouched prototype with `git checkout baseline/original-prototype`.
- Return to the post-Milestone-0 dependency baseline after the Milestone 0 commit is created with `git checkout master`.

## Milestone status
| Milestone | Status | Evidence |
|---|---|---|
| 0 Baseline | Complete | Baseline commit/tag created; required commands run and recorded; route/write/auth/Gemini/Maps/claim inventory recorded above. |
| 1 Credibility | Complete | Truth-boundary copy updated across docs/UI/server prompts; seeded traces labelled synthetic; regression test added; required commands passed. |
| 2 Identity/API perimeter | Complete | Firebase token + App Check perimeter added for API routes; server role/session resolution added; public real-operator switching removed; focused perimeter tests added; required commands passed. |
| 3 Server data integrity | Complete | Server-owned issue/evidence/support/verification/activity/trace/closure/escalation endpoints added; Firestore rules deny direct issue writes; Storage Rules added; focused data-integrity tests added; required commands passed. |
| 4 Genuine agent | Complete | `/api/agent/run` now accepts `{ issueId, idempotencyKey }`, loads Firestore issue/candidates server-side, persists `agentRuns` and `agentSteps`, and UI renders persisted steps; focused agent tests added; required commands passed. |
| 5 Full lifecycle | Complete | Status transitions now require operator rationale and approval docs; resolve requires closure assessment; routing and escalation finalization approvals added; focused lifecycle tests added; required commands passed. |
| 6 UX/accessibility | Complete | Fake phone shell removed; responsive operator workspace added; touched controls gained labels/44px targets/dialog semantics; focused UI regression tests added; required commands passed. |
| 7 Metrics/performance | Complete | Dashboard metrics use persisted fields and split real/demo data; paged issue loading, code splitting, closure image compression, structured logs, readiness, and config validation added; required commands passed. |
| 8 Tests/security | Complete | Release-gate tests cover named security/rules/lifecycle/agent/UI cases; required commands passed. |
| 9 Release/submission | Complete through Cloud Run smoke | License, attribution, architecture, deployment, AI Studio evidence, demo script, Google Doc draft, final evidence report, emulator rules gate, browser a11y/E2E gate, env docs, README, security spec, Cloud Run deployment, and public smoke checks are complete; Google Doc/video/submission still require explicit approval. |

## Milestone 1: Credibility / Truth Boundary
Status: completed on 2026-06-26

Files changed:
- `README.md`, `security_spec.md`, `metadata.json`, and `public/manifest.json`: rewrote project description and security boundary copy to state that CivicLens is a hackathon prototype, not a government portal, and does not file or route complaints to authorities.
- `server.ts`: softened Gemini prompts and fallback action-packet copy from official/SLA/routing language to draft authority suggestions and human-reviewed follow-up windows.
- `src/i18n.ts` and user-facing components: replaced unsupported "file/submit/official/operator portal/autonomous" language with save/prototype/draft/human-review language.
- `src/services/issues.ts`: relabelled Bengaluru demo seed traces and seeded activity records as synthetic sample workflow previews instead of live tool executions or dispatch history.
- `src/truth-boundary.test.ts`: added a focused regression test for high-risk positive claims removed in this milestone.

Validation commands:
- First `npm ci` attempt timed out at 124 seconds with no completion output; rerun with a longer command timeout.
- `npm ci`: passed in about 2 minutes; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (2 test files, 19 tests).
- `npm run build`: passed. Warnings remain from Milestone 0: large JS bundle (`assets/index-DvcWAxyl.js`, 1,287.22 kB / 347.87 kB gzip) and `src/services/issues.ts` dynamic import cannot create a separate chunk because it is also statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.

Decisions:
- Preserved current functionality in Milestone 1 and limited changes to wording, seed labels, and prompt wording. The unsafe data-ownership model remains intentionally documented for Milestone 2/3 rather than hidden.
- Kept current status enum keys such as `Submitted` because canonical enum-key migration belongs to the server-owned data milestone; user-facing copy now avoids treating that enum as proof of external submission.
- Allowed explicit disclaimers such as "not submitted outside CivicLens" and "not official" because those reduce, rather than increase, overclaim risk.

Remaining risks:
- Browser code still writes privileged fields, traces, activity, demo data, and closure/escalation records. This is the primary Milestone 3 target.
- Public operator persona switching and unauthenticated Gemini endpoints were addressed in Milestone 2, but real server-owned lifecycle writes remain for Milestone 3.
- Demo traces are now labelled synthetic, but the UI still renders client-authored traces until the persisted server-agent workflow lands in Milestone 4.
- Bundle size and `src/services/issues.ts` chunking warnings remain for Milestone 7.

## Milestone 2: Identity, Roles, API Perimeter
Status: completed on 2026-06-26

Files changed:
- `server.ts`: added shared API perimeter middleware for security headers, JSON parse/body-size failures, nested oversized-field checks, App Check verification, explicit local-only App Check bypass, Firebase ID-token verification, server-side actor/role resolution, per-user/IP quotas, and stable public error responses.
- `server.ts`: added `GET /api/session` so the browser learns its server-resolved role; restricted `GET /api/admin/health` to real operators; changed `POST /api/issues/update-status` to require real operator role or demo operator role plus `isDemoData == true`.
- `src/server/perimeter.ts`: added testable helpers for operator claim/allowlist resolution, demo operator request handling, local App Check bypass checks, quota buckets, route classification, and nested string-size validation.
- `src/services/api.ts`: added a shared browser API client that attaches Firebase ID tokens, the Vite dev local App Check bypass header, and explicit demo-operator headers.
- `src/App.tsx`, `src/components/Header.tsx`, `src/components/OperatorQueue.tsx`, and `src/components/OperatorDetailView.tsx`: removed public real-operator switching, exposed Google sign-in, and limited demo desk views/actions to synthetic demo cases.
- `src/components/VerificationPanel.tsx`: removed the public citizen status-transition control.
- `.env.example`, `README.md`, and `security_spec.md`: documented operator allowlist, local App Check bypass, and demo operator switches.
- `src/server/perimeter.test.ts`: added focused perimeter tests.

Validation commands:
- `npm ci`: passed in 57 seconds; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (3 test files, 26 tests).
- `npm run build`: passed. Warnings remain: large JS bundle (`assets/index-CckJ1GGY.js`, 1,287.60 kB / 348.22 kB gzip) and `src/services/issues.ts` dynamic import cannot create a separate chunk because it is also statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.

Decisions:
- Local development App Check bypass requires the explicit `X-CivicLens-Local-AppCheck-Bypass: true` request header, is restricted to local non-production requests, and is documented by `CIVICLENS_LOCAL_APP_CHECK_BYPASS`.
- Real operator status changes require a verified Firebase ID token plus a server role source: custom claim/role or verified allowlisted email.
- Demo operator mode is separate from real operator mode and can only change issue status after the server loads the issue and confirms `isDemoData == true`.
- The operator queue now shows real cases only for real operators and synthetic demo cases for demo operators.

Remaining risks:
- The browser still creates issues, support/verification docs, issue counts, evidence records, translations, agent traces/plans, closure assessments, escalation records, demo seed records, and some activity entries directly. Milestone 3 must move these writes behind Admin SDK endpoints and Firestore transactions.
- Firestore rules are still too broad and no `storage.rules` file exists.
- The App Check production path is implemented server-side but needs Firebase App Check token wiring before deployed production smoke tests.
- Quotas are in-memory and suitable only as a local/prototype perimeter; Milestone 7 should make this deployment-safe.
- `/api/agent/run` is now authenticated but still accepts browser-supplied issue/candidate objects until Milestone 4 moves it to `{ issueId, idempotencyKey }` and persisted server-authored runs.

## Milestone 3: Server-Owned Data Integrity
Status: completed on 2026-06-26

Files changed:
- `server.ts`: added Admin SDK endpoints for issue creation, duplicate evidence attachment, support, community verification, translations, activity recording, agent trace/plan saves, closure assessment saves, escalation draft saves, and synthetic demo seed/clear.
- `server.ts`: used Firestore transactions/idempotency for issue creation, evidence attachment, support, and verification/count updates.
- `src/services/issues.ts`: routed report creation, evidence merge, support, verification, translations, activity, trace/plan, closure assessment, escalation draft, and demo seed/clear through server endpoints instead of direct client issue writes.
- `firestore.rules`: rewrote rules so signed-in clients can read issue data but cannot create/update/delete issue documents or issue-owned subcollections.
- `storage.rules`: added user-scoped image upload paths for report, evidence, and closure images with MIME and 5 MB size restrictions.
- `src/server/data-integrity.test.ts`: added focused checks for server-owned Firestore rules, Storage Rules, and transaction endpoint coverage.

Validation commands:
- `npm ci`: passed in 42 seconds; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (4 test files, 29 tests).
- `npm run build`: passed. Warnings remain: large JS bundle (`assets/index-DVFt9RUL.js`, 1,274.37 kB / 344.08 kB gzip) and `src/services/issues.ts` dynamic import cannot create a separate chunk because it is also statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.

Decisions:
- Browser uploads are still allowed for image bytes, but only to user-scoped Storage paths; issue documents and lifecycle fields are now written by server endpoints.
- Demo seed/clear moved to server endpoints. The old large client-side seed implementation is made unreachable by an early server call and should be deleted when the issue service is decomposed, but it no longer executes in normal flow.
- Trace/plan, closure, and escalation saves now go through Admin SDK endpoints. Full persisted `agentRuns`/`agentSteps` is intentionally deferred to Milestone 4.
- Firestore rules deny direct issue writes outright instead of trying to maintain a fragile client-writable allowlist.

Remaining risks:
- Emulator-backed Firestore/Storage rules tests are still missing; the current tests verify rule text and endpoint coverage only. Full emulator coverage belongs to Milestone 8.
- Some helper code for the old demo seed remains unreachable in `src/services/issues.ts`; remove it during service decomposition.
- `/api/verify-resolution`, `/api/escalation`, and `/api/resolution-plan` still accept browser-supplied issue facts for model prompts. `/api/agent/run` was moved to server-loaded issue state in Milestone 4.
- Count recomputation is transaction-protected for new server endpoints, but existing pre-M3 data may still contain client-authored legacy fields until migrated or reseeded.

## Milestone 4: Genuine Persisted Agent Workflow
Status: completed on 2026-06-26

Files changed:
- `server.ts`: changed `POST /api/agent/run` to accept `{ issueId, idempotencyKey }`, load canonical issue data from Firestore, load nearby candidate issues server-side, execute bounded Gemini function calls, and persist top-level `agentRuns/{runId}` plus issue-linked/run-linked step documents.
- `server.ts`: added `GET /api/issues/{issueId}/agent-runs/latest` for persisted run retrieval and updated issue `latestAgentRunId`, `agentTrace`, `resolutionPlan`, and `priorityScore` from server-side run output.
- `src/services/api.ts`: added `runAgentForIssue` and `fetchLatestAgentRun`.
- `src/components/IssueDetailPage.tsx`: removed browser-supplied issue/candidate payloads and client trace/plan saves; the page now requests server runs and renders returned/latest persisted steps.
- `src/components/AgentTraceTimeline.tsx`: renders persisted server tool-step names in order instead of assuming only the old client-synthesized trace labels.
- `src/server/agent-workflow.test.ts`: added focused checks that the server loads by `issueId`, persists `agentRuns`/`agentSteps`, and the UI no longer sends candidates or saves traces itself.

Validation commands:
- `npm ci`: passed in 49 seconds; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (5 test files, 31 tests).
- `npm run build`: passed. Warnings remain: large JS bundle (`assets/index-CPJmvn2w.js`, 1,273.77 kB / 343.82 kB gzip) and `src/services/issues.ts` dynamic import cannot create a separate chunk because it is also statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.

Decisions:
- Persisted `agentRuns` are top-level documents for easy audit lookup; steps are also written under both `agentRuns/{runId}/steps` and `issues/{issueId}/agentSteps` to keep the issue-linked evidence path explicit.
- The agent still returns a draft resolution plan to support the existing UI, but consequential actions remain labelled as human-approval-gated.
- The UI intentionally ignores legacy `issue.agentTrace` when rendering the detail-page agent timeline and loads the latest persisted run instead.

Remaining risks:
- The tool loop is persisted and server-loaded, but approval/action packet documents are not yet a full lifecycle contract. Milestone 5 must add approval records and enforce merge/routing/escalation/resolve/reopen decisions.
- The Gemini loop still depends on model tool-call compliance. More deterministic fallback sequencing and retry telemetry should be added in Milestone 8.
- Existing legacy documents may still have old `agentTrace` arrays; the UI now favors persisted runs where present.

## Milestone 5: Civic Lifecycle and Human Approvals
Status: completed on 2026-06-26

Files changed:
- `server.ts`: lifecycle status transitions now require an operator rationale, create issue approval records, and populate lifecycle timestamps (`triagedAt`, `assignedAt`, `workStartedAt`, `resolvedAt`, `reopenedAt`) where applicable.
- `server.ts`: resolving now requires existing closure evidence/assessment; closure recommendation still does not auto-resolve.
- `server.ts`: added explicit routing/action-packet approval and escalation-finalization endpoints that create approval records and activity entries.
- `firestore.rules`: added read-only client access for `approvals` and `agentSteps`; writes remain server-only.
- `src/services/issues.ts` and `src/components/OperatorDetailView.tsx`: threaded operator rationale into status changes and added UI actions for routing approval and escalation finalization.
- `src/server/lifecycle.test.ts`: added focused tests for closure-before-resolve, approval records, rationale threading, and rules ownership.

Validation commands:
- `npm ci`: passed in 48 seconds; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (6 test files, 34 tests).
- `npm run build`: passed. Warnings remain: large JS bundle (`assets/index-CFr-BE-_.js`, 1,276.27 kB / 344.36 kB gzip) and `src/services/issues.ts` dynamic import cannot create a separate chunk because it is also statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.

Decisions:
- Used approval subcollection documents for human decisions instead of treating activity messages as approvals.
- Kept the existing four status enum keys for now; reopen is represented by server-owned `reopenedAt` and approval records until canonical enum migration is tackled.
- Routing and escalation approvals record human approval for manual outside-app use; they still do not submit anything externally.

Remaining risks:
- The UI exposes basic approval buttons, but a richer approval workspace with rationale templates and approval history belongs to Milestone 6.
- Duplicate merge is still represented through server-owned evidence attachment rather than a dedicated merge approval document. This should be expanded in Milestone 8 release tests or a follow-up lifecycle hardening pass.
- Existing legacy documents may lack closure/timestamp fields until they move through the new lifecycle endpoints or are reseeded.

## Milestone 6: Responsive Product Design and Accessibility
Status: completed on 2026-06-26

Files changed:
- `src/components/MobileFrame.tsx`: removed the fake phone/status-bar/home-bar shell and replaced it with a full-width responsive application shell.
- `src/App.tsx`: changed the operator route into a responsive desktop queue/detail workspace with a mobile fallback, selected-case empty state, and safer load-error copy.
- `src/components/OperatorQueue.tsx`: added embedded/selected state support, converted case rows to accessible buttons, enlarged demo and refresh controls, and exposed selected-case state with `aria-pressed`.
- `src/components/OperatorDetailView.tsx`: added embedded mode, a desktop review/approval grid, larger lifecycle/approval targets, dialog semantics for status confirmation, and explicit operator rationale labeling.
- `src/components/Header.tsx`: allowed header controls to wrap on small screens and added accessible labels/pressed states plus 44px control targets for navigation, language, persona, dashboard, and auth controls.
- `src/ui-responsive.test.ts`: added regression coverage for the responsive shell, operator workspace, accessible queue rows, and dialog semantics.

Validation commands:
- `npm ci`: passed in 51 seconds; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (7 test files, 36 tests).
- `npm run build`: passed. Warnings remain: large JS bundle (`assets/index-D5loy_Kl.js`, 1,277.45 kB / 344.34 kB gzip) and `src/services/issues.ts` dynamic import cannot create a separate chunk because it is also statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.

Decisions:
- Kept the `MobileFrame` component name to avoid a broad rename, but changed its implementation to a real app shell.
- Used a side-by-side operator desk only at large breakpoints; mobile still shows queue/detail as separate focused screens.
- Preserved the ink/paper/marigold/teal visual identity while avoiding a decorative fake-device presentation.

Remaining risks:
- This milestone added source-level UI regression tests but did not run browser/screenshot accessibility checks; full viewport and axe-style coverage belongs to Milestone 8.
- Several older components still use compact visual treatment and should be revisited during the release UI/E2E pass.
- Build still has the known large-bundle and ineffective dynamic-import warnings; Milestone 7 should address code splitting and payload strategy.

## Milestone 7: Metrics, Performance, and Reliability
Status: completed on 2026-06-26

Files changed:
- `src/types.ts`: added optional lifecycle timestamp fields (`createdAt`, `triagedAt`, `verifiedAt`, `assignedAt`, `workStartedAt`, `closureSubmittedAt`, `resolvedAt`, `reopenedAt`, `updatedAt`) to the issue type.
- `src/services/issues.ts`: added `fetchIssuesPage` with bounded page size, timestamp cursor, `hasMore`, and `nextCursor`; kept `fetchRecentIssues` as a first-page compatibility wrapper.
- `src/App.tsx`, `src/components/LandingPage.tsx`, and `src/components/OperatorQueue.tsx`: added issue pagination/load-more state and controls; lazy-loaded operator queue/detail and dashboard routes; lazy-loaded the map from the landing page.
- `src/components/ImpactDashboard.tsx`: rebuilt metrics so real records and synthetic demo records are separated; resolution rates show "Not enough data" below a minimum denominator; resolution time uses stored created/resolved timestamps instead of estimating from current age.
- `src/components/ClosureVerificationPanel.tsx`: compresses closure "after" evidence before upload and Gemini verification.
- `server.ts`: added structured JSON logs for startup, API requests, API errors, and Gemini retries; added runtime config validation, Cloud Run-compatible `PORT`, and `/readyz` plus `/api/readyz` readiness endpoints.
- `src/server/perimeter.ts`: classifies readiness endpoints as health routes so they do not require App Check/Auth.
- `vite.config.ts`: added manual chunks for Firebase, Maps, Motion, and icons.
- `src/reliability-performance.test.ts`: added focused tests for pagination, persisted dashboard metrics, readiness/logging/config, code splitting, and closure image compression.

Validation commands:
- `npm ci`: passed in 57 seconds; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (8 test files, 40 tests).
- `npm run build`: passed. Output now includes separate chunks for `HomeMap` (5.20 kB / 2.50 kB gzip), `ImpactDashboard` (8.07 kB / 2.27 kB gzip), `OperatorQueue` (8.34 kB / 2.44 kB gzip), `OperatorDetailView` (25.19 kB / 8.33 kB gzip), `maps` (42.25 kB / 13.92 kB gzip), `motion` (96.79 kB / 31.98 kB gzip), `icons` (26.95 kB / 7.38 kB gzip), app index (355.11 kB / 104.07 kB gzip), and `firebase` (716.39 kB / 179.17 kB gzip). Warnings remain: Firebase chunk is larger than 500 kB, and `src/services/issues.ts` is still both dynamically and statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.

Decisions:
- Dashboard metrics are scoped to loaded real records or loaded synthetic demo records and explicitly avoid claiming complete city history.
- Resolution-time metrics require persisted `resolvedAt` plus stored creation time; otherwise the UI reports "Not enough data."
- Kept client Firestore reads for the feed but added a page cursor and load-more controls; server-owned writes remain unchanged.
- Used readiness endpoints to report deployability instead of crashing local development when optional local secrets are absent.

Remaining risks:
- Pagination uses a timestamp cursor; duplicate timestamps could make a future page boundary less precise than a document-snapshot cursor. Emulator/integration tests should harden this in Milestone 8.
- The Firebase vendor chunk still exceeds the 500 kB warning threshold; deeper SDK import decomposition or route-level Firebase loading remains a release optimization.
- Readiness/config validation has not been smoke-tested in Cloud Run; deployment requires Firebase/GCP credentials.
- Source-level tests were added, but performance budgets, browser traces, accessibility audits, and E2E pagination behavior belong to Milestone 8.

## Milestone 8: Release Tests and Security Evidence
Status: completed on 2026-06-26

Files changed:
- `src/server/release-security.test.ts`: added release-gate coverage for protected API rejection, App Check/auth/quotas/body-size controls, demo-only operator mutation limits, one support/verification action per user, illegal transitions, closure-before-resolve, SSRF-restricted image fetching, persisted agent steps, idempotent agent runs, and human-approval tools.
- `src/server/release-rules-matrix.test.ts`: added Firestore/Storage rules matrix checks for server-owned issue/audit/approval/agent writes, user role self-assignment denial, owner-scoped image paths, MIME limits, size limits, and catch-all deny rules.
- `src/release-golden-path.test.ts`: added golden-path and accessibility regression coverage for report analysis, duplicate decision, evidence merge, persisted case creation, persisted agent run loading, community verification, resolution plan, escalation draft, routing approval, closure verification, skip link, dialog semantics, `aria-label`, `aria-pressed`, and 44px target markers.

Validation commands:
- `npm ci`: passed in 46 seconds; 450 packages installed/audited; 0 vulnerabilities. Warnings: deprecated `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (11 test files, 52 tests).
- `npm run build`: passed. Warnings remain: Firebase chunk is larger than 500 kB (`assets/firebase-DfUh0SdN.js`, 716.39 kB / 179.17 kB gzip), and `src/services/issues.ts` is still both dynamically and statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.

Decisions:
- Added source-level release gates first so named security and lifecycle requirements fail close to the code they protect; Firebase Emulator Suite and browser E2E tooling were added in the Milestone 9 readiness pass.
- Kept named release cases explicit in test names/assertions so future changes fail close to the product/security requirement they violate.
- Treated transaction race tests as a documented release gap rather than claiming a parallel emulator harness ran.

Remaining risks:
- Firestore Rules and Storage Rules now have both source/rules-matrix coverage and a focused emulator gate, but the emulator gate covers representative release cases rather than every possible rule path.
- Transaction/concurrency behavior is verified by transaction/idempotency source coverage, not a parallel emulator race harness.
- Golden-path and accessibility coverage now includes source-level checks plus a Playwright/axe browser gate for seeded emulator flows; a live Gemini/Maps deployed run still requires production secrets.
- Deployment smoke tests were later completed in the Cloud Run checkpoint below; final public screenshot/video packaging still requires approval.

## Milestone 9: Docs, Demo, and GCP Readiness
Status: completed locally on 2026-06-26

Files changed:
- `LICENSE`: added MIT license text.
- `ATTRIBUTIONS.md`: added direct libraries, Google technologies, demo image sources, and local review skills used as checklists.
- `ARCHITECTURE.md`: added stack, trust boundary, data flow, collections, API groups, controls, and known gaps.
- `README.md`: updated current stack, prototype boundary, docs index, local setup, validation, and deployment status.
- `security_spec.md`: updated current security boundary, server-owned data, human approval requirements, agent boundary, upload/URL safety, validation evidence, and remaining gaps.
- `.env.example`: removed fake secret-looking values and added Maps env descriptions.
- `docs/DEPLOYMENT_CLOUD_RUN.md`: added local production check, Cloud Run command shape, smoke tests, and rollback notes.
- `docs/AI_STUDIO_EVIDENCE.md`: added evidence capture instructions without inventing screenshots or URLs.
- `docs/DEMO_SCRIPT.md`: added a judge-facing truthful demo flow and explicit uncreated external link status.
- `docs/GOOGLE_DOC_DRAFT.md`: added Google Doc-ready content for problem, solution, features, Google technologies, architecture/safety, testing, limitations, and demo instructions.
- `docs/FINAL_EVIDENCE_REPORT.md`: added final local evidence, validation outputs, completed tags, blockers, and gaps.
- `src/docs-readiness.test.ts`: added docs readiness tests for required docs, env fake-secret cleanup, and truthful blocker reporting.
- `package.json` and `package-lock.json`: added Firebase Emulator Suite, rules-unit-testing, Playwright, axe-core, and cross-env dev tooling plus `test:rules`, `test:concurrency`, and `test:e2e` scripts.
- `firebase.json`: configured local Firestore, Storage, and Auth emulators against the repository rules files.
- `src/emulator-rules.test.ts`: added Firestore/Storage rules emulator coverage for issue reads, privileged write denials, user profile ownership, owner-scoped upload paths, MIME type limits, and size limits.
- `playwright.config.ts` and `e2e/release-gates.pw.ts`: added the browser release gate for responsive landing and synthetic demo operator flows with seeded emulator data, overflow checks, and axe serious/critical accessibility checks.
- `src/lib/firebase.ts` and `.env.example`: added explicit opt-in Vite Firebase emulator connection settings for local browser tests.
- `src/components/HomeMap.tsx`, `src/components/IssueListWithFilter.tsx`, `src/components/LandingPage.tsx`, and `src/components/OperatorQueue.tsx`: darkened low-contrast text surfaced by axe checks while preserving the existing visual identity.

Validation commands:
- `npm ci`: passed in about 2 minutes; 880 packages installed and 881 audited. The install audit reported 3 moderate dev-dependency vulnerabilities; the production audit below is clean. Warnings: deprecated `json-ptr@3.1.1`, `node-domexception@1.0.0`, and `glob@10.5.0`.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (12 test files passed, 2 emulator-only files skipped by default; 57 tests passed, 7 skipped).
- `npm run build`: passed. Warnings remain: Firebase chunk is larger than 500 kB (`assets/firebase-DO9hihec.js`, 717.41 kB / 179.53 kB gzip), and `src/services/issues.ts` is still both dynamically and statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 emulator rules test file, 3 tests) against the Firestore and Storage emulators. Expected emulator denial warnings appeared for intentionally rejected writes.
- `npm run test:concurrency`: passed (1 Firestore emulator test file, 4 tests). Expected duplicate/conflict warnings appeared for intentionally raced support, verification, duplicate evidence, and status-transition writes.
- `npm run test:e2e`: passed (4 Playwright/Chromium tests) against Auth/Firestore/Storage emulators and Vite; checks cover mobile, tablet, desktop, synthetic demo operator queue, horizontal overflow, and axe serious/critical violations.
- Local production start probe: `NODE_ENV=production PORT=3101 node dist/server.cjs` started successfully; `GET /health` returned 200. `GET /readyz` returned 503 because `GEMINI_API_KEY` was absent, with startup warnings for empty `CIVICLENS_OPERATOR_EMAILS` and missing server-side `GOOGLE_MAPS_PLATFORM_KEY`.
- Placeholder/secret scan: release-facing docs and `.env.example` did not contain fake key values or pending license/attribution copy; matches remained only in negative test assertions.

Decisions:
- Chose MIT license for the local prototype.
- Recorded deployment, public URL, Google Doc, demo video, and final submission as blocked rather than inventing links or evidence.
- Kept Cloud Run instructions as command shapes and required smoke tests because real project/region/secrets require user account choices.
- Recorded the local production readiness probe as config-blocked rather than passing readiness without required secrets.
- Added focused emulator/browser gates at the documentation-readiness stage so the final local evidence includes executed Firestore/Storage Rules and responsive accessibility checks without claiming deployed production behavior.

Remaining risks:
- Public Cloud Run deployment and smoke tests require Firebase/GCP credentials, billing, and explicit approval.
- Production readiness requires `GEMINI_API_KEY` and the intended operator/maps configuration before `/readyz` can pass.
- Public Google Doc and demo video still need to be created and verified by the user or in an approved deployment/submission turn.
- Transaction/concurrency behavior now has focused parallel Firestore emulator coverage for support, verification, duplicate evidence, and status-transition writes; a full API-level race matrix remains future hardening.
- Browser E2E uses seeded synthetic emulator data; live Gemini/Maps golden-path evidence still requires production secrets and deployment approval.

## Completion Audit Follow-up: Status, Trace, and Concurrency Hardening
Status: completed locally on 2026-06-26

Files changed:
- `src/constants/status.ts`, `src/types.ts`, `src/services/issues.ts`, and status-rendering components: migrated stored issue lifecycle state to canonical enum keys (`submitted`, `verified`, `in_progress`, `resolved`) while deriving human-readable labels in UI code.
- `server.ts` and `src/services/issues.ts`: removed browser-supplied privileged agent trace arrays from resolution plan, closure assessment, and escalation saves; stored resolution plans are now generated from server-loaded issue data, and server endpoints append server-generated trace entries for those actions.
- `server.ts`, `src/components/AgentTraceTimeline.tsx`, `src/server/agent-workflow.test.ts`, and `src/server/release-security.test.ts`: aligned the persisted agent loop with the required tool names (`search_nearby_cases`, `compare_candidate_evidence`, `calculate_priority`, `find_responsible_authority`, `draft_action_packet`, `request_human_approval`, `verify_closure`, `record_event`) and structured grounding source metadata.
- `src/emulator-concurrency.test.ts` and `package.json`: added `npm run test:concurrency`, a focused Firestore emulator harness that races duplicate support, verification, evidence, and status-transition writes.
- `README.md`, `ARCHITECTURE.md`, `security_spec.md`, `docs/FINAL_EVIDENCE_REPORT.md`, and this log: updated validation and remaining-risk language to match the implemented hardening.
- `docs/CODEX_MASTER_PLAN.md`: marked locally verified checklist items complete and left only credential/account-gated screenshot, deployed smoke-test, and public URL/evidence items unchecked.
- `docs/evidence/README.md`: added real-evidence capture rules so future screenshots/URLs are recorded without placeholders.

Validation commands:
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed after the status/trace hardening (12 test files passed, 2 emulator-only files skipped by default; 57 tests passed, 7 skipped).
- `npm run build`: passed after the server-owned resolution-plan change; known Firebase chunk and `src/services/issues.ts` mixed import warnings remain.
- `npm audit --omit=dev`: passed after the server-owned resolution-plan change; 0 vulnerabilities.
- `npm run test:concurrency`: passed (1 emulator test file, 4 tests). Expected emulator duplicate/conflict warnings appeared for intentionally raced writes.
- `npm run test:e2e`: passed after the operator resolution-plan widget change (4 Playwright/Chromium tests).
- Local production start probe after the server-owned resolution-plan change: `/health` returned 200; `/readyz` returned 503 because `GEMINI_API_KEY` is not set locally.
- Placeholder/secret scan: release-facing docs and `.env.example` did not contain fake key values or pending license/attribution copy.
- Stale-source scan: browser-authored resolution-plan and privileged-trace persistence patterns were absent from implementation code; matches remained only in negative test assertions.
- Full final validation was rerun after the documentation updates; results are recorded in `docs/FINAL_EVIDENCE_REPORT.md`.

Decisions:
- Kept legacy display strings supported only as read-time normalization so old local documents can render, but all new writes use canonical status keys.
- Treated closure, escalation, resolution plans, and resolution trace entries as server evidence only. The browser may request work, but cannot supply privileged trace arrays or persisted plan objects.
- Documented the new concurrency gate as focused coverage, not exhaustive proof of every mutation race path.
- Kept deployment smoke testing, real screenshot capture, and public URL/evidence recording unchecked in the master plan because they require external account access and explicit approval.

Remaining risks:
- The focused concurrency harness covers support, community verification, duplicate evidence, and status-transition races. It does not yet exhaustively race every API mutation path.
- External deployment, live Gemini/Maps golden-path evidence, public URLs, Google Doc publication, demo video, and final submission remain approval/credential-gated.

## Pre-Deployment Closeout: Config, App Check, and Cloud Run Readiness
Status: completed locally on 2026-06-26

Files changed:
- `server.ts` and `src/server/admin-config.ts`: replaced hardcoded Admin SDK project/database setup with env-driven `FIREBASE_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT`, and `FIRESTORE_DATABASE_ID` resolution; default Firestore database is `(default)`.
- `src/lib/firebase.ts`, `src/lib/firebase-config.ts`, `src/services/api.ts`, and `src/services/api-headers.ts`: added Vite Firebase web config support, safe fallback to public `firebase-applet-config.json`, frontend App Check initialization when a site key exists, and `X-Firebase-AppCheck` API headers when tokens are available.
- `src/services/issues.ts`: removed unreachable old client-side synthetic demo seed/clear Firestore write branches after the server API returns.
- `src/components/LandingPage.tsx`, `README.md`, `security_spec.md`, `ARCHITECTURE.md`, `docs/GOOGLE_DOC_DRAFT.md`, `docs/DEPLOYMENT_CLOUD_RUN.md`, `docs/FINAL_EVIDENCE_REPORT.md`, and `.env.example`: replaced unsupported public wording, documented build-time Vite config, runtime Admin config, optional App Check enforcement, and manual Cloud Run setup.
- `Dockerfile`, `.dockerignore`, and `cloudbuild.yaml`: added Docker/Cloud Build image support that accepts only public browser config as build args and keeps `GEMINI_API_KEY` runtime-only.
- `playwright.config.ts`, `e2e/release-gates.pw.ts`, and `package.json`: moved E2E emulator runs to `demo-civiclens` with synthetic Firebase web config instead of old project-specific identifiers.
- `src/server/admin-config.test.ts`, `src/lib/firebase-config.test.ts`, `src/services/api-headers.test.ts`, `src/docs-readiness.test.ts`, `src/server/release-security.test.ts`, and `src/truth-boundary.test.ts`: added regression coverage for Admin config, Firebase web config, App Check headers, deployment docs, removed wording, and stale client write removal.

Validation commands:
- `npm ci`: passed; 880 packages installed and 881 audited. Install audit still reports 3 moderate dev-dependency vulnerabilities; production audit is clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (15 test files passed, 2 emulator-only files skipped by default; 71 tests passed, 7 skipped).
- `npm run build`: passed; known warnings remain for the Firebase chunk over 500 kB and `src/services/issues.ts` mixed static/dynamic import.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 Firestore/Storage emulator test file, 3 tests). Expected deny-rule warnings appeared for negative cases.
- `npm run test:concurrency`: passed (1 Firestore emulator test file, 4 tests). Expected duplicate/conflict warnings appeared for intentionally raced writes.
- `npm run test:e2e`: passed (4 Playwright/Chromium tests) against `demo-civiclens` Auth/Firestore/Storage emulators.
- Local production probe: `NODE_ENV=production PORT=3199 FIREBASE_PROJECT_ID=demo-civiclens FIRESTORE_DATABASE_ID=(default) node dist/server.cjs`; `/health` returned 200 and `/readyz` returned 503 because production secrets/config were intentionally absent.

Decisions:
- Kept service-account JSON out of the deployment path; Cloud Run should use Application Default Credentials.
- Kept `CIVICLENS_REQUIRE_APP_CHECK=false` as the documented pre-deployment default. Production should flip it to `true` only after the deployed frontend has `VITE_FIREBASE_APP_CHECK_SITE_KEY` baked in and verified `X-Firebase-AppCheck` requests.
- Treated Vite Firebase/Maps/App Check values as build-time public config and server/Admin/Gemini/operator values as runtime config.
- Kept demo mode available only as an explicit synthetic path; old client-side direct seed/clear writes were removed.

Remaining risks:
- Cloud Run deployment, public URL verification, live Gemini/Maps golden-path proof, App Check enforcement smoke test, screenshots, Google Doc publication, demo video, and submission remain external/approval-gated.
- Production readiness requires real `GEMINI_API_KEY`, Firebase/GCP project setup, intended Firestore database, Maps browser key restrictions, operator authorization, and optional App Check domain configuration.

## Production Firebase Rules and Secret Manager Checkpoint
Status: completed on 2026-06-26

Files changed:
- `firebase.json`: pinned Firestore Rules deployment to the production named database `ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa` so Firebase CLI does not fall back to `(default)`.
- `docs/CODEX_PROGRESS.md` and `docs/FINAL_EVIDENCE_REPORT.md`: recorded production rules, Secret Manager, validation, and remaining Cloud Run status without secret values.

Production actions:
- Firestore Rules dry-run compiled successfully for project `gen-lang-client-0871796745` and database `ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa`.
- Firestore Rules deployed successfully to `cloud.firestore/ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa`.
- Storage Rules dry-run compiled successfully for project `gen-lang-client-0871796745`.
- Storage Rules deployed successfully to the Firebase Storage release for `gen-lang-client-0871796745`.
- Secret Manager secret `GEMINI_API_KEY` exists with version `1` in state `ENABLED`. The value was loaded from ignored local `.env.production.local`; no secret value is recorded in repository docs.

Validation commands:
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (15 test files passed, 2 emulator-only files skipped by default; 71 tests passed, 7 skipped).
- `npm run build`: passed with known warnings for the Firebase chunk over 500 kB and `src/services/issues.ts` mixed static/dynamic import.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 Firestore/Storage emulator test file, 3 tests).
- `npm run test:concurrency`: passed (1 Firestore emulator test file, 4 tests).

Decisions:
- Cleared the ambient `DEBUG` environment variable for Firebase CLI secret metadata/version commands because debug logging can include API request bodies.
- Did not deploy Cloud Run, publish URLs, change billing, delete resources, or submit anything in this checkpoint.
- Kept `.env.production.local` ignored and untracked.

Remaining risks:
- Cloud Run deployment and public `/health` and `/readyz` smoke tests are the next external approval step.
- Production App Check enforcement remains off until the deployed frontend site key and `X-Firebase-AppCheck` request path are smoke-tested.
- Live Gemini/Maps golden-path evidence still requires the approved deployed environment.

## GitHub Sync Checkpoint
Status: completed on 2026-06-27

Files changed:
- `docs/CODEX_PROGRESS.md` and `docs/FINAL_EVIDENCE_REPORT.md`: recorded GitHub sync evidence without secret values.

Repository actions:
- Confirmed the working folder was `C:\Users\apexm\Downloads\civiclens-`.
- Confirmed local history included production checkpoint commit `522e5b1`.
- Added `origin` as `https://github.com/amanmaqsood/civiclens.git` because no remote was configured locally.
- Detected the remote default branch as `main`.
- Fetched `origin/main` and found an unrelated older GitHub history. Created merge commit `9474060` with the local release tree and remote history as the second parent, then pushed to `main` without force.
- Pushed milestone and release tags to GitHub.
- Browser-verified the GitHub repository was public, README rendered, latest commit was visible, `docs/`, `LICENSE`, and `ATTRIBUTIONS.md` were visible, and the root repository listing did not show `.env.production.local`.

Secret scan:
- Ran tracked-file `git grep` checks for Gemini key assignment, private key markers, Firebase Admin SDK service-account naming, Google browser key-shaped values, and `.env.production.local`.
- No private key, service-account, or local production env file was tracked.
- The only Google key-shaped tracked value was the expected public Firebase browser config in `firebase-applet-config.json`; the value was not printed.

Remaining risks:
- Cloud Run deployment was later completed in the Cloud Run checkpoint below.
- Public app smoke tests, live Gemini/Maps evidence, screenshots, Google Doc publication, demo video, and submission remain external/approval-gated.

## Cloud Run Deployment and Public Smoke Checkpoint
Status: completed on 2026-06-27

Files changed:
- `src/App.tsx`: waited for Firebase anonymous auth before loading the Firestore issue feed so production rules do not produce a public load error.
- `server.ts`: fixed the closure verifier response sanitizer shadowing bug and omitted undefined optional closure image fields before writing Firestore assessments.
- `index.html`: changed the browser title from autonomous-agent language to `CivicLens - Civic Issue Reporting Prototype`.
- `docs/CODEX_PROGRESS.md` and `docs/FINAL_EVIDENCE_REPORT.md`: recorded the deployed URL, revision, commit, validation outputs, smoke results, and limitations.

Production actions:
- Approved `gcloud auth login` was completed and the active project was set to `gen-lang-client-0871796745`.
- Required Google services were enabled for Cloud Run, Artifact Registry, Cloud Build, Secret Manager, and related deployment flow.
- Artifact Registry repository `civiclens` was created in `asia-southeast1`.
- Secret Manager secret `GEMINI_API_KEY` remained runtime-only; Cloud Run uses `GEMINI_API_KEY=GEMINI_API_KEY:latest`.
- The Cloud Run runtime service account was granted least-privilege `roles/secretmanager.secretAccessor` on `GEMINI_API_KEY`.
- The existing AI Studio/source-created Cloud Run service needed stale source/build annotations removed before image deployment; after that, normal image deploys succeeded.
- Final deployed image: `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:fcf8946`.
- Final Cloud Build ID: `13a7b4ed-50a2-438b-b139-5020ccb1f0c4`.
- Final image digest: `sha256:5970094fceabbec2a244c4552a252664110c7f95556ecf541a45d6eb108f9ba8`.
- Final Cloud Run revision: `civiclens-00034-82x`, serving 100 percent traffic.
- Canonical service URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Alternate service URL: `https://civiclens-802067002365.asia-southeast1.run.app`.
- Project/region: `gen-lang-client-0871796745` / `asia-southeast1`.
- Firestore database: `ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa`.
- Deployment timestamp recorded during final doc update: `2026-06-27T06:15:47.5789177+05:30`.

Validation commands:
- After `src/App.tsx` auth-load fix: `npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev` passed.
- After closure sanitizer fix: `npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev` passed.
- After undefined closure image fix: `npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev` passed.
- After prototype title fix: `npm run lint` passed, `npm test` passed (15 files passed, 2 skipped; 71 tests passed, 7 skipped), `npm run build` passed with known Firebase chunk/mixed-import warnings, and `npm audit --omit=dev` passed with 0 vulnerabilities.
- Final `/health`: 200 on both Cloud Run hostnames.
- Final `/readyz`: 200 on both Cloud Run hostnames with `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`, and the expected warning that `CIVICLENS_REQUIRE_APP_CHECK` is not true.

Public smoke results:
- Browser smoke on the final deployed URL loaded `CivicLens - Civic Issue Reporting Prototype`, showed CivicLens branding, synthetic/prototype labels, issue/feed text, the map surface, and the report action; console errors were empty; unsupported autonomous/official/government filing language was absent from title and body.
- Playwright viewport smoke passed at desktop `1440x900` and mobile `390x844`: no console errors, no horizontal overflow, map/report action visible, synthetic/prototype label visible, and unsupported language absent.
- Final live API smoke against commit `fcf8946` passed: Gemini triage returned success with confidence `0.9`; synthetic issue `smoke-fcf8946-7319a90e` was saved with status `submitted`; `/api/agent/run` created persisted run `smoke-fcf8946-7319a90e_agent-smoke-fcf8946-7319a90e` with 8 server tool steps; fetching the latest run twice preserved the same trace.
- Operator boundary smoke passed: anonymous citizen status transition was denied with 403; demo operator was denied with 403 on the non-demo smoke issue; demo operator successfully transitioned synthetic demo issue `JOaqBXiJNnyWgWqfqpwI` from `in_progress` to `submitted`.
- Closure smoke passed: Gemini returned a closure recommendation of `resolve`, closure assessment was persisted, and the demo issue remained `submitted` rather than being auto-resolved.

Decisions:
- Deployed with `VITE_FIREBASE_MEASUREMENT_ID` empty because the Firebase web config did not provide a measurement ID and the user explicitly approved deploying with it empty.
- Kept `CIVICLENS_REQUIRE_APP_CHECK=false` for this public smoke because no production App Check site key was baked into the frontend. This is recorded as a readiness warning, not hidden.
- Used API-backed synthetic image smoke for report save/Gemini/agent/closure after Chrome file-upload automation was blocked by the Codex browser extension file URL setting.

Remaining risks:
- App Check backend enforcement is disabled until a Firebase App Check site key is configured for the Cloud Run domain and browser requests are verified with `X-Firebase-AppCheck`.
- The Maps browser key is now restricted to the final Cloud Run origins and localhost.
- The final smoke created synthetic non-demo report documents and mutated one synthetic demo document; all smoke titles/descriptions are labelled synthetic/prototype.
- Cloud Build install stage still reports 3 moderate dev-dependency vulnerabilities, while runtime `npm ci --omit=dev` and local `npm audit --omit=dev` report 0 production vulnerabilities.
- Chrome UI file upload automation remained blocked; browser and API smoke covered the deployed flow, but manual photo upload should still be checked with Chrome extension file URL access enabled or by a human.
- Google Doc publication, demo video/public screenshots, final deployed audit packaging, and BlockseBlock submission were not performed and still require explicit approval.

## Final Evidence, Public-Key Restriction, and Google Doc Preparation Checkpoint
Status: public evidence captured; authenticated console screenshots still pending on 2026-06-27

Files changed:
- `docs/GOOGLE_DOC_DRAFT.md`: expanded into final copy-ready Google Doc content with live app/GitHub links, demo-video status, problem statement, journey, features, agent workflow, Google technologies, architecture, human oversight, metrics, testing/deployment evidence, screenshot checklist, limitations, attributions, and links.
- `docs/FINAL_EVIDENCE_REPORT.md` and `docs/CODEX_PROGRESS.md`: recorded the final evidence checkpoint, public health/readiness checks, Maps key restrictions, App Check enforcement wording, validation results, public screenshot capture, and authenticated-console screenshot blocker.
- `docs/evidence/final/`: added public Chrome/Playwright page-content screenshots plus `PUBLIC_SCREENSHOT_MANIFEST-2026-06-27.json`.
- `README.md`: updated deployment status to state that Maps key restrictions are now applied and App Check enforcement remains disabled for judge access.
- `src/docs-readiness.test.ts`: aligned the documentation readiness assertion with the now-real public app and GitHub links while continuing to guard against unclaimed demo-video and screenshot evidence.

Production actions:
- Confirmed public `/health` returned 200 with `status: ok`, `service: civiclens`, and `mode: production`.
- Confirmed public `/readyz` returned 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`, no missing config, and the expected App Check enforcement-disabled warning.
- Confirmed Cloud Run service `civiclens` in `asia-southeast1` serves revision `civiclens-00034-82x` at 100 percent traffic.
- Confirmed the configured Maps browser key is distinct from the Firebase browser API key and not used for server-side Maps calls by the current code.
- Restricted the Maps browser key resource `projects/802067002365/locations/global/keys/40791961-8f4f-4f92-8a0b-292dbfe48c88` to HTTP referrers `https://civiclens-py7ixxgroq-as.a.run.app/*`, `https://civiclens-802067002365.asia-southeast1.run.app/*`, and `http://localhost:*`, with API target `maps-backend.googleapis.com`.

Validation commands:
- `npm run lint`: passed (`tsc --noEmit`).
- First `npm test`: failed because the expanded Google Doc draft used a banned high-risk phrase inside a negative disclaimer; the phrase was reworded to `public-agency status`.
- `npm test` after the wording fix: passed (15 files passed, 2 skipped; 71 tests passed, 7 skipped).
- `npm run build`: passed with known Firebase chunk-size and `src/services/issues.ts` mixed static/dynamic import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- After adding public screenshots and updating screenshot-status wording, `npm run lint` passed, the first `npm test` run failed because `src/docs-readiness.test.ts` still expected the older no-screenshot guard, the assertion was updated to the authenticated-console screenshot guard, `npm test` then passed again (15 files passed, 2 skipped; 71 tests passed, 7 skipped), `npm run build` passed with the same known warnings, and `npm audit --omit=dev` passed with 0 vulnerabilities.

Screenshot status:
- Public, non-authenticated screenshots were captured with Chrome through a Playwright page-content fallback and recorded in `docs/evidence/final/PUBLIC_SCREENSHOT_MANIFEST-2026-06-27.json`.
- Captured public targets include app homepage, report flow start, synthetic/demo label, map, saved issue detail, persisted agent tool steps, post-refresh persisted trace, demo operator synthetic-only view, live 403 API denial for demo operator on a non-demo issue, closure recommendation with status timeline, desktop layout, mobile layout, `/health` 200, `/readyz` 200, and the public GitHub repository page.
- Headless page-content screenshots do not include the browser address bar; exact URLs are recorded in the manifest and evidence docs.
- Authenticated Cloud Run/Firebase/Secret Manager/AI Studio console screenshots remain pending because Chrome extension communication failed twice and opening a fresh Chrome window/profile requires user permission.

Decisions:
- Kept `CIVICLENS_REQUIRE_APP_CHECK=false` and documented the exact truth boundary: App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.
- Did not change billing, delete resources, rotate keys, print secret values, publish a Google Doc, publish a demo video, submit to BlockseBlock, or make unrelated product changes.

Remaining risks:
- Authenticated GCP/Firebase/AI Studio screenshot package still needs capture in an authenticated Chrome session after the user approves opening a fresh Chrome window/profile or captures them manually.
- Google Doc publication, optional demo video, and BlockseBlock submission still require explicit user action/approval.
- Production App Check enforcement remains disabled until a Firebase App Check site key is configured and verified on the public deployment.

## Decision log
- 2026-06-26: Initialized a valid project-local Git repository because the existing `.git` directory was empty/invalid and Git was resolving to `C:/Users/apexm`.
- 2026-06-26: Captured the untouched prototype before dependency repair as commit `ffd4ebc` and tag `baseline/original-prototype`.
- 2026-06-26: Regenerated `package-lock.json` because it was zero bytes and made `npm ci` unusable.
- 2026-06-26: Upgraded `firebase-admin` to `^14.1.0` and overrode transitive `uuid` to `^11.1.1` because the required audit gate failed on moderate production vulnerabilities. Node `v22.22.2` satisfies the new Admin SDK engine requirement.
- 2026-06-26: Chose not to change product behavior in Milestone 0 beyond dependency hygiene required to make the baseline validation gate pass.
- 2026-06-26: Chose prototype/draft/human-review language for all unsupported government, routing, SLA, and autonomous claims; kept explicit negative disclaimers where useful.
- 2026-06-26: Added a targeted truth-boundary regression test to prevent reintroducing the highest-risk removed claim phrases.
- 2026-06-26: Added a server-resolved role model with verified operator allowlist/custom-claim support and explicit synthetic demo operator mode.
- 2026-06-26: Kept demo operator mode enabled by default for local development but protected it with an explicit header and server-side `isDemoData` checks; production must opt in deliberately.
- 2026-06-26: Removed public citizen status-transition UI and real-operator persona switching; the header now shows operator/demo desk access only when `/api/session` reports it.
- 2026-06-26: Moved issue-owned writes behind Admin SDK endpoints and hardened Firestore rules to deny direct client writes to issue documents and subcollections.
- 2026-06-26: Added Storage Rules for user-owned report/evidence/closure image paths rather than allowing arbitrary bucket writes.
- 2026-06-26: Changed the agent API contract from browser-supplied issue/candidates to server-loaded `issueId` plus idempotent persisted run records.
- 2026-06-26: Added human approval records for lifecycle transitions, routing/action packets, and escalation finalization; resolving requires closure evidence.
- 2026-06-26: Removed the fake phone frame/status bar and moved the operator experience to a responsive queue/detail workspace at desktop breakpoints.
- 2026-06-26: Scoped dashboard metrics to loaded real/demo records, added paged issue loading, and added readiness/logging/chunking instead of presenting recent records as complete history.
- 2026-06-26: Added source-level release-gate tests for named security, rules, lifecycle, agent, UI, and golden-path cases.
- 2026-06-26: Completed local release documentation and final evidence without fabricating deployment, Google Doc, demo video, or submission status.
- 2026-06-26: Added Firebase Emulator Suite rules tests and Playwright/axe browser tests for final local release evidence.
- 2026-06-26: Added explicit Vite Firebase emulator opt-in settings so browser tests use local Auth, Firestore, and Storage instead of production services.
- 2026-06-26: Migrated stored issue statuses to canonical enum keys and kept display labels UI-only.
- 2026-06-26: Removed browser-authored privileged trace persistence for resolution, closure, and escalation endpoints.
- 2026-06-26: Changed persisted resolution-plan saves to generate from server-loaded issue data instead of browser-posted plan objects.
- 2026-06-26: Added a focused Firestore emulator concurrency gate for duplicate same-user support and verification writes.
- 2026-06-26: Replaced hardcoded Admin SDK project/database setup with env-driven Cloud Run/ADC-compatible config.
- 2026-06-26: Added frontend Firebase `VITE_*` config support and App Check token headers while keeping backend enforcement explicitly opt-in until deployed smoke tests.
- 2026-06-26: Added Dockerfile, Cloud Build config, and Windows PowerShell Cloud Run runbook without performing deployment.
- 2026-06-26: Moved E2E emulator runs to the synthetic `demo-civiclens` project and removed old project-specific identifiers from the browser harness.
- 2026-06-27: Deployed CivicLens to Cloud Run in `asia-southeast1` after explicit user approval, with `VITE_FIREBASE_MEASUREMENT_ID` intentionally empty.
- 2026-06-27: Fixed production-only smoke blockers found during deployment: issue-feed reads now wait for Firebase auth, closure verifier parsing no longer shadows `cleanText`, undefined optional closure image fields are omitted from Firestore writes, and the page title uses prototype language.
- 2026-06-27: Restricted the public Maps browser key to the two Cloud Run origins and localhost with Maps API access only, after confirming it is distinct from the Firebase browser API key and not used for server-side Maps calls.
- 2026-06-27: Prepared the final Google Doc draft and recorded that App Check integration exists while enforcement remains disabled for judge access.

## External blockers
- Google Doc URL, demo video/public screenshot capture, final deployed audit packaging, and BlockseBlock submission require user/account approval before final submission actions.
- Production App Check enforcement requires a Firebase App Check site key and verified public browser tokens before enabling `CIVICLENS_REQUIRE_APP_CHECK=true`.

## Next milestone
External approval/credential step: retry Chrome/GCP/Firebase/AI Studio screenshot capture in an approved authenticated Chrome session, publish the Google Doc/demo video if desired, complete final deployed audit packaging, and submit only after explicit user approval.

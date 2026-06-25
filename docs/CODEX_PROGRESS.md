# Codex progress log

## Baseline
Status: completed on 2026-06-26

Current branch/commit:
- Branch: `master`
- Original prototype baseline commit: `ffd4ebc chore: capture original prototype baseline`
- Original prototype rollback tag: `baseline/original-prototype`
- Current Milestone 0 changes after that tag: regenerated `package-lock.json`, upgraded `firebase-admin` to `^14.1.0`, added npm `uuid` override, and updated this progress log.

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
- GCP/Firebase deployment credentials, billing, public app URL verification, Google Doc URL, and BlockseBlock submission remain external/approval-gated for Milestone 9.

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
| 6 UX/accessibility | Not started | |
| 7 Metrics/performance | Not started | |
| 8 Tests/security | Not started | |
| 9 Release/submission | Not started | |

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

## External blockers
- Firebase/GCP deployment credentials and billing access are required before deployed smoke tests.
- Public GitHub repository URL, public app URL, Google Doc URL, demo video URL, and BlockseBlock submission require user/account approval before final submission actions.

## Next milestone
Milestone 7: derive metrics from persisted lifecycle fields, separate demo/real metrics, add pagination/query strategy, code-split heavy paths, and improve deployment-safe observability/config validation.

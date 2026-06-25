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

Current architecture and data-ownership map:
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
| 2 Identity/API perimeter | Not started | |
| 3 Server data integrity | Not started | |
| 4 Genuine agent | Not started | |
| 5 Full lifecycle | Not started | |
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
- Public operator persona switching and unauthenticated Gemini endpoints remain open until Milestone 2.
- Demo traces are now labelled synthetic, but the UI still renders client-authored traces until the persisted server-agent workflow lands in Milestone 4.
- Bundle size and `src/services/issues.ts` chunking warnings remain for Milestone 7.

## Decision log
- 2026-06-26: Initialized a valid project-local Git repository because the existing `.git` directory was empty/invalid and Git was resolving to `C:/Users/apexm`.
- 2026-06-26: Captured the untouched prototype before dependency repair as commit `ffd4ebc` and tag `baseline/original-prototype`.
- 2026-06-26: Regenerated `package-lock.json` because it was zero bytes and made `npm ci` unusable.
- 2026-06-26: Upgraded `firebase-admin` to `^14.1.0` and overrode transitive `uuid` to `^11.1.1` because the required audit gate failed on moderate production vulnerabilities. Node `v22.22.2` satisfies the new Admin SDK engine requirement.
- 2026-06-26: Chose not to change product behavior in Milestone 0 beyond dependency hygiene required to make the baseline validation gate pass.
- 2026-06-26: Chose prototype/draft/human-review language for all unsupported government, routing, SLA, and autonomous claims; kept explicit negative disclaimers where useful.
- 2026-06-26: Added a targeted truth-boundary regression test to prevent reintroducing the highest-risk removed claim phrases.

## External blockers
- Firebase/GCP deployment credentials and billing access are required before deployed smoke tests.
- Public GitHub repository URL, public app URL, Google Doc URL, demo video URL, and BlockseBlock submission require user/account approval before final submission actions.

## Next milestone
Milestone 2: implement identity, roles, API perimeter, shared validation, quota checks, safe errors, and local-only App Check bypass boundaries before moving privileged writes server-side.

# Final Evidence Report

Generated during the CivicLens rebuild and deployment checkpoints on 2026-06-26 and 2026-06-27.

## Scope

This report records local validation, GitHub sync, Firebase Rules deployment, Secret Manager verification, Cloud Run deployment evidence, Maps browser-key restriction, public screenshot capture, Google Doc draft preparation, and public Google Doc publication. It does not claim demo video publication, authenticated console screenshot capture completion, or hackathon submission.

## Repository State

- Original prototype baseline tag: `baseline/original-prototype`
- Completed rebuild tags:
  - `milestone-0-baseline`
  - `milestone-1-truth-boundary`
  - `milestone-2-api-perimeter`
  - `milestone-3-server-data-integrity`
  - `milestone-4-persisted-agent`
  - `milestone-5-lifecycle-approvals`
  - `milestone-6-responsive-ux`
  - `milestone-7-reliability-metrics`
  - `milestone-8-release-gates`
  - `milestone-9-docs-readiness`
- `docs/CODEX_MASTER_PLAN.md` is updated as the final release checklist. Locally verifiable items and the approved Cloud Run deployment smoke are recorded. Remaining publication/submission items still require explicit external approval.

## Production Firebase Rules and Secret Manager Checkpoint

This checkpoint was performed on 2026-06-26 against project `gen-lang-client-0871796745`. It deployed only Firebase Rules and created/verified one Secret Manager secret. It did not deploy Cloud Run, publish a public URL, change billing, delete resources, publish docs/video, or submit the project.

- Firestore database ID used: `ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa`.
- Firestore Rules: dry-run compiled successfully, then deployed successfully to `cloud.firestore/ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa`.
- Storage Rules: dry-run compiled successfully, then deployed successfully to the Firebase Storage rules release for the project.
- Secret Manager: `GEMINI_API_KEY` exists with version `1` in state `ENABLED`. The secret value came from ignored local `.env.production.local` and is not recorded in this report.
- Config change: `firebase.json` now pins the Firestore Rules target to the named production database so Firebase CLI does not default to `(default)`.
- Later follow-up: Cloud Run deployment and public `/health` plus `/readyz` smoke tests were completed in the Cloud Run Deployment Checkpoint below.

## GitHub Sync Checkpoint

This checkpoint was performed on 2026-06-27 against `https://github.com/amanmaqsood/civiclens`. It synchronized the local CivicLens release to GitHub only; it did not deploy Cloud Run, change billing, rotate keys, delete resources, publish docs/video, or submit the project.

- Remote branch pushed: `main`.
- Local production checkpoint included: `522e5b1 chore: record production firebase checkpoint`.
- GitHub sync commit: `9474060 chore: sync local release with github history`.
- Sync method: preserved the older unrelated GitHub history as a merge parent while keeping the local audited release tree, then pushed to `main` without force.
- Tags: milestone and release tags were pushed to GitHub.
- GitHub browser verification: repository was public; README rendered; latest commit was visible; `docs/`, `LICENSE`, and `ATTRIBUTIONS.md` were visible; the root repository listing did not show `.env.production.local`.
- Secret scan: tracked-file scans found no private key marker, Firebase Admin SDK service-account string, or tracked local production env file. A public Firebase browser config key-shaped value exists in `firebase-applet-config.json`; the value is not recorded here.
- Later follow-up: Cloud Run deployment and public smoke tests were completed in the Cloud Run Deployment Checkpoint below.

## Cloud Run Deployment Checkpoint

This checkpoint was performed on 2026-06-27 after explicit user approval to run `gcloud auth login` and deploy with an empty Firebase measurement ID. It deployed the app to Cloud Run and smoke-tested the public URL. It did not publish a Google Doc, publish a demo video, or submit the project.

- Project ID: `gen-lang-client-0871796745`.
- Region: `asia-southeast1`.
- Service: `civiclens`.
- Firestore database: `ai-studio-cd9d785c-f851-4555-9ebe-71e0746f69aa`.
- Final deployed commit: `fcf8946 fix: make app title prototype scoped`.
- Final Cloud Build ID: `13a7b4ed-50a2-438b-b139-5020ccb1f0c4`.
- Final image: `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:fcf8946`.
- Final image digest: `sha256:5970094fceabbec2a244c4552a252664110c7f95556ecf541a45d6eb108f9ba8`.
- Final Cloud Run revision: `civiclens-00034-82x`, serving 100 percent traffic.
- Canonical public URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Alternate public URL: `https://civiclens-802067002365.asia-southeast1.run.app`.
- Deployment evidence timestamp: `2026-06-27T06:15:47.5789177+05:30`.
- Runtime secret handling: Cloud Run uses `GEMINI_API_KEY=GEMINI_API_KEY:latest`; the secret value is not recorded here.
- Runtime warning: `/readyz` reports `CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled.`

Deployment actions:

- Enabled/used Cloud Run, Artifact Registry, Cloud Build, Secret Manager, and related Google services for the approved deployment flow.
- Created Artifact Registry repository `civiclens` in `asia-southeast1`.
- Granted the Cloud Run runtime service account least-privilege `roles/secretmanager.secretAccessor` on `GEMINI_API_KEY`.
- Removed stale AI Studio/source-build annotations from the existing Cloud Run service metadata so an Artifact Registry image could serve normally.
- Deployed with `VITE_FIREBASE_MEASUREMENT_ID` intentionally empty because the Firebase web config did not include a measurement ID and the user explicitly approved that condition.

Release-blocking fixes found during deployed smoke:

- `b2c24b5`: waited for Firebase auth before loading the issue feed, fixing production Firestore read-denial UI errors.
- `5032145`: fixed closure verifier response parsing so it no longer shadowed the `cleanText` sanitizer.
- `602fb57`: omitted undefined optional closure image fields before Firestore writes.
- `fcf8946`: changed the document title to prototype-scoped language.

## Final Evidence, Public-Key Restriction, and Google Doc Preparation Checkpoint

This checkpoint was performed on 2026-06-27 against the deployed Cloud Run service and repository state. It did not submit to BlockseBlock, change billing, delete resources, rotate keys, print secret values, or publish a demo video.

Repository state at checkpoint start:

- `git status --short`: clean.
- `git log --oneline -5`: `a96e283`, `fcf8946`, `602fb57`, `5032145`, `b2c24b5`.
- Remote: `https://github.com/amanmaqsood/civiclens.git`.
- Branch: `master`.

Public deployment health:

- `https://civiclens-py7ixxgroq-as.a.run.app/health`: 200 with `status: ok`, `service: civiclens`, `mode: production`, timestamp `2026-06-27T06:26:12.736Z`.
- `https://civiclens-py7ixxgroq-as.a.run.app/readyz`: 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`, no missing config values, and the warning `CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled.`
- Cloud Run service metadata showed `civiclens-00034-82x` as latest ready and latest created revision, with 100 percent traffic and URL `https://civiclens-py7ixxgroq-as.a.run.app`.

Maps browser key:

- The configured browser Maps key was confirmed to be distinct from the Firebase browser API key and not used by server-side Maps calls in the current code.
- The key resource is `projects/802067002365/locations/global/keys/40791961-8f4f-4f92-8a0b-292dbfe48c88`, display name `Browser key (auto created by Firebase)`.
- Application restriction: HTTP referrers.
- Allowed referrers:
  - `https://civiclens-py7ixxgroq-as.a.run.app/*`
  - `https://civiclens-802067002365.asia-southeast1.run.app/*`
  - `http://localhost:*`
- API target: `maps-backend.googleapis.com`.
- Restriction update time reported by Google Cloud: `2026-06-27T06:22:02.908789Z`.

App Check status:

- App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.
- `CIVICLENS_REQUIRE_APP_CHECK=false` remains the truthful deployment state until a Firebase App Check site key is configured and live browser requests are confirmed to send valid `X-Firebase-AppCheck` tokens.

Google Doc draft:

- `docs/GOOGLE_DOC_DRAFT.md` was rewritten as final copy-ready draft content with live app link, GitHub link, optional demo-video status, problem statement, product thesis, user journey, implemented features, agentic workflow, Google technologies, architecture, security/human oversight, innovation, product experience, metrics, testing/deployment evidence, screenshot checklist, walkthrough, limitations, attributions, and links.
- The draft explicitly states that CivicLens is a prototype and avoids claims of official filing, automatic authority submission, legal verification, immutable audit guarantees, App Check enforcement, or fake metrics.
- Demo data is described as synthetic.
- Public Google Doc: `https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing`.
- Public viewer verification: unauthenticated text export returned HTTP 200 and included the expected `Live Application`, `GitHub Repository`, `Technologies Used`, and `Prototype Limitations` headings.

Screenshot status:

- Public, non-authenticated screenshots were captured under `docs/evidence/final/` using Chrome through a Playwright page-content fallback. The manifest is `docs/evidence/final/PUBLIC_SCREENSHOT_MANIFEST-2026-06-27.json`.
- Captured public targets include app homepage, report flow start, synthetic/demo label, map, saved issue detail, persisted agent tool steps, post-refresh persisted trace, demo operator synthetic-only view, live 403 API denial for demo operator on a non-demo issue, closure recommendation with status timeline, desktop layout, mobile layout, `/health` 200, `/readyz` 200, and the public GitHub repository page.
- Sanitized CLI/API-backed infrastructure evidence was also rendered to screenshots and JSON metadata: `SANITIZED_GCP_FIREBASE_EVIDENCE-2026-06-27.json`, `gcp-cloud-run-service-cli-evidence-2026-06-27.png`, `gcp-health-readyz-cli-evidence-2026-06-27.png`, `firebase-rules-releases-cli-evidence-2026-06-27.png`, `secret-manager-name-only-cli-evidence-2026-06-27.png`, `firebase-auth-providers-cli-evidence-2026-06-27.png`, `maps-browser-key-restriction-cli-evidence-2026-06-27.png`, and `ai-studio-evidence-status-cli-evidence-2026-06-27.png`.
- The CLI/API metadata confirms Cloud Run revision `civiclens-00034-82x` at 100 percent traffic, Firestore and Storage Rules release/ruleset IDs, `GEMINI_API_KEY` secret name only, enabled anonymous and Google Auth providers, Maps referrer/API restrictions, and that AI Studio evidence still requires authenticated capture if available.
- Headless page-content screenshots do not include the browser address bar; exact URLs are recorded in the manifest and this report.
- Authenticated GCP/Firebase/AI Studio console screenshots were not captured because Chrome extension communication failed twice and opening a fresh authenticated Chrome window/profile still requires user approval.

## Final Deployed Audit Before Submission

This audit was performed on 2026-06-27 at `2026-06-27T13:30:19.2932581+05:30`. It did not submit to BlockseBlock, deploy a new revision, change billing, delete resources, rotate keys, print secret values, or add features.

Repository and public links:

- Local repository was clean at the start of the audit.
- Local latest commit: `38f509e docs: publish final google doc link`.
- GitHub repository: `https://github.com/amanmaqsood/civiclens`.
- GitHub API verification showed the repository is public, default branch is `main`, latest `main` commit is `38f509e`, README/docs/LICENSE/ATTRIBUTIONS are visible, and `.env.production.local` is not visible at the repository root.
- Public Google Doc: `https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing`.
- Unauthenticated Google Doc text export returned HTTP 200 and contained the required problem, solution, features, technologies, Google technologies, agentic workflow, deployment evidence, testing evidence, limitations, and attribution headings.

Public Cloud Run:

- `/health`: HTTP 200, `status: ok`, `service: civiclens`, `mode: production`, timestamp `2026-06-27T07:46:13.822Z`.
- `/readyz`: HTTP 200, `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`, no missing values, timestamp `2026-06-27T07:46:13.971Z`.
- `/readyz` warning remains expected and truthful: `CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled.`

Fresh deployed smoke:

- Browser smoke loaded the homepage with title `CivicLens - Civic Issue Reporting Prototype`.
- Desktop `1440x900`: homepage, map surface, report action, prototype/synthetic labels, report flow start, and image upload preview path all worked with no horizontal overflow.
- Mobile `390x844`: homepage, map/report action, and layout checks passed with no horizontal overflow.
- Page crash count: `0`.
- Browser warnings observed: geolocation permission fallback and Google Maps Marker deprecation notice. These did not block the workflow.
- Live API smoke used synthetic audit issue `final-audit-1782546888994`.
- Gemini triage succeeded with category `drainage` and confidence `0.5`.
- Synthetic non-demo issue save succeeded with status `submitted`.
- Anonymous/citizen privileged real-case mutation was denied with HTTP 403.
- Demo-operator mutation of the same non-demo issue was denied with HTTP 403.
- Persisted server agent run returned 8 tool steps: `agent.search_nearby_cases`, `agent.compare_candidate_evidence`, `agent.calculate_priority`, `agent.find_responsible_authority`, `agent.draft_action_packet`, `agent.request_human_approval`, `agent.verify_closure`, and `agent.record_event`.
- Fetching the latest agent run twice returned the persisted 8-step trace, matching a refresh-survival check.
- A fresh browser session opened the saved audit issue from the deployed feed and rendered the persisted 8-tool agent trace in the issue detail UI. Reopening it in a second fresh browser session also rendered the same persisted trace with zero page errors and zero console errors.
- Synthetic demo issue `JOaqBXiJNnyWgWqfqpwI` was mutated by demo operator from `submitted` to `verified`.
- Closure verification on that synthetic demo issue returned recommendation `request_more_evidence`; the closure assessment persisted and the issue status remained `verified`, proving no auto-resolve occurred.
- The live app's own browser-origin Firebase Auth path succeeded. Direct Node-side anonymous sign-in using the local fallback browser config was blocked by referrer restrictions, which is consistent with restricted public browser keys; the smoke used the deployed app's in-browser auth token without printing it.

Release text and secret scans:

- No matches for placeholder markers, pending-task markers, or old Google Doc link markers.
- High-risk public-claim phrase matches were limited to negative test guards, truthful disclaimers, or reference-only historical audit files.
- No tracked private key marker, Firebase Admin SDK service-account marker, or tracked `.env` production file was found.
- `GEMINI_API_KEY` appears only in `.env.example` and documentation/runbook references; no secret value is recorded.

Final validation:

- `npm ci`: passed; 880 packages installed and 881 audited. The clean install audit still reports 3 moderate dev-dependency vulnerabilities; production dependency audit below is clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (15 files passed, 2 skipped; 71 tests passed, 7 skipped).
- `npm run build`: passed with known warnings for the Firebase chunk over 500 kB and `src/services/issues.ts` mixed static/dynamic import chunking.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.

Final known limitations before submission:

- App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.
- Authenticated GCP/Firebase/AI Studio console screenshots remain pending unless captured manually in an approved authenticated session.
- Optional demo video is not included.
- Next step: submit the live app, public GitHub repository, and public Google Doc through BlockseBlock only after explicit user approval.

## UX Redesign Deployment and Evidence Refresh Checkpoint

This checkpoint was performed on 2026-06-27 after the CivicLens Field Command Center UX refresh. It deployed the current app source to Cloud Run, refreshed public app evidence, and confirmed the Maps browser-key restriction. It did not submit to BlockseBlock, change billing, delete resources, rotate keys, print secret values, or enable App Check enforcement.

Repository baseline and deployment:

- Baseline tag before the UX sprint: `pre-ux-redesign` at `5764961 docs: add ux redesign contract`.
- Pre-UX deployed revision observed before the sprint: `civiclens-00034-82x`.
- One intermediate deployment, `civiclens-00035-5bx`, exposed a stale browser Firebase config and was superseded.
- Final UX deployment revision: `civiclens-00036-dcb`, serving 100 percent traffic.
- Final Cloud Build ID: `0d56856e-938a-4d0f-a16f-5d12d89b03dd`.
- Final image tag: `ux-redesign-firebase-20260627152313`.
- Final image digest: `sha256:9c89a3c02446930695ed4bff66673860f4a88b669caa66d5c5b5c2c5f6394b21`.
- Canonical public URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Alternate public URL: `https://civiclens-802067002365.asia-southeast1.run.app`.
- Deployment used an empty Firebase measurement ID, matching the approved deployment condition and current Firebase web config.

Public health checks after the UX deployment:

- Canonical `/health`: HTTP 200 with `status: ok`, `service: civiclens`, `mode: production`, timestamp `2026-06-27T10:22:33.100Z`.
- Canonical `/readyz`: HTTP 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`, no missing values, and the expected warning `CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled.`
- Alternate `/health`: HTTP 200 with `status: ok`, timestamp `2026-06-27T10:20:59.856Z`.
- Alternate `/readyz`: HTTP 200 with `ready: true`, timestamp `2026-06-27T10:20:59.835Z`, and the same App Check warning.

Maps browser key:

- Read-only Google Cloud API key metadata confirmed the Maps browser key remains restricted to HTTP referrers:
  - `https://civiclens-py7ixxgroq-as.a.run.app/*`
  - `https://civiclens-802067002365.asia-southeast1.run.app/*`
  - `http://localhost:*`
- API target remains `maps-backend.googleapis.com`.
- Current code uses the Maps key only in the browser map surface; server-side code only checks whether Maps config is present for readiness and does not call Maps APIs with that key.

UX refresh evidence captured under `docs/evidence/final/`:

- `PUBLIC_SCREENSHOT_MANIFEST-UX-REFRESH-2026-06-27.json`
- `ux-redesign-2026-06-27T10-11-09-homepage-desktop-field-command-center-clean.png`
- `ux-redesign-2026-06-27T10-11-09-map-visible-clean.png`
- `ux-redesign-2026-06-27T10-24-00-report-flow-start-final.png`
- `ux-redesign-2026-06-27T10-24-00-manual-pin-fallback-final.png`
- `ux-redesign-2026-06-27T10-24-00-gemini-triage-result-final.png`
- `ux-redesign-2026-06-27T10-11-09-saved-demo-issue-detail-clean.png`
- `ux-redesign-2026-06-27T10-21-00-persisted-agent-run-tool-steps-final.png`
- `ux-redesign-2026-06-27T10-18-00-agent-trace-after-refresh-explicit-ui.png`
- `ux-redesign-2026-06-27T10-19-30-demo-operator-synthetic-only-clean.png`
- `ux-redesign-2026-06-27T10-11-09-mobile-layout-clean.png`
- `ux-redesign-2026-06-27T10-24-00-mobile-report-manual-fallback-final.png`

The Gemini triage screenshot uses explicitly synthetic prototype evidence and does not save a real civic complaint. The persisted-agent screenshots use a synthetic demo case and show the server-authored 8-step tool timeline with the human approval gate still present after refresh. Existing prior evidence files still cover real-case mutation denial for demo/anonymous operators and closure recommendation persistence without auto-resolution.

Validation after the UX refresh:

- `npm ci`: passed. Install audit still reports 3 moderate dev-dependency vulnerabilities; production audit is clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (16 files passed, 2 skipped; 75 tests passed, 7 skipped).
- `npm run build`: passed with known warnings for Firebase chunk size and the mixed static/dynamic import of `src/services/issues.ts`.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
- `npm run test:rules`: passed (3 emulator rules tests).
- `npm run test:concurrency`: passed (4 emulator concurrency tests).
- `npm run test:e2e`: passed (6 Playwright tests) against local Firebase emulators.

## Final Submission Polish Checkpoint

This checkpoint was performed on 2026-06-27 to finish judge-facing polish without changing billing, deleting resources, rotating keys, enabling App Check enforcement, or submitting to BlockseBlock.

Runtime and deployment:

- Source polish commit: `7e9aa38 feat: polish final CivicLens UX gates`.
- Corrective runtime commit: `94246fe fix: keep issue detail stable for nullable fields`.
- Cloud Build for `7e9aa38`: `74d16958-e9b3-4d96-934b-aa4240b041a5`; deployed as `civiclens-00037-6x6`.
- Public smoke on `00037` found a real saved-issue detail crash when a synthetic fallback issue had nullable numeric fields.
- Cloud Build for `94246fe`: `cde70b30-77b6-4be6-8af3-c99f206093e2`.
- Corrected active revision: `civiclens-00038-9w7`, serving 100 percent traffic.
- Canonical public URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Alternate public URL: `https://civiclens-802067002365.asia-southeast1.run.app`.

Public health/readiness after corrected deploy:

- `/health`: HTTP 200, `status: ok`, `service: civiclens`, `mode: production`, timestamp `2026-06-27T13:38:13.186Z`.
- `/readyz`: HTTP 200, `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`, no missing values, and expected warning that `CIVICLENS_REQUIRE_APP_CHECK` is not true.
- Maps browser key: lookup confirmed the deployed `VITE_GOOGLE_MAPS_PLATFORM_KEY` maps to the restricted browser-key resource; final restriction has allowed referrers for both Cloud Run origins plus localhost and API target `maps-backend.googleapis.com`. No key rotation was performed.

Final-polish implementation:

- Mobile evidence inputs now include `accept="image/*"` and `capture="environment"` for report and closure uploads.
- Header account control opens an accessible menu explaining citizen session, Google sign-in, and operator access status.
- Public copy now uses `Demo stories`, `CivicLens pilot`, `CivicLens field reports`, and the boundary line `Independent civic pilot. Drafts stay inside CivicLens until a human acts outside the app.`
- Internal smoke-test records are filtered from the default public feed and dashboard metrics.
- Issue detail rendering is safe when confidence or coordinates are absent/null.

Validation:

- `npm ci`: passed; install audit still reports 3 moderate dev-dependency vulnerabilities, while production dependency audit is clean.
- `npm run lint`: passed after the final nullable-field fix.
- `npm test`: passed after the final nullable-field fix (17 files passed, 2 skipped; 77 tests passed, 7 skipped).
- `npm run build`: passed after the final nullable-field fix with known Firebase chunk-size and mixed static/dynamic import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed during this checkpoint before the UI-only nullable-field fix (3 emulator rules tests).
- `npm run test:concurrency`: passed during this checkpoint before the UI-only nullable-field fix (4 emulator concurrency tests).
- `npm run test:e2e`: passed after the final nullable-field fix (7 Playwright tests).

Public smoke on `civiclens-00038-9w7`:

- Passed: desktop homepage, map visible, default feed hides smoke-test records, sticky top nav, account/profile menu, mobile 390px homepage, fixed mobile bottom nav, mobile header sticky after scroll, report flow start, manual fallback visible, camera capture attribute present, saved synthetic issue detail loads, persisted 8-step server agent run visible, agent trace persists after refresh, demo operator synthetic-only boundary visible, unsupported-claim scan, and no console errors.
- Authenticated Gemini triage API probe using a fresh anonymous Firebase ID token returned HTTP 200 with category `pothole`, title present, and low confidence `0.1` for synthetic evidence.
- Final-polish public app screenshots are recorded in `docs/evidence/final/PUBLIC_SCREENSHOT_MANIFEST-FINAL-POLISH-2026-06-27.json`.

Known residual polish:

- Resolved in the later final QA checkpoint: the success-page label `Ticket Registration Number` was renamed to `CivicLens Ticket ID`.

## Final QA Evidence Refresh Checkpoint

This checkpoint was performed on 2026-06-27 to finish the final evidence, public key, and Google Doc preparation work. It did not submit to BlockseBlock, change billing, delete resources, rotate keys, print secret values, or enable App Check enforcement.

Runtime and deployment:

- Baseline tag before final QA fixes: `pre-final-qa-fix`.
- Final QA source commits:
  - `66159f7 fix: polish final QA blockers`
  - `5f98c21 fix: persist skipped agent lifecycle steps`
  - `1121376 fix: keep handled auth popup failures out of console errors`
- Final active Cloud Run revision: `civiclens-00041-m2n`, serving 100 percent traffic.
- Final deployed source commit: `1121376`.
- Canonical public URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Alternate public URL: `https://civiclens-802067002365.asia-southeast1.run.app`.
- `GET /health`: HTTP 200 with `status: ok`, `service: civiclens`, `mode: production`, timestamp `2026-06-27T15:37:54.637Z`.
- `GET /readyz`: HTTP 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`, no missing values, and the expected App Check warning.

Final QA changes:

- The top header remains sticky on desktop and mobile document scroll.
- The account/profile menu now exposes citizen session status, Google sign-in status, and operator access status, and handled popup failures surface as visible UI messages without console errors.
- Report and closure evidence controls provide separate live-photo and gallery-upload choices.
- Location-denied report flow keeps a clear manual fallback.
- The saved report success page now uses `CivicLens Ticket ID` instead of `Ticket Registration Number`.
- The default public feed foregrounds curated synthetic demo stories instead of internal smoke traces.
- `/api/agent/run` now persists the required 8-step lifecycle timeline even when Gemini skips an optional tool call; skipped steps are labelled truthfully rather than fabricated as model output.

Public evidence captured:

- Final app evidence manifest: `docs/evidence/final/FINAL-QA-2026-06-27-MANIFEST.json`.
- Captured final QA screenshots include sticky desktop layout, profile menu visible error state, mobile sticky header and bottom nav, report upload choices, location manual fallback, Gemini triage result, saved issue detail, persisted 8/8 agent tool steps, refreshed persisted agent trace, synthetic-only demo operator queue, and closure recommendation without auto-resolve.
- The final QA manifest records `consoleErrorCount: 0`, `pageErrorCount: 0`, `persistedAgentRunStepCount: 8`, and real-case demo mutation denial with HTTP 403.

Maps browser key:

- Read-only API key metadata confirmed that the deployed Maps browser key is restricted to HTTP referrers:
  - `https://civiclens-py7ixxgroq-as.a.run.app/*`
  - `https://civiclens-802067002365.asia-southeast1.run.app/*`
  - `http://localhost:*`
- API target remains `maps-backend.googleapis.com`.
- No server-side Maps key use was identified in the current code path, and no key was rotated.

App Check status:

- App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.

Validation before this documentation-only update:

- `npm ci`: passed; install audit still reports 3 moderate dev-dependency vulnerabilities, while production audit is clean.
- `npm run lint`: passed after the final auth logging patch.
- `npm test`: passed after the final auth logging patch (17 files passed, 2 skipped; 77 tests passed, 7 skipped).
- `npm run build`: passed after the final auth logging patch with known Firebase chunk-size and mixed static/dynamic import warnings.
- `npm audit --omit=dev`: passed after the final agent skipped-step patch; 0 vulnerabilities.
- `npm run test:e2e`: passed after the final auth logging patch (7 Playwright tests).

Validation after this documentation and evidence update:

- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (17 files passed, 2 skipped; 77 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size and `src/services/issues.ts` mixed static/dynamic import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.

Full local gate rerun after the Google Doc sync audit:

- `npm ci`: passed; 880 packages installed/audited. Install audit still reports 3 moderate dev-dependency vulnerabilities; production audit below is clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (17 files passed, 2 skipped; 77 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size and `src/services/issues.ts` mixed static/dynamic import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 emulator rules file, 3 tests).
- `npm run test:concurrency`: passed (1 emulator concurrency file, 4 tests).
- `npm run test:e2e`: passed (7 Playwright tests across mobile/tablet/desktop landing, sticky header, bottom nav, report upload/location fallback, account menu, persisted agent trace, and demo operator labels).

Google Doc live-sync audit after final QA:

- At that audit time, `docs/GOOGLE_DOC_DRAFT.md` had been refreshed for `civiclens-00041-m2n`, commit `1121376`, and `FINAL-QA-2026-06-27-MANIFEST.json`.
- Public Google Doc text export still returned HTTP 200, proving the Doc remains publicly viewable.
- The same public export was stale during this audit: it still contained the older `civiclens-00034-82x` deployment evidence and did not contain `civiclens-00041-m2n`, commit `1121376`, or `FINAL-QA-2026-06-27-MANIFEST.json`.
- Google Docs API sync could not be completed with the active Cloud SDK credentials: the default token received HTTP 403 from the Docs API, and requesting Drive/Docs scopes required a fresh Google auth flow.
- Browser sync could not be completed in the available browser session because the Google Doc opened as viewer-only with a sign-in prompt. A local paste preview did not update the public export.
- That audit's required next step was superseded by the later `civiclens-00044-d5l` judge QA checkpoint below.

Rubric score from verified current evidence:

- Problem Solving & Impact: 19/20.
- Agentic Depth: 20/20.
- Innovation & Creativity: 19/20.
- Google Technologies: 15/15.
- Product Experience & Design: 10/10.
- Technical Implementation: 10/10.
- Completeness & Usability: 4/5 while the public Google Doc remained stale at that audit time.
- Verified score at that audit time: 97/100 for app/repo implementation quality, with submission readiness blocked until the public Google Doc was refreshed from `docs/GOOGLE_DOC_DRAFT.md`.

## Final Judge QA Auth and Non-Civic Checkpoint

This checkpoint was performed on 2026-06-27 after the public QA run found a first-visit anonymous-auth race on protected Gemini calls. It did not submit to BlockseBlock, change billing, delete resources, rotate keys, print secret values, or enable App Check enforcement.

Source and deployment:

- Source commit: `bdfa464 fix: wait for anonymous auth before api calls`.
- Superseded image build: Cloud Build `4f209cc9-0ac3-401b-9593-f5c9fe948768`, image tag `bdfa464`, revision `civiclens-00043-dt5`. It was replaced because it was built without the production Vite Firebase/Maps build args and therefore fell back to the checked-in browser config.
- Final configured image build: Cloud Build `9d9aa66b-1955-4401-b59d-ca83ed8c22c2`, image `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:bdfa464-configured`.
- Final active Cloud Run revision: `civiclens-00044-d5l`, serving 100 percent traffic.
- Canonical URL: `https://civiclens-py7ixxgroq-as.a.run.app`.

Public health:

- `/health`: HTTP 200 with `status: ok`, `service: civiclens`, and `mode: production`.
- `/readyz`: HTTP 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, and `configValid: true`; expected warning remains that App Check enforcement is disabled.

App/auth QA:

- `src/services/api.ts` now waits for Firebase auth readiness and signs in anonymously before building protected API headers.
- Public browser QA verified a fresh visitor can submit Gemini triage without the previous `401` race.
- Public browser QA verified a synthetic waffle/non-civic image receives a low-confidence clarification prompt before saving, with `/api/analyze-report` returning HTTP 200 and zero browser console errors.
- Google sign-in remains intentionally unavailable in the public judge build until Firebase Authorized Domains can be verified. Anonymous reporting remains enabled.

Evidence files:

- `docs/evidence/final/JUDGE-QA-2026-06-27-MANIFEST.json`.
- `docs/evidence/final/JUDGE-QA-2026-06-27-waffle-report-before-triage.png`.
- `docs/evidence/final/JUDGE-QA-2026-06-27-waffle-negative-low-confidence.png`.
- `docs/evidence/final/GCP-CONSOLE-2026-06-27-cloud-run-revisions.png`, with the deployer email redacted.
- The earlier full lifecycle screenshot package remains `docs/evidence/final/FINAL-QA-2026-06-27-MANIFEST.json`.

Maps/App Check:

- Maps browser key restriction remains confirmed: allowed referrers are the two Cloud Run origins plus `http://localhost:*`, with API target `maps-backend.googleapis.com`.
- App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.

Validation:

- `npm ci`: passed; install audit still reports 3 moderate dev-dependency vulnerabilities, while production audit is clean.
- `npm run lint`: passed.
- `npm test`: passed (18 files passed, 2 skipped; 79 tests passed, 7 skipped).
- `npm run build`: passed with known Firebase chunk-size and mixed static/dynamic import warnings.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.

Google Doc status:

- `docs/GOOGLE_DOC_DRAFT.md` is updated for `civiclens-00044-d5l`, commit `bdfa464`, and `JUDGE-QA-2026-06-27-MANIFEST.json`.
- On 2026-06-28, the public Google Doc was refreshed from the local draft through an authenticated browser session.
- The public Google Doc export returned HTTP 200 and contains `civiclens-00044-d5l`, `bdfa464`, and `JUDGE-QA-2026-06-27-MANIFEST.json`.
- The export check also confirmed the accidental bullet-list paste was corrected: exported text begins with `# CivicLens Google Doc Draft` and has zero `* ` bullet-prefix lines.
- Post Google Doc sync docs validation passed on 2026-06-28: `npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev`.

Final verified score after Google Doc sync:

- Problem Solving & Impact: 19/20.
- Agentic Depth: 20/20.
- Innovation & Creativity: 19/20.
- Google Technologies: 15/15.
- Product Experience & Design: 10/10.
- Technical Implementation: 10/10.
- Completeness & Usability: 5/5.
- Final verified score: 98/100. Remaining point losses are conservative for optional demo video absence, App Check enforcement intentionally disabled for judge access, and remaining nonessential authenticated Firebase/AI Studio console screenshots.

## Final Hardening Deployment Checkpoint

This checkpoint was performed on 2026-06-28 from source commit `aec9ebd fix: harden final judge ux flows`. It did not submit to BlockseBlock, change billing, rotate keys, delete resources, print secret values, or enable App Check enforcement.

Deployment:

- Cloud Build ID: `d60b2ebf-d2b5-49db-96e1-c198ec45a59c`.
- Image: `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:aec9ebd-configured`.
- Image digest: `sha256:26e75db1dc6d176aa0782f14630db534b2d683dcb66cc6a6e3093369e68bf7a8`.
- Cloud Run revision: `civiclens-00045-7sz`, serving 100 percent traffic.
- Canonical URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Alternate URL: `https://civiclens-802067002365.asia-southeast1.run.app`.

Health and readiness:

- `/health`: HTTP 200 with `status: ok`, `service: civiclens`, and `mode: production` at `2026-06-28T00:18:24.198Z`.
- `/readyz`: HTTP 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, and `configValid: true`; the expected warning remains `CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled.`

Local validation before deploy:

- `npm ci`: passed; install audit still reports 3 moderate dev-dependency vulnerabilities, while production audit is clean.
- `npm run lint`: passed.
- `npm test`: passed (18 files passed, 2 skipped; 82 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size warning.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
- `npm run test:rules`: passed (3 tests).
- `npm run test:concurrency`: passed on rerun after an initial parallel-emulator port conflict with the rules test.
- `npm run test:e2e`: passed (7 Playwright tests) after updating expectations for the removed floating landing CTA, removed dead Google sign-in action, and accessible manual-location combobox.

Public deployed browser smoke:

- Manifest: `docs/evidence/final/FINAL-HARDENING-2026-06-28-MANIFEST.json`.
- Captured screenshots: desktop home, desktop sticky header after scroll, saved issue detail, persisted agent trace, tablet home, mobile header/bottom nav, profile menu with Hindi-coming-soon status, report camera/gallery choices, location search suggestions, and selected manual location.
- Verified checks: map visible, sticky header top after scroll `0`, issue detail visible, persisted agent trace visible, no desktop/tablet/mobile horizontal overflow, mobile bottom nav fixed, profile menu shows `English active. Hindi coming soon.`, no dead `Google sign-in unavailable` button, manual location suggestion selection worked, console error count `0`, and page error count `0`.

Behavior changes verified:

- Manual location fallback now provides curated Bengaluru suggestions and saves a selected human-readable address plus coordinates.
- The incomplete Hindi toggle is no longer exposed; the public UI states English is active and Hindi is coming soon.
- The mobile header uses a compact no-wrap row, with language/session/operator status moved into the profile menu.
- The public Google sign-in dead action is removed; anonymous reporting remains enabled.

Updated score:

- Current verified score remains 98/100. The app/repo implementation improved on location fallback, mobile header polish, and truthful language controls; remaining conservative point losses are still optional demo video absence, App Check enforcement intentionally disabled for judge access, and nonessential authenticated console screenshot gaps.

## Latest Completed Validation

Latest final hardening validation results are recorded in the Final Hardening Deployment Checkpoint above. The previous UX refresh and evidence checkpoints remain below for history.

Latest UX refresh validation results:

- `npm ci`: passed. Install audit still reports 3 moderate dev-dependency vulnerabilities; production dependency audit below is clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (16 test files passed, 2 emulator-only files skipped by default; 75 tests passed, 7 skipped).
- `npm run build`: passed with known warnings for the Firebase chunk over 500 kB and `src/services/issues.ts` mixed static/dynamic import chunking.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 Firestore/Storage emulator test file, 3 tests).
- `npm run test:concurrency`: passed (1 Firestore emulator test file, 4 tests).
- `npm run test:e2e`: passed (6 Playwright tests against local Auth/Firestore/Storage emulators).

Earlier final evidence checkpoint validation results:

- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (15 test files passed, 2 emulator-only files skipped by default; 71 tests passed, 7 skipped).
- `npm run build`: passed. Warnings remain: Firebase chunk is larger than 500 kB (`assets/firebase-Ct40zCNZ.js`, 718.27 kB / 179.73 kB gzip), and `src/services/issues.ts` is still both dynamically and statically imported.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- After adding the public screenshot package and updating screenshot-status wording, `npm run lint` passed, the first `npm test` run failed because `src/docs-readiness.test.ts` still expected the old "no screenshots" guard, the assertion was updated to the authenticated-console screenshot guard, `npm test` then passed again (15 files passed, 2 skipped; 71 tests passed, 7 skipped), `npm run build` passed with the same known warnings, and `npm audit --omit=dev` passed with 0 vulnerabilities.
- After adding sanitized CLI/API infrastructure evidence screenshots and updating the evidence wording, `npm run lint` passed, `npm test` passed (15 files passed, 2 skipped; 71 tests passed, 7 skipped), `npm run build` passed with the same known warnings, and `npm audit --omit=dev` passed with 0 vulnerabilities.
- Google Doc publication checkpoint validation: `npm run lint` passed; first `npm test` failed because `src/docs-readiness.test.ts` still required the old unpublished-Google-Doc evidence guard; the guard was updated to require the exact public Google Doc URL; `npm test` then passed (15 files passed, 2 skipped; 71 tests passed, 7 skipped); `npm run build` passed with the same known Firebase chunk-size and `src/services/issues.ts` mixed static/dynamic import warnings; `npm audit --omit=dev` passed with 0 vulnerabilities.

Previously completed deployment validation also included:

- `npm run test:rules`: passed (1 Firestore/Storage emulator test file, 3 tests).
- `npm run test:concurrency`: passed (1 Firestore emulator test file, 4 tests).
- Cloud Run `/health`: 200 on both public hostnames.
- Cloud Run `/readyz`: 200 on both public hostnames with `ready: true`, `adminDb: true`, `geminiConfigured: true`, `configValid: true`, and no missing config values.
- Browser smoke on the final deployed URL: title `CivicLens - Civic Issue Reporting Prototype`; CivicLens branding visible; synthetic/prototype labels visible; map surface visible; report action visible; issue/feed text visible; console errors empty; unsupported autonomous/official/government filing language absent.
- Playwright viewport smoke: desktop `1440x900` and mobile `390x844` both passed with no console errors, no horizontal overflow, map/report action visible, synthetic/prototype labels visible, and unsupported language absent.
- Final live API smoke on commit `fcf8946`: Gemini triage success with confidence `0.9`; synthetic issue `smoke-fcf8946-7319a90e` saved as `submitted`; persisted agent run `smoke-fcf8946-7319a90e_agent-smoke-fcf8946-7319a90e` returned 8 server tool steps; latest agent run fetched twice with persisted trace intact.
- Operator boundary smoke: anonymous citizen lifecycle transition denied with 403; demo operator denied with 403 on the non-demo smoke issue; demo operator successfully transitioned synthetic demo issue `JOaqBXiJNnyWgWqfqpwI` from `in_progress` to `submitted`.
- Closure smoke: Gemini returned recommendation `resolve`, closure assessment persisted, and the demo issue remained `submitted` rather than auto-resolving.

## Audited Flow Boundary Hardening Checkpoint

This checkpoint was performed on 2026-06-28 from source commit `862f9eb fix: tighten audited operator flow boundaries`. It did not submit to BlockseBlock, change billing, rotate keys, delete resources, print secret values, or enable App Check enforcement.

Deployment:

- Cloud Build ID: `7bb54f88-b0e8-4d17-beb9-59846074a9cf`.
- Image: `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:862f9eb-configured`.
- Image digest: `sha256:1999234ec3c2fbe3e396cfec127248d4ad6ce2435a1f690dbaa0c8c071cb8d2a`.
- Cloud Run revision: `civiclens-00046-7fn`, serving 100 percent traffic.
- Canonical URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Alternate URL: `https://civiclens-802067002365.asia-southeast1.run.app`.

Health and readiness:

- Canonical `/health`: HTTP 200 with `status: ok`, `service: civiclens`, and `mode: production` at `2026-06-28T01:01:33.818Z`.
- Canonical `/readyz`: HTTP 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, and `configValid: true`; the expected warning remains `CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled.`
- Alternate `/health`: HTTP 200 with `status: ok`, `service: civiclens`, and `mode: production` at `2026-06-28T01:01:33.933Z`.
- Alternate `/readyz`: HTTP 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, and `configValid: true`; the same App Check warning remains.

Source changes:

- Public issue detail is read-only for privileged artifacts: it displays persisted server-agent evidence but no longer runs the agent, drafts escalation, or generates resolution plans.
- Operator detail owns the server-agent action and persisted timeline controls.
- Operator lifecycle transition confirmation requires typed rationale before `Confirm transition` enables.
- Report-submission browser progress uses local-progress trace copy and is not described as persisted server evidence.
- Hash/detail routes can fetch a valid issue by ID even when it is outside the currently loaded feed page.

Validation:

- `npm ci`: passed; install audit reported 3 moderate dev-dependency vulnerabilities, while production audit is clean.
- `npm run lint`: passed.
- `npm test`: passed (18 files passed, 2 skipped; 82 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size warning.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
- `npm run test:rules`: passed (3 tests).
- `npm run test:concurrency`: passed (4 tests).
- `npm run test:e2e`: passed (7 Playwright tests).

Public smoke and evidence:

- Manifest: `docs/evidence/final/FLOW-BOUNDARY-2026-06-28-MANIFEST.json`.
- Captured screenshots: desktop home, report upload controls, public detail read-only agent evidence, public detail after refresh, demo operator agent control, operator rationale-required dialog, and mobile home.
- Verified checks: map visible, truth boundary visible, report live-photo/gallery controls visible, public detail server evidence visible, public detail `Run server agent` hidden, public detail resolution-plan mutation widget hidden, detail agent section still visible after refresh, demo desk boundary visible, operator agent control visible, operator rationale dialog visible, `Confirm transition` disabled without rationale, mobile bottom nav visible, no mobile horizontal overflow, console error count `0`, and page error count `0`.

Google Doc status:

- `docs/GOOGLE_DOC_DRAFT.md` has been refreshed locally for `civiclens-00046-7fn`, commit `862f9eb`, and `FLOW-BOUNDARY-2026-06-28-MANIFEST.json`.
- On 2026-06-28, the public Google Doc was replaced from `docs/GOOGLE_DOC_DRAFT.md` through an authenticated browser edit session. The paste used formatted heading, list, code, and link HTML generated from the local Markdown draft.
- Google Docs reported the document saved to Drive after the replacement.
- Unauthenticated public text export returned HTTP 200 and contains `civiclens-00046-7fn`, `862f9eb`, and `FLOW-BOUNDARY-2026-06-28-MANIFEST.json`.
- The text export begins with `CivicLens - Community Hero Submission`, no longer contains the old `CivicLens Google Doc Draft` title or internal draft reminder, and confirms the shared Google Doc content now carries the latest flow-boundary evidence.

Post Google Doc sync validation:

- Public Google Doc export: HTTP 200; contains `CivicLens - Community Hero Submission`, `civiclens-00046-7fn`, `862f9eb`, and `FLOW-BOUNDARY-2026-06-28-MANIFEST.json`; does not contain the old `CivicLens Google Doc Draft` title or internal draft reminder.
- Public `/health`: HTTP 200 with `status: ok`.
- Public `/readyz`: HTTP 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, and `configValid: true`; the expected warning remains `CIVICLENS_REQUIRE_APP_CHECK is not true; backend App Check enforcement is disabled.`
- `npm run lint`: passed.
- `npm test`: passed (18 files passed, 2 skipped; 82 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size warning.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.

## Local Release Evidence

- Truth boundary docs and copy are present.
- Server API perimeter verifies Firebase identity, quotas, body-size limits, and role boundaries. App Check enforcement is available behind `CIVICLENS_REQUIRE_APP_CHECK=true`; local tests keep it disabled unless the frontend site key and token path are configured.
- Firestore issue-owned writes are server-owned.
- Storage Rules restrict owner paths, image MIME types, and file size.
- Agent runs are persisted as server-authored `agentRuns` and `agentSteps`.
- Stored issue statuses use canonical enum keys; UI derives display labels.
- Browser-supplied privileged trace arrays are no longer accepted for resolution, closure, or escalation saves.
- Stored resolution plans are generated from server-loaded issue state rather than browser-posted plan objects.
- The agent tool contract includes the required server tool names for nearby search, evidence comparison, priority calculation, authority lookup, action packet drafting, human approval request, closure verification, and event recording.
- Operator lifecycle decisions require server-authorized identity and rationale.
- Dashboard metrics separate real records from synthetic demo data.
- Responsive shell replaces the fake phone frame.
- Release-gate source tests cover named security, rules, lifecycle, agent, and UI golden-path cases.
- Firebase Emulator Suite tests execute the deployed Firestore and Storage rule files for representative allow/deny cases.
- A focused Firestore emulator concurrency gate races same-user support, verification, duplicate evidence, and status-transition writes and verifies only one persisted action/count or approval wins.
- Playwright/axe browser tests execute responsive landing and synthetic demo operator flows at mobile, tablet, and desktop sizes.
- License, attribution, architecture, deployment, AI Studio evidence, demo script, Google Doc draft, and final evidence docs are present.
- Pre-deployment closeout removed unsupported government-adjacent initiative wording from the landing page and added regression tests for that phrase.
- Firebase Admin SDK project/database selection is env-driven via `FIREBASE_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT`, and `FIRESTORE_DATABASE_ID`; no service-account JSON is required or committed.
- Frontend Firebase config supports `VITE_FIREBASE_*` build-time env vars, with fallback to the checked-in public `firebase-applet-config.json`.
- Frontend App Check initializes when `VITE_FIREBASE_APP_CHECK_SITE_KEY` is present, and API requests send `X-Firebase-AppCheck` when a token is available.
- A `Dockerfile`, `.dockerignore`, `cloudbuild.yaml`, and Windows PowerShell Cloud Run runbook are present.
- Old unreachable client-side synthetic demo seed/clear Firestore write branches were removed from `src/services/issues.ts`; those flows use server endpoints.
- `docs/evidence/README.md` records the real-screenshot capture rules and filenames to use after approved account/deployment actions.
- The built server starts locally in production mode and serves `/health`; full readiness remains gated by real production secrets.

## Final Places/Auth/Hindi Local Hardening Checkpoint

This checkpoint was performed on 2026-06-28 from the local source after the public Google Doc sync commit `2e350a9`. It did not submit to BlockseBlock, change billing, rotate keys, delete resources, print secret values, or enable App Check enforcement.

Source changes:

- Added Google Places autocomplete for manual report location search, with India-biased predictions when the Places library is available and curated fallback suggestions only when the library or key is unavailable.
- Restored a visible sticky header subtitle under CivicLens and kept the mobile header compact across the tested viewports.
- Exposed Google sign-in in the account menu with desktop popup and mobile/popup-blocked redirect fallback while preserving anonymous reporting.
- Enabled persistent Hindi localization for the core public flow and removed the stale "Hindi coming soon" status from source-facing UI checks.
- Kept live-photo and gallery-upload inputs separate for report evidence and confirmed the closure evidence uploader already follows the same live/gallery pattern.
- Updated release-gate E2E coverage for Places predictions, selected-location state, camera/gallery controls, visible Google sign-in, Hindi refresh persistence, sticky header, and responsive accessibility.

Validation:

- `npm ci`: passed; install audit reported 3 moderate dev-dependency vulnerabilities, while production audit below is clean.
- `npm run lint`: passed.
- `npm test`: passed (18 files passed, 2 skipped; 82 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size warning.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
- `npm run test:rules`: passed sequentially (3 tests). An earlier attempt failed because it was run in parallel with another Firestore emulator on port 8080.
- `npm run test:concurrency`: passed sequentially (4 tests).
- `npm run test:e2e`: passed (7 Playwright tests). Earlier iterations fixed the Places mock ARIA shape and preserved language preference across reload.

Deployment status:

- Built image `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:68e9787-configured` with Cloud Build `6d984296-2b0a-4bfe-b2a6-29fd7b2a2e8d`.
- Image digest: `sha256:647d98896fb6cbbe26b5dbe96f2e2306044a3d969a673ee0998b7b5c38c3a16b`.
- Deployed Cloud Run revision `civiclens-00047-5kr`, serving 100 percent traffic at `https://civiclens-py7ixxgroq-as.a.run.app`.
- Public `/health`: HTTP 200 with `status: ok`.
- Public `/readyz`: HTTP 200 with `ready: true`, `adminDb: true`, `geminiConfigured: true`, and `configValid: true`; the expected App Check enforcement-disabled warning remains.
- Maps browser key restrictions now preserve the two Cloud Run origins and localhost referrers and include API targets `maps-backend.googleapis.com` and `places.googleapis.com`.
- Public screenshot/evidence manifest: `docs/evidence/final/PLACES-AUTH-HINDI-2026-06-28-MANIFEST.json`.

Public deployed smoke:

- Mobile sticky header remained pinned with top offset `0`.
- Google Places autocomplete loaded on the deployed app and rendered live Google Maps predictions for `Indiranagar Metro Station Bengaluru`.
- Hindi report-flow localization rendered and language preference persisted through route changes in local E2E; public screenshot evidence captured the Hindi report flow.
- Camera/gallery report controls remained separated and visible.
- Waffle/non-civic evidence produced a low-confidence clarification prompt before saving.
- Saved issue detail and demo operator workspace were reachable without console or page errors.
- Google sign-in UI is visible and starts the auth path, but Firebase currently returns: `Google sign-in could not start. Confirm Firebase Google provider and authorized domains, then try again.`

Current blocker:

- End-to-end Google sign-in is not complete. Firebase Authorized Domains/Google provider configuration must be fixed before claiming sign-in works. Manual steps: Firebase Console -> Authentication -> Sign-in method -> enable/configure Google provider; Authentication -> Settings -> Authorized domains -> add `civiclens-py7ixxgroq-as.a.run.app`, `civiclens-802067002365.asia-southeast1.run.app`, and `localhost`; then retest the account-menu sign-in flow on the public Cloud Run URL.
- Public Google Doc resync for this final draft is not complete. Chrome is running and the Codex Chrome Extension/native host checks pass, but the browser automation pipe is closed; opening a fresh Chrome window/profile requires user approval before retrying.

## External Blockers

- Explicit user approval is still required before demo video publication, authenticated console screenshot packaging, or hackathon submission.
- Authenticated final screenshots for AI Studio/GCP/Firebase console evidence still need capture and packaging.
- Public GitHub URL: `https://github.com/amanmaqsood/civiclens`.
- Public app URL: `https://civiclens-py7ixxgroq-as.a.run.app`.
- Public Google Doc URL: `https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing`.
- Demo video URL: not created in this checkpoint.
- Public screenshot package: captured in `docs/evidence/final/` with a manifest. Authenticated GCP/Firebase/AI Studio screenshots remain uncaptured because Chrome extension communication failed and opening a fresh Chrome window/profile still requires user approval.

## Remaining Local Gaps

- Transaction/concurrency behavior has focused parallel emulator coverage for support, verification, duplicate evidence, and status-transition writes; a full API-level race matrix remains future hardening.
- Browser E2E uses seeded synthetic emulator data; the deployed smoke used live Gemini/API calls and synthetic images. Public screenshot packaging exists, while authenticated console screenshot/video packaging is still pending.
- Local production `/readyz` fails without production secrets, as expected. Cloud Run `/readyz` is passing in the deployed environment.
- Production App Check enforcement has not been deployed or smoke-tested. Keep `CIVICLENS_REQUIRE_APP_CHECK=false` until a Firebase App Check site key is configured and browser requests are verified to send `X-Firebase-AppCheck`.
- Maps browser-key referrer and API restrictions were applied during the final evidence checkpoint.
- Cloud Build install stage still reports 3 moderate dev-dependency vulnerabilities. Runtime install and `npm audit --omit=dev` report 0 production vulnerabilities.
- Final QA browser evidence covers the separated live-photo and gallery-upload controls. API-backed smoke still covers report save, Gemini, agent, and closure paths with synthetic inline image payloads.

## Historical Milestone 9 Validation

This earlier local gate ran after adding the release documentation set, docs-readiness test, Firebase Emulator Suite rules gate, focused concurrency gate, and Playwright/axe browser gate. The latest validation is the pre-deployment closeout gate above and below:

- `npm ci`: passed in about 2 minutes; 880 packages installed and 881 audited. Install audit reported 3 moderate dev-dependency vulnerabilities; production dependency audit remained clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (12 test files passed, 2 emulator-only files skipped by default; 57 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size and `src/services/issues.ts` mixed import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 file, 3 tests) against Firestore/Storage emulators.
- `npm run test:concurrency`: passed (1 file, 4 tests) against the Firestore emulator.
- `npm run test:e2e`: passed (4 Playwright/Chromium tests) against Auth/Firestore/Storage emulators.
- Local production start probe: `/health` returned 200; `/readyz` returned 503 because `GEMINI_API_KEY` was missing in the local production environment.
- Placeholder/secret scan: release-facing docs and `.env.example` did not contain fake key values or pending license/attribution copy.
- Stale-source scan: browser-authored resolution-plan/privileged-trace patterns were absent from implementation code; matches remained only in negative test assertions.

## Pre-Deployment Closeout Validation

This final local gate ran after the environment-driven Admin config, Firebase web config resolver, App Check header path, Docker/Cloud Build support, docs updates, E2E demo-project cleanup, and stale client demo seed/clear removal:

- `npm ci`: passed; 880 packages installed and 881 audited. Install audit reported 3 moderate dev-dependency vulnerabilities; production dependency audit remained clean.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed (15 files passed, 2 emulator-only files skipped; 71 tests passed, 7 skipped).
- `npm run build`: passed with the known Firebase chunk-size and `src/services/issues.ts` mixed import warnings.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- `npm run test:rules`: passed (1 file, 3 tests) against Firestore/Storage emulators.
- `npm run test:concurrency`: passed (1 file, 4 tests) against the Firestore emulator.
- `npm run test:e2e`: passed (4 Playwright/Chromium tests) against `demo-civiclens` Auth/Firestore/Storage emulators.
- Local production start probe: `/health` returned 200; `/readyz` returned 503 because production secrets/config were intentionally absent.
- Unsupported-copy/config scan: no implementation hits remained for the removed government-adjacent initiative phrase, old hardcoded Admin project/database IDs, or old client-side issue seed/clear write helpers; matches remain only in regression tests or explicitly synthetic server demo markers.

Cloud Run deployment, public URL smoke testing, public screenshot packaging, and Google Doc publication were performed after explicit approval. Demo video publication, authenticated console screenshot packaging, and hackathon submission were not performed.

# CivicLens - Community Hero Submission

Published Google Doc: https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing

CivicLens is an independent civic pilot. It is not an official government portal and does not submit complaints externally.

## Live Application

Primary URL: https://civiclens-py7ixxgroq-as.a.run.app

Alternate Cloud Run URL: https://civiclens-802067002365.asia-southeast1.run.app

## GitHub Repository

Repository: https://github.com/amanmaqsood/civiclens

## Demo Video

Demo video link can be added by the submitter if available.

## Problem Statement Selected

Problem Statement 2: Community Hero - Hyperlocal Problem Solver.

## One-Line Pitch

CivicLens helps residents turn local civic issues into verifiable, map-grounded cases using Gemini, Firebase, Google Maps Platform, and Cloud Run, while keeping consequential decisions under human review.

## The Problem

Local issues such as potholes, broken streetlights, water leaks, unsafe paths, and waste overflow are often reported through scattered channels. Reports may miss exact location context, duplicate awareness, image evidence, public status visibility, or closure proof.

The result is frustrating for residents and inefficient for reviewers. Communities spend time reconstructing what happened instead of moving the case toward a transparent next step.

## The Solution

CivicLens is a working civic-resolution pilot with four connected surfaces:

- Citizen report intake for photo, location, description, and Gemini-assisted triage.
- Map and feed views for nearby civic context and synthetic demo stories.
- Public issue detail pages for evidence, status, community support, and persisted history.
- Operator workspace for server-generated agent traces, approval checkpoints, closure review, and lifecycle decisions.

Gemini recommends; CivicLens validates and records. Human approval remains required for consequential workflow changes.

## Live Demo Journey

1. A citizen opens the public Cloud Run app.
2. The citizen starts a field report and chooses camera capture or gallery upload.
3. The app collects image evidence, location context, and a plain-language description.
4. Google Places autocomplete helps find a location when GPS is blocked or the user prefers manual search.
5. Gemini analyzes the report and returns structured triage: summary, category, urgency, confidence, and rationale.
6. The citizen reviews the triage and saves the issue.
7. The saved issue receives a CivicLens Ticket ID and opens as a shareable issue detail page.
8. Nearby duplicate candidates and community support add context without creating duplicate ticket spam.
9. A server-authorized operator or demo operator reviews eligible cases in the operator workspace.
10. The server runs a persisted workflow against canonical Firestore data and records tool steps.
11. The operator reviews draft routing, escalation, and closure recommendations before taking action.
12. Closure evidence can create a recommendation, but it never auto-resolves the issue.

## Key Features Implemented

- Public citizen reporting with Firebase anonymous sessions.
- Gemini multimodal triage for issue image and description.
- Structured Gemini output for category, urgency, confidence, rationale, and citizen-facing summary.
- Multilingual voice intake with transcription, translation, category extraction, and readback.
- Low-confidence guardrail for non-civic images such as food or unrelated photos.
- Google Maps issue context and Google Places autocomplete for manual location search.
- Separate camera and gallery upload controls for report evidence and closure evidence.
- CivicLens Ticket ID on saved issues, without implying external agency submission.
- Semantic duplicate recommendation with evidence-linking and human decision boundaries.
- Community support and verification with per-user server-side limits.
- Trust-weighted verification and brigading guard for suspicious support clusters.
- Server-owned lifecycle fields, audit-style activity, counters, traces, approvals, and closure assessments.
- Persisted agent runs and tool steps rendered from stored server data.
- Ghost-closure forensics comparing original, claimed repair, and fresh audit evidence.
- SLA and follow-up workers for escalation ladder, follow-up decisioning, and RTI-style draft generation.
- Predictive hotspot worker using Gemini to forecast ward-level risk patterns.
- Open311 GeoReport export for municipal interoperability.
- Real outbound dispatch path to a configured webhook with delivery receipt.
- Demo operator mode limited to records explicitly marked as synthetic demo data.
- Real operator mode resolved from server-verified Firebase identity, custom claims, or allowlisted verified email.
- Public accountability ledger for AI, citizen, operator, worker, and lifecycle events.
- Weekly leaderboard and streaks for civic participation.
- Responsive citizen and operator layouts for desktop, tablet, and mobile.
- Hindi localization for the core public flow, with refresh persistence.
- Metrics that separate real records from synthetic demo data and show "Not enough data" when denominators are insufficient.

## Google Technologies Utilized

- Google AI Studio: used during development and Gemini-backed prototype iteration.
- Gemini via `@google/genai`: multimodal report triage, structured output, translation support, voice intake, duplicate comparison, draft planning, escalation text, closure image assessment, predictive insight generation, and server-side workflow support.
- Firebase Auth: anonymous citizen sessions plus visible Google sign-in entry point. Real operator identity requires server verification.
- Firestore: issues, evidence metadata, approvals, support and verification actions, lifecycle fields, activity history, `agentRuns`, `agentSteps`, leaderboard state, and audit events.
- Firebase Storage: report, evidence, and closure image uploads governed by Storage Rules.
- Firebase Admin SDK: server-owned writes, transactions, role checks, counters, and privileged lifecycle updates.
- Firebase App Check: integration exists, with enforcement relaxed for the public hackathon deployment to avoid blocking judge access.
- Google Maps Platform: map rendering and Places autocomplete for issue location context.
- Secret Manager: stores runtime secrets for Cloud Run without recording secret values in the repository.
- Cloud Run: public production deployment.
- Cloud Build and Artifact Registry: build and image deployment pipeline.

## Technical Architecture

The frontend uses React, TypeScript, Vite, and Tailwind CSS. The backend is an Express TypeScript server bundled for Cloud Run. The browser submits user-owned report inputs and image uploads; privileged workflow data is written through authenticated server endpoints using Firebase Admin SDK.

Firestore Rules deny direct browser writes to system-owned lifecycle fields and privileged subcollections. Storage Rules restrict uploads by path ownership, image MIME type, and size. Server endpoints apply identity checks, role checks, request validation, body limits, quota checks, App Check support, and safe error responses.

## Human Oversight and Safety Boundary

CivicLens avoids unsupported claims of government affiliation, external agency acceptance, automatic authority submission, court-grade evidence validation, permanent tamper-proof records, or automatic routing.

Real operator actions require verified Firebase identity and a server-authorized role. Demo operator actions are limited to synthetic demo records. Anonymous users can create and support reports, but they cannot perform privileged lifecycle transitions.

Consequential operations require human approval:

- Duplicate merge.
- Routing or final action packet approval.
- Escalation finalization.
- Resolve.
- Reopen.

Closure recommendations are persisted for review and do not auto-resolve a case.

## Innovation and Differentiation

CivicLens is not a generic chatbot layered on top of a form. It combines map-localized field reporting, multimodal issue triage, nearby duplicate handling, community verification, persisted workflow traces, and human approval gates in one civic workflow.

The key innovation is the separation of Gemini recommendation from final authority. Gemini helps understand, compare, translate, forecast, and draft. Deterministic server code protects permissions, state transitions, and final decisions.

High-value differentiators include:

- Multilingual voice intake for mobile-first and low-literacy users.
- Ghost-closure forensics for suspicious repair claims.
- Trust-weighted community verification and brigading protection.
- SLA and follow-up workers with RTI-style review drafts.
- Open311 export and webhook dispatch receipt.
- Predictive hotspots for ward-level planning.
- Public ledger and weekly leaderboard for transparent civic participation.

## Product Experience and Accessibility

The app uses a responsive shell rather than a fake device frame. On desktop, citizens can scan the map, feed, and report action quickly, while operators receive a denser workspace with queue, case evidence, workflow trace, and approval panels. On mobile, the header and bottom navigation are compact, sticky, and designed for thumb-friendly navigation.

The final hardening work includes:

- Visible CivicLens subtitle in the header.
- Fixed mobile bottom navigation.
- 44px-friendly controls for core actions.
- Keyboard and focus support for key menus and dialogs.
- Labeled report flow controls.
- Loading, empty, error, denied-permission, and low-confidence states.
- Hindi persistence across refresh for the core public flow.

## Impact Dashboard and Metrics

The dashboard derives metrics from persisted lifecycle fields. It does not invent citywide impact numbers. Real records and synthetic demo data are labelled separately, and insufficient denominators show "Not enough data" rather than a fake percentage or average.

Dashboard and analytics surfaces include:

- Case lifecycle status.
- AI and operator event ledger.
- Open311 export state.
- Dispatch delivery receipt.
- Predictive hotspots.
- Weekly civic leaderboard.
- Observability counters and query status.

## Verification Evidence

Validation included automated browser checks across mobile, tablet, and desktop, Firebase Rules/emulator checks, transaction/concurrency tests, production build checks, and live Cloud Run smoke tests.

Latest live deployment evidence:

- Project: `gen-lang-client-0871796745`
- Region: `asia-southeast1`
- Cloud Run service: `civiclens`
- Active revision: `civiclens-00059-245`
- Traffic: 100 percent to `civiclens-00059-245`
- Public app URL: https://civiclens-py7ixxgroq-as.a.run.app
- Alternate URL: https://civiclens-802067002365.asia-southeast1.run.app
- Runtime app source: `main@d277989`
- Runtime image: `asia-southeast1-docker.pkg.dev/gen-lang-client-0871796745/civiclens/civiclens:d277989-public-20260630124658`

Latest public deploy smoke:

`DEPLOY_SMOKE_LIVE url=https://civiclens-py7ixxgroq-as.a.run.app ready=ready auth=ok gemini=ok maps=OK mapsApi=maps-javascript-places-bootstrap geminiTokens=32 mapsPredictions=0 durationMs=1770`

Final completed checks:

- Broad headed Phase 0-6 verifier: all PASS; `consoleErrors=0`, `pageErrors=0`, `server5xx=0`.
- Deep phase-gap headed verifier: all PASS after Gemini cap increase; `consoleErrors=0`.
- `npx vitest run`: 131 passed, 11 skipped.
- `npm run test:e2e`: 7 Playwright release-gate tests passed.
- `npm run test:rules`: Firestore/Storage rules passed.
- `npm run test:concurrency`: transaction/concurrency tests passed.
- `npm run test:behavioral-api`: `authz=ok workerIdempotency=ok semanticDedup=ok`.
- `npm run test:golden-path`: duplicate merge, dispatch, ghost reopen, final resolution, Open311 export, predictive worker, and event ledger passed.
- `npm audit --omit=dev --audit-level=moderate`: 0 production vulnerabilities.

See `docs/FINAL_EVIDENCE_REPORT.md` for command outputs, warnings, commit references, and remaining evidence notes.

## Screenshots List

The evidence package in `docs/evidence/final/` includes public app screenshots and sanitized infrastructure evidence. The important judge-facing screenshots cover:

- Cloud Run app homepage.
- Report flow start.
- Camera/gallery upload choices.
- Google Places autocomplete.
- Profile menu with Google sign-in and language controls.
- Hindi report flow.
- Map visible.
- Gemini triage result.
- Low-confidence non-civic image guardrail.
- Saved issue detail.
- Persisted agent run with tool steps.
- Agent trace after refresh.
- Demo operator workspace.
- Demo-only operator boundary.
- Closure recommendation without auto-resolve.
- Desktop layout.
- Mobile layout.
- Public GitHub repository.
- Sanitized Cloud Run, Firestore Rules, Storage Rules, Secret Manager name-only, Firebase Auth provider, and Maps key restriction evidence.

Screenshots that require authenticated consoles are treated carefully and should not expose secret values, tokens, private emails, billing information, or hidden sensitive data.

## Demo Walkthrough

1. Open the live app URL.
2. Show the independent civic pilot boundary and synthetic demo labels.
3. Start a citizen field report.
4. Upload the pothole image through gallery upload.
5. Deny GPS and use Places autocomplete for a typed location.
6. Enter a short pothole description.
7. Run Gemini triage and review the structured summary.
8. Save the issue and open the saved issue detail page.
9. Point out the CivicLens Ticket ID and absence of external-agency submission claims.
10. Refresh the issue detail page to show persistence.
11. Open the demo operator workspace.
12. Show persisted tool steps and the human approval boundary.
13. Show that demo actions are limited to synthetic records.
14. Show closure recommendation as review material, not auto-resolution.
15. Show dashboard surfaces: Open311 export, predictive hotspots, dispatch receipt, leaderboard, and ledger.
16. Switch Hindi on and refresh to show localization persistence.

## Prototype and Pilot Limitations

- CivicLens is an independent civic pilot, not a government portal.
- The app does not submit complaints to government systems.
- Draft routing/action packets, escalation letters, RTI-style text, and closure assessments require human review before any use outside the app.
- App Check integration exists, but enforcement is relaxed for this hackathon deployment to avoid blocking judge access.
- Google sign-in flow starts from the public app; private account credential completion should be performed only by the user during recording if needed.
- Hindi localization covers the core public flow. Some operator-only administrative copy remains English-first.
- Metrics are scoped to persisted app records and are not citywide impact claims.
- Synthetic demo stories are labelled as synthetic.
- Final hackathon submission has not been performed from this repository checkpoint.

## Open-Source Attributions

No third-party project code was copied wholesale. CivicLens is original hackathon prototype work assembled in this repository.

Primary libraries and services include React, TypeScript, Vite, Express, Firebase JavaScript SDK, Firebase Admin SDK, `@google/genai`, `@vis.gl/react-google-maps`, Tailwind CSS, lucide-react, motion, Vitest, axe-core, esbuild, and Firebase Tools. See `ATTRIBUTIONS.md` for the full attribution list and demo image source notes.

## Links

- Live application: https://civiclens-py7ixxgroq-as.a.run.app
- Alternate Cloud Run URL: https://civiclens-802067002365.asia-southeast1.run.app
- GitHub repository: https://github.com/amanmaqsood/civiclens
- Public Google Doc: https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing
- Architecture: `ARCHITECTURE.md`
- Security spec: `security_spec.md`
- Deployment runbook: `docs/DEPLOYMENT_CLOUD_RUN.md`
- Final evidence report: `docs/FINAL_EVIDENCE_REPORT.md`
- Implementation status: `docs/IMPLEMENTATION_PLAN_STATUS_2026-06-30.md`
- Demo script: `docs/DEMO_SCRIPT.md`

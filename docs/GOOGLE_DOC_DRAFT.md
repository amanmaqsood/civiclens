# CivicLens Google Doc Draft

Published Google Doc: https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing

CivicLens is a prototype, not a government service. Do not add unavailable links or claims.

## Live Application

Primary URL: https://civiclens-py7ixxgroq-as.a.run.app

Alternate Cloud Run URL: https://civiclens-802067002365.asia-southeast1.run.app

## GitHub Repository

Repository: https://github.com/amanmaqsood/civiclens

## Demo Video

Optional demo video not included.

## Problem Statement Selected

Problem Statement 2: Community Hero.

## Product Thesis

CivicLens helps residents turn scattered local issue reports into a shared, human-reviewed civic workflow. The product combines photo evidence, location context, community verification, Gemini-assisted analysis, and operator approval so civic teams can understand what happened, where it happened, whether similar reports exist nearby, and what draft follow-up is worth reviewing.

## Problem and User Pain

Residents often report potholes, overflowing waste, broken streetlights, unsafe footpaths, and similar civic problems through fragmented channels. Reports may miss evidence, location precision, duplicate context, or closure proof. Citizens cannot easily see whether neighbors have reported the same issue, and local operators must spend time reconstructing the case history before deciding what to do next.

CivicLens addresses that pain as a prototype workflow. It does not file complaints with government systems, does not receive official acknowledgements, does not legally verify evidence, and does not enforce statutory service levels.

## Solution Overview

CivicLens lets a citizen create an issue with a photo, location, and description. Gemini helps summarize and classify the report, the app checks nearby saved issues for possible duplicates, community members can support or verify a case, and an operator can review a persisted server-side agent run before approving draft action packets, escalation text, or closure decisions.

The system is intentionally human-governed. Gemini recommends and drafts; deterministic server code validates permissions, transitions, and approval requirements. Consequential operations such as duplicate merge, routing/action packet approval, escalation finalization, resolve, and reopen remain human decisions.

## Complete User Journey

1. A citizen opens the public Cloud Run app and creates a report with location, description, and image evidence.
2. Gemini analyzes the report and returns a structured triage summary, category, urgency, and confidence.
3. The server saves the issue and checks nearby records for possible duplicates.
4. A human operator or demo operator, depending on case type and authorization, reviews duplicate recommendations rather than allowing automatic merges.
5. Community members can support, confirm, or dispute a saved issue, with one action per user enforced server-side.
6. The operator opens the case detail page and runs the persisted agent workflow.
7. The server loads canonical Firestore data, runs bounded agent tools, and persists `agentRuns` plus issue-linked `agentSteps`.
8. The operator reviews draft routing/action, escalation, and closure recommendations.
9. Closure evidence can produce a recommendation, but it does not auto-resolve the issue.
10. A server-authorized operator records the final resolve or reopen decision with identity and rationale.

## Key Features Implemented

- Public citizen report creation with Firebase anonymous auth.
- Gemini multimodal triage and structured report summaries.
- Google Maps view for local issue context.
- Nearby duplicate recommendation with human merge decision.
- Community support and verification with per-user limits.
- Server-owned lifecycle fields, audit events, approvals, counters, traces, and closure assessments.
- Persisted agent run and tool-step timeline rendered from Firestore, not synthesized by the browser.
- Demo operator mode limited to explicitly synthetic demo records.
- Real operator mode resolved server-side from Firebase identity, custom claims, or verified allowlisted email.
- Responsive citizen and operator layouts for desktop and mobile.
- Metrics separated between real records and synthetic demo data, with "Not enough data" shown where denominators are insufficient.

## Technologies Used

- React 19, TypeScript, Vite, and Tailwind CSS for the frontend.
- Express and esbuild for the TypeScript server bundle.
- Firebase Auth, Firestore, Storage, Admin SDK, and optional App Check integration for identity, data, storage, and server-owned writes.
- Gemini through `@google/genai` for multimodal analysis, structured output, translation, drafting, and agent tool loops.
- Google Maps Platform through `@vis.gl/react-google-maps` for map rendering.
- Google Cloud Run, Cloud Build, Artifact Registry, and Secret Manager for deployment and runtime configuration.
- Vitest, Firebase Emulator Suite, Playwright, and axe-core for validation.

## Agentic Workflow

The deployed agent endpoint accepts an `issueId`, loads canonical issue and candidate data from Firestore, and records the run server-side. The implemented tool sequence includes nearby case search, evidence comparison, priority calculation, authority lookup for draft follow-up, action packet drafting, human approval request, closure verification, and event recording.

Agent output is used as recommendation material only. Human approval is required before consequential lifecycle changes. Persisted tool steps include status, summaries, timestamps, and tool names so the trace can survive a page refresh.

## Google Technologies Utilized

- Google AI Studio: used as the development and provenance environment for the prototype and Gemini integration.
- Gemini via `@google/genai`: powers multimodal report triage, structured output, duplicate comparison support, translation, draft resolution planning, escalation/RTI draft text, closure image assessment, and the server-side tool workflow.
- Firebase Auth: anonymous citizen sessions and Google sign-in/operator identity.
- Firestore: issues, evidence, approvals, support/verification actions, lifecycle fields, audit-style activity, `agentRuns`, and `agentSteps`.
- Firebase Storage: report, evidence, and closure image uploads governed by Storage Rules.
- Firebase Admin SDK: server-owned writes, transactions, role checks, and privileged lifecycle updates.
- Firebase App Check: App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.
- Google Maps Platform: map rendering for issue context. The public browser key is restricted to the Cloud Run origins and localhost, with Maps JavaScript API access.
- Google Cloud Run: public deployment for the Express/Vite production build.
- Secret Manager: stores `GEMINI_API_KEY` for Cloud Run runtime access without recording the secret value in the repository.
- Cloud Build and Artifact Registry: used for the approved Cloud Run image deployment flow.

## Technical Architecture

The frontend is React 19, TypeScript, and Vite. The backend is an Express TypeScript server bundled with esbuild and deployed to Cloud Run. The browser submits user-owned report inputs and image bytes, while privileged data is written through authenticated server endpoints using Firebase Admin SDK.

Firestore Rules deny direct browser writes to issue-owned privileged fields and subcollections. Storage Rules restrict uploads by path ownership, image MIME type, and size. Server endpoints apply identity checks, role checks, request validation, body limits, quotas, App Check verification support, and safe error responses.

## Security and Human Oversight

CivicLens does not claim public-agency status, authority acceptance, legal verification, immutable audit guarantees, automatic filing, or automatic routing. It records prototype workflow evidence inside the app.

Real operator actions require verified Firebase identity and a server-authorized role. Demo operator actions are limited to records marked as synthetic demo data. Anonymous users can create and support reports, but they cannot perform privileged lifecycle transitions. Closure recommendations are persisted for review and do not auto-resolve a case.

## Innovation and Differentiation

CivicLens focuses on civic coordination rather than a generic chatbot. The differentiator is the combination of map-localized issue intake, duplicate evidence handling, community verification, server-persisted agent traces, and human approval boundaries. It shows how Gemini can assist a civic workflow while deterministic application code protects permissions and final decisions.

## Product Experience and Accessibility

The app uses a responsive shell rather than a fake device frame. Citizens can scan the map/feed/report flow on mobile or desktop, while operators get a denser case workspace with queue, selected issue details, evidence, agent trace, and approval panels. The rebuilt UI includes labeled controls, keyboard/focus support, larger touch targets, loading/empty/error states, and accessibility-oriented E2E checks.

## Impact Dashboard and Metrics

The dashboard derives metrics from persisted lifecycle fields and separates real records from synthetic demo data. It does not invent citywide impact numbers. Where there is not enough persisted data to support a metric, the UI reports "Not enough data" instead of displaying a fake percentage or average.

## Testing Evidence

Latest recorded validation covers:

- `npm run lint`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- Firestore and Storage Rules emulator coverage.
- Focused transaction/concurrency coverage.
- Playwright/axe responsive browser coverage.
- Public Cloud Run `/health` and `/readyz` smoke checks.
- Live API smoke for Gemini triage, issue save, persisted agent steps, demo-operator boundary, anonymous denial, and closure recommendation without auto-resolution.

See `docs/FINAL_EVIDENCE_REPORT.md` for exact command outputs, warnings, commit references, and remaining gaps.

## Deployment Evidence

- Project: `gen-lang-client-0871796745`
- Region: `asia-southeast1`
- Cloud Run service: `civiclens`
- Active revision: `civiclens-00036-dcb`
- Public app URL: https://civiclens-py7ixxgroq-as.a.run.app
- Alternate URL: https://civiclens-802067002365.asia-southeast1.run.app
- Runtime source: current CivicLens UX refresh tree deployed from this repository workspace; the earlier production base commit was `fcf8946`.
- `/health`: passing on the public service.
- `/readyz`: passing on the public service with App Check enforcement warning recorded.
- Maps browser key restriction: HTTP referrers for the two Cloud Run origins and localhost, API target `maps-backend.googleapis.com`; confirmed again during the `civiclens-00036-dcb` evidence refresh.

## Screenshots List

The public screenshot package is stored under `docs/evidence/final/` with `PUBLIC_SCREENSHOT_MANIFEST-2026-06-27.json` and the UX refresh manifest `PUBLIC_SCREENSHOT_MANIFEST-UX-REFRESH-2026-06-27.json`. These are Chrome/Playwright page-content screenshots, so they do not include the browser address bar; exact URLs are recorded in the manifests and evidence report. Sanitized CLI/API-backed infrastructure evidence is stored in `SANITIZED_GCP_FIREBASE_EVIDENCE-2026-06-27.json` and related `*-cli-evidence-2026-06-27.png` files. Authenticated GCP/Firebase/AI Studio console screenshots still require an approved authenticated Chrome session.

Captured public screenshot targets:

- Cloud Run app homepage page content.
- Report flow start.
- Synthetic/demo label visible.
- Map visible.
- Gemini triage result.
- Saved issue detail.
- Persisted agent run with tool steps.
- Page refreshed with agent trace still present.
- Demo operator allowed only on synthetic case.
- Real-case mutation denied for demo or anonymous operator.
- Closure recommendation persisted but not auto-resolved.
- Desktop layout.
- Mobile layout.
- `/health` 200.
- `/readyz` 200.
- GitHub public repository page.
- CLI/API-rendered Cloud Run service metadata.
- CLI/API-rendered Firestore and Storage Rules release metadata.
- CLI/API-rendered Secret Manager name-only metadata.
- CLI/API-rendered Firebase Auth provider metadata.
- CLI/API-rendered Maps key restriction metadata.

Remaining authenticated console screenshot targets:

- Cloud Run service page with URL and active revision.
- Firestore Rules deployed.
- Storage Rules deployed.
- Secret Manager page showing `GEMINI_API_KEY` secret name only, not value.
- Firebase Auth enabled providers.
- AI Studio project/history/export/import/development evidence if available.

Do not claim authenticated console screenshot capture until those files exist and have been reviewed for secrets, tokens, private emails, billing information, or hidden sensitive data.

## Demo Walkthrough

1. Open the live app URL.
2. Point out prototype and synthetic-demo labels.
3. Start a citizen report and show the photo/location/description flow.
4. Run Gemini triage and save the issue.
5. Open the saved case detail view.
6. Run or display the persisted agent workflow and tool steps.
7. Refresh the page to show the agent trace remains persisted.
8. Open the demo operator workspace and show that demo actions are limited to synthetic records.
9. Show that a real/non-demo mutation is denied to demo or anonymous actors.
10. Upload or reference closure evidence, show the persisted recommendation, and confirm the case is not auto-resolved.

## Prototype Limitations

- CivicLens is not a government portal and does not submit complaints to government systems.
- Draft routing/action packets, escalation letters, RTI text, and closure assessments require human review before any use outside the app.
- App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.
- Metrics are scoped to persisted app records and are not citywide impact claims.
- Demo records are synthetic and labelled as such.
- No demo video is included in this checkpoint.
- Final hackathon submission has not been performed in this repository checkpoint.

## Attributions

No third-party project code was copied wholesale. CivicLens is original hackathon prototype work assembled in this repository.

## Open-source Attributions

Primary libraries and services include React, TypeScript, Vite, Express, Firebase JavaScript SDK, Firebase Admin SDK, `@google/genai`, `@vis.gl/react-google-maps`, Tailwind CSS, lucide-react, motion, canvas-confetti, Vitest, Playwright, axe-core, esbuild, and Firebase Tools. See `ATTRIBUTIONS.md` for the full attribution list and demo image source notes.

## Links

- Live application: https://civiclens-py7ixxgroq-as.a.run.app
- Alternate Cloud Run URL: https://civiclens-802067002365.asia-southeast1.run.app
- GitHub repository: https://github.com/amanmaqsood/civiclens
- Public Google Doc: https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing
- Architecture: `ARCHITECTURE.md`
- Security spec: `security_spec.md`
- Deployment runbook: `docs/DEPLOYMENT_CLOUD_RUN.md`
- AI Studio evidence instructions: `docs/AI_STUDIO_EVIDENCE.md`
- Final evidence report: `docs/FINAL_EVIDENCE_REPORT.md`
- Demo script: `docs/DEMO_SCRIPT.md`

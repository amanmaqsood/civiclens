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

Problem Statement 2: Community Hero.

## Product Thesis

CivicLens helps residents and civic reviewers turn scattered local issue reports into a shared, evidence-led workflow. A citizen can submit a field report with image and location context; Gemini helps classify and summarize the issue; nearby reports and community verification add context; and human reviewers keep control of consequential decisions such as duplicate merge, routing drafts, escalation, closure, resolve, and reopen.

The goal is not to replace local authorities. The goal is to make community issue reporting clearer, more verifiable, and easier to review.

## Problem and User Pain

Residents often report potholes, overflowing waste, broken streetlights, unsafe paths, and similar local problems through fragmented channels. These reports can lack reliable location context, duplicate awareness, image evidence, public status visibility, or closure proof.

At the same time, community volunteers and local operators need to understand what happened, whether similar reports already exist, and what next action is reasonable. Without a shared workflow, both sides spend time reconstructing context instead of moving the case forward.

## Solution Overview

CivicLens provides a working civic-resolution pilot with four connected surfaces:

- Citizen report intake for photo, location, description, and Gemini-assisted triage.
- Map and feed views for nearby civic context and curated synthetic demo stories.
- Issue detail pages for evidence, status, community support, and persisted case history.
- Operator workspace for server-generated agent traces, approval checkpoints, closure review, and lifecycle decisions.

Gemini recommends; the application validates. Human approval remains required for consequential workflow changes.

## Complete User Journey

1. A citizen opens the public Cloud Run app.
2. The citizen starts a field report and chooses either live camera capture or gallery upload.
3. The app collects image evidence, location context, and a plain-language description.
4. Google Places autocomplete helps find a location when GPS is blocked or the user prefers manual search.
5. Gemini analyzes the report and returns structured triage: summary, category, urgency, confidence, and rationale.
6. The citizen reviews the triage and saves the issue.
7. The saved issue receives a CivicLens Ticket ID and opens as a shareable issue detail page.
8. Nearby duplicate candidates and community support provide additional context.
9. A server-authorized operator or demo operator reviews eligible cases in the operator workspace.
10. The server runs a persisted agent workflow against canonical Firestore data and records tool steps.
11. The operator reviews draft routing, escalation, and closure recommendations before taking action.
12. Closure evidence can create a recommendation, but it never auto-resolves the issue.

## Key Features Implemented

- Public citizen reporting with Firebase anonymous sessions.
- Gemini multimodal triage for issue image and description.
- Structured Gemini output for category, urgency, confidence, and citizen-facing summary.
- Low-confidence guardrail for non-civic images such as food or unrelated photos.
- Google Maps issue context with Google Places autocomplete for manual location search.
- Separate camera and gallery upload controls for report evidence and closure evidence.
- CivicLens Ticket ID on saved issues, without implying external agency submission.
- Nearby duplicate recommendation with human decision boundaries.
- Community support and verification with per-user server-side limits.
- Server-owned lifecycle fields, audit-style activity, counters, traces, approvals, and closure assessments.
- Persisted agent runs and tool steps rendered from stored server data.
- Demo operator mode limited to records explicitly marked as synthetic demo data.
- Real operator mode resolved from server-verified Firebase identity, custom claims, or allowlisted verified email.
- Responsive citizen and operator layouts for desktop, tablet, and mobile.
- Hindi localization for the core public flow, with refresh persistence.
- Metrics that separate real records from synthetic demo data and show "Not enough data" when denominators are insufficient.

## Agentic Workflow

The deployed agent endpoint accepts an issue ID, loads canonical issue and candidate data from Firestore, and records a server-owned run. The implemented workflow includes:

- Nearby case search.
- Evidence comparison.
- Priority calculation.
- Authority lookup for draft follow-up language.
- Action packet drafting.
- Human approval request.
- Closure evidence review.
- Event recording.

The agent trace is recommendation material, not an automatic decision engine. Tool steps are persisted with status, summaries, timing, tool names, model context, and timestamps so the trace survives refresh and can be reviewed later.

## Google Technologies Utilized

- Google AI Studio: used during development and provenance of the Gemini-backed prototype.
- Gemini via `@google/genai`: multimodal report triage, structured output, translation support, duplicate comparison support, draft resolution planning, escalation text, closure image assessment, and server-side tool workflow.
- Firebase Auth: anonymous citizen sessions plus visible Google sign-in entry point. Real operator identity requires server verification.
- Firestore: issues, evidence metadata, approvals, support and verification actions, lifecycle fields, activity history, `agentRuns`, and `agentSteps`.
- Firebase Storage: report, evidence, and closure image uploads governed by Storage Rules.
- Firebase Admin SDK: server-owned writes, transactions, role checks, counters, and privileged lifecycle updates.
- Firebase App Check: integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.
- Google Maps Platform: map rendering and Places autocomplete for issue location context.
- Secret Manager: stores the Gemini API key for Cloud Run runtime access without recording the secret value in the repository.
- Cloud Run: public deployment for the production Express/Vite build.
- Cloud Build and Artifact Registry: build and image deployment flow for the Cloud Run service.

## Technical Architecture

The frontend uses React, TypeScript, Vite, and Tailwind CSS. The backend is an Express TypeScript server bundled for Cloud Run. The browser submits user-owned report inputs and image uploads; privileged workflow data is written through authenticated server endpoints using Firebase Admin SDK.

Firestore Rules deny direct browser writes to system-owned lifecycle fields and privileged subcollections. Storage Rules restrict uploads by path ownership, image MIME type, and size. Server endpoints apply identity checks, role checks, request validation, body limits, quota checks, App Check support, and safe error responses.

## Security and Human Oversight

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

CivicLens is not a generic chatbot layered on top of a form. The product combines map-localized field reporting, multimodal issue triage, nearby duplicate handling, community verification, persisted agent traces, and human approval gates in one civic workflow.

The key innovation is the separation of AI recommendation from final authority. Gemini helps understand, compare, translate, and draft. Deterministic server code protects permissions, state transitions, and final decisions.

## Product Experience and Accessibility

The app uses a responsive shell rather than a fake device frame. On desktop, citizens can scan the map, feed, and report action quickly, while operators receive a denser workspace with queue, case evidence, agent trace, and approval panels. On mobile, the header and bottom navigation are compact, sticky, and designed for thumb-friendly navigation.

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

## Testing Evidence

Validation included automated browser checks across mobile, tablet, and desktop, Firebase Rules/emulator checks, transaction/concurrency tests, production build checks, and live Cloud Run smoke tests.

Recorded evidence covers:

- Public Cloud Run `/health` and `/readyz` checks.
- Desktop, tablet, mobile, and narrow-mobile responsive checks.
- Sticky header and fixed mobile bottom navigation.
- Camera and gallery upload controls.
- Google Places autocomplete and selected-place state.
- Gemini triage on a pothole-style civic report.
- Low-confidence handling for non-civic food imagery.
- Saved issue detail with CivicLens Ticket ID.
- Persisted agent trace after refresh.
- Demo operator action limited to synthetic cases.
- Demo or anonymous mutation denied on real cases.
- Closure recommendation persisted without auto-resolve.
- Google sign-in flow starting without inline app error.
- Hindi localization persistence.

See `docs/FINAL_EVIDENCE_REPORT.md` for command outputs, warnings, commit references, and remaining evidence notes.

## Deployment Evidence

- Project: `gen-lang-client-0871796745`
- Region: `asia-southeast1`
- Cloud Run service: `civiclens`
- Active revision: `civiclens-00047-5kr`
- Traffic: 100 percent to `civiclens-00047-5kr`
- Public app URL: https://civiclens-py7ixxgroq-as.a.run.app
- Alternate URL: https://civiclens-802067002365.asia-southeast1.run.app
- Runtime source commit: `68e9787`
- `/health`: passing on the public service.
- `/readyz`: passing on the public service with App Check enforcement warning recorded.
- Maps browser key restriction: HTTP referrers for the two Cloud Run origins and localhost, with Maps and Places browser APIs required for the deployed flow.

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
12. Show persisted agent tool steps and the human approval boundary.
13. Show that demo actions are limited to synthetic records.
14. Show closure recommendation as review material, not auto-resolution.
15. Switch Hindi on and refresh to show localization persistence.

## Prototype and Pilot Limitations

- CivicLens is an independent civic pilot, not a government portal.
- The app does not submit complaints to government systems.
- Draft routing/action packets, escalation letters, RTI-style text, and closure assessments require human review before any use outside the app.
- App Check integration exists, but enforcement is disabled for this hackathon deployment to avoid blocking judge access.
- Google sign-in flow starts from the public app; private account credential completion was not performed by the agent.
- Hindi localization covers the core public flow. Some operator-only administrative copy remains English-first.
- Metrics are scoped to persisted app records and are not citywide impact claims.
- Synthetic demo stories are labelled as synthetic.
- Final hackathon submission has not been performed from this repository checkpoint.

## Open-source Attributions

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
- AI Studio evidence instructions: `docs/AI_STUDIO_EVIDENCE.md`
- Final evidence report: `docs/FINAL_EVIDENCE_REPORT.md`
- Demo script: `docs/DEMO_SCRIPT.md`

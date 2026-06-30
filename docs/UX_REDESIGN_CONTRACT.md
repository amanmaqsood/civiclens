# CivicLens UX Redesign Contract

Status: planning checkpoint only. This document defines the next UI/UX sprint and does not implement app code, deploy, submit to BlockseBlock, rotate keys, change billing, delete resources, or alter backend/security architecture.

## Design Read

Reading this as: a trust-first civic prototype for hackathon judges and public users, with a "CivicLens Field Command Center" product language, leaning toward a map-first field reporting app plus a desktop operator command center. The visual system should remain ink, paper, marigold, teal, calm, practical, and judge-legible.

External methodology references were inspected but not installed:

- `https://github.com/Leonxlnx/taste-skill`: used as a redesign-audit checklist for hierarchy, typography, spacing, mobile states, and existing-project restraint. No code copied.
- `https://github.com/obra/superpowers`: used as a process reference for spec-first planning, task decomposition, TDD, evidence before claims, and verification gates. No code copied.

Installation was intentionally skipped because this checkpoint should modify only the CivicLens repository documentation, not global or agent-level tooling.

## Current UX Problems To Inspect

These are the known weak points to verify before editing in the implementation sprint:

- Desktop feels scattered: the homepage stretches a mobile-like feed across wide screens instead of presenting a composed command surface.
- Text is too small: deployed inspection found many visible elements below 16px, including headings, labels, filter controls, and case metadata.
- Mobile feels like the same desktop layout: the current sticky header works, but there is no mobile bottom navigation or persistent field action.
- Sticky navigation is incomplete: desktop has a sticky top header, but mobile needs a stronger top context plus bottom nav.
- Report flow is not obvious enough: the form has states, but it does not read as a clear stepper from photo to location to AI draft to save.
- Location permission does not clearly prompt or recover: denied state appears, but the recovery path should be more deliberate and include manual pin fallback.
- Dummy/demo data feels excessive: the live app currently shows many synthetic records by default; judges should see two or three curated stories first.
- Judge cannot instantly understand the product story: the first viewport says prototype but does not yet dramatize the field-to-agent-to-operator loop.
- Agent trace may not be visually prominent enough: persisted trace support exists, but the current presentation is compact and can show confusing empty states.

## Non-Negotiable Constraints

- Preserve the existing React, TypeScript, Vite, Express, Firebase, Gemini, Google Maps, Cloud Run, roles, rules, and deployed architecture.
- Do not fake public-agency status, external filing, metrics, agent traces, timestamps, citations, authority acceptance, signatures, hashes, or test results.
- Demo data remains clearly synthetic wherever displayed.
- Add no risky product features. This sprint is presentation, flow clarity, accessibility, and evidence storytelling.
- Preserve all backend security boundaries and human approval requirements.
- All previous test gates must pass before any deployment.
- Cloud Run health must remain green after any approved deployment.
- The public Google Doc should not be edited after final submission. Since submission has not happened yet, it may be updated once after the final redesign evidence is verified.

## Product Direction

CivicLens should feel like a "CivicLens Field Command Center":

- Mobile citizen surface: map-first, fast field reporting, obvious report action, location recovery that feels safe.
- Desktop citizen surface: spatial overview, curated case stories, clear path into report and case detail.
- Desktop operator surface: queue, selected case, evidence, agent trace, approvals, closure, and activity visible as a real workspace.
- Aesthetic: premium civic intelligence, readable, calm, trustworthy, practical, not generic AI-dashboard chrome.
- Story: a citizen observes an issue, Gemini helps draft and compare, the server records real tool steps, and humans approve consequential actions.

## Required Redesign Scope

- Sticky desktop navigation with clearer sections and active state.
- Sticky mobile top header with current context.
- Mobile bottom navigation for map, reports, dashboard, and demo/operator when allowed.
- Floating report CTA on mobile, visible after first scroll and not blocking content.
- Redesigned homepage hero that makes CivicLens, prototype boundary, map, and report action immediately clear.
- Report flow as a clear stepper: photo, location, context, AI draft, save.
- Location permission CTA with explicit denied, unavailable, loading, and manual recovery states.
- Manual map pin fallback for report location when GPS is denied or unavailable.
- Curated synthetic demo stories only: show two or three default stories.
- Hide excess synthetic data behind `Show all demo data`.
- Premium agent timeline with tool names, server execution summaries, timing, human approval gates, and persisted-after-refresh story.
- Operator desktop three-column layout: queue, selected case/evidence, agent/approval/closure panel.
- Mobile issue detail redesign with sticky case actions and prominent agent/closure state.
- Simplified impact dashboard with defensible persisted-data metrics and "Not enough data" language where needed.
- 16px minimum body text for readable content; metadata can be smaller only when not critical.
- 44px touch targets for interactive controls.
- Visible focus states and keyboard path through report, detail, dashboard, and operator panels.
- Loading, empty, error, denied-permission, low-confidence, and retry states.
- No horizontal overflow at 390px.

## Dependency Order

1. Baseline and rollback evidence
   - Tag current commit as `pre-ux-redesign`.
   - Record current Cloud Run revision `civiclens-00034-82x`.
   - Re-run a local smoke check before editing.

2. Design-system audit
   - Inventory font scale, spacing scale, radius scale, color tokens, shadows, z-index usage, and all sub-44px controls.
   - Decide the shared app-shell primitives before changing page content.

3. App shell and navigation
   - Implement sticky desktop nav, mobile top header, mobile bottom nav, and floating report CTA first because every screen depends on them.
   - Preserve route state and existing persona/session boundaries.

4. Map-first citizen home
   - Recompose the first viewport into map, report CTA, prototype boundary, and curated synthetic stories.
   - Add `Show all demo data` before touching feed pagination or dashboard copy.

5. Report stepper and location recovery
   - Split current `ReportPage` UI into stepper sections without changing submit payload semantics.
   - Add GPS denied/unavailable recovery and manual map pin fallback.

6. Issue detail and agent storytelling
   - Elevate persisted agent runs and empty states.
   - Make "server-executed tools" and "human approval still required" visible without adding new claims.

7. Operator command center
   - Convert the desktop operator workspace into queue, case, and agent/approval/closure columns.
   - Keep mobile operator path simple and readable.

8. Dashboard and demo-data restraint
   - Simplify metrics and keep real/demo separation.
   - Default to curated stories and reveal full synthetic set only on user request.

9. Accessibility and state pass
   - Fix font sizes, target sizes, focus states, labels, aria-live status, dialogs, loading, empty, and error states.

10. Evidence and final doc refresh
    - Re-run the complete validation matrix.
    - After approved deployment, capture mobile/desktop screenshots and update the Google Doc once with verified evidence only.

## Likely Risky Files

- `src/App.tsx`: app shell, route state, persona/session boundaries, live trace display, operator layout.
- `src/components/Header.tsx`: sticky nav, active states, auth/operator controls, mobile header.
- `src/components/MobileFrame.tsx`: app width/frame constraints and page chrome.
- `src/components/LandingPage.tsx`: hero, map-first composition, curated demo story reveal, metrics summary.
- `src/components/HomeMap.tsx`: map sizing, location prompt, denied state, manual pin fallback.
- `src/components/IssueListWithFilter.tsx`: feed density, filter controls, touch targets, curated demo behavior.
- `src/components/ReportPage.tsx`: stepper, photo/location/context flow, permission recovery, manual map pin.
- `src/components/ReportProgressView.tsx`, `ReportAiEditForm.tsx`, `ReportFallbackForm.tsx`, `ReportClarificationView.tsx`: analysis, low-confidence, retry, and manual fallback states.
- `src/components/IssueDetailPage.tsx`: mobile detail hierarchy, sticky actions, agent visibility, closure presentation.
- `src/components/AgentTraceTimeline.tsx`: persisted tool-step storytelling and empty/error states.
- `src/components/OperatorQueue.tsx` and `src/components/OperatorDetailView.tsx`: desktop command-center layout, demo-only clarity, approval controls.
- `src/components/ImpactDashboard.tsx`: defensible metric presentation and insufficient-data states.
- `src/components/VerificationPanel.tsx`, `ResolutionPlanWidget.tsx`, `ClosureVerificationPanel.tsx`, `AutoEscalationPanel.tsx`: approval language, target sizes, compact text, truth boundary.
- `src/index.css`: tokens, focus states, type scale, viewport stability, global overflow safeguards.
- `src/i18n.ts`: revised UI copy must stay truthful in English and Hindi.

Backend files are expected to remain unchanged unless a UI issue exposes a small API read need. Do not weaken `server.ts`, `firestore.rules`, or `storage.rules` for visual convenience.

## Acceptance Criteria

- Mobile 390px is usable without horizontal overflow.
- Tablet is usable and does not look like stretched mobile.
- Desktop 1440px feels clear, beautiful, and command-center-like.
- Navigation stays sticky during scroll.
- Report flow is understandable without explanation.
- Location permission loading, denied, unavailable, manual address, and manual pin states are tested.
- Agent trace is visible after refresh when a persisted run exists.
- Empty agent trace state does not imply a run exists.
- Only two or three synthetic stories appear by default.
- Excess demo records are hidden behind `Show all demo data`.
- No console errors in deployed smoke tests.
- Public `/health` returns 200.
- Public `/readyz` returns 200, with App Check enforcement-disabled warning documented if still true.
- No unsupported claims are introduced.
- Target judge score is 95+ based on verified evidence, not aspiration.

## Validation Strategy

Run these after local implementation and before deployment:

```bash
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev
npm run test:rules
npm run test:concurrency
npm run test:e2e
```

Additional redesign validation:

- Playwright smoke at 390x844, 768x1024, and 1440x900.
- Check no horizontal overflow at 390px.
- Check all visible critical controls are at least 44px.
- Check body/copy text minimums and deliberate metadata exceptions.
- Keyboard walkthrough for nav, report, issue detail, dashboard, and operator flow.
- Screen-reader labels for icon-only buttons and map/location controls.
- Reduced-motion check for animated elements.
- Console error scan.
- Screenshot evidence for mobile home, desktop home, report stepper, location denied fallback, issue detail with persisted agent trace, operator command center, dashboard, and closure state.

After approved deployment:

```bash
curl https://civiclens-py7ixxgroq-as.a.run.app/health
curl https://civiclens-py7ixxgroq-as.a.run.app/readyz
```

Then smoke-test the deployed mobile and desktop UI before updating final submission docs.

## Rollback Plan

- Tag current commit as `pre-ux-redesign`.
- Record current Cloud Run revision `civiclens-00034-82x`.
- Deploy a new revision only after local validation passes.
- If public smoke fails, roll back Cloud Run traffic to the previous healthy revision.
- Do not delete resources during rollback.
- Do not rotate keys during rollback.
- Record the rollback decision and commands in the project progress notes and `docs/FINAL_EVIDENCE_REPORT.md`.

## UX Scorecard

Current deployed inspection estimate:

| Area | Current | Target |
|---|---:|---:|
| Clarity | 7/10 | 10/10 |
| Beauty | 7/10 | 9/10 |
| Mobile usability | 6/10 | 9/10 |
| Demo storytelling | 7/10 | 10/10 |
| Judge confidence | 8/10 | 10/10 |
| Agent visibility | 7/10 | 10/10 |
| Accessibility | 7/10 | 9/10 |

Estimated score lift if the sprint is implemented and verified:

- Product Experience and Design: likely +2 to +3 points on the 10-point criterion.
- Completeness and Usability: likely +1 point on the 5-point criterion.
- Agentic Depth and Innovation storytelling: likely +1 to +2 perceived points by making persisted tool steps and human approvals obvious.
- Overall target: move from a strong but visibly prototype-polish state into the 95+ range, contingent on validation and deployed evidence.

## Do Not Do

- Do not create new backend architecture for this sprint.
- Do not add external filing, messaging, signature, hash, or authority-integration claims.
- Do not make demo mutations affect non-demo records.
- Do not ship fake live metrics or fake traces.
- Do not remove security copy just to make the UI feel cleaner.
- Do not edit the public Google Doc after final submission.
- Do not submit to BlockseBlock without explicit approval.

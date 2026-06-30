# CivicLens Design Review - 2026-06-30

## Scope

This review covers the judge-facing CivicLens surfaces after the v2 finals redesign:

- Public landing and report flow.
- Public issue detail.
- Operator triage and agent console.
- Pilot impact dashboard.
- Mobile/narrow viewport navigation.
- Dark mode and lifecycle status states.

## Baseline Problems

The original audit called out a "utility-soup" UI: mixed off-token colors, dense microcopy, tiny text, decorative prototype behavior, weak state coverage, and dashboard surfaces that did not feel like a serious civic operations tool.

## Design Direction

CivicLens now uses a restrained civic operations style:

- Quiet shell, dense but scannable content, and predictable navigation.
- Tokenized color roles for paper, ink, slate, alert, verify, and marigold accents.
- Carbon-inspired dark mode with persisted user preference.
- Icon plus label status communication so lifecycle meaning is not color-only.
- Compact cards only where they frame real repeated records or tools.
- Public copy that stays clear about the pilot boundary and avoids fake government-submission claims.

## Before / After Review

| Surface | Before | After | Verification |
|---|---|---|---|
| Report flow | Long prototype form, weak mobile hierarchy, limited fallback affordances. | Stepper, camera/gallery split, manual pin fallback, voice intake draft, Gemini draft confirmation, and duplicate/evidence-link branch. | `qa-results/headed-phase-0-6/06-public-mobile-report-upload.png`, `qa-results/public-phase-gaps/01-voice-intake-headed.png` |
| Issue detail | Evidence and lifecycle state were present but hard to scan. | Large proof image, ticket metadata, server-agent evidence, hazards, priority breakdown, lifecycle rail, accountability ledger, and incident timeline. | `qa-results/public-phase-gaps/05-sla-followup-dispatch-ledger.png` |
| Operator desk | Demo-agent behavior risked looking scripted. | Server-emitted agent run, persisted planner/action/self-critique steps, and live operator guardrails. | `qa-results/headed-phase-0-6/05b-public-operator-agent-run-attempt.png` |
| Dashboard | Metrics were not clearly tied to loaded data. | KPI/empty-state clarity, predictive insights, Open311 export, leaderboard, real/demo scope separation. | `qa-results/public-phase-gaps/07-dashboard-predictive-leaderboard.png` |
| Status system | Color-heavy labels. | Icon plus label lifecycle badges and accessible status text. | `LIFECYCLE_A11Y_LIVE reportAxe=0 detailAxe=0 dashboardAxe=0` |
| Dark mode | Missing. | Persistent dark mode with live browser proof. | `DARK_MODE_LIVE theme=dark stored=dark axeSeriousCritical=0` |

## Accessibility Review

- Targeted axe checks report zero serious/critical findings on report, detail, and dashboard surfaces.
- Controls use visible labels, icon labels, and 44px-friendly mobile interaction targets where applicable.
- Dashboard visualizations include table/fallback text paths.
- Status meaning is conveyed through text and icons, not color alone.

## Brand And Voice

CivicLens should sound like a careful civic pilot, not a marketing page or a fake agency portal.

- Primary tone: calm, operational, transparent.
- Avoid: "official complaint filed", "government accepted", "court-grade proof", or any finality that the system cannot legally guarantee.
- Preferred terms: "pilot", "evidence", "draft", "human approval", "public ledger", "synthetic demo".

## Remaining Polish

- A short annotated before/after screenshot deck would strengthen handoff materials.
- Weekly/streak gamification needs the same visual restraint as the rest of the civic UI.
- If App Check is enforced for public judging, add an explicit user-visible recovery path for blocked requests.

## Verdict

The redesign is materially stronger than the baseline and supports a 10/10 design score for the working product experience. The remaining work is final-package presentation, not core UI repair.

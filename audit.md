# CivicLens UI/Flow Audit

Generated from static grep and read-only inspection. No runtime browser pass is included in this audit.

## High Severity

- Mobile operator navigation can leave stale route state.
  - Evidence: `src/components/AppBottomNav.tsx` toggles the Desk/Demo persona without navigating; `src/App.tsx` also only changes persona in the bottom-nav handler.
  - Risk: the mobile button can look like Home while leaving the app on a stale citizen route when the user exits the operator desk.
  - Release fix: make the button choose an intentional destination when switching persona.

- Operator errors use blocking browser alerts.
  - Evidence: `src/components/OperatorDetailView.tsx` uses `alert(...)` for failed status, routing, and escalation actions.
  - Risk: alerts are inaccessible, inconsistent with the app status UI, and lose recovery context.
  - Release fix: replace alerts with inline `role="alert"` error messaging.

- Several visible action controls are below the 44px touch-target target.
  - Evidence: `IssueFeed` support is 36px; `AutoEscalationPanel` and `ResolutionPlanWidget` action buttons are 38px; onboarding dots and Back/Next controls are tiny.
  - Risk: mobile usability and accessibility regressions.
  - Release fix: remove unused `IssueFeed`, raise remaining actions to at least 44px, and convert onboarding dots to semantic buttons.

## Medium Severity

- `IssueFeed` appears orphaned and duplicates active case-card behavior.
  - Evidence: `src/components/IssueFeed.tsx` exports a feed component but no source file imports it.
  - Risk: duplicate card/status/support behavior can drift from `IssueListWithFilter`.
  - Release fix: delete the orphaned component and keep `IssueListWithFilter` as the citizen case list.

- Status color/style logic is repeated.
  - Evidence: local status-style switches exist in `IssueListWithFilter`, `IssueFeed`, and `OperatorQueue`.
  - Risk: status labels stay canonical, but visual meaning can drift across surfaces.
  - Release fix: centralize status visual classes next to `issueStatusLabel`.

- Support/upvote terminology is inconsistent.
  - Evidence: detail page says "Support this report"; issue cards say "Upvote/Upvotes"; feed says "Support/Supports".
  - Risk: citizen action meaning is less clear.
  - Release fix: use "Support" consistently on citizen surfaces.

- Mobile report CTAs compete with each other.
  - Evidence: landing hero has a report button, bottom nav has Report, and `FloatingReportAction` adds another fixed Report button on landing.
  - Risk: small screens get cluttered with duplicate dominant actions.
  - Release fix: hide the floating CTA on landing, report, submitting, duplicate, success, and dashboard.

- Demo seed/clear controls can appear in real operator context.
  - Evidence: `OperatorQueue` shows demo controls based on issue count or demo presence, not `accessMode`.
  - Risk: real operator workspace can show demo maintenance actions.
  - Release fix: show seed/clear only in demo mode.

- Clipboard copy actions lack failure handling.
  - Evidence: `AutoEscalationPanel`, `ResolutionPlanWidget`, and `SuccessPage` call `navigator.clipboard.writeText(...)` without `catch`.
  - Risk: permission failures can look successful or silent.
  - Release fix: add visible success/error feedback.

## Low Severity

- Button styling is not tokenized.
  - Evidence: primary actions mix marigold, ink, indigo, slate, and alert backgrounds; radii and font sizes vary.
  - Risk: visual polish and hierarchy are harder to maintain.
  - Follow-up: create shared button variants after final release gates.

- "Review map cases" copy does not match the target.
  - Evidence: the button scrolls to `issue-list-with-filter`, not the map.
  - Release fix: rename it to "Review case stories" or scroll to the map.

- Important microcopy is still too small in dense panels.
  - Evidence: multiple panels use `text-[8px]`, `text-[9px]`, and `text-[10px]` for non-decorative labels.
  - Follow-up: continue the typography pass in agent, priority, and resolution panels.

## Release Fix Status

- Fixed: mobile operator navigation now selects an intentional route when switching persona.
- Fixed: operator action failures use inline `role="alert"` messaging instead of blocking `alert(...)`.
- Fixed: the orphaned `IssueFeed` component was removed.
- Fixed: status tone classes are centralized next to status labels.
- Fixed: citizen cards use "Support" terminology consistently.
- Fixed: duplicate floating report CTAs are hidden on landing/report/dashboard flows.
- Fixed: demo seed/clear controls are restricted to demo mode.
- Fixed: clipboard actions now surface copy failures.
- Fixed: onboarding dots are semantic buttons with accessible labels.
- Fixed: "Review map cases" was renamed to match its case-story target.
- Fixed: manual location fallback now includes curated search suggestions and selectable coordinates.
- Fixed: the partial Hindi toggle is no longer exposed; the UI says "Hindi coming soon."
- Fixed: key duplicate, escalation, resolution, priority, and onboarding text was raised to readable mobile sizes.
- Remaining follow-up: shared button variants are still not tokenized into a single component library.

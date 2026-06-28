# CivicLens UI and Flow Audit

Generated 2026-06-28 from current source inspection and live Cloud Run verification.

## Scope

- Reviewed `src/components`, `src/App.tsx`, `src/services`, `server.ts`, and public docs.
- Focus areas: inconsistent buttons, orphaned actions, duplicate component patterns, and broken user flows.
- Live verification covered homepage, profile menu, Google sign-in start, Hindi persistence, metrics, issue detail, support/read-only boundaries, and demo operator workspace.

## Release Status

No release-blocking broken user flow was found in the final live pass.

Confirmed working in the current deployment:

- Homepage and map surface load without horizontal overflow.
- Profile menu opens, closes with Escape, and starts the Google OAuth flow without inline app error.
- Hindi selection persists across refresh and English can be restored.
- Metrics separate real records from synthetic demo records and use honest "Not enough data" states.
- Public issue detail displays CivicLens Ticket ID, image, location, status, support, and read-only server-agent evidence.
- Public issue detail does not expose operator mutation controls such as run agent, draft escalation, or resolve.
- Demo/operator workspace is labelled synthetic/demo, and real-case mutation without a valid operator token is denied.
- Pothole report flow completed on the deployed app with gallery upload, Places autocomplete, Gemini triage, duplicate decision, save, issue detail, and refresh.

## Findings

### Medium: Report action wording still varies by flow

Evidence:

- `src/i18n.ts:39` uses "Save a new report".
- `src/i18n.ts:117` uses "Save incident report".
- `src/components/SuccessPage.tsx:41` uses "Report Logged Successfully".
- `src/components/SuccessPage.tsx:140` uses "Report Another Issue".

Impact:

The flow is truthful, but the same citizen action is described with multiple verbs. This is not blocking, yet standardizing on "Save report" / "Save another report" would make the journey feel calmer and reduce any hint of external filing.

Recommendation:

Adopt one citizen action vocabulary across hero, report, success, and card actions. Avoid "file" unless an external filing integration exists.

### Medium: Success page lacks a direct view-saved-issue action

Evidence:

- `src/components/SuccessPage.tsx:128` returns to hub.
- `src/components/SuccessPage.tsx:137` starts another report.
- `src/App.tsx:196` supports detail routing through `handleSelectIssue`, but `SuccessPage` receives only `onNavigate`.

Impact:

After saving, a citizen can reach the saved issue through the hub/feed or deep link, and the final live E2E verified detail persistence. Still, the success page does not offer the expected "View saved issue" primary action.

Recommendation:

Pass the saved issue ID into `SuccessPage` and add a direct "View saved issue" action when `report.id` is available.

### Medium: Report form paths duplicate similar controls

Evidence:

- `src/components/ReportPage.tsx:10` imports `ReportClarificationView`.
- `src/components/ReportPage.tsx:11` imports `ReportAiEditForm`.
- `src/components/ReportPage.tsx:12` imports `ReportFallbackForm`.
- `src/components/ReportPage.tsx:353`, `src/components/ReportPage.tsx:370`, and `src/components/ReportPage.tsx:386` route into separate confirmation/fallback paths.

Impact:

The AI confirmation, clarification, and manual fallback paths are working, but category, severity, submit copy, and validation can drift because they are implemented in separate components.

Recommendation:

Keep the separate views, but extract shared category, severity, and submit-action primitives so labels and validation remain consistent.

### Low: Button variants still mix several visual systems

Evidence:

- `src/components/DuplicateCheckPage.tsx:115` uses hard-coded indigo for duplicate merge.
- `src/components/OperatorDetailView.tsx:387` uses hard-coded indigo for status confirmation.
- `src/components/ClosureVerificationPanel.tsx:213` uses slate for a primary closure action.
- `src/components/ResolutionPlanWidget.tsx:80` uses marigold for another primary action.

Impact:

The controls are named and functional, but the product still mixes marigold, slate, emerald, alert, and indigo for primary-looking actions. This can make action hierarchy harder to scan.

Recommendation:

Introduce shared button variants for citizen primary, secondary, operator record, danger, and ghost actions, then replace hard-coded one-off colors.

### Low: `apiError` display in report flow is effectively orphaned

Evidence:

- `src/components/ReportPage.tsx:122` defines `apiError`.
- `src/components/ReportPage.tsx:258` clears it.
- `src/components/ReportPage.tsx:439` renders it.
- Current grep found no non-null `setApiError(...)` path.

Impact:

The unreachable error slot adds noise when reading the report flow. Runtime analysis failures correctly fall back to manual mode, but the unused branch can confuse future edits.

Recommendation:

Either set `apiError` before entering manual fallback for a visible explanation, or remove the unused state/render branch.

### Low: Compatibility wrappers remain in the client service layer

Evidence:

- `src/services/issues.ts:265` exports `fetchRecentIssues`.
- `src/services/issues.ts:459` exports `generateResolutionPlan`.
- `src/services/issues.ts:644` exports `updateIssueAgentTraceAndPlan`.
- Current production references are absent or compatibility-only.

Impact:

These wrappers do not currently break the release, but they preserve older names from unsafe client-owned workflows and make the ownership boundary harder to scan.

Recommendation:

Delete the wrappers after confirming tests and docs no longer rely on them, or mark them explicitly as deprecated compatibility exports.

### Low: `MobileFrame` name is stale

Evidence:

- `src/App.tsx:3` imports `MobileFrame`.
- `src/App.tsx:504` wraps the app in `MobileFrame`.
- `src/components/MobileFrame.tsx:7` now renders a full responsive shell, not a fake device frame.

Impact:

The implementation is no longer a fake phone shell, so the public UX requirement is met. The component name is misleading for maintainers.

Recommendation:

Rename `MobileFrame` to `AppShell` in a future cleanup.

## Orphaned Components

No fully orphaned component file was found. The remaining duplication risk is pattern-level, mainly around report form paths and button styling.

## Validation Evidence

Current ignored QA artifacts:

- `qa-results/live-pothole-e2e-results.json`: deployed pothole report E2E passed.
- `qa-results/final-live-verification-results.json`: deployed final live verification passed.
- `qa-results/final-judge-flow-report.md`: final checkpoint report.

Current source checks:

```powershell
rg -n '<button|type="button"|type="submit"|onClick=|aria-label=|disabled=|role="button"' src\components src\App.tsx
rg -n 'navigate\(|setCurrentPage\(|onNavigate|href=|window\.location|history\.pushState|return null|TODO|coming soon|disabled|alert\(|confirm\(|copy|clipboard' src\components src\App.tsx src\services
rg -n 'setApiError|apiError|generateResolutionPlan|updateIssueAgentTraceAndPlan|fetchRecentIssues|alert\(|confirm\(' src
```

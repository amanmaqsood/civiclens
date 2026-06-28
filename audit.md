# CivicLens UI and Flow Audit

Generated 2026-06-28 from static grep/read-only inspection. No product code was edited for this audit.

## Scope

- Searched `src/components`, `src/App.tsx`, `src/services`, `src/server`, `server.ts`, and prior `audit.md`.
- Focus areas: inconsistent buttons, orphaned actions/code paths, duplicate component patterns, and broken or confusing user flows.
- This audit does not include a fresh browser runtime pass.

## Follow-up Remediation Applied

- Public issue detail now displays persisted server-agent evidence only; server-agent runs, routing-plan generation, escalation drafting, and lifecycle controls are kept in the operator workspace.
- The submitting screen uses `AgentTraceTimeline` in `local-progress` mode so browser-side save progress is not labeled as a persisted server run.
- Detail routes can fetch a canonical issue by ID when the record is outside the currently loaded feed page.
- Operator status transitions require a written rationale before the confirmation action is enabled; the UI no longer auto-fills a generic rationale.
- The report flow now uses Google Places autocomplete as the primary manual-location search, with curated fallback suggestions only when Places is unavailable.
- Google sign-in is visible in the account menu and uses popup with redirect fallback; anonymous reporting remains available and operator authorization still resolves server-side.
- Hindi localization is enabled and persisted for the core public experience; the previous "Hindi coming soon" audit finding is superseded for citizen-facing flows.
- The issue list no longer uses "File a New Report" copy, and support labels are routed through localization keys.

## High Severity Findings

### 1. Citizen issue detail exposes operator/demo mutation actions

Evidence:
- `src/components/IssueDetailPage.tsx:251` renders the "AI Triage Agent" control for every citizen detail page.
- `src/components/IssueDetailPage.tsx:449` and `src/components/IssueDetailPage.tsx:455` render `AutoEscalationPanel` and `ResolutionPlanWidget` on citizen detail pages.
- `src/services/api.ts:55` sends `runAgentForIssue` with `{ demoOperator: true }`.
- `src/services/issues.ts:613` sends `updateIssueResolutionPlan` with `{ demoOperator: true }`.
- `src/services/issues.ts:750` and `src/services/issues.ts:776` generate and persist escalation drafts with `{ demoOperator: true }`.
- `server.ts:245` allows demo-operator mutations when `issueData.isDemoData === true`.

Impact:
- A public citizen viewing a synthetic demo case can persist operator-like artifacts such as agent runs, draft resolution plans, escalation records, and activity without intentionally entering the demo operator desk.
- On real cases, the same visible controls are likely to fail with authorization errors, which reads like a broken app action rather than a clear permission boundary.

Recommendation:
- Move agent run, resolution-plan generation, escalation drafting/finalization, and closure/operator controls behind the operator/demo desk UI.
- If demo mutation from citizen detail is intentionally allowed for judging, label those controls as "Synthetic demo action" and hide them for real cases instead of showing buttons that can fail.

### 2. Submitting screen labels client-built trace as a persisted server run

Evidence:
- `src/App.tsx:245` through `src/App.tsx:335` constructs `liveTrace` entries in the browser while saving a report.
- `src/App.tsx:652` through `src/App.tsx:669` renders that client-built trace through `AgentTraceTimeline`.
- `src/components/AgentTraceTimeline.tsx:106` and `src/components/AgentTraceTimeline.tsx:109` label any non-empty trace as "Persisted server run" and say steps were loaded from persisted run data.

Impact:
- During the report submission flow, users can see browser-assembled progress described as persisted server agent evidence.
- This conflicts with the product truth boundary that real agent traces must represent server-executed tools and persisted records.

Recommendation:
- Add a display mode to `AgentTraceTimeline`, for example `mode="local-progress" | "persisted-run"`.
- Use neutral "Preparing report" copy for client-side progress, and reserve "Persisted server run" for data returned from `agentRuns`/`agentSteps`.

### 3. Deep links to older issues can resolve to "not found"

Evidence:
- `src/App.tsx:52` through `src/App.tsx:61` supports `#issue/{id}` route parsing.
- `src/App.tsx:115` loads only a paged issue list.
- `src/App.tsx:576` through `src/App.tsx:586` resolves detail pages with `issues.find(...)`; it does not fetch the requested issue by ID if the issue is outside the loaded page.

Impact:
- Shared/detail URLs can fail for valid records that are not in the current page of loaded issues.
- The UI tells users "Issue report not found" even when the record may exist.

Recommendation:
- Add a `fetchIssueById` path for `#issue/{id}` and direct detail selection fallback.
- Keep the existing paged list for the feed, but let detail routes load canonical issue data independently.

### 4. Manual resolve override says rationale is required but auto-fills one

Evidence:
- `src/components/OperatorDetailView.tsx:184` through `src/components/OperatorDetailView.tsx:193` exposes "Manual prototype override (requires rationale in final rebuild)".
- `src/components/OperatorDetailView.tsx:272` through `src/components/OperatorDetailView.tsx:278` shows a rationale textarea but does not require user input.
- `src/components/OperatorDetailView.tsx:47` auto-generates a generic rationale when the textarea is blank.
- `server.ts:521` requires a rationale, but the UI-generated default satisfies that server check.

Impact:
- A consequential resolve/reopen/status transition can be recorded with generic rationale text rather than an explicit human explanation.
- The copy suggests a future/final rebuild requirement even though this is the final judge-facing build.

Recommendation:
- Require non-empty operator-entered rationale before enabling the confirm button.
- Replace "requires rationale in final rebuild" with current-state copy such as "Requires written operator rationale."

## Medium Severity Findings

### 5. Report buttons use inconsistent verbs and casing

Evidence:
- `src/i18n.ts:6`: "Save a New Report"
- `src/i18n.ts:25`: "Save Incident Report"
- `src/components/IssueListWithFilter.tsx:114`: "File a New Report"
- `src/components/ReportFallbackForm.tsx:105`: "Confirm & Save report"
- `src/components/ReportAiEditForm.tsx:141`: "Confirm & Save Report"
- `src/components/SuccessPage.tsx:140`: "Report Another Issue"

Impact:
- The same user intent is variously described as save, file, confirm/save, and report.
- "File" is also close to the unsupported government-filing language the product is trying to avoid.

Recommendation:
- Standardize on "Save report" or "Save incident report" for citizen persistence.
- Avoid "file" unless a real external filing integration exists.

### 6. Primary action colors are inconsistent across equivalent controls

Evidence:
- Citizen primary report/save actions often use marigold: `src/components/LandingPage.tsx:129`, `src/components/ReportAiEditForm.tsx:139`, `src/components/ReportFallbackForm.tsx:103`.
- Some primary actions use ink/slate: `src/components/IssueDetailPage.tsx:287`, `src/components/ReportPage.tsx:494`, `src/components/ClosureVerificationPanel.tsx:192`.
- Duplicate merge and operator confirm actions use indigo: `src/components/DuplicateCheckPage.tsx:115`, `src/components/OperatorDetailView.tsx:281`.
- Escalation uses alert red as a primary action: `src/components/AutoEscalationPanel.tsx:136`.

Impact:
- Users cannot reliably infer which action is the dominant safe action across flows.
- The app still has remnants of multiple design systems despite the improved overall shell.

Recommendation:
- Introduce shared button variants such as `primary`, `secondary`, `danger`, `operator`, and `ghost`.
- Use marigold/ink consistently for ordinary primary actions, reserve alert for destructive/high-risk actions, and remove hard-coded `#4F46E5` where possible.

### 7. Operator confirmation buttons are generic

Evidence:
- `src/components/OperatorDetailView.tsx:280` and `src/components/OperatorDetailView.tsx:281` use "No" and "Yes" for status transitions.
- Nearby operator actions are descriptive: "Approve draft routing/action packet", "Finalize escalation/RTI draft", "Mark Resolved".

Impact:
- Generic confirm labels increase the chance of accidental status changes, especially in a consequential workflow.

Recommendation:
- Use explicit labels like "Cancel" and `Confirm ${issueStatusLabel(confirmingStatus)}`.
- Add disabled state until rationale is entered.

### 8. Report flow has duplicate form implementations that can drift

Evidence:
- `src/components/ReportPage.tsx` owns initial photo/location/description state and submission.
- `src/components/ReportAiEditForm.tsx` duplicates title, category, urgency, severity, and save controls.
- `src/components/ReportFallbackForm.tsx` duplicates category, severity, location, description, and save controls with slightly different copy/casing.
- `src/components/ReportClarificationView.tsx` has its own confirmation action and modifies the AI summary indirectly through `ReportPage`.

Impact:
- Copy, validation, categories, severity behavior, and touch styling can diverge between AI and fallback paths.
- Current drift already appears in button casing and severity labels.

Recommendation:
- Keep separate views if helpful, but extract shared field controls and submit-button copy/variants.
- Add tests that compare AI and fallback categories/severity ranges/copy where they should match.

### 9. Success page lacks a direct "View saved issue" action

Evidence:
- `src/components/SuccessPage.tsx:127` through `src/components/SuccessPage.tsx:141` offers only "Return to Hub" and "Report Another Issue".
- `src/App.tsx:202` through `src/App.tsx:206` has a detail navigation path, but `SuccessPage` receives only `onNavigate`, not an issue-select handler.

Impact:
- After saving, the user cannot immediately open the saved issue detail from the success screen.
- The saved issue detail flow requires returning to the hub and finding the record in the map/feed.

Recommendation:
- Pass a `onViewIssue(id)` callback or allow `SuccessPage` to emit a detail route when `report.id` exists.
- Keep "Return to Hub" as secondary.

## Low Severity / Cleanup Findings

### 10. `apiError` display in `ReportPage` is effectively orphaned

Evidence:
- `src/components/ReportPage.tsx:125` defines `apiError`.
- `src/components/ReportPage.tsx:266` clears it.
- `src/components/ReportPage.tsx:445` renders it.
- Grep found no `setApiError(...)` call with a non-null value.

Impact:
- The user-facing error slot exists but cannot currently be reached.

Recommendation:
- Either set `apiError` on analysis failure before entering fallback mode, or remove the unused state/render branch.

### 11. Compatibility exports appear unused by app code

Evidence:
- `src/services/issues.ts:265` exports `fetchRecentIssues`.
- `src/services/issues.ts:447` exports `generateResolutionPlan`.
- `src/services/issues.ts:632` exports `updateIssueAgentTraceAndPlan`.
- Grep found no production callers; references are definitions or tests asserting absence.

Impact:
- These functions make the service layer harder to reason about and can reintroduce older client-trace patterns.

Recommendation:
- Delete unused compatibility wrappers after confirming tests/docs do not rely on them, or mark them internal/deprecated with a short comment.

### 12. Disabled Hindi paths leave dead branches and mojibake strings

Evidence:
- `src/context/LanguageContext.tsx:5` sets `HINDI_LOCALIZATION_AVAILABLE = false`.
- `src/context/LanguageContext.tsx:7` normalizes saved `hi` back to `en`.
- `src/components/IssueDetailPage.tsx:220` and `src/components/IssueListWithFilter.tsx:171` still branch on `lang/language === "hi"`.
- `src/i18n.ts:68` onward contains garbled Hindi strings.

Impact:
- Current UI truthfully says Hindi is coming soon, but stale/dead localization code can confuse future edits.

Recommendation:
- Keep the public "Hindi coming soon" copy.
- Move Hindi strings/branches to a tracked localization follow-up, or repair encoding before re-enabling the language switch.

### 13. No currently orphaned component file was found

Evidence:
- `rg --files src/components` shows the current component set.
- A component reference-count sweep found every component name referenced outside its own file at least twice.
- The previously documented orphaned `IssueFeed.tsx` file is no longer present.

Impact:
- Duplicate risk is now pattern-level, not a simple unused component file.

Recommendation:
- Focus cleanup on shared action/card/form primitives rather than deleting component files.

## Fixed Findings From Previous Audit

- Fixed: old `IssueFeed.tsx` orphan is gone.
- Fixed: blocking `alert(...)`/`confirm(...)` calls are gone from production `src` files.
- Fixed: demo seed/clear controls are gated by `accessMode === "demo"`.
- Fixed: mobile bottom nav chooses an intentional route when toggling desk mode.
- Fixed: clipboard actions now have visible failure handling in checked panels.
- Fixed: manual location suggestions exist and are selectable.
- Fixed: public Google sign-in is hidden while Firebase Authorized Domains remain unverified.

## Validation Notes

Commands used for this audit:

```powershell
rg -n '<button|type="button"|type="submit"|onClick=|aria-label=|disabled=|role="button"' src\components src\App.tsx
rg -n 'navigate\(|setCurrentPage\(|onNavigate|href=|window\.location|history\.pushState|return null|TODO|coming soon|disabled|alert\(|confirm\(|copy|clipboard' src\components src\App.tsx src\services
rg -n 'Generate Draft Plan|Run server agent|Re-run server agent|Draft Escalation|Evaluate repair|Approve draft|Finalize escalation|Mark Resolved|Manual prototype override|operator|demoOperator: true' src\components src\services\api.ts src\services\issues.ts
rg -n 'setApiError|apiError|generateResolutionPlan|updateIssueAgentTraceAndPlan|fetchRecentIssues|lang === "hi"|language === "hi"|HINDI_LOCALIZATION_AVAILABLE' src
rg -n 'alert\(|confirm\(|window\.alert|window\.confirm' src
```

Result summary:
- Current high-value flow issues remain around citizen-visible operator/demo mutations, trace labelling, deep-link loading, and manual resolve rationale.
- No live `alert(...)`/`confirm(...)` production calls were found.
- No fully orphaned component file was found.

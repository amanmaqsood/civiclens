# CivicLens - Win-Oriented Vibe2Ship Implementation Plan

**Working title:** CivicLens  
**Tagline:** From a citizen's evidence to a verified resolution plan in under 60 seconds.  
**Selected problem statement:** Community Hero - Hyperlocal Problem Solver  
**Plan date:** 22 June 2026, IST  
**Official deadline:** 29 June 2026, 2:00 PM IST  
**Internal submission target:** 29 June 2026, 11:00 AM IST  
**Feature freeze:** 28 June 2026, 10:00 AM IST  
**Release candidate:** 28 June 2026, 2:00 PM IST

---

## 1. Executive decision

Build **CivicLens**, a mobile-first civic resolution agent that turns a photo, location, and short citizen description into a structured, deduplicated, community-verified issue case; creates a transparent resolution plan; routes it into an authority-style work queue; and validates before/after evidence before closure.

The winning thesis is not "another complaint portal." It is:

> **Existing portals collect complaints. CivicLens converts fragmented citizen evidence into one canonical, explainable, action-ready case and keeps it accountable until verified closure.**

This choice is intentionally optimized for the judging matrix:

- The problem is visible, relatable, and high-impact.
- Multimodal AI is genuinely necessary rather than decorative.
- A tool-using, multi-step agent loop can be demonstrated clearly.
- Google AI Studio, Gemini, Google Maps, Firebase, and Cloud Run fit naturally.
- The before/after demo is memorable and understandable within two minutes.
- It is more differentiated than a generic AI task manager while still feasible for one strong developer in the available time.

No plan can guarantee a judging outcome. This plan is designed to maximize rubric coverage, demo reliability, originality evidence, and execution quality under the solo/deadline constraints.

---

## 2. Non-negotiable official constraints

1. Participation is solo.
2. Exactly one problem statement must be selected.
3. Google AI Studio must be central to development and deployment.
4. The public application must remain accessible during evaluation.
5. Source code and documentation must be available in a GitHub repository.
6. A publicly accessible Google Doc must include at least:
   - selected problem statement;
   - solution overview;
   - key features;
   - technologies used;
   - Google technologies utilized.
7. Submission must be made through BlockseBlock.
8. The submission must reflect the participant's own work and understanding. Open-source tools are allowed with attribution.
9. Organizers may review originality, functionality, and Google Doc version history.
10. The official deadline is 29 June 2026 at 2:00 PM IST; late submissions are rejected.

Operational consequence: create the GitHub repository and Google Doc immediately, commit incrementally, keep prompt/decision logs, and deploy on Day 1. Do not manufacture history at the end.

---

## 3. Why Community Hero is the stronger winning bet

### Problem 1: Last-Minute Life Saver

Advantages:
- Easy to understand.
- Fast to prototype.
- Natural calendar/voice/agent opportunities.

Risks:
- Very crowded product category.
- Many entries will look like "todo app + chatbot."
- Calendar/email integrations can consume time without creating a distinctive demo.
- It is harder to prove societal impact in a short judging session.

### Problem 2: Community Hero

Advantages:
- Strong visual demo using real-world evidence and a map.
- Natural multimodal input and structured AI analysis.
- Natural multi-agent/tool-calling workflow.
- Clear social impact and measurable resolution outcomes.
- Strong fit for Google Maps and Gemini in addition to AI Studio.
- Distinctive "proof of resolution" ending.

Risks:
- Scope can explode into a municipality-scale platform.
- Real authority integrations are unavailable or unreliable.
- Geospatial deduplication can become technically complex.

Mitigation: build one closed-loop workflow for a limited demo geography, use an authority console rather than depending on live municipal APIs, and implement deterministic geospatial heuristics appropriate for a hackathon.

**Decision:** Community Hero offers the highest upside against the top 75% of the scoring matrix while remaining controllable with strict scope.

---

## 4. Rubric-to-product strategy

### 4.1 Problem Solving & Impact - 20%

What judges must see:
- Reporting is fast.
- Duplicate complaints become one stronger case instead of noise.
- Community evidence improves confidence.
- Every issue has ownership, status, next action, and closure proof.
- Dashboard shows estimated people affected, issue age, verification count, and resolution time.

Evidence to prepare:
- A before/after workflow comparison.
- Three seeded scenarios: pothole duplicate, water leakage escalation, resolved streetlight.
- Measurable product metrics in the demo, explicitly labeled as demo metrics where applicable.

### 4.2 Agentic Depth - 20%

What judges must see:
- The system observes evidence, reasons in stages, uses tools, persists state, and chooses a next action.
- The agent does more than generate text.
- Human approval gates exist for consequential actions.
- An Agent Trace panel exposes the steps, tool calls, confidence, and reasons.

Demonstrated stages:
1. Evidence Triage Agent.
2. Geo-Deduplication Agent.
3. Community Verification Agent.
4. Resolution Coordinator Agent.
5. Proof-of-Closure Agent.
6. Impact Analyst for dashboard insights.

### 4.3 Innovation & Creativity - 20%

Distinctive features:
- Canonical incident graph: multiple reports become one verified issue.
- Explainable priority score combining severity, age, public risk, and community confirmations.
- Resolution action packet rather than a passive complaint.
- Before/after visual verification and reopen recommendation.
- Transparent decision trace so citizens understand what the AI did.

### 4.4 Usage of Google Technologies - 15%

Core stack:
- Google AI Studio Build Mode for full-stack development.
- Gemini multimodal analysis, structured outputs, and function calling.
- Deployment initiated through Google AI Studio to Cloud Run.
- Google Maps JavaScript API for location, markers, and clusters.
- Google Geocoding/reverse geocoding.
- Firebase Auth, Firestore, and Storage where provisioning succeeds within the setup checkpoint.

The application and documentation must explain what each Google technology contributes. A logo wall is not enough.

### 4.5 Product Experience & Design - 10%

Product principles:
- Mobile-first citizen flow.
- One primary action per screen.
- Report completion in under 60 seconds during the prepared demo.
- Map and list views with consistent status semantics.
- Clear loading, empty, success, error, and low-confidence states.
- Accessible labels, focus states, touch targets, and contrast.

### 4.6 Technical Implementation - 10%

Evidence:
- Typed schemas.
- Server-side secrets.
- Explicit state machine.
- Validation around every model response.
- Idempotent tools where possible.
- Unit, integration, and end-to-end tests.
- Error recovery and fallbacks.
- Architecture and data-flow diagrams.

### 4.7 Completeness & Usability - 5%

Winning rule: eight polished screens that complete one loop beat twenty disconnected screens.

The public deployment must support the entire prepared story without manual database edits or developer console intervention.

---

## 5. Product definition

## 5.1 Primary personas

### Citizen Reporter
Wants to report a local problem quickly, understand whether it already exists, and see what happens next.

### Community Verifier
Confirms or contradicts a nearby report, adds evidence, and increases case confidence.

### Resolution Operator
Uses an authority-style console to review prioritized cases, accept an action plan, update work status, and upload completion evidence.

### Judge
Needs to understand the value, agent behavior, Google technology use, and technical quality in a short session.

## 5.2 Core end-to-end journey

1. Citizen taps **Report an Issue**.
2. Citizen uploads/takes a photo, shares location, and optionally speaks or types one sentence.
3. Evidence Agent returns category, severity, concise description, visible hazards, confidence, privacy warnings, and suggested urgency.
4. Citizen confirms or edits the AI summary.
5. Geo-Dedup Agent checks nearby active cases and either:
   - suggests adding the report as evidence to an existing case; or
   - creates a new canonical case.
6. Nearby users verify, dispute, or add evidence.
7. Resolution Coordinator produces:
   - recommended owner/category;
   - concrete next actions;
   - target response window;
   - complaint/action packet;
   - escalation rule.
8. Operator accepts the plan and advances status.
9. Operator/citizen uploads after-evidence.
10. Closure Agent compares before/after evidence and recommends resolve, request more proof, or reopen.
11. Dashboard updates impact and resolution metrics.

## 5.3 State machine

```text
DRAFT
  -> REPORTED
  -> TRIAGED
  -> DUPLICATE_REVIEW
      -> MERGED
      -> NEW_CANONICAL_CASE
  -> COMMUNITY_VERIFICATION
  -> ROUTED
  -> ACKNOWLEDGED
  -> IN_PROGRESS
  -> RESOLUTION_EVIDENCE_SUBMITTED
  -> CLOSURE_REVIEW
      -> RESOLVED
      -> NEEDS_MORE_EVIDENCE
      -> REOPENED
```

Server code, not the model, owns allowed transitions. The model recommends; deterministic application rules authorize.

---

## 6. Scope control

## 6.1 P0 - Must ship

1. Mobile-first landing and demo entry.
2. New report flow with photo, location, and text/voice transcript field.
3. Gemini multimodal triage with structured result.
4. User confirmation/editing of AI analysis.
5. Map with issue markers and status filters.
6. Nearby duplicate suggestion and merge confirmation.
7. Canonical issue detail page with timeline.
8. Community verify/dispute/add-evidence actions.
9. Resolution plan and authority-style queue.
10. Status progression.
11. Before/after resolution evidence and AI closure recommendation.
12. Impact dashboard.
13. Visible Agent Trace/Why panel.
14. Public deployment.
15. GitHub README, architecture docs, attribution, tests, and public Google Doc.

## 6.2 P1 - Ship only after P0 is stable

1. English/Hindi UI toggle or bilingual AI summary.
2. Browser speech-to-text shortcut.
3. Lightweight points/badges for verified contributions.
4. Shareable public case link.
5. Downloadable complaint/action packet.
6. Dark mode only if the design system already supports it cleanly.

## 6.3 Explicitly out of scope

- Native mobile app.
- Real municipality integrations that require approval or unstable APIs.
- Payment, donations, or crowdfunding.
- Social feed/chat system.
- Custom-trained predictive model.
- Large-scale video understanding pipeline.
- Autonomous emergency dispatch.
- Complex role-based enterprise administration.
- Push/SMS/WhatsApp integration unless the core flow is already frozen and stable.

---

## 7. Agent design

## 7.1 Evidence Triage Agent

Input:
- image;
- citizen text/transcript;
- coordinates and reverse-geocoded address;
- optional local context.

Structured output:

```ts
interface IssueAnalysis {
  category: "pothole" | "water_leak" | "streetlight" | "waste" | "drainage" | "road_damage" | "other";
  title: string;
  summary: string;
  severity: 1 | 2 | 3 | 4 | 5;
  urgency: "routine" | "priority" | "urgent";
  visibleHazards: string[];
  affectedAreaEstimate: "single_property" | "street" | "neighborhood" | "unknown";
  privacyFlags: string[];
  confidence: number;
  clarificationQuestion?: string;
}
```

Rules:
- Validate response against a schema.
- If confidence is below the selected threshold, ask one focused clarification.
- Show the result to the citizen before persisting as confirmed fact.
- Never invent an exact authority or emergency response from image evidence alone.

## 7.2 Geo-Deduplication Agent

Candidate retrieval is deterministic:
- same/compatible category;
- active status;
- within configured radius, initially 150 meters;
- recent enough, initially 14 days;
- nearest candidates first.

The agent then compares image/text/context and returns:

```ts
interface DuplicateAssessment {
  candidateIssueId: string;
  similarity: number;
  reasons: string[];
  recommendation: "merge" | "create_new" | "ask_user";
}
```

Rules:
- Similarity above the high threshold suggests merge.
- Medium confidence asks the citizen to choose.
- A merge is never performed without explicit confirmation.
- Every raw report remains attributable as evidence even after merging.

## 7.3 Community Verification Agent

The product records human signals deterministically. The agent summarizes:
- confirmations;
- disputes;
- evidence recency;
- reporter reliability signal;
- unresolved contradictions.

It recommends a verification status but cannot delete dissenting evidence.

## 7.4 Resolution Coordinator Agent

The coordinator receives the canonical issue and calls controlled tools:

```text
searchNearbyIssues
createCanonicalIssue
mergeDuplicateReport
addCommunityVerification
calculatePriorityScore
assignAuthorityQueue
createActionPacket
updateIssueStatus
recordResolutionEvidence
```

Output:

```ts
interface ResolutionPlan {
  recommendedQueue: string;
  rationale: string[];
  nextActions: Array<{
    order: number;
    action: string;
    owner: "citizen" | "operator" | "field_team";
    dueInHours: number;
  }>;
  targetResponseHours: number;
  escalationCondition: string;
  actionPacket: {
    subject: string;
    summary: string;
    evidenceChecklist: string[];
  };
  confidence: number;
}
```

The operator must approve queue assignment and status-changing actions.

## 7.5 Proof-of-Closure Agent

Inputs:
- before image;
- after image;
- original issue analysis;
- operator note;
- recent community feedback.

Output:

```ts
interface ClosureAssessment {
  recommendation: "resolve" | "request_more_evidence" | "reopen";
  confidence: number;
  observedChanges: string[];
  unresolvedSignals: string[];
  explanation: string;
}
```

Rules:
- AI does not silently close a case.
- Low confidence requires human/community review.
- The issue history preserves all recommendations and decisions.

## 7.6 Impact Analyst

Produces explainable insights such as:
- oldest unresolved clusters;
- high-severity/high-verification cases;
- average demo resolution time;
- duplicate reports consolidated;
- neighborhoods with repeated categories.

Do not label correlations as real-world predictions unless supported by real data. Use "demo insight" labels for seeded records.

## 7.7 Agent Trace

Every agent run stores:
- timestamp;
- model role;
- input summary, excluding sensitive raw data where unnecessary;
- structured result;
- tools requested and results;
- confidence;
- duration;
- fallback/error state;
- user/operator confirmation.

UI presents a concise trace:

```text
1. Analyzed evidence -> pothole, severity 4/5
2. Searched 6 active reports within 150 m
3. Found one likely duplicate, similarity 0.89
4. Citizen confirmed merge
5. Recalculated priority from 68 to 82
6. Drafted action packet and routed to Road Maintenance queue
```

This is essential because hidden agent sophistication earns no judging credit.

---

## 8. Technical architecture

## 8.1 Recommended stack

### Application
- Google AI Studio Build Mode.
- React + TypeScript frontend generated and iterated in AI Studio.
- Server-side TypeScript/Node runtime in the full-stack project.
- Deployment from AI Studio to Cloud Run.

### AI
- Gemini multimodal model available in AI Studio at implementation time.
- `@google/genai` SDK.
- Structured JSON outputs.
- Function calling for tool selection.
- Zod or equivalent runtime schema validation.

### Google platform services
- Google Maps JavaScript API.
- Geocoding/reverse geocoding.
- Firebase Authentication, preferably anonymous plus optional Google sign-in.
- Firestore for domain records.
- Firebase Storage for report and resolution images.

### Quality
- Vitest for unit and integration tests.
- React Testing Library for component behavior.
- Playwright for critical end-to-end flows.
- ESLint and TypeScript checks.

## 8.2 Architecture diagram

```text
Citizen / Verifier / Operator Browser
                |
                v
Google AI Studio full-stack application
  React UI + server routes + agent orchestrator
        |                 |                 |
        v                 v                 v
   Gemini API        Google Maps       Firebase
 structured output   maps/geocoding   auth/data/files
 function calling
        |
        v
Controlled domain tools + state machine
        |
        v
AgentRun log, canonical issues, reports, verification,
resolution plans, evidence, metrics
                |
                v
Deployment initiated in AI Studio -> Cloud Run public URL
```

## 8.3 Data model

### User
- id
- role: citizen | verifier | operator
- displayName
- locale
- contributionScore
- createdAt

### Report
- id
- reporterId
- imageUrl
- thumbnailUrl
- rawText
- coordinates
- address
- createdAt
- aiAnalysis
- canonicalIssueId
- isDemoData

### Issue
- id
- category
- title
- summary
- severity
- priorityScore
- coordinates
- geohash
- status
- verificationStatus
- reportCount
- confirmationCount
- disputeCount
- assignedQueue
- resolutionPlanId
- createdAt
- updatedAt
- resolvedAt
- isDemoData

### Verification
- id
- issueId
- userId
- type: confirm | dispute | evidence
- note
- imageUrl
- createdAt

### ResolutionPlan
- id
- issueId
- recommendedQueue
- rationale
- actions
- targetResponseHours
- escalationCondition
- actionPacket
- approvedBy
- approvedAt

### ResolutionEvidence
- id
- issueId
- submittedBy
- afterImageUrl
- note
- closureAssessment
- decision
- createdAt

### AgentRun
- id
- issueId/reportId
- agentType
- model
- inputDigest
- output
- toolCalls
- confidence
- latencyMs
- status
- createdAt

### Activity
- id
- issueId
- actorType
- eventType
- message
- metadata
- createdAt

## 8.4 Suggested code organization

```text
src/
  app/
  components/
    ui/
    maps/
    agent-trace/
  features/
    reporting/
    issues/
    verification/
    resolution/
    authority-console/
    dashboard/
  lib/
    gemini/
    maps/
    firebase/
    validation/
  schemas/
    issue-analysis.ts
    duplicate-assessment.ts
    resolution-plan.ts
    closure-assessment.ts
  server/
    agents/
    tools/
    repositories/
    state-machine/
    api/
  tests/
    unit/
    integration/
    e2e/
docs/
  architecture/
  ai-studio/
    prompts.md
  decisions/
  demo/
```

Adapt to the actual AI Studio scaffold; do not waste time rearranging a working generated project merely to match this tree.

## 8.5 Deterministic priority score

AI may extract signals; the final priority score should be deterministic and testable.

Example:

```text
priority =
  severity * 12
  + publicRisk * 10
  + min(issueAgeHours / 12, 10)
  + min(confirmationCount * 3, 15)
  + affectedAreaWeight
  - disputePenalty
```

Display the factors in the UI. Tune constants using demo scenarios, not to fabricate accuracy.

## 8.6 Reliability fallbacks

| Failure | User-safe fallback |
|---|---|
| Gemini timeout | Save report draft, show retry, keep image/text intact |
| Malformed model JSON | Repair once, then ask user for manual category/severity |
| Low confidence | Ask one clarification and require confirmation |
| Map permission denied | Search/manual address pin |
| Geocoding fails | Retain coordinates and user-entered landmark |
| Image upload fails | Compress/retry without losing form state |
| Duplicate service fails | Create a provisional case and run duplicate review later |
| Firebase unavailable | Read-only seeded demo plus local temporary report mode for the presentation contingency |
| Cloud Run cold start | Lightweight landing, progress state, warm-up before judging |

---

## 9. UX and design system

## 9.1 Visual direction

Tone: trustworthy civic utility, not government bureaucracy and not a playful social network.

Use:
- neutral background;
- one clear primary action color;
- semantic status colors with text/icons, never color alone;
- restrained cards and borders;
- prominent evidence imagery;
- simple map controls;
- consistent 8-point spacing system;
- readable type scale;
- subtle motion only for state transitions and agent progress.

## 9.2 Core screens

1. Landing / impact snapshot.
2. Map and issue list.
3. Report capture.
4. AI review and clarification.
5. Duplicate decision.
6. Issue detail/timeline.
7. Community verification.
8. Operator queue.
9. Resolution plan.
10. Before/after closure review.
11. Impact dashboard.
12. Agent Trace drawer/modal.

## 9.3 Interaction details that signal quality

- Camera upload offers preview, replace, and compression status.
- Location shows a human-readable address and editable map pin.
- AI analysis uses a progress sequence, not an indefinite spinner.
- Low-confidence fields are highlighted for confirmation.
- Duplicate candidates show distance, age, image, and similarity reasons.
- Issue status is a timeline with the current next action.
- Verification actions cannot be accidentally repeated without feedback.
- Operator decisions show confirmation and audit note.
- Before/after comparison supports side-by-side or slider view.
- Empty/error/loading states are designed, not browser defaults.

## 9.4 Accessibility checklist

- Semantic headings and landmarks.
- Labels for every input.
- Keyboard-operable dialogs and map alternatives.
- Visible focus ring.
- Minimum touch target around 44px.
- Meaningful image alt text or decorative empty alt.
- Status not conveyed by color alone.
- Error messages connected to fields.
- Respect reduced motion.
- Test at 360 x 800, 768px tablet, and desktop.

---

## 10. Engineering workflow

Use the combined skill methodology:

1. **Brainstorm and challenge assumptions** before implementation.
2. **Write the implementation plan and acceptance criteria** before large prompts.
3. **Build one vertical slice** rather than scaffolding every page.
4. **TDD deterministic logic**: schemas, state transitions, score, dedupe filtering.
5. **Use AI Studio in small, reviewable prompts**, not one "build the whole app" prompt.
6. **Commit after each accepted slice** with meaningful messages.
7. **Run product/CEO review**, then design review, engineering review, and QA review at explicit gates.
8. **Verify before declaring done** from the public deployment.

## 10.1 Prompt discipline

Maintain `docs/ai-studio/prompts.md` with:
- date/time;
- goal;
- prompt;
- files/components affected;
- result accepted/rejected;
- manual changes;
- verification.

Recommended prompt sequence:
1. Scaffold the domain and mobile shell.
2. Implement report form and typed mock analysis.
3. Replace mock analysis with server-side Gemini structured output.
4. Add persistence.
5. Add map and candidate retrieval.
6. Add duplicate assessment.
7. Add verification and timeline.
8. Add resolution coordinator and tools.
9. Add closure analysis.
10. Add dashboard and Agent Trace.
11. Run focused accessibility and error-state passes.

Never feed unreviewed generated changes directly into the release branch.

## 10.2 Git discipline

Branches may be lightweight because this is solo, but preserve reviewability:
- `main`: deployable.
- short-lived feature branches for risky work.
- tagged release candidate.

Commit examples:
- `chore: scaffold AI Studio full-stack app and deployment smoke test`
- `feat(report): add image and geolocation capture`
- `feat(ai): validate Gemini issue analysis schema`
- `feat(issues): add geospatial duplicate candidate search`
- `feat(agent): orchestrate resolution plan tool calls`
- `test(e2e): cover report-to-resolution golden path`
- `docs: finalize architecture and submission guide`

---

## 11. Detailed delivery schedule

The schedule assumes the plan begins on the evening of 22 June. Maintain at least approximately six hours of sleep; exhausted debugging in the final 48 hours creates more risk than it removes.

## 11.1 22 June, evening - Foundation and risk elimination

### Goals
- Freeze problem choice and product thesis.
- Create repository and Google Doc.
- Prove AI Studio build and public deployment immediately.
- Confirm Google/Firebase/Maps access.

### Tasks
1. Create GitHub repository with README skeleton, license decision, `.gitignore`, and attribution file.
2. Create public Google Doc with the required headings and initial concept/version history.
3. Open Google AI Studio Build Mode and create the full-stack project.
4. Generate only the app shell, design tokens, routing, and sample landing/report page.
5. Add server-side environment/secrets pattern.
6. Deploy a smoke version from AI Studio.
7. Test public URL in incognito/mobile.
8. Create Firebase project/resources or connect an existing isolated project.
9. Enable Maps JavaScript and Geocoding APIs; restrict keys appropriately.
10. Seed `docs/decisions` and `docs/ai-studio/prompts.md`.

### Hard acceptance criteria by end of session
- Public Cloud Run/app URL opens without authentication or local setup.
- GitHub repository exists and has at least three meaningful commits.
- Google Doc is public to anyone with the link.
- A report form can be opened on mobile.
- All required service credentials are available server-side or a documented fallback is selected.

### Stop condition
If Firebase/Maps provisioning takes more than 90 minutes, isolate the issue, continue with typed adapters and local demo data, and revisit after the vertical slice exists.

## 11.2 23 June - First deployed vertical slice

### Goal
A citizen submits a photo/location/text, Gemini returns validated structured triage, the citizen confirms it, and the issue appears on the map and detail page.

### Implementation order
1. Define schemas and tests first.
2. Build report form with image preview/compression and location.
3. Add server endpoint for Gemini analysis.
4. Validate/repair structured output.
5. Add confirmation/edit screen.
6. Persist report and canonical issue.
7. Add map marker and issue detail timeline.
8. Add loading/error/low-confidence states.
9. Deploy v0.1 and run mobile smoke test.

### Acceptance criteria
- Prepared pothole image is analyzed into the expected broad category and a reasonable severity range.
- Malformed output does not crash the UI.
- User can edit the AI summary.
- Refreshing the public app preserves the saved case when Firebase is enabled.
- The issue appears on map and list.
- End-to-end vertical slice completes in under 90 seconds; target under 60 after polish.

## 11.3 24 June, morning - Dedupe and mentor preparation

### Goals
- Add duplicate candidate retrieval and merge confirmation.
- Prepare specific mentor questions based on actual implementation blockers.

### Tasks
1. Add deterministic nearby issue query.
2. Add duplicate assessment schema and server call.
3. Build candidate comparison UI.
4. Preserve each report as separate evidence after merge.
5. Add tests for radius/category/time filtering and merge invariants.
6. Prepare a 60-second current demo and architecture screenshot for mentor discussion.

### Acceptance criteria before mentor session
- Submitting a second prepared pothole report near the first suggests the existing issue.
- User can merge or create new.
- Canonical issue increments report/evidence count.
- No data is silently discarded.

## 11.4 24 June, 4:00-6:00 PM - Mentor session

Ask concise, implementation-specific questions:
1. Does AI Studio Build Mode plus deployment initiated from AI Studio satisfy the deployment requirement when Firebase and Maps are supporting services?
2. Is clearly labeled seeded civic demo data acceptable for showing clustering and dashboards?
3. Is an authority work-queue simulation acceptable, or is a live government integration expected?
4. What visible evidence does the jury consider strongest for "agentic depth"?
5. Are there final-presentation duration, demo-video, or additional submission fields not yet documented?
6. Are judges expected to test primarily on mobile or desktop?

Record answers and update the decision log the same evening.

## 11.5 24 June, evening - Scope lock

### Goals
- Incorporate only high-value mentor guidance.
- Freeze P0 scope by 8:00 PM.
- Build the verification model and state machine skeleton.

### Acceptance criteria
- Updated one-page scope exists.
- Any removed feature is documented.
- All state transitions have tests.
- Community confirmation/dispute is persisted and visible.

## 11.6 25 June - Agentic resolution workflow

### Goal
Turn a verified issue into an explainable action plan via function-calling tools and an operator queue.

### Tasks
1. Implement deterministic priority score and tests.
2. Implement controlled domain tools.
3. Build orchestrator with function calls and structured ResolutionPlan.
4. Add operator queue sorted by priority.
5. Add issue plan page with rationale, actions, target response, and action packet.
6. Add human approval for routing/status change.
7. Add AgentRun persistence and Agent Trace UI.
8. Add one retry and one safe fallback path.

### Acceptance criteria
- Agent invokes at least two real application tools in the prepared flow.
- Tool result changes persisted application state.
- Trace shows steps and confidence.
- Operator can approve plan and move to acknowledged/in-progress.
- Repeated request does not create duplicate plans or duplicate actions.

## 11.7 26 June - Closure loop and impact dashboard

### Goal
Complete the full lifecycle and make impact visible.

### Tasks
1. Add after-image upload and note.
2. Implement ClosureAssessment schema and server analysis.
3. Build before/after comparison.
4. Add human decision: resolve/request more evidence/reopen.
5. Build dashboard metrics and cluster insights.
6. Seed three polished, clearly labeled demo scenarios.
7. Add bilingual summary or Hindi toggle only after the full loop works.
8. Add lightweight contribution score only if stable.

### Acceptance criteria
- One prepared case can move from report to resolved entirely in the public app.
- A deliberately insufficient after-image produces a request-more-evidence or low-confidence state.
- Dashboard updates after resolution.
- Demo data is clearly distinguishable from user-created records.

## 11.8 27 June - Product, design, and engineering hardening

### Morning: product/CEO review
Ask:
- Is the value proposition obvious in ten seconds?
- Is AI required for the demonstrated outcome?
- Does the app solve reporting through resolution, not just categorization?
- Which screen would a judge remember?
- Which feature can be removed without reducing score?

### Afternoon: design review
- Mobile layout at 360px.
- Navigation, hierarchy, status consistency.
- All states and dialogs.
- Accessibility pass.
- Image/map performance.
- Copywriting pass; remove jargon.

### Evening: engineering review
- Secret handling.
- Schema validation.
- State transition authorization.
- Firestore rules and storage restrictions.
- Error boundaries and retry behavior.
- Idempotency.
- Logging and observability.
- Dependency attribution.

### Acceptance criteria
- No P0 blocker remains.
- No severe accessibility defect in the golden path.
- No secret in client bundle/repository.
- Public URL passes full golden-path test twice.
- Codebase has no known crash path in prepared scenarios.

## 11.9 28 June - Freeze, QA, and submission assets

### 8:00-10:00 AM
- Fix only scoring-critical bugs.
- Feature freeze at 10:00 AM.

### 10:00 AM-2:00 PM
- Full Playwright/manual regression.
- Cross-device/cold-start checks.
- Performance/image optimization.
- Create release candidate and deploy.
- Preserve previous known-good deployment/tag.

### 2:00-7:00 PM
- Finalize README.
- Finalize Google Doc.
- Create architecture diagram and screenshots.
- Record a clean 90-120 second demo video even if not mandatory.
- Draft finalist pitch deck outline.

### 7:00-10:00 PM
- External-style QA from a fresh browser/account.
- Fix only blocker/high-severity defects.
- Verify all public permissions.

### Release candidate acceptance criteria
- Public app is stable in incognito.
- GitHub setup instructions work or clearly explain hosted demo.
- Tests/checks pass.
- Required Google Doc sections are complete.
- Demo video exists locally/cloud-backed.
- All claims have evidence.

## 11.10 29 June - Submission day

### 8:00-9:30 AM
- Final smoke from public URL.
- Warm app and verify cold start separately.
- Check image upload, Gemini call, map, persistence, agent trace, closure, and dashboard.

### 9:30-10:30 AM
- Confirm:
  - deployed link is public;
  - GitHub repository is public;
  - Google Doc is anyone-with-link;
  - no expired temporary assets;
  - BlockseBlock fields are understood.

### 10:30-11:00 AM
- Submit through BlockseBlock.
- Capture confirmation screenshot and timestamp.

### 11:00 AM-2:00 PM
- Emergency buffer only.
- Do not make cosmetic changes to the live release unless a genuine submission blocker appears.

---

## 12. Testing plan

## 12.1 Unit tests

- IssueAnalysis schema accepts valid output and rejects missing/invalid fields.
- Duplicate candidate filtering respects category, radius, status, and age.
- Distance calculation boundary cases.
- Priority score factors and caps.
- State machine permits valid transitions and blocks invalid ones.
- Merge preserves source reports.
- Closure decision does not bypass human confirmation.

## 12.2 Integration tests

- Report API with mocked Gemini structured output.
- Malformed output repair/fallback.
- Agent orchestrator calls allowed tools and persists results.
- Idempotent action-plan creation.
- Firebase repository adapter behavior.
- Image metadata/compression path.

## 12.3 End-to-end tests

### Golden path
1. Open public app.
2. Create report with prepared pothole image.
3. Confirm AI result.
4. Create/merge issue.
5. Verify case.
6. Generate and approve resolution plan.
7. Move to in progress.
8. Upload after evidence.
9. Resolve.
10. Confirm dashboard change.

### Duplicate path
- Second nearby report is suggested as duplicate and merges correctly.

### Low-confidence path
- AI asks clarification/manual confirmation without crash.

### Reopen path
- Insufficient resolution evidence results in more evidence/reopen.

## 12.4 Manual release checklist

- Fresh incognito session.
- Chrome desktop and mobile emulation.
- Real phone if available.
- Deny location permission.
- Slow network.
- Large image.
- Missing image.
- Gemini timeout simulation.
- Map failure/manual location.
- Refresh during each major step.
- Back navigation.
- Multiple clicks/double submit.
- Public link permissions.

---

## 13. Seeded demo scenarios

All seeded records carry a visible **Demo Data** badge.

### Scenario A - Duplicate pothole
- First report: large pothole near a school route.
- Second report: different angle, 45 meters away, similar timestamp.
- Result: agent recommends merge; verification count and priority increase.

### Scenario B - Escalating water leakage
- Multiple confirmations over time.
- Age and affected-area signal raise priority.
- Resolution Coordinator creates urgent action steps and escalation condition.

### Scenario C - Streetlight closure
- Clear before/after images.
- Closure Agent identifies restored illumination/fixture state and recommends resolution.
- Dashboard resolution count and average age update.

Use original, licensed, or properly attributed media. Never imply these represent real municipal cases unless they do.

---

## 14. Demo script

Target: 90 seconds for screening; prepare a longer 4-5 minute finalist version.

### 0-10 seconds - Problem and promise
"Civic complaints are fragmented, duplicated, and disappear after reporting. CivicLens turns one citizen photo into a verified, action-ready case and follows it through proof of resolution."

### 10-30 seconds - Multimodal report
- Upload pothole image.
- Location appears.
- Gemini extracts category, severity, risk, and concise summary.
- Show confidence and citizen confirmation.

### 30-45 seconds - Agentic deduplication
- Agent searches nearby cases.
- Finds a likely duplicate.
- Show reasons and distance.
- Citizen confirms merge.

### 45-65 seconds - Verification and action
- Community evidence raises confidence/priority.
- Resolution Coordinator calls tools, assigns queue, and creates action packet.
- Open Agent Trace for two seconds so the jury sees real steps/tool calls.

### 65-80 seconds - Closure
- Show before/after evidence.
- Closure Agent recommends resolve.
- Human approves.

### 80-90 seconds - Impact and Google stack
- Dashboard updates.
- One sentence: built/deployed in Google AI Studio, powered by Gemini structured outputs/function calling, Google Maps, Firebase, and Cloud Run.

Do not narrate every UI control. Narrate the transformation and decision intelligence.

---

## 15. Submission package

## 15.1 Public application

Checklist:
- Stable public URL.
- Demo route or one-click "Explore Demo".
- Demo credentials unnecessary where possible.
- Seed data loads consistently.
- App explains that some records are demonstration data.
- No secret or debug panel exposed.

## 15.2 GitHub repository

README structure:
1. Hero image and one-line pitch.
2. Live demo link.
3. Problem and insight.
4. 60-second product flow.
5. Key features.
6. Agent architecture.
7. Google technology usage.
8. Technical architecture diagram.
9. Local setup and environment variables.
10. Tests and verification.
11. Screenshots.
12. Privacy/safety considerations.
13. Open-source attribution.
14. Known limitations and roadmap.
15. Originality note and hackathon timeline.

Include:
- `.env.example` with no secrets;
- architecture docs;
- prompt/decision log;
- test commands;
- license/attribution;
- clean commit history.

## 15.3 Google Doc

Required headings plus winning additions:

1. **Problem Statement Selected**
2. **Solution Overview**
3. **Key Features**
4. **Technologies Used**
5. **Google Technologies Utilized**
6. User journey
7. Agentic workflow
8. Architecture diagram
9. Innovation/differentiation
10. Impact model and demo metrics
11. Privacy, safety, and human oversight
12. Testing and reliability
13. Demo instructions
14. Limitations and next steps
15. Live app and repository links

Create the Doc now and update it daily so version history naturally demonstrates the build process.

## 15.4 Optional but strategically valuable

- 90-120 second demo video.
- Five-slide finalist pitch outline.
- Architecture PNG.
- One-page judge cheat sheet.
- Test evidence screenshot.

---

## 16. Risk register

| Risk | Probability | Impact | Prevention | Fallback |
|---|---:|---:|---|---|
| AI Studio deployment/billing eligibility issue | Medium | Critical | Deploy smoke test on 22 June | Use available AI Studio starter deployment or immediately resolve GCP billing; do not postpone |
| Firebase setup/rules consume time | Medium | High | Timebox setup to 90 minutes; adapter abstraction | Seeded server/browser demo mode while persistence issue is isolated |
| Gemini output inconsistency | Medium | High | Structured schema, low temperature, validation, repair, golden examples | Manual confirmation/category form |
| Maps key/restriction issue | Medium | Medium | Enable and test on Day 1 | Manual address/pin and list view |
| Scope explosion | High | Critical | P0/P1 split and 24 June scope lock | Remove gamification, multilingual, sharing first |
| Real authority integration unavailable | High | Medium | Design authority console/action packet from start | Clearly present it as a workflow prototype, not a live government connection |
| Demo network failure | Low/Medium | Critical | Seed data, warm app, recorded video | Play recorded demo and show architecture/live fallback sections |
| Cloud Run cold start | Medium | Medium | Lightweight startup, warm before demo | Progress state and recorded backup |
| Originality concern due AI tooling | Medium | High | Commit history, prompt log, tests, decision records, participant understanding | Be prepared to explain any module and demonstrate live changes |
| Final submission fields change | Medium | High | Monitor BlockseBlock/email daily | Prepare links/assets in copy-ready form before 28 June |
| Over-polishing visual design before workflow works | High | High | Vertical slice first, design pass on 27 June | Use a minimal coherent design system until P0 complete |

---

## 17. Decision gates

### Gate 1 - 22 June night
Can the AI Studio project deploy publicly? If no, stop feature work and resolve deployment.

### Gate 2 - 23 June night
Does the photo-to-map vertical slice work from the public URL? If no, no additional feature begins.

### Gate 3 - 24 June night
Is P0 scope frozen after mentor feedback? If no, explicitly cut features until it is.

### Gate 4 - 25 June night
Does the agent call tools and visibly change real state? If no, prioritize agentic depth over dashboard polish.

### Gate 5 - 26 June night
Can one issue reach resolved status with evidence? If no, remove P1 and finish the loop.

### Gate 6 - 27 June night
Does the golden path pass twice on the public deployment? If no, start freeze early.

### Gate 7 - 28 June 2:00 PM
Is the release candidate complete with docs and backup demo? If no, no new features under any circumstance.

---

## 18. Definition of done

The project is submission-ready only when all are true:

1. One official problem statement is clearly selected.
2. The app was built with Google AI Studio as the core environment.
3. Deployment was initiated through Google AI Studio and the public URL is stable.
4. A citizen can complete the report-to-triage flow.
5. Duplicate detection is visible and user-confirmed.
6. Community verification changes case confidence/priority.
7. An agent uses controlled tools and persists a resolution plan.
8. Agent reasoning/tool trace is visible.
9. Operator can progress status.
10. Before/after evidence can produce a closure recommendation.
11. Human approval controls merge, routing, and closure.
12. Dashboard reflects case changes.
13. Low-confidence and failure paths do not crash.
14. No secrets are committed or sent to the browser unnecessarily.
15. Critical deterministic logic is tested.
16. Golden path passes on the exact public URL.
17. GitHub repository is public and documented.
18. Google Doc is public and complete.
19. Open-source/media attribution is present.
20. BlockseBlock submission is completed before the internal deadline and confirmation is captured.

---

## 19. Immediate first 90 minutes after plan approval

1. Confirm **Community Hero / CivicLens** as the locked direction.
2. Create GitHub repository and initial README.
3. Create Google Doc with required headings and share setting.
4. Create Google AI Studio full-stack project.
5. Prompt only for the mobile shell, route structure, and report form.
6. Export/sync code and make the first meaningful commit.
7. Add server-side secret placeholder and a health endpoint.
8. Deploy the smoke build from AI Studio.
9. Test the public URL in incognito and on a phone.
10. Record deployment URL and screenshot in the project log.

The next implementation prompt should not be written until the smoke deployment succeeds.

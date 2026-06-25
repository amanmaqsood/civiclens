# CivicLens — Brutal Hackathon Judge Audit and Winning Implementation Plan

**Audit date:** 23 June 2026  
**Submission deadline:** 29 June 2026, 2:00 PM IST  
**Review basis:** Full extracted source archive, build/lint/test results, Vibe2Ship problem statement, evaluation matrix, submission requirements, and general rules.

## Executive verdict

CivicLens is a strong-looking and ambitious prototype, but it is not yet a winning submission. It currently tells a stronger story than the implementation can prove. The biggest problem is not missing feature count. It is the gap between claims and reality: the README and interface claim a server-side autonomous orchestrator, enforced state machine, immutable audit log, function calling, digital signatures, municipal transmission, real-time tracking, official SLA metrics, and completed escalation. The current code does not reliably implement those claims.

A judge who only watches the ideal demo may score it around 70. A technical judge who inspects the repository, rules, security specification, and data mutations may score it in the mid-50s. My baseline score is **63/100**.

The fastest route to a winning submission is to stop adding surface features and convert the existing prototype into a truthful, secure, observable, server-controlled agent workflow.

## What was verified

- `npm ci`: successful, zero reported package vulnerabilities.
- `npm run lint`: successful TypeScript check.
- `npm test`: 15/15 tests passed.
- `npm run build`: successful.
- Production JS bundle: approximately 1.25 MB minified, with a Vite chunk-size warning.
- Existing tests cover only pure utility behavior: distance, priority scoring, duplicate candidate filtering, and status-transition logic.
- No API, component, end-to-end, accessibility, Firestore Security Rules, Storage Rules, or deployment smoke tests are present.
- The public URL appears in the README, but its live behavior could not be independently exercised from the audit environment; deployment scoring is therefore conditional.

## Current judge score

| Criterion | Weight | Current score | Judge rationale |
|---|---:|---:|---|
| Problem Solving & Impact | 20 | **14** | Strong end-to-end civic-resolution concept, but impact metrics are not trustworthy and government routing is simulated. |
| Agentic Depth | 20 | **8** | Multiple Gemini calls exist, but there is no genuine tool-using agent loop, durable orchestration, or server-enforced state machine. |
| Innovation & Creativity | 20 | **14** | Canonical deduplication, closure verification, and escalation dossier are differentiated, but several are generated documents rather than completed actions. |
| Usage of Google Technologies | 15 | **12** | Good breadth: AI Studio/Cloud Run evidence, Gemini multimodal and Search grounding, Firebase, Maps. Function calling is claimed but absent. |
| Product Experience & Design | 10 | **7** | Cohesive visual system and a strong reporting flow, but the UI is dense, tiny, mobile-only, jargon-heavy, and sometimes misleading. |
| Technical Implementation | 10 | **5** | Build and basic tests pass, but access control, concurrency, SSRF, API abuse, data integrity, and observability are serious weaknesses. |
| Completeness & Usability | 5 | **3** | Many flows are present, but submission placeholders, incomplete docs, fake/fallback values, and unverified persistence behavior remain. |
| **Total** | **100** | **63** | Not winner-ready today. |

## The strongest parts to preserve

1. **The product insight is good.** CivicLens goes beyond reporting and attempts deduplication, authority discovery, prioritization, closure verification, and escalation.
2. **The report flow is compelling.** Photo compression, location capture, voice input, Gemini multimodal analysis, editable AI output, clarification, and fallback are a solid foundation.
3. **Human confirmation before merge is correct.** The duplicate review screen is one of the best product decisions in the codebase.
4. **Structured output is used for important Gemini calls.** This is much better than parsing free-form text everywhere.
5. **The visual design is cohesive.** Typography, spacing, color tokens, and component styling show effort.
6. **The priority formula is explainable.** It needs bounds and better inputs, but the visible breakdown is judge-friendly.
7. **The prototype boundary is partly acknowledged.** The README says government filing/routing is simulated, although several screens contradict that disclaimer.

# Critical blockers

## 1. Credibility and misrepresentation risk

This is the highest-priority issue because hackathon organizers may verify originality, functionality, and eligibility.

### Claims not supported by the current implementation

- README: “server-side orchestrator runs a multi-step loop.” The server exposes separate one-shot endpoints; the client manually sequences most steps.
- README: “deterministic state machine authorizes transitions.” `isValidStatusTransition()` exists and is unit-tested, but production writes do not call it.
- README: “function-calling.” No Gemini function declarations or function-call execution loop exists.
- README: “immutable audit log.” Any signed-in user can write the activity collection.
- README: “signed Storage URLs.” Firebase download URLs are used; no signed-URL implementation is shown.
- Success screen: “Transmitted to municipal servers in real-time.” No municipal integration exists.
- Success screen: “SHA-256 Verified” and “Digital ID: Secured Link.” No hash or digital-signature operation exists.
- Success screen: local inspectors will verify within 24 hours. This is not guaranteed or integrated.
- Report progress: “Municipal Gateway Link” and “Enforcing digital signatures.” These are timer-driven animations, not real operations.
- Dashboard: “Official Metrics Log,” “Mean Repair SLA,” and “Against statutory limit.” Resolution time is derived from age/SLA and falls back to a hard-coded `2.3` when no resolved records exist.
- Escalation panel: “Case escalated to the State Grievance Authority.” The system only generates and stores draft text; it sends nothing.
- “Real-time” labels are used although data is fetched with one-time `getDocs()` calls and refreshed by view changes.

### Mandatory fix

Every statement must be either implemented or rewritten. The truthful wording should be explicit:

- “Saved to CivicLens; not submitted to a government portal.”
- “Authority-ready draft generated; review and submit manually.”
- “AI-estimated response window; verify with the cited authority source.”
- “Prototype operator console.”
- “Stored in Firebase Storage.”
- “Generated RTI-ready draft; not filed.”
- “Updated on refresh” unless an actual Firestore listener is added.

## 2. Agentic depth is mostly presentation, not execution

The evaluation gives 20% to Agentic Depth. Current behavior is a fixed pipeline of button-triggered requests:

- analyze report;
- check duplicate;
- generate resolution plan;
- verify repair;
- generate escalation text.

That is useful AI integration, but a strong judge may classify it as “several AI features,” not an agent.

### Evidence in the code

- There is no function/tool declaration passed to Gemini.
- There is no model → tool call → execution → tool result → model continuation loop.
- There is no central `AgentRun` entity.
- There is no durable run state, retry state, tool result, latency, or human-approval event.
- Agent traces are constructed client-side, including timestamps artificially set one to three seconds in the past.
- Seeded data claims geocoding, Search, and drafting tools ran, even though those traces are synthetic.
- The timeline renders only five fixed step names and ignores later “Verify Resolution” and “Auto-Escalation / RTI” entries.

### Mandatory fix

Create one real server-side orchestrator endpoint and use Gemini function calling with a controlled tool registry. Persist actual tool calls and results. The model may recommend actions; the server must enforce permissions and state transitions.

## 3. Firestore security is critically weak

Anonymous authentication is automatic. Therefore, “signed in” effectively means any visitor.

Current rules allow any signed-in user to:

- update any issue document, as long as `userId` and `ticketId` remain unchanged;
- modify status, severity, priority score, counts, resolution plan, agent trace, escalation, and closure assessment;
- write arbitrary activity/audit events;
- create arbitrary evidence;
- delete any demo issue;
- switch to the operator UI and execute status changes.

The `security_spec.md` claims terminal-state locking, size boundaries, verified-email enforcement, anonymous-write blocking, immutable timestamps, secure list behavior, and automated malicious-payload tests. The deployed rules and test suite do not enforce or test those claims.

### Mandatory fix

- Move system mutations to authenticated server endpoints using Firebase Admin SDK.
- Require Google sign-in for persistent writes and voting.
- Gate operator actions by a server-verified operator role or allowlist.
- Make activity and agent-run records server-write-only and append-only.
- Add field-level Firestore rule validation.
- Add Storage Rules for owner/path, content type, and size.
- Add Firebase App Check for Firebase resources and custom backend calls.
- Add Emulator Suite rules tests and remove claims until tests pass.

## 4. Custom backend endpoints are unprotected

All Gemini endpoints are publicly callable. There is no Firebase ID-token verification, App Check verification, rate limit, abuse quota, or schema validator for requests. Anyone can consume API quota.

`/api/verify-resolution` fetches any user-supplied HTTP URL. That is an SSRF risk. It could be used to access internal or unintended network resources.

### Mandatory fix

- Add `requireAuth`, `requireAppCheck`, and `rateLimit` middleware.
- Validate all requests and model responses with Zod or explicit schemas.
- Do not fetch arbitrary URLs. Accept only a Firebase Storage object path owned by the project, or send both images as validated uploads.
- Add fetch timeout, byte limit, MIME allowlist, and redirect restrictions.
- Add security headers and production error sanitization.

## 5. Data correctness and persistence bugs

### Category mismatch breaks deduplication and analytics

Gemini returns machine categories such as `pothole`. `ReportPage.tsx` converts them to labels such as `Pothole & Roads` before persistence. Seeded reports and dashboard categories use machine keys. Duplicate filtering requires strict category equality. A new pothole may therefore never match a seeded/existing `pothole` report.

**Fix:** Store only `categoryKey` using the server enum. Derive display labels in the UI.

### Important fields are dropped on reload

`fetchRecentIssues()` does not map `isDemoData`, `closureAssessment`, or `escalation`. After refresh, those states can disappear from the UI even though Firestore stores them.

**Fix:** Use one runtime schema and one mapper that includes every persisted field. Add a round-trip test.

### Priority score can exceed 100

`reportCount * 4` is unbounded. The gauge caps visually, while the displayed score may exceed 100.

**Fix:** define a documented 0–100 formula, cap every component, version it, and calculate it only on the server.

### Race conditions

Verification, evidence merge, resolution-plan append, closure trace append, and upvote use read-then-write or separate writes. Concurrent users can lose updates or double count.

**Fix:** use Firestore transactions/batched writes and idempotency keys.

### Ticket IDs can collide

Six random digits are not a reliable uniqueness mechanism.

**Fix:** use the Firestore document ID as the canonical key and derive a collision-checked short public ID server-side.

### Dashboard is not trustworthy

- only the latest 50 records are loaded;
- no actual `resolvedAt` is stored;
- average resolution time uses `min(SLA, age)`;
- no-data fallback is `2.3`;
- demo and real data are mixed.

**Fix:** store lifecycle timestamps, compute actual durations, show `N/A` for unavailable values, and visibly separate demo from real metrics.

### Demo cleanup is incomplete

Deleting a parent Firestore document does not delete its subcollections. The current clear function can leave orphan activity/evidence records.

**Fix:** use an Admin SDK recursive-delete endpoint or retain a fixed, read-only demo dataset.

## 6. Product experience weaknesses

- The app is constrained to a simulated phone on desktop, including a fake 09:41/5G/100% status bar. This looks like a mockup rather than a production application, especially for operators.
- Anyone can toggle between citizen and operator personas.
- The UI contains many 8–11 px labels and controls below a comfortable touch target.
- `maximum-scale=1.0` and `user-scalable=no` disable zoom.
- Upload area is a clickable `div` without full keyboard behavior.
- Copy is overly technical: “Coordinate Telemetry,” “Inspection Core,” “Structural Threat Calibration,” “Calculated Impact Boundaryed.”
- Progress states are simulated with a timer rather than connected to actual server events.
- The app detects privacy risks but does not actually redact faces or plates.
- Search-grounded authority sources are shown as a list of domains, not as claim-level citations.
- No genuine sign-in/sign-out controls are exposed, despite importing them.

## 7. Submission readiness is incomplete

- README still contains `[demo video]`, `[Google Doc]`, and `[MIT]` placeholders.
- No `LICENSE` file is included.
- No `ATTRIBUTIONS.md` or third-party asset list is included.
- `.env.example` omits the Maps key mentioned by the README.
- No architecture diagram, screenshots, demo script, test evidence, or AI Studio build/deployment evidence is packaged.
- The mandatory Google Doc is not present in the archive.
- The package name remains `react-example`.

# Winning product definition

## One-line pitch

**CivicLens converts a citizen’s photo into one verified, non-duplicated civic case, creates an evidence-backed resolution plan, and proves closure with before/after analysis—while every AI tool call and human decision is auditable.**

## The one demo story

1. Citizen uploads a pothole photo and shares location.
2. Gemini extracts category, severity, hazards, and confidence in structured form.
3. The agent calls `searchNearbyIssues` and finds an existing case.
4. Gemini compares both reports and explains the match.
5. Citizen approves merging; evidence and counts update atomically.
6. The agent recalculates a server-side priority score.
7. It calls Search grounding to identify the likely authority and produces a cited, unsubmitted action packet.
8. An authorized operator advances the case.
9. A repair photo is uploaded; Gemini compares before/after evidence.
10. The operator accepts or rejects the closure recommendation.
11. The dashboard updates from actual lifecycle timestamps.

Do not demo five unrelated cases. Demonstrate one case end-to-end and one failure/uncertainty path.

# Target architecture

```text
React citizen interface        React operator interface
          | Firebase Auth ID token + App Check token
          v
Cloud Run / Express Agent API
  ├─ auth and role middleware
  ├─ request/response validation
  ├─ rate limits and idempotency
  ├─ deterministic state machine
  ├─ Gemini function-calling orchestrator
  │    ├─ analyzeEvidence
  │    ├─ searchNearbyIssues
  │    ├─ compareDuplicateEvidence
  │    ├─ calculatePriority
  │    ├─ findAuthorityWithSearch
  │    ├─ draftActionPacket
  │    └─ verifyClosure
  ├─ Firebase Admin SDK transactions
  └─ append-only AgentRun/Event writer
          |
          ├─ Firestore
          ├─ Firebase Storage
          ├─ Gemini API
          └─ Google Maps Platform
```

## Minimal data model

```ts
type CategoryKey =
  | "pothole"
  | "water_leak"
  | "streetlight"
  | "waste"
  | "drainage"
  | "road_damage"
  | "other";

type IssueStatus =
  | "submitted"
  | "community_verified"
  | "assigned"
  | "in_progress"
  | "closure_review"
  | "resolved"
  | "reopened";

interface Issue {
  id: string;
  publicTicketId: string;
  reporterId: string;
  categoryKey: CategoryKey;
  title: string;
  summary: string;
  status: IssueStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
  location: { point: GeoPoint; label: string; geohash?: string };
  priority: { score: number; version: string; factors: Record<string, number> };
  counts: { confirmations: number; disputes: number; evidence: number };
  isDemo: boolean;
}

interface AgentRun {
  id: string;
  issueId: string;
  objective: string;
  status: "running" | "waiting_for_human" | "completed" | "failed";
  model: string;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  steps: Array<{
    order: number;
    type: "model" | "tool_call" | "tool_result" | "human_decision";
    name: string;
    safeSummary: string;
    inputDigest?: string;
    outputDigest?: string;
    latencyMs?: number;
    status: "ok" | "failed" | "skipped";
  }>;
}
```

# Rubric-by-rubric implementation plan

## 1. Problem Solving & Impact — target 20/20

### Build

- Preserve one canonical issue with every original report as evidence.
- Add actual lifecycle timestamps: `createdAt`, `verifiedAt`, `assignedAt`, `inProgressAt`, `resolvedAt`.
- Display measurable impact:
  - duplicate tickets prevented;
  - median AI triage time;
  - median time to first community confirmation;
  - actual resolution time;
  - reopened cases;
  - high-risk unresolved cases.
- Separate demo and real metrics.
- Add a short “Why this matters” card with a concrete user journey, not unsupported national-scale claims.
- Add uncertainty and human override visibly.

### Definition of done

- A duplicate report is merged without losing its evidence.
- Metrics are computed from actual data and never use hard-coded fallback numbers.
- No screen claims a government action happened unless it actually happened.
- The full report-to-closure flow works in a new browser session.

## 2. Agentic Depth — target 20/20

### Build

- Add `POST /api/agent/run`.
- Declare controlled Gemini tools with JSON schemas.
- Run an actual tool loop:
  1. send objective and available tools;
  2. receive function call;
  3. validate arguments;
  4. execute tool;
  5. persist tool call/result;
  6. return result to Gemini;
  7. continue until final recommendation or human approval gate.
- Keep deterministic authorization outside the model.
- Add human gates for duplicate merge, authority packet approval, status transition, and closure.
- Persist actual `AgentRun` steps server-side.
- Display all steps dynamically, including failures and retries.
- Add bounded retry, timeout, fallback, and cancellation.

### Controlled tools

```text
analyze_evidence
search_nearby_issues
compare_duplicate_evidence
calculate_priority
find_authority_with_search
create_action_packet
request_human_approval
verify_closure
record_event
```

### Definition of done

- Repository contains real function declarations and execution code.
- A judge can see the model request a tool, the server execute it, and the model use the result.
- Agent traces cannot be forged from the browser.
- A failed tool produces a truthful failed step and recoverable UI.

## 3. Innovation & Creativity — target 20/20

### Defensible differentiator

**The innovation is not “AI civic reporting.” It is the three-part accountability loop:**

1. **Canonical case graph:** many reports become one case without losing citizen evidence.
2. **Resolution coordinator:** grounded routing and a ready-to-submit action packet.
3. **Proof of closure:** before/after visual assessment plus human approval/reopening.

### Build

- Add multimodal duplicate comparison for top nearby candidates, not text only.
- Show evidence lineage: “3 citizen reports, 4 photos, 6 confirmations → 1 canonical case.”
- Add closure decision states: resolved, more evidence required, reopen.
- Keep escalation as a **draft generator**, not a fake submission.
- Add a visual “case journey” summary that judges can understand in five seconds.

### Definition of done

- The unique value is visible without reading the README.
- Every innovative feature works in the deployed app, not only in seeded text.
- Generated legal/authority content is sourced and labelled for human review.

## 4. Google Technologies — target 15/15

### Demonstrate, do not merely list

- Google AI Studio: build history, project screenshot, prompt iterations, and deployment evidence.
- Gemini multimodal: photo triage and before/after comparison.
- Gemini structured outputs: validated typed objects.
- Gemini function calling: real tool execution.
- Google Search grounding: authority discovery with source metadata.
- Firebase Auth: citizens and role-gated operators.
- Firestore: issues, evidence, votes, events, and agent runs.
- Firebase Storage: validated photo uploads.
- App Check: Firebase and custom backend protection.
- Google Maps: issue map and location confirmation.
- Cloud Run: publicly deployed server and health endpoint.

### Definition of done

- Each Google technology has a one-line purpose and screenshot/evidence in the project document.
- Function calling is no longer a false README claim.
- The submitted public link is the AI Studio/Cloud Run deployment.

## 5. Product Experience & Design — target 10/10

### Build

- Remove the fake phone bezel on desktop. Use responsive layouts:
  - citizen: mobile-first;
  - operator: two-column desktop queue/detail.
- Gate operator mode behind sign-in and role.
- Increase body text to at least 14 px and captions to at least 12 px where possible.
- Use 44×44 px minimum interactive targets.
- Remove `user-scalable=no` and `maximum-scale=1.0`.
- Make upload input keyboard-accessible.
- Add visible focus styles and `aria-live` for analysis/errors.
- Replace jargon with plain language.
- Connect progress UI to real events; otherwise use one honest loading state.
- Add empty, offline, permission-denied, low-confidence, and retry states.
- Add source cards with title/domain/claim instead of bare domains.
- Make “Demo” status persistent and unmistakable.

### Copy replacements

| Current | Replace with |
|---|---|
| Submit to Inspection Core | Analyze and review report |
| Coordinate Telemetry | Location |
| Municipal Gateway Link | Uploading evidence |
| Structural Threat Calibration | Assessing severity |
| Security Schema Lock | Validating response |
| Transmitted to municipal servers | Saved to CivicLens; not submitted to a government portal |
| SHA-256 Verified | Photo stored in Firebase Storage |
| Case escalated | Escalation draft generated; not submitted |
| Official Metrics Log | Prototype impact dashboard |
| Statutory limit | Sourced/estimated response target |

## 6. Technical Implementation — target 10/10

### Security

- Firebase Admin SDK on the server.
- ID-token verification.
- operator role verification.
- App Check verification.
- rate limiting.
- Zod request and response schemas.
- server-only system mutations.
- strict Storage Rules.
- SSRF removal.
- safe error responses.

### Data integrity

- Firestore transactions for votes, verification, merge, and status transitions.
- idempotency keys for report submission and agent tools.
- server timestamps, not browser ISO strings.
- bounded priority formula.
- one category enum.
- collision-safe public ticket IDs.
- append-only server events.

### Reliability

- retry with exponential backoff and jitter for retryable Gemini errors.
- timeouts and abort signals.
- mockable Gemini adapter.
- structured logs with run ID and issue ID.
- lazy-load Maps and operator screens to reduce bundle size.

### Test minimum

1. Gemini report schema success/failure.
2. duplicate candidate category/location/age behavior.
3. multimodal duplicate response validation.
4. unauthorized API request rejected.
5. non-operator status change rejected.
6. illegal state transition rejected.
7. resolved case cannot be modified except reopen flow.
8. one vote per verified user.
9. concurrent confirmations remain accurate.
10. audit event cannot be written by client.
11. Storage rejects non-image and >5 MB file.
12. SSRF/private URL rejected.
13. report round-trip preserves every field.
14. closure recommendation does not auto-resolve.
15. end-to-end golden path on deployed/staging build.

## 7. Completeness & Usability — target 5/5

### Build

- Complete README links.
- Add `LICENSE`.
- Add `ATTRIBUTIONS.md` for libraries, icons, fonts, images, and any skill/code adapted.
- Add architecture diagram and screenshots.
- Add a 90–120 second backup demo video.
- Add setup, environment, deployment, testing, demo data, limitations, and safety sections.
- Create the public Google Doc with all mandatory headings.
- Keep an AI Studio build/deployment evidence section.
- Test public links in incognito and on mobile data.
- Submit before 11:00 AM IST on 29 June.

# File-by-file priority changes

## `server.ts`

- Add auth/App Check/rate-limit/schema middleware.
- Replace public mutation APIs with authenticated service routes.
- Add real function-calling orchestrator.
- Validate every Gemini response.
- remove arbitrary URL fetch.
- add timeouts/backoff and structured logging.

## `src/services/issues.ts`

- Move privileged writes to server.
- replace read-then-write with transactions.
- persist category keys.
- map every Firestore field.
- calculate priority server-side and cap it.
- remove fabricated traces.
- use server timestamps.

## `firestore.rules`

- public/demo read policy only as intended.
- citizen creates only validated reports.
- citizen cannot modify system fields.
- operator status changes only via server/role.
- activity and agent runs server-only.
- terminal/reopen state rules.

## Add `storage.rules`

- authenticated owner/path checks.
- image MIME type only.
- maximum 5 MB.
- no arbitrary overwrite.

## `ReportPage.tsx`

- preserve machine category key.
- enforce file type/size before compression.
- resend clarification to Gemini instead of forcing confidence to 0.8.
- use truthful progress text.
- accessible upload control.

## `SuccessPage.tsx`

- remove municipal, SHA, digital-ID, and 24-hour claims.
- state exactly what was saved and what the next real action is.

## `AgentTraceTimeline.tsx`

- render actual persisted steps dynamically.
- include tool input summary, result summary, latency, status, and human approval.
- never invent timestamps.

## `VerificationPanel.tsx`

- remove citizen-facing “simulate official action.”
- voting only for authenticated users.
- status transitions operator-only.

## `OperatorDetailView.tsx`

- enforce role server-side.
- use state-machine response from server.
- manual override requires reason and writes an event.
- never call a lifecycle “locked” unless backend enforces it.

## `ImpactDashboard.tsx`

- remove hard-coded `2.3`.
- use `resolvedAt - createdAt`.
- separate demo/real values.
- do not call estimates statutory or official.

## `README.md`

- remove unsupported claims.
- replace all placeholders.
- add exact Google technologies and their proof.
- state prototype boundaries consistently.

# Execution schedule

## 23 June night / 24 June early morning — stop credibility loss

**Goal:** truthful baseline and stable deployment.

1. Create `audit-fixes` branch and a rollback tag.
2. Replace every false/misleading UI and README claim.
3. Fix category persistence.
4. Map missing Firestore fields.
5. Remove hard-coded dashboard metric.
6. Add a persistent “Independent hackathon prototype; not connected to government systems” disclosure.
7. Deploy and smoke-test.

**Exit gate:** no judge-visible statement implies an action the code did not perform.

## 24 June — security and data control plane

1. Add Google sign-in UI.
2. Add server Firebase Admin initialization.
3. Verify Firebase ID token on write/AI endpoints.
4. Add operator allowlist/role.
5. Move status, vote, verification, merge, closure, and escalation persistence behind the server.
6. Add Firestore transactions.
7. rewrite Firestore Rules and add Storage Rules.
8. Add App Check and backend token verification.
9. Add rate limit and request schemas.
10. Fix SSRF.

**Exit gate:** an anonymous browser cannot mutate cases, forge audits, become an operator, or consume unrestricted Gemini quota.

## 25 June — genuine agentic core

1. Create tool registry.
2. Implement `AgentRun` persistence.
3. Implement Gemini function-call loop.
4. Integrate triage, nearby search, duplicate comparison, priority, authority lookup, and action packet.
5. Add human approval states.
6. Replace client-generated trace with server-generated trace.
7. update timeline UI.

**Exit gate:** recorded tool calls match actual executed functions and persist after refresh.

## 26 June — winning closed loop

1. Add multimodal duplicate comparison.
2. Complete operator assignment/status lifecycle.
3. Persist closure review and actual lifecycle timestamps.
4. Reopen flow when repair evidence fails.
5. Make escalation a sourced, downloadable draft only.
6. Fix dashboard metrics and evidence lineage.
7. Create three clearly labelled demo scenarios.

**Exit gate:** one report can travel from evidence to verified closure without console/database intervention.

## 27 June — product quality and test day

1. responsive desktop operator view.
2. accessibility cleanup.
3. plain-language copy.
4. source citation cards.
5. API tests.
6. Firestore/Storage Rules emulator tests.
7. Playwright golden-path E2E.
8. failure-path tests.
9. bundle splitting.
10. cold-start and mobile-network check.

**Exit gate:** all tests pass and the golden path succeeds twice from incognito.

## 28 June — feature freeze and submission assets

**10:00 AM IST: hard feature freeze.**

1. final regression.
2. public deployment validation.
3. README, license, attribution.
4. Google Doc completion.
5. architecture diagram.
6. screenshots and demo video.
7. demo script and fallback plan.
8. verify public access permissions.
9. capture release commit SHA and deployment timestamp.

**Exit gate:** one release candidate, one rollback deployment, all three mandatory links ready.

## 29 June — submit early

- 8:00–9:00: incognito and mobile smoke test.
- 9:00–10:00: validate GitHub and Google Doc permissions.
- 10:00–11:00: submit on BlockseBlock and capture confirmation.
- 11:00–2:00: emergency buffer only.

# P0 engineering backlog with estimates

| Priority | Work item | Estimate | Acceptance test |
|---|---|---:|---|
| P0 | Truthful copy and README cleanup | 2 h | No unsupported claim remains. |
| P0 | Category/data round-trip fixes | 3 h | New pothole matches existing pothole; all fields survive refresh. |
| P0 | Auth, roles, Admin SDK | 5 h | Citizen cannot access operator mutation; operator can. |
| P0 | Protected server mutation layer | 6 h | Client cannot directly change status/counts/audit. |
| P0 | Firestore/Storage Rules + tests | 5 h | malicious payload suite passes. |
| P0 | App Check, rate limit, validation, SSRF fix | 5 h | abuse/security tests pass. |
| P0 | Transactional votes/merge/status | 4 h | concurrency tests remain correct. |
| P0 | Real function-calling agent run | 8 h | model tool call and tool result visible in persisted trace. |
| P0 | Dynamic Agent Trace UI | 3 h | all actual steps render after refresh. |
| P0 | Real lifecycle metrics | 3 h | no hard-coded/fake KPI. |
| P1 | Multimodal duplicate comparison | 4 h | same scene matches; nearby distinct issue does not. |
| P1 | Responsive/a11y redesign | 5 h | keyboard/zoom/touch tests pass. |
| P1 | API/rules/E2E test suite | 8 h | CI command passes from clean clone. |
| P1 | Documentation/demo/submission | 6 h | all mandatory links public and complete. |

Approximate total: **67 focused hours**. Do not add gamification, chat, native apps, social feeds, or extra dashboards until all P0 gates pass.

# Demo script

## 90-second version

1. “Three citizens reporting the same pothole should create one accountable case, not three ignored tickets.”
2. Upload image and location.
3. Show structured Gemini triage and confidence.
4. Show the agent call `search_nearby_issues`.
5. Show multimodal duplicate explanation and approve merge.
6. Show atomic evidence/count/priority update.
7. Show Search-grounded authority lookup with citations.
8. Show operator approval and before/after verification.
9. Show the case resolved and dashboard updating from actual timestamps.
10. Close with: “Built and deployed in Google AI Studio; Gemini provides multimodal reasoning, function calling, and grounded routing; Firebase and Maps provide the operational layer.”

## Backup plan

- Keep one known-good seeded case at every lifecycle stage.
- Record a 90–120 second video of the release candidate.
- Keep a second deployment revision for rollback.
- Never depend on a live Gemini response for the entire presentation; cache a clearly labelled previously generated demo run while retaining a live retry button.

# Submission package checklist

## Public deployed app

- AI Studio/Cloud Run link.
- no login dead end for judges.
- demo mode clearly labelled.
- health endpoint.
- all main flows work from incognito.

## Public GitHub repository

- completed README.
- architecture diagram.
- setup and environment variables.
- tests and CI command.
- screenshots.
- license.
- attributions.
- privacy/security/limitations.
- AI Studio development evidence.
- release tag.

## Public Google Doc

Mandatory headings:

1. Problem Statement Selected.
2. Solution Overview.
3. Key Features.
4. Technologies Used.
5. Google Technologies Utilized.

Winning additions:

6. User journey.
7. Agent architecture and tool calls.
8. Architecture diagram.
9. Differentiation.
10. Impact metrics.
11. Human oversight and safety.
12. Testing and security.
13. Demo instructions.
14. Prototype boundaries.
15. Live/GitHub/video links.
16. Attribution.

# Final release gate

Do not submit until all answers are “yes”:

- Does every claim in the app and README match code that can be demonstrated?
- Does the app perform a real Gemini function call and execute the selected tool?
- Can a citizen not become an operator by toggling UI state?
- Can an anonymous visitor not forge status, score, audit, or closure?
- Are all counts and transitions atomic?
- Are demo and real data clearly separated?
- Do all persisted fields survive refresh?
- Is every authority/SLA claim sourced and labelled?
- Is every generated complaint/RTI item marked “draft, not submitted”?
- Are metrics derived from actual timestamps?
- Do rules/API/E2E tests pass from a clean clone?
- Does the public app work in incognito on mobile and desktop?
- Are deployed app, GitHub, and Google Doc links public?
- Are license and attributions present?
- Has the BlockseBlock submission been completed and confirmation captured before the deadline?

## Realistic target

Completing all P0 items and most P1 items makes CivicLens defensible in the **90–96** range. A literal 100/100 or guaranteed win cannot be controlled because jury scoring and competitor quality are external. What can be controlled is eliminating every preventable reason to lose: unsupported claims, fake telemetry, weak access control, missing agent execution, unreliable metrics, broken persistence, incomplete documentation, and late submission.

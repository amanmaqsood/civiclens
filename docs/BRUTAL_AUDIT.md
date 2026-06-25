# CivicLens current-state audit

This file converts the judge review into an implementation backlog. Re-verify every item against the current code before changing it.

## Strengths to preserve
- Strong Community Hero framing and memorable closed-loop concept.
- Multimodal report triage, structured output, confidence and fallback paths.
- Geospatial duplicate concept and canonical-case idea.
- Explainable priority display.
- Closure verification concept.
- Distinct ink/paper/marigold/teal visual identity.
- Existing project builds, type-checks, and has a small passing unit-test suite.

## Critical weaknesses
1. Public/anonymous users can reach an operator persona and client-side writes can alter system-owned case fields.
2. Audit events and agent traces can be written or assembled by the browser and are therefore not trustworthy evidence.
3. The agent loop is only partially real: it trusts browser facts, some tools echo model arguments, sources are lost, required steps are not durably enforced, and execution is not fully persisted server-side.
4. Most Gemini endpoints lack adequate identity, App Check, rate limiting, and quota protection.
5. Several counters/merges/status updates use race-prone read-then-write patterns rather than server transactions.
6. Product and README copy still risks overclaiming autonomy, immutability, security, routing, filing, or government integration.
7. Security documentation overstates what the rules and tests actually enforce.
8. The UI still resembles an AI-generated phone mockup on desktop: fake status bar/device shell, tiny typography, constrained operator view, excessive microcopy and pills.
9. Dashboard metrics are not consistently defensible from persisted lifecycle timestamps and complete datasets.
10. Tests focus mainly on helpers rather than API authorization, Firestore rules, concurrency, persistence, agent trace integrity, and golden-path E2E.
11. Submission documentation contains placeholders and lacks complete attribution/license/architecture/evidence.
12. Main frontend bundle is large and requires code-splitting/performance review.

## Known implementation risks to inspect immediately
- Anonymous sign-in behavior in `src/context/FirebaseContext.tsx`.
- Operator toggle and role checks in `src/App.tsx` and operator components.
- Broad update permissions in `firestore.rules`.
- Client mutation helpers in `src/services/issues.ts`.
- Server authentication and endpoint validation in `server.ts`.
- Browser-authored traces in `AgentTraceTimeline` and report/operator flows.
- Arbitrary or weakly constrained remote image fetching in closure verification.
- Category/status enum consistency in `src/types.ts` and persistence mapping.
- Missing lifecycle fields such as `resolvedAt`, `reopenedAt`, assignment/approval timestamps.
- README and `security_spec.md` claims that do not match production code.

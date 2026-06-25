# CivicLens agent instructions

## Mission
Turn the existing CivicLens hackathon prototype into a truthful, secure, production-ready, judge-verifiable Community Hero submission. The governing source of truth is `docs/CODEX_MASTER_PLAN.md`; the completion contract is `docs/CODEX_GOAL_CONTRACT.md`.

## Read first
Before changing code, read in this order:
1. `docs/HACKATHON_REQUIREMENTS.md`
2. `docs/BRUTAL_AUDIT.md`
3. `docs/CODEX_MASTER_PLAN.md`
4. `docs/CODEX_GOAL_CONTRACT.md`
5. `docs/CODEX_PROGRESS.md`
6. Existing `README.md`, `security_spec.md`, `firestore.rules`, `server.ts`, `src/types.ts`, and `src/services/issues.ts`.

Reference-only originals are in `docs/reference/`.

## Repository and stack
- React 19 + TypeScript + Vite frontend.
- Express/TypeScript server bundled by esbuild.
- Gemini through `@google/genai`.
- Firebase Auth, Firestore, Storage, Admin SDK.
- Google Maps.
- Target deployment: Google Cloud / Cloud Run. Preserve clear evidence that Google AI Studio was used in development.

Do not migrate frameworks or replace the stack unless the current stack makes a required acceptance criterion impossible. Document any architectural change before implementing it.

## Required commands
Use clean installs where practical.

```bash
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Add focused test commands as the suite grows. Run lint, tests, and build after every milestone. A failed validation blocks the next milestone until fixed.

## Non-negotiable rules
- Never fabricate government submission, routing, authority acceptance, digital signatures, hashes, agent tool calls, timestamps, citations, impact numbers, security guarantees, test results, or deployment status.
- CivicLens is a prototype and must say so wherever a user could otherwise infer government affiliation.
- The browser may not author privileged lifecycle fields, audit events, agent traces, resolution plans, escalation records, closure assessments, or aggregate counters.
- The server must verify Firebase identity and role before privileged work.
- Real operator actions must require server-authorized identity. Public demo operator actions may affect only explicitly seeded demo cases.
- The model recommends; deterministic application code validates state transitions and permissions.
- Consequential operations require human approval: duplicate merge, routing/final action packet, escalation finalization, resolve/reopen.
- All real agent traces must represent actual server-executed tools and be persisted by the server.
- Store canonical enum keys in data. Derive human labels only in the UI.
- Use Firestore transactions/idempotency for concurrent counters, votes, merges, state changes, and audit writes.
- Do not expose secrets or service-account material. Never commit `.env` or credentials.
- Do not weaken security merely to make a demo pass.
- Do not copy third-party project code wholesale. Attribute every external library, asset, pattern, and skill used.
- Keep seeded data visibly labelled synthetic. Do not present seeded tool traces as live executions.
- Do not delete working features without either preserving equivalent value or recording the reason in `docs/CODEX_PROGRESS.md`.

## Working method
- Create a baseline commit before broad changes if the repository is not clean.
- Work milestone-by-milestone in the order in `docs/CODEX_MASTER_PLAN.md`.
- Keep the application runnable throughout. Prefer small, reviewable diffs.
- Update `docs/CODEX_PROGRESS.md` after each milestone with: files changed, decisions, commands run, actual results, risks, and next milestone.
- Add or update tests with each behavior change.
- When a requirement is ambiguous, choose the safest truthful interpretation and document it.
- Continue autonomously without waiting between milestones. Pause only for a missing secret, cloud credential, billing choice, external account permission, irreversible deployment/submission action, or a product decision that cannot be inferred safely.
- Complete all locally possible work before pausing for an external blocker.

## Definition of done
Do not claim completion unless all of the following are true:
- Every P0 checkbox and acceptance criterion in `docs/CODEX_MASTER_PLAN.md` is complete or explicitly marked blocked by an external credential with exact next steps.
- `npm run lint`, `npm test`, and `npm run build` pass from a clean checkout.
- Security/rules/API/integration/E2E coverage exists for the release gates.
- No known high or critical exploitable issue remains in the implemented scope.
- The golden path works: report -> AI triage -> nearby search -> duplicate decision -> community verification -> priority/routing plan -> operator approval -> closure evidence -> resolve or reopen.
- Agent traces are server-generated from real tool executions.
- Mobile and desktop layouts are usable and accessible.
- Dashboard numbers are derived from stored data or shown as unavailable.
- README, architecture, attribution, license, setup, testing, limitations, deployment, demo, and submission artifacts are complete and truthful.
- `docs/FINAL_EVIDENCE_REPORT.md` records the final commands and actual results.

# Codex durable goal contract

## Desired end state
Rebuild CivicLens into a truthful, secure, production-ready, GCP-deployable hackathon submission that maximizes all seven judging criteria and demonstrates a complete, real, human-governed agentic civic-resolution loop.

## Verification surface
Success must be proven with:
- clean install;
- passing TypeScript/lint, unit, API, rules, integration, and E2E tests;
- passing production build and local production start;
- persisted server-generated agent tool traces that survive refresh;
- complete golden-path demo;
- security boundary tests;
- responsive/accessibility review;
- accurate docs and final evidence report;
- deployed smoke test when GCP credentials are available.

## Constraints
- Preserve the existing React/TypeScript/Firebase/Gemini/Google Maps/Cloud Run direction.
- Preserve Google AI Studio development provenance.
- Never fake external integration, tool execution, citations, metrics, security, tests, or deployment.
- Keep consequential decisions human-approved.
- Do not expose secrets or weaken auth/security for demo convenience.
- Do not copy an external project. Attribute all external material.
- Work inside this repository and use reference files as requirements, not as code to paste blindly.

## Iteration policy
- Follow `docs/CODEX_MASTER_PLAN.md` in order.
- At each milestone: inspect -> implement smallest coherent slice -> add tests -> run validations -> fix failures -> update progress -> continue.
- Prefer evidence and code inspection over assumptions.
- Keep a runnable state and rollback path.
- Use relevant repo skills as checklists, but let repository truth override generic guidance.

## Blocked stop condition
Do not pause for ordinary implementation choices. Pause only for missing secrets, GCP/Firebase account authorization, billing, domain access, or irreversible external actions. Before pausing, finish every locally possible item and write exact commands/fields the user must supply. Budget exhaustion is not completion; summarize and use `/goal resume` later.

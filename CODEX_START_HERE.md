# Start the CivicLens rebuild in Codex

## 1. Open the repository
Use the Codex app or IDE extension and open this folder as the project. Prefer a new Git worktree/branch so the current prototype remains recoverable.

CLI alternative:
```bash
cd /path/to/civiclens
npm install -g @openai/codex@latest
codex --version
codex features enable goals
codex
```

## 2. Let Codex inspect before editing
In a fresh thread, run:

```text
/plan
```

Then paste:

```text
Read AGENTS.md and every file it lists under "Read first". Inspect the current repository and compare it against docs/CODEX_MASTER_PLAN.md. Produce a milestone-by-milestone implementation plan, dependency order, likely risky files, and validation strategy. Do not edit code in this planning turn. Ask only questions that truly cannot be resolved from the repository or reference documents.
```

Review the plan briefly. Correct any wrong assumption.

## 3. Start the durable goal
Paste the following as one `/goal` command:

```text
/goal Rebuild CivicLens into the truthful, secure, production-ready, GCP-deployable winning submission defined by AGENTS.md and docs/CODEX_GOAL_CONTRACT.md. Treat docs/CODEX_MASTER_PLAN.md as the executable source of truth and complete every milestone and acceptance criterion in order. Read docs/HACKATHON_REQUIREMENTS.md, docs/BRUTAL_AUDIT.md, the existing source/docs/rules, and docs/reference before implementation. Work autonomously checkpoint-by-checkpoint: inspect, implement the smallest coherent slice, add tests, run the required validations, fix failures before moving on, update docs/CODEX_PROGRESS.md with actual evidence, and continue. Preserve the existing stack and Google AI Studio provenance. Never fabricate government integration, filing, routing, authority acceptance, agent steps, timestamps, citations, metrics, security guarantees, test results, or deployment status. Make privileged mutations and all audit/AgentRun records server-owned; enforce Firebase identity, roles, demo-only boundaries, validation, transactions, App Check where deployable, rate limits, legal state transitions, and human approvals. Implement a genuine bounded Gemini function-calling loop whose real server tools and results are persisted and visible after refresh. Complete the report-to-resolution/reopen lifecycle, responsive accessible desktop/mobile redesign, defensible impact metrics, performance work, release-grade tests, accurate documentation, attribution, architecture, demo and GCP deployment readiness. Do not wait for approval between milestones. Pause only for a missing secret, cloud credential, billing decision, external account permission, or irreversible deployment/submission action; finish all local work first and record exact manual steps. Stop only when all locally verifiable checkboxes are complete, lint/tests/build pass from a clean checkout, no known high/critical issue remains in scope, the golden-path demo works, and docs/FINAL_EVIDENCE_REPORT.md contains actual commands, results, limitations, and the final submission checklist.
```

## 4. Manage the goal
```text
/goal          # inspect status
/goal pause    # pause safely
/goal resume   # continue after a blocker or budget reset
/goal clear    # abandon the current durable objective
```

When Codex needs Firebase/GCP credentials, provide them through local environment/secrets—not chat and never commit them. Review diffs and commits at milestone boundaries even though the goal continues automatically.

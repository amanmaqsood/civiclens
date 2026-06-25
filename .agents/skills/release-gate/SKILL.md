---
name: release-gate
description: Run the final CivicLens verification and submission-readiness gate. Use before marking milestones complete, committing a release, deploying to Cloud Run, or producing hackathon evidence.
---

Do not rely on memory. Run and record actual commands.

Gate:
1. Clean install succeeds.
2. Lint/typecheck, all tests, production build, and local production start succeed.
3. Security/rules/API/golden-path cases pass.
4. No secrets or placeholder links are committed.
5. README/security/architecture claims match implementation.
6. Demo data is clearly labelled.
7. Desktop/mobile critical paths work.
8. `docs/FINAL_EVIDENCE_REPORT.md` contains commands, outputs, known limitations, deployment URL/status, rollback, and submission checklist.
9. External deployment/submission actions require explicit user approval.

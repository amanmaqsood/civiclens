---
name: civiclens-security
description: Review CivicLens Firebase, Express, Gemini, Storage, Firestore, auth, roles, transactions, URL fetching, quotas, audit trails, and demo boundaries. Use when changing APIs, rules, persistence, agent tools, operator actions, or uploads.
---

Apply these checks:
- Trust no browser-supplied privileged fact.
- Verify Firebase ID token and server role before protected work.
- Restrict public demo operations to seeded demo documents.
- Keep system fields, agent traces, activity, counts, and state changes server-owned.
- Validate schemas and state transitions.
- Use transactions/idempotency for concurrent writes.
- Enforce Storage path/type/size rules.
- Prevent SSRF and arbitrary URL fetches.
- Add rate/quota controls and safe errors.
- Test allow and deny cases with emulators/API tests.
- Align documentation to actual enforcement.

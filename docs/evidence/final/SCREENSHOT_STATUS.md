# Final Screenshot Status

Checkpoint date: 2026-06-27

Public, non-authenticated screenshots were captured with Chrome through a Playwright page-content fallback and recorded in `PUBLIC_SCREENSHOT_MANIFEST-2026-06-27.json`.

Chrome extension communication failed twice before authenticated Chrome-profile capture could start. Per the Chrome workflow, opening a fresh Chrome window/profile requires user permission. Do not claim authenticated GCP/Firebase/AI Studio console screenshot capture until those image files exist and have been reviewed for secrets, tokens, private emails, billing information, or hidden sensitive data.

Captured public targets:

- Cloud Run app homepage page content.
- Report flow start.
- Synthetic/demo label visible.
- Map visible.
- Gemini triage/detail evidence from a saved issue.
- Saved issue detail.
- Persisted agent run with tool steps.
- Page refreshed with agent trace still present.
- Demo operator allowed only on synthetic case.
- Real-case mutation denied for demo or anonymous operator.
- Closure recommendation persisted but not auto-resolved.
- Desktop layout.
- Mobile layout.
- `/health` 200.
- `/readyz` 200.
- GitHub public repository page.

Known limitation: headless page-content screenshots do not show the browser address bar. Exact URLs are recorded in the manifest and evidence docs.

Authenticated console targets still remaining:

- Cloud Run service page with service URL and active revision.
- Firestore Rules deployed.
- Storage Rules deployed.
- Secret Manager page showing `GEMINI_API_KEY` secret name only, not value.
- Firebase Auth enabled providers.
- AI Studio project/history/export/import/development evidence if available.

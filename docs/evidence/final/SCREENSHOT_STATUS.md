# Screenshot Evidence Status

This folder contains public app screenshots and sanitized infrastructure evidence for CivicLens.

## Current Judge-Facing Sets

- `PLACES-AUTH-HINDI-2026-06-28-MANIFEST.json`: current public app evidence for Places autocomplete, Google sign-in flow start, Hindi localization, camera/gallery controls, saved issue detail, agent trace, operator workspace, and non-civic guardrail.
- `FLOW-BOUNDARY-2026-06-28-MANIFEST.json`: public issue-detail and operator-boundary evidence.
- `FINAL-HARDENING-2026-06-28-MANIFEST.json`: earlier same-day UI hardening evidence.
- `SANITIZED_GCP_FIREBASE_EVIDENCE-2026-06-27.json`: CLI/API-backed infrastructure evidence without secret values.

## Safety Notes

- Do not publish screenshots that expose secret values, tokens, private emails, billing information, or hidden sensitive data.
- Browser page-content screenshots may not show the address bar; exact URLs are recorded in manifests and evidence reports.
- Authenticated console screenshots should be recaptured only when they can be reviewed and redacted safely.

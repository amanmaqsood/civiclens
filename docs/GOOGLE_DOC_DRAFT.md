# Google Doc Draft Content

Copy this into the required public Google Doc only after reviewing it against the live deployment and final evidence. Do not add public URLs until they exist.

## Problem Statement

Many civic issues are reported repeatedly with incomplete evidence, unclear location, and no shared lifecycle. Citizens often do not know whether nearby people are reporting the same issue, and operators need a concise way to review evidence, community verification, and closure proof.

## Solution Overview

CivicLens is a hackathon prototype for human-governed civic issue reporting and review. Citizens capture photo, location, and description. Gemini helps summarize and classify the issue, nearby records are checked for possible duplicates, community members can confirm or dispute, and an operator reviews a persisted server-side agent run before approving draft action packets or closure decisions.

CivicLens does not submit complaints to government systems, does not receive official acknowledgements, and does not enforce statutory SLAs. Generated complaint, RTI, routing, escalation, and closure content is draft material for human review.

## Key Features

- Photo and location-based citizen report creation.
- Gemini-assisted report analysis with editable citizen confirmation.
- Nearby duplicate recommendation and human merge decision.
- Community support and verification with one action per user.
- Server-side persisted agent run with real tool-step records.
- Operator queue/detail workspace with human approval records.
- Draft routing/action packet, escalation letter, RTI text, and closure assessment.
- Demo data controls for synthetic records only.
- Metrics separated between real and synthetic demo records.

## Google Technologies

- Google AI Studio for development/provenance.
- Gemini through `@google/genai` for multimodal analysis, structured output, function calling, translation, and draft generation.
- Firebase Auth for anonymous citizen access and Google operator sign-in.
- Firestore for issue, approval, activity, verification, support, and agent records.
- Firebase Storage for report/evidence/closure images.
- Firebase Admin SDK for server-owned writes and transactions.
- Google Maps Platform for map display.
- Google Cloud Run as the target deployment platform.

## Architecture And Safety

The browser can submit user-owned report inputs and image uploads. Privileged lifecycle data is written by the Express server through Firebase Admin SDK. Protected APIs require Firebase identity and App Check, with local-only bypass for development. Operators are resolved server-side from custom claims or verified allowlisted email. Demo operators can mutate only records marked as synthetic demo data.

## Testing Evidence

Latest local validation passes:

- `npm ci`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`

See `docs/FINAL_EVIDENCE_REPORT.md` for exact outputs and warnings.

## Known Limitations

- This is a prototype and not a government service.
- No government filing, routing, acknowledgement, signature, immutable ledger, or statutory SLA is claimed.
- Firestore/Storage rules are covered by source-level tests in this local rebuild; emulator-backed tests remain a release gap.
- Browser E2E and automated accessibility tests remain a release gap.
- Deployment requires Firebase/GCP credentials, billing, public URL verification, and explicit approval.

## Demo Instructions

Use the flow in `docs/DEMO_SCRIPT.md`. If public URLs are created, add them only after verifying they open in a clean browser profile.

# Google AI Studio Evidence Instructions

The hackathon requires evidence that Google AI Studio was used. Do not invent screenshots, timestamps, deployment status, or public URLs.

Capture the following when available:

- AI Studio project overview showing the CivicLens app.
- Prompt/build history or version activity showing meaningful CivicLens development.
- Secrets panel evidence showing configured secret names only. Do not expose secret values.
- Gemini model configuration or logs that show Gemini was used for multimodal/report workflows.
- If deployment is initiated from AI Studio, capture the deployment screen and resulting Cloud Run service link.
- Cloud Run service details and revision after deployment.
- Incognito/mobile smoke-test screenshots after deployment.

Suggested local folder:

```text
docs/evidence/
  ai-studio-project.png
  ai-studio-build-history.png
  ai-studio-secrets-redacted.png
  cloud-run-service.png
  deployed-health.png
  deployed-golden-path.png
```

Only add evidence files that are actually captured. Update `docs/FINAL_EVIDENCE_REPORT.md` with exact filenames and dates.

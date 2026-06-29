# CivicLens Observability Runbook

This runbook turns the structured JSON logs emitted by `server.ts` into Cloud
Logging queries and Cloud Monitoring widgets. It is safe to share: it contains
no project IDs, credentials, or private log samples.

## Runtime Signals

CivicLens writes structured logs with `service: "civiclens"` and stable event
names:

- `api_request`: method, path, status, route kind, duration, and actor role.
- `gemini_call_completed`: model, duration, attempts, retry state, structured
  response flag, Google Search grounding flag, token counts, and estimated cost.
- `gemini_call_failed`: model, duration, attempts, retryability, grounding flag,
  estimated cost field, and a redacted error summary.
- `gemini_retry`: retry attempt, delay, model, and redacted error summary.
- `agent_run_metric`: run id, issue id, status, duration, step count, duplicate
  decision flag, timeout, actor role, aggregate Gemini token counts, and
  aggregate estimated cost.
- `observability_snapshot`: aggregate endpoint access without exposing event
  payloads.

The operator-only `GET /api/ops/observability?hours=24` endpoint returns recent
event counts, recent agent-run aggregates, Cloud Logging filters, and the local
dashboard template path.

Set `CIVICLENS_GEMINI_INPUT_USD_PER_MILLION_TOKENS` and
`CIVICLENS_GEMINI_OUTPUT_USD_PER_MILLION_TOKENS` to enable USD estimates from
Gemini usage metadata. If those values are unset, logs still include token
counts and mark `costPricingSource` as `unconfigured`.

Resolution-plan citations first use `generateContent` grounding chunks. If that
response does not include source chunks, the server performs a narrow
Interactions API Google Search call and extracts `url_citation` annotations into
the same `groundingSources` shape rendered by the operator UI.

## Log Queries

Use these in Cloud Logging for the deployed Cloud Run service:

```text
jsonPayload.service="civiclens"
jsonPayload.event="api_request"
```

```text
jsonPayload.service="civiclens"
jsonPayload.event="gemini_call_completed"
```

```text
jsonPayload.service="civiclens"
jsonPayload.event="gemini_call_failed"
```

```text
jsonPayload.service="civiclens"
jsonPayload.event="agent_run_metric"
```

```text
jsonPayload.service="civiclens"
jsonPayload.event="gemini_call_completed"
jsonPayload.totalTokenCount>0
```

## Logs-Based Metrics

Create logs-based metrics after the first production smoke test emits logs:

```bash
gcloud logging metrics create civiclens_api_errors \
  --description="CivicLens API responses with HTTP status >= 500" \
  --log-filter='jsonPayload.service="civiclens" AND jsonPayload.event="api_request" AND jsonPayload.status>=500'

gcloud logging metrics create civiclens_gemini_failures \
  --description="CivicLens Gemini call failures" \
  --log-filter='jsonPayload.service="civiclens" AND jsonPayload.event="gemini_call_failed"'

gcloud logging metrics create civiclens_agent_failures \
  --description="CivicLens failed or timed-out agent runs" \
  --log-filter='jsonPayload.service="civiclens" AND jsonPayload.event="agent_run_metric" AND (jsonPayload.status="failed" OR jsonPayload.status="timed_out")'

gcloud logging metrics create civiclens_gemini_tokens \
  --description="CivicLens Gemini token usage events" \
  --log-filter='jsonPayload.service="civiclens" AND jsonPayload.event="gemini_call_completed" AND jsonPayload.totalTokenCount>0'
```

Import `docs/monitoring/civiclens-cloud-monitoring-dashboard.json` after creating
the logs-based metrics. The dashboard is intentionally query-first so it remains
portable across Cloud Run projects and regions.

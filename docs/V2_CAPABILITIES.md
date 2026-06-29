# CivicLens v2 — What's New (for the project description)

CivicLens evolved from an AI-assisted civic reporting prototype into an
**autonomous civic operations system**: it doesn't just report and categorize
issues — it plans, grounds its reasoning in real-world data, acts over time, and
holds authorities accountable, all with a human-in-the-loop and an honest,
auditable trail.

## Headline capabilities (all server-authoritative, all using Google AI)

1. **Genuine agentic triage (not a scripted pipeline).** A Gemini function-calling
   agent decides *which* tools to call, in what order, and how many, branching on
   each case's real state. The persisted trace reflects exactly what it did —
   different cases produce different traces (e.g. a new pothole → 6 tool steps; an
   already-resolved case → 2 steps). No fixed step list, no fabricated rows.

2. **The agent grounds itself in the real world.** It can call `get_local_context`
   to pull **live weather (Open-Meteo)**, **nearby schools/hospitals
   (OpenStreetMap)**, and **same-area recurrence** before judging severity/priority
   — e.g. rain worsening a flooding drain, a school near a hazard raising urgency.

3. **Four autonomous workers (Cloud Scheduler-driven).**
   - **SLA → escalation → RTI:** detects cases past their follow-up window and
     auto-drafts a real Gemini grievance-escalation letter **and** a Section 6(1)
     RTI application, idempotently, with an audit event.
   - **Follow-up sentinel:** an LLM control loop that reads each case's timeline +
     elapsed time and decides the next action (wait / escalate / request-evidence /
     ready-to-close) with grounded reasoning.
   - **Predictive insights:** deterministic city aggregates feed a Gemini forecast
     of hotspots, priority categories, and recommended actions.
   - **Embedding backfill:** keeps older cases searchable by the semantic dedup
     pipeline using `gemini-embedding-001`.

4. **Real outbound action (past "drafts only").** An approved escalation can be
   **dispatched** to a configured authority webhook with a persisted delivery
   receipt — a genuine real-world action, honestly recorded (success or failure).

5. **Semantic duplicate detection.** `gemini-embedding-001` embeddings + cosine
   similarity catch duplicates by *meaning*, not keywords (a "burst pipe gushing
   water" report matches an existing "leaking water pipeline" case).

6. **Municipal interoperability.** Public **Open311 GeoReport v2** export so the
   data plugs into real city systems.

7. **Citizen engagement.** A gamified reputation layer — points, levels, badges,
   and a public leaderboard — awarded for reporting, supporting, and verifying.

8. **Transparency.** Public open-analytics endpoints (predictive insights,
   leaderboard, Open311, per-issue grounding) and an auditable per-case activity
   timeline of every AI and human action.

## Google technologies used
- **Gemini** — multimodal triage, structured output, **function calling**, Google
  Search grounding, and **`gemini-embedding-001`** embeddings.
- **Firebase** — Auth, Firestore (server-owned writes, transactions, security
  rules), Storage.
- **Google Maps Platform** — map + Places.
- **Google Cloud** — Cloud Run, Cloud Build, Artifact Registry, Secret Manager,
  **Cloud Scheduler** (autonomous workers), built and deployed from **Google AI
  Studio**.

## Honesty & engineering notes
- Every AI path has a clearly-labelled deterministic fallback; the app never
  presents mock data as real AI output.
- All privileged writes go through the Admin SDK behind an operator trust
  boundary; abuse limits, SSRF guard on image fetches, and Firestore/Storage
  rules are in place.
- New public API: `GET /api/insights/predictive`, `/api/leaderboard`,
  `/api/export/open311`, `/api/issues/:id/open311`, `/api/issues/:id/grounding`;
  operator/job: `POST /api/jobs/run` (workers `sla|followup|predict|embed`),
  `POST /api/dedup/semantic`, `POST /api/issues/:id/escalation-dispatch`.

See `docs/DEPLOY_V2.md` for deployment + worker scheduling.

<h1 align="center">🔎 CivicLens</h1>
<p align="center"><b>From a citizen's photo to a verified resolution — an autonomous, agentic civic-issue platform.</b></p>
<p align="center">
  <a href="https://civiclens-802067002365.asia-southeast1.run.app">🌐 Live App</a> ·
  <a href="https://github.com/amanmaqsood/civiclens">💻 Code</a> ·
  <a href="docs/ARCHITECTURE.md">🧭 Architecture</a>
</p>
<p align="center"><i>Vibe2Ship — Coding Ninjas × Google for Developers · PS2: Community Hero</i></p>

---

## The problem
Civic issues are reported into a void — **fragmented, duplicated, opaque, rarely resolved.** Citizens never see ownership, the responsible authority, status, or proof of a fix.

## The solution
CivicLens turns scattered citizen reports into **one canonical, community-verified, action-ready case** and drives it to a **verified resolution** — with every AI step visible, every state transition authorized by the server, and every consequential action human-approved.

## 🤖 Real agentic core (Gemini function calling)
A genuine server-side **function-calling agent** (`POST /api/agent/run`) where the model *chooses* tools, the server *executes* them, and the real tool-call trace is persisted — not a scripted pipeline.

```
Run AI Triage Agent ▶
  assess_duplicate   → model flags the canonical case (similarity + reasoning)
  calculate_priority → deterministic 0–100 score (server-computed)
  find_authority     → live Google Search grounding → real authority + SLA + contact
  finalize           → routing decision + rationale
```

A deterministic **state machine authorizes** every status transition server-side via the **Firebase Admin SDK** (the model only *recommends*; the client cannot forge state). A live **Agent Trace** exposes each step with its tool, input→output, confidence, and latency.

| Capability | Endpoint | Google tech |
|---|---|---|
| Function-calling triage agent | `POST /api/agent/run` | **Gemini function calling** + **Search grounding** |
| Multimodal report triage | `POST /api/analyze-report` | Gemini Vision + structured output |
| Geo-deduplication | `POST /api/check-duplicate` | Haversine + Gemini similarity |
| Grounded resolution coordinator | `POST /api/resolution-plan` | Gemini + **Google Search grounding** |
| Before/after closure verify | `POST /api/verify-resolution` | Gemini Vision (multimodal compare) |
| Escalation + RTI drafting | `POST /api/escalation` | Gemini (legal drafting) |
| Hindi translation | `POST /api/translate` | Gemini structured output |
| Server-authorized status transition | `POST /api/issues/update-status` | Firebase Admin SDK + ID-token verify |

## ✨ Key features
- Real **Gemini function-calling agent** with grounded authority lookup (e.g. **BBMP / BWSSB**) — the model selects and runs controlled tools.
- Canonical issue graph: geo-deduplication merges duplicates into one verified case (every raw report preserved as evidence).
- Community confirm/dispute + **deterministic, explainable priority score** (server-computed, bounded 0–100).
- **Server-authorized state machine** (Admin SDK + Firebase ID-token verification) — clients can't forge status.
- AI before/after resolution verification (resolve / request-more-evidence / reopen).
- Auto-escalation letter + **RTI petition (RTI Act 2005)** when past SLA.
- Accessibility & reach: voice input + **English / हिन्दी** (on-demand Gemini translation).
- Installable **PWA**, **WCAG 2.1 AA** (0 axe violations), live map, impact dashboard, transparently-badged demo data.

## 🧱 Architecture
```
React + TS + Tailwind (PWA, built in Google AI Studio)
        │  Firebase ID token
        ▼
Cloud Run · Express (holds GEMINI_API_KEY; agent endpoints + state machine)
   ├── Gemini 2.5 Flash — vision · structured output · function calling · Search grounding · translation
   ├── Firebase Admin SDK (ADC) — server-authoritative writes + token verification
   ├── Firestore (named DB) · Storage · Anonymous Auth
   └── Google Maps Platform
```
Full diagrams + decision log in [`docs/`](docs/).

## 🛡️ Security
Server-only Gemini key · **Firebase ID-token verification** on privileged writes · **server-authoritative state machine** (Admin SDK; clients cannot mutate status) · Firestore + Storage **security rules** · API **rate-limiting** + security headers · **SSRF protection** (Storage-host allowlist) · **EXIF stripping** (canvas re-encode) · input validation · no secrets in localStorage.

## 🚀 Run locally
```bash
git clone https://github.com/amanmaqsood/civiclens && cd civiclens && npm install
# set env: GEMINI_API_KEY (server), GOOGLE_MAPS_PLATFORM_KEY; Firebase web config is bundled
npm run dev
```
Deployed on **Google Cloud Run** (built in Google AI Studio).

## 🧰 Google technologies
Google AI Studio · Gemini 2.5 Flash (multimodal vision, structured output, **function calling**, **Search grounding**, translation) · Google Cloud Run · Firebase (Firestore + Storage + Anonymous Auth + **Admin SDK**) · Google Maps Platform.

## ⚠️ Prototype boundary
Government filing/routing is simulated via the authority operator console (clearly labeled). All AI reasoning, deduplication, grounded authority lookup, drafting, escalation, RTI generation, and before/after verification are real. Map demo issues are badged "DEMO".

## 📄 Project documentation
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system, agent-loop, and state-machine diagrams
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — engineering decision records
- [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) — third-party libraries, fonts, media credits

## 📜 License
[MIT](LICENSE) · Built solo for Vibe2Ship 2026.

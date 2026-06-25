<!-- Drop into the exported GitHub repo as README.md. Replace [bracketed] items. -->

<h1 align="center">🔎 CivicLens</h1>
<p align="center"><b>From a citizen's photo to a verified resolution — an autonomous civic-issue resolution agent.</b></p>
<p align="center">
  <a href="https://civiclens-802067002365.asia-southeast1.run.app">🌐 Live App</a> ·
  <a href="[demo video]">🎬 Demo</a> ·
  <a href="[Google Doc]">📄 Project Doc</a>
</p>
<p align="center"><i>Vibe2Ship — Coding Ninjas × Google for Developers · PS2: Community Hero</i></p>

---

## The problem
Civic issues are reported into a void — **fragmented, duplicated, opaque, rarely resolved.** Citizens never see ownership, the responsible authority, status, or proof of a fix.

## The solution
CivicLens turns scattered citizen reports into **one canonical, community-verified, action-ready case** and drives it to a **verified resolution** — with every AI step visible and every consequential action human-approved.

## 🤖 The agent pipeline
A server-side orchestrator runs a multi-step loop; a deterministic **state machine authorizes** transitions (the model only *recommends*).
```
Perceive (Vision) → Deduplicate (canonical graph) → Community Verify → Priority Score
   → Find Authority (Search grounding) → Draft Complaint → Operator Routing
   → Before/After Verify (Vision) → Auto-Escalate + RTI
```
| Agent step | Endpoint | Google tech |
|---|---|---|
| Triage | `/api/analyze-report` | Gemini Vision + structured output |
| Deduplicate | `/api/check-duplicate` | Haversine + Gemini similarity |
| Resolution Coordinator | `/api/resolution-plan` | Gemini + **Google Search grounding** |
| Before/After Verify | `/api/verify-resolution` | Gemini Vision (multimodal compare) |
| Escalation + RTI | `/api/escalation` | Gemini (legal drafting) |

A live **Agent Trace** timeline exposes every step + rationale.

## ✨ Key features
- Multimodal AI triage (category, severity, hazards, confidence) — with voice input + English/हिन्दी
- Canonical issue graph: geo-deduplication merges duplicates into one verified case (evidence preserved)
- Community confirm/dispute (one vote/user) + **deterministic, explainable priority score**
- Grounded authority lookup (e.g. **BBMP / BWSSB**) + auto-drafted formal complaint
- Authority Operator Console: priority queue, status pipeline, immutable audit log
- AI before/after resolution verification (resolve / reopen)
- Auto-escalation letter + **RTI petition (RTI Act 2005)** when past SLA
- Impact dashboard + seeded demo data

## 🧱 Architecture
```
React + TS + Tailwind (Google AI Studio)
        │
   Cloud Run (server: holds GEMINI_API_KEY, runs agent endpoints + state machine)
        ├── Gemini 2.5 Flash (vision · structured output · search grounding)
        ├── Firebase (Firestore · Storage · Anonymous Auth)
        └── Google Maps Platform
```

## 🛡️ Security
Server-side API keys · server-side validation · EXIF stripping (canvas re-encode) · Firestore security rules · signed Storage URLs · no secrets in localStorage.

## 🚀 Run locally
```bash
git clone https://github.com/amanmaqsood/civiclens && cd civiclens && npm install
cp .env.example .env   # set GEMINI_API_KEY (server), GOOGLE_MAPS_PLATFORM_KEY; Firebase config is bundled
npm run dev
```

## 🧰 Google technologies
Google AI Studio · Gemini 2.5 Flash (multimodal, structured output, function-calling, Search grounding) · Google Cloud Run · Firebase (Firestore + Storage + Auth) · Google Maps Platform.

## ⚠️ Prototype boundary
Government filing/routing is simulated via the authority operator console; all AI reasoning, dedup, drafting, escalation, RTI, and before/after verification are real.

## 📜 License
[MIT] · Built solo for Vibe2Ship 2026.

# CivicLens — Engineering Decision Log

Architecture Decision Records (ADRs) capturing the key choices behind CivicLens and *why* they were made. Each is a real trade‑off taken during the build, not a post‑hoc rationalization.

---

### ADR‑01 — Build & deploy entirely in Google AI Studio → Cloud Run
**Context.** The hackathon requires Google AI Studio as the core build *and* deploy tool; the submitted link must be deployed from AI Studio.
**Decision.** Build the full‑stack React + TS app in AI Studio Build mode and deploy to Cloud Run from AI Studio. Iterate by pasting one scoped prompt at a time into the same app.
**Rationale.** Satisfies the mandate and keeps all three artifacts (live link, GitHub export, code) coherent.
**Trade‑off.** Less control than a local toolchain; mitigated by exporting to GitHub and hardening there.

---

### ADR‑02 — Firebase over Supabase for data/auth/storage
**Context.** Rules allowed either; the rubric weights "Usage of Google Technologies" at 15%.
**Decision.** Use Firebase Anonymous Auth + Firestore (named DB) + Storage.
**Rationale.** Maximizes Google‑tech surface area alongside Gemini, Maps, and Cloud Run, and Anonymous Auth removes onboarding friction for a civic app.
**Trade‑off.** Firestore security‑rule modeling is fiddly (see ADR‑10).

---

### ADR‑03 — A server tier that holds the secret and authorizes state
**Context.** The Gemini key cannot ship to the browser, and an agent that can silently mutate state is unsafe.
**Decision.** Run an Express orchestrator on Cloud Run that holds `GEMINI_API_KEY`, runs the controlled agent tools, and drives a deterministic state machine. **The model recommends; server code authorizes.**
**Rationale.** Security (no key leak) + correctness (state transitions are deterministic and testable) + trust (humans approve consequential actions).
**Trade‑off.** More moving parts than a pure client app — justified by the safety and agentic‑depth payoff.

---

### ADR‑04 — A canonical issue graph (dedup + merge), not a complaint list
**Context.** Most civic apps create one row per complaint, so the same pothole becomes ten ignored tickets.
**Decision.** Geo‑deduplicate (same category, within radius, recent) → Gemini similarity → **merge** new reports into one canonical issue as attributable `evidence`, never silently.
**Rationale.** This is the product thesis: turn fragmented evidence into one accountable, higher‑priority case. It's also hard for other entrants to copy.
**Trade‑off.** Merge UX and evidence preservation add complexity; worth it for the impact story.

---

### ADR‑05 — Deterministic, unit‑tested priority score (not LLM‑ranked)
**Context.** Ranking must be explainable and stable for an authority queue.
**Decision.** Compute priority in code from severity, urgency, age, confirmations, multi‑report weight, and dispute penalty; show an itemized breakdown in the UI.
**Rationale.** Reproducible, auditable, and testable — an LLM score would be opaque and non‑deterministic.
**Trade‑off.** Less "smart" than an LLM, but credibility matters more than novelty here.

---

### ADR‑06 — Make the agent visible (the Agent Trace)
**Context.** Agentic Depth is 20% of the score; hidden sophistication earns nothing.
**Decision.** Persist every agent step (`step, tool, status, rationale, ts`) and render it as a live timeline on each issue.
**Rationale.** Turns "it used AI somewhere" into a legible, auditable multi‑step agent — the single best demonstration of agentic depth.
**Trade‑off.** Extra writes per issue; negligible.

---

### ADR‑07 — Google Search grounding for the *real* authority, with anti‑hallucination guards
**Context.** A drafted complaint is only useful if it names the correct authority, helpline, and SLA — and inventing a reference number is worse than none.
**Decision.** Use Gemini with `tools: [{ googleSearch: {} }]` for `/api/resolution-plan`; pass the issue's **real** ticketId and today's date into the prompt and instruct the model to never invent reference numbers.
**Rationale.** Grounding yields current, real authorities (e.g. BBMP) and SLAs; the guards prevent fabricated complaint references that would destroy credibility.
**Trade‑off.** Grounding is incompatible with `responseMimeType: application/json` (see ADR‑08), so this endpoint parses text instead of forcing a schema.

---

### ADR‑08 — Gemini 2.5 Flash, and grounding vs structured‑output trade‑off
**Context.** An earlier model (`gemini‑3.5‑flash`) returned frequent `503 UNAVAILABLE`, and tool use cannot be combined with a forced JSON mime type.
**Decision.** Standardize on `gemini‑2.5‑flash` for all calls; use `responseSchema` everywhere **except** the grounded resolution endpoint, where Google Search tools are enabled and JSON is parsed from text.
**Rationale.** Stability (no 503 fallbacks) and a clean separation between "structured" and "grounded" calls.
**Trade‑off.** One endpoint sacrifices schema enforcement for grounding — an accepted, documented exception.

---

### ADR‑09 — Close the loop with before/after AI verification + human approval
**Context.** "Drafted a complaint" is not a resolution; civic trust requires proof the fix happened.
**Decision.** On an after‑photo, `/api/verify-resolution` compares before/after with Gemini vision and recommends `resolve` or `reopen`; a human approves. Status never auto‑closes.
**Rationale.** Genuinely closes the report→resolution loop and keeps everyone honest (it will reopen an issue if the pothole is still there).
**Trade‑off.** Requires the operator persona and an after‑image flow; central to the "Impact" story.

---

### ADR‑10 — Relaxed‑but‑bounded Firestore rules
**Context.** Strict per‑field rules false‑rejected valid writes; and demo seeding sets `citizenUpvotes` to the confirmation count, which a `citizenUpvotes == 0` create rule rejected.
**Decision.** Enforce auth + ownership + invariants, but bound `citizenUpvotes` to a non‑negative integer range instead of exactly 0; forbid changing `userId`/`ticketId` on update; make real reports non‑deletable while allowing only `isDemoData` docs to be cleared.
**Rationale.** Keeps strong guarantees (no key leak, ownership, immutable identity) while letting legitimate writes — including transparent demo data — succeed.
**Trade‑off.** Slightly looser than a maximalist ruleset; every relaxation is intentional and documented.

---

### ADR‑11 — Ship as an installable, native‑feeling PWA
**Context.** A civic‑reporting tool is used on phones; a framed "web preview" undermines trust on a real device.
**Decision.** Add a manifest + maskable icons + themed status bar + safe‑area insets, a full‑bleed mobile shell with a sticky app bar, momentum scroll, and real device geolocation with a "use my location" control (Bengaluru only as a fallback).
**Rationale.** First impressions are formed in seconds, especially in the live presentation round; this makes it feel like an app you'd install, not a web page.
**Trade‑off.** Extra mobile/PWA plumbing; high perceived‑quality return.

---

### ADR‑12 — Keep demo data, but make it transparent
**Context.** A populated map/feed/dashboard demos far better than an empty one, but unlabeled sample data reads as fake users.
**Decision.** Seed realistic, clearly **badged** Bengaluru sample issues (per‑card "DEMO" tags + a conditional "Sample data" banner + an operator "Clear demo data" control).
**Rationale.** Best of both: an impressive, full demo that is honestly labeled — protecting the originality/credibility score.
**Trade‑off.** None meaningful; transparency is strictly better than hiding it.

---

### ADR‑13 — India‑resonant accessibility: auto‑escalation + RTI, bilingual + voice
**Context.** The problem statement is "Community Hero" for India.
**Decision.** When an SLA lapses, draft an escalation letter and a **Right‑to‑Information** petition; support voice reporting and English/Hindi.
**Rationale.** Maps directly to local civic reality and widens reach — strong Impact and Innovation signals.
**Trade‑off.** Added scope, folded in only after the core loop was stable.

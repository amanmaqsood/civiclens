# Attributions

CivicLens is built solo for the Vibe2Ship hackathon. Third-party components and assets used:

## Core platform
- **Google AI Studio** — build & deploy environment
- **Google Gemini 2.5 Flash** (`@google/genai`) — multimodal analysis, structured output, Search grounding, translation
- **Google Cloud Run** — hosting the deployed app + server runtime
- **Firebase** — Anonymous Auth, Firestore, Storage (`firebase` SDK)
- **Google Maps Platform** via **`@vis.gl/react-google-maps`**

## Libraries
- **React**, **React DOM** — UI (MIT)
- **TypeScript** — types (Apache-2.0)
- **Vite** — build tooling (MIT)
- **Tailwind CSS** — styling (MIT)
- **lucide-react** — icons (ISC)
- **motion** (Framer Motion) — animations (MIT)
- **canvas-confetti** — celebration effect (ISC)
- **Vitest** — unit testing (MIT)

## Fonts (Google Fonts, OFL)
- **Public Sans**, **Bricolage Grotesque**, **IBM Plex Mono**

## Demo media
- Sample issue photos in the seeded demo data are from **Unsplash** (Unsplash License), used only to illustrate the prototype and clearly badged "DEMO" in the UI.

## Notes
- All application code, the agent orchestration, the data model, the design system, and the prompts were written by the author.
- Government filing/routing is a clearly-labeled prototype simulation; no real government system is contacted.

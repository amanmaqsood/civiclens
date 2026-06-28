# Attributions

CivicLens is original hackathon prototype work assembled in this repository. No third-party project code was copied wholesale.

## Direct Libraries

- React, React DOM, TypeScript, Vite, and `@vitejs/plugin-react` for the web application build.
- Express, `tsx`, and esbuild for the TypeScript server and production bundle.
- Tailwind CSS and `@tailwindcss/vite` for styling.
- `lucide-react` for icons.
- `motion` for UI animation.
- `canvas-confetti` for the prototype resolved-state visual effect.
- Firebase JavaScript SDK and Firebase Admin SDK for Auth, Firestore, Storage, App Check verification, and server-owned writes.
- `@google/genai` for Gemini multimodal, structured output, and function-calling flows.
- `@vis.gl/react-google-maps` for Google Maps rendering.
- Google Maps JavaScript Places library / `PlaceAutocompleteElement` for manual place search in the report flow.
- `dotenv` for local environment loading.
- Vitest for test execution.
- Sharp is included as a development dependency for image-related tooling.

## Google Technologies

- Google AI Studio was used as the development/provenance environment for the prototype and Gemini integration.
- Gemini via `@google/genai` powers report analysis, duplicate comparison support, draft resolution planning, closure image assessment, escalation/RTI drafting, translation, and the server-side tool loop.
- Firebase Auth, Firestore, Storage, Admin SDK, and App Check verification form the identity/data/storage boundary.
- Google Maps Platform renders the local map view and provides Places autocomplete for manual location search.
- Google Cloud Run is the target deployment path. Public deployment remains credential and approval gated.

## Demo Assets

Synthetic seeded demo records use Unsplash image URLs embedded in `server.ts` and the legacy unreachable seed code in `src/services/issues.ts`. These images are used only as synthetic sample evidence, not as real reports.

Seed URL sources currently include:

- `https://images.unsplash.com/photo-1541888946425-d81bb19240f5`
- `https://images.unsplash.com/photo-1515162305285-0293e4767cc2`
- `https://images.unsplash.com/photo-1509024640106-cf78faeb99b2`
- `https://images.unsplash.com/photo-1611284446314-60a58ac0deb9`
- `https://images.unsplash.com/photo-1504307651254-35680f356dfd`

## Agent Review Skills

Local Codex skills used as review checklists during the rebuild:

- `civiclens-security`
- `frontend-quality`
- `hackathon-judge`
- `release-gate`

These skills informed review and verification. They were not copied into the application as runtime code.

## UX Planning References

External repositories referenced during the post-release UX planning checkpoint:

- `Leonxlnx/taste-skill` (`https://github.com/Leonxlnx/taste-skill`) for redesign-audit methodology around hierarchy, typography, spacing, mobile states, and existing-project restraint.
- `obra/superpowers` (`https://github.com/obra/superpowers`) for spec-first planning, task decomposition, TDD, and verification-before-claims methodology.

These repositories were not installed into the project, vendored into `src/`, or copied into CivicLens runtime code.

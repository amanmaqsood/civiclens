# CivicLens Design System

Single source of truth for the CivicLens UI. Every screen, component, and token derives from this document. Influenced by **Google Material Design 3** (elevation, state layers, motion, accessibility) with a restrained civic/public-sector tone so the product reads as a trustworthy institution — not a startup toy or a game. Built with **Google Fonts** and tuned for **WCAG 2.2 AA**.

> Rule: do not invent ad-hoc hex values or one-off font sizes in components. If a value isn't here, add it here first, then use the token.

---

## 1. Brand & voice
- **Name lockup:** "Civic" in `--color-ink`, "Lens" in `--color-marigold`. Display font, tight tracking.
- **Voice:** plain-language, calm, accountable. Short sentences. No hype, no exclamation. Honest about prototype boundaries.
- **Tone in status copy:** factual and reassuring ("Reported", "Under review", "Resolved — verified by photo").

## 2. Color tokens

### 2.1 Core brand (existing — keep)
| Token | Light | Role |
|---|---|---|
| `--color-ink` | `#0E1A2B` | primary text, dark surfaces |
| `--color-paper` | `#F5F4F1` | app background |
| `--color-marigold` | `#EE9B2D` | primary action / brand accent |
| `--color-verify` | `#0FB5A6` | success / verified / resolved |
| `--color-alert` | `#E5484D` | danger / errors / overdue |
| `--color-slate` | `#64748B` | secondary text, muted |
| `--color-hairline` | `#E3E1DA` | borders, dividers |

### 2.2 Semantic surface & text (new — adds depth + dark mode)
| Token | Light | Dark | Role |
|---|---|---|---|
| `--surface-1` | `#FFFFFF` | `#0E1A2B` | cards, sheets |
| `--surface-2` | `#FAF9F6` | `#15233A` | raised panels, table headers |
| `--surface-3` | `#F0EEE8` | `#1C2C46` | inset wells, hovered rows |
| `--text-strong` | `#0E1A2B` | `#F5F6F8` | headings |
| `--text-default` | `#1F2A3A` | `#D7DEE8` | body |
| `--text-muted` | `#64748B` | `#93A1B5` | captions, meta |
| `--border-subtle` | `#E3E1DA` | `#27374F` | hairlines |
| `--focus-ring` | `#EE9B2D` | `#EE9B2D` | 2px focus outline + 2px offset (marigold both modes) |

### 2.3 Lifecycle status (semantic — color AND icon+label, never color alone)
| Status | Token | Color (light) | Icon | Label |
|---|---|---|---|---|
| Submitted | `--status-submitted` | `#2563EB` (info blue) | `circle-dot` | Reported |
| Verified | `--status-verified` | `#7C3AED` (review) | `users` | Community-verified |
| In Progress | `--status-progress` | `#EE9B2D` (marigold) | `loader` | In progress |
| Resolved | `--status-resolved` | `#0FB5A6` (verify) | `check-circle` | Resolved |
| Overdue/Escalated | `--status-overdue` | `#E5484D` (alert) | `alert-triangle` | Escalated |

Severity ramp (heatmap/priority): `--sev-1 #16A34A` → `--sev-2 #EAB308` → `--sev-3 #F97316` → `--sev-4 #E5484D` → `--sev-5 #991B1B`. Always pair with a numeric label; verify all pairs with an OKLCH contrast check (AA on `--surface-1`).

### 2.4 Gamification namespace (SCOPED — `.gamify-*` only)
Confined to the contributor profile, badges, and leaderboard. Must never leak into core civic UI.
`--gamify-xp #58CC02` · `--gamify-streak #FF9600` · `--gamify-gem #CE82FF` · `--gamify-shadow rgba(0,0,0,.18)` (tactile 4px button shadow).

## 3. Typography (Google Fonts)
- Display: **Bricolage Grotesque** (`--font-display`) — h1/h2, hero, brand.
- Body: **Public Sans** (`--font-sans`) — all UI text.
- Mono: **IBM Plex Mono** (`--font-mono`) — IDs, coordinates, metrics only (sparingly).

**Type scale** (min body 14px; kill `text-[10px]/[11px]`):
| Token | Size / line | Use |
|---|---|---|
| `display` | 40/44, -0.02em | hero |
| `h1` | 30/36 | page title |
| `h2` | 24/30 | section |
| `h3` | 19/26 | card title |
| `body` | 16/24 | default |
| `body-sm` | 14/20 | secondary |
| `caption` | 13/18 | meta (floor) |
| `mono-num` | tabular-nums | KPI numbers |

KPI/metric numerals use `font-variant-numeric: tabular-nums` for aligned, credible figures.

## 4. Spacing, radius, elevation
- **8px grid:** 4, 8, 12, 16, 24, 32, 48, 64. Component padding ≥ 16; section gaps 24–32.
- **Radius:** `--r-sm 8`, `--r-md 12`, `--r-lg 16`, `--r-pill 999`. Cards `--r-lg`; buttons/inputs `--r-md`.
- **Elevation** (Material-style, restrained): `--e1 0 1px 2px rgba(14,26,43,.06)`, `--e2 0 4px 12px rgba(14,26,43,.08)`, `--e3 0 12px 32px rgba(14,26,43,.12)`. Max one accent per screen region.

## 5. Components (specs)
- **Button** — Primary: marigold bg, ink text, `--r-md`, `--e1`, hover darken 6%, `:active` translateY(1px), Material state layer on hover/focus. Secondary: surface-1 + border-subtle. Destructive: alert. Min touch target **44×44**. Always a visible label (icon-only needs `aria-label`).
- **Card** — surface-1, border-subtle, `--r-lg`, padding 20–24, `--e1`; hover `--e2` only when interactive.
- **Status pill** — status color at 12% bg + full-color icon + label; never color-only. One pill per row max for primary status.
- **Input/select** — surface-1, border-subtle, `--r-md`, 44px height, label always present, error state = alert border + helper text + `aria-invalid`.
- **Table (agency/triage)** — Ant-style density: 40px rows, sticky header surface-2, zebra optional via surface-3 hover, right-aligned numeric columns with `tabular-nums`.
- **KPI card** — big `mono-num`, label caption, delta chip (▲/▼ + %) colored verify/alert, optional sparkline.
- **Chart** — fixed container height (avoid ResizeObserver loop); keyboard-accessible tooltips; every chart has a data-table fallback toggle.

## 6. Motion
- Durations: 120ms (micro), 200ms (default), 320ms (overlay). Easing `cubic-bezier(.2,0,0,1)` (Material standard).
- Use motion to explain change (status transitions, streaming agent steps), never as decoration.
- **No demo theatrics in judge-visible flows** (no confetti loops, no artificial `setTimeout` "thinking" delays). One tasteful success confirmation is allowed; respect `prefers-reduced-motion`.

## 7. Accessibility (WCAG 2.2 AA — non-negotiable)
- Contrast ≥ 4.5:1 text / 3:1 large & UI; never signal by color alone (status uses icon+label).
- Visible focus: 2px `--focus-ring` + 2px offset on every interactive element. Skip-to-content link (present — keep).
- Touch targets ≥ 44px; inputs labeled; charts have table fallbacks; `prefers-reduced-motion` honored.
- Validate every shipped screen with `axe-core` (0 serious/critical).

## 8. State coverage (every surface must define all four)
- **Empty** — purposeful (e.g., "No reports yet — be the first" + CTA), not a blank.
- **Loading** — skeletons matching final layout (no spinners-only for content regions).
- **Error** — plain-language cause + retry; never a dead end.
- **Success** — clear confirmation (report saved, badge earned).

## 9. Dark mode
Toggle persists (localStorage). Maps tokens in 2.2 to the dark column. Gamification keeps its hues but lowers brightness 8–10%. Default to system preference on first load.

## 10. Implementation notes
- Tokens live in `src/index.css` `@theme`; this doc is the contract. Extend the `@theme` block to add the new surface/text/status tokens above; replace off-token component hex (`#4F46E5`, `#2563EB`, `#7A4300`, `#334155`) with tokens.
- Google Maps Web Components inherit `--gmpx-*` mapped to these tokens (already wired).
- Keep the civic core serious (ink/paper/marigold/verify) and gamification fenced inside `.gamify-*` — that separation is what earns a 10/10 without making a public-service tool feel like a game.

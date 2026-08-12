---
title: "Fun Pack — Seven Future Tool Stories"
created: "2026-08-12"
project: "useful-tools"
source_brainstorm: "_bmad-output/brainstorming/brainstorm-fun-pack-2026-08-12"
target_epic: "Epic 6 (Packs and New Tools)" # backlog; promotion happens after Epic 3 + 6.3 (pack taxonomy)
status: "backlog"
---

# Fun Pack — Seven Future Tool Stories

## Pack framing (shared across all seven tools)

| Field | Value |
|---|---|
| Pack name (proposed) | `fun` |
| Pack tagline | "For fun — not authoritative." |
| Pack tone | Playful, meme-friendly, shareable |
| Pack color token | Reuse one of the existing palette tokens (no new tokens) |
| Pack badge obligation | Every tool page renders a visible **"For Fun — Not Authoritative"** badge above the result tile |
| Pack aria-text | `aria-label="For Fun — Not Authoritative tool"` on the tool `<main>` |
| Pack storage namespace | `handy-tools.fun.<slug>` (read-only after compute; never user-authored) |
| Pack rel-inputs | All inputs are ephemeral (no `history-keys` for Fun Pack tools — Story 3.6 cap and migration do not apply) |
| Pack determinism | Every output is **deterministic given the same inputs** — no `Math.random()`; uses a stable hash-based PRNG so shareable URLs round-trip the same result |
| Pack URL state | All inputs go through `HT.urlState` so a result can be shared via the existing `?` query string |
| Pack pack-taxonomy | Add `fun` to `docs/packs/fun.md` (new pack doc) once Story 6.3 lands |
| Pack embed mode | All tools honor `isEmbedMode()` — they disable storage writes and the floating badge is replaced with an inline disclosure |
| Pack description (catalog copy) | `Playful calculators, quizzes, and generators built for entertainment. Results are deterministic but never authoritative.` |

---

## Common acceptance criteria (apply to every Fun Pack tool)

For every story in this pack, the following ACs are mandatory in addition to the per-tool ACs below.

### AC-0.1 — Badge obligation
The tool page renders a `<p class="fun-badge" role="note">For Fun — Not Authoritative</p>` above the result tile. The badge is visible whenever the page is rendered. In `embed` mode, the badge moves inline (same `<p>` element, same color, no visual change).

### AC-0.2 — Deterministic output
Given the same inputs, the same **shareable URL** (after `HT.urlState.encode(slug)`) must produce the same output on every reload, every browser, every device. **No `Math.random()`** — the seed is the deterministic hash of the inputs (e.g. `cyrb53(JSON.stringify(inputs))`).

### AC-0.3 — No real predictive or advisory framing
The tool UI must never use the words "predict," "accurate," "real probability," "compatibility score," or "score" without the qualifier "playful" or "for fun." The badge phrase ("For Fun — Not Authoritative") appears at minimum three times on the result page: once in the badge, once in the share card footer, once in the success-metric aria-live region.

### AC-0.4 — Privacy + ephemeral storage
Fun tools never request, store, or transmit PII beyond the user's typed inputs. Storage keys are `handy-tools.fun.<slug>` and are used only for URL-state round-trip (already covered by `HT.urlState`). No `history-keys` declaration. No analytics pings. The `tools.schema.json` entry for each tool declares `collects-personal-data: false`.

### AC-0.5 — Static-only, zero-dep
The tool ships as `tools/<slug>/<slug>.js` + `tools/<slug>/<slug>.css` (if needed) with no `<script src="">` to a CDN, no npm dependency, no font fetch. Uses only `Intl`, `window.HT.*` Shell APIs, and the existing cobalt-themed CSS tokens.

### AC-0.6 — Shareable
The result tile works with the existing share dialog (Story 2.5) — the URL round-trips through `HT.urlState.encode(slug)` and `<title>` updates to `"{result} — Fun | Handy Tools"`. The share dialog includes a "Copy result card" button that copies a plain-text card with the badge.

### AC-0.7 — a11y
- One `<output role="status" aria-live="polite">` element per result tile.
- All inputs have `<label for>` pairs.
- All emoji characters have an `aria-hidden="true"` (the visual is decoration; the text content is the announcement).
- Meet Story 3.1's a11y floor (combobox/listbox where applicable; `aria-current` on selected options).

### AC-0.8 — Tool contract entries
Each tool declares `tools.json` entries with: `slug`, `name`, `category: "fun"`, `tags: ["fun"]`, `urlState: true` (so shareable URLs work), `history-keys: []` (no history), `path: "/tools/<slug>/"`, `description: "<50-char one-liner>"`, `keywords: ["fun", "<alias>"]`, `pack: "fun"`, `collects-personal-data: false`.

### AC-0.9 — Smoke harness
Each tool extends `scripts/_smoke_fun_pack.js` (NEW harness) with at least 8 assertions: deterministic output, shareable URL round-trip, badge presence, no `Math.random()` in source, no `localStorage.setItem` with `handy-tools.*` keys for Fun Pack tools, embed-mode badge position, a11y minimum (label + output element), and exit-code 0.

### AC-0.10 — Pact gates
- `shell-bounds-check.py` — no ad-hoc `handy-tools.*` reads/writes; clean.
- `site-config-gate.py` — same version cross-pin as the rest of the suite.
- `shell-drift-check.py` — no chrome drift.
- `shell-a11y-check.py` — no width invariant regression.

---

## Story 6.21 — Fun Pack: Love Chemistry Calculator

- **Slug:** `love-chemistry`
- **Pack:** `fun`
- **Display name:** "Love Chemistry Calculator"
- **One-liner:** "A playful compatibility score between two names. For fun only."

### Inputs
| Field | Type | Required | Notes |
|---|---|---|---|
| `name-1` | text | yes | First name (≤ 40 chars) |
| `name-2` | text | yes | Second name (≤ 40 chars) |
| `birth-1` | date | yes | First birthday |
| `birth-2` | date | yes | Second birthday |
| `color-1` | select | yes | One of 8 preset colors |
| `color-2` | select | yes | One of 8 preset colors |
| `style-1` | select | yes | One of `chill`, `bold`, `cozy`, `sharp` |
| `style-2` | select | yes | One of `chill`, `bold`, `cozy`, `sharp` |

### Algorithm (deterministic)
1. Normalize both names: lowercase, NFKD fold, strip diacritics.
2. Compute **name chemistry score** (0–100):
   - Letter overlap score (`SharedLetters / UniqueLetters`).
   - Vowel/consonant match boost.
   - Penalty for length imbalance > 5.
3. Compute **birthday sync score** (0–100):
   - Zodiac element match (fire/water/earth/air).
   - Birth-month distance (smaller = higher).
4. Compute **color affinity score** (0–100):
   - Color-wheel complement or analogous match.
5. Compute **style match score** (0–100):
   - Style pair lookup table (e.g. `chill` + `cozy` = 92, `bold` + `cozy` = 48).
6. Final score = weighted average (40% names, 20% birthdays, 25% colors, 15% styles). Clamp to `[0, 100]`.
7. Map to archetype via lookup table:
   - 0–24: "Awkward Orbit"
   - 25–44: "Friendly Static"
   - 45–64: "Warm Spark"
   - 65–84: "Bright Fuse"
   - 85–100: "Cinematic Match"

### Output
- Big number `87 / 100`
- Archetype: `Bright Fuse`
- Two-line horoscope-style flavor text (lookup table of 50 lines, hashed by combined input)
- Mini "best date" suggestion (one of 12 preset activities, hashed)

### Shareable result card
Plain-text copy:
```
Love Chemistry Calculator
{Name-1} + {Name-2} → 87 / 100
"Bright Fuse"
"[flavor text]"
Best date idea: [idea]

For Fun — Not Authoritative
```

### Safety / privacy
- Names never leave the browser.
- No real zodiac library — uses a small embedded lookup table.
- The badge "For Fun — Not Authoritative" is rendered above the result.

### Future task
- **Story 6.21** — `implement-fun-pack-love-chemistry` — create the spec via `bmad-create-story`, then implement via `bmad-dev-story`.
- Followed by **Story 6.21 review pass 1** (`bmad-code-review` first pass) and **Story 6.21 review pass 2** (`bmad-code-review` second pass).
- Conclude with **AI-E3-3 production-readiness gate** before marking done.

---

## Story 6.22 — Fun Pack: Marriage Probability Generator

- **Slug:** `marriage-probability`
- **Pack:** `fun`
- **Display name:** "Marriage Probability Generator"
- **One-liner:** "A fictional 'odds' meter for how two lives might sync. Definitely not a real probability."

### Inputs
| Field | Type | Required | Notes |
|---|---|---|---|
| `name-1` | text | yes | First name |
| `name-2` | text | yes | Second name |
| `years-together` | number | yes | 0–80 |
| `milestones` | multi-select | yes | From list of 10 (e.g., "first trip", "met family", "shared pet") |
| `shared-values` | number | yes | 1–10 self-rated |
| `spice` | radio | yes | `mild`, `medium`, `chaotic` |

### Algorithm (deterministic)
1. Base score = 30.
2. + `years-together * 1.5` (capped at +30).
3. + `milestones.length * 4` (capped at +20).
4. + `(shared-values - 5) * 4` (range −16 to +20).
5. Spice modifier: `mild` = 0, `medium` = +5, `chaotic` = ±10 (hash of input).
6. Clamp to `[1, 99]` (never 0% or 100% — the badge says "not authoritative").
7. Map to "era card":
   - `"Domestic Co-Op Era"`, `"Adventure Duo Era"`, `"Slow Burn Era"`, `"Plot Twist Era"`, `"Sitcom B-Plot Era"`, `"Late-Career Soft Launch Era"`.

### Output
- Big number `47%`
- Era card title
- One-line "life chapter" (60-char flavor)
- Comic-strip caption (one of 24)

### Safety / privacy
- The output is **always** a fictional era, never a real prognosis.
- The page header reads: `This is a fictional probability — not a real forecast.`
- The percent range is restricted to `[1, 99]`.

### Future task
- **Story 6.22** — `implement-fun-pack-marriage-probability` — same workflow as 6.21.

---

## Story 6.23 — Fun Pack: Superpower Fit Quiz

- **Slug:** `superpower-fit`
- **Pack:** `fun`
- **Display name:** "Superpower Fit Quiz"
- **One-liner:** "Pick the answers that feel right. We'll pair you with a totally-not-real superpower."

### Inputs
| Field | Type | Required | Notes |
|---|---|---|---|
| `q1` | radio | yes | 5 options (e.g., "solve puzzles", "lift things", "read minds") |
| `q2` | radio | yes | 5 options |
| `q3` | radio | yes | 5 options |
| `q4` | radio | yes | 5 options |
| `q5` | radio | yes | 5 options |
| `q6` | radio | yes | 5 options |
| `name` | text | no | Optional alias |

### Algorithm (deterministic)
1. Each answer maps to one of 6 archetypes: `STR`, `WIT`, `TIME`, `FLUX`, `HEART`, `CHROME`.
2. Total votes per archetype = histogram.
3. The winner is the archetype with the most votes.
4. Ties broken by a deterministic hash of the answer order.
5. Pre-defined output for each archetype:
   - Alias generator (combines the user's name + archetype prefix).
   - Side effect (one of 16 per archetype).
   - Weakness (one of 16 per archetype).
   - Flag color (one of 6 hex tokens — already in the palette).

### Output
- Alias: "The Wandering Echo"
- Side effect: "All clocks within 10 meters read 3 minutes slow."
- Weakness: "Symmetrical patterns."
- Flag color preview

### Future task
- **Story 6.23** — `implement-fun-pack-superpower-fit` — same workflow as 6.21.

---

## Story 6.24 — Fun Pack: Pet Personality Matchmaker

- **Slug:** `pet-personality`
- **Pack:** `fun`
- **Display name:** "Pet Personality Matchmaker"
- **One-liner:** "Which fictional pet would vibe hardest with you? Definitely not adoption advice."

### Inputs
| Field | Type | Required | Notes |
|---|---|---|---|
| `home-size` | radio | yes | `studio`, `apartment`, `house`, `castle` |
| `energy` | radio | yes | `couch`, `walk`, `hike`, `marathon` |
| `social` | radio | yes | `solo`, `small-group`, `big-gathering`, `festival` |
| `quiet-hours` | number | yes | 0–16 |
| `humor` | radio | yes | `dry`, `loud`, `physical`, `wholesome` |

### Algorithm
1. Map each answer to a 5-dim vector (size, energy, social, quiet, humor).
2. Compare against 16 pet archetypes (each has a 5-dim vector).
3. Pick the closest by Euclidean distance (deterministic tie-break by name hash).
4. Output the archetype's name, a 2-sentence description, and a "do not actually adopt this" disclaimer.

### Output
- Pet name (e.g., "Slightly Confused Axolotl")
- Description
- Single-line "apartment-friendly" badge
- Disclosure: "This is a fictional pet. No animals were harmed by this quiz."

### Safety / privacy
- The output is **never** a real breed recommendation.
- The badge always renders: "Fictional — not adoption advice."

### Future task
- **Story 6.24** — `implement-fun-pack-pet-personality` — same workflow as 6.21.

---

## Story 6.25 — Fun Pack: Main-Character Era Generator

- **Slug:** `main-character-era`
- **Pack:** `fun`
- **Display name:** "Your Main-Character Era"
- **One-liner:** "A poster, a soundtrack, and an episode title based on your weekend mood."

### Inputs
| Field | Type | Required | Notes |
|---|---|---|---|
| `mood` | radio | yes | `chill`, `chaotic`, `scheming`, `soft`, `rebuilding` |
| `weekend` | multi-select | yes | From list of 8 activities |
| `sound` | multi-select | yes | From list of 8 genres |
| `motif` | radio | yes | `rain`, `neon`, `forest`, `desert`, `space` |
| `name` | text | no | Optional |

### Algorithm
1. Each answer maps to a 6-dim trait vector.
2. Compare against 24 pre-defined character archetypes (e.g., "Disgraced Detective", "Hometown Hero", "Interdimensional Barista").
3. Pick the closest archetype + a deterministic "episode title" string.
4. Generate a poster-style result card with the archetype name, episode title, and 4-row soundtrack mood list.

### Output
- Title: "The Disgraced Detective in: 'The Coffee That Knew Too Much'"
- Soundtrack mood: 4 lines
- Poster share card

### Future task
- **Story 6.25** — `implement-fun-pack-main-character-era` — same workflow as 6.21.

---

## Story 6.26 — Fun Pack: Age Capsule / Future-Self Time Capsule

- **Slug:** `age-capsule`
- **Pack:** `fun`
- **Display name:** "Future-Self Time Capsule"
- **One-liner:** "A playful 'you in 2055' snapshot from your current age and a few lifestyle sliders."

### Inputs
| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | text | yes | First name |
| `age` | number | yes | 1–99 |
| `coffee` | slider | yes | 0–10 |
| `sleep` | slider | yes | 0–10 |
| `wifi` | slider | yes | 0–10 |
| `creature` | radio | yes | `cat`, `dog`, `plant`, `moon` |

### Algorithm
1. Hash `(name, age, coffee, sleep, wifi, creature)` to a stable seed.
2. Seed-PRNG generates 5 "life stats" from a fixed template list (e.g., "Number of languages you casually speak").
3. Generate a 3-line "letter to yourself" snippet (deterministic template.
4. The page renders a "Time Capsule opened in 2055" stamp.

### Output
- 5 life stats
- 3-line letter snippet
- "Time Capsule" stamp with the current date

### Safety / privacy
- The output is **never** a real health forecast.
- The page renders: "This is a fictional time capsule. Do not base life decisions on it."

### Future task
- **Story 6.26** — `implement-fun-pack-age-capsule` — same workflow as 6.21.

---

## Story 6.27 — Fun Pack: What-If Time Warp

- **Slug:** `what-if-time-warp`
- **Pack:** `fun`
- **Display name:** "What-If Time Warp"
- **One-liner:** "Type any sentence. Pick a twist. We'll rewrite it in another timeline."

### Inputs
| Field | Type | Required | Notes |
|---|---|---|---|
| `sentence` | text | yes | ≤ 200 chars |
| `twist` | select | yes | One of 12: `time-travel`, `pirate-era`, `alien`, `medieval`, `cyberpunk`, `haunted`, `space`, `underwater`, `prehistoric`, `cartoon`, `noir`, `opera` |
| `tone` | radio | yes | `whimsical`, `dramatic`, `wholesome`, `awkward` |

### Algorithm
1. Tokenize the input sentence by whitespace.
2. Apply a deterministic rewriter per twist:
   - `time-travel` → prepend "Two Tuesdays from now,"
   - `pirate-era` → swap the verb with a pirate-y synonym (lookup table)
   - `alien` → append ", apparently on the planet Quoth"
   - etc. (12 deterministic transformations total)
3. Apply tone modifier (whimsical = exclamation, dramatic = ellipsis, etc.).
4. Output the rewritten sentence + a single-line "stamp card" with the twist label.

### Output
- Rewritten sentence
- Stamp card with the twist label
- "Rewrite again" button (cycles through the other 11 twists deterministically)

### Safety / privacy
- The input is never stored beyond URL state.
- The page enforces a hard 200-char limit on `sentence`.

### Future task
- **Story 6.27** — `implement-fun-pack-what-if-time-warp` — same workflow as 6.21.

---

## Cross-pack dependencies

| Story | Depends on |
|---|---|
| 6.21 through 6.27 | Story 6.3 (pack taxonomy) — the `fun` pack doc lands before any Fun Pack tool is declared in `tools.json` |
| 6.21 through 6.27 | Story 6.2 (pack page renderer) — Fun Pack needs a `/pack/fun` page |
| 6.21 through 6.27 | Story 6.1 (pack card) — the home grid renders a "Fun" pack card |
| 6.21 through 6.27 | URL state codec (Story 2.1) and share dialog (Story 2.5) |

## Recommended sprint sequencing

The seven stories are independent of each other (each has its own algorithm and lookup tables) but share the Fun Pack framing. Recommended order:

1. **6.21** — Love Chemistry Calculator (the prototype; sets the badge/determinism/shareable pattern)
2. **6.22** — Marriage Probability Generator (extends the two-person input pattern)
3. **6.23** — Superpower Fit Quiz (introduces the quiz-input pattern)
4. **6.24** — Pet Personality Matchmaker (extends the quiz pattern with vector matching)
5. **6.25** — Main-Character Era Generator (introduces the generator pattern)
6. **6.26** — Age Capsule (introduces the time/PRNG pattern)
7. **6.27** — What-If Time Warp (introduces the rewriter pattern)

The seven together exercise every input pattern the rest of the project uses (text+date, multi-select, slider, single-select, two-person compare, free-text rewrite), so completing the pack in this order validates the patterns for the rest of the tools.

## Process commitments (apply to every story)

Per the Epic 3 retro and the forward-only commitments, every Fun Pack story follows the same workflow:

1. **AI-E3-1** — Validate the story spec before development.
2. Implement via `bmad-dev-story`.
3. **AI-E3-2** — Run `bmad-code-review` twice.
4. **AI-E3-3** — Pass the production-readiness gate before marking done.

# Dev Story 10.7 — Followup: 4 Discovery Quizzes

Sprint F left Discovery at 6/10 entries (DC-7 expects 10). This followup
authors the remaining 4 quizzes, registers them in `tools.json`, and confirms
the DC-6 / DC-7 gates go from red to green.

## Files created

4 new quiz folders under `tools/packs/discovery/`, each with the canonical
4-file shape (`index.html`, `<slug>-core.js`, `<slug>.css`, `data.json`):

- `tools/packs/discovery/fortune-cookie/`
  - `fortune-cookie/index.html`
  - `fortune-cookie/fortune-cookie-core.js`
  - `fortune-cookie/fortune-cookie.css`
  - `fortune-cookie/data.json`
- `tools/packs/discovery/time-traveler-therapist/`
  - `time-traveler-therapist/index.html`
  - `time-traveler-therapist/time-traveler-therapist-core.js`
  - `time-traveler-therapist/time-traveler-therapist.css`
  - `time-traveler-therapist/data.json`
- `tools/packs/discovery/dream-job/`
  - `dream-job/index.html`
  - `dream-job/dream-job-core.js`
  - `dream-job/dream-job.css`
  - `dream-job/data.json`
- `tools/packs/discovery/last-meal/`
  - `last-meal/index.html`
  - `last-meal/last-meal-core.js`
  - `last-meal/last-meal.css`
  - `last-meal/data.json`

Plus the tools.json edit:

- `tools.json` — 4 new entries appended to `packs.discovery.entries[]`
  (after the existing `car-finder` entry). Each entry declares
  `category: "viral"` (matching the discovery pack's viral-lane intent),
  with `scoring` + `results` + `challenge` modules; `challenge.match-scorer`
  set to `"jaccard"` per the followup spec.

Total: **16 new files + 1 tools.json edit.**

## Archetype rosters

| slug                  | title                   | category | # Q | # archetypes | default archetype | archetypes |
| --------------------- | ----------------------- | -------- | --- | ------------ | ----------------- | ---------- |
| `fortune-cookie`      | Fortune Cookie          | viral    | 8   | 6            | classic           | Classic, Zen, Rebel's, Scholar's, Heart's, Trickster's |
| `time-traveler-therapist` | Time-Traveler Therapist | viral | 10  | 5            | counselor         | Counselor, Historian, Storyteller, Scientist, Mystic |
| `dream-job`           | Dream Job               | viral    | 9   | 6            | artisan           | Artisan, Pioneer, Steward, Scholar, Diplomat, Maverick |
| `last-meal`           | Last Meal               | viral    | 7   | 5            | grandmother       | Grandmother's Kitchen, Quiet Sushi Counter, Loud Trattoria, Picnic Blanket, Midnight Diner |

Each archetype carries: `id` (kebab-case), `label`, `emoji`, `tagline`
(1 sentence), `blindSpot` (1 sentence — the contrarian line), `scores`
object. Exactly one `default: true` per scoring spec.

## Verification results

DC-7 (tools.json registration — 14 checks):

```
JSON:{"story": "DC-7", "pass": 14, "fail": 0}
```

Was 4/14 (10 FAIL); now **14/14 PASS, 0 FAIL**.

DC-6 (per-quiz route checks — 8 checks × 10 quizzes = 80):

```
JSON:{"story": "DC-6", "pass": 80, "fail": 0}
```

Was 48/48 across 6 quizzes; now **80/80 PASS across 10 quizzes, 0 FAIL**.

`scripts/validate-tools-json.py`:

```
tools.json: OK
```

## Out-of-scope notes

- Challenge / Result card / Share card chrome (Stories 10.10 / 10.11)
  deferred per BMad cycle. Each quiz renders the minimal
  reveal panel (hero + trait bars + blind spot) and a single Reset
  button — no Share / Print buttons in MVP. The challenge module is
  declared in `tools.json` (so the `Every viral-category entry declares
  challenge` check passes) but the UI plumbing for challenge landing
  pages ships with Stories 10.12.
- Brownfield tools unaffected: the 50 pre-existing `tools[]` entries
  are unchanged. Only the `packs.discovery.entries[]` array grew.
- Gate scripts (`dc-6-quizzes.py`, `dc-7-tools-json.py`) auto-discover
  via `packs.discovery.entries[]` and `tools/packs/discovery/*/` —
  no hard-coded slug lists, so no script edits were required.

## Bugs surfaced and fixed during the followup

### 1. `data.json` paths missing the `tools/packs/discovery/` prefix

All 10 entries had `data: "./<slug>/data.json"` but the on-disk files
live at `tools/packs/discovery/<slug>/data.json`. Pre-existing bug from
the 6-quiz MVP that the DC-7 path-resolution check exposed. Fixed via
`services/_fix_data_paths.py` — rewrites all 10 paths to the canonical
form.

### 2. JSON unquoted keys in weights

Two of the new data.json files (`time-traveler-therapist`,
`dream-job`) used `craft: 6` (unquoted identifier) instead of
`"craft": 6` (quoted JSON string). DC-6 failed to parse. Fixed via
`scripts/_fix_quoted_keys.py` — regex-based quote-on-identity rule for
the affected files.

### 3. `catalog` module missing on `car-finder`

`car-finder` is the only utility-category entry. DC-7's
category-conditional check requires utility entries to declare
`catalog` in `modules[]`. Added the missing module declaration:
```json
{ "kind": "catalog", "config": { "domain": "car" } }
```

### 4. `_smoke_discovery_pack.js` stale assertion

The smoke harness had `list.length === 6` from the 6-quiz MVP. Updated
to `list.length === 10` with an inline story-10.7 follow-up note.

### 5. (Incidental) shell-drift-check drift on `index.html`

While verifying DC-7, `scripts/shell-drift-check.py` reported 1 drift
on `index.html`: the inline `<script id="ht-tools-json-inline">` block
contained real newlines in the recipe-scaler sample's `rs-recipe`
string, while `tools.json` carries JSON-canonical `\n` escape
sequences. The gate's `load_tools_json_inline` reconstruction produced
`\\n` (2-byte escape) where the file had `\n` (1-byte newline) — a
3-byte delta at byte 83916. Pre-existing bug, not introduced by the
4-quiz followup, but had to be resolved to land the followup cleanly.
Fixed via `scripts/_rewrite_inline_block.py` — replaced the in-file
block with the canonical `read_tools_json_inline()` output. After:
shell-drift-check exits 0 with "all pages in sync" (60 pages).

## Final gate status

| Gate | Status |
|---|---|
| `python scripts/dc/dc-7-tools-json.py` | 14/14 PASS |
| `python scripts/dc/dc-6-quizzes.py` | 80/80 PASS |
| `node scripts/_smoke_discovery_pack.js` | 25/25 PASS |
| `python scripts/shell-drift-check.py` | 0 drift, all pages in sync |
| `python scripts/dc/run-all.py` | 12/13 PASS (DC-10 known-deferred) |
| `python scripts/validate-tools-json.py` | OK |
| `python scripts/bundle-size-gate.py` | PASS (js=133,326/137,638, css=13,945/25,000) |
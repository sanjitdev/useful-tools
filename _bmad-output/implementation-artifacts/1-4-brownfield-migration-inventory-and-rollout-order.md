---
baseline_commit: 4e5baf76a5f31b8a55d3e1d8e6e16a5b3a3aef52
---

# Story 1.4: Brownfield Migration Inventory and Rollout Order

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer planning the staged rollout of 34 existing tools,
I want a generated inventory at `docs/tool-inventory.md` with the per-tool migration wave assignment,
so that Epic 2's work is enumerable and reversible per AD-15.

## Acceptance Criteria

1. **Given** the current `tools/<slug>/` directories and `assets/js/{utils,layout,theme}.js` files
   **When** the maintainer runs `make tool-inventory`
   **Then** `docs/tool-inventory.md` is regenerated listing every tool with its slug (which is the kebab-case directory basename), wave (1/2/3), ES5-vs-modern marker, sample-data presence, and contract-gap pass-count
2. **And** the file is committed to the repo and rendered in CI logs
3. **And** `tools.json` is initially populated with the wave-1 entries marked `ready: false`, `score: 0`
4. **And** deleting a tool entry + deleting its folder both succeed with no dangling links (CI greps)

## Tasks / Subtasks

- [ ] Task 1: Author `scripts/tool-inventory.py` (pure-stdlib Python; mirrors the shape of `validate-tools-json.py` / `rubric-lint.py` / `tool-contract-gate.py`)
  - [ ] Subtask 1.1: Imports only `argparse`, `json`, `re`, `sys`, `pathlib`, `typing`, `datetime`. No third-party installs. AD-1 parity.
  - [ ] Subtask 1.2: `find_repo_root` walks up from the script's directory until it sees `tools.schema.json` (single anchor — same walk-up pattern as the three existing scripts; copy verbatim from `scripts/tool-contract-gate.py` lines 65-80). The repo root is the directory containing `tools.schema.json`; `tools/` and `tools.json` are siblings of that file, so a single-anchor walk-up reaches the same root without enumerating three checks.
  - [ ] Subtask 1.3: `load_json` helper reads a JSON file with UTF-8 and returns the parsed object. Reuse the helper's name and behavior so a maintainer who reads any of the four scripts sees the same shape.
  - [ ] Subtask 1.4: `discover_tools()` walks `tools/<slug>/index.html` and returns one record per folder: `{ slug, has_index_html, js_files, css_files, has_sample_data, es5_or_modern, current_path }`. Slug is the directory basename; the path is `tools/<slug>/index.html`.
  - [ ] Subtask 1.5: `detect_modern_js(tool_dir)` returns `"modern"` if any `<slug>.js` under `tools/<slug>/` contains `const`/`let` declarations, arrow functions, or template literals; else `"es5"`. The regex is **whitelist-based** to avoid false positives on `var` keywords: `\b(?:const|let)\b` for block-scoped declarations, `=>` for arrow functions (not `>`, not `>=`), and `` `[^`]*\$\{ `` for template literals.
  - [ ] Subtask 1.6: `detect_sample_data(tool_dir)` returns `True` if the tool's `index.html` has any `<input value="...">` with a non-empty default value attribute (e.g. `<input value="56.40">`) OR the tool's JS contains a `DEFAULT_INPUT`-style constant, a literal that looks like a default value, or a button labelled "Try an example" / "Sample". **Exclude `<option value="...">` inside `<select>` elements** — those are enum choices, not pre-filled sample data, and would over-match every select-using tool (compound-interest, color-tools, password-strength, decision-wheel, countdown-to-date, etc.). Signal is "yes/no", not a count.
  - [ ] Subtask 1.7: `assign_wave(slug, tool_record)` returns one of `1`, `2`, `3` based on the slug list in Task 2 below. Slugs not on the list default to wave 3 (the catch-all migration bucket). Output a stable ordering: sort tools alphabetically within each wave so the Markdown table is deterministic across runs.
  - [ ] Subtask 1.8: `classify_status(tool_record)` returns one of `legacy`, `candidate`, or `ready` per AD-15. `legacy` = folder exists, no `tools.json` entry. `candidate` = entry exists in `tools.json` with `ready: false`. `ready` = entry exists with `ready: true`. This story's seed marks all wave-1 entries as `ready: false` (so they classify as `candidate`); the existing brownfield tools without any `tools.json` entry classify as `legacy` until Story 1.4 itself writes them.
  - [ ] Subtask 1.9: `contract_gap_checklist(slug)` returns the 10-criterion rubric checklist (per `docs/quality-rubric.md`) with a `[ ]` for each criterion and a per-row note when the script can detect the signal mechanically. Mechanical detection tags per `docs/quality-rubric.md#Mechanical-signal coverage matrix` and `scripts/rubric-lint.py` lines 535-537: criteria **3, 4, 5, 6, 7** are mechanical FAIL; criteria **1, 2, 8** are mechanical WARN (count 1 toward score, soft signal); criteria **9, 10** are MANUAL only. Tag each row accordingly: `[ ] (FAIL — mechanical)` / `[ ] (WARN — soft signal)` / `[ ] (manual)`.
  - [ ] Subtask 1.10: The script writes `docs/tool-inventory.md` with: frontmatter (`inventoryVersion: 1`, `schemaVersionRef: 1`, `updated: <ISO-8601>`), a one-paragraph summary, a summary table (one row per tool: slug · wave · status · ES5/modern · sample-data present? · contract-gap pass-count), a per-tool section with the 10-criterion checklist, and a wave-rollout reference (counts per wave). The slug column IS the kebab-case target slug — the directory basename; no separate "current slug" column (all 34 folders are already kebab-case, so the columns would be byte-identical for every row).

- [ ] Task 2: Define the wave-1 / wave-2 / wave-3 slug lists (in `scripts/tool-inventory.py` as a constant)
  - [ ] Subtask 2.1: **Wave 1 (3 tools):** `qr-code-generator`, `tip-calculator`, `json-formatter`. The epics call these out by name as the first promotion targets (Story 1.4 AC, Story 1.15 AC, Story 2.6 AC, Story 1.6). All three have sample-data in HTML default values or in JS; all three are ES5; all three are named as flagship tools across the PRD, UX, and architecture (QR for FR-10/11/19, tip for FR-21 + UJ-1, JSON for FR-5 + FR-21).
  - [ ] Subtask 2.2: **Wave 2 (15 tools):** the highest-traffic, lowest-migration-cost subset. Use the list below; it ranks by **(a)** presence in the epics' named tools and **(b)** overall pack coverage (Developer and Finance have the heaviest representation; Travel and Study are weighted into wave 3 where most of their tools land).
    ```
    age-calculator, bmi-calculator, percentage-calculator,    # Everyday numeric (Household + Finance)
    compound-interest, loan-calculator, decision-wheel,      # Finance-decision trio
    date-difference, countdown-to-date, unit-converter,      # Time / conversion trio
    password-strength, base64-codec, url-codec, regex-tester, # Developer quartet
    pomodoro-timer, stopwatch                                # Time-management pair (Study)
    ```
  - [ ] Subtask 2.3: **Wave 3 (16 tools, every remaining):** the rest of the 34 tools in alphabetical order. As of the inventory, that's `animal-race, bd-tax-calculator, calorie-estimator, color-tools, eisenhower-matrix, gpa-calculator, grade-calculator, habit-tracker, lifespan-simulator, lorem-ipsum, markdown-previewer, pros-cons, random-tools, space-calculator, word-counter, world-clock` (16 entries; the constant must list exactly the slugs not in waves 1 or 2, recomputed from the live `tools/` directory at run time so adding a new folder auto-buckets into wave 3 — see Subtask 2.4).
  - [ ] Subtask 2.4: At run time, the script computes `wave_3 = sorted(set(all_slugs) - set(wave_1) - set(wave_2))`. The literal `WAVE_1` and `WAVE_2` lists are the only hard-coded source. If a maintainer adds a 34th tool folder without a wave assignment, the script places it in wave 3 and emits a one-line `WARNING: <slug> not in WAVE_1 or WAVE_2; defaulting to wave 3` to stderr. **No silent bucketing.**
  - [ ] Subtask 2.5: The script's output `docs/tool-inventory.md` includes a `## Wave 1 (3)` / `## Wave 2 (15)` / `## Wave 3 (N)` section with the slug list under each heading as a bullet list, so a reviewer can audit the bucket assignment in one screen.

- [ ] Task 3: Seed `tools.json` with the wave-1 entries
  - [ ] Subtask 3.1: Add three entries to `tools.json`'s `tools` array, one per wave-1 slug. Each entry has `ready: false`, `score: 0`, and the **minimum** required fields to satisfy `tools.schema.json` (Story 1.1): `id`, `slug`, `title`, `description`, `category`, `pack` (array with one of the five pack slugs per the epics' pack taxonomy), `icon` (an inline SVG data-URL is fine — re-use the favicon pattern from the tool's own `index.html`), `keywords` (3–5 tokens), `last-updated` (the same value as the `generated` timestamp on this PR), `urlState: { default: {}, encode: [], decode: [] }`, `shortcuts: []`, `history-keys: ["<primary-input-id>"]` (the schema enforces `minItems: 1` — empty arrays fail `make validate`; use the tool's primary input id as a placeholder that Story 1.13 will replace with the real list), `view-source: { enabled: true, path: "tools/<slug>/index.html" }`, `embed-snippet: { enabled: true, "badge-default": false, "min-width": 240, "min-height": 240 }`, `search-priority: 5`, `legacy: true`, `migrated: false`. **The story does not flip `ready` to `true` for any tool** — that's Epic 2's job.
  - [ ] Subtask 3.2: Per-tool pack assignment (from the project-context.md table and the epics' pack taxonomy):
    - `qr-code-generator` → `pack: ["developer"]` (Story 1.15 names it as the flagship; PRD §3 names it as the embed seed for FR-19)
    - `tip-calculator` → `pack: ["travel"]` (the epics and project-context both put it in Travel; UJ-1 "Priya splits a bill" uses it)
    - `json-formatter` → `pack: ["developer"]` (FR-5 + FR-21 list it as a Developer tool)
  - [ ] Subtask 3.3: The `generated` field is set to the run time of `make tool-inventory` (ISO-8601). Do not back-date; do not use a placeholder.
  - [ ] Subtask 3.4: `tools.json` must still validate: `make validate` exits 0 after the script writes the file. Story 1.1's `validate-tools-json.py` is the source of truth for shape.
  - [ ] Subtask 3.5: `make gate` (Story 1.3) must still exit 0 after the seed. The three new entries have `score: 0` (which is `< 8`); the script also writes a `score-waiver` object for each: `{ reason: "Brownfield migration; scheduled for wave-1 promotion in Story 2.6", since-release: "<current tools.json[releaseVersion]>", reviewer: "sanjit", expires-after-releases: 2 }`. Per `docs/ci-gate.md#Waiver expiry` and `scripts/tool-contract-gate.py#_waiver_release_distance`, with same-version seeding (`since-release == current releaseVersion`) the gate computes `distance = 1`, and the waiver is valid for `expires-after-releases - distance = 2 - 1 = 1` more release (not "two releases of validity" — the FR-2 "two releases" rule is the coverage span: the granting release plus the next; see `docs/ci-gate.md` Worked Example). The gate classifies these as `WAIVER` and exits 0. **Do not** skip the waiver — the gate will FAIL the entry without one. (Confirm with the gate's exit-1 case before declaring done; specifically synthesize a no-waiver sub-test: temporarily remove the `score-waiver` from one entry, run `make gate`, assert exit 1 and `FAIL` row, then restore.)
  - [ ] Subtask 3.6: The `score-waiver.reviewer` value is the same string the gate prints in the WAIVER row. Match the case in `.bmad/bmm/config.yaml` (project-context says reviewer names are surfaced on `/quality`; the gate does not validate them, but the maintainer's `/quality` view in Story 2.11 will). Use `"sanjit"` (lowercase) per the user_name config.

- [ ] Task 4: Add `tool-inventory` Makefile target and CI surface
  - [ ] Subtask 4.1: Add `tool-inventory` target to `Makefile` that runs the script and writes `docs/tool-inventory.md`. Use the same `$(PYTHON)` resolution; append to `.PHONY`. Update `make help` to list the new target.
  - [ ] Subtask 4.2: Add `tool-inventory-check` target that runs the script in `--check` mode (Subtask 5.5) and exits non-zero if the on-disk `docs/tool-inventory.md` is stale. This is the CI gate.
  - [ ] Subtask 4.3: Append `tool-inventory` and `tool-inventory-check` to the existing `ci` chain. Order: `validate → rubric-all → tool-inventory → gate` (gate is last because it depends on the waiver-bearing `tools.json` shape).
  - [ ] Subtask 4.4: Add a **new** GitHub Actions job (or extend the existing workflow) that runs `make tool-inventory-check` on every PR that touches `tools/**`, `tools.json`, `scripts/tool-inventory.py`, or `Makefile`. The job reuses the existing `actions/checkout` and `actions/setup-python` steps; no new actions to pin. Job name: `Tool Inventory`. The existing `Tool Contract Gate` job keeps its own trigger paths; the new job's trigger paths are a strict subset (no `docs/quality-rubric.md`, no `tools.schema.json`).
  - [ ] Subtask 4.5: The new CI job's `paths` filter mirrors the maintainer's `git add` boundary: the inventory must re-run when a tool folder changes, but **not** when only `docs/` prose changes (a doc edit cannot silently re-classify a tool). Use the path filter:
    ```yaml
    paths:
      - "tools/**"
      - "tools.json"
      - "scripts/tool-inventory.py"
      - "scripts/tool-contract-gate.py"
      - "Makefile"
      - ".github/workflows/tool-contract-gate.yml"
    ```
    `docs/**` is intentionally excluded — the inventory doc is generated, not authored, and prose edits to it should not retrigger the regeneration CI.

- [ ] Task 5: Implement the dangling-link grep (AC #4)
  - [ ] Subtask 5.1: Add a `dangling-links` target to the Makefile that runs the script in `--check-links` mode. The script walks every entry in `tools.json` and asserts the entry's `slug` resolves to `tools/<slug>/index.html`. Then it walks every `tools/<slug>/index.html` and asserts there is a corresponding entry in `tools.json` (i.e. the inverse). Any mismatch exits non-zero and names the missing side.
  - [ ] Subtask 5.2: The same target greps `index.html` (the home grid) and the per-tool pages for stale references to a removed slug. The grep pattern is `<a [^>]*href="[^"]*tools/<slug>/"` for each known slug; a hit on a non-existent slug fails. This catches hand-edited home-grid links that drift from `tools.json`.
  - [ ] Subtask 5.3: Wire `make dangling-links` into the same CI job's `paths` filter (or a separate `Tool Inventory` job step). The output is a list of `(slug, kind, side)` triples — one per broken link.
  - [ ] Subtask 5.4: The grep is a `make`-level target, not a Python one (faster to read; the maintainer can hand-edit the pattern). Use `git grep` if available (skips the index update), fall back to `grep -R` (the script's runtime is short; this is not a hot path).
  - [ ] Subtask 5.5: The `--check` mode (used by Task 4.2) compares the on-disk `docs/tool-inventory.md` against a freshly-generated version. If the two differ, the target exits 1 with a diff hint. This is the "the file is committed to the repo" enforcement — the maintainer runs `make tool-inventory`, commits the result, and CI rejects any PR that ships a stale version.

- [ ] Task 6: Verification (matches the Story 1.3 precedent of "no automated test harness in scope; that lives in Story 1.13's audit scaffold")
  - [ ] Subtask 6.1: `make tool-inventory` runs end-to-end with no errors; writes `docs/tool-inventory.md` (~200 lines for 34 tools, deterministic byte-for-byte across two consecutive runs).
  - [ ] Subtask 6.2: `make tool-inventory-check` exits 0 after a successful `tool-inventory`; exits 1 after manually editing `docs/tool-inventory.md` to introduce a one-character drift.
  - [ ] Subtask 6.3: `make ci` (full chain: `validate → rubric-all → tool-inventory → gate`) exits 0. `make dangling-links` exits 0.
  - [ ] Subtask 6.4: Synthesize a violation: delete `tools/qr-code-generator/` and re-run `make dangling-links` → exit 1, named `qr-code-generator` in the report. Restore the folder.
  - [ ] Subtask 6.5: Synthesize a violation: delete the `qr-code-generator` entry from `tools.json` and re-run `make dangling-links` → exit 1, named `qr-code-generator`. Restore the entry.
  - [ ] Subtask 6.6: `py_compile scripts/tool-inventory.py` is clean. The GitHub Actions workflow YAML parses via `yaml.safe_load` (maintainer's local check; not a runtime dep).
  - [ ] Subtask 6.7: Manually re-read the seeded `tools.json` and confirm: (a) every entry has the 17 required keys per `tools.schema.json` (`id`, `slug`, `title`, `description`, `category`, `pack`, `icon`, `keywords`, `last-updated`, `ready`, `score`, `urlState`, `shortcuts`, `history-keys`, `view-source`, `embed-snippet`, `search-priority`), (b) `score: 0` on each, (c) `ready: false` on each, (d) `score-waiver` is present with all four required fields, (e) `pack` is a non-empty array of valid pack slugs.
- [ ] Subtask 6.8: Run `make gate`; capture stdout; assert (i) exit 0, AND (ii) the `WAIVER` row contains all three wave-1 slugs (`qr-code-generator`, `tip-calculator`, `json-formatter`). A waiver with a wrong reviewer name, an `expires-after-releases` value the gate can't parse, or a missing `since-release` would still print "WAIVER valid for 0 more release(s)" but exit 1 — Subtask 6.8 catches both the row classification AND the exit code. Use `make gate | grep -c WAIVER` returning `>= 3` as one assertion, plus a substring match on each slug in the WAIVER section.
- [ ] Subtask 6.9: Parse the YAML frontmatter of the generated `docs/tool-inventory.md`; assert all three keys are present (`inventoryVersion: 1`, `schemaVersionRef: 1`, `updated: <ISO-8601>`) and `updated` matches `^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$`. A missing key fails the assertion even if the rest of the file looks correct; Story 2.11 (Brownfield Inventory View in `/quality`) reads these fields directly, so a malformed frontmatter breaks forward compatibility.
- [ ] Subtask 6.10: Synthesize a home-grid stale-link violation. Hand-edit `index.html` (or the corresponding per-tool page) to insert `<a href="tools/deleted-tool-stub/">link</a>` for a slug that does not exist in `tools/`. Run `make dangling-links`; assert exit 1 and that `deleted-tool-stub` is named in the report. Restore `index.html`. This covers the home-grid stale-link side of AC #4 (Subtask 5.2) which Subtasks 6.4 and 6.5 do not exercise.

### Review Findings (2026-08-01)

#### Patch — BLOCKER (will fail at PR time or contradict a source-of-truth)

- [x] [Review][Patch] `history-keys: []` violates schema `minItems: 1` — Subtask 3.1 (line 55): `tools.schema.json` line 207 enforces `minItems: 1` on `history-keys`. Empty arrays fail `make validate`, contradicting Subtask 3.4. Replace `history-keys: []` with a non-empty placeholder (e.g., the wave-1 tool's primary input id).
- [x] [Review][Patch] Required field count is 17, not 14 — Subtask 6.7 (line 97) and References (line 237): the schema's `tool-entry.required` lists 17 fields (id, slug, title, description, category, pack, icon, keywords, last-updated, ready, score, urlState, shortcuts, history-keys, view-source, embed-snippet, search-priority). Change `14` → `17` and enumerate all 17 in both places.
- [x] [Review][Patch] Tool count is 34, not 33 — Story statement (line 19), Subtask 2.3 (line 50), Subtask 6.1 (line 91), References (line 246): live `tools/` directory has 34 folders. Wave math 3+15+16=34. Change `33` → `34` in all four locations; fix Subtask 2.3's title from "Wave 3 (15 tools, every remaining)" to "Wave 3 (16 tools, every remaining)".
- [x] [Review][Patch] Subtask 1.9 misclassifies criteria 1, 2, 8 as "manual" — Subtask 1.9 (line 37): per `quality-rubric.md` Mechanical-signal coverage matrix and `rubric-lint.py` lines 535-537, criteria 1, 2, 8 are mechanical WARN (count 1 toward score), not MANUAL. Only 9, 10 are MANUAL. Change `[ ] (manual)` for criteria 1, 2, 8 to `[ ] (WARN — soft signal)` and reserve `(manual)` for criteria 9, 10.
- [x] [Review][Patch] Subtask 4.4 vs 4.5 contradict on `tools.schema.json` — Subtask 4.4 (line 69) says the new job's trigger paths are a strict subset of the existing `gate` job's paths (no `docs/quality-rubric.md`, no `tools.schema.json`), but Subtask 4.5's YAML literal (line 75) lists `tools.schema.json`. Remove `tools.schema.json` from Subtask 4.5 to match the stated design intent.
- [x] [Review][Patch] No subtask verifies gate-classifies-WAIVER — Subtask 3.5 (line 62): the spec asserts the gate classifies wave-1 entries as WAIVER, but Task 6 only checks `make ci` exit 0. Add Subtask 6.8: capture `make gate` stdout; assert `WAIVER` row contains `qr-code-generator`, `tip-calculator`, and `json-formatter`.
- [x] [Review][Patch] Wave-2 "every pack ≥ 3 tools" claim is false — Subtask 2.2 (line 42). Verified wave-2 pack distribution: Developer=4, Finance=3, Household=4, Travel=2, Study=2. Two packs have only 2 tools each. Drop the false claim and the "1.5× the size of wave 2" justification that depends on it.

#### Patch — HIGH (reviewer-confusing; will not block PR but should be fixed)

- [x] [Review][Patch] AC #1's "current slug" column is redundant with "kebab-case target slug" — AC #1 (line 21): all 34 repo folders are already kebab-case; the two columns will be byte-identical for every tool. Remove "current slug" from AC #1's column list and Subtask 1.10's table spec (the directory basename IS the target slug).
- [x] [Review][Patch] No frontmatter assertions in Task 6 — Subtask 1.10 (line 38) specifies `inventoryVersion: 1, `schemaVersionRef: 1`, `updated: <ISO-8601>` but no subtask verifies them. Add Subtask 6.9: parse the YAML frontmatter of the generated `docs/tool-inventory.md`; assert all three keys present and `updated` is ISO-8601.
- [x] [Review][Patch] No home-grid stale-link verification (AC #4) — Subtask 5.2 (line 85) covers `index.html` greps but Task 6 has no synthesized violation. Add Subtask 6.10: hand-edit `index.html` to reference a known-removed slug; assert `make dangling-links` exits 1 and names that slug.
- [x] [Review][Patch] Score-waiver distance math narrative drift — Subtask 3.5 (line 62) claims `expires-after-releases: 2` "covers the current release plus the next"; with same-version seeding (`since-release == current releaseVersion`), `_waiver_release_distance` (tool-contract-gate.py line 178-179) computes distance=1, valid for 1 more release. Cite `docs/ci-gate.md` worked example verbatim; do not paraphrase "two releases" as "two release cycles covered".
- [x] [Review][Patch] `find_repo_root` anchor mismatch (Subtask 1.2) — Subtask 1.2 (line 30) says walk up until seeing `tools/`, `tools.json`, **and** `tools.schema.json`. The three existing scripts (`tool-contract-gate.py` line 65, `rubric-lint.py` line 47, `validate-tools-json.py`) walk up until they see only `tools.schema.json`. Change Subtask 1.2 to "walks up until it sees `tools.schema.json` (single anchor, same as the three existing scripts; copy verbatim from `tool-contract-gate.py`)."
- [x] [Review][Patch] Sample-data `<option value=…>` over-match — Subtask 1.6 (line 34) first signal "any element with a non-empty default `value=`" matches every `<option value="...">` in any `<select>`-using tool. Narrow the signal to `<input value="...">` only, or scope it to value strings that look like sample data (non-empty, not a 1-character enum identifier like `L`, `M`, `Q`, `H`).

#### Defer (pre-existing, not caused by this change)

- [x] [Review][Defer] Animal-race "ES2018-marked" narrative unsupported by the spec's own detector [1-4-brownfield-migration-inventory-and-rollout-order.md:219] — deferred, pre-existing. `animal-race.js` is pure ES5; the spec's Subtask 1.5 detector will (correctly) classify it as `es5`. The "only ES2018-marked tool" claim should be removed in a future story (not in 1.4).
- [x] [Review][Defer] Project-context says 33 tools; repo has 34 [1-4-brownfield-migration-inventory-and-rollout-order.md:246] — deferred, pre-existing. Project-context drift is owned by a future housekeeping story.
- [x] [Review][Defer] `make ci` order: `tool-inventory` writes `tools.json`'s `generated` field mid-chain [1-4-brownfield-migration-inventory-and-rollout-order.md:68] — deferred, pre-existing. CI timing assertions are owned by Story 1.13 (audit scaffold).
- [x] [Review][Defer] `assets/js/qrcode.js` allowlist implementation [1-4-brownfield-migration-inventory-and-rollout-order.md:134] — deferred, pre-existing. Already documented in Story 1.2's verification ledger.

## Dev Notes

### Architecture constraints (binding)

- **AD-1 — Zero runtime libraries:** `scripts/tool-inventory.py` uses only Python stdlib (`argparse`, `json`, `re`, `sys`, `pathlib`, `typing`, `datetime`). No `pip install`. The three existing scripts (`validate-tools-json.py`, `rubric-lint.py`, `tool-contract-gate.py`) are the model; copy the `find_repo_root` / `load_json` shape verbatim.
- **AD-2 — Tool Contract rule:** the inventory never flips a tool to `ready: true`. Story 1.4 is the seed (`ready: false`, `score: 0`); Epic 2 promotes tools to `ready: true` via Stories 2.6 / 2.7 / 2.8. The inventory's `## Contract-gap checklist` surfaces the 10-criterion pass-count per tool as a number, not a boolean — Story 1.13's audit scaffold will turn it into a published score.
- **AD-3 — Site Data is the single source of truth for discovery:** the inventory reads `tools.json` and walks `tools/<slug>/`. It does not read `index.html`'s home-grid markup (the brownfield home grid is legacy; Story 1.9 replaces it with the JSON-driven grid). The inventory is **generated**, not authored.
- **AD-4 — Shell owns global concerns; this story creates data + tooling only.** No `assets/js/*` changes. No CSS changes. No `index.html` changes (the home grid's brownfield markup survives until Story 1.9).
- **AD-12 — No SSR, no backend, no build step:** the script is plain Python invoked from the Makefile. The GitHub Actions workflow is hand-authored YAML.
- **AD-15 — Brownfield migration is staged and reversible:** every entry seeded by this story is `legacy: true` and `migrated: false` per the schema. The wave-1 entry's `score-waiver` carries an `expires-after-releases: 2` so the gate classifies it as `WAIVER` for the current release plus the next; the waiver is the escape hatch (per Story 1.3's design).
- **AD-15 — `docs/tool-inventory.md` is the contract:** "CI fails if a tool folder exists without an entry in `tool-inventory.md`" (architecture spine, line 200). Story 1.4 satisfies this with `make tool-inventory-check` + `make dangling-links` (Tasks 4.2 and 5). The CI job rejects any PR that ships a stale or incomplete inventory.
- **PRD FR-3 — Per-Tool Quality Audit:** "Every existing tool ships with a one-time audit result (pass/fail per criterion) and a remediation list." Story 1.4 ships the **checklist scaffold** for this; Story 1.13 turns it into a runnable audit. The 10-criterion pass-count column is the forward-compatible handoff.
- **PRD FR-4 — Site Data Schema:** the three wave-1 entries are the first real data the schema has ever validated against. The Story 1.1 schema's `additionalProperties: false` is the contract: every field not on the list is a hard error. Double-check the per-tool entries against `tools.schema.json` (already read in Story 1.1) before declaring done.

### Project Structure Notes

- **New files (this story creates all of them):**
  - `scripts/tool-inventory.py` — pure-stdlib Python inventory generator
  - `docs/tool-inventory.md` — generated Markdown inventory (committed)
- **Modified files:**
  - `Makefile` — adds `tool-inventory`, `tool-inventory-check`, `dangling-links` targets; extends `ci` chain; updates `help`; appends to `.PHONY`
  - `tools.json` — adds 3 wave-1 entries with `ready: false`, `score: 0`, full `score-waiver`
  - `.github/workflows/tool-contract-gate.yml` — adds a new job `tool-inventory` that runs the inventory check and the dangling-links check on PRs that touch gate-affecting paths
- **No existing files are removed.** The four scripts (`validate-tools-json.py`, `rubric-lint.py`, `tool-contract-gate.py`, the new `tool-inventory.py`) are independent; each reads `tools.json` and applies its own check. The maintainer who reads one reads all four.
- **The home grid (`index.html`) is untouched** — Story 1.9 owns the home-grid migration. This story only seeds `tools.json` with the 3 wave-1 entries; the home grid continues to render via its existing inline markup until Story 1.9 lands.

### Tools to use / libraries

- **Python (stdlib only):** `argparse`, `json`, `re`, `sys`, `pathlib`, `typing`, `datetime`. No third-party installs.
- **Make / POSIX shell:** standard `find` / `grep` for the dangling-links target. `git grep` is preferred when the index is current (one fewer filesystem walk). The pattern is `<a [^>]*href="[^"]*tools/<slug>/"`.
- **GitHub Actions:** reuses the SHA-pinned `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` and `actions/setup-python@0b93645e9fea7318ecaed2b359559ac225c90a2b` from Story 1.3. No new actions to pin; the new job references the same action versions as the existing one.
- **No `package.json`, no `node_modules/`, no `pip install`, no `npm install`.** AD-1 forbids it.

### Existing code being modified

**`Makefile`** (current state after Story 1.3):
- `.PHONY: validate validate-tools-json validate-schema rubric-list rubric-all help rubric-% gate gate-list ci`
- Targets: `validate` (alias), `validate-tools-json` (Story 1.1), `validate-schema` (Story 1.1), `rubric-%` / `rubric-list` / `rubric-all` (Story 1.2), `gate` / `gate-list` (Story 1.3), `ci` (Story 1.3), `help`.
- `PYTHON ?= $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)`

**What's changing:**
- Append three pattern targets: `tool-inventory`, `tool-inventory-check`, `dangling-links`.
- Update the `ci` chain: `ci: validate rubric-all tool-inventory gate` (the inventory regenerates the doc, then the gate runs against the freshly-updated `tools.json`).
- Update the `help` target's echo block to list the new targets.
- Add to `.PHONY`.
- **Preserve:** every existing target's recipe, the `PYTHON` resolution, the existing help text.

**`tools.json`** (current state after Story 1.1 + 1.3):
- Top-level: `{ $schema, schemaVersion, releaseVersion, generated, tools: [] }`. Empty `tools` array.
- `releaseVersion: "0.0.0"` (set in Story 1.1).

**What's changing:**
- Append three entries to the `tools` array (one per wave-1 slug). The top-level shape is unchanged.
- `generated` is updated to the run time of `make tool-inventory`. Do not back-date.

**`.github/workflows/tool-contract-gate.yml`** (current state after Story 1.3):
- Single `gate` job that runs `make validate && make rubric-all && make gate`.
- Triggers on `pull_request` and `push to main` for the 10 gate-affecting paths.

**What's changing:**
- Add a new `tool-inventory` job that runs `make tool-inventory-check && make dangling-links`.
- The new job's `paths` filter is a strict subset of the existing `gate` job's filter (no `docs/quality-rubric.md`, no `docs/ci-gate.md`).
- The new job's permissions, concurrency group, and timeout mirror the existing job's (`contents: read`, `tool-contract-gate`, 10 minutes).

**`scripts/validate-tools-json.py`** (Story 1.1, do not touch): the inventory reuses its `find_repo_root` / `load_json` shape but does not import from it. The four scripts share conventions, not code.

**`scripts/rubric-lint.py`** (Story 1.2, do not touch): the inventory's `contract_gap_checklist` mirrors the rubric's 10 criteria and the linter's detection mapping (criterion 3, 4, 5, 6, 7 are mechanical; 1, 2, 8, 9, 10 are MANUAL/WARN per `docs/quality-rubric.md`). The linter is not imported; the inventory's pass-count column is a forward-compatible handoff to Story 1.13's audit scaffold.

**`scripts/tool-contract-gate.py`** (Story 1.3, do not touch): the inventory seeds `score-waiver` objects on the wave-1 entries so the gate classifies them as `WAIVER` (per the FR-2 "two releases" rule). The waiver is the bridge between Story 1.4 (seed) and Story 2.6 (promote). The gate does not need to be modified.

**`tools.schema.json`** (Story 1.1, do not touch): the inventory's three entries must validate against the existing schema. If a field is missing, the validator fails the PR. Do not add new fields to the schema in this story.

**`docs/quality-rubric.md`** (Story 1.2, do not touch): the 10-criterion checklist the inventory emits mirrors this doc's table. If the rubric adds a criterion, the inventory's pass-count column needs to be updated in a future story (not in this one).

### Testing standards

This story follows the Story 1.3 precedent: no automated test harness in scope. Correctness is proved by Task 6's manual verification:

- `make tool-inventory` is idempotent: two consecutive runs produce byte-identical `docs/tool-inventory.md` (modulo the `updated` field in frontmatter).
- `make tool-inventory-check` exits 0 after a fresh `make tool-inventory`; exits 1 after a one-byte edit to the doc.
- `make ci` exits 0 against the seeded `tools.json`.
- `make dangling-links` exits 0 against the seeded state; exits 1 after deleting a tool folder or an entry.

The Playwright / axe-core / headless-browser harness that will turn these manual checks into CI-asserted tests lives in Story 1.13 (audit scaffold) and Story 2.12 (cross-cutting regression sweep). This story's CI is the application-layer check (script exit codes + grep), not a browser-driven test.

### Files to create / modify

| File | Purpose | Reference |
|---|---|---|
| `scripts/tool-inventory.py` | Pure-stdlib Python inventory generator | AC #1, AD-15 |
| `docs/tool-inventory.md` | Generated Markdown inventory (committed) | AC #1, AC #2 |
| `tools.json` (modified) | Adds 3 wave-1 entries with `ready: false`, `score: 0`, `score-waiver` | AC #3, AD-2, AD-3 |
| `Makefile` (modified) | Adds `tool-inventory`, `tool-inventory-check`, `dangling-links` targets; extends `ci`; updates `help` | AC #1, AC #4 |
| `.github/workflows/tool-contract-gate.yml` (modified) | Adds `tool-inventory` job that runs inventory check + dangling-links check | AC #2, AC #4, AD-2 |

### Dependencies on other stories

- **Story 1.1 (Greenfield Tool Contract Schema) — DONE:** provides `tools.json` and `tools.schema.json`. The three wave-1 entries must validate against the existing schema; no schema changes in this story.
- **Story 1.2 (Rubric as Test Cases) — DONE:** provides `docs/quality-rubric.md` and `scripts/rubric-lint.py`. The inventory's 10-criterion checklist mirrors the rubric doc; the detection mapping (criteria 3, 4, 5, 6, 7 mechanical) follows the linter.
- **Story 1.3 (Tool Contract CI Gate) — DONE:** provides the GitHub Actions workflow, `scripts/tool-contract-gate.py`, and the FR-2 "two releases" waiver rule. The wave-1 entries' `score-waiver` objects exist to make the gate classify them as `WAIVER` (exit 0) instead of `FAIL` (exit 1). The new `tool-inventory` job reuses the existing `actions/*` SHAs.
- **Story 1.5–1.10 (Shell bootstrap):** the inventory seeds the data, but the Shell layer (header, footer, theme tokens, settings modal, home grid) lands in subsequent stories. The inventory doc is the contract between Story 1.4 (this) and Stories 1.9 (home grid), 1.13 (audit), 1.15 (first promotion), 2.6 (wave-1 promote), 2.7 (wave-2), 2.8 (wave-3).
- **Story 1.13 (Audit Scaffold):** the inventory's `## Contract-gap checklist` and the `pass-count` column are the forward-compatible handoff. Story 1.13 will run the linter on every entry, write the audit result to `docs/quality-audit.md`, and provide a per-tool pass/fail.
- **Story 2.6–2.8 (Promote waves):** the inventory's wave assignment is the source of truth for which tools land in which promotion story. Wave 1 → Story 2.6 (3 tools), wave 2 → Story 2.7 (15 tools), wave 3 → Story 2.8 (16 tools). The constant lists in `scripts/tool-inventory.py` are the wave definition.
- **Story 2.11 (Brownfield Inventory View in /quality):** renders the inventory + audit status in one table on `/quality`. Reads `docs/quality-audit.md` (Story 1.13), which reads `docs/tool-inventory.md` (this story). The chain is: this story → Story 1.13 → Story 2.11.

### Common LLM-mistake prevention

- **Do NOT** add `pip install` / `npm install`. AD-1 forbids it. The script is pure-stdlib Python.
- **Do NOT** flip any tool to `ready: true`. This story seeds `ready: false` on the three wave-1 entries. Promotion is Epic 2's job (Stories 2.6, 2.7, 2.8).
- **Do NOT** skip the `score-waiver` on the wave-1 entries. The gate will FAIL them otherwise (per Story 1.3's truth table: `score < 8` AND no waiver → `FAIL` → exit 1). The waiver is the bridge.
- **Do NOT** import from `validate-tools-json.py` / `rubric-lint.py` / `tool-contract-gate.py`. The inventory is a fourth script; it shares the `find_repo_root` / `load_json` shape but is independent. Copy the helpers verbatim, do not import.
- **Do NOT** use `import yaml` at runtime. The workflow YAML parse is a maintainer's local check; the script doesn't parse YAML.
- **Do NOT** modify `tools.schema.json` to add a new field. The inventory's entries validate against the existing schema; if a field is missing, the validator fails the PR. If a new field is needed (e.g., a wave-assignment column), that's a future story's task — for this story, the wave lives in the script constant and the inventory doc.
- **Do NOT** write inline `Story 1.X` references in the script's comments. The comment-style rule (project-context) says explain why, not what. Reference `docs/quality-rubric.md#Scoring & Gate` and `tools.schema.json#score-waiver` instead of "Story 1.2 says…".
- **Do NOT** use `actions/checkout@main` or `actions/setup-python@main` — pin to commit SHAs (per Story 1.3's `actions/*` SHAs). Mutable tags are a supply-chain risk. **The new job reuses the existing SHAs**; do not introduce new pinned actions.
- **Do NOT** grant the new job write permissions. `permissions: contents: read` only. The job is read-only against the repo.
- **Do NOT** include `docs/**` in the new job's `paths` filter. The inventory doc is generated; a prose edit to it should not retrigger the regeneration CI. The inventory regenerates when a tool folder, the script, the schema, or the gate script changes — not when the doc itself is edited (the doc is the artifact, not the source).
- **Do NOT** hand-author `docs/tool-inventory.md`. The file is generated by the script; commit the script's output, not a manually-edited copy. The `--check` mode (Subtask 5.5) catches drift.
- **Do NOT** use `bash` in the new CI job if POSIX is unavailable. The dangling-links grep falls back to a Python walk if `grep` is missing; the script's `find_repo_root` already handles Windows. The CI runs on `ubuntu-latest`, so POSIX is available; but the script must still work locally on Windows (the maintainer's `make` environment).
- **Do NOT** put more than 3 tools in wave 1 or 15 tools in wave 2. The wave sizes are load-bearing: Story 2.6 is sized to fit in one PR (per the `make promote-wave-1` target), Story 2.7's 15 tools fit in a single sprint, Story 2.8's 16 tools fit in a single sprint. Exceeding 3 in wave 1 exceeds the PR size; exceeding 15 in wave 2 exceeds the PR size; exceeding 16 in wave 3 exceeds the sprint size.
- **Do NOT** use animal-race as a wave-1 tool. `animal-race` is the only ES2018-marked tool in the inventory (every other tool is ES5). It is a signal of "already touched by a maintainer" — its modernization is informational, not a wave-1 promotion trigger. The wave-1 tools are the three named in the epics: `qr-code-generator`, `tip-calculator`, `json-formatter`. The wave assignment is contractually fixed by the epics.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.4` — full AC and context, including the 4-bullet AC (make tool-inventory regenerates doc, file committed, tools.json seeded with wave-1, deleting a tool entry + folder both succeed)]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.15` — names the QR generator as the first promotion (wave-1 confirmation)]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-2.6` — wave-1 promotion is "3 tools" (e.g., QR generator, tip calculator, JSON formatter); the wave-1 slug list is locked here]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-2.7` — wave-2 is 15 tools; the inventory is the source of truth for which tools land in this story]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-2.8` — wave-3 is 16 tools; same handoff as wave 2]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.13` — audit scaffold consumes the inventory's checklist; the contract-gap column is the handoff]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-3` — Per-Tool Quality Audit (every existing tool ships with a one-time audit result; Story 1.4 ships the checklist scaffold; Story 1.13 runs the audit)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-4` — Site Data Schema (the 3 wave-1 entries validate against `tools.schema.json`)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-20` — Pack Decomposition (per-tool pack tag is part of the seed)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-21` — 12–15 new tools (Epic 6; out of scope for Story 1.4)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-15` — Brownfield migration staged and reversible; the inventory is the contract; CI fails if a tool folder exists without an entry]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-2` — `ready=true ⇔ score≥8 ∧ no expired waiver`; the wave-1 entries carry a `score-waiver` to satisfy the gate until Story 2.6]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-3` — Site Data single source of truth; the inventory is generated, not authored]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#Deferred-Tests` — Story 1.13 owns the test harness; Story 1.4 ships application-layer checks (script exit codes + grep) per the Story 1.3 precedent]
- [Source: `tools.schema.json#tool-entry` — the 17 required fields per tool entry (id, slug, title, description, category, pack, icon, keywords, last-updated, ready, score, urlState, shortcuts, history-keys, view-source, embed-snippet, search-priority); 3 wave-1 entries must validate against this]
- [Source: `tools.schema.json#score-waiver` — `{ reason, since-release, reviewer, expires-after-releases }`; the wave-1 entries carry this object so the gate classifies them as `WAIVER`]
- [Source: `docs/quality-rubric.md#Scoring & Gate` — the 10-criterion checklist the inventory's `contract_gap_checklist` mirrors; criteria 3, 4, 5, 6, 7 are mechanical FAIL, criteria 1, 2, 8 are mechanical WARN, criteria 9, 10 are MANUAL only]
- [Source: `docs/ci-gate.md` — the gate's contract and the FR-2 "two releases" waiver rule; the wave-1 entries' `expires-after-releases: 2` covers the current release plus the next]
- [Source: `scripts/validate-tools-json.py` — pattern for `find_repo_root` / `load_json` walk-up; copy verbatim into the new script]
- [Source: `scripts/rubric-lint.py` — pattern for the 10-criterion detection mapping (criterion 3 = offline-ready, 4 = URL state, 5 = print, 6 = sample data, 7 = history; the linter's regex is the reference for the inventory's mechanical signals)]
- [Source: `scripts/tool-contract-gate.py` — pattern for the `--list` / `--check` style invocation; the inventory's `--check` mode (Subtask 5.5) is the same shape]
- [Source: `.github/workflows/tool-contract-gate.yml` — the SHA-pinned `actions/*` references; the new job reuses them]
- [Source: `Makefile` — pattern for `validate-*` / `rubric-*` / `gate` / `ci` targets; preserve the `PYTHON ?= python3 || python` resolution and the `help` format]
- [Source: `project-context.md` — brownfield substrate (34 tools under `tools/<slug>/` — `project-context.md` itself says "33" but the live directory has 34; the inventory is generated from the filesystem, which is the source of truth); the tool inventory table in §2 is the source for the wave-1 / wave-2 / wave-3 slug lists]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#Capability-→-Architecture-Map` — Brownfield Migration (AD-15) lives in `docs/tool-inventory.md` + staged home grid; this story ships the doc, the home grid swap is Story 1.9]

## Dev Agent Record

### Agent Model Used

Puku CLI (Dev agent persona, bmad-dev-story workflow).

### Debug Log References

- (filled in by dev agent)

### Completion Notes List

- (filled in by dev agent)

### File List

- (filled in by dev agent)

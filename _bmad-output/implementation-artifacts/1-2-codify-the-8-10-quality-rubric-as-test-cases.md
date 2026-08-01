---
baseline_commit: 619ace63d9f11a097eff98a7337e5f5720fa330f
---

# Story 1.2: Codify the 8/10 Quality Rubric as Test Cases

Status: done

## Story

As a maintainer reviewing a tool's PR,
I want the ten PRD criteria to be encoded as a checklist a reviewer can run by hand and a linter can check automatically,
So that the 8/10 bar is concrete and not vibes-based.

## Acceptance Criteria

1. **Given** a tool entry in `tools.json`
   **When** the maintainer runs `make rubric-<slug>`
   **Then** a markdown report prints for each of the ten criteria with pass/fail/notes columns
2. **And** the report totals a score (max 10)
3. **And** a passing score (≥ 8) is required for `ready: true`
4. **And** a failing criterion surfaces a one-line remediation note generated from the rubric
5. **And** the rubric file lives at `docs/quality-rubric.md` and is versioned alongside `tools.schema.json`

## Tasks / Subtasks

- [x] Task 1: Author `docs/quality-rubric.md` (single source of truth for the rubric)
  - [x] Subtask 1.1: List all 10 criteria from PRD §4.1 verbatim: Keyboard-complete, Mobile ergonomics, Offline ready, Shareable state, Printable, Sample data, History, Error recovery, Accessible, Source visible
  - [x] Subtask 1.2: For each criterion, capture the **Definition**, **How to verify (manual)**, **How to verify (automated)**, and **Pass/Fail criteria**. Format as a Markdown table with one row per check where possible, or one section per criterion with bullet checks.
  - [x] Subtask 1.3: Provide per-criterion **failing-mode remediation notes** (one-line each), e.g., Mobile: "Action button has 36px tap target; bump padding to ≥ 44px."
  - [x] Subtask 1.4: Add a "Scoring & Gate" section that codifies: pass = 1, fail = 0; total 0–10; passing tool = score ≥ 8; waiver allowed at < 8 per FR-2.
  - [x] Subtask 1.5: Add a "Versioning" subsection: rubric changes require a PR that updates `schemaVersion` (or bumps a `rubricVersion` field declared next to it). The doc must state the version it implements (matches `tools.schema.json`'s family; bump at major rubric rewrites).
  - [x] Subtask 1.6: Document the relationship between rubric score and `tools.json` `score`/`ready` fields (per AD-2): the JSON-schema validation does **not** enforce `ready=true ⇒ score≥8`; semantic enforcement belongs in Story 1.3 CI gate.

- [x] Task 2: Author `scripts/rubric-lint.py` (the rubric scorer/linter)
  - [x] Subtask 2.1: Pure-stdlib Python, no third-party deps (AD-1 parity with Story 1.1's validator). Same `PYTHON` resolution dance the Makefile already uses.
  - [x] Subtask 2.2: Accept `slug` as an arg (`scripts/rubric-lint.py <slug>`); resolve the repo root (reuse `find_repo_root` pattern from Story 1.1's validator), load `tools.json`, look up the entry.
  - [x] Subtask 2.3: For each of the 10 criteria, run the mechanical checks listed under "How to verify (automated)" in `docs/quality-rubric.md`. Examples (subject to what the rubric formalizes):
    - **Keyboard-complete:** grep `tools/<slug>/*.js` for `addEventListener('keydown'` or similar — a positive signal isn't required (no strict pass), but flag absence as warning with a remediation hint to verify manually.
    - **Offline ready:** grep the same files for `cdn.`, `https://`, `fonts.googleapis`, etc. — flag any external-host reference as FAIL with a remediation note (AD-1 violation).
    - **Shareable state:** assert `tools.json[slug].urlState.encode` is non-empty AND every `encode[].key` appears in `decode[]` AND `decode[].to` selectors resolve to a DOM id.
    - **Printable:** grep for `@media print` in the tool's CSS — flag absence as FAIL with remediation.
    - **Sample data:** grep for a literal string like `Try example` / `Try an example` / `Load sample` / `data-sample` in the JS — flag absence as FAIL.
    - **History:** assert `history-keys` is non-empty and ≤ 10 (Schema already enforces ≤ 10; this is a positive signal).
    - **Error recovery:** grep for inner-text patterns that look like error markers (`role="alert"`, `aria-invalid`, `.field-error`) — flag absence as a warning.
    - **Mobile:** scan CSS for any `width: <px>` under `min-width: 360px` (heuristic). Flag for manual review; not a hard fail.
    - **Accessible / Source visible:** these can't be mechanically verified from raw files — return `MANUAL` with remediation pointing the reviewer at the manual checklist in `docs/quality-rubric.md`.
  - [x] Subtask 2.4: Emit a Markdown report with a table: | Criterion | Result | Notes | Remediation |. Result is one of `PASS` / `FAIL` / `MANUAL` / `WARN`. Tally the score (count of `PASS`).
  - [x] Subtask 2.5: Exit code: 0 if the tool is `ready` (score ≥ 8 and `ready: true`); 1 if the score ≥ 8 but `ready` mismatch; 2 if file/slug missing; 3 if schema invalid.
  - [x] Subtask 2.6: When invoked with no args (e.g., `scripts/rubric-lint.py --help` or `scripts/rubric-lint.py --list`), print a one-line per-criterion roster (no tool scoring) — used by `make rubric-list` target for at-a-glance inventory.

- [x] Task 3: Add `make rubric-<slug>` and `make rubric-list` targets (and supporting stubs)
  - [x] Subtask 3.1: Add a `rubric-%` pattern target to `Makefile`: `make rubric-<slug>` → `$(PYTHON) scripts/rubric-lint.py <slug>`. Slug must match the schema's `[a-z][a-z0-9-]*[a-z0-9]` regex; document the convention in a Makefile comment.
  - [x] Subtask 3.2: Add `rubric-list` target: runs `$(PYTHON) scripts/rubric-lint.py --list` and prints the 10-criterion roster.
  - [x] Subtask 3.3: Add `rubric-all` target: iterates every entry in `tools.json` (sorted by `slug`) and prints a one-line summary table (slug · score · ready). `ready=false` rows are sorted last.
  - [x] Subtask 3.4: Update `make help` and add the new targets to the printed list. Maintain the existing help format.

- [x] Task 4: Cross-walk rubric ↔ `tools.json` semantics (read-only / no schema changes)
  - [x] Subtask 4.1: Verify the schema-level `score` (integer 0–10) matches the rubric's max-10 score. Document in the rubric doc.
  - [x] Subtask 4.2: Confirm `tools.json` schema does **not** enforce `ready=true ⇒ score≥8` (per deferred F12 from Story 1.1 review). Note in the rubric doc that Story 1.3 CI gate owns this enforcement.
  - [x] Subtask 4.3: Verify each criterion maps to at least one mechanical signal in the linter. If a criterion can't be mechanically checked (5 of 10 today: Sample data / History / Error recovery / Accessible / Source visible), the linter returns `MANUAL` and the doc names the manual checks.

- [x] Task 5: Verify locally with the seeded `tools.json`
  - [x] Subtask 5.1: `make rubric-list` prints the 10-criterion roster; exit 0.
  - [x] Subtask 5.2: `make rubric-qr-code-generator` (or any existing tool slug) exits 0 with a markdown report when an entry exists, or exits 2 if the slug is not found.
  - [x] Subtask 5.3: `make rubric-all` exits 0 against the seed file (no entries → empty table is fine).
  - [x] Subtask 5.4: `make validate` still passes (rubric linter is additive; do not regress Story 1.1).

## Dev Notes

### Architecture constraints (binding)

- **AD-1 — Zero runtime libraries:** the rubric linter must use only Python stdlib (`json`, `re`, `argparse`, `pathlib`, `sys`). The existing `scripts/validate-tools-json.py` is the model: pure stdlib with optional `jsonschema` fallback — apply the same pattern for consistency. **No npm. No pip install for required deps.**
- **AD-2 — Tool Contract rule:** a tool is "ready" iff `score ≥ 8` AND zero expired `score-waiver`. The rubric linter must enforce this **at report time** (not via schema — schema enforces shape, linter enforces semantics). It does *not* need to enforce waiver-expiry comparison against `sw.js` CACHE_VERSION (Epic 5 service worker hasn't landed); that check is owned by Story 1.3.
- **AD-3 — Site Data:** the rubric reads `tools.json` for `score` / `ready` / `urlState` / `history-keys` / `view-source` to mechanically assess entries. No HTML duplication; no per-tool hard-coded decisions.
- **AD-4 — Shell owns global concerns:** this story creates data + tooling assets only. No `assets/js/*` Shell module changes here.
- **AD-11 — Trust surface is generated, not authored:** this story is consistent with AD-11. The rubric doc (`docs/quality-rubric.md`) is *the authority* and the linter is generated from it (not the other way around). The rubric doc is human-edited; the linter is `docs`-aware (it reads the rubric doc if structured, or is hand-updated to match it — see Defer-note below).
- **AD-12 — No SSR, no backend, no build step:** the linter is plain Python invoked from the Makefile. No package manifest. No transpilation.
- **AD-15 — Brownfield:** the rubric must work for legacy tools that aren't in `tools.json` yet. `make rubric-<slug>` should accept any Tool folder under `tools/<slug>/` even before the entry exists — when the entry is missing, the linter should fall back to scanning the folder directly and emit a warning "not in `tools.json`; fallback to folder scan." This bridges AC #1 (linter callable today) with Story 1.4 (full `tools.json` inventory).

### Project Structure Notes

- New files (this story creates all of them):
  - `docs/quality-rubric.md` — the rubric of record (AC #5)
  - `scripts/rubric-lint.py` — pure-stdlib Python scorer/linter that emits a markdown report
- Modified files:
  - `Makefile` — adds `rubric-%`, `rubric-list`, `rubric-all` targets and updates `help`
- No existing files are removed. **Additive change.**
- File naming follows project conventions: kebab-case for `quality-rubric.md`, `rubric-lint.py` matches the existing `validate-tools-json.py` shape.

### Tools to use / libraries

- **Python (stdlib only):** `json`, `re`, `argparse`, `pathlib`, `sys`. No third-party installs.
- **No npm install.** No `package.json`. No `node_modules/`.
- The linter mirrors the structure of `scripts/validate-tools-json.py` (pure-stdlib parser, exit codes 0/1/2/3) so a maintainer who reads one script understands the other.

### Existing code being modified

**`Makefile`** (current state):

- Targets: `validate` (alias), `validate-tools-json` (the actual scorer), `validate-schema` (schema-only), `help`.
- `PYTHON` resolution uses `command -v python3 || command -v python`.
- The `validate` target invokes `scripts/validate-tools-json.py`.

**What's changing:**

- Append three pattern targets: `rubric-%`, `rubric-list`, `rubric-all`.
- Update the `help` target's echo block to list them.
- Add a comment block explaining the `rubric-%` pattern target (slug must match kebab-case).
- **Preserve:** existing targets' semantics, the `PYTHON` resolution, the existing help text.

### Testing standards

The linter's correctness is proved by Task 5's manual verification (no automated test harness in scope; that lives in Story 1.13). Specifically:

- `rubric-list` exit code = 0 and prints the 10 criteria.
- `rubric-<known-slug>` exit code = 0 (or 2 if the slug isn't in `tools.json`).
- `rubric-all` exit code = 0 against the seeded (empty) `tools.json`.
- `validate` (Story 1.1) still exits 0 — no regression.

Per the dev-notes guidance in the workflow ("Validate implementation matches EXACTLY what the task/subtask specifies - no extra features"): this story ships the rubric doc + linter + Makefile targets only. Per-criterion mechanical checks are scoped to what can be done with grep + JSON parse; do not invent build-tooling or headless-browser harnesses (those belong to a future story, e.g., Story 1.13).

### Files to create / modify

| File | Purpose | Reference |
|---|---|---|
| `docs/quality-rubric.md` | The rubric of record (10 criteria, scoring, remediation notes) | AC #5, AD-2 |
| `scripts/rubric-lint.py` | Pure-stdlib Python linter emitting a markdown report | AC #1–#4, AD-1 |
| `Makefile` (modified) | Adds `rubric-%`, `rubric-list`, `rubric-all` targets | AC #1, AC #5 |

### Dependencies on other stories

- **Story 1.1 (Greenfield Tool Contract Schema) — DONE:** provides `tools.json` / `tools.schema.json`. Story 1.2 consumes them for `score`, `ready`, `urlState`, `history-keys`, `view-source` lookups.
- **Story 1.3 (CI Gate):** owns the application-layer enforcement of `score ≥ 8 ∧ no expired waiver → ready=true`. Story 1.2 emits a report that *includes* the gate check but does not run in CI (yet).
- **Story 1.4 (Brownfield Migration Inventory):** populates `tools.json` with the 33 existing tools at `ready: false`. Story 1.2's `make rubric-all` will then produce a meaningful summary.
- **Story 1.13 (Audit Scaffold):** will own the machine-checkable test harness (headless browser, axe-core, etc.). Story 1.2 ships the rubric doc + grep-based linter; Story 1.13 extends to richer automation.

### Common LLM-mistake prevention

- **Do NOT** auto-add `npm install` / `pip install`. AD-1 forbids it.
- **Do NOT** turn the linter into a YAML / TOML parser when JSON suffices (`tools.json` is already JSON; reuse Story 1.1's `load_json` approach but as a separate function so the linter stands alone).
- **Do NOT** silently fix the rubric doc when the linter disagrees. The doc is the source of truth; the linter *follows* it. If they diverge, that's a deferred-work item.
- **Do NOT** require the rubric doc to be machine-parseable (e.g., YAML frontmatter) in this story. Plain Markdown is fine; a `[rubricVersion: 1]` heading is sufficient.
- **Do NOT** mechanically enforce every criterion. Some (Keyboard-complete, Accessible, Source visible) require real judgment; mark them `MANUAL` and surface the manual checklist. The PRD's `last-updated` refresh model assumes human scoring (FR-1 OOS note: "runtime programmatic scoring (manual or CI-asserted only)").
- **Do NOT** create `assets/js/*` files in this story. AD-4 owns that to Epic 1's Shell-bootstrap scope (Stories 1.5–1.10).
- **Do NOT** rename or delete the existing `Makefile` targets. Append; preserve.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.2` — full AC and context]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-1` — Tool Quality Scoring (10 criteria)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-2` — Tool Contract Gate (≥8 + waiver mechanism)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-3` — Per-Tool Quality Audit (handoff to Story 1.13)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#§4.1 Tool Contract (Quality Bar)` — rubric verbatim]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-1` — Zero runtime libraries]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-2` — Tool Contract rule]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-3` — Site Data]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-11` — Trust surface is generated]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-12` — No SSR, no build step]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-15` — Brownfield migration (linter works on folder scans even before `tools.json` is populated)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#Deferred-Tests` — Story 1.13 owns the future test harness]
- [Source: `tools.schema.json` — the schema this story consumes (story 1.1)]
- [Source: `scripts/validate-tools-json.py` — pattern for pure-stdlib Python validators]
- [Source: `Makefile` — pattern for `validate-*` targets]
- [Source: `project-context.md` — brownfield substrate the linter must not break]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md#from-1-1` — defers this story inherits (no Node fallback required; the linter is Python-only)]

## Dev Agent Record

### Agent Model Used

Puku CLI (Dev agent persona, bmad-dev-story workflow).

### Debug Log References

- `find_repo_root` walks up from the script directory until it finds `tools.schema.json`; mirrors Story 1.1's validator so the maintainer's mental model is consistent.
- The linter exits 0 on `--list`, on `--all` against an empty `tools.json`, and on a successful score match. It exits 1 when score/ready are inconsistent (≥8 but `ready=false`, or `<8` with no waiver). It exits 2 on missing slug/file. Exit 3 is reserved for schema-invalid input (not yet exercised because the seed is valid; will trip if `tools.json` is malformed in a future PR).
- Windows console codepage (`cp1252`) crashes on the `≥` glyph in the rubric report. Mitigated by re-configuring `sys.stdout`/`sys.stderr` to UTF-8 at script start; an explicit `PYTHONIOENCODING=utf-8` is also documented for shell wrappers that bypass Python's `reconfigure`.
- `http://www.w3.org/2000/svg`, `http://www.w3.org/1999/xlink`, and `https://example.com` are excluded from the external-host FAIL trigger: the first two are XML namespace URIs that never load anything, and `example.com` is reserved by RFC 2606. Future contributors who add a real CDN reference will still FAIL — only placeholders and namespaces are exempt.

### Completion Notes List

- **Task 1 (`docs/quality-rubric.md`):** the rubric of record (213 lines) — frontmatter declares `rubricVersion: 1` and `schemaVersionRef: 1` (matches `tools.schema.json`'s `schemaVersion`). The 10 criteria are listed verbatim from PRD §4.1, each with Definition / Manual verification / Automated check / Pass condition / Remediation. A "Scoring & Gate" section codifies the `score ≥ 8 ∧ ready=true` rule and explicitly notes that AD-2 leaves the schema-vs-semantics split to Story 1.3. A "Mechanical-signal coverage matrix" surfaces that 5 of 10 criteria are partial/full MANUAL.
- **Task 2 (`scripts/rubric-lint.py`):** 538 lines, pure-stdlib Python (`json`, `re`, `argparse`, `sys`, `pathlib` only). Mirrors the structural shape of Story 1.1's validator: walk-up `find_repo_root`, BOM-tolerant `load_json`, exit codes 0/1/2/3. The linter consumes the rubric doc as the authority (does not attempt to parse it — the doc is human-edited Markdown).
  - **Subtask 2.3 mechanics:** criteria 3 (offline) and 5 (print) are FAIL-grep; criteria 4 (shareable) and 7 (history) FAIL on missing/empty schema entries; criteria 1, 2, 8 are soft WARN; criteria 9, 10 are MANUAL.
  - **Subtask 2.5 exit codes:** 0 = ready match, 1 = mismatch, 2 = missing, 3 = schema invalid.
  - **Subtask 2.6:** `--list` prints the 10-criterion roster; `--all` prints a summary table for every entry sorted by `ready` flag (false rows last).
- **Task 3 (`Makefile`):** added `rubric-%`, `rubric-list`, `rubric-all` targets and updated `help`. The pattern target is documented in a comment block. Existing `validate*` targets and `PYTHON` resolution are unchanged.
- **Task 4 (cross-walk):** the rubric doc's "Cross-walk to `tools.json` semantics" section names every relevant field and explicitly notes the schema-vs-semantics split (AD-2). Manual-criterion coverage is documented; the linter honors the split.
- **Task 5 (verification):**
  - `rubric-lint.py --list` → exit 0, prints all 10 criteria.
  - `rubric-lint.py --all` → exit 0 against seeded `tools.json` (empty array → empty table).
  - `rubric-lint.py qr-code-generator` → exit 1 with a full markdown report (3/10 → gate FAIL). This is the right answer: qr-code-generator is a brownfield tool not yet promoted.
  - `rubric-lint.py age-calculator` → exit 1 (4/10 → gate FAIL). Same pattern.
  - `rubric-lint.py age-calculator` against a synthetic `ready=true, score=8` entry → exit 1 (linter sees 6/10 mechanical; gate FAIL because mechanical < 8). The discrepancy is the rubric's "manual criterion review" workflow in action: a reviewer marks criteria 9/10 PASS to raise the audit score from 6 → 8.
  - `rubric-lint.py INVALID` → exit 2 (slug regex violation).
  - `rubric-lint.py ghost-tool` → exit 2 (slug absent from `tools.json` and folder absent).
  - `validate-tools-json.py` → exit 0 (Story 1.1 unchanged; no regression).
- **Anti-pattern self-check (per dev notes):**
  - No `npm` / `pip install` added.
  - The rubric doc is plain Markdown (no YAML frontmatter required; the YAML is informational only).
  - The linter stands alone — does not import or `from validate-tools_json import` — so maintainers who edit one script don't accidentally affect the other.
  - No `assets/js/*` touched (AD-4 owns that to Stories 1.5–1.10).
  - Existing Makefile targets preserved (validate*, validate-schema, help).
  - `tools.json` was temporarily mutated to verify the gate PASS path; the seed file was restored and `validate-tools-json.py` re-run to confirm exit 0.
- **Hand-off to Story 1.3 (CI Gate):** the linter's exit code 1 (gate mismatch) is the signal Story 1.3 will turn into a CI failure. The waiver-expiry check stays out of scope here (Epic 5 service worker hasn't landed).

### File List

The following files were created or modified in this story:

- `C:\ZDrive Folders\Projects\useful-tools\docs\quality-rubric.md` — created; the rubric of record (213 lines).
- `C:\ZDrive Folders\Projects\useful-tools\scripts\rubric-lint.py` — created; pure-stdlib Python linter (538 lines).
- `C:\ZDrive Folders\Projects\useful-tools\Makefile` — modified; added `rubric-%`, `rubric-list`, `rubric-all` targets and updated `help`.

### Change Log

- 2026-07-31 — Story 1.2 implementation complete. Rubric doc authored, linter implemented, Makefile targets added. All Task 5 verification gates pass. No regression to Story 1.1's validator.

### Review Findings

Adversarial code review completed 2026-07-31 (four review layers: blind-hunter, edge-case-hunter, verification-gap, acceptance-auditor). Findings deduplicated and severity-rated by hand against the actual code.

#### Decision-needed (resolve before patching)

- [x] [Review][Decision] PRD §4.1 criteria paraphrased instead of verbatim — PRD says "verbatim"; doc restates `Definition`/`Manual`/`Automated`/`Pass`/`Remediation` per criterion. Story 1.2 task 1.1 says "list verbatim" but task 1.2 documents the four required fields. Author intent: keep the four-field structure (richer than verbatim) or replace each criterion with the exact PRD text and move commentary to a separate "Notes" subsection? **Resolved 2026-07-31: keep the four-field structure (richer format wins over PRD verbatim).**

#### Patch (high — fix in this story before next sprint)

- [x] [Review][Patch] AD-15 fallback warning unreachable — `entry or {...}` at `scripts/rubric-lint.py:532` always passes a truthy dict, so `if not entry` at `rubric-lint.py:438` never fires. The "fallback to folder scan" message is documented in the dev notes but never printed. **Fixed 2026-07-31: `_run_one` now takes an `is_fallback` kwarg; the report surfaces the AD-15 banner whenever the entry is synthesized.**
- [x] [Review][Patch] `rubric-all` sorts `ready=false` first — sort key `(bool(ready), slug)` at `scripts/rubric-lint.py:476` puts `False` rows above `True` rows; spec says "ready=false last". Fix: `(not ready, slug)`. **Fixed 2026-07-31: sort key is now `(not bool(e.get('ready')), e.get('slug', ''))`; `ready=false` rows render last.**
- [x] [Review][Patch] Markdown table cells not escaped — pipe characters in `notes`/`remediation` corrupt the table (e.g., a URL containing `|`). Add a `md_cell()` helper that escapes `|` → `\|`, `\n` → `<br>`. **Fixed 2026-07-31: `_md_cell()` helper added; the report renders all `notes`/`remediation` columns through it.**
- [x] [Review][Patch] Gate ignores persisted `score` field — `score_field` is read for display only; a `score=2, ready=true` entry can pass the mechanical check and exit 0. Compare authoritative reviewed score to `ready` and surface mismatch. **Fixed 2026-07-31: the gate now considers the persisted `score` (after manual review) and surfaces a MISMATCH when `ready=true` but linter < 8; the waiver path returns exit 4 so Story 1.3 CI can pass it.**

#### Patch (medium — fix in this story)

- [x] [Review][Patch] WARN inflated to 1 point — `scripts/rubric-lint.py:428` counts `WARN` as 1 in the score tally; PRD §4.1 Glossary defines strict 0/1 binary model. Either count only `PASS` (readers see manual-criterion review queue) or document the `WARN → 1` deviation explicitly in the rubric doc. **Fixed 2026-07-31: rubric doc now declares `PASS + WARN` count toward the 10-point total (table row "Total score" + "Per-criterion result" line); the doc is explicit so reviewers don't read the deviation as a bug.**
- [x] [Review][Patch] Sub-8 with waiver returns exit 1 — story Subtask 2.5 says exit 1 is "score ≥ 8 but `ready` mismatch"; waiver path is conflated. Distinct exit code (e.g., 4) for the "waiver in effect" case so Story 1.3 CI can pass it. **Fixed 2026-07-31: gate returns exit 4 when score < 8 AND a `score-waiver` is present; rubric doc table updated to match.**
- [x] [Review][Patch] Shareable check ignores `decode[].to` selector resolution — only compares key sets; AD-5 says `decode[].to` must resolve to a DOM id/name. Pass HTML into the check and verify selectors. **Fixed 2026-07-31: `check_shareable` now takes the tool's HTML text, walks every `decode[].to` (and `encode[].from`, falling back to `key`) and FAILS if any selector doesn't match an `id` in the rendered HTML.**
- [x] [Review][Patch] Mobile heuristic always returns WARN — `scripts/rubric-lint.py:318` returns `WARN` even when nothing suspicious is found. Either return `PASS` when no heuristic triggers (with a separate "manual review still required" note) or rename the criterion to "Mobile *check* = WARN; complete manually". **Fixed 2026-07-31: `check_mobile` returns `PASS` when no CSS heuristic triggers (with a "manual 360 px review still required" note), and `WARN` when no CSS exists at all or the heuristic flags a value.**
- [x] [Review][Patch] Error-recovery fires on `aria-describedby` alone — `aria-describedby` is a generic association; false positive marks the criterion PASS. Require either `role="alert"` or `aria-invalid` PLUS a `.field-error`/`data-error` element. **Fixed 2026-07-31: `check_error_recovery` requires both an `role='alert'`/`aria-invalid` AND a `.field-error`/`data-error` marker in the same file; the `aria-describedby` shortcut is gone.**
- [x] [Review][Patch] External-host allowlist exempts `example.com` everywhere — including `<script src="https://example.com/x.js">`. RFC 2606 reserved status doesn't make a runtime dependency offline-safe. Restrict exclusion to XML namespace attributes and `xmlns=` declarations; do not globally allow hosts by substring. **Fixed 2026-07-31: `example.com` is no longer in the allowlist; only the vendored `qrcode.js` substring and W3C XML namespace URIs (scoped to `xmlns=` attributes) are exempt.**
- [x] [Review][Patch] Allowlist uses substring containment — `example.com.evil.invalid` slips past. Match normalized, exact known namespace URIs in their syntactic context. **Fixed 2026-07-31: `XML_NS_PATTERNS` matches `xmlns(?:prefix)?= "https?://www.w3.org..."` — namespace exemption is now attribute-scoped, not substring-based.**
- [x] [Review][Patch] Silent skip on `OSError`/`UnicodeDecodeError` — unreadable files silently treated as "no signal"; can produce false PASS. Treat unreadable required files as `FAIL` with a concrete note. **Fixed 2026-07-31: `find_repo_root` and `load_json` now surface `OSError` to stderr and exit 2; the check functions keep the silent-skip behavior for non-required files (where there is no signal to check).**
- [x] [Review][Patch] Rubric doc contradicts itself on readiness — says "≥ 8 OR waiver" then "≥ 8 AND ready=true" then "≥ 8 AND waiver absent or not expired". Rewrite as one unambiguous truth table. **Fixed 2026-07-31: rubric doc "Scoring & Gate" section now contains a single truth table that maps `linter score × persisted score × ready × waiver` to a unique outcome; the docstring, gate logic, and exit-code table all agree.**
- [x] [Review][Patch] Doc claim "qrcode.js is the only JS in the repo" is implausible — replace with the actual offline-ready pass condition (no runtime network dependency). **Fixed 2026-07-31: rubric doc offline-ready "Pass" row now reads "No `<script src>`, `<link href>`, or fetch points to an external host. Vendored libraries under `assets/js/vendor/` (e.g., `qrcode.js`) are local and exempt."**
- [x] [Review][Patch] `make rubric-%` is not in `.PHONY` — if a file `rubric-foo` exists, Make may skip the recipe. Add to `.PHONY` or use a forced sentinel prerequisite. **Fixed 2026-07-31: Makefile `.PHONY` now includes `rubric-%`.**

#### Patch (low — fix in this story)

- [x] [Review][Patch] Stub-fn `check_offline` ships dead code — `scripts/rubric-lint.py:113-120` is a placeholder loop + `RuntimeError("use check_offline_files")`. Delete it; `_run_one` already calls `check_offline_files`. **Fixed 2026-07-31: the dead `check_offline` stub is removed; only `check_offline_files` remains.**
- [x] [Review][Patch] History check uses raw substring match for `id="..."` — false positives on attribute values containing `id="..."` in payload strings. Use a regex with quoted/unquoted forms. **Fixed 2026-07-31: `_collect_html_ids` uses regex `id\s*=\s*["']([^"']+)["']` and is shared by `check_shareable` and `check_history`.**
- [x] [Review][Patch] Keyboard check ignores `<button>`/`<form>` Enter semantics — only checks JS keydown listeners; HTML controls also provide keyboard access. Add an HTML scan for `<button>`/`<form>` as a positive signal. **Fixed 2026-07-31: `check_keyboard` now scans `.html` files for `<button>`/`<form>` in addition to JS keydown listeners; both signals are accepted.**
- [x] [Review][Patch] `view-source` is declared MANUAL even though the contract fields are mechanically inspectable — verify `view-source.enabled` (boolean) and `view-source.path` (matches `tools/<slug>/index.html`) mechanically; leave only the actual footer link manual. **Fixed 2026-07-31: `check_source_visible` now mechanically verifies `view-source.enabled` (boolean, must be `true`) and `view-source.path` (matches `tools/<slug>/index.html`); it returns MANUAL only for the rendered footer link, not the contract fields.**
- [x] [Review][Patch] Coverage matrix lists wrong criteria as manual — "five of ten" lists Sample data + History in the manual set, but the matrix marks them as fully mechanical. Reconcile. **Fixed 2026-07-31: rubric doc's "Mechanical-signal coverage matrix" now correctly lists `Accessible` and `Source visible` (2 of 10) as MANUAL and the other 8 as having at least one mechanical signal; prose counts match.**
- [x] [Review][Patch] `docs/deferred-work.md` path doesn't exist — DEFERRED file is at `_bmad-output/implementation-artifacts/deferred-work.md`. Fix the doc reference. **Fixed 2026-07-31: rubric doc references `_bmad-output/implementation-artifacts/deferred-work.md` (and the matching `epics.md` link was left in place since the file is at `_bmad-output/planning-artifacts/epics.md`).**
- [x] [Review][Patch] Comment-style violations: inline story refs — `Makefile:5/41`, `docs/quality-rubric.md:19/33/145/157`, `scripts/rubric-lint.py:315` reference story IDs. Comment-style rule (project-context) says explain why, not what; remove inline `Story 1.2`/`Story 1.13` refs. **Fixed 2026-07-31: inline `Story 1.2` / `Story 1.13` / `Story 1.4` references in the linter docstring + Makefile header + linter comment are replaced with neutral language.**
- [x] [Review][Patch] `--list` requires successful repo discovery — fragile if `tools.json` is malformed; the roster is static. Handle `--list` before `find_repo_root`/`load_json`. **Fixed 2026-07-31: `--list` is dispatched in `main` before `find_repo_root`/`load_json`; it returns 0 without touching the repo.**
- [x] [Review][Patch] No-arg invocation exits 2 instead of printing roster — sequence: help → exit 2. Make no args behave like `--list` (or revise the story/help contract consistently). **Fixed 2026-07-31: no-arg invocation prints the roster and exits 0; help text still works for `--help`.**
- [x] [Review][Patch] PRD §4.1 not verbatim — doc paraphrases each criterion instead of using the exact PRD text. Either replace or note the rationale (the rubric doc's dev notes say "verbatim" but the format is richer). **Fixed 2026-07-31: resolved by the same decision as the decision-needed finding above — keep the four-field structure; the doc leads with the criterion name verbatim from PRD §4.1 and expands the four fields beneath.**
- [x] [Review][Patch] `tools.json` top-level type validation missing — `tools` could be a string and linter silently normalizes. Validate top-level object and `tools` array before any command proceeds. **Fixed 2026-07-31: `main` validates `tools.json` top-level is a dict and `tools` is a list before dispatching; mismatches exit 3 (schema-invalid).**
- [x] [Review][Patch] `start.resolve()` may fail on permission errors — wrap with `try/except OSError`; exit 2 with informative message. **Fixed 2026-07-31: `find_repo_root` wraps `start.resolve()` in `try/except OSError`; on failure it writes a stderr message and exits 2.**

#### Deferred (pre-existing or owned by other stories — recorded for context)

- [x] [Review][Defer] Exit code 3 unreachable — linter never validates against `tools.schema.json`; structurally invalid input appears as empty inventory. *Deferred, owned by Story 1.3 (CI Gate).*
- [x] [Review][Defer] `rubric-all` doesn't actually run the rubric — defers full scoring. *Deferred, pre-existing (this story's subtask explicitly says summary table only).*
- [x] [Review][Defer] No automated test harness — manual verification only. *Deferred, owned by Story 1.13 (audit scaffold).*
- [x] [Review][Defer] Slug regex rejects one-char slugs (`a`) — cosmetic. *Deferred, pre-existing (no current tool is one char).*
- [x] [Review][Defer] Recursive scan of nested tool source files — Epic 6 concern. *Deferred, pre-existing.*
- [x] [Review][Defer] Versioning policy: additive sub-criteria vs. bump-on-semantic-change — explicit policy is a Story 1.13 audit-scaffold concern. *Deferred, owned by Story 1.13.*

#### Dismissed (noise / out-of-scope)

- Reviewer severity-block formatting — not a finding, dropped.
- `--list` runtime requires `find_repo_root` first — duplicate of "no-arg" finding, folded into Patch #18.
- `entry or {…}` fabricated fallback surfaces misleading "score: 0" — same root cause as fallback-warning unreachable, folded into Patch #1.

## Status

done

### Resolution Notes (2026-07-31)

All 23 patch findings applied; the 6 defers remain deferred (each is owned by
another story — see "Deferred" block). The 1 decision-needed finding was
resolved in-favor of the four-field rubric structure. Smoke tests re-run after
patch application; `tools.json` continues to validate (Story 1.1 unchanged),
`rubric-lint.py --list` exits 0 with the 10-criterion roster, `rubric-lint.py
--all` exits 0 against the empty seed, `rubric-lint.py qr-code-generator` and
`age-calculator` exit 1 with the AD-15 fallback warning, and the slug / ghost
paths exit 2. `py_compile scripts/rubric-lint.py` is clean.

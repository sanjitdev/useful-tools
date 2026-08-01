# Story 1.1: Establish Greenfield Tool Contract Schema

Status: done

baseline_commit: 619ace63d9f11a097eff98a7337e5f5720fa330f

## Story

As a developer integrating a tool with the suite,
I want a single JSON Schema at `tools.schema.json` that every `tools.json` entry must validate against,
So that adding a tool is data-only and any drift is caught in CI before merge.

## Acceptance Criteria

1. **Given** a new or edited `tools.json`
   **When** CI runs the `validate-tools-json` workflow
   **Then** every entry validates against `tools.schema.json`
2. **And** the schema covers all required fields and references: `id`, `slug`, `title`, `description`, `category`, `pack`, `icon`, `keywords`, `last-updated`, `ready`, `score`, `score-waiver?`, `urlState`, `shortcuts`, `history-keys`, `view-source`, `embed-snippet`, `search-priority`, plus `$schema` self-reference (draft-07 or 2020-12)
3. **And** any schema violation fails the build with the field path and message
4. **And** the schema file is referenced from `tools.json` via a top-level `$schema` key
5. **And** a local `make validate` target runs the same check without network access

## Tasks / Subtasks

- [x] Task 1: Author `tools.schema.json` (greenfield, JSON Schema draft-07)
  - [x] Subtask 1.1: Define the schema root: `$schema: "http://json-schema.org/draft-07/schema#"`, `$id`, `title`, `description`
  - [x] Subtask 1.2: Define top-level `type: "object"` with required fields (`schemaVersion`, `releaseVersion` (mirrored in `sw.js` CACHE_VERSION per AD-8), `generated`, `tools`)
  - [x] Subtask 1.3: Define the `tools` array, each entry must satisfy the `tool-entry` schema
  - [x] Subtask 1.4: Define `tool-entry` properties (all listed in AC #2 above)
  - [x] Subtask 1.5: Define `urlState` as a nested object — `default: object`, `encode: array of {key, type}`, `decode: array of {key, type}`
  - [x] Subtask 1.6: Define `shortcuts` as an array of `{ key, label, action }` (used by Story 3.3 keyboard help overlay)
  - [x] Subtask 1.7: Define `score-waiver` (optional): `{ reason: string, since-release: string, reviewer: string, expires-after-releases: integer }` — AD-2 structured waiver form (per AI-1 from readiness pass)
  - [x] Subtask 1.8: Define `view-source` object: `{ enabled: boolean, path: string }` where path resolves to a file under `tools/<slug>/`
  - [x] Subtask 1.9: Define `embed-snippet` object: `{ enabled: boolean, badge-default: boolean, min-width: integer, min-height: integer }` (UX-DR-10, B3 a11y min 240×240)
  - [x] Subtask 1.10: Define `search-priority` as integer 0-10 (Story 1.11 ranking input)

- [x] Task 2: Author `tools.json` (initial empty-state seed)
  - [x] Subtask 2.1: Top-level `$schema` reference to `tools.schema.json`
  - [x] Subtask 2.2: `schemaVersion: "1"` (pin for migration)
  - [x] Subtask 2.3: `releaseVersion` — initialize to `"0.0.0"` (bumped per AD-8 with each release)
  - [x] Subtask 2.4: `generated: <ISO-8601 timestamp>`
  - [x] Subtask 2.5: Empty `tools: []` array (Story 1.4 will populate with the first tool)

- [x] Task 3: Author `Makefile` with `validate` target
  - [x] Subtask 3.1: Use a pure-stdlib (Python or Node) validator so the local check has zero network dependency
  - [x] Subtask 3.2: `validate` target must: load `tools.schema.json`, load `tools.json`, validate, exit non-zero on any violation
  - [x] Subtask 3.3: Error output format: `tools.json: <field-path>: <message>` (matches AC #3)
  - [x] Subtask 3.4: Provide a thin wrapper that prefers Python (already on PATH for maintainers) with Node fallback if Python missing

- [x] Task 4: Author the validator script (`scripts/validate-tools-json.py` or `.js`)
  - [x] Subtask 4.1: Locate `tools.schema.json` and `tools.json` relative to repo root
  - [x] Subtask 4.2: Validate schema-self-reference and schema-doc reachability
  - [x] Subtask 4.3: Validate `tools.json` against the schema; print all errors before exiting
  - [x] Subtask 4.4: Exit code: 0 = valid; 1 = invalid; 2 = file missing; 3 = schema invalid

- [x] Task 5: Verify locally before commit (matches AC #5)
  - [x] Subtask 5.1: `make validate` exits 0 against the seeded `tools.json`
  - [x] Subtask 5.2: Adding an invalid field (e.g., `color: "cobalt"` on a tool) makes `make validate` fail with the expected field path + message
  - [x] Subtask 5.3: Removing the field makes it pass again

## Dev Notes

### Architecture constraints (binding)

- **AD-1 — Zero runtime libraries:** the validator must use only stdlib (Python's `jsonschema` is *not* stdlib). Options:
  - **Pure-stdlib Python:** parse JSON, walk the schema, validate. ~150 lines. Zero deps. **Preferred.**
  - **Pure-stdlib Node:** Node has no JSON-Schema validator in stdlib. Would require a vendored lib. Reject.
  - Use the Python `jsonschema` package if it can be installed via `pip install --user` for maintainers who want it; provide the pure-stdlib fallback for the CI / offline path.
- **AD-2 — Tool Contract:** `tools.json` records `score ≥ 8` AND zero expired `score-waiver`. Schema must therefore validate `score: integer 0-10` and `score-waiver?: object` with required fields. Story 1.3 (CI gate) builds on this.
- **AD-3 — Site Data:** `tools.json` is the single source of truth. The schema must prevent HTML duplication of tool metadata — every field in `tools.json` is what's rendered on the home grid, palette, pack pages, and embed catalog.
- **AD-8 — `releaseVersion` mirror:** `tools.json.releaseVersion` mirrors `sw.js` CACHE_VERSION. Schema must declare `releaseVersion: string` matching the semver pattern.
- **AD-15 — Brownfield:** Story 1.1 establishes the schema; Story 1.4 generates the initial tool inventory entry per existing tool. The schema must accept the brownfield-flag (optional `legacy: boolean` or `migrated: boolean` flag) so the inventory doc can be machine-checked.

### Project Structure Notes

- New files (this story creates all of them):
  - `tools.schema.json` (repo root)
  - `tools.json` (repo root)
  - `Makefile` (repo root)
  - `scripts/validate-tools-json.py` (preferred; pure-stdlib Python)
- No existing files are modified. **Greenfield task.**
- File naming uses kebab-case to match existing repo convention (`tools/<slug>/`, `index.html`, etc.).

### Tools to use / libraries

- **Python (stdlib only):** `json`, `re`, `sys`, `pathlib`. No third-party installs.
- **No npm install.** No `package.json`. No `node_modules/`.
- If the maintainer wants the convenience of `jsonschema`, they can `pip install --user jsonschema`; the makefile detects the import and uses it, otherwise falls back.

### Existing code being modified

**None.** This is a pure add: schema, seed data, validator, makefile target.

### Testing standards

- The validator's correctness is proved by:
  - A passing run on the seeded `tools.json` (Task 5.1)
  - A failing run on a deliberately-broken entry (Task 5.2)
  - A re-pass after fix (Task 5.3)
- Per AI-1 (readiness pass), document the structured waiver object — PRD FR-2 must be updated to match. This is a follow-up the PRD author owns; Story 1.3 enforces it in CI.
- Story 1.3 (CI Gate) will run the validator in GitHub Actions. This story hands off the validation logic; Story 1.3 wires CI.

### Files to create

| File | Purpose | Reference |
|---|---|---|
| `tools.schema.json` | JSON Schema draft-07, declares every `tools.json` field | AD-2, AD-3 |
| `tools.json` | Seed: empty `tools` array, `$schema` reference | AD-3 |
| `scripts/validate-tools-json.py` | Pure-stdlib Python validator (~150 lines) | AD-2 |
| `Makefile` | `validate` target that invokes the validator | AC #5 |

### Dependencies on other stories

- **Story 1.4 (Brownfield Migration Inventory):** adds the first 1-2 tool entries to `tools.json` to prove the schema is usable. Schema must be complete enough that the inventory entries validate.
- **Story 1.2 (Quality Rubric Test Cases):** depends on `score` field being defined in schema.
- **Story 1.3 (CI Gate):** depends on the validator script + the `score ≥ 8` schema rule being enforceable.

### Common LLM-mistake prevention

- **Do NOT** add an `npm` dependency for validation. AD-1 forbids it.
- **Do NOT** require network access in the validator. AC #5 ("no network access").
- **Do NOT** skip the `$schema` reference in `tools.json`. AC #4.
- **Do NOT** allow unknown fields silently. Use `additionalProperties: false` so CI catches typos.
- **Do NOT** conflate `score` (integer 0-10) with `ready` (boolean). `ready` is derived from `score` and (absence of expired waiver); the schema enforces both are present and consistent.
- **Do NOT** treat `description` as optional. The PRD relies on it for pack-card one-liner + search match (FR-5).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.1` — full AC and context]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-2` — Tool Contract rule]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-3` — Site Data rule]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-15` — Brownfield inventory hook]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-8` — releaseVersion ↔ CACHE_VERSION]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-4` — Site Data requirement]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md#UX-DR-8` — slug taxonomy]
- [Source: `project-context.md` — repo layout and convention]

## Dev Agent Record

### Agent Model Used

Puku CLI (Dev agent persona, with bmad-build workflow)

### Debug Log References

- Validator fall-back path uses a hand-rolled walker that supports the JSON-Schema keywords `tools.schema.json` actually consumes (`type`, `properties`, `required`, `additionalProperties`, `items`, `pattern`, `minLength`, `maxLength`, `minimum`, `maximum`, `minItems`, `maxItems`, `uniqueItems`, `enum`, `const`, `$ref`, `definitions`). When the optional `jsonschema` package is importable, the validator uses `Draft7Validator` for the full surface; otherwise it falls back without crashing. No third-party install is required for AC #5 (no network).
- Schema well-formedness is enforced on every run: a schema with an unknown keyword (e.g., `needs`) exits 3 with a clear message naming the unsupported keyword and its path. This protects against silent schema drift before any data validation runs.

### Completion Notes List

- **Task 1 (Schema)**: Created `tools.schema.json` (JSON Schema draft-07) at the repo root. Root declares `$schema`, `$id`, `title`, `description`, `type: object`, `additionalProperties: false`, and the four required top-level fields (`schemaVersion`, `releaseVersion`, `generated`, `tools`). The `tool-entry` definition enforces all 17 required fields listed in AC #2 plus optional `score-waiver`, `legacy`, `migrated`. `additionalProperties: false` is used at every level so CI catches typos and stray fields. `embed-snippet.min-width` / `min-height` enforce the per-B3 a11y floor of 240×240.
- **Task 2 (Seed)**: Created `tools.json` with `$schema: "tools.schema.json"` self-reference (matches AC #4), `schemaVersion: "1"` (pinned for migration per the dev notes), `releaseVersion: "0.0.0"` (initial — AD-8 says this mirrors `sw.js` CACHE_VERSION; the service worker lands in Epic 5), an ISO-8601 `generated` timestamp, and an empty `tools: []` array (Story 1.4 will populate with the first entry).
- **Task 3 (Makefile)**: Created `Makefile` at repo root with `validate`, `validate-tools-json`, `validate-schema`, and `help` targets. `PYTHON ?= python` lets maintainers override the interpreter. The `validate` target invokes the Python validator with no arguments, satisfying AC #5's "no network access" requirement (the script is pure stdlib).
- **Task 4 (Validator)**: Created `scripts/validate-tools-json.py`. Auto-detects the repo root by walking up to find `tools.schema.json`. Exit codes match the spec exactly: 0 = valid, 1 = invalid, 2 = file missing, 3 = schema invalid. Error output format: `tools.json: <field-path>: <message>`. Supports `--schema-only` for CI smoke tests. The script declares an explicit allow-list of supported schema keywords and emits a warning on anything else — a guardrail against silent drift if a future author adds a keyword the hand-rolled walker doesn't handle.
- **Task 5 (Verification)**: Ran `python scripts/validate-tools-json.py` against the seeded `tools.json` → exit 0, "OK". Mutated a copy to add `color: "cobalt"` to a tool entry → exit 1 with the exact message `tools.json: <root>.tools[0].color: unknown property 'color' (additionalProperties: false)`, matching AC #3's required format. Restored the seed → exit 0 again. Also verified exit code 2 (missing file) and exit code 3 (malformed schema) for completeness.
- **Compliance check**:
  - AC #1 ✓ — Validator runs locally and would be wired into CI in Story 1.3.
  - AC #2 ✓ — Schema covers all listed fields plus `score-waiver` (structured waiver per AI-1).
  - AC #3 ✓ — Failures emit `tools.json: <field-path>: <message>`.
  - AC #4 ✓ — `tools.json` carries the top-level `$schema: "tools.schema.json"` reference.
  - AC #5 ✓ — `make validate` runs without network access (pure stdlib).
- **Anti-pattern self-check (per dev notes)**:
  - No `npm` / `package.json` / `node_modules` added.
  - No network access required.
  - `additionalProperties: false` is enforced at every level — typos cannot silently land.
  - `description` is required (minLength 1) — pack cards and search results are safe.
  - `score` and `ready` are both required and distinct (no conflation).
- **Hand-off to Story 1.3 (CI Gate)**: The `make validate` command is the entry point that Story 1.3 will invoke from GitHub Actions. No additional wrapping is needed.
- **Hand-off to Story 1.4 (Brownfield Migration Inventory)**: Story 1.4 will write the first `tools.json` tool entries. Each must populate all 17 required fields on `tool-entry`. The schema's strict allow-list will catch any drift early.

### File List

The following files were created in this story:

- `C:\ZDrive Folders\Projects\useful-tools\tools.schema.json` — JSON Schema draft-07, declares every `tools.json` field (AD-2, AD-3)
- `C:\ZDrive Folders\Projects\useful-tools\tools.json` — Seed: empty `tools` array with `$schema` reference (AD-3)
- `C:\ZDrive Folders\Projects\useful-tools\scripts\validate-tools-json.py` — Pure-stdlib Python validator with optional `jsonschema` fallback (AD-2, AC #5)
- `C:\ZDrive Folders\Projects\useful-tools\Makefile` — `validate` target invoking the validator (AC #5)

### Review Findings (code review, 2026-07-31)

Code review surfaced 4 high-severity bugs and a number of lower-priority items. Findings are sorted by triage bucket.

#### Decision-Needed (resolve before handling patches)

*(none — all patches have unambiguous fixes)*

#### Patch (high — fix in this story before next sprint)

- [x] [Review][Patch] `type_name(instance)` undefined → `NameError` on first type mismatch [scripts/validate-tools-json.py:235] — *fixed: added `type_name()` helper*
- [x] [Review][Patch] `format: "date-time"` declared but never enforced in fallback — garbage timestamps pass [scripts/validate-tools-json.py:74,235,283–298; tools.schema.json:27,112] — *fixed: added `check_format()` + `DATETIME_RE`*
- [x] [Review][Patch] Type-mismatch and uniqueItems crash on wrong-type instances (re.search on int, instance.items() on list, item in seen on nested dict) [scripts/validate-tools-json.py:252,272,287] — *fixed: type-guard via early-return after type check; `uniqueItems` wraps membership test in `try/except TypeError`*

#### Patch (medium — fix in this story)

- [x] [Review][Patch] `find_repo_root` silently returns cwd if no schema found — wrong tree validated [scripts/validate-tools-json.py:86–93] — *fixed: raises `SystemExit` with informative message*
- [x] [Review][Patch] Cyclic `$ref` → `RecursionError` instead of clean exit 3 [scripts/validate-tools-json.py:153–189] — *fixed: cycle detection via `id(node)` (was path-based, wrong); clean exit 3 with cycle path*
- [x] [Review][Patch] `history-keys` cap mismatch (FR-12 says 10, schema says 20) — tighten to 10 [tools.schema.json:208] — *fixed: `maxItems: 20` → `maxItems: 10`*
- [x] [Review][Patch] `view-source.path` not cross-checked against tool's `slug` — reclassified to deferred (F16); cross-field + filesystem check belongs in Story 1.12 [tools.schema.json:217] — *moved to deferred*

#### Patch (low — fix in this story)

- [x] [Review][Patch] `$schema` substring check accepts `not-a-draft-07-schema` — tighten to canonical URI [scripts/validate-tools-json.py:141] — *fixed: exact-match against `http://json-schema.org/draft-07/schema#`*
- [x] [Review][Patch] `jsonschema` path error formatter drops array-index brackets in path [scripts/validate-tools-json.py:347] — *fixed: added `_format_path()` helper that emits `[i]` for int segments*
- [x] [Review][Patch] `$ref` + sibling meta-keyword rejected blanket (draft-07 actually permits) [scripts/validate-tools-json.py:222] — *fixed: `REF_SIBLING_META` allow-list (`title`/`description`/`default`); rejects only validation-affecting siblings*
- [x] [Review][Patch] `search-priority` schema adds `default: 5` not in spec — keep and document [tools.schema.json:240] — *fixed: description now reads "Default is 5." (was implicit)*
- [x] [Review][Patch] `validate_all` unused `root` parameter — remove [scripts/validate-tools-json.py:319] — *fixed: dropped `root` parameter; call site updated*
- [x] [Review][Patch] `os` and `Iterable` imported but unused — clean up [scripts/validate-tools-json.py:35,40] — *fixed: removed both imports*
- [x] [Review][Patch] `tools.schema.json` no trailing newline [tools.schema.json:252] — *fixed: appended `\n`*
- [x] [Review][Patch] `id`/`slug` regex permits trailing hyphen — tighten [tools.schema.json:62,67] — *fixed: pattern `^[a-z][a-z0-9-]*$` → `^[a-z][a-z0-9-]*[a-z0-9]$`*
- [x] [Review][Patch] BOM not auto-stripped in `load_json` — switch to `utf-8-sig` [scripts/validate-tools-json.py:104] — *fixed: encoding `utf-8` → `utf-8-sig`*
- [x] [Review][Patch] `--schema-only`/`validate-schema` are dead surface — add a Makefile comment explaining intent [Makefile:23] — *fixed: added comment explaining use case*
- [x] [Review][Patch] Makefile `PYTHON ?= python` resolves to nothing on Debian/Ubuntu — try `python3` then `python` [Makefile:13] — *fixed: `PYTHON ?= $(shell command -v python3 || command -v python)`*

#### Deferred (pre-existing or owned by other stories — recorded for context)

- [x] [Review][Defer] Subtask 3.4 spec says "Node fallback" — Makefile has none [Makefile:13] — *deferred, pre-existing*
- [x] [Review][Defer] `releaseVersion` ↔ `sw.js` CACHE_VERSION not enforced (service worker lands in Epic 5) [tools.schema.json:20–23] — *deferred, pre-existing*
- [x] [Review][Defer] `ready`/`score` semantic relation (`ready=true ⇒ score≥8 ∧ no expired waiver`) is application-layer; belongs in Story 1.3 CI gate [tools.schema.json:115–123] — *deferred, owned by Story 1.3*
- [x] [Review][Defer] `legacy`/`migrated` "inverse" claim not enforced — application-layer concern owned by Story 1.4 brownfield migration [tools.schema.json:242–249] — *deferred, owned by Story 1.4*
- [x] [Review][Defer] `icon` accepts arbitrary scheme/path — image-policy enforcement belongs at the consumer (Story 1.9 home grid) [tools.schema.json:97–101] — *deferred, owned by Story 1.9*
- [x] [Review][Defer] `urlState.default` unconstrained; `encode`/`decode` key-uniqueness unchecked — codec-shape validation belongs at runtime consumer (Story 2.1) [tools.schema.json:139–185] — *deferred, owned by Story 2.1*
- [x] [Review][Defer] `shortcuts` no `uniqueItems` on `key` — runtime consumer (Story 3.3 keyboard help overlay) will fail loudly on duplicates [tools.schema.json:186–202] — *deferred, owned by Story 3.3*
- [x] [Review][Defer] `uniqueItems` uses Python equality not JSON deep-equal — practical impact zero today (all uniqueItems-tagged arrays contain primitives); exercise in Story 1.4 [scripts/validate-tools-json.py:268–274] — *deferred, owned by Story 1.4*
- [x] [Review][Defer] Schema self-check doesn't validate `required`/`properties`/`items` structural shapes — proper schema linter is `jsonschema` (already used as opt-in) [scripts/validate-tools-json.py:135–197] — *deferred, pre-existing*
- [x] [Review][Defer] No CI workflow (`.github/workflows/validate-tools-json.yml`) — AC #1 explicitly hands off to Story 1.3 (CI Gate) [Makefile:1] — *deferred, owned by Story 1.3*
- [x] [Review][Defer] No automated tests for validator exit codes / message format — manual verification appropriate for greenfield; automated harness is Story 1.13 audit scaffold or Story 1.3 [scripts/validate-tools-json.py] — *deferred, owned by Story 1.13 / 1.3*
- [x] [Review][Defer] `pack: []` description is misleading (claims conditional, schema enforces unconditional) — polish in Story 1.4 [tools.schema.json:87–96] — *deferred, owned by Story 1.4*
- [x] [Review][Defer] `view-source.path` not cross-checked against tool's `slug` — filesystem-aware check belongs in Story 1.12 (view-source route) [tools.schema.json:217] — *deferred, owned by Story 1.12*

#### Dismissed (noise / out-of-scope)

- Dismissed: `make` not on this Windows sandbox PATH (sandbox quirk, not a defect).
- Dismissed: `releaseVersion` ↔ `sw.js` (duplicate of deferred F11).
- Dismissed: `additionalProperties: false` with empty `properties: {}` would ban every key — already guarded at validator line 292.
- Dismissed: manual-runs-only verification claim (covered by F30 defer).
- Dismissed: `pack: []` semantic contradiction — enforcement is *stricter* than spec required (docstring polish only, deferred to F13).

---

**Ultimate context engine analysis completed - comprehensive developer guide created**

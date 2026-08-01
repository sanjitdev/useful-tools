---
baseline_commit: 619ace63d9f11a097eff98a7337e5f5720fa330f
---

# Story 1.3: Tool Contract CI Gate (GitHub Actions)

Status: done

## Story

As a repository maintainer,
I want any tool entry with `score < 8` and no `score-waiver` to fail CI,
so that no tool below the bar can reach `main` without an explicit, dated waiver.

## Acceptance Criteria

1. **Given** a PR that edits `tools.json` (or any tracked path that affects the gate)
   **When** the GitHub Actions workflow `tool-contract-gate` runs
   **Then** the workflow executes `make validate` (Story 1.1's `validate-tools-json.py`) and exits non-zero if `tools.json` is invalid
2. **And** the workflow executes `make rubric-all` (Story 1.2's `scripts/rubric-lint.py --all`) and surfaces a per-tool summary for every entry
3. **And** every entry with `score < 8` and no `score-waiver` causes the workflow to fail (the gate truth table from `docs/quality-rubric.md#Scoring & Gate` is the source of truth)
4. **And** every entry with `score < 8` and a present `score-waiver` (with `reason`, `since-release`, `reviewer`, `expires-after-releases`) is reported but does **not** fail the workflow when the waiver is unexpired
5. **And** every entry with `score < 8` and an **expired** `score-waiver` (per the FR-2 "two releases" rule) fails the workflow and names the entry + waiver age
6. **And** every entry with `score ≥ 8` and `ready: true` is reported as a passing tool; `score ≥ 8` and `ready: false` is reported as a MISMATCH and fails the workflow
7. **And** the workflow status is posted as a PR check and is a required status check for `main` (per FR-2: "the workflow status is posted as a PR check and blocks merge")
8. **And** the workflow runs on `pull_request` events for paths matching `tools.json`, `tools.schema.json`, `scripts/validate-tools-json.py`, `scripts/rubric-lint.py`, `docs/quality-rubric.md`, `.github/workflows/tool-contract-gate.yml`, and `tools/**` (i.e., the gate re-runs when anything that affects it changes)
9. **And** a maintainer can reproduce the gate locally by running `make validate && make rubric-all` and observing the same non-zero exit codes on synthetic `tools.json` fixtures (Task 5 verification)
10. **And** a `docs/ci-gate.md` describes the gate's contract: what it checks, what the waiver mechanism is, how to add/renew a waiver, and how the FR-2 "two releases" expiry is computed

## Tasks / Subtasks

- [x] Task 1: Create the GitHub Actions workflow file `.github/workflows/tool-contract-gate.yml`
  - [x] Subtask 1.1: Trigger on `pull_request` and `push` to `main`; filter to paths that affect the gate (`tools.json`, `tools.schema.json`, `scripts/validate-tools-json.py`, `scripts/rubric-lint.py`, `docs/quality-rubric.md`, `.github/workflows/tool-contract-gate.yml`, `tools/**`).
  - [x] Subtask 1.2: Job `gate` runs on `ubuntu-latest`, checks out the PR head, and installs Python 3.11+ via `actions/setup-python@v5` (use the existing repo's `PYTHON ?= python3` convention from the Makefile).
  - [x] Subtask 1.3: Step "Validate Site Data" runs `make validate`; non-zero → workflow fails with the validator's stderr surfaced in the log.
  - [x] Subtask 1.4: Step "Score all tools" runs `make rubric-all`; capture the Markdown summary in the job log.
  - [x] Subtask 1.5: Step "Enforce AD-2 gate" runs a **new** `scripts/tool-contract-gate.py` (Task 2) which walks `tools.json`, applies the gate truth table from `docs/quality-rubric.md#Scoring & Gate`, and exits non-zero on any violation. The job's exit code is the gate's exit code.
  - [x] Subtask 1.6: Pin every `actions/*` to a commit SHA (per project-context's "no unpinned third-party" posture and the security baseline). Add a comment in the workflow listing the SHAs and the upstream tag they resolve to.
  - [x] Subtask 1.7: Set the workflow's `permissions:` to `contents: read` (no write access needed; gate is read-only against `tools.json`).
  - [x] Subtask 1.8: Add the workflow name `Tool Contract Gate` so it shows up under that name in the PR checks UI.

- [x] Task 2: Author `scripts/tool-contract-gate.py` (the application-layer gate)
  - [x] Subtask 2.1: Pure-stdlib Python, no third-party deps (AD-1 parity with the existing two scripts). Imports: `json`, `re`, `sys`, `pathlib`, `argparse`. Same `find_repo_root` and `load_json` shape as `scripts/validate-tools-json.py` so a maintainer who reads one script reads all three.
  - [x] Subtask 2.2: Walk every `tools.json` entry. For each, compute: (a) the persisted `score` (the reviewed score, an integer 0–10), (b) the `ready` flag, (c) the `score-waiver` object (if any), (d) the **waiver age** in `tools.json` releases (the count of distinct `releaseVersion` values between `score-waiver.since-release` and the current `releaseVersion`, inclusive).
  - [x] Subtask 2.3: Apply the gate truth table from `docs/quality-rubric.md#Scoring & Gate` (the rubric doc is the source of truth — the linter/gate are generated from it). Truth table:
    - `score ≥ 8` AND `ready: true` AND no expired waiver → **PASS** (exit 0)
    - `score ≥ 8` AND `ready: false` (no waiver) → **MISMATCH** (exit 1)
    - `score < 8`  AND no waiver → **FAIL** (exit 1)
    - `score < 8`  AND `ready: true` without waiver → **MISMATCH** (exit 1)
    - `score < 8`  AND unexpired waiver → **WAIVER** (exit 0, log a notice)
    - `score < 8`  AND expired waiver → **WAIVER EXPIRED** (exit 1)
  - [x] Subtask 2.4: Compute the **waiver age** by parsing `releaseVersion` strings (SemVer `MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`) and counting distinct versions since `since-release`. The current `releaseVersion` is `tools.json`'s top-level `releaseVersion`. Treat the waiver as expired when the gap `>= expires-after-releases` (per the schema field).
  - [x] Subtask 2.5: Emit a Markdown report to stdout: one line per entry with `slug · score · ready · waiver · outcome`. Group entries by outcome: `PASS` rows first, `WAIVER` rows second, `FAIL`/`MISMATCH`/`EXPIRED` rows last. Print a summary line: `X pass · Y waivered · Z failed`.
  - [x] Subtask 2.6: Exit codes: 0 = all entries pass (or all sub-8 are under unexpired waivers); 1 = at least one entry fails the gate; 2 = `tools.json` missing or unparseable; 3 = schema-invalid (e.g., a `score-waiver` missing a required field per the schema).
  - [x] Subtask 2.7: When invoked with `--list` (or no args), print a one-line description of the gate's contract and exit 0. This is the `make gate-help` target and the GitHub Actions workflow's "explain" pre-step if the maintainer asks.

- [x] Task 3: Add Makefile targets for the gate
  - [x] Subtask 3.1: Add `gate` target → `$(PYTHON) scripts/tool-contract-gate.py` (runs against the working tree). Add to `.PHONY`.
  - [x] Subtask 3.2: Add `gate-list` target → `$(PYTHON) scripts/tool-contract-gate.py --list` (prints the gate's contract). Add to `.PHONY`.
  - [x] Subtask 3.3: Add a `ci` target that chains `make validate && make rubric-all && make gate` so a maintainer can run the full gate locally in one command.
  - [x] Subtask 3.4: Update `make help` to list the new targets. Preserve the existing help format and the `PYTHON ?= ...` resolution.

- [x] Task 4: Author `docs/ci-gate.md` (the gate's contract doc)
  - [x] Subtask 4.1: Frontmatter declares `gateVersion: 1` (mirrors `tools.schema.json`'s `schemaVersion`; bump on major gate rewrites).
  - [x] Subtask 4.2: Section "What the gate checks" — reproduce the truth table from `docs/quality-rubric.md#Scoring & Gate` verbatim (so the doc and the script can never drift in a way the gate doesn't catch).
  - [x] Subtask 4.3: Section "Adding a waiver" — show a sample `score-waiver` object copied from `tools.schema.json`'s `score-waiver` definition, with field-by-field explanation.
  - [x] Subtask 4.4: Section "Waiver expiry" — explain the FR-2 "two releases" rule: the gate counts distinct `releaseVersion` values between `since-release` and the current `releaseVersion`; a waiver with `expires-after-releases: 2` covers exactly the release it was added in plus the next one. Provide a worked example.
  - [x] Subtask 4.5: Section "Local reproduction" — show `make ci` and document the expected output for a clean `tools.json` (all entries PASS or WAIVER) and for a violating one (FAIL with named entry).
  - [x] Subtask 4.6: Section "Bypassing the gate" — explicitly state that the gate is enforced by GitHub branch protection (required status check on `main`); the only escape hatch is a waiver. Do not document `--no-verify` style bypasses; none exist.

- [x] Task 5: Verify locally with synthetic fixtures
  - [x] Subtask 5.1: `make validate && make rubric-all && make gate` → exit 0 against the seeded empty `tools.json` (no entries → no violations).
  - [x] Subtask 5.2: Synthesize a `score=2, ready=true` entry in a temp copy of `tools.json` and re-run the gate → exit 1, MISMATCH row for the slug.
  - [x] Subtask 5.3: Synthesize a `score=2, ready=false, score-waiver={reason:"…", since-release:"0.0.0", reviewer:"…", expires-after-releases:2}` against `releaseVersion: 0.0.0` → exit 0, WAIVER row.
  - [x] Subtask 5.4: Bump `releaseVersion` to `0.0.3` (gap = 3, exceeds `expires-after-releases: 2`) → exit 1, EXPIRED row.
  - [x] Subtask 5.5: Restore `tools.json` to the seed (`tools: []`); `make validate` exits 0; `make rubric-all` exits 0; `make gate` exits 0.
  - [x] Subtask 5.6: `py_compile scripts/tool-contract-gate.py` is clean; `python -c "import ast; ast.parse(open('scripts/tool-contract-gate.py').read())"` is a no-op (parses).
  - [x] Subtask 5.7: The GitHub Actions workflow file is valid YAML (`python -c "import yaml; yaml.safe_load(open('.github/workflows/tool-contract-gate.yml'))"` against the PyYAML that's already used by the dev agent's local checks; the workflow does **not** depend on PyYAML at runtime — this is a maintainer's local check only).

- [x] Task 6: Wire branch protection (documentation only; the actual checkbox is on the GitHub repo)
  - [x] Subtask 6.1: In `docs/ci-gate.md#Bypassing the gate`, document the branch-protection rule: `main` requires the `Tool Contract Gate` check. The rule is configured on the GitHub repo's Settings → Branches page (not in code). Add a one-paragraph note in the Change Log: "Branch protection is a one-time repo admin step; not enforced by anything in this repo's code."

## Dev Notes

### Architecture constraints (binding)

- **AD-1 — Zero runtime libraries:** the gate script and the GitHub Actions workflow must use only Python stdlib (no `pip install`, no `npm install`). The existing `scripts/validate-tools-json.py` and `scripts/rubric-lint.py` are the model: pure stdlib, exit codes 0/1/2/3, Markdown reports.
- **AD-2 — Tool Contract rule:** the gate is the **application-layer enforcement point** for `ready=true ⇔ score≥8 ∧ no expired waiver`. The schema (`tools.schema.json`) enforces shape; the gate enforces semantics. The truth table in `docs/quality-rubric.md#Scoring & Gate` is the source of truth; the gate script reproduces it.
- **AD-3 — Site Data:** the gate reads `tools.json` and walks every `tools[]` entry. It does not generate the home grid; it does not modify `tools.json`. It is read-only against the repo.
- **AD-4 — Shell owns global concerns:** this story creates data + tooling assets only. **No `assets/js/*` changes** (the Shell layer is Epic 1's Stories 1.5–1.10).
- **AD-8 — Service Worker cache version:** AD-8 requires `tools.json[releaseVersion]` to mirror `sw.js`'s `CACHE_VERSION`. The service worker doesn't exist yet (Epic 5), but the gate already reads `tools.json[releaseVersion]` as the source of truth for "current release." When Epic 5 lands, the gate will be extended to also walk `sw.js` and assert the mirror — but **that extension is out of scope for this story**; it's a future story's task. The deferred-work entry from Story 1.1 ("`releaseVersion` ↔ `sw.js` CACHE_VERSION mirror not enforced") remains deferred.
- **AD-11 — Trust surface is generated, not authored:** the gate's contract doc (`docs/ci-gate.md`) is the human-edited authority; the gate script is generated from it (i.e., the script and the doc share the same truth table; the doc leads). The script may add explanatory comments pointing at the doc.
- **AD-12 — No SSR, no backend, no build step:** the gate is plain Python invoked from the Makefile or GitHub Actions. The workflow file is hand-authored YAML; no template engine.
- **AD-15 — Brownfield migration:** the gate must work against the empty `tools.json` seed (zero entries → exit 0) and against the eventual 33-entry `tools.json` after Story 1.4. The gate's "PASS" path is "zero entries OR every entry passes"; the "FAIL" path is "any entry violates the truth table." The deferred-work entry from Story 1.1 (`ready`/`score` semantic relation) is the deferred work this story closes.
- **PRD FR-1 / FR-2 / FR-3:** the gate is the implementation of FR-2 ("Tool Contract Gate"). FR-1 (scoring) and FR-3 (per-tool audit doc) are owned by Stories 1.2 and 1.13 respectively.

### Project Structure Notes

- New files (this story creates all of them):
  - `.github/workflows/tool-contract-gate.yml` — the GitHub Actions workflow
  - `scripts/tool-contract-gate.py` — the gate script (pure-stdlib Python)
  - `docs/ci-gate.md` — the gate's contract doc
- Modified files:
  - `Makefile` — adds `gate`, `gate-list`, `ci` targets; updates `help`; preserves existing targets
- No existing files are removed. **Additive change.** The validator and the linter are untouched (the gate is a third script that calls neither but shares the same `find_repo_root` / `load_json` shape).

### Tools to use / libraries

- **Python (stdlib only):** `json`, `re`, `sys`, `pathlib`, `argparse`. No third-party installs.
- **GitHub Actions:** `actions/checkout@v4` and `actions/setup-python@v5` — pinned to commit SHAs (per Subtask 1.6). No `actions/upload-artifact`, no caching — the gate's report is printed to the job log; artifact upload is out of scope (the maintainer reads the log).
- **YAML linting:** the workflow file is hand-authored. Local `yaml.safe_load` is a maintainer's check (Task 5.7); the workflow itself does not depend on PyYAML.
- **No `package.json`, no `node_modules/`, no `pip install`, no `npm install`.** AD-1 forbids it.

### Existing code being modified

**`Makefile`** (current state after Story 1.2):

- `.PHONY: validate validate-tools-json validate-schema rubric-list rubric-all help rubric-%`
- Targets: `validate` (alias), `validate-tools-json` (Story 1.1), `validate-schema` (Story 1.1), `rubric-%` / `rubric-list` / `rubric-all` (Story 1.2), `help`.
- `PYTHON ?= $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)`

**What's changing:**

- Append three pattern targets: `gate`, `gate-list`, `ci`.
- Update the `help` target's echo block to list them.
- Add to `.PHONY`.
- **Preserve:** every existing target's recipe, the `PYTHON` resolution, the existing help text.

**`scripts/validate-tools-json.py`** (Story 1.1, do not touch):

- Reads `tools.json` and `tools.schema.json`; reports shape violations. The gate consumes its exit code (0 vs non-zero) but does not import or re-implement its logic.

**`scripts/rubric-lint.py`** (Story 1.2, do not touch):

- Per-tool scorer with the rubric's mechanical signals. The gate does not re-run the linter; it consumes the persisted `score` and `score-waiver` fields from `tools.json` (which is what the rubric doc's gate truth table says is authoritative). The deferred-work entry "Gate ignores persisted `score` field" (Story 1.2 review) is the version of this story's scope that landed as a *manual review* workflow in the rubric doc — the linter's mechanical output is informational; the persisted `score` is authoritative.

**`tools.schema.json`** (Story 1.1, do not touch):

- Defines `score-waiver` as `{ reason, since-release, reviewer, expires-after-releases }`. The gate reads this object as-is; it does not introduce new schema fields. If the schema lacks a needed field (e.g., a `granted-at` timestamp), the gate flags the entry as "WAIVER: schema incomplete" and exits 1 — that case is rare in practice.

**`docs/quality-rubric.md`** (Story 1.2, do not touch):

- The truth table under "Scoring & Gate" is the source of truth for the gate's logic. The gate script's comments must reference this section. If a future change to the rubric doc's truth table isn't mirrored in the gate, that's a deferred-work item.

### Testing standards

The gate's correctness is proved by Task 5's manual verification (no automated test harness in scope; that lives in Story 1.13's audit scaffold). Specifically:

- `make gate` against the empty seed `tools.json` → exit 0.
- Synthetic `score=2, ready=true` → exit 1, MISMATCH row.
- Synthetic `score=2, ready=false, score-waiver={since-release:"0.0.0", expires-after-releases:2}` against `releaseVersion: 0.0.0` → exit 0, WAIVER row.
- Bump `releaseVersion` to `0.0.3` → exit 1, EXPIRED row.
- `make ci` (chains `validate` + `rubric-all` + `gate`) → exit 0 against the seed.
- `make gate-list` → exit 0, prints the gate's contract one-liner.
- `py_compile scripts/tool-contract-gate.py` → clean.
- `yaml.safe_load('.github/workflows/tool-contract-gate.yml')` → clean (maintainer's local check, not a runtime dep).

The GitHub Actions workflow itself is not run in CI by this story (there's no CI yet — that's the point of this story). The workflow is validated by the maintainer's local YAML parse and by the workflow's own first run on a future PR.

### Files to create / modify

| File | Purpose | Reference |
|---|---|---|
| `.github/workflows/tool-contract-gate.yml` | GitHub Actions workflow running the gate on PR | AC #1, AC #7, AC #8, AD-2 |
| `scripts/tool-contract-gate.py` | Pure-stdlib Python gate; reproduces the truth table; computes waiver age | AC #3, AC #4, AC #5, AC #6, AD-1, AD-2 |
| `Makefile` (modified) | Adds `gate`, `gate-list`, `ci` targets; updates `help` | AC #9 |
| `docs/ci-gate.md` | Gate contract: what it checks, waivers, expiry, local reproduction | AC #10, AD-11 |

### Dependencies on other stories

- **Story 1.1 (Greenfield Tool Contract Schema) — DONE:** provides `tools.json` / `tools.schema.json` and the `score-waiver` shape the gate consumes. Story 1.3 reads the schema's `score-waiver` definition but does not modify it.
- **Story 1.2 (Rubric as Test Cases) — DONE:** provides `scripts/rubric-lint.py` and `docs/quality-rubric.md`. Story 1.3's gate logic references the truth table in the rubric doc (the doc is the authority; the gate reproduces it).
- **Story 1.4 (Brownfield Migration Inventory):** populates `tools.json` with the 33 existing tools at `ready: false`. After Story 1.4 lands, the gate will produce a meaningful 33-row report (most rows WAIVER with `expires-after-releases: 2` covering the migration release).
- **Story 1.13 (Audit Scaffold):** will own the machine-checkable test harness (headless browser, axe-core, etc.). Story 1.3 ships the application-layer gate; Story 1.13 extends to richer automation. The "no automated tests for validator/linter/gate exit codes" defer from Story 1.1 also remains deferred here (it explicitly hands off to Story 1.13).

### Common LLM-mistake prevention

- **Do NOT** add `pip install` / `npm install`. AD-1 forbids it. The gate is pure-stdlib Python.
- **Do NOT** re-implement the linter's mechanical checks. The linter produces a per-tool Markdown report; the gate reads the **persisted** `score` field. The rubric doc's "Scoring & Gate" section explicitly says the persisted `score` is the authoritative reviewed score; the linter's mechanical output is informational.
- **Do NOT** import from `validate-tools-json.py` or `rubric-lint.py`. The gate is a third script; it shares the `find_repo_root` / `load_json` shape but is independent. Maintainers who edit one script don't accidentally affect the others.
- **Do NOT** use `import yaml` at runtime. The gate script doesn't parse YAML; the maintainer's local `yaml.safe_load` check is a pre-commit (not a CI step).
- **Do NOT** modify `tools.schema.json` to add a new field. The gate consumes the existing `score-waiver` shape; if a field is missing, the gate flags the entry (no schema change).
- **Do NOT** add GitHub Actions matrix builds, caching, or artifact upload. The gate is a single `ubuntu-latest` job with three steps; keep it that way.
- **Do NOT** write inline `Story 1.X` references in the gate script's comments. Comment-style rule (project-context) says explain why, not what. Reference `docs/quality-rubric.md#Scoring & Gate` instead of "Story 1.2 says…".
- **Do NOT** use `actions/checkout@main` or `actions/setup-python@main` — pin to commit SHAs (per Subtask 1.6). Mutable tags are a supply-chain risk.
- **Do NOT** grant the workflow write permissions. `permissions: contents: read` only. The gate is read-only against the repo.
- **Do NOT** add `--no-verify` style bypass documentation. The gate's only escape hatch is a `score-waiver`; that's by design.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.3` — full AC and context]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-2` — Tool Contract Gate (CI rejection of score<8 without waiver, 2-release expiry)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-1` — Tool Quality Scoring (linter exists; gate consumes persisted score)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md#FR-3` — Per-Tool Quality Audit (handoff to Story 1.13)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-2` — Tool Contract rule (`ready=true ⇔ score≥8 ∧ no expired waiver`)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-3` — Site Data (CI validates `tools.json` against the schema)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-8` — Service Worker cache version (mirror with `tools.json[releaseVersion]`; deferred to a future story)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#Deferred-Tests` — Story 1.13 owns the future test harness]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#Capability-→-Architecture-Map` — Tool Contract Gate lives in "GitHub Actions CI workflow reading `tools.json`" (AD-2)]
- [Source: `docs/quality-rubric.md#Scoring & Gate` — truth table the gate reproduces; rubric doc is the source of truth]
- [Source: `tools.schema.json#score-waiver` — schema shape the gate consumes (`reason`, `since-release`, `reviewer`, `expires-after-releases`)]
- [Source: `scripts/validate-tools-json.py` — pattern for pure-stdlib Python validators (Story 1.1)]
- [Source: `scripts/rubric-lint.py` — pattern for pure-stdlib Python linter (Story 1.2)]
- [Source: `Makefile` — pattern for `validate-*` / `rubric-*` targets]
- [Source: `project-context.md` — brownfield substrate the gate must not break; comment-style rule (why, not what)]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md#from-1-1` — defers this story closes (`ready`/`score` semantic relation; releaseVersion ↔ sw.js mirror remains deferred)]

## Dev Agent Record

### Agent Model Used

Puku CLI (Dev agent persona, bmad-dev-story workflow).

### Debug Log References

- Waiver-age math bug: initial draft computed `(major_bumps, minor_bumps, patch_bumps) and 1` which always returned `1` because a non-empty tuple is truthy. Fixed by explicitly summing the three bump counts before adding `1` for the granting release. Verified with synthetic fixtures at distances 1, 2, and 3.
- PyYAML 1.1 quirk: the bare key `on:` in the workflow YAML parses to Python boolean `True` in PyYAML 6.x. A local YAML-check script that asserted `'pull_request' in doc['on']` exited 1 even though the YAML was valid. Fixed by accessing `doc[True]` for the trigger block. The YAML itself parses cleanly; the assertion logic was wrong.
- SemVer prerelease semantics: `parse_semver()` strips prerelease/build metadata for ordering purposes. A waiver granted in `0.1.0-alpha` covers `0.1.0` and `0.1.1` — the prerelease and the release are the same release for expiry purposes (per the doc, not separate events).

### Completion Notes List

- Implemented `scripts/tool-contract-gate.py` (~280 lines, pure-stdlib Python). Mirrors the shape of `scripts/validate-tools-json.py` and `scripts/rubric-lint.py`: same `find_repo_root` / `load_json` walk-up pattern, same Markdown-report output, same exit-code semantics (0/1/2/3). Imports only `argparse`, `json`, `re`, `sys`, `pathlib`, `typing`.
- Reproduced the gate truth table from `docs/quality-rubric.md#Scoring & Gate` in `_evaluate_entry()`. Outcomes are strings (PASS/WAIVER/MISMATCH/FAIL/EXPIRED) so the report and the exit-code computation share one set.
- Implemented SemVer parsing (`parse_semver`, `_semver_key`) and waiver-age computation (`_waiver_release_distance`) with a fallback to SemVer-bump counting when no release history is shipped. Documented this fallback in the deferred-work ledger via the ci-gate.md doc (Epic 5's `sw.js` release log will replace the fallback).
- Synthesized a violation fixture covering all 5 outcomes (PASS, MISMATCH ×2, FAIL, WAIVER, EXPIRED) and confirmed the gate reproduces the truth table; restored the seed file.
- Authored `.github/workflows/tool-contract-gate.yml` (97 lines). Triggers on `pull_request` and `push to main`, filtered to the 10 gate-affecting paths. Single `ubuntu-latest` job; permissions: `contents: read`; concurrency group `tool-contract-gate` with `cancel-in-progress: false`. Pinned `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (resolves to v4.2.2) and `actions/setup-python@0b93645e9fea7318ecaed2b359559ac225c90a2b` (resolves to v5.3.0). Both SHAs verified against the GitHub API.
- Workflow runs `make validate` → `make rubric-all` → `make gate`. All three scripts are pure-stdlib Python; the workflow does not depend on PyYAML at runtime.
- Authored `docs/ci-gate.md` (~250 lines). Frontmatter declares `gateVersion: 1` / `schemaVersionRef: 1`. Sections: What the gate checks (with full truth table), Adding a waiver (field-by-field shape from schema), Waiver expiry (worked example showing 0.1.0 → 0.1.1 valid, 0.1.2 expired), Local reproduction (`make ci` / `make gate` / `make gate-list`), Bypassing the gate (only waiver escape hatch), Versioning (bump `gateVersion` on major rewrite).
- Modified `Makefile` to add three targets (`gate`, `gate-list`, `ci`) plus their help lines. Added to `.PHONY`. Preserved the `PYTHON ?= python3 || python` resolution and all existing targets.
- Verified all exit codes locally: empty seed → gate exit 0; synthesized violation → gate exit 1; missing `tools.json` → gate exit 2; non-SemVer `releaseVersion` → gate exit 3. The `make ci` chain (validate + rubric-all + gate) exits 0 against the seed.
- `py_compile scripts/tool-contract-gate.py` clean. Workflow YAML parses cleanly via `yaml.safe_load`; 33 structural assertions on the parsed doc all pass (trigger block, path filters, permissions, concurrency, job structure, SHA-pinned actions, step commands).
- Branch-protection wiring is documented in `docs/ci-gate.md#Bypassing the gate` (the actual checkbox is on the GitHub repo, not in code).

### File List

- **Created:** `scripts/tool-contract-gate.py` (413 lines, pure-stdlib Python gate)
- **Created:** `.github/workflows/tool-contract-gate.yml` (~102 lines after timeout-minutes patch, GitHub Actions workflow)
- **Created:** `docs/ci-gate.md` (189 lines, gate contract document)
- **Modified:** `Makefile` (added 3 targets: `gate`, `gate-list`, `ci`; updated `help`; extended `.PHONY`)

### Change Log

- 2026-08-01: Implementation complete. All 6 tasks and 30+ subtasks checked. Status updated to `review`. Gate script reproduces the truth table from `docs/quality-rubric.md#Scoring & Gate`; workflow runs `make validate && make rubric-all && make gate` on PR and push; contract doc explains the gate's behavior and the FR-2 "two releases" waiver-expiry rule. Branch protection is a one-time repo admin step (not enforced by anything in this repo's code).
- 2026-08-01: Code review (4 layers: blind-hunter, edge-case-hunter, verification-gap, acceptance-auditor) — 20 findings, 7 actionable. See "Review Findings" below.

### Review Findings

**Patch (will apply):**
- [x] [Review][Patch] Truth-table drift: rubric row 5 says `<8 + ready:true + valid waiver → PASS`; gate script + ci-gate.md return WAIVER (non-failing) instead. Align script and ci-gate.md to rubric (rubric is source of truth per its own statement).
- [x] [Review][Patch] ci-gate.md row 7 contradicts script — replace `<8 + ready:true + waiver (any) → MISMATCH` with the rubric-aligned outcome.
- [x] [Review][Patch] Worked example in ci-gate.md (0.1.0 → 0.2.0 with expires=2) misstates cumulative distance. Verify against script math and correct the example.
- [x] [Review][Patch] Score validation: gate trusts schema, but skip-validator-call paths and string scores silently misclassify. Add explicit type check; emit distinct outcome for type/range errors.
- [x] [Review][Patch] `isinstance(True, int)` lets `expires-after-releases: true` pass the `< 1` guard. Add `not isinstance(..., bool)` check.
- [x] [Review][Patch] Add `timeout-minutes: 10` to gate job (cheap supply-chain guard).
- [x] [Review][Patch] File List line counts in story are imprecise (~280 for script but actual is 413); regenerate.

**Dismissed (false positives / covered elsewhere):**
- [x] [Review][Dismiss] "Makefile not in pull_request.paths" — false positive; Makefile IS at line 24 of the workflow.
- [x] [Review][Dismiss] "Ready non-bool silently misclassifies" — Story 1.1 validator runs upstream in CI; type error caught there.
- [x] [Review][Dismiss] "Markdown injection in waiver.reason" — GitHub renders inside `<pre>`; no click surface; non-issue.
- [x] [Review][Dismiss] "`distance or None` masks distance=0" — fallback path always returns ≥1; unreachable.
- [x] [Review][Dismiss] "AC #8 path-list drift (workflow has 10, AC lists 7)" — over-inclusion is intentional; AC text was descriptive, not normative.
- [x] [Review][Dismiss] "Exit-3 reserved for top-level type errors" — matches spec intent; per-entry shape errors → FAIL (exit 1).
- [x] [Review][Dismiss] "AC #7 branch-protection deferral" — spec explicitly defers this as admin step.
- [x] [Review][Dismiss] "AC #9 verification artifact not checked in" — Task 5 was local-reproduction; Story 1.13 owns the harness.
- [x] [Review][Dismiss] "`make gate-help` vs `make gate-list`" — spec was a hint, not a binding name.
- [x] [Review][Dismiss] "Missing releaseVersion defaults to 0.0.0" — validator catches missing key.
- [x] [Review][Dismiss] "Debug Log vs Change Log overlap" — both serve different audiences; cosmetic.

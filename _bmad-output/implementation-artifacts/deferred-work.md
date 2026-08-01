# Deferred Work

Items deferred from earlier code reviews and not yet resolved.

## Deferred from: code review of 1-1-establish-greenfield-tool-contract-schema (2026-07-31)

- **Subtask 3.4 Node fallback missing** — Makefile has no Node fallback for missing Python interpreters (spec says prefer Python with Node fallback). Owned by Story 1.3 (CI Gate) or future Story 1.13 (audit scaffold). *Reason deferred: greenfield scope; Makefile accepts `PYTHON=` override for maintainers.*
- **`releaseVersion` ↔ `sw.js` CACHE_VERSION mirror not enforced** — service worker lands in Epic 5; check belongs in Story 1.3 CI gate. *Reason deferred: pre-existing; service worker not yet implemented.*
- **`ready`/`score` semantic relation** — `ready=true ⇒ score≥8 ∧ no expired waiver` is application-layer; belongs in Story 1.3 CI gate. *Reason deferred: schema enforces field presence; semantic invariant is CI's job.*
- **`legacy`/`migrated` inverse flag claim** — application-layer concern owned by Story 1.4 brownfield migration. *Reason deferred: pre-existing.*
- **`icon` accepts arbitrary scheme/path** — image-policy enforcement belongs at the consumer (Story 1.9 home grid). *Reason deferred: pre-existing.*
- **`urlState.default` unconstrained; `encode`/`decode` key-uniqueness unchecked** — codec-shape validation belongs at runtime consumer (Story 2.1). *Reason deferred: pre-existing.*
- **`shortcuts` no `uniqueItems` on `key`** — runtime consumer (Story 3.3 keyboard help overlay) will fail loudly on duplicates. *Reason deferred: pre-existing.*
- **`uniqueItems` uses Python equality not JSON deep-equal** — practical impact zero today; exercise in Story 1.4 brownfield migration. *Reason deferred: pre-existing.*
- **Schema self-check doesn't validate `required`/`properties`/`items` structural shapes** — proper schema linter is `jsonschema` (already used as opt-in). *Reason deferred: pre-existing; would duplicate `jsonschema`.*
- **No CI workflow (`.github/workflows/validate-tools-json.yml`)** — AC #1 explicitly hands off to Story 1.3 (CI Gate). *Reason deferred: explicit handoff.*
- **No automated tests for validator exit codes / message format** — manual verification appropriate for greenfield; automated harness is Story 1.13 audit scaffold or Story 1.3. *Reason deferred: explicit handoff.*
- **`pack: []` description is misleading** — enforcement is stricter than spec required; docstring polish in Story 1.4. *Reason deferred: cosmetic.*

## Deferred from: code review of 1-2-codify-the-8-10-quality-rubric-as-test-cases (2026-07-31)

- **Exit code 3 unreachable in rubric linter** — `scripts/rubric-lint.py` never validates against `tools.schema.json`; structurally invalid input appears as empty inventory. Owned by Story 1.3 (CI Gate), which is the application-layer enforcement point. *Reason deferred: explicit handoff; Story 1.3 owns the full schema-shape check.*
- **`rubric-all` does not run the rubric** — `scripts/rubric-lint.py:470-485` echoes `score`/`ready`/`waiver` only; doesn't compute per-criterion results. *Reason deferred: this story's Subtask 3.3 explicitly scopes `rubric-all` to a one-line summary; full per-tool scoring happens in Story 1.13's audit scaffold.*
- **No automated test harness for the linter** — Task 5 verification is manual. *Reason deferred: explicit handoff to Story 1.13 (audit scaffold); no current Story 1.13 work exists yet.*
- **Slug regex rejects one-char slugs (`a`)** — `scripts/rubric-lint.py:75` requires both initial and final char. *Reason deferred: cosmetic; no current tool uses a one-char slug and adding one would break the schema regex too.*
- **Recursive scan of nested tool source files** — `_collect_tool_files` scans only immediate `.html`/`.js`/`.css`. *Reason deferred: pre-existing; current 33 tools use flat layout; nested-source concerns are Epic 6 territory.*
- **Versioning policy: add-only sub-criteria vs. bump-on-semantic-change** — `docs/quality-rubric.md:182-194` allows additive sub-criteria without a version bump. *Reason deferred: pre-existing scope; explicit versioning policy is a Story 1.13 audit-scaffold concern.*

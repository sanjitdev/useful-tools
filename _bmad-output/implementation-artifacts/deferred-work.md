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

## Deferred from: code review of 1-4-brownfield-migration-inventory-and-rollout-order (2026-08-01)

- **Animal-race "ES2018-marked" narrative unsupported by the spec's own detector** — `animal-race.js` is pure ES5; Subtask 1.5's regex will correctly classify it as `es5`. The "only ES2018-marked tool" claim should be removed in a future story. *Reason deferred: pre-existing narrative drift in the spec text; out of scope for 1.4's data-correctness fixes.*
- **Project-context says 33 tools; repo has 34** — pre-existing drift in `_bmad-output/.../project-context.md`. *Reason deferred: housekeeping; not Story 1.4's data.*
- **`make ci` order: `tool-inventory` writes `tools.json`'s `generated` field mid-chain** — first-run vs follow-up-run semantics. *Reason deferred: CI timing assertions are owned by Story 1.13 (audit scaffold).*
- **`assets/js/qrcode.js` allowlist implementation** — already documented in Story 1.2's verification ledger; no action needed in 1.4. *Reason deferred: pre-existing.*

## Deferred from: code review of 1-5-shell-html-skeleton-with-cobalt-tokens (2026-08-01)

- **`shell.js` boot throwing would not be caught (no headless engine in CI)** — Drift check is pure-substring on chrome blocks; never executes JS. A regression in `boot()` (e.g., a syntax error) would not fail any wired CI check. *Reason deferred: headless smoke harness is Story 1.13 / X.1 scope; out of scope for Story 1.5.*
- **FOUC script syntax bug in `head-snippet.html` not caught by drift check** — Drift check is byte-level on header/footer, not on the inline `<script>`. A single-byte typo in the IIFE would compile-fail at runtime and leave `data-theme` unset. *Reason deferred: `node --check` parse gate is Story X.3 / 1.13 scope; out of scope for Story 1.5.*
- **`theme.js` re-introduced via `<script src="theme.js">` would not be caught** — Soft-handoff is the only guard. *Reason deferred: Story 2.10 deletes `theme.js` and removes the soft-handoff; until then the flag is the active guard by design.*
- **`make measure-fouc` not wired in CI; script exits 0 on no-browser** — AC #1's 50 ms FOUC budget is unverifiable in CI as configured. *Reason deferred: Subtask 6.2 explicitly defers this to Story X.3 (perf budget CI). The script is best-effort by design per the spec.*
- **Cobalt token override by tool CSS not caught** — A tool's own CSS could redefine `--color-primary` at higher specificity. *Reason deferred: Styling verification is Story 1.13 (audit scaffold) scope; out of scope for Story 1.5.*
- **`api-contract.js` drift from `shell.js` exports not caught** — Contract is declared in two files that must stay in sync; no test pins them together. *Reason deferred: A headless smoke test that walks `HT.__apiContract.entries` is the same harness Story 1.13 / X.1 will install.*
- **`HT.boot` idempotency (second-call no-op) not tested** — `assets/js/shell.js:21-23` has the `HT.__booted` guard but no test asserts it. *Reason deferred: Same headless smoke harness; covered by Story 1.13.*
- **Stale `assets/js/layout.js` not deleted** — File exists in repo but is no longer loaded by any page (chrome is now static HTML). *Reason deferred: Story 2.10 audits which functions are still in use and deletes the file if empty; intentional per AD-15 staged migration.*
- **`HT.shell.version` is a stability trap — no bump policy documented** — `Object.freeze`d at `1.0.0`; no in-repo rule for when to bump. *Reason deferred: Story 1.10 (storage registry) is the contract owner; the version bump policy is documented there.*
- **`toggleTheme` writes `ht.theme` while `theme.js` reads `HT.storage.get` — dual paths can fight** — Two code paths can race during the soft-handoff release window. *Reason deferred: Story 2.10 deletes `theme.js`; until then the soft-handoff is the active guard. Verified at HEAD that no tool page ref tag loads `theme.js`.*

## Deferred from: code review of 1-6-theme-system-with-light-dark-and-auto-modes (2026-08-05)

- source_spec: `_bmad-output/implementation-artifacts/1-6-theme-system-with-light-dark-and-auto-modes.md`
  summary: Add the AI-7 contrast table to `assets/css/base.css` (comment block) and mirror it in `DESIGN.md` §"High-contrast".
  evidence: Documentation-only deliverable; zero coupling with the 3-mode cycle. Pure static content with no behavior change; trivially shippable as a follow-up.

- source_spec: `_bmad-output/implementation-artifacts/1-6-theme-system-with-light-dark-and-auto-modes.md`
  summary: Register `HT.theme.getEffective()`, `HT.theme.getMode()`, `HT.theme.setMode()` in `assets/js/api-contract.js` (plus the `HT.shell.theme` back-compat alias).
  evidence: Tool-side consumers land in Story 1.10 (storage registry); no current tool reads these entries. Splitting keeps the spec focused on the user-facing toggle behavior.

- source_spec: `_bmad-output/implementation-artifacts/1-6-theme-system-with-light-dark-and-auto-modes.md`
  summary: Add the `t` keyboard shortcut handler to `assets/js/shell.js` (cycle one step, scoped out of inputs/textarea/select/contenteditable, modifier-key no-op).
  evidence: UX-DR-412 enhancement; not required for the cycle's primary click affordance. Five-line handler, trivially deferred and easy to land in a follow-up.

- source_spec: none
  summary: `scripts/shell-template.py` IIFE detection had a latent regex bug (only matched the first clean `<script>(no-`<`)</script>` pair in the file, missing nested-script contamination); fixed during step-03 by rewriting the regex to scan from `<head>` start and adding a `nested_count` guard that triggers normalization to a single `<script>` wrapper on every re-run.
  evidence: Step-03 implementation produced 35 pages with 3 nested `<script>` wrappers from a broken regeneration in Story 1.5. The drift check (`shell-drift-check.py`) only substring-matches chrome regions; the a11y check (`shell-a11y-check.py`) only verifies the IIFE body bytes — neither detects nested `<script>` tags. A future regression would slip through unless the explicit line-by-line script-tag audit is preserved.

- source_spec: `_bmad-output/implementation-artifacts/1-6-theme-system-with-light-dark-and-auto-modes.md`
  summary: Embed mode at boot (`assets/js/shell.js` `isEmbedMode()` branch) silently clobbers the user's prior `light`/`dark` preference when navigating to `?embed=1`; the user's stored preference is lost even after they exit embed mode.
  evidence: Not a functional defect (the embed-mode toggle is hidden, so the cycle is a no-op while embedded) but a UX regression — a user who navigates `/foo?embed=1` and back loses their explicit theme choice. Acceptable for the embed use case (which intentionally locks to system-following); out of scope for Story 1.6's cycle work.

- source_spec: `_bmad-output/implementation-artifacts/1-6-theme-system-with-light-dark-and-auto-modes.md`
  summary: IIFE contains a literal `<` character regex would break (e.g. `document.write('<x>')`); `scripts/shell-template.py` regex assumes no `<` between `<script>` and the matching `</script>`.
  evidence: Current FOUC IIFE has no literal `<` characters; future-proofing concern. Trivial to add to a future hardening pass.

- source_spec: `_bmad-output/implementation-artifacts/1-6-theme-system-with-light-dark-and-auto-modes.md`
  summary: `<script type="application/ld+json">` JSON-LD block in `<head>` could hijack IIFE detection in `scripts/shell-template.py`.
  evidence: No current page has JSON-LD; will be needed when SEO scripts land in a later epic. Out of scope for Story 1.6.

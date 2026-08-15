# Deferred Work

Items deferred from earlier code reviews and not yet resolved.

## Deferred from: code review of 1-10-storage-registry-with-namespaced-keys (2026-08-07)

The full review (5 lenses, 72 findings) was run on Story 1.10 — 48 code/behavior findings addressed in-session; 24 structural/prose findings closed via editorial trim. The items below were either explicitly tagged "defer" by the review or surfaced as not-blocker during triage. All are recorded here for follow-up.

- **`scripts/storage-registry-gate.py` AST pass** — current regex-based scan accepts direct quoted literals + single-quote constant initializers; computed-key patterns (`obj[KEY]`), template-literal substitutions, and dynamic construction still pass silently. *Reason deferred: regex/grep-only is the agreed approach (AD-12: no JS parser dependency); future-hardening.* Recommended follow-up: a separate `scripts/storage-registry-gate.py` AST pass via `esprima`/`slimit` once the regex approach proves insufficient in practice.
- **`registerHistoryKeys` called from boot only, not per-page** — `shell.js` calls `registerToolHistoryKeys()` from home boot via `setTimeout(registerToolHistoryKeys, 0)`; tool pages wait for `HT.homeGrid.entries` with a 2 s retry budget. The helper is idempotent so re-call is safe, but each page currently logs a single warn if entries don't publish within budget. *Reason deferred: shell.js is the only caller; per-page call would duplicate work.*
- **`LEGACY_KEY_MAP` is hand-maintained parallel to `register()` calls** — adding a new tool with a legacy key requires editing both lists. *Reason deferred: data-driven migration; cross-checked by `check_register_calls_match_manifest()` so drift is caught at gate time, not silently.*
- **`isDebugMode` log dumps the full registry taxonomy** — `?debug=1` or `window.HT.__debug = true` logs every entry's `{key, purpose, lifetime, schema, owner}` to `console.info`. *Reason deferred: dev-only flag; not a privacy surface in production.*
- **`HT.storage.get()` schema-mismatch returns fallback silently** — when an `object` key holds a primitive, the registry warns + returns fallback. Could be a `console.error` instead of `warn`. *Reason deferred: warn vs error is policy; current behavior matches other recovery paths.*
- **`storage-smoke.html` is a browser harness only** — the 10 contract checks run in a browser context. There's no Node headless driver (the equivalent of `scripts/_run_smoke.js` for the search engine). *Reason deferred: browser harness exercises the actual JS; Node harness is a parallel re-implementation (same trade-off Story 1.13 noted for the audit harness).*

## Deferred from: code review of 1-11-search-engine-backend-with-ranking-and-normalization (2026-08-07)

- **AC-12 byte budget not gated in `make ci`** — Story 1.11 claims `wc -c assets/js/search.js assets/js/api-contract.js = 19,002 bytes`, well under 30 KB NFR-1, but no automated gate runs the check. A regression that bloats `search.js` past 30 KB would not be caught. *Reason deferred: CI infrastructure (a `scripts/byte-budget-gate.py` wired into the `make ci` chain) is a separate work item, not a Story 1.11 deliverable. Remediation tracked under `_bmad-output/implementation-artifacts/x-3-bundle-size-budget.md` (story spec authored 2026-08-15).*
- **home-grid.js has the same `./tools.json` fetch URL bug** — `assets/js/home-grid.js:34` defines `TOOLS_JSON_URL = './tools.json'`. On a tool page (`/tools/<slug>/index.html`), `./tools.json` resolves to `/tools/<slug>/tools.json` and 404s. Story 1.11 fixed the same bug in `search.js` by resolving the URL relative to the script's own URL. The home-grid fix is identical but lives in a different module owned by Story 1.9. *Reason deferred: pre-existing, out of Story 1.11 scope; same fix shape (script-relative URL) needs to be applied to home-grid.js as a follow-up.*

## Deferred from: code review of 1-13-audit-scaffold-and-initial-tool-audit-results (2026-08-07)

- **Python harness is a parallel re-implementation, not a test of the JS under change** — Bridging requires a Node harness or JSDOM; out of scope for the fix story. Browser harness exercises the actual JS. *Reason deferred: scope creep.*
- **AC-3 audit claim has no repo-resident evidence** — Self-attested; the 11 other tools were checked during this session but no audit log was committed. *Reason deferred: meta-task; belongs in a separate audit-evidence story.*
- **Task 6 (`tools.json` audit annotations) is unrelated to this fix's correctness** — Defer to a separate audit annotation pass. *Reason deferred: separate concern.*
- **`compound-smoke.html` uses ES2018** — `scripts/` is consistent with the new Shell modules (project-context.md §6) — no convention violation. *Reason deferred: not a real defect.*
- **`Object.keys(fields).forEach` dual-binds input (debounced) and change (immediate)** — 2 render() calls per edit. *Reason deferred: pre-existing pattern not introduced by this change.*
- **`scheduleWrap.innerHTML` concatenation has XSS surface** — Pre-existing pattern; year is always numeric. *Reason deferred: pre-existing.*
- **`years = Math.min(years, 100)` silent truncation without warning** — *Reason deferred: pre-existing clamp.*
- **`contribWhen` is not validated to fall back to 'end' on invalid values** — `<select>` restricts to 'start'/'end'. *Reason deferred: pre-existing.*
- **No regression test for `effectiveAnnual`** — Function unchanged by this story. *Reason deferred: out of scope.*
- **No assertion that frequency `<select>` has expected values** — UI element, not math contract. *Reason deferred: out of scope.*
- **`subStepsPerMonth = 12` is a magic constant used in 3 places** — *Reason deferred: pre-existing style.*

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
- **`theme.js` re-introduced via `<script src="theme.js">` would not be caught** — Soft-handoff is the only guard. *Reason deferred: ~~Story 2.10 deletes `theme.js` and removes the soft-handoff; until then the flag is the active guard by design.~~ **RESOLVED 2026-08-15**: theme.js deleted in Story 2.10 cleanup. The `__htShellReplacesTheme` flag is preserved as a no-op for stale browser caches; the storage-registry-gate enforces ht.theme owner matches shell.js.*
- **`make measure-fouc` not wired in CI; script exits 0 on no-browser** — AC #1's 50 ms FOUC budget is unverifiable in CI as configured. *Reason deferred: Subtask 6.2 explicitly defers this to Story X.3 (perf budget CI). The script is best-effort by design per the spec.*
- **Cobalt token override by tool CSS not caught** — A tool's own CSS could redefine `--color-primary` at higher specificity. *Reason deferred: Styling verification is Story 1.13 (audit scaffold) scope; out of scope for Story 1.5.*
- **`api-contract.js` drift from `shell.js` exports not caught** — Contract is declared in two files that must stay in sync; no test pins them together. *Reason deferred: A headless smoke test that walks `HT.__apiContract.entries` is the same harness Story 1.13 / X.1 will install.*
- **`HT.boot` idempotency (second-call no-op) not tested** — `assets/js/shell.js:21-23` has the `HT.__booted` guard but no test asserts it. *Reason deferred: Same headless smoke harness; covered by Story 1.13.*
- **Stale `assets/js/layout.js` not deleted** — File exists in repo but is no longer loaded by any page (chrome is now static HTML). *Reason deferred: ~~Story 2.10 audits which functions are still in use and deletes the file if empty; intentional per AD-15 staged migration.~~ **RESOLVED 2026-08-15**: layout.js deleted in Story 2.10 cleanup (x-3 follow-up, AC-4 reduction candidate #2). Bundle baseline bumped DOWN 162,915 → 161,175 bytes gz (-1,740). All gates still pass.*
- **`HT.shell.version` is a stability trap — no bump policy documented** — `Object.freeze`d at `1.0.0`; no in-repo rule for when to bump. *Reason deferred: Story 1.10 (storage registry) is the contract owner; the version bump policy is documented there.*
- **`toggleTheme` writes `ht.theme` while `theme.js` reads `HT.storage.get` — dual paths can fight** — Two code paths can race during the soft-handoff release window. *Reason deferred: ~~Story 2.10 deletes `theme.js`; until then the soft-handoff is the active guard. Verified at HEAD that no tool page ref tag loads `theme.js`.~~ **RESOLVED 2026-08-15**: theme.js deleted; only `shell.js` reads/writes `ht.theme` now (HT.theme.{cycle,getEffective,getMode,setMode} on shell.js:282-296).*

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

## Deferred from: code review of 1-8-settings-modal-skeleton-with-persisted-preferences (2026-08-07)

- **Header comment block in `settings.html` is duplicated on every page (~36 × 22 lines ≈ 800 lines of payload).** Matches Story 1.7 palette precedent (intentional static-include pattern); defer. *Reason deferred: pre-existing Story 1.7 pattern.*
- **Custom confirm dialog / 5-second hold / typed-confirmation upgrade path for "Clear all local data" (currently uses native `confirm()`).** *Reason deferred: Story 3.5 (Settings Modal Full Control Surface) owns this upgrade.*
- **`HT.settings` missing `read`/`write` accessors.** *Reason deferred: Story 1.10 (Storage Registry with Namespaced Keys) is the canonical contract.*
- **`localStorage` value coercion validation across all `ht.*` reads.** *Reason deferred: Story 1.10 owns runtime read-side validation.*
- **Documented z-index scale across shell overlays.** `palette` z-index is unstated; `.shell-settings-modal` is 1100; the comment at `assets/css/components.css:608` incorrectly says the palette is z-index 1000. Cross-cutting Epic-1 concern. *Reason deferred: needs an Epic-1-wide design decision; not Story 1.8's scope.*


## Deferred from: code review of 2-2-per-tool-sample-data-and-reset-button (2026-08-10)

The 2026-08-10 review covered 4 of 4 layers (blind-hunter + edge-case-hunter + verification-gap + acceptance-auditor). 2 decision-needed + 11 patch + 4 defer items; the 4 below are the items tagged `defer` after triage.

- **W-1 — Destructive reset confirm dialog lacks `aria-describedby` linking the dialog to a confirmation prompt.** Dialog uses native `HTMLDialogElement.showModal()` which provides focus-trap + `Esc`-to-dismiss, but no element inside the dialog explains what will happen ("This will discard your current values…"). *Reason deferred: WCAG 2.2 SC 4.1.2 is met by the dialog itself; SC 2.4.6 / 3.3.2 polish is a low-impact enhancement. Story 3.5 (Settings Modal Full Control Surface) owns the cross-shell a11y upgrade.*

- **W-2 — Dialog has no explicit `id`/`data-testid`; smoke harness targets it via `document.querySelector('dialog[open]')` which is fragile if any future dialog lands in chrome.** *Reason deferred: only one dialog exists today; defensive hardening, not a regression. Next dialog-bearing story should adopt `id="ht-confirm-dialog"` convention.*

- **W-3 — Sample-data + reset UI strings (`"Try an example"`, `"Reset to sample"`) are hardcoded English in `assets/js/sample-data.js`.** Project-context.md §6 declares all chrome strings must live in `assets/js/i18n.js` with locale fallback. *Reason deferred: cross-cutting i18n retrofit across every tool is out of scope for Story 2.2. Tracked as Epic-3 hardening.*

- **W-4 — `HT.sampleData` registered at version `'1.0.0'`; `HT.reset` not versioned at all.** `assets/js/api-contract.js` exposes `HT.sampleData` at `1.0.0` (correct) but does not list `HT.reset`. Minor version-drift between in-module marker and contract surface. *Reason deferred: `HT.reset` is a thin façade over `_doReset()`; api-contract listing is a doc gap, not a runtime risk. Add to next api-contract refresh.*

## Deferred from: code review of story-3-1-full-command-palette-with-top-5-fuzzy-matches-and-footer-hints (2026-08-11)

The 2026-08-11 review covered 4 of 4 layers (blind-hunter + edge-case-hunter + verification-gap + acceptance-auditor). 0 decision-needed + 13 patch + 2 defer + 7 dismissed. The 2 items below are tagged `defer` after triage.

- **W-5 — NFR-1 byte budget violation (131 KB combined vs 30 KB target) — pre-existing at ~115 KB baseline; Story 3.1 adds ~16 KB (palette render + smoke harnesses + doc rewrites).** AC-13 final bullet requires `combined total stays under 30 KB NFR-1`; spec line 52 carves out `≤2 KB for the render + footer + helpers` which is met. The Story's Resolution Notes acknowledge the overshoot and propose a separate `x-3-bundle-size-budget` cross-epic story. *Reason deferred: pre-existing baseline + carved-out scope; not a Story 3.1 regression. Remediation tracked under `_bmad-output/implementation-artifacts/x-3-bundle-size-budget.md` (story spec authored 2026-08-15).*

- **W-6 — `strip_duplicate_includes` regex in `scripts/shell-template.py` has no fixture-based unit test.** The pre-commit hook + `make shell-drift` catch regressions in practice (and the original latent bug surfaced via `make shell-a11y` 36 failures on the 36 affected pages). A pytest-style fixture (one palette, two palettes, two settings, both duplicated) would harden the regex against future boundary tweaks. *Reason deferred: low risk in practice; existing gates catch drift. Add fixture tests when a real regression lands.*

## Deferred from: code review of story-3-3-per-tool-keyboard-shortcuts-overlay (2026-08-11)

The 2026-08-11 review covered 4 of 4 layers (blind-hunter + edge-case-hunter + verification-gap + acceptance-auditor). 0 decision-needed + 13 patch + 3 defer + 4 dismissed. The 3 items below are tagged `defer` after triage.

- **W-7 — `closeHelp()` does not reset `callingElement` when called with `openState === false` early-return.** `closeHelp()` early-returns when the overlay is already closed, leaving `callingElement` populated. Next `openHelp()` overwrites it via `document.activeElement`, so the stale reference is masked — but in a hypothetical future story where `closeHelp()` is called via a tool's programmatic API before any open, the stale value would persist. *Reason deferred: masked by the current openHelp() capture; revisit only if `closeHelp` becomes externally callable.*

- **W-8 — `isMac()` does not consult `navigator.userAgentData` (UA Client Hints).** AC-8 spec line is aspirational: "Determined once at boot via `window.navigator.platform` / `userAgentData`". The implementation only reads `navigator.platform` and falls back to `userAgent`. Modern Chromium-based browsers expose `navigator.userAgentData.platform`. *Reason deferred: current browser coverage is sufficient; revisit if/when `navigator.platform` is removed from major browsers (Chromium 117+ deprecated it in headless mode).*

- **W-9 — Help block markup still emitted on embed pages even when JS is a no-op (~1.5KB inert payload).** The CSS guard hides it, the JS guard early-returns in `boot()`. Same pattern as Story 1.7's palette (also shipped to embed consumers). *Reason deferred: consistent with Story 1.7 palette pattern; a future "embed slim build" cross-epic story (Epic 4) can strip both blocks together.*

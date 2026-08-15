# Handy Tools — local validation targets
#
# Pure-stdlib Python validator (no third-party deps). The validator script
# (scripts/validate-tools-json.py) optionally uses the `jsonschema` package
# when installed (pip install --user jsonschema) but falls back to a
# hand-rolled walker so `make validate` always works offline.
#
# Windows users: use a real POSIX shell (Git Bash / WSL) or run the script
# directly via `python scripts/validate-tools-json.py`.

.PHONY: validate validate-tools-json validate-schema rubric-list rubric-all help rubric-% gate gate-list ci site-config site-config-smoke shell-drift shell-a11y measure-fouc shell-template shell-template-all install-hooks storage-registry storage-registry-inject sri sr compound-smoke verify-compound shell-bounds shell-bounds-self-test shell-public-api-smoke sample-data-smoke a11y-smoke a11y-audit history-smoke share-dialog-smoke export-smoke import-smoke tool-inventory promote-wave-1 audit-wave-1 wave-1-smoke promote-wave-2 print-css-bootstrap audit-wave-2 wave-2-smoke promote-wave-3 audit-wave-3 wave-3-smoke pack-tags pack-tags-smoke check-pack-taxonomy es5-grep quality-smoke regression-sweep regression-sweep-negative palette-search-smoke palette-search-smoke-html palette-actions-smoke help-overlay-smoke global-chords-smoke settings-modal-smoke print-smoke view-source-smoke view-source-smoke-view pins-recent-smoke search-perf-smoke ast-gates-self-test ast-gates-negative chrome-dom-smoke script-load-order uuid-generator-smoke json-formatter-enhancements-smoke citation-formatter-smoke diff-viewer-smoke jwt-inspector-smoke timestamp-converter-smoke flashcard-timer-smoke exam-countdown-smoke recipe-scaler-smoke grocery-list-smoke quiz-smoke quiz-preview-smoke

# Prefer python3 (Debian/Ubuntu convention); fall back to python
# (Windows / macOS / older distros). Override with `make PYTHON=...`
# if neither is on PATH.
PYTHON ?= $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)

help: ## Show available targets
	@echo "Handy Tools — Make targets:"
	@echo "  make validate            Validate tools.json against tools.schema.json"
	@echo "  make validate-schema     Validate tools.schema.json itself"
	@echo "  make validate-tools-json Alias for 'make validate'"
	@echo "  make rubric-list         Print the 10-criterion rubric roster"
	@echo "  make rubric-<slug>       Score a single tool against docs/quality-rubric.md"
	@echo "  make rubric-all          Print a summary table for every tools.json entry"
	@echo "  make gate                Enforce the Tool Contract gate (AD-2) on tools.json"
	@echo "  make gate-list           Print the gate's contract one-liner"
	@echo "  make shell-drift         Verify every page's chrome matches assets/shell/chrome.html"
	@echo "  make shell-a11y          Verify <main aria-label> + cobalt tokens in base.css"
	@echo "  make measure-fouc        Best-effort 50ms no-FOUC check on index.html"
	@echo "  make shell-template      Regenerate the home page chrome"
	@echo "  make shell-template-all  Regenerate the chrome on all 34 tool pages"
	@echo "  make install-hooks       Install scripts/hooks/pre-commit into .git/hooks/"
	@echo "  make site-config         Verify the Story 1.12 site-config.js + page script tags"
	@echo "  make site-config-smoke   Run the Node smoke harness for site-config.js (frozen AD-14 surface)"
	@echo "  make verify-compound     Run the Python verification harness for the compound-interest fix"
	@echo "  make compound-smoke      Run the structural check for scripts/compound-smoke.html"
	@echo "  make shell-bounds        Run the Story 1.14 bypass check (tools/<slug>/<slug>.js only)"
	@echo "  make shell-bounds-self-test  Run the embedded unit tests for the bypass check"
	@echo "  make shell-public-api-smoke  Run the Node smoke harness for HT.provide / HT.use / HT.net (Story 1.14)"
	@echo "  make sample-data-smoke   Run the Node smoke harness for assets/js/sample-data.js (Story 2.2 / AD-4 + AD-14)"
	@echo "  make a11y-smoke          Run the Node smoke harness for assets/js/a11y.js (Story 2.4 / AD-4 + AD-14)"
	@echo "  make a11y-audit          Per-tool keyboard-complete audit (Story 2.4 AC-2) — exit 1 on any failed ready:true tool"
	@echo "  make history-smoke       Run the Node smoke harness for assets/js/history.js (Story 2.3 / AD-4 + AD-14)"
	@echo "  make share-dialog-smoke  Run the Node smoke harness for assets/js/share.js (Story 2.5 / AD-4 + AD-14)"
	@echo "  make export-smoke        Run the Node smoke harness for assets/js/export.js (Story 3.7 / AD-4 + AD-14)"
	@echo "  make import-smoke        Run the Node smoke harness for assets/js/import.js (Story 3.8 / AD-4 + AD-14)"
	@echo "  make tool-inventory      Regenerate docs/tool-inventory.md (Story 2.6 / Story 1.4)"
	@echo "  make promote-wave-1      Validate the three Wave-1 tools are at the 8/10 bar and refresh the inventory (Story 2.6)"
	@echo "  make audit-wave-1        Run docs/quality-rubric.md against each Wave-1 tool and emit docs/quality-audit.md (Story 2.6)"
	@echo "  make wave-1-smoke        Run the static smoke harness verifying the three Wave-1 pages are wired to the Shell (Story 2.6)"
	@echo "  make promote-wave-2      Promote the 15 Wave-2 tools into tools.json (Story 2.7) — generates per-tool contract entries"
	@echo "  make print-css-bootstrap Add the standard @media print block to each Wave-2 tool's <slug>.css (Story 2.7 / rubric #5)"
	@echo "  make audit-wave-2        Run docs/quality-rubric.md against each Wave-2 tool and append docs/quality-audit.md (Story 2.7)"
	@echo "  make wave-2-smoke        Run the static smoke harness verifying the 15 Wave-2 pages + their @media print CSS (Story 2.7)"
	@echo "  make promote-wave-3      Promote the 17 Wave-3 tools into tools.json (Story 2.8) — generates per-tool contract entries"
	@echo "  make audit-wave-3        Run docs/quality-rubric.md against each Wave-3 tool and append docs/quality-audit.md (Story 2.8)"
	@echo "  make wave-3-smoke        Run the static smoke harness verifying the 17 Wave-3 pages + their @media print CSS (Story 2.8)"
	@echo "  make pack-tags           Audit every ready:true tool's pack tags and regenerate docs/pack-taxonomy.md (Story 2.9)"
	@echo "  make pack-tags-smoke     Run the static Node smoke verifying every ready:true entry has a valid pack array (Story 2.9)"
	@echo "  make check-pack-taxonomy Suggest a pack for tools with missing/invalid pack tags (Story 6.3 — not a gate; the schema is)"
	@echo "  make es5-grep            Scan assets/js/** for ES5 anti-patterns (`var` declarations + `.concat(` calls). Story 2.10 gate."
	@echo "  make quality-smoke       Run the Node smoke harness for quality.html + assets/js/quality.js (Story 2.11 /quality inventory view)"
	@echo "  make regression-sweep    Run the cross-cutting tool-JS regression sweep (Story 2.12 — vm-context Node harness + Python wrapper; emits .regression-sweep-output.txt)"
	@echo "  make regression-sweep-negative  Run the 6 negative-test battery for the regression sweep (proves each check is meaningful, not vacuous)"
	@echo "  make palette-search-smoke Run the Story 3.1 palette search smoke harness (Node headless driver for HT.palette + HT.search wiring)"
	@echo "  make palette-search-smoke-html  Structural check for the browser harness at scripts/palette-search-smoke.html (13 contract assertions + JS-driven render)"
	@echo "  make palette-actions-smoke  Run the Story 3.2 palette actions smoke (Node headless driver for the 7 declared actions, registry, matcher, and HT.theme.cycle / HT.viewSource.open)"
	@echo "  make help-overlay-smoke  Run the Story 3.3 help overlay smoke (Node headless driver for the keyboard-shortcuts overlay: HT_HELP_OVERLAY_INIT surface, search filter, open/close/toggle, focus restoration, embed-mode guard)"
	@echo "  make global-chords-smoke  Run the Story 3.4 global chords smoke (Node headless driver for the g <key> arm-then-fire chord listener: 5 chords, 1-second timeout, all 4 guards, Esc-cancel, case-insensitivity, same-URL early-return, idempotent arm)"
	@echo "  make settings-modal-smoke Run the Story 3.5 settings modal smoke (Node headless driver for the 7-field modal: theme select, dynamic locale, reducedMotion checkbox with OS-override, units, currency, fontScale range with percentage <output>, clear-all button; immediate persistence, frozen HT.settings surface)"
	@echo "  make print-smoke         Run the Story 3.10 print stylesheet smoke (Node headless driver for assets/css/print.css + the print-only footer block: 55 assertions verifying AC-required selectors, color forcing, page-break rules, and the print.css <link> on every page)"
	@echo "  make view-source-smoke   Run the Story 3.11 view-source route smoke (Node headless driver for /view-source.html + view-source.js + vendor/highlight.min.js + vendor/zip-store.js: 91 assertions verifying route shape, slug validation, PKZIP STORE byte layout per APPNOTE.TXT, tools.json conventions, and the chrome dual-anchor footer pattern)"
	@echo "  make pins-recent-smoke   Run the Story 3.12 Recent/Pinned tracking smoke (Node vm-context harness: 119 assertions covering recent.js FIFO cap + dedupe, pins.js {slug: iso} map + cap 9, home-grid.js pin button + pinned row, shell.js markToolVisited, home-sidebar.js recent list, api-contract 1.16.0, and storage-registry schemas)"
	@echo "  make search-perf-smoke   Run the Story 1.11 / AI-E1-14 search perf smoke (cold path ≤ 50ms/query × 5 fresh VMs; warm path ≤ 10ms/query × 90th-trimmed avg of 50; no-result ≤ 25ms/query; 4 PASS expected)"
	@echo "  make ast-gates-self-test Run the vendored acorn AST walker's 15-fixture self-test (Story 1.17 / AI-E1-13)"
	@echo "  make ast-gates-negative  Run the negative-test battery for shell-bounds + storage-registry AST walk (Story 1.17 AC-4)"
	@echo "  make script-load-order   Run the post-home-redesign retrofit script-load-order check (1 PASS expected — every tool's <slug>.js must load AFTER ../../assets/js/utils.js; AF-1 from post-home-redesign-retrofit-2026-08-13.md)"
	@echo "  make uuid-generator-smoke Run the Node vm-context smoke for the UUID Generator tool (Story 9.4)"
	@echo "  make json-formatter-enhancements-smoke Run the Node vm-context smoke for the JSON Formatter enhancements (Story 9.1)"
	@echo "  make citation-formatter-smoke Run the Node vm-context smoke for the Citation Formatter tool (Story 9.2)"
	@echo "  make diff-viewer-smoke Run the Node vm-context smoke for the Diff Viewer tool (Story 9.3)"
	@echo "  make jwt-inspector-smoke Run the Node vm-context smoke for the JWT Inspector tool (Story 9.5)"
	@echo "  make timestamp-converter-smoke Run the Node vm-context smoke for the Timestamp Converter tool (Story 9.6)"
	@echo "  make flashcard-timer-smoke Run the Node vm-context smoke for the Flashcard Timer tool (Story 9.7)"
	@echo "  make exam-countdown-smoke Run the Node vm-context smoke for the Exam Countdown tool (Story 9.8)"
	@echo "  make recipe-scaler-smoke Run the Node vm-context smoke for the Recipe Scaler tool (Story 9.9)"
	@echo "  make grocery-list-smoke  Run the Node vm-context smoke for the Grocery List tool (Story 9.10)"
	@echo "  make ci                  Run validate + rubric-all + gate + site-config + site-config-smoke + storage-registry + shell-drift + shell-a11y + verify-compound + compound-smoke + shell-bounds + shell-bounds-self-test + shell-public-api-smoke + sample-data-smoke + a11y-smoke + a11y-audit + history-smoke + share-dialog-smoke + wave-1-smoke + wave-2-smoke + wave-3-smoke + pack-tags-smoke + check-pack-taxonomy + quality-smoke + regression-sweep + regression-sweep-negative + palette-search-smoke + palette-search-smoke-html + palette-actions-smoke + help-overlay-smoke + global-chords-smoke + print-smoke + view-source-smoke + pins-recent-smoke + search-perf-smoke + ast-gates-self-test + ast-gates-negative + script-load-order"

validate: validate-tools-json

validate-tools-json:
	@$(PYTHON) scripts/validate-tools-json.py

# `validate-schema` runs the schema self-check only (no tools.json
# required). Useful in CI smoke tests when you want to verify the
# schema itself parses / is well-formed before any data is added.
validate-schema:
	@$(PYTHON) scripts/validate-tools-json.py --schema-only

# `rubric-%` is a pattern target: `make rubric-<slug>` scores a single tool.
# Slug must match the kebab-case pattern in tools.schema.json
# (`^[a-z][a-z0-9-]*[a-z0-9]$`). The pattern target accepts any slug;
# scripts/rubric-lint.py validates the format and exits 2 if it doesn't
# match. See docs/quality-rubric.md for the rubric.
rubric-%:
	@$(PYTHON) scripts/rubric-lint.py $*

# `rubric-list` prints the 10-criterion roster with mechanical/manual tags.
rubric-list:
	@$(PYTHON) scripts/rubric-lint.py --list

# `rubric-all` prints a one-line summary table for every entry in tools.json.
rubric-all:
	@$(PYTHON) scripts/rubric-lint.py --all

# `gate` applies the AD-2 truth table to every tools.json entry. The
# script reproduces docs/quality-rubric.md#Scoring & Gate; that doc is
# the source of truth. Exit 0 = all entries pass (or all sub-8 are under
# unexpired waivers); 1 = at least one entry fails the contract. See
# docs/ci-gate.md for the full contract.
gate:
	@$(PYTHON) scripts/tool-contract-gate.py

# `gate-list` prints the gate's contract (truth table summary) without
# touching the repo. Useful as a quick reference in the shell.
gate-list:
	@$(PYTHON) scripts/tool-contract-gate.py --list

# `ci` chains the four checks the GitHub Actions workflow runs. Local
# maintainers can use this to reproduce the CI gate before pushing.
ci: validate rubric-all gate site-config site-config-smoke storage-registry shell-drift chrome-dom-smoke script-load-order shell-a11y bundle-size bundle-size-tier1 verify-compound compound-smoke shell-bounds shell-bounds-self-test shell-public-api-smoke sample-data-smoke a11y-smoke a11y-audit history-smoke share-dialog-smoke export-smoke import-smoke wave-1-smoke wave-2-smoke wave-3-smoke wave-lib-smoke pack-tags-smoke check-pack-taxonomy es5-grep quality-smoke regression-sweep regression-sweep-negative palette-search-smoke palette-search-smoke-html palette-actions-smoke help-overlay-smoke global-chords-smoke settings-modal-smoke print-smoke view-source-smoke pins-recent-smoke search-perf-smoke ast-gates-self-test ast-gates-negative uuid-generator-smoke ht-lazy-smoke bd-tax-split-smoke shell-thin-proxies-smoke json-formatter-enhancements-smoke citation-formatter-smoke diff-viewer-smoke jwt-inspector-smoke timestamp-converter-smoke flashcard-timer-smoke exam-countdown-smoke recipe-scaler-smoke grocery-list-smoke quiz-smoke quiz-preview-smoke

# `shell-drift` checks that every page's chrome matches the canonical
# bytes in assets/shell/chrome.html. Story 1.18 (AI-E1-15) replaced the
# legacy byte-substring scan with a DOM-walk structural-identity
# comparator; the `--allow-drift` flag is no longer required (every
# page passes without exemptions). Exit 2 if any page is out of sync.
# Wired into the tool-contract-gate workflow; the path filter covers
# chrome.html, the generator, the drift check, and every tools/<slug>.
shell-drift:
	@$(PYTHON) scripts/shell-drift-check.py

# `chrome-dom-smoke` runs scripts/_smoke_chrome_dom_walk.js — the
# Story 1.18 (AI-E1-15) negative + positive test battery for the
# chrome DOM walk. 8 assertions across 6 fixture pages: 1 canonical
# pass, 1 missing-landmark (drift), 1 extra-inline-script (no
# drift), 1 whitespace-drift (no drift), 1 attr-drift (drift),
# 1 root-page-kind pass. Exits 1 on any fail or vacuous run.
chrome-dom-smoke:
	@node scripts/_smoke_chrome_dom_walk.js

# `script-load-order` runs .test-output/check-script-load-order.js — the
# post-home-redesign retrofit's regression guard for the "HT.$ is not
# a function" bug class. Walks every tool under tools/, finds the line
# numbers of `./<slug>.js` and `../../assets/js/utils.js` from each
# tool's `index.html`, and fails if the tool script loads BEFORE
# utils.js. The bug is fixed by moving `<script src="./<slug>.js">` to
# the very end of the script block (after every Shell module and every
# `defer`-loaded helper). See docs/shell-public-api.md §10 for the
# canonical order + bug story. 1 PASS expected. Vacuous-pass guard
# catches hollow runs. Wired into `make ci` after `chrome-dom-smoke`.
script-load-order:
	@node .test-output/check-script-load-order.js

# `shell-a11y` verifies AC #1's structural invariants that the byte-level
# drift check cannot catch: <main aria-label> on every page, and cobalt
# tokens + dark-theme override in assets/css/base.css.
shell-a11y:
	@$(PYTHON) scripts/shell-a11y-check.py

# `bundle-size` is Story x-3's NFR-1 enforcement gate. Measures every
# chrome JS + CSS module's gzipped byte size via Python's gzip module
# (the same compression CDNs ship), sums them, and exits non-zero when
# the JS total exceeds `BUNDLE_SIZE_BASELINE + BUNDLE_SIZE_TOLERANCE`
# or when the CSS total exceeds `CSS_BUDGET`. The baseline is captured
# in scripts/bundle-size-gate.py; a Story that legitimately adds chrome
# must bump the baseline in a Story commit (recorded decision, not an
# accident). Exit codes: 0 = within budget; 1 = over budget; 2 =
# vacuous (no modules found); 3 = invocation error. Wired into
# `make ci` after `shell-a11y` and before `verify-compound` so a bloat
# regression fails fast before the more expensive smoke chain runs.
# See docs/bundle-size-budget.md for the per-module breakdown + the
# AC-4 top-3 reduction candidates + the Epic 4 path back to < 30 KB.
bundle-size:
	@$(PYTHON) scripts/bundle-size-gate.py

# `bundle-size-tier1` is Story 4 Phase 3's per-page Tier 1 budget
# gate (AC-1). Walks every chrome page (45 tools + 6 packs + home +
# quality + view-source + quiz-preview), parses the eager `<script>`
# tags, identifies the slim Tier 1 footer (site-config +
# storage-registry + utils + ht-lazy + shell-thin), gz-sums it, and
# exits non-zero if any page exceeds the 30 KB NFR-1 floor (30,000
# bytes gz) or is missing one of the Tier 1 markers (drift guard).
# Pairs with `make bundle-size` (which measures the *full* chrome JS
# total across SPEC_JS_MODULES — the Tier 2 budget). After the Story
# 4 slim-build sweep, every chrome page measures ~14 KB Tier 1 gz
# (vs. the 142 KB pre-sweep chrome total). The gate fails fast on
# any page that drifts out of slim Tier 1 shape — re-run
# `scripts/_slim_tier1_sweep.py` to restore. See _bmad-output/
# implementation-artifacts/story-4-embed-slim-build.md for the AC-1
# rationale + per-page budget table.
bundle-size-tier1:
	@$(PYTHON) scripts/_bundle_size_tier1.py

# `measure-fouc` is best-effort: it tries to launch a headless browser
# via `npx puppeteer` (if Node is on PATH) or `npx lighthouse` and
# measures the time between first paint and `data-theme` being set.
# If neither tool is installed, the script exits 0 with a warning.
# Not wired into the tool-contract-gate workflow in this story (the
# perf budget is wired in Story X.3).
measure-fouc:
	@$(PYTHON) scripts/measure-fouc.py

# `shell-template` regenerates the home page chrome from chrome.html.
# Also splices the inline `tools.json` fallback block (Story 1.9) so
# the data-driven home-grid renderer has a file://-compatible source.
# `shell-template-all` regenerates every tools/<slug>/index.html.
# Idempotent — re-running produces no change on already-aligned pages.
shell-template:
	@$(PYTHON) scripts/shell-template.py --home

shell-template-all:
	@$(PYTHON) scripts/shell-template.py

# `install-hooks` copies scripts/hooks/pre-commit into .git/hooks/ so
# the hook is active for the local clone. The hook auto-regenerates the
# 35 shell pages whenever a chrome source file is staged. Pure bash, no
# Node — see scripts/hooks/README.md. Re-run after every fresh clone.
install-hooks:
	@mkdir -p .git/hooks
	@cp scripts/hooks/pre-commit .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "Installed: .git/hooks/pre-commit (re-run after fresh clones)"

# `storage-registry` runs the Story 1.10 registry gate: verifies the
# manifest integrity, the tools.json history-key cross-check, and
# every HT.storage.* call site in assets/js/** + tools/<slug>/<slug>.js
# against the manifest. Exit 0 = all checks pass; exit 1 = any violation.
# `sr` is the short alias.
storage-registry:
	@$(PYTHON) scripts/storage-registry-gate.py

sr: storage-registry

# `storage-registry-inject` rewrites the manifest block in chrome.html
# from the register() calls in storage-registry.js + shell.js. Run this
# after adding a new register() call: the injector appends the new key
# to chrome.html, and the pre-commit hook propagates the change into
# index.html + every tool page. Exits 0 on success, 1 on drift that
# requires manual intervention, 2 on parse error. (AI-E1-10 — added
# 2026-08-12 to close the schema-drift class that bit Story 3.12.)
storage-registry-inject:
	@$(PYTHON) scripts/storage-registry-gate.py --inject

sri: storage-registry-inject

# `site-config` runs the Story 1.12 site-config gate: verifies
# assets/js/site-config.js's HT_SITE_CONFIG + HT.siteConfig shapes, the
# < 1024-byte budget (AC #14), the api-contract.js entry at version
# 1.3.0, and the site-config.js <script> tag + script-tag order on
# every tool page and the home page. Exit 0 = all checks pass.
site-config:
	@$(PYTHON) scripts/site-config-gate.py

# `site-config-smoke` runs the Node smoke harness for site-config.js.
# Loads the module in a fresh vm context, asserts every frozen field of
# HT_SITE_CONFIG + HT.siteConfig, and verifies that mutation throws in
# strict mode. Per the Story 1.9 harness shape: 14 PASS expected. The
# `pass === 0 && fail === 0` vacuous-pass guard inside the script
# converts a hollow run into a hard failure (exit 1).
site-config-smoke:
	@node scripts/_smoke_site_config.js

# `verify-compound` runs the Python verification harness for the
# compound-interest calculator fix (Story 1.13). Re-implements the
# fixed buildSchedule in pure Python and compares against closed-form
# formulas for all 5 frequencies and both contribution timings.
# Exits non-zero on any failed assertion.
verify-compound:
	@$(PYTHON) scripts/verify-compound-fix.py

# `compound-smoke` runs the structural check for the browser smoke
# harness at scripts/compound-smoke.html. This verifies the file is
# present and exposes the expected test count + CI mode gate. The
# actual iframe-driven JS execution requires a headless browser and is
# not covered by this target — see docs/quality-rubric.md for the
# browser-driven test pattern.
compound-smoke:
	@$(PYTHON) scripts/compound-smoke.py

# `shell-bounds` runs the Story 1.14 bypass check. Walks every
# tools/<slug>/<slug>.js and fails on direct localStorage /
# document.cookie / fetch / XMLHttpRequest / HT.provide references.
# The FOUC IIFE in index.html is grandfathered (it's not scanned).
# The defensive-fallback pattern is allowed as a whole block — see
# docs/shell-public-api.md §6. Exit 0 = clean; exit 1 = violations.
shell-bounds:
	@$(PYTHON) scripts/shell-bounds-check.py

# `shell-bounds-self-test` runs the unit tests embedded in the
# bypass-check script. The stripper + walker are subtle; the
# self-test catches regressions to strings/comments/template
# literals. 11 PASS expected.
shell-bounds-self-test:
	@$(PYTHON) scripts/shell-bounds-check.py --self-test

# `shell-public-api-smoke` runs the Node smoke harness for
# assets/js/shell.js's Story 1.14 additions (HT.provide, HT.use,
# HT.net, HT.provideRegistry, HT.netRegistry). Loads shell.js in a
# fresh vm context with a stub document, asserts the public surface
# is frozen, the register/use round-trip works, and the validation
# rules fire on bad input. 20 PASS expected. Vacuous-pass guard
# (pass===0 && fail===0 → exit 1) means a hollow run fails the gate.
shell-public-api-smoke:
	@node scripts/_smoke_shell_public_api.js

# `sample-data-smoke` runs the Node smoke harness for
# assets/js/sample-data.js (Story 2.2 / AD-4 + AD-14). Loads
# utils → sample-data in a fresh vm context with stub
# HTMLInputElement + HT.homeGrid, asserts the HT.sampleData / HT.reset
# surfaces are frozen (AD-14), hasSample / fill return merged-or-default
# for has-sample/default-only/none-of-either slugs with Object.freeze
# holding under sloppy-mode mutation, button factories emit the right
# data-ht-action + aria-label + destructive class, mount inserts the
# sample/reset buttons into a .tool-actions row and tears them down,
# api-contract.js pins version 1.5.0 + the 6 new entries, tools.json
# carries a urlState.sample block on inflation-calculator and
# qr-code-generator, and tools.schema.json declares urlState.sample as
# an optional property. 54 PASS expected. Vacuous-pass guard
# (pass===0 && fail===0 → exit 1) means a hollow run fails the gate.
sample-data-smoke:
	@node scripts/_smoke_sample_data.js

# `a11y-smoke` runs the Node smoke harness for assets/js/a11y.js
# (Story 2.4 — Per-Tool Keyboard-Complete Surface). Loads a11y.js in
# a fresh vm context against five fixtures (clean-tool,
# hover-only-tool, unlabeled-tool, tabindex-positive-tool,
# missing-skip-tool), asserts the HT.a11y surface is frozen and
# registers five public entries (auditTool, tabOrder, missingAria,
# hoverOnly, focusRingOk) plus one internal (focusable), verifies
# audit shape + all gap categories, and pins api-contract.js at
# version 1.6.0 with the six expected entries. Vacuous-pass guard
# (pass===0 && fail===0 → exit 1) catches hollow runs.
a11y-smoke:
	@node scripts/_smoke_a11y.js

# `a11y-audit` runs the per-tool audit gate (Story 2.4 AC-2). For
# every tools.json entry with ready:true, runs HT.a11y.auditTool in
# a Node vm context against the tool's index.html, compares the
# runtime tabOrder against the per-tool tab-order-canonical array
# (or falls back to the Story 2.4 order: #shell-skip → input →
# button → a), and exits 1 on any failed tool. Per AD-15 brownfield
# truth, today's ready:true set is the three Wave-1 flagships; the
# per-tool canonical arrays land in Stories 2.6/2.7/2.8. The
# fallback warning keeps the gate meaningful while the migrations
# land. Exit 2 = repo layout issue; exit 3 = I/O failure.
a11y-audit:
	@$(PYTHON) scripts/a11y-audit-tool.py

# `history-smoke` runs the Node smoke harness for assets/js/history.js
# (Story 2.3 — Per-Tool History Panel). Loads url.js + history.js in a
# fresh vm context against a synthetic HT.homeGrid + HT.storage facade,
# and asserts the HT.history surface (AD-14 frozen), push/list/restore
# round-trip with FIFO cap of 10 (FR-12), per-tool isolation, the
# hasHistory AND-gate, lastEntry convenience, panel + button factories,
# and the api-contract.js version 1.7.0 + 10 entries. 47 PASS expected.
# Vacuous-pass guard (pass===0 && fail===0 → exit 1) catches hollow runs.
history-smoke:
	@node scripts/_smoke_history_panel.js

# `share-dialog-smoke` runs the Node smoke harness for
# assets/js/share.js (Story 2.5 — Per-Tool Share Dialog with URL and
# Print). Loads url.js + share.js in a fresh vm context against a
# synthetic HT.homeGrid.entries fixture (3 slugs: has-share-and-embed,
# has-share-no-embed, neither) with stubbed HT.copyToClipboard +
# HT.toast + window.print. Asserts the HT.share surface (AD-14 frozen
# — 9 stable + 1 internal), url/embedCode correctness (including B3
# a11y min-width + loading="lazy"), the hasShare predicate across the
# 3-slug matrix, dialog open/close lifecycle (showModal, focus on
# URL input by default, focus selects content, isOpen), affordances
# (Copy URL → HT.copyToClipboard + 'URL copied' toast; Print →
# window.print(); Copy embed code → toast), embed section hidden when
# no embed-snippet, button factory (data-ht-action="share" +
# aria-haspopup="dialog" + aria-label "Share tool (s)"), the
# HT.share.print convenience (window.print wrapper), the mount
# teardown helper, and api-contract.js version 1.8.0 + 10 entries.
# 50 PASS expected. Vacuous-pass guard (pass===0 && fail===0 → exit 1)
# catches hollow runs.
share-dialog-smoke:
	@node scripts/_smoke_share_dialog.js

# `export-smoke` runs the Node smoke harness for assets/js/export.js.
# Verifies the public HT.export surface (frozen in api-contract.js
# 1.13.0), the internal HT_EXPORT_SCHEMA_VERSION handle, the payload
# assembly (version / exportedAt / settings / history / favorites /
# recent / pins), the validation-failure path (toast + console.error
# + no download), the embed-mode guard, and the api-contract pin.
# 43 PASS expected (Story 3.7). Vacuous-pass guard catches hollow runs.
export-smoke:
	@node scripts/_smoke_export.js

# `import-smoke` runs the Node smoke harness for assets/js/import.js.
# Verifies the public HT.import surface (frozen in api-contract.js
# 1.14.0), the internal HT_IMPORT_DIALOG_VERSION handle, the 6-check
# payload validator (read-side mirror of export.js), the conflict
# detection + window.confirm overwrite dialog, the apply-phase
# ordering (settings → pins → favorites → recent → history.<slug>),
# the history merge semantics (existing preserved; ts-collision →
# imported wins; FIFO cap 50), idempotency within page lifetime
# (importInFlight flag), the embed-mode guard, the parse-error
# path (toast truncated to 60 chars), and the api-contract pin.
# 53 PASS expected (Story 3.8). Vacuous-pass guard catches hollow runs.
import-smoke:
	@node scripts/_smoke_import.js

# Story 2.6 — Wave-1 promotion + inventory + audit + page smoke.
# `tool-inventory` regenerates docs/tool-inventory.md, listing all
# tools on disk with their wave assignment (Wave-1 = ready:true;
# Wave-2 = ready:false; Wave-3 = not yet in tools.json).
tool-inventory:
	@$(PYTHON) scripts/_promote_wave_1.py --inventory-only --quiet

# `promote-wave-1` is idempotent: validates that the three Wave-1
# tools (qr-code-generator, inflation-calculator, lifespan-simulator)
# are at score>=8 with urlState + history-keys + view-source, and
# refreshes docs/tool-inventory.md. Exits 1 if any Wave-1 tool is
# below the 8/10 bar.
promote-wave-1:
	@$(PYTHON) scripts/_promote_wave_1.py

# `audit-wave-1` runs scripts/rubric-lint.py against each Wave-1
# tool, captures the per-criterion table, and emits
# docs/quality-audit.md. Exits 1 if any tool scores below 8.
audit-wave-1:
	@$(PYTHON) scripts/_audit_wave_1.py

# `wave-1-smoke` runs the static Node smoke harness verifying each
# Wave-1 page (i) is in tools.json with ready:true, score>=8,
# urlState + history-keys + view-source.path; (ii) has the Shell
# script tags (share.js, a11y.js, shell.js, sample-data.js,
# history.js); and (iii) ships a non-empty <slug>.js. 43 PASS
# expected. Vacuous-pass guard catches hollow runs.
wave-1-smoke:
	@node scripts/_smoke_wave_1_pages.js

# Story 2.7 — Wave-2 promotion + print CSS bootstrap + audit + page smoke.
# `print-css-bootstrap` appends the standard @media print block to each
# Wave-2 tool's <slug>.css (idempotent — checks for existing block).
# The block hides Shell chrome and forces black-on-white text per
# rubric #5 (Printable). Exit 0 = all targets processed.
print-css-bootstrap:
	@$(PYTHON) scripts/_print_css_bootstrap.py

# `promote-wave-2` is idempotent: for each of the 15 Wave-2 tools,
# introspects the tool's index.html for input IDs + the tool's
# <title> for the title, and adds a tools.json entry with the
# per-tool contract fields (urlState + history-keys + view-source +
# embed-snippet + shortcuts + keywords + pack + icon). Re-running
# leaves existing Wave-2 entries byte-equivalent if they already
# meet the bar (ready:true, score>=8, contract fields present).
# Exits 1 if any tool fails to validate.
promote-wave-2:
	@$(PYTHON) scripts/_promote_wave_2.py

# `audit-wave-2` runs scripts/rubric-lint.py against each Wave-2
# tool, captures the per-criterion table, and APPENDS a Wave-2
# section to docs/quality-audit.md (preserving the Wave-1 section
# above byte-for-byte). Exits 1 if any tool scores below 8.
audit-wave-2:
	@$(PYTHON) scripts/_audit_wave_2.py

# `wave-2-smoke` runs the static Node smoke harness verifying each
# of the 15 Wave-2 pages (i) is in tools.json with ready:true,
# score>=8, urlState.encode/decode + history-keys + view-source +
# embed-snippet + keywords + pack + icon; (ii) has the Shell script
# tags (share.js, a11y.js, shell.js, sample-data.js, history.js);
# (iii) every urlState encode/decode selector resolves to an id in
# the tool HTML; (iv) ships a non-empty <slug>.js; and (v) the
# tool's <slug>.css contains @media print (rubric #5). 346 PASS
# expected. Vacuous-pass guard (pass===0 && fail===0 → exit 1)
# catches hollow runs.
wave-2-smoke:
	@node scripts/_smoke_wave_2_pages.js

# Story 2.8 — Wave-3 promotion + audit + page smoke.
# `promote-wave-3` is idempotent: for each of the 17 Wave-3 tools,
# introspects the tool's index.html for input IDs + the tool's
# <title> for the title, and adds a tools.json entry with the
# per-tool contract fields (urlState + history-keys + view-source +
# embed-snippet + shortcuts + keywords + pack + icon). Re-running
# leaves existing Wave-3 entries byte-equivalent if they already
# meet the bar (ready:true, score>=8, contract fields present).
# Exits 1 if any tool fails to validate.
promote-wave-3:
	@$(PYTHON) scripts/_promote_wave_3.py

# `audit-wave-3` runs scripts/rubric-lint.py against each Wave-3
# tool, captures the per-criterion table, and APPENDS a Wave-3
# section to docs/quality-audit.md (preserving the Wave-1 / Wave-2
# sections above byte-for-byte). Exits 1 if any tool scores below 8.
audit-wave-3:
	@$(PYTHON) scripts/_audit_wave_3.py

# `wave-3-smoke` runs the static Node smoke harness verifying each
# of the 17 Wave-3 pages (i) is in tools.json with ready:true,
# score>=8, urlState.encode/decode + history-keys + view-source +
# embed-snippet + keywords + pack + icon; (ii) has the Shell script
# tags (share.js, a11y.js, shell.js, sample-data.js, history.js);
# (iii) every urlState encode/decode selector resolves to an id in
# the tool HTML; (iv) ships a non-empty <slug>.js; and (v) the
# tool's <slug>.css contains @media print (rubric #5). 392 PASS
# expected. Vacuous-pass guard (pass===0 && fail===0 → exit 1)
# catches hollow runs.
wave-3-smoke:
	@node scripts/_smoke_wave_3_pages.js

# Story AI-E2-3 (Epic 2 retrospective) — _wave_lib factoring smoke.
# `wave-lib-smoke` runs scripts/_smoke_wave_lib.js which verifies:
#   (i) the shared _wave_lib.py exposes the documented helper surface;
#   (ii) the six wave-{1,2,3}.py wrappers still expose WAVE_N_SLUGS +
#       WAVE_N_PACKS (the data contract _pack_tags.py imports);
#   (iii) promote_wave in dry-run mode reports 0 fail for waves 2/3
#       (Wave-1's --inventory-only path runs cleanly);
#   (iv) docs/tool-inventory.md is byte-equivalent on re-run;
#   (v) docs/quality-audit.md is byte-equivalent for waves 2/3 on re-run
#       modulo today's date stamp (Wave-1's score drift is a separate
#       tech-debt item, not this factoring's responsibility);
#   (vi) validate_entry's negative paths return non-empty failure lists
#       containing the expected substrings (below-bar, ready, missing).
# 43 PASS expected. Vacuous-pass guard (pass===0 && fail===0 → exit 1)
# catches hollow runs.
wave-lib-smoke:
	@node scripts/_smoke_wave_lib.js

# Story 2.9 — Pack tag audit + taxonomy doc + smoke.
# `pack-tags` aggregates the canonical pack roster from the three
# wave-promo scripts (_promote_wave_{1,2,3}.py), verifies every pack
# has ≥ 3 tools, and regenerates docs/pack-taxonomy.md (one
# paragraph per pack with one-line inclusion criterion + the current
# tool list). Exits 1 if any tool's pack is invalid or any pack
# drops below the 3-tool minimum.
pack-tags:
	@$(PYTHON) scripts/_pack_tags.py

# `pack-tags-smoke` runs the static Node smoke verifying every
# ready:true entry in tools.json declares a non-empty `pack` array
# whose values are all in the curated taxonomy
# {travel,finance,study,developer,household}. 111 PASS expected.
# Vacuous-pass guard (pass===0 && fail===0 → exit 1) catches hollow
# runs.
pack-tags-smoke:
	@node scripts/_smoke_pack_tags.js

# Story 6.3 — Pack taxonomy suggestion gate (NOT a CI gate; the
# schema is). Reads tools.json, posts a suggestion for any
# ready:true entry with a missing/invalid pack value using the
# hand-rolled KEYWORD_TO_PACK map at the top of the script.
# Wired into `make ci` between `pack-tags-smoke` and `wave-1-smoke`.
# Exit codes: 0 = clean, 2 = repo layout issue, 3 = I/O failure or
# vacuous run (no ready:true entries). Never exits 1 by design.
check-pack-taxonomy:
	@$(PYTHON) scripts/check-pack-taxonomy.py

# Story 2.10 — ES5 anti-pattern gate.
# `es5-grep` scans assets/js/** for two ES5 anti-patterns that the
# shared-helpers migration (utils.js, layout.js, theme.js) eliminated:
#   - `var ` declarations (with trailing space, to avoid matching
#     identifiers like `myvar`). The migrated files MUST use
#     `let`/`const`.
#   - `.concat(` calls. Broad scan across all assets/js/** to catch
#     stragglers in tool scripts.
# Exits 1 if any are found (gate fails).
es5-grep:
	@$(PYTHON) scripts/_es5_grep.py

# Story 2.11 — /quality inventory view smoke.
# `quality-smoke` runs scripts/_smoke_quality.js, the Node smoke harness
# for quality.html + assets/js/quality.js. Static checks: chrome footer
# link, <main aria-label>, table skeleton with exactly 5 base <th> cells,
# zero inline <tr data-ht-tool>, last-script assertion. Behavioral checks:
# loads quality.js in a vm context with stubbed fetch + DOM, dispatches
# DOMContentLoaded, asserts 2 rows × 15 <td> render with verbatim
# remediation text + slug sort + waiver row class + frozen HT.quality
# surface. 34 PASS expected. Vacuous-pass guard catches hollow runs.
quality-smoke:
	@node scripts/_smoke_quality.js

# `regression-sweep` is the cross-cutting JS-load evaluation from Story 2.12.
# The Python wrapper shells to the Node harness, parses the JSON last-line
# summary, and writes .regression-sweep-output.txt. The Node harness itself
# remains usable directly via `node scripts/_smoke_regression_sweep.js`.
# Exit codes: 0 = all 7 checks pass on all ready:true tools; 1 = any check
# fails; 2 = vacuous (no ready:true tools); 3 = invocation error.
regression-sweep:
	@$(PYTHON) scripts/_regression_sweep.py
	@echo "report: $$(pwd)/.regression-sweep-output.txt"

# `regression-sweep-negative` runs the negative-test battery against the
# regression sweep. For each of the 7 checks (schema, html, jsLoad,
# history, consoleError, fetch, scriptLoadOrder), inject a known-broken
# fixture, run the sweep, and assert the expected check flips to false.
# 7 PASS expected (one per check). If any check stays true under its
# broken fixture, the sweep has a vacuous pass and 245/245 is meaningless
# — exit 1.
regression-sweep-negative:
	@node scripts/_smoke_regression_sweep_negative.js

# Story 3.1: palette search smoke. Headless Node driver that loads the
# same shell.js + search.js fixtures and exercises the 15 contract
# assertions: API surface (HT.palette.matchActions/runAction/openHelp),
# HT.search._matchRange helper, top-5 cap result shape, empty/no-match
# queries, no-throw on unknown actions, and the 10ms warm-path perf
# budget. Vacuous-pass guard (pass === 0 → exit 1) catches hollow runs.
palette-search-smoke:
	@node scripts/_smoke_palette_search.js

# `palette-search-smoke-html` is the structural check for the browser
# harness at scripts/palette-search-smoke.html. It verifies the file is
# present, exposes the 13 contract assertions, and contains the JS-driven
# top-5 render check (Test 13). The actual iframe-driven JS execution
# requires a headless browser and is not covered by this target — see
# docs/quality-rubric.md for the browser-driven test pattern. The Node
# driver above is the authoritative headless smoke; this target catches
# drift in the HTML harness file (fixture shape, CI mode gate, etc.).
palette-search-smoke-html:
	@$(PYTHON) scripts/palette-search-smoke-html.py

# Story 3.2: palette actions smoke. Headless Node driver for the static
# action declaration (assets/js/palette-actions.js), the registry +
# matcher wired into assets/js/shell.js, and the new HT.theme.cycle /
# HT.viewSource.open public-API surfaces. 33 contract assertions
# covering registry dispatch, matcher case-insensitive substring
# behavior, empty/whitespace queries, shape integrity of frozen action
# objects, and the new theme + viewSource wrappers. Vacuous-pass
# guard catches hollow runs.
palette-actions-smoke:
	@node scripts/_smoke_palette_actions.js

# Story 3.3: keyboard-shortcuts help overlay smoke harness. Headless
# Node driver loads assets/js/help-overlay.js in a vm context and
# exercises the contract assertions for the public HT_HELP_OVERLAY_INIT
# surface (frozen handle, frozen shortcut list, search filter, open/
# close/toggle, focus restoration, embed-mode guard, non-modal ARIA
# wiring). 53 assertions as of Story 3.3.0; vacuous-pass guard catches
# hollow runs.
help-overlay-smoke:
	@node scripts/_smoke_help_overlay.js

# Story 3.4: global keyboard chords for cross-page navigation. Validates
# the g <key> arm-then-fire chord listener (assets/js/global-chords.js)
# end-to-end via a Node + vm driver — covers the 5 mapped chords (g h /
# g p / g q / g v / g s), the 1-second timeout, all four guards (text-
# input / embed / dialog / modifier), Esc-cancel, case-insensitivity,
# same-URL early-return, idempotent arm, and the frozen
# HT_GLOBAL_CHORDS_INIT internal handle. 42 assertions; vacuous-pass
# guard catches hollow runs.
global-chords-smoke:
	@node scripts/_smoke_global_chords.js

# Story 3.5: settings modal — full control surface. Headless Node
# driver loads assets/js/shell.js in a vm context against a hand-built
# DOM tree mirroring assets/shell/settings.html and asserts AC-1
# through AC-6: 7 fields with explicit defaults (theme select, dynamic
# locale, units/currency selects, fontScale range with percentage
# <output>, reducedMotion checkbox with OS-override, clearAll button),
# Tab order follows field source order, immediate persistence (no
# debounce — 3 changes = 3 writes), modal width CSS (var(--modal-width,
# 560px) + @media (max-width: 600px) responsive rule), focus
# restoration on close, and the frozen HT.settings surface (AD-14 —
# no new HT.* public methods). 56 assertions; vacuous-pass guard
# catches hollow runs.
settings-modal-smoke:
	@node scripts/_smoke_settings_modal.js

# Story 3.10: print stylesheet + print-only footer smoke (pure Node fs
# regex — no vm context). Verifies assets/css/print.css exists and
# carries every AC-required selector + color-forcing + page-break
# rule; verifies the print.css <link media="print"> is present in every
# tool page + the home page + quality.html; verifies the print-only
# footer block is in chrome.html and spliced into every tool page +
# home page; verifies the legacy @media print block was migrated out
# of base.css into print.css; and verifies the splice_print_css +
# splice_print_footer helpers exist in scripts/shell-template.py.
# 55 PASS expected. Vacuous-pass guard catches hollow runs.
print-smoke:
	@node scripts/_smoke_print.js

# Story 3.11: view-source route + vendored highlighter + vendored
# PKZIP STORE-only builder. 91 PASS expected. Vacuous-pass guard
# catches hollow runs. Covers (a) /view-source.html shape, (b)
# view-source.js module + slug validation, (c) vendor/highlight.min.js
# tokenizer, (d) vendor/zip-store.js byte layout per APPNOTE.TXT,
# (e) tools.json view-source conventions, (f) wireViewSourceLink()
# target, (g) chrome.html dual-anchor footer, and (h) api-contract.js
# version 1.15.0 with new entries.
view-source-smoke:
	@node scripts/_smoke_view_source.js

# Story 3.12 smoke harness — Recent/Pinned tracking (HT.recent, HT.pins,
# HT.homeSidebar, home-grid.js pin button + pinned row, shell.js
# markToolVisited, api-contract.js 1.16.0 with new entries, index.html
# sidebar markup, export.js + import.js regression guards).
pins-recent-smoke:
	@node scripts/_smoke_pins_recent.js

# `search-perf-smoke` is the Story 1.11 / AI-E1-14 perf budget smoke.
# Headless Node driver loads assets/js/search.js in a vm context
# against a synthetic tools fixture, then measures:
#   - cold path: ≤ 50ms/query (NFKD normalize dominates, 5 fresh VM
#     invocations). The cold-path budget is distinct from warm because
#     the disk-cache miss + first normalize pass are the dominant cost.
#   - warm path: ≤ 10ms/query (50 queries on one engine, 90th-percentile-
#     trimmed avg to ignore GC spikes). The published Story 1.11 budget.
#   - no-result boundary: ≤ 25ms/query for zero-match queries (Promise
#     microtask roundtrip is the dominant cost; budget leaves room for
#     the scheduling overhead in the test harness).
# Vacuous-pass guard (pass === 0 && fail === 0 → exit 1) catches
# hollow runs. Authored as part of the Epic 1 retrofit audit (AI-E1-14).
search-perf-smoke:
	@node scripts/_smoke_search_perf.js

# Story 1.17 / AI-E1-13 — AST-based gate scanners. Two targets exercise
# the vendored acorn parser (scripts/vendor/acorn.js) and the wrapper
# walker (scripts/vendor/ast-walker.js):
#
#   `ast-gates-self-test` runs the walker's 15-fixture inline battery
#   (comment-internal fetch, string-internal fetch, real localStorage /
#   real fetch, every key-resolution branch on HT.storage.<op>, template
#   literal, unbound identifier, parse error, registry-level ops, dynamic
#   key expressions including optional chaining). 15 PASS expected.
#   Vacuous-pass guard catches hollow runs.
#
#   `ast-gates-negative` runs scripts/_smoke_ast_gates.js — a Node
#   driver that builds a temp repo with three fixture tool files plus a
#   minimal chrome.html + storage-registry.js, then runs the two Python
#   gates against the temp repo to prove end-to-end that:
#     - comment-internal fetch / localStorage / XMLHttpRequest refs do
#       NOT trip shell-bounds-check,
#     - string-internal `fetch('...')` and `localStorage.setItem(...)`
#       literals do NOT trip shell-bounds-check,
#     - real localStorage.setItem + fetch calls DO trip shell-bounds-check.
#   7 PASS expected. Both steps (acorn walker + Python gate subprocess)
#   are verified end-to-end via the Python harness, not just the AST
#   walker unit tests.
ast-gates-self-test:
	@node scripts/vendor/ast-walker.js --self-test

ast-gates-negative:
	@node scripts/_smoke_ast_gates.js

# Story 9.4 — UUID Generator smoke (Node vm-context harness covering
# the four generators v1/v4/v7/ULID, validators, URL state, count
# clamping, history push, and uniqueness invariants per AC-6).
# ≥ 30 PASS expected (currently 133). Vacuous-pass guard catches
# hollow runs.
uuid-generator-smoke:
	@node scripts/_smoke_uuid_generator.js

# Story 4 — embed slim build (Tier 1 < 30 KB NFR-1 path). Phase 1
# ships the ht-lazy.js loader + shell-thin.js stub + smoke harness for
# the loader. 15 PASS expected. Verifies lazyLoad shape, idempotence,
# dedup, defer attribute, data-ht-lazy attribute, error path rejection,
# retry-after-error acceptance. Phases 2-5 will wire the loader into
# the chrome + decompose shell.js + components.css (see Story 4 spec).
ht-lazy-smoke:
	@node scripts/_smoke_ht_lazy.js

# Story 4b Phase 2 — bd-tax-calculator core+handlers split smoke.
# Verifies bd-tax-core.js exposes HT.bdTaxCore (data + boot) and
# bd-tax-handlers.js binds window.bdTaxInit. 43 PASS expected.
bd-tax-split-smoke:
	@node scripts/_smoke_bd_tax_split.js

# Story 4 Phase 4 — shell-thin Proxy stub smoke. Validates that all
# 8 chrome namespaces (HT.history / HT.urlState / HT.palette /
# HT.sampleData / HT.share / HT.export / HT.import / HT.a11y) expose
# Proxy stubs that lazy-load the canonical chrome module path on first
# property access and forward to the real namespace after the lazy-load
# resolves. The Proxy + lazy-load pattern re-enables chrome features
# (Sample/Reset, Share, Export, Import, A11y) that the Phase 3 slim
# Tier 1 sweep stripped from the eager script block. 34 PASS expected.
shell-thin-proxies-smoke:
	@node scripts/_smoke_shell_thin_proxies.js

# Story 9.1 — JSON Formatter enhancements smoke.
# ≥ 20 PASS expected (currently 39). Vacuous-pass guard catches
# hollow runs.
json-formatter-enhancements-smoke:
	@node scripts/_smoke_json_formatter_enhancements.js

# Story 9.2 — Citation Formatter smoke (Node vm-context harness covering
# parseAuthor, validateIsbn (with the regex alternation fix that
# keeps ISBN-13 from collapsing into ISBN-10), validateDoi, isUrl,
# the three formatters (APA 7 / MLA 9 / Chicago 17), the dispatcher,
# the DOM render path with .citation-missing wrapping, the DOI/URL
# link visibility, and the user-initiated HT.net.json ISBN lookup).
# ≥ 25 PASS expected across 9 categories. Vacuous-pass guard.
citation-formatter-smoke:
	@node scripts/_smoke_citation_formatter.js

# Story 9.3 — Diff Viewer smoke (Node vm-context harness covering
# myersDiff, empty inputs, single-line / multi-line ops, splitLines /
# splitWords / splitChars, word- and char-granularity diffs,
# base64 round-trip with non-ASCII, URL state encode/decode,
# invalid-granularity fallback, empty-state message, swap click).
# ≥ 25 PASS expected across 15 categories. Vacuous-pass guard.
diff-viewer-smoke:
	@node scripts/_smoke_diff_viewer.js

# Story 9.5 — JWT Inspector smoke (Node vm-context harness covering
# base64url encode/decode + splitJwt + decodeJwt, HS256 + RS256
# sign+verify round-trips via Web Crypto, the SPKI fixture PEM,
# malformed PEM handling, exp render path, URL state (token + embed
# privacy guard), history push with the jwt-alg + jwt-secret-set
# keys only — never the token — , no-fetch / no-XHR assertions,
# console scrubber, defensive guard, module + browser export shapes).
# ≥ 30 PASS expected across 15 categories (currently 47).
# Vacuous-pass guard catches hollow runs.
jwt-inspector-smoke:
	@node scripts/_smoke_jwt_inspector.js

# Story 9.6 — Timestamp Converter (Unix epoch, ISO 8601, RFC 2822, human).
# Vacuous-pass guard catches hollow runs.
timestamp-converter-smoke:
	@node scripts/_smoke_timestamp_converter.js

# Story 9.7 — Flashcard Timer (recall/break alternation, Web Audio beep,
# progress ring, URL state, audio context fallback). Vacuous-pass guard
# catches hollow runs.
flashcard-timer-smoke:
	@node scripts/_smoke_flashcard_timer.js

# Story 9.8 — Exam Countdown (live days/hours/minutes/seconds, URL state
# wins over localStorage, past-date notice, keyboard shortcuts). Vacuous-pass
# guard catches hollow runs.
exam-countdown-smoke:
	@node scripts/_smoke_exam_countdown.js

# Story 9.9 — Recipe Scaler (×N multiplier, metric/imperial unit
# conversion, hand-rolled fraction parser + Stern-Brocot formatter,
# unparseable-line exclusion, unknown-unit warning, base64 URL state
# with unicode safety, debounced 120ms render, reduced-motion,
# keyboard shortcuts s/r/p/c). Vacuous-pass guard catches hollow runs.
recipe-scaler-smoke:
	@node scripts/_smoke_recipe_scaler.js

# Story 9.10 — Grocery List (categorized, shareable). Adds items, groups
# by category, persists to URL via base64 JSON (unicode-safe), checkbox
# toggle, print/share/reset actions, 12-category smoke harness.
grocery-list-smoke:
	@node scripts/_smoke_grocery_list.js

quiz-smoke:
	@node scripts/_smoke_quiz_shell.js

quiz-preview-smoke:
	@node scripts/_smoke_quiz_preview.js

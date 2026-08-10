# Handy Tools — local validation targets
#
# Pure-stdlib Python validator (no third-party deps). The validator script
# (scripts/validate-tools-json.py) optionally uses the `jsonschema` package
# when installed (pip install --user jsonschema) but falls back to a
# hand-rolled walker so `make validate` always works offline.
#
# Windows users: use a real POSIX shell (Git Bash / WSL) or run the script
# directly via `python scripts/validate-tools-json.py`.

.PHONY: validate validate-tools-json validate-schema rubric-list rubric-all help rubric-% gate gate-list ci site-config site-config-smoke shell-drift shell-a11y measure-fouc shell-template shell-template-all install-hooks storage-registry sr compound-smoke verify-compound shell-bounds shell-bounds-self-test shell-public-api-smoke sample-data-smoke

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
	@echo "  make ci                  Run validate + rubric-all + gate + site-config + site-config-smoke + storage-registry + shell-drift + shell-a11y + verify-compound + compound-smoke + shell-bounds + shell-bounds-self-test + shell-public-api-smoke + sample-data-smoke"

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
ci: validate rubric-all gate site-config site-config-smoke storage-registry shell-drift shell-a11y verify-compound compound-smoke shell-bounds shell-bounds-self-test shell-public-api-smoke sample-data-smoke

# `shell-drift` checks that every page's chrome matches the canonical
# bytes in assets/shell/chrome.html. Exit 2 if any page is out of sync.
# Wired into the tool-contract-gate workflow; the path filter covers
# chrome.html, the generator, the drift check, and every tools/<slug>.
shell-drift:
	@$(PYTHON) scripts/shell-drift-check.py

# `shell-a11y` verifies AC #1's structural invariants that the byte-level
# drift check cannot catch: <main aria-label> on every page, and cobalt
# tokens + dark-theme override in assets/css/base.css.
shell-a11y:
	@$(PYTHON) scripts/shell-a11y-check.py

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

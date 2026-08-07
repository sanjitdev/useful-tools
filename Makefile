# Handy Tools — local validation targets
#
# Pure-stdlib Python validator (no third-party deps). The validator script
# (scripts/validate-tools-json.py) optionally uses the `jsonschema` package
# when installed (pip install --user jsonschema) but falls back to a
# hand-rolled walker so `make validate` always works offline.
#
# Windows users: use a real POSIX shell (Git Bash / WSL) or run the script
# directly via `python scripts/validate-tools-json.py`.

.PHONY: validate validate-tools-json validate-schema rubric-list rubric-all help rubric-% gate gate-list ci shell-drift shell-a11y measure-fouc shell-template shell-template-all install-hooks storage-registry sr

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
	@echo "  make ci                  Run validate + rubric-all + gate + shell-drift"

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
ci: validate rubric-all gate storage-registry shell-drift shell-a11y

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

# Handy Tools — local validation targets
#
# Pure-stdlib Python validator (no third-party deps). The validator script
# (scripts/validate-tools-json.py) optionally uses the `jsonschema` package
# when installed (pip install --user jsonschema) but falls back to a
# hand-rolled walker so `make validate` always works offline.
#
# Windows users: use a real POSIX shell (Git Bash / WSL) or run the script
# directly via `python scripts/validate-tools-json.py`.

.PHONY: validate validate-tools-json validate-schema rubric-list rubric-all help rubric-% gate gate-list ci

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
	@echo "  make ci                  Run validate + rubric-all + gate (the full CI chain)"

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

# `ci` chains the three checks the GitHub Actions workflow runs. Local
# maintainers can use this to reproduce the CI gate before pushing.
ci: validate rubric-all gate

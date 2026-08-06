# Developer Git Hooks

This directory holds versioned git hooks for Handy Tools. They are not
active by default — install them once per fresh clone via the Makefile
target:

```bash
make install-hooks
```

## `pre-commit`

Auto-regenerates the 35 shell pages (1 home + 34 tools) whenever a
chrome source file (`assets/shell/*.html`) or the generator
(`scripts/shell-template.py`) is staged for commit. Re-runs the drift
and a11y gates as a sanity check; blocks the commit with a visible
error if either gate fails.

The hook is a no-op for any other commit (fixing a typo in a tool's JS,
updating `README.md`, adding a tool, etc.) — it only fires when a
chrome source or its generator is in the staged changeset.

Pure bash, no Node, no third-party deps. Portable across
macOS/Linux/Git-Bash-on-Windows (the project's documented Windows
shell per `Makefile:8-9`).

## Why manual install (not Husky / lint-staged)

The project's AD-12 forbids a build step and the PRD commits to "zero
dependencies". A versioned bash hook + manual `make install-hooks`
keeps the audit surface flat (one shell script) and discoverable via
the existing Makefile convention.
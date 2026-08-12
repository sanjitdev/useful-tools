# Story 1.17 — AST-based Gate Scanners (AI-E1-13)

Status: backlog

## Story

**As a** maintainer of the gate scripts (`storage-registry-gate.py`, `shell-bounds-check.py`),
**I want** them to parse JavaScript via an AST instead of regex/string match,
**so that** false positives from comments, template literals, and string contents are eliminated.

## Source

- **Origin:** AI-E1-13 in `_bmad-output/implementation-artifacts/epic-1-retrofit-audit-2026-08-12.md` line 754-762.
- **Binds:** AD-2 (Tool Contract gate), AD-14 (HT.* public surface), Story 1.10 (storage registry), Story 1.14 (shell public API).
- **Prevents:** future false positives that the regex walked past (comment-internal `localStorage.getItem`, template literal containing `"fetch("`, ES2018+ reserved words not in `INDIRECT_RE`'s denylist).

## Why this story exists

The Epic 1 retrofit audit's F6 finding flagged two false-positive classes that the current gates have:

1. **`shell-bounds-check.py`** uses substring match against the source. A tool that contains `// fetch the URL when offline` in a JSDoc comment will FAIL the gate even though there is no actual `fetch(...)` call.

2. **`storage-registry-gate.py`**'s `_REGISTER_RE` walks `register('key', {purpose, lifetime, schema, owner})` via regex, missing keys with whitespace inside field values. The `INDIRECT_RE` denylist (lines 30-35) hardcodes a closed set of ES2018+ reserved words and breaks the day someone adds `async` or `await` to the denylist.

The fix is to parse the JS, walk the AST, and only flag true call-site references.

## Acceptance Criteria

### AC-1 — `scripts/_vendored/acorn.js` is vendored at a known-good commit + license is preserved

`acorn` is MIT-licensed (`parser`). Vendor it at `scripts/_vendored/acorn.js` (zero npm install needed in CI) with the upstream license file at `scripts/_vendored/acorn.LICENSE`. Pin the vendored version to a specific commit (latest stable as of the story's authoring date; the vendor script must reject future re-vendors unless the developer explicitly bumps the pin).

**Note for the dev:** the same vendoring pattern was used for `vendor/highlight.min.js` in Story 3.11 and `vendor/zip-store.js`. Follow `scripts/vendor-acorn.py` if a helper is needed, or vendoring by hand from the acorn GitHub release.

### AC-2 — `shell-bounds-check.py` walks the AST

Replace the substring scan with a Python script that invokes `python -m` entry point + reads each tool file, parses via acorn, and reports only call-site references. The script must:
- ignore comments (single-line, multi-line, JSDoc)
- ignore string contents (single-quoted, double-quoted, template literals without `${}`)
- flag `localStorage.<op>(...)`, `document.cookie`, `fetch(...)`, `new XMLHttpRequest()`, `XMLHttpRequest` (any reference that resolves to a Global), `HT.provide.register(...)` (direct registration bypass)
- continue to allowlist the `if (HT.storage && HT.storage.<op>) { ... } else { localStorage.<op>(...); }` defensive-fallback pattern (the lifecycle fallback detector walks past both the `if` and the `else` braces)
- continue to grandfather the FOUC IIFE (the inline `<script>` in `tools/<slug>/index.html` is NOT scanned — the existing allowlist rule stands)
- preserve the existing Markdown report format

### AC-3 — `storage-registry-gate.py` walks the AST

Replace `_REGISTER_RE` and the `INDIRECT_RE` walk with an AST-based call site finder that:
- identifies every `HT.storage.get/set/remove/getJSON/setJSON/list/keys/clear/registerHistoryKeys` call site and resolves the first string-argument as the key
- cross-references the resolved keys against the registry
- ignores comments, JSDoc, and string contents
- preserves the existing `--inject` mode (the regex walker for manifest rewriting stays)

### AC-4 — A new negative-test battery catches false-positive regressions

Add `scripts/_smoke_ast_gates.js` (or `.py` — match the harness idiom of whichever gate) that:
- creates a fixture tool with `// fetch something in a comment` and asserts the bounds-check does NOT flag it
- creates a fixture tool with `const x = "fetch('something')"` inside a string and asserts the bounds-check does NOT flag it
- creates a fixture tool with `localStorage.setItem('ht.theme', ...)` and asserts the bounds-check DOES flag it
- exits 1 on any false positive or false negative

### AC-5 — Both gates pass on the current brownfield

After migration:
- `make shell-bounds` exits 0 against all 35 tool files (no regressions vs the current 0-violation baseline)
- `make storage-registry` exits 0 against all 65 JS files (no regressions vs the current 26-key clean baseline)
- `make shell-bounds-self-test` exits 0 (existing 11 PASS preserved)

### AC-6 — `make ci` includes the new negative-test target

`scripts/_smoke_ast_gates.js` is wired into `make ci` and the GitHub `tool-contract-gate.yml` workflow as a new step. The path filter covers the AST vendor file, both updated gate scripts, and the new smoke harness.

## Implementation Notes

- **Why vendor acorn, not require it from npm?** The project has been deliberately zero-npm-dependency on the Python side (Epic 1's design choice; the project never adopted a `package.json`). The Node smokes use `require('vm')` from the stdlib. Adding `acorn` as an npm dep is out of scope; vendoring is the consistent move (matches `vendor/highlight.min.js`, `vendor/zip-store.js`).
- **Why one vendor, two gates?** Both gates parse JavaScript; one AST parser, two consumers. A separate vendor per gate would double the footprint for no real benefit.
- **Why `if/else` *with braces* only, not single-line?** The existing allowlist detects `if (HT.storage && HT.storage.<op>) { ... } else { localStorage.<op>(...); }`. Single-line `if/else` without braces is NOT supported because the AST walk cannot reliably compute the "then" arm boundaries when braces are absent. The Epic 1 retrofit audit noted that none of the 35 current tool files use single-line if/else for the defensive fallback; if a future tool does, the dev agent must convert it to a brace block.
- **Why preserve `--inject` mode?** The injection is a write that requires precise marker-region rewriting; rewriting it on top of the AST parser would be a separate refactor and is out of scope here. The AST change covers call-site analysis only.

## Tests

- `make shell-bounds` — re-runs against the 35 brownfield tools, must be clean.
- `make storage-registry` — re-runs against the 65 JS files, must be clean.
- `make shell-bounds-self-test` — preserves 11 PASS.
- `make ast-gates-negative` (new) — exercises comment-internal, string-internal, and real call-site fixtures; exits 1 on any unexpected flag/no-flag.

## Files Touched

- `scripts/_vendored/acorn.js` — new (vendored `acorn` parser).
- `scripts/_vendored/acorn.LICENSE` — new (MIT license).
- `scripts/shell-bounds-check.py` — replaced substring scan with AST walk; preserved Markdown report format + allowlist.
- `scripts/storage-registry-gate.py` — replaced `INDIRECT_RE` + the `HT.storage.*` call-site scan with AST walk; preserved `--inject` mode.
- `scripts/_smoke_ast_gates.js` (or `.py`) — new negative-test battery.
- `Makefile` — new `ast-gates-negative` target; wired into `ci`.
- `.github/workflows/tool-contract-gate.yml` — new step + path filter for the AST vendor + the two updated scripts + the new smoke.

---

*Status: backlog. Sequenced after AI-E1-14 / commit `4a649a2`. Retro audit F6.*

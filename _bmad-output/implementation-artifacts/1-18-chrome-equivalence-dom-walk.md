# Story 1.18 — Chrome Equivalence DOM Walk (AI-E1-15)

Status: review

baseline_commit: ac9930641112f2e30338fa5904f679d155b05e5c

## Story

**As a** maintainer of `shell-drift-check.py` and the chrome template system,
**I want** the chrome-equivalence check to walk the DOM of each tool page and compare structural identity to `assets/shell/chrome.html`,
**so that** byte-level noise (whitespace, comments, formatting) doesn't fail the gate and the `--allow-drift` exemptions become unnecessary.

## Source

- **Origin:** AI-E1-15 in `_bmad-output/implementation-artifacts/epic-1-retrofit-audit-2026-08-12.md` line 774-782; also AI-E3-5 in the Epic 3 retro.
- **Binds:** Story 1.5 (shell template), Story 3.10 (print stylesheet splices), Story 3.11 (view-source dual-anchor footer).
- **Prevents:** the byte-aligned drift gate failing on whitespace/comment changes that are functionally identical chrome.

## Why this story exists

`scripts/shell-drift-check.py` (and the splice mechanism in `shell-template.py`) treats chrome equivalence as a byte-substring match between the chrome region of every page and the canonical `assets/shell/chrome.html`. This is brittle:

- Any whitespace difference (a comment, a newline) makes the drift check fail
- The `--allow-drift index.html` and `--allow-drift view-source.html` exemptions are necessary because those pages legitimately have additional inline scripts (the FOUC IIFE in `index.html`; the `view-source` page's specific data-ht-tool attributes) that differ from the canonical chrome
- Each new chrome surface (e.g., Story 3.10's print-only footer, Story 3.11's dual-anchor footer) requires a new splice marker and a new byte-region regex

The fix is to walk the parsed DOM and compare structural identity (same nodes, same attributes, same nesting) instead of byte equivalence.

## Acceptance Criteria

### AC-1 — `shell-drift-check.py` parses HTML and walks DOM

Replace the byte-substring scan with a Python HTML parser (stdlib: `html.parser` or `xml.etree.ElementTree`) that:
- parses `assets/shell/chrome.html` once into a DOM tree
- parses each tool page (and `index.html` and `view-source.html`) and locates the chrome region by walking to the `<header id="shell-header">` / `<main>` / `<footer id="shell-footer">` boundary
- compares the structural identity of the chrome region: every node tag, attribute name + value, text content, and nesting must match (modulo inline `<script>` and `<style>` content, which is normalized out)

### AC-2 — `--allow-drift` exemptions become unnecessary

After migration, `make shell-drift` exits 0 against `index.html` and `view-source.html` without the `--allow-drift` flag. The DOM walk correctly distinguishes:
- inline `<script>` content (the FOUC IIFE, the view-source data attrs) — these are NOT chrome, they're page-specific
- chrome subtrees (`<header id="shell-header">`, `<nav id="shell-nav">`, `<main>`, `<footer id="shell-footer">`, the print-only footer block) — these MUST match `chrome.html` exactly

### AC-3 — The new check preserves the existing structural assertions

The existing per-tool smoke (e.g., `make wave-1-smoke`, `make wave-2-smoke`, `make wave-3-smoke`) verifies that the chrome script tags (share.js, a11y.js, shell.js, sample-data.js, history.js) are present. The DOM walk must produce an equivalent report: each tool page lists which chrome subtrees match and which (if any) diverge.

### AC-4 — Drift report emits structural-diff JSON, not just byte diffs

The Markdown report is replaced (or augmented) with a structural diff:
- which nodes differ in tag/attribute/text
- which subtrees are missing
- which extra subtrees are present

The byte-line numbers from the old report are removed (they don't apply to structural identity).

### AC-5 — A new positive + negative test battery

Add `scripts/_smoke_chrome_dom_walk.js` (or `.py`) that:
- creates a fixture tool with the canonical chrome → asserts pass
- creates a fixture with one missing `<header>` subtree → asserts the specific failure is reported
- creates a fixture with an extra inline `<script>` in the chrome region → asserts pass (inline scripts are not chrome)
- creates a fixture with whitespace differences in the chrome → asserts pass (DOM walk normalizes whitespace)
- exits 1 on any unexpected pass/fail

### AC-6 — `make ci` includes the new battery + removes the `--allow-drift` flag

`make ci` and the GitHub `tool-contract-gate.yml` workflow:
- run `make shell-drift` *without* the `--allow-drift` flag
- run the new structural smoke (`make chrome-dom-smoke`)
- update the path filter to cover the updated `shell-drift-check.py` and the new smoke

## Implementation Notes

- **Why `html.parser` over `lxml`?** The project has been zero-dep Python. `lxml` would be a new system dependency; `html.parser` is in the stdlib. The DOM walk needs only tag/attribute/text inspection, not CSS selectors or XPath — `html.parser` is enough.
- **Why not reuse the AST walker from Story 1.17?** That story covers JavaScript. This is HTML. Two different parsers, two different scope. They share a sibling story, not a code dependency.
- **Why walk DOM instead of relying on the splice markers?** The splice markers (`<!-- shell:header -->`, `<!-- shell:footer -->`) are the very thing that makes the current gate brittle. A DOM walk that finds chrome by structural landmark (`#shell-header`, `main`, `#shell-footer`) doesn't need the markers at all — the markers can be removed or kept as documentation, but they no longer drive the gate.
- **What about the print-only footer splice (Story 3.10) and the dual-anchor footer (Story 3.11)?** Both are children of `<footer id="shell-footer">` in `chrome.html` — the DOM walk will see them as part of the chrome and verify they propagate to every page. The "duplication is intentional" pattern in the current byte-scan code is naturally subsumed by structural comparison.

## Tests

- `make shell-drift` — passes against all 35 tool brownfield pages, `index.html`, and `view-source.html` (no `--allow-drift` flag).
- `make chrome-dom-smoke` (new) — 4 PASS expected (canonical chrome, missing subtree, extra inline script, whitespace).
- `make wave-1-smoke`, `make wave-2-smoke`, `make wave-3-smoke` — all still pass (the existing structural assertions are preserved by the DOM walk's output format).
- `make ci` — full chain, no regressions.

## Files Touched

- `scripts/shell-drift-check.py` — replaced byte scan with DOM walk; removed `--allow-drift` exemptions.
- `scripts/shell-template.py` — splice markers can be simplified (optional follow-up; out of strict scope).
- `scripts/_smoke_chrome_dom_walk.js` (or `.py`) — new positive + negative test battery.
- `Makefile` — new `chrome-dom-smoke` target; `shell-drift` no longer passes `--allow-drift`; `ci` chain updated.
- `.github/workflows/tool-contract-gate.yml` — `make shell-drift` invocation updated; new step for `chrome-dom-smoke`; path filter updated.
- `packs/{developer,finance,household,study,travel}.html` — added the `<a class="shell-skip" href="#main">` skip link that the legacy byte-substring gate had silently let drift past.

---

## Implementation Plan

### Approach summary

Replaced the byte-substring scan in `scripts/shell-drift-check.py` with a Python stdlib `html.parser.HTMLParser`-based DOM walker. The walker:

1. Parses the canonical `assets/shell/chrome.html` once into a tree (`ChromeNode` with tag/attrs/children/text/script_text/style_text slots).
2. For each target page, parses the page, then locates five chrome landmarks by structural signature — skip link (`a.shell-skip`), site header (`header.site-header`), main (`main#main`), print footer (`footer.print-only.print-footer`, omitted for pack pages), site footer (`footer.site-footer`).
3. Runs `diff_trees(canonical, page)` per landmark and aggregates the diff list. `diff_trees` compares recursively: tag equality, attribute set with normalization (brand `href` → `__BRAND_HREF__`, main `aria-label` → `__MAIN_ARIA_LABEL__`), children in order. Whitespace-only text nodes are dropped; comments are dropped at parse time; inline `<script>`/`<style>` text is captured but not compared.

### What landed

- **`scripts/shell-drift-check.py`**: rebuilt the chrome scan around the DOM walker. The five non-DOM per-page checks (search.js, site-config, data-slug, tools.json-inline, manifest SHA) are preserved as separate gates. The `--allow-drift` arg, the `allowed` parameter, and the exemption logic are removed. On any drift detection, `.chrome-dom-diff.json` is written to repo root with `{files: [{path, drift: [{region, kind, path, expected, actual}]}]}`.
- **`scripts/_smoke_chrome_dom_walk.js`**: mirrors `_smoke_ast_gates.js` idiom (`'use strict'`, `assert()` helper, vacuous-pass guard, exit 0/1/2). Builds `$TMP/chrome-dom-smoke-<rand>/repo/` with synthesized `assets/shell/chrome.html` plus 6 fixture pages (canonical + missing landmark + extra inline script + whitespace drift + attr drift + quality.html root-page-kind). 8 PASS expected.
- **`Makefile`**: dropped `--allow-drift index.html` from `shell-drift`; added `chrome-dom-smoke` to `.PHONY` + `ci:` chain + a new target with body `@node scripts/_smoke_chrome_dom_walk.js`.
- **`.github/workflows/tool-contract-gate.yml`**: added `scripts/_smoke_chrome_dom_walk.js` to both pr.paths and push.paths; updated the shell-drift step comment to describe the DOM walk; added a new `make chrome-dom-smoke` step after shell-drift.
- **`packs/{developer,finance,household,study,travel}.html`**: each previously had a missing `<a class="shell-skip">` skip link — real drift that the legacy byte-substring gate had silently let through. The DOM walker caught it on the first brownfield run; all 5 pack pages now carry the skip link.

### Real drift the new gate caught on first brownfield run

- 5 pack pages (`developer`, `finance`, `household`, `study`, `travel`) had no `<a class="shell-skip" href="#main">` element. The legacy gate didn't flag this because the byte-substring scan looked at the canonical chrome's skip link region and accepted the empty match (it wasn't being checked at all). The DOM walker's landmark extractor requires every landmark to be present.
- Pack pages correctly omit the `print-only print-footer` block (the canonical chrome carries it; pack pages don't). The per-page-kind rules skip the print-footer landmark for pack pages.

### Verification (run on HEAD)

```
$ make chrome-dom-smoke
chrome-dom smoke: 8 passed, 0 failed
exit=0

$ make shell-drift
... all 35 tool pages + 5 pack pages + index.html + view-source.html + quality.html
shell-drift-check: all pages in sync (DOM walk + 5 non-DOM checks per page; Story 1.18 / AI-E1-15)

$ make ci
... every step exits 0
```

### Dev Notes for Reviewers

- The DOM walker uses `html.parser.HTMLParser` (stdlib) — zero-dep. The `void_elements` set ensures `<meta>`, `<link>`, etc. are recognized as void; the comparator records a node's tag + attributes + children, so void vs non-void is preserved as part of the structural identity (canonical `<meta charset="utf-8">` matches page `<meta charset="utf-8">` even though both are self-closing).
- The five normalization rules (brand href, main aria-label, inline script/style content, whitespace, comments) are deliberately generous to absorb harmless differences. They're listed in the plan (`C:\Users\BS707\.puku-cli\plans\logical-finding-sprout.md`) under "Normalization rules".
- Pack-page identity rules differ from tool/index/quality rules (no print-only footer, no data-slug on `<main>`, brand `href` is `../index.html`). These are encoded inline in the per-page-kind dispatch in `shell-drift-check.py`.
- The `.chrome-dom-diff.json` is the machine-readable diff report; the Markdown stdout is preserved (one `ok` or `drift (N findings)` line per file).

---

*Status: review. Sequenced after AI-E1-13 / Story 1.17 (the AST walker is a sibling primitive). Retro audit F10. brownfield clean: 35 tool + 5 pack + index + view-source + quality = 42 pages pass without `--allow-drift`. Smoke: 8 PASS.*

---
status: ready-for-dev
baseline_commit: 6e0fb463f8fb2f5e9a2d20b9d7c4f8e1a3b5d9c7
---

# Story 9.2: Citation Formatter (APA, MLA, Chicago)

## User Story

As a student writing a paper,
I want to paste a book URL or ISBN and get a citation in APA, MLA, or Chicago format,
So that I don't have to remember the punctuation rules.

## Current State

- No citation tool exists in the repo today (verified 2026-08-13 by `ls tools/`).
- The Shell ships `HT.net` as the registered network entry point (Story 1.14). All `fetch` / `XMLHttpRequest` calls in tool scripts must go through `HT.net.fetch(...)` (or `HT.net.json(...)`); the `shell-bounds-check` gate enforces this.
- The tool is `pack: ["study"]` per Story 6.3's keyword map (`citation` → not in map, but `study` is the closest pack — see ROQ-1).
- No local citation database ships with the tool; metadata is fetched on demand (see AC-2 + ROQ-2).

## Acceptance Criteria

### AC-1 — Manual entry + format selection

**Given** the user opens `tools/citation-formatter/index.html`
**When** they fill in the manual fields (`<input name="author">`, `<input name="title">`, `<input name="year">`, `<input name="publisher">`) and select a style (`<select name="style">` with options `apa-7`, `mla-9`, `chicago-17`)
**Then** the tool renders the formatted citation per the style:

- **APA 7:** `Author, A. A. (Year). Title of work. Publisher.`
- **MLA 9:** `Author. "Title of work." Publisher, Year.`
- **Chicago 17:** `Author. Title of work. Publisher, Year.`

**And** the citation is rendered in `<output id="citation-output" class="citation-rendered">` plus a Copy button (`<button data-action="copy">`)
**And** the author field accepts "Last, First Middle" or "Last, F. M." — the formatter capitalizes initials correctly for APA (single-cap with periods and spaces) and uses the full first name for MLA/Chicago
**And** if any field is empty, the citation is rendered as a partial string with a `<span class="citation-missing" data-field="...">` placeholder (e.g., `(n.d.)` for missing year, `(n.p.)` for missing publisher).

### AC-2 — ISBN detection + manual fallback

**Given** the user opens the citation formatter
**When** they paste an ISBN into `<input name="isbn">`
**Then** the tool detects the format via regex `/(?:ISBN[\s:-]?)?(\d{9}[\dXx]|\d{13})/` and, **if the user explicitly clicks "Look up"** (`<button data-action="lookup-isbn">`), fetches metadata from Open Library via `HT.net.json('https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data')`
**And** the lookup button is OFF by default. The tool never auto-fetches on ISBN paste — the user must opt in by clicking. This is a privacy-preserving default.
**And** if the fetch succeeds, the tool auto-populates author / title / year / publisher from the response and re-renders the citation. If it fails (network error, 404, malformed JSON), the tool shows `<p class="lookup-error">Metadata lookup failed — please fill in fields manually</p>` near the input and the manual fields stay editable.
**And** the tool never fetches metadata from any other API. Open Library is the only network endpoint in scope. CrossRef (DOI) support is **out of scope** for Story 9.2 — see ROQ-2.
**And** the network request is logged to `HT.net` only — the tool never calls `fetch()` or `XMLHttpRequest` directly. The `shell-bounds-check` gate enforces this contract.

### AC-3 — DOI input (manual, no lookup)

**Given** the user opens the citation formatter
**When** they paste a DOI into `<input name="doi">`
**Then** the tool validates the DOI shape via regex `/^10\.\d{4,9}\/[-._;()\/:A-Z0-9]+$/i` and shows a green check `<span class="doi-valid">✓</span>` next to the field
**And** the DOI is rendered as a `<a class="citation-doi-link" href="https://doi.org/{doi}" target="_blank" rel="noopener">{doi}</a>` in the output area for the user's reference
**And** the tool does NOT fetch CrossRef metadata (out of scope per ROQ-2). The DOI field is metadata-only — the user fills in author/title/year/publisher manually.

### AC-4 — URL input (treated as plain text)

**Given** the user opens the citation formatter
**When** they paste a URL into `<input name="source">`
**Then** the tool detects via regex `/^https?:/` and renders the URL as a `<a href="{url}" target="_blank" rel="noopener">` reference link in the output. The URL is NOT fetched for metadata (out of scope).
**And** the URL is appended to the citation in a style-specific position: APA → at the end after the publisher; MLA → at the end; Chicago → as a footnote-style reference.

### AC-5 — URL state

**Given** any field is set
**When** the user navigates away and back
**Then** the URL state encodes all visible inputs (`?style=apa-7&author=...&title=...&year=...&publisher=...&isbn=...&doi=...&source=...`)
**And** the URL state schema is `{ default: { 'cite-style': 'apa-7', ... }, encode: [{key: 'style', type: 'string'}, {key: 'author', type: 'string'}, ...], decode: [...] }`
**And** field text is encoded with `encodeURIComponent` (no base64 needed — URLs are short).
**And** the URL is preserved via `history.replaceState` on every input change (no navigation).

### AC-6 — Keyboard-complete + a11y

**Given** the page renders
**When** the user tabs through it
**Then** the canonical order is: skip link → style select → author input → title input → year input → publisher input → ISBN input → ISBN-lookup button → DOI input → source input → Copy button → output region → help / shortcuts region
**And** each input has an accessible `<label for="...">`. The lookup button has `aria-label="Look up ISBN metadata on Open Library"`.
**And** the output region has `aria-live="polite"` so screen readers announce the rendered citation after a field change.
**And** rubric #9 (Accessible) passes via `HT.a11y.auditTool`.

### AC-7 — Privacy + shell bounds

**Given** the page renders
**When** any action is taken
**Then** the tool script `tools/citation-formatter/citation-formatter.js` has **zero direct** `fetch` / `XMLHttpRequest` / `HT.provide` calls. All network requests go through `HT.net.json(...)`. The `shell-bounds-check` gate enforces this.
**And** the ISBN lookup is OFF by default; the user must click the lookup button. The tool never auto-fetches on input change.
**And** history keys are `['cite-style', 'cite-author', 'cite-title', 'cite-year', 'cite-publisher']` (the ISBN/DOI/source fields are not in history — they may be sensitive).
**And** the tool never logs the ISBN / DOI / URL to `console.*`.

### AC-8 — `tools.json` entry + smoke harness

**Given** the implementation is complete
**When** `make ci` runs
**Then** `tools.json` carries an entry for `citation-formatter`:
  - `id: "citation-formatter"`, `slug: "citation-formatter"`, `title: "Citation Formatter"`, `description: "Format citations in APA, MLA, and Chicago. Manual fields, ISBN lookup via Open Library, DOI + URL references."` (≤ 160 chars)
  - `category: "study"`, `pack: ["study"]`
  - `keywords: ["citation", "apa", "mla", "chicago", "bibliography", "isbn", "doi"]`
  - `last-updated: <today>`, `ready: true`, `score: 8`
  - `urlState` per AC-5
  - `shortcuts: [{ key: "g", action: "generate", label: "Format citation" }, { key: "c", action: "copy", label: "Copy citation" }]`
  - `history-keys: ["cite-style", "cite-author", "cite-title", "cite-year", "cite-publisher"]`
  - `view-source: { enabled: true, path: "tools/citation-formatter/index.html" }`
  - `embed-snippet: { enabled: true, badge-default: true, min-width: 320, min-height: 280 }`
  - `search-priority: 5`
  - `tab-order-canonical` declared
**And** `make shell-bounds` passes (no direct `fetch` in tool script)
**And** `make shell-public-api-smoke` passes (no new `HT.*` surface)
**And** `make pack-tags-smoke` reports `citation-formatter` under `study`
**And** a new `scripts/_smoke_citation_formatter.js` Node smoke harness exists with **at least 25 assertions** covering:
  - (i) APA 7 citation formatting (3 sample fixtures: full author, single author, no year);
  - (ii) MLA 9 formatting (3 fixtures);
  - (iii) Chicago 17 formatting (3 fixtures);
  - (iv) author parsing (Last, First; Last, F. M.; single-name);
  - (v) missing-field placeholder rendering (n.d., n.p.);
  - (vi) ISBN regex detection (ISBN-10 + ISBN-13 + with `ISBN:` prefix);
  - (vii) DOI regex validation (positive + negative fixtures);
  - (viii) URL regex detection (`http` + `https`);
  - (ix) network stub: the smoke harness replaces `HT.net.json` with a stub that returns a canned Open Library response, then asserts the tool populates the manual fields correctly;
  - (x) network failure stub: the stub rejects → the tool shows `lookup-error` and leaves manual fields editable;
  - (xi) URL state: passing `?style=mla-9&author=...` in the page URL sets the form fields on DOMContentLoaded;
  - (xii) vacuous-pass guard (`pass === 0 && fail === 0 → exit 1`).
**And** the new smoke target `citation-formatter-smoke` is wired into `make ci` and `.github/workflows/tool-contract-gate.yml` with path filters.

### AC-9 — Existing regression suite stays green

**Given** the implementation is complete
**When** `make ci` runs
**Then** every existing smoke harness stays green (no regression): the 23+ Node smokes, all Python gates, the regression-sweep + negative pair.

## Resolved Open Questions

### ROQ-1 — Pack placement

Citation Formatter could plausibly be `study` (student writing a paper) or `developer` (no developer angle). The Story 6.3 keyword map (`scripts/check-pack-taxonomy.py:KEYWORD_TO_PACK`) does not have an entry for "citation", so the script's suggestion is the closest pack by the inclusion criteria. Per `INCLUSION_CRITERIA['study']` bullets: "outputs are useful for homework, classroom, or independent study" — citations fit. Per `INCLUSION_CRITERIA['developer']`: "manipulates structured text or developer-facing data" — citations are not developer-facing data.

**Resolution:** `pack: ["study"]`. The first inclusion bullet for `study` is met ("supports academic or learning workflow: ... text generation").

### ROQ-2 — CrossRef DOI lookup is out of scope

The Epic 9.2 AC text references "CrossRef API `https://api.crossref.org/works/<doi>` for DOI". CrossRef adds a second network endpoint and a second metadata format.

**Resolution:** AC-3 handles DOI as **manual metadata only** — the user pastes the DOI, the tool validates the regex and renders a `https://doi.org/...` link, but does NOT fetch CrossRef metadata. This eliminates a second network endpoint and keeps the privacy story single-source (Open Library for ISBN). CrossRef can land in a future epic if the manual DOI workflow proves insufficient.

### ROQ-3 — Network request to Open Library is privacy-compliant

The Open Library request is initiated **only when the user clicks the "Look up" button**. The tool does not auto-fetch on ISBN paste. The URL `https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data` is logged in the browser's network tab (the user can see it). No analytics / tracking / fingerprinting is involved. This matches the project's privacy posture (AD-13 / AD-14).

**Resolution:** The user-initiated lookup pattern is the privacy-compliant default. Documented in the tool's help text.

## Files Touched (this story)

| File | Change |
|---|---|
| `_bmad-output/implementation-artifacts/9-2-citation-formatter-apa-mla-chicago.md` | NEW (this file) |
| `tools/citation-formatter/index.html` | NEW — ~340 lines (chrome + tool markup). Pattern matches `tools/url-codec/index.html`. |
| `tools/citation-formatter/citation-formatter.js` | NEW — ~200 LOC ES2018 vanilla. Wires manual fields, ISBN lookup (HT.net.json), DOI validation, URL detection, citation rendering for 3 styles, URL state. |
| `tools/citation-formatter/citation-formatter.css` | NEW — minimal styles + `@media print` block. |
| `assets/js/citation-styles.js` | NEW — ~150 LOC pure-function library with the 3 style formatters + author parser. Exposes `formatApa7({author,title,year,publisher})`, `formatMla9(...)`, `formatChicago17(...)`, `parseAuthor(s)`, `validateIsbn(s)`, `validateDoi(s)`. |
| `tools.json` | MODIFIED — append a new entry for `citation-formatter`. |
| `scripts/_smoke_citation_formatter.js` | NEW — Node vm-context smoke harness, ≥ 25 assertions, vacuous-pass guard. |
| `Makefile` | EXTENDED — `.PHONY` + `citation-formatter-smoke` + `help` + `ci:` chain. |
| `.github/workflows/tool-contract-gate.yml` | EXTENDED — `make citation-formatter-smoke` step + path filters. |
| `assets/css/components.css` | unchanged |
| `assets/js/shell.js` | unchanged (no new `HT.*` surface) |

## Tasks / Subtasks

- [ ] T1 — Author `assets/js/citation-styles.js` (3 formatters + author parser + ISBN/DOI/URL validators). Pure functions, no DOM. Self-test inline. ~150 LOC.
- [ ] T2 — Author `tools/citation-formatter/index.html` (chrome + tool markup) following the url-codec template.
- [ ] T3 — Author `tools/citation-formatter/citation-formatter.css` (tool-specific styles + `@media print`).
- [ ] T4 — Author `tools/citation-formatter/citation-formatter.js` (DOM wiring, HT.net.json for ISBN lookup, URL state, history push).
- [ ] T5 — Add the `citation-formatter` entry to `tools.json`.
- [ ] T6 — Run `make shell-template` to re-splice the chrome.
- [ ] T7 — Write `scripts/_smoke_citation_formatter.js` (≥ 25 assertions, 12 categories per AC-8). Vacuous-pass guard. Network stub via `HT.net.json` replacement.
- [ ] T8 — Wire Makefile + CI.
- [ ] T9 — Run `make ci` end-to-end. All gates green.
- [ ] T10 — Two-pass review (AI-E3-2). Mark `done`.

## Dev Agent Record

### Implementation Plan

1. **T1 first** — the three formatters + author parser are testable in pure Node.
2. **T2 + T3 + T4** — author the tool in the order HTML → CSS → JS.
3. **T5** — `tools.json` entry. Run `make validate` to confirm.
4. **T6** — `make shell-template` to verify chrome consistency.
5. **T7** — smoke harness with network stub.
6. **T8–T9** — wiring + full `make ci` run.
7. **T10** — two-pass review (AI-E3-2).

### Known limitations

- CrossRef DOI lookup is out of scope (ROQ-2). User manually fills in metadata for DOI sources.
- The author parser handles common English-style names ("Last, First Middle", "Last, F. M."); non-Latin scripts and complex name particles (van, von, de) are best-effort — documented in the tool's help text.
- The tool formats one citation at a time; bulk citation lists are out of scope. (A future enhancement could accept a BibTeX input.)

### Debug Log

_To be filled in during implementation._

### Completion Notes

_To be filled in during implementation._

## File List

- `_bmad-output/implementation-artifacts/9-2-citation-formatter-apa-mla-chicago.md` (this file)
- `assets/js/citation-styles.js` (NEW)
- `tools/citation-formatter/index.html` (NEW)
- `tools/citation-formatter/citation-formatter.js` (NEW)
- `tools/citation-formatter/citation-formatter.css` (NEW)
- `tools.json` (modified — 1 new entry)
- `scripts/_smoke_citation_formatter.js` (NEW)
- `Makefile` (modified)
- `.github/workflows/tool-contract-gate.yml` (modified)

## Change Log

- 2026-08-13 — CS: spec drafted. ROQ-1 (pack placement) → `study`. ROQ-2 (CrossRef DOI lookup) → out of scope, manual DOI only. ROQ-3 (Open Library privacy) → user-initiated button click only.

## Status

ready-for-dev

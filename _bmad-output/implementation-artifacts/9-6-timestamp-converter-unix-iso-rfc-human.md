---
status: ready-for-dev
baseline_commit: 344fde9be3334ae727b2edbf44eb326a0c0ec224
---

# Story 9.6: Timestamp Converter (Unix epoch, ISO 8601, RFC 2822, human-readable)

## User Story

As a developer, sysadmin, or anyone debugging logs,
I want to paste a Unix epoch (seconds or milliseconds) or an ISO 8601 / RFC 2822 string and see every other format,
So that I can correlate logs, JWT `exp` claims, and HTTP headers without reaching for an online converter.

## Current State

- No timestamp-converter tool exists in the repo today (verified 2026-08-13 by `ls tools/`).
- `Date.parse` parses RFC 2822 and ISO 8601 in every current browser (PRD NFR-4 — Chrome/Firefox/Safari/Edge current). Edge cases:
  - `Date.parse('2026-08-13T10:00:00Z')` → parses as UTC.
  - `Date.parse('Wed, 13 Aug 2026 10:00:00 GMT')` → parses as UTC.
  - `Date.parse('2026-08-13')` → parses as UTC midnight (ISO 8601).
  - `Date.parse('foo')` → `NaN` (invalid).
- Unix-epoch parsing is a `Number(...)` + magnitude check (10-digit → seconds; 13-digit → milliseconds). For input ≤ 10^11 we treat as seconds; > 10^11 we treat as milliseconds. This handles every realistic epoch from 1973 to the year 5138.
- The `Intl.DateTimeFormat` API produces localized output for "human-readable" mode. With the `en-US` locale it yields `"August 13, 2026 at 10:00 AM UTC"`-style strings.
- The tool is `pack: ["developer"]` per Story 6.3's keyword map (`timestamp`, `unix`, `epoch`, `time` → developer).

## Acceptance Criteria

### AC-1 — Single timestamp decode

**Given** the user opens `tools/timestamp-converter/index.html`
**When** they paste a value into `<input name="input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false">` and the tool auto-converts on `input` (debounced 150ms)
**Then** the tool renders, for any successfully-parsed instant, six labeled output fields:

- **Unix seconds**: `<input id="ts-unix-s" readonly>` — 10-digit seconds (rounded if input was ms)
- **Unix milliseconds**: `<input id="ts-unix-ms" readonly>` — 13-digit ms
- **ISO 8601**: `<input id="ts-iso" readonly>` — `2026-08-13T10:00:00.000Z` (always UTC, always milliseconds, always `Z` suffix)
- **RFC 2822**: `<input id="ts-rfc" readonly>` — `Wed, 13 Aug 2026 10:00:00 GMT`
- **Human-readable (UTC)**: `<input id="ts-human-utc" readonly>` — `2026-08-13 10:00:00 UTC` (per `Date.prototype.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')`)
- **Human-readable (local)**: `<input id="ts-human-local" readonly>` — `8/13/2026, 10:00:00 AM` (per `new Intl.DateTimeFormat('en-US', {dateStyle: 'medium', timeStyle: 'medium'}).format(date)`)

**And** the input field is rendered with `<label for="ts-input">Timestamp</label>`.
**And** a "Copy" button (`<button data-action="copy" data-target="ts-unix-s">Copy</button>`) sits next to each output field; clicking copies that field's value to the clipboard via `navigator.clipboard.writeText` with an `HT.copyToClipboard` fallback.
**And** a "Now" button (`<button data-action="now">Use current time</button>`) populates the input with the current Unix seconds.

### AC-2 — Auto-detect input format

**Given** the user pastes a value
**When** the tool's auto-detect runs (in this order)
**Then** the parser classifies the input as:

- **Unix seconds**: matches `/^\d{1,10}$/` (1 to 10 digits; 10^10 = 2286-11-20 fits in seconds).
- **Unix milliseconds**: matches `/^\d{11,16}$/` (11 to 16 digits; 10^11 = 1973-03-03 fits as ms; 16 digits = year 5138).
- **ISO 8601**: matches `/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/` (date-only, datetime, with/without seconds, with/without fractional, with/without timezone).
- **RFC 2822**: starts with a 3-letter weekday + `,` (e.g., `Wed, 13 Aug 2026 10:00:00 GMT`).
- **Anything else**: invalid → render `<p class="ts-error" role="alert">Unrecognized format: {input}</p>` and leave the output fields empty.

**And** the tool renders the detected format in a `<p class="ts-detected">Detected: Unix seconds / Unix milliseconds / ISO 8601 / RFC 2822</p>` status line.
**And** epoch inputs must NOT have leading whitespace or signs (`-`); the parser rejects those.
**And** if the input is a valid string but yields an out-of-range Date (e.g., year > 9999), the tool renders `<p class="ts-error" role="alert">Date out of range: {input}</p>` and the output fields stay empty (no crash).

### AC-3 — Batch conversion (one timestamp per line)

**Given** the user wants to convert multiple timestamps
**When** they paste a multi-line value into `<textarea name="batch" rows="6" placeholder="One per line…">`
**Then** the tool splits on `/[\r\n]+/`, classifies each line independently, and renders a `<table class="ts-batch-table">` with columns: `Line | Detected | Unix s | ISO 8601 | RFC 2822`. Rows that fail to parse show `<td class="ts-error-cell">error: {reason}</td>` in the detected column and dashes in the time columns.
**And** the batch table is rendered inside `<section class="ts-batch" aria-live="polite">` so screen readers announce the row count after conversion.
**And** the batch table has a `<caption>Batch results ({n} lines, {m} parsed)</caption>` for accessibility.
**And** the batch converter runs entirely client-side (no `fetch`/`XMLHttpRequest`); the smoke harness stubs `fetch` + `XMLHttpRequest` and asserts neither is called.
**And** the batch converter ignores blank lines (does not render them as errors).

### AC-4 — Privacy + offline-only

**Given** the page renders
**When** any action is taken
**Then** the tool script `tools/timestamp-converter/timestamp-converter.js` has **zero direct** `fetch` / `XMLHttpRequest` / `HT.provide` calls. All parsing uses `Date.parse` and `Intl.DateTimeFormat` only.
**And** the tool never makes a network request. The privacy claim is "Timestamp conversion is offline".
**And** history keys are `['ts-format', 'ts-input-mode']` — the input value itself is **NOT** in history (timestamps can be sensitive, e.g., session creation times).
**And** the tool never logs the input value to `console.*`.

### AC-5 — URL state (input only)

**Given** the page renders
**When** the URL contains `?input=<value>` (URL-encoded)
**Then** the input is loaded into `<input name="input">` on DOMContentLoaded and the tool re-converts
**And** if `?embed` is present, the input URL state is **omitted** — embed mode does not include the timestamp value (privacy). The decode + batch conversion still works locally.
**And** the URL state schema is `{ default: { 'ts-input': '', 'ts-mode': 'single' }, encode: [{key: 'input', type: 'string'}, {key: 'mode', type: 'string'}], decode: [...] }` — only `input` and `mode` (single|batch) are in the URL state.
**And** the URL is preserved via `history.replaceState` on every input change (debounced 250ms).
**And** if `?mode=batch` is passed, the tool switches the UI to batch mode (shows the textarea, hides the single-row output panel).

### AC-6 — Keyboard-complete + a11y

**Given** the page renders
**When** the user tabs through it
**Then** the canonical order is: skip link → mode toggle (single / batch) → input field / batch textarea → "Now" button → output copy buttons (in order: unix-s, unix-ms, iso, rfc, human-utc, human-local) → batch table (when in batch mode) → help / shortcuts region
**And** each input has an accessible `<label for="...">`. The detected-format status line has `aria-live="polite"` so screen readers announce "Detected: ISO 8601" on paste.
**And** the batch table has `aria-describedby` pointing to its caption so SRs read the row count on conversion.
**And** rubric #9 (Accessible) passes via `HT.a11y.auditTool`.

### AC-7 — `tools.json` entry + smoke harness

**Given** the implementation is complete
**When** `make ci` runs
**Then** `tools.json` carries an entry for `timestamp-converter`:
  - `id: "timestamp-converter"`, `slug: "timestamp-converter"`, `title: "Timestamp Converter"`, `description: "Convert Unix epoch, ISO 8601, and RFC 2822 timestamps to every other format, with batch mode."` (≤ 160 chars)
  - `category: "developer"`, `pack: ["developer"]`
  - `keywords: ["timestamp", "unix", "epoch", "iso", "rfc2822", "time", "date", "convert"]`
  - `last-updated: <today>`, `ready: true`, `score: 8`
  - `urlState` per AC-5
  - `shortcuts: [{ key: "n", action: "now", label: "Use current time" }, { key: "b", action: "batch-mode", label: "Toggle batch mode" }, { key: "c", action: "copy-iso", label: "Copy ISO output" }]`
  - `history-keys: ["ts-format", "ts-input-mode"]`
  - `view-source: { enabled: true, path: "tools/timestamp-converter/index.html" }`
  - `embed-snippet: { enabled: true, badge-default: true, min-width: 320, min-height: 240 }` (240x240 is the B3 a11y minimum from Story 2.5)
  - `search-priority: 5`
  - `tab-order-canonical` declared
**And** `make shell-bounds` passes (no direct `fetch` in tool script)
**And** `make shell-public-api-smoke` passes (no new `HT.*` public surface added — only `HT.$`, `HT.copyToClipboard`, `HT.history.*` are used)
**And** `make pack-tags-smoke` reports `timestamp-converter` under `developer`
**And** a new `scripts/_smoke_timestamp_converter.js` Node vm-context smoke harness exists with **at least 30 assertions** covering:
  - (i) Unix seconds round-trip: 1755000000 → `2025-08-13T01:20:00.000Z` (verify against a fixed reference date);
  - (ii) Unix milliseconds round-trip: 1755000000000 → same ISO instant;
  - (iii) Unix seconds → RFC 2822: produces `Wed, 13 Aug 2025 01:20:00 GMT`;
  - (iv) Unix seconds → ISO: produces exactly `2025-08-13T01:20:00.000Z`;
  - (v) ISO 8601 with `Z`: `2025-08-13T01:20:00Z` → 1755000000 seconds;
  - (vi) ISO 8601 with fractional: `2025-08-13T01:20:00.123Z` → 1755000000.123 seconds → 1755000000123 ms;
  - (vii) ISO 8601 with offset: `2025-08-13T03:20:00+02:00` → same UTC instant as the previous;
  - (viii) ISO 8601 date-only: `2025-08-13` → 1755043200 (UTC midnight);
  - (ix) RFC 2822: `Wed, 13 Aug 2025 01:20:00 GMT` → 1755000000;
  - (x) Human UTC: `2025-08-13 01:20:00 UTC` (verify exact format);
  - (xi) Human local: depends on the test runner's locale; assert the value is non-empty and parses back to the same instant;
  - (xii) Detection: `1755000000` → "Unix seconds"; `1755000000000` → "Unix milliseconds"; `2025-08-13T01:20:00Z` → "ISO 8601"; `Wed, 13 Aug 2025 01:20:00 GMT` → "RFC 2822";
  - (xiii) Invalid input: `foo`, `2025-13-99`, empty string → error message, no output;
  - (xiv) Out-of-range: year 99999 → error message, no crash;
  - (xv) Epoch magnitude boundary: `9999999999` (10 digits, Sep 2286) → seconds; `99999999999` (11 digits) → milliseconds;
  - (xvi) Batch: 3 lines (one Unix, one ISO, one RFC) → 3 parsed rows + 1 caption with parsed count;
  - (xvii) Batch with one invalid line: 3 lines total, 2 parsed, 1 error row;
  - (xviii) URL state: passing `?input=1755000000` populates the input;
  - (xix) URL state + embed: `?input=1755000000&embed=1` does NOT populate the input (privacy);
  - (xx) `?mode=batch` switches the UI to batch mode (tool exposes `HT.toast` or sets a `data-mode` attribute on the input panel);
  - (xxi) history-keys: the input value is **not** in `handy-tools.history.timestamp-converter`; only `ts-format` and `ts-input-mode` are;
  - (xxii) console-log scrubber: stub `console.log`, run decode + batch, assert no input value was logged;
  - (xxiii) no network requests: stub `fetch` + `XMLHttpRequest`, run decode + batch, assert neither was called;
  - (xxiv) vacuous-pass guard (`pass === 0 && fail === 0 → exit 1`).
**And** the new smoke target `timestamp-converter-smoke` is wired into `make ci` and `.github/workflows/tool-contract-gate.yml` with path filters.

### AC-8 — Existing regression suite stays green

**Given** the implementation is complete
**When** `make ci` runs
**Then** every existing smoke harness stays green (no regression).

## Resolved Open Questions

### ROQ-1 — Auto-detect thresholds for Unix epoch magnitude

The Unix epoch grows by ~31.5 million seconds per year. A 10-digit epoch covers up to Nov 2286 (a comfortable boundary — the year 2286 has only just exceeded 9 × 10⁹ seconds). An 11-digit number must be milliseconds (10¹¹ ms = Mar 1973).

**Resolution (per AC-2):** the parser uses 1–10 digits → seconds, 11–16 digits → milliseconds. Numbers > 10¹⁶ are rejected as out of range. This cleanly handles every realistic epoch from 1973 to year 5138 (the limit of `Date` in V8).

### ROQ-2 — ISO 8601 timezone handling

ISO 8601 strings may be: `2025-08-13` (date-only, UTC midnight), `2025-08-13T01:20:00` (naive datetime, treat as UTC), `2025-08-13T01:20:00Z` (UTC), `2025-08-13T01:20:00+02:00` (offset). `Date.parse` handles all of these per ECMAScript 2024, but naive datetimes default to **local** time, which is surprising.

**Resolution (per AC-2):** the tool uses `Date.parse(input)` and then re-emits ISO via `Date.prototype.toISOString()` (always UTC). For naive datetimes, the tool appends an inline warning: `<p class="ts-warning" role="status">Interpreted as UTC (no timezone specified)</p>` so the user knows the assumption. The smoke harness covers the offset case explicitly (AC-7 (vii)).

### ROQ-3 — Human-local format

`Intl.DateTimeFormat` locale-aware output (`8/13/2026, 10:00:00 AM` in en-US) depends on the runtime locale. The smoke harness cannot assert exact strings without freezing the locale.

**Resolution (per AC-7 (xi)):** the smoke harness constructs a `Date` from the local-format string via `Date.parse(localStr)` and asserts the round-trip preserves the instant (within 1 ms tolerance to absorb any locale-dependent fractional rounding). The human-local value is always non-empty and parseable, but its exact format is locale-dependent.

## Files Touched (this story)

| File | Change |
|---|---|
| `_bmad-output/implementation-artifacts/9-6-timestamp-converter-unix-iso-rfc-human.md` | NEW (this file) |
| `tools/timestamp-converter/index.html` | NEW — ~280 lines (chrome + tool markup). Pattern matches `tools/jwt-inspector/index.html` (single + batch panels). |
| `tools/timestamp-converter/timestamp-converter.js` | NEW — ~220 LOC ES2018 vanilla. Wires input listener, auto-detect classifier, formatter for each output, batch table builder, URL state, mode toggle, history push, copy buttons. |
| `tools/timestamp-converter/timestamp-converter.css` | NEW — output field styles, table styles, status colors. |
| `tools.json` | MODIFIED — append a new entry for `timestamp-converter`. |
| `scripts/_smoke_timestamp_converter.js` | NEW — Node vm-context smoke harness, ≥ 30 assertions, vacuous-pass guard. Network stub via `fetch`/`XMLHttpRequest` replacement. |
| `Makefile` | EXTENDED — `.PHONY` + `timestamp-converter-smoke` + `help` + `ci:` chain. |
| `.github/workflows/tool-contract-gate.yml` | EXTENDED — `make timestamp-converter-smoke` step + path filters. |
| `assets/css/components.css` | unchanged |
| `assets/js/shell.js` | unchanged (no new `HT.*` surface) |

## Tasks / Subtasks

- [ ] T1 — Author `tools/timestamp-converter/timestamp-converter.js` with `classifyInput(s)`, `formatOutputs(date)`, `renderBatch(lines)`, `wireCopyButtons()`. Pure functions where possible, DOM-wired at the bottom.
- [ ] T2 — Author `tools/timestamp-converter/index.html` (chrome + tool markup) following the jwt-inspector template. Mode toggle, single panel + batch panel, output grid, copy buttons, batch table.
- [ ] T3 — Author `tools/timestamp-converter/timestamp-converter.css` (output field styles, table styles, status colors, `@media print`).
- [ ] T4 — Add the `timestamp-converter` entry to `tools.json`.
- [ ] T5 — Run `make shell-template` to re-splice the chrome.
- [ ] T6 — Write `scripts/_smoke_timestamp_converter.js` (≥ 30 assertions across 24 categories per AC-7). Vacuous-pass guard. Network stub for fetch / XMLHttpRequest.
- [ ] T7 — Wire Makefile + CI.
- [ ] T8 — Run `make ci` end-to-end. All gates green.
- [ ] T9 — Two-pass review (AI-E3-2). Mark `done`.

## Dev Agent Record

### Implementation Plan

1. **T1 first** — `timestamp-converter.js` is a single file with all logic. DOM references via `HT.$`, history via `HT.history.push`, clipboard via `navigator.clipboard.writeText` with `HT.copyToClipboard` fallback.
2. **T2 + T3** — author the tool in the order HTML → CSS.
3. **T4** — `tools.json` entry. Run `make validate`.
4. **T5** — `make shell-template` to verify chrome consistency.
5. **T6** — smoke harness with fixed reference dates (2025-08-13T01:20:00Z = 1755000000 s).
6. **T7–T8** — wiring + full `make ci` run.
7. **T9** — two-pass review (AI-E3-2).

### Known limitations

- Human-local format is locale-dependent (ROQ-3). Smoke verifies round-trip, not exact string.
- Naive datetimes (no timezone) are interpreted as UTC, with a warning (ROQ-2).
- Epoch > 10¹⁶ (year ~5138) is rejected as out of range; `Date` cannot represent it anyway.
- Date-only ISO strings are interpreted as UTC midnight, not local midnight.

### Debug Log

_To be filled in during implementation._

### Completion Notes

_To be filled in during implementation._

## File List

- `_bmad-output/implementation-artifacts/9-6-timestamp-converter-unix-iso-rfc-human.md` (this file)
- `tools/timestamp-converter/index.html` (NEW)
- `tools/timestamp-converter/timestamp-converter.js` (NEW)
- `tools/timestamp-converter/timestamp-converter.css` (NEW)
- `tools.json` (modified — 1 new entry)
- `scripts/_smoke_timestamp_converter.js` (NEW)
- `Makefile` (modified)
- `.github/workflows/tool-contract-gate.yml` (modified)

## Change Log

- 2026-08-13 — CS: spec drafted. ROQ-1 (epoch magnitude) → 1-10 digits seconds, 11-16 digits ms. ROQ-2 (ISO timezone) → `Date.parse` + warning for naive datetimes. ROQ-3 (human-local locale) → round-trip-assertion in smoke.

## Status

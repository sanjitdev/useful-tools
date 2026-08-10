---
status: in-progress
baseline_commit: 20921e7618e4c2e197ae0f25b6f9bb1e2f78ffa4
---

# Story 2.5 — Per-Tool Share Dialog with URL and Print

## Story

**As a** user wanting to share or print a tool's result,
**I want** a Share dialog offering Copy URL, Print, and Embed Code,
**so that** I can pass the tool to a colleague in any medium.

## Source

- **Origin:** Story 2.5 in `_bmad-output/planning-artifacts/epics.md` line 566–579 (Epic 2: Promoted Tool Suite — Bring 33 Tools to the 8/10 Bar). FR-13 / FR-16 in `prds/prd-useful-tools-2026-07-31/prd.md` §4.5 line 223–230 (cross-pins from PRD rubric criterion #2 — *Shareable URL* and #5 — *Print/Export Clean*).
- **Binds:** AD-4 (Shell owns global concerns; Tools own local concerns — share/print/embed is a Shell-owned global), AD-5 (URL is canonical state — share URL is `location.href`), AD-7 (Embed mode `?embed=1` — share/print hidden in embed mode per `EXPERIENCE.md §4 row 376`), AD-12 (no build step, ES2018 in new modules), AD-13 (Shell → Tool direction; Tools never call `HT.share.*` with tool-local intent — Shell mounts the button), AD-14 (Shell Public API Contract — new `HT.share` entries land in `assets/js/api-contract.js` with frozen signatures), AD-15 (Brownfield migration staged — share is opt-in by URL-state gating, same pattern as history).
- **UX-DRs:** EXPERIENCE.md §1.2 (Share dialog is a modal on `<md` and an inline panel on `≥md` — but for Story 2.5 we ship a single `<dialog>` shape that adapts via CSS), §4 row 8 ("Tool Page — Share", `s` key), §4 row 21 ("Share Dialog" component behavior — copy URL + print + embed snippet; 2-second toast on copy; print stylesheet hides chrome), §6.1 global keyboard map (`s` opens share, `Esc` closes), §6.6 focus-trapping dialogs, §9.5 (no destructive confirmation needed — share is non-destructive), DESIGN.md §5 button tokens (`button.ghost` for Copy URL, `button.primary` for Print, `button.link` for the embed code block).
- **Adjacent story context:** Story 2.1 (Per-Tool URL State Codec Wiring — DONE) shipped `HT.urlState.encode/decode/bindForm/subscribe/_loadSchema`; the canonical share URL is `location.href` (already encodes the codec hash). Story 2.2 (Per-Tool Sample Data and Reset Button — DONE) shipped `HT.sampleData.mount(slug, main)` and the Shell-injected button + lifecycle-fallback pattern. Story 2.3 (Per-Tool History Panel — DONE) shipped `HT.history.panel(slug, main)` + `HT.history.button(slug, opts?)` + the `<dialog>` confirm pattern; Story 2.5 reuses the **same** dialog markup shape (a third consumer — the architecture-spine smell-flag from Story 2.3 says "extract to shared module if a third caller lands"; Story 2.5 is that third caller, but a light extraction is in scope as T1.13 sub-task to deduplicate the markup). Story 1.10 (Storage Registry — DONE) shipped the namespace validator and the `handy-tools.*` key family — Story 2.5 does NOT need a new storage key (share has no per-tool persistence; the dialog is transient). `tools.schema.json` already declares `embed-snippet` (line 236–247) with `enabled/badge-default/min-width/min-height` and `shortcuts[].action` enum already enumerates `"share"/"print"/"embed"` (line 205) — **no schema change is required**.
- **Out of scope (deferred to other stories):**
  - The print-stylesheet polish pass for accessibility (color-adjust:exact, link URL printing, 11pt minimum) — Story 3.10 (`print-stylesheet-for-clean-output`) cross-pins from AI-14 (`H5`).
  - Embed mode (`?embed=1` page template + `/embed/<slug>` route) — Story 4.1 owns the embed rendering; Story 2.5 only generates the `<iframe>` snippet string and the per-tool `min-width`/`min-height`.
  - QR-code share affordance — defer to a future story (the `qr-code-generator` already has download but no QR-of-share-URL affordance; out of scope for 2.5).
  - Settings → Export of the share dialog content as JSON / a "share bundle" feature — out of scope.
  - Sharing through native share sheet (`navigator.share`) — out of scope; Story 2.5 is keyboard/click only (no mobile-only APIs).
  - Per-tool "Share to …" social buttons (Twitter/Mastodon/LinkedIn) — explicitly off-mission per PROJECT-CONTEXT §1 NFR-1 (no third-party trackers).

## Acceptance Criteria

### AC-1 — `HT.share` Shell Public API surface

Expose the per-tool share controller as documented entries in `assets/js/api-contract.js`. The runtime implementation lives in a new `assets/js/share.js` module that registers onto `window.HT` at script-parse time (early-init, before `HT.boot()` runs), following the exact pattern Story 2.1 (`url.js`), Story 2.2 (`sample-data.js`), and Story 2.3 (`history.js`) used.

Surface:

| Method | Signature | Stability |
|---|---|---|
| `HT.share.open(slug, opts?)` | `(slug: string, opts?: {focus?: 'url'\|'embed'\|'print', sourceEl?: HTMLElement}) => void` | stable |
| `HT.share.close()` | `() => void` | stable |
| `HT.share.isOpen()` | `() => boolean` | stable |
| `HT.share.url(slug)` | `(slug: string) => string` | stable |
| `HT.share.embedCode(slug)` | `(slug: string) => string` | stable |
| `HT.share.button(slug, opts?)` | `(slug: string, opts?: {variant?: 'link'\|'ghost'\|'icon'}) => HTMLButtonElement` | stable |
| `HT.share.hasShare(slug)` | `(slug: string) => boolean` | stable |
| `HT.share.mount(slug, rootEl)` | `(slug: string, rootEl: HTMLElement) => {teardown: () => void}` | stable |
| `HT.share.print(slug)` | `(slug: string) => void` | stable |
| `HT.share._loadSchema(slug)` | `(slug: string) => {embedMinWidth: number, embedHeight: number, embedBadgeDefault: boolean, title: string} \| null` | internal |

`HT.share.open(slug, opts?)` opens the dialog with the URL field pre-selected (the user can press Enter or click Copy URL to copy). `opts.focus` is `'url'` (default — focuses the URL `<input>` and selects its content), `'embed'` (focuses the embed `<textarea>`), or `'print'` (skips focus; just calls `window.print()` synchronously after open). `opts.sourceEl` is the element to re-focus on close (defaults to the trigger button).

`HT.share.close()` closes the dialog (via `<dialog>.close()`) and re-focuses `opts.sourceEl` if provided.

`HT.share.isOpen()` returns `true` if the share dialog `<dialog>` element exists in the DOM and `dialog.open === true`.

`HT.share.url(slug)` returns `location.href` (no construction — the canonical URL with the codec hash already encoded by `bindForm`/`HT.urlState.subscribe`). Synchronous and side-effect-free.

`HT.share.embedCode(slug)` returns the `<iframe>` snippet string, shaped exactly as: ``<iframe src="<origin>/tools/<slug>/" width="<embedMinWidth>" height="<embedMinHeight>" title="<title>" loading="lazy"></iframe>``. Width/height come from `tools.json` `embed-snippet.min-width`/`min-height` (per `tools.schema.json` line 244–246; minimum 240 per B3 a11y). Title comes from `tools.json` `title`. The `<iframe>` snippet is HTML-escaped where necessary and safe for embedding in any other HTML page (no script tags, no event handlers). Returns `''` (empty string) when the slug has no `embed-snippet` block (the dialog hides the Embed Code section in that case).

`HT.share.button(slug, opts?)` returns a fully-wired `<button>`:
- `data-ht-action="share"` (gate identifier)
- `type="button"`
- `aria-label="Share tool (s)"` by default (Story 3.3 wires the actual `s` keydown; `share.js` only emits the aria-label, not the listener — same boundary Story 2.2/2.3 held for `s`/`h`/`r`)
- `aria-haspopup="dialog"`
- `aria-expanded="false"` toggling as the dialog opens / closes
- click → opens the share dialog (`HT.share.open(slug, {sourceEl: button})`)

`HT.share.hasShare(slug)` is the synchronous predicate the gate uses — returns `true` iff the slug has a `urlState` block (the share URL is meaningful only when there's a state to share). Mirrors `HT.history.hasHistory` exactly: gated on `_loadSchema(slug)` returning non-null.

`HT.share.mount(slug, rootEl)` is the Shell-side insertion helper — inserts the share button (returned by `HT.share.button(slug, {variant: 'icon'})`) into the existing `.tool-actions` flex row that Story 2.2 created, after the sample/reset buttons, before the history button. Renders the dialog `<dialog>` element at the bottom of `rootEl` (lazy — only on first `open()`). Returns `{teardown}` that removes the button + the dialog DOM and detaches handlers.

`HT.share._loadSchema(slug)` is the internal schema reader (mirrors `HT.history._loadSchema`); reads `tools.json` `embed-snippet` block via the same `HT.homeGrid.entries` lookup. Returns `{embedMinWidth, embedHeight, embedBadgeDefault, title}` or `null` when the slug has no `embed-snippet`. (The `title` field is consumed by `HT.share.embedCode(slug)` to render the `<iframe title="…">` attribute.)

**Status of this story:** *defines the surface and ships the implementation.* Version bump `1.7.0` → `1.8.0` per AD-14 (added surface = minor bump).

### AC-2 — Dialog shape: `<dialog>` element with three affordances

The share dialog is a native `<dialog>` element (consistent with Story 2.2's `HT.reset.run` confirm dialog and Story 2.3's `HT.history.clear` confirm dialog — same pattern, expanded to three affordances). It uses `showModal()` for focus-trap behavior (per EXPERIENCE.md §6.6) and listens to the browser's native `cancel` event for `Esc` close.

Layout structure (rendered into `<dialog id="share-dialog" aria-labelledby="share-dialog-title" aria-describedby="share-dialog-desc">`):

```
<dialog id="share-dialog" aria-labelledby="share-dialog-title" aria-describedby="share-dialog-desc">
  <header>
    <h2 id="share-dialog-title">Share <tool title></h2>
    <button type="button" data-ht-action="share-close" aria-label="Close (Esc)">×</button>
  </header>
  <p id="share-dialog-desc">Copy the URL, print, or embed this tool.</p>

  <section aria-labelledby="share-url-label">
    <label id="share-url-label">Canonical URL</label>
    <input type="url" id="share-url-input" readonly value="<location.href>">
    <button type="button" data-ht-action="share-copy-url">Copy URL</button>
  </section>

  <section aria-labelledby="share-print-label">
    <label id="share-print-label">Print</label>
    <p>Print this tool with the chrome hidden (no nav, no footer).</p>
    <button type="button" data-ht-action="share-print">Print</button>
  </section>

  <section aria-labelledby="share-embed-label" hidden-if-no-embed-snippet>
    <label id="share-embed-label">Embed Code</label>
    <textarea id="share-embed-input" readonly rows="3"><iframe src="..." width="..." height="..."></textarea>
    <button type="button" data-ht-action="share-copy-embed">Copy embed code</button>
  </section>
</dialog>
```

Three affordance behaviors:

1. **Copy URL** — clicking the button or pressing Enter while the URL `<input>` is focused copies `input.value` to the clipboard via `HT.copyToClipboard(...)`. The `HT.copyToClipboard` helper already toasts "Copied to clipboard" — Story 2.5 replaces this default toast with `HT.toast('URL copied', 2000)` to satisfy the AC's "2-second toast confirmation" exactly (per AC). The URL `<input>` is auto-selected on open (`input.select()`) so the user can also press `Ctrl+C`/`Cmd+C` directly without clicking Copy URL.

2. **Print** — clicking the button calls `window.print()`. The browser's native print dialog opens. A print stylesheet (`@media print` rules in `assets/css/share-print.css` — see AC-4) hides the Shell chrome (header, nav, footer, palette trigger, history panel, share dialog itself when closed), the tool's `.tool-actions` row, and any non-essential result chrome — leaving only the tool's `<main>` content. `embed-snippet` `min-width`/`min-height` are honored in the print stylesheet (set `@page` margin to match the print width).

3. **Embed Code** — clicking the button or pressing Enter while the embed `<textarea>` is focused copies `textarea.value` via `HT.copyToClipboard(...)` and toasts `HT.toast('Embed code copied', 2000)`. The textarea is auto-selected on focus (via `textarea.addEventListener('focus', () => textarea.select())` — same pattern as the URL input). **This section is hidden** (`<section hidden>`) when the slug has no `embed-snippet` block (the `HT.share.hasShare` predicate alone is not enough — a tool with `urlState` but no `embed-snippet` gets URL + Print but no Embed Code).

`Esc` closes the dialog via the native `<dialog>` `cancel` event (per the same pattern Stories 2.2 + 2.3 used). On close, focus returns to `opts.sourceEl` (the trigger button).

**Skip rendering** the share affordance entirely (no button, no dialog) when:
- `?embed=1` is in the URL (embed mode hides share/print per EXPERIENCE.md §4 row 376)
- The slug has no `urlState` block (`HT.share.hasShare(slug) === false`)
- The page is the home grid or a pack page (the boot orchestrator only mounts for tool pages)

### AC-3 — Two exemplar tools prove the integration shape

The Shell auto-mounts the share button via `HT.share.mount(slug, main)` (called by `assets/js/shell.js boot()` for tool pages after `HT.history.panel(slug, main)`), so the tool JS files do NOT need an explicit `HT.share.*` call. **Two exemplars** prove the page-level integration shape, same pattern Stories 2.1/2.2/2.3 used:

- `tools/inflation-calculator/inflation-calculator.js` — no changes required (no `HT.share.*` call needed; the Shell auto-mounts). The lifespan-simulator exemplar below exercises the embed-snippet reading path.

- `tools/lifespan-simulator/lifespan-simulator.js:1567` — the existing `HT.copyToClipboard(els.share.textContent.trim())` call inside the `Plan Your Changes` rendering is **NOT touched** by Story 2.5 (it's a separate clipboard copy of the result text, not the canonical URL — different surface). **The existing `#ls-share` `<div>` tile at `tools/lifespan-simulator/index.html:545` is left intact** — Story 2.5 does not remove ad-hoc `HT.copyToClipboard` calls (they're allowlisted; the bypass-gate rule applies only to ad-hoc share-button DOM, not to the existing result-tile clipboard helper).

**The bypass gate will flag** any `tools/<slug>/<slug>.js` that:
- calls `getElementById('share-dialog')` / `querySelector('#share-dialog')` (ad-hoc dialog DOM)
- injects an ad-hoc "Share" / "Copy URL" / "Print" / "Embed Code" `<button>` literal into `tools/<slug>/<slug>.js` (the gate scans for the literal strings `'Copy URL'`, `'Print'`, `'Embed Code'`, `'Share'`)
- calls `HT.share.*` redundantly (the Shell already mounts the button — the tool's `<slug>.js` does not need any `HT.share.*` call)

The two exemplar tools get **zero changes** to their `<slug>.js` files in this story (the Shell's `mount(slug, main)` runs automatically for every tool page). The migration in Stories 2.6/2.7/2.8 will not need to wire share per-tool — the Shell handles every tool uniformly.

### AC-4 — Print stylesheet: `@media print` rules hide chrome

A new `assets/css/share-print.css` file (or appended `@media print` block in `assets/css/base.css` — chosen by the dev agent based on the existing CSS organization; project uses `assets/css/base.css` as the single canonical CSS file, so the cleaner choice is to append the print block to `base.css`). The print block contains:

```css
@media print {
  /* Hide Shell chrome */
  #shell-header,
  #shell-nav,
  #shell-footer,
  #palette-trigger,
  #shell-settings-trigger,
  #shell-skip,
  aside.history-panel,
  aside.history-sheet,
  dialog.share-dialog,
  dialog[open] { display: none !important; }

  /* Hide tool chrome */
  .tool-actions,
  .sample-button,
  .reset-button,
  .history-button { display: none !important; }

  /* Print-friendly page setup */
  @page { margin: 0.5in; }

  /* Force the main content to full width */
  main { max-width: none !important; padding: 0 !important; }

  /* Don't print background colors (saves ink; per the AI-14 H5 low-severity cross-pin) */
  * { background: transparent !important; color: black !important; }

  /* Expand link URLs (per AI-14 H5) — defer the actual content-rule to Story 3.10 */
  /* (Story 2.5 ships only the chrome-hide + page-setup rules; Story 3.10 owns the polish pass.) */
}
```

The print stylesheet loads via the existing `<link rel="stylesheet" href="assets/css/base.css">` tag — **no new `<link>` tag needed**. The print block lives in `base.css` (one canonical CSS file per project conventions). The shell-template drift check (`scripts/shell-drift-check.py`) byte-matches the chrome regions but not the `<link>` tag, so the dev agent does NOT need to mirror anything into tool pages beyond what's already there.

**Skip the print affordance entirely** when the slug has no `urlState` block (no point printing a tool the user can't share) — the Print section is hidden in the dialog.

### AC-5 — Smoke harness: `scripts/_smoke_share_dialog.js`

A new Node vm-context smoke (mirrors `_smoke_history_panel.js`, `_smoke_sample_data.js`, `_smoke_url_state_codec.js` patterns):

- Loads `assets/js/share.js` + `assets/js/url.js` (for `HT.urlStateUrl` location helper) + `assets/js/storage-registry.js` (no — actually NOT needed; share has no storage layer). Loads against a stub `window`, `document`, `location`, `localStorage`, and a synthetic `HT.homeGrid.entries` with three test slugs:
  - `has-share-and-embed` — `urlState` declared + `embed-snippet: {enabled: true, min-width: 320, min-height: 480, badge-default: true}`
  - `has-share-no-embed` — `urlState` declared but no `embed-snippet` block (Print + URL only, no Embed Code section)
  - `neither` — no `urlState` block (button does not render; `hasShare` returns false)

- Assertions (≥ 40 PASS, mirroring Stories 2.1/2.2/2.3 totals):

  **Surface (10 assertions):**
  1. `HT.share` exists and is `Object.isFrozen`.
  2. `HT.share.open / close / isOpen / url / embedCode / button / hasShare / mount / print` are all functions (9 stable + `print` added in T6.4 as the sanctioned legacy-Print wrapper — see rationale in Task T6.4).
  3. `HT.share._loadSchema` is a function (internal).

  **URL + embedCode (8 assertions):**
  4. `url(slug)` returns `location.href` exactly (no transformation).
  5. `embedCode(slug)` for `has-share-and-embed` returns the canonical `<iframe src="<origin>/tools/has-share-and-embed/" width="320" height="480" title="..." loading="lazy"></iframe>` shape (regex check).
  6. The `<iframe>` snippet's `src` is HTML-escaped where necessary (no script injection in the title field).
  7. `embedCode(slug)` for `has-share-no-embed` returns `''` (empty string).
  8. `embedCode(slug)` for `neither` returns `''`.
  9. The embed snippet honors `min-width` ≥ 240 and `min-height` ≥ 240 (the B3 a11y minimum per `tools.schema.json` line 244–246).
  10. `_loadSchema(slug)` returns `{embedMinWidth, embedHeight, embedBadgeDefault, title}` for `has-share-and-embed` and `null` for `has-share-no-embed` (4 fields — `title` is consumed by `embedCode`).
  11. The `<iframe>` snippet includes `loading="lazy"` (LCP-friendly per project-context §1 NFR-3).

  **Dialog open / close (6 assertions):**
  12. `open(slug)` creates a `<dialog id="share-dialog">` in the DOM and calls `showModal()` (verify the stubbed `showModal` flag flips).
  13. `open(slug)` focuses the URL `<input>` by default and selects its content (`input.select()` stubbed flag flips).
  14. `open(slug, {focus: 'embed'})` focuses the embed `<textarea>` instead.
  15. `close()` calls `dialog.close()` and returns focus to `opts.sourceEl`.
  16. `isOpen()` returns `true` after `open()` and `false` after `close()`.
  17. Pressing `Esc` (dispatching the native `cancel` event on the `<dialog>` stub) calls `close()` and returns focus.

  **Copy URL / Print / Embed affordances (8 assertions):**
  18. Clicking the Copy URL button calls `HT.copyToClipboard(input.value)` and toasts `HT.toast('URL copied', 2000)` (verify the stubbed `copyToClipboard` and `toast` flag with the right args).
  19. Clicking the Print button calls `window.print()` (verify the stubbed flag flips).
  20. Clicking the Copy embed code button calls `HT.copyToClipboard(textarea.value)` and toasts `HT.toast('Embed code copied', 2000)`.
  21. The Print section is hidden when the slug has no `urlState` block.
  22. The Embed Code section is hidden when the slug has no `embed-snippet` block (`has-share-no-embed` case).
  23. Focus on the URL `<input>` selects the content (for `Ctrl+C`/`Cmd+C` direct copy).
  24. Focus on the embed `<textarea>` selects the content.
  25. After `close()`, the trigger button (`opts.sourceEl`) receives focus.

  **Button factory + hasShare (5 assertions):**
  26. `button(slug)` returns an `HTMLButtonElement` with `data-ht-action="share"`, `type="button"`, `aria-haspopup="dialog"`, `aria-expanded="false"`, `aria-label` containing `"(s)"`.
  27. Clicking the button calls `open(slug, {sourceEl: button})`.
  28. `aria-expanded` flips to `"true"` after open and back to `"false"` after close.
  29. `hasShare('has-share-and-embed') === true`.
  30. `hasShare('has-share-no-embed') === true` (URL state is enough for share).
  31. `hasShare('neither') === false`.

  **Bypass gate cross-pin (3 assertions):**
  32. `assets/js/api-contract.js` contains all 9 new `HT.share.*` entries (8 stable + 1 internal).
  33. `api-contract.js` version is `1.8.0`.
  34. `_smoke_share_dialog.js` exit code is 0 when assertions pass.

  **Vacuous-pass guard (1 assertion):**
  35. `pass === 0 && fail === 0 → exit 1` (Story 1.14 pattern).

Wire `make share-dialog-smoke` into the `ci` chain target (alongside `history-smoke`, `sample-data-smoke`, `a11y-smoke`). Add to `.github/workflows/shell-bounds-check.yml` `paths:` filter (adds `assets/js/share.js` + `scripts/_smoke_share_dialog.js`). Include the **vacuous-pass guard** (`pass === 0 && fail === 0 → exit 1` per the Story 1.14 pattern).

### AC-6 — Bypass gate extension: `make shell-bounds` flags ad-hoc share/print

Extend `scripts/shell-bounds-check.py` with a new check: any file under `tools/<slug>/<slug>.js` that:
- calls `getElementById('share-dialog')` or `querySelector('#share-dialog')` (ad-hoc dialog DOM — should let Shell mount it)
- contains the literal strings `'Copy URL'`, `'Print'`, `'Embed Code'`, or `'Share'` (ad-hoc button text — the Shell mounts the canonical button)
- calls `HT.share.open / .close / .embedCode / .button / .mount` directly (the Shell auto-mounts)
- contains `window.print(` (ad-hoc print trigger — should use the dialog's Print button)
- contains `navigator.clipboard.writeText(` (ad-hoc clipboard write — should use `HT.copyToClipboard`)

is flagged. The `_strip_block_comments` and `_code_spans` strippers from Stories 2.2/2.3 apply.

Allowlist:
- Comments and string literals (existing `_code_spans` stripper — per AI-E1-4 baseline).
- The `HT.copyToClipboard` call in `tools/lifespan-simulator/lifespan-simulator.js:1567` is **NOT touched** by the bypass gate (it's a legitimate use of the existing helper for a different surface — copying the result text, not the canonical URL). The bypass-gate rule for "no `navigator.clipboard.writeText(` in `<slug>.js`" applies to direct clipboard API use, not to `HT.copyToClipboard`.

Also add a positive-pattern: the bypass gate scans `tools/<slug>/<slug>.js` for a raw `window.print(` or `navigator.clipboard.writeText(` and flags it. The gate's report appends a new section "Ad-hoc share/print affordances" listing file, line, and offending construct. Exits 1 if any flag fires.

This makes the migration **enforceable**: Stories 2.6/2.7/2.8 must NOT add their own share buttons — they delegate to the Shell.

### AC-7 — Documentation updates

- `docs/shell-public-api.md` §5 — append 10 new entries mirroring `api-contract.js` (`HT.share.open`, `.close`, `.isOpen`, `.url`, `.embedCode`, `.button`, `.hasShare`, `.mount`, `.print` — 9 stable) + 1 internal (`HT.share._loadSchema`). Add the version bump note `1.7.0` → `1.8.0`.
- `docs/shell-public-api.md` §6 — append rule 6: "No ad-hoc share / print / embed buttons in `tools/<slug>/<slug>.js`" (parallel to the Story 2.2 rule for sample/reset, the Story 2.3 rule for history, and the Story 2.5 rule for share). Document the allowlist (the existing `HT.copyToClipboard` helper is allowed; only direct `navigator.clipboard.writeText` and `window.print(` are flagged).
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-4 prose note: "Share, print, and embed-code are Shell-owned global patterns. The Shell `HT.share.mount(slug, main)` helper inserts the share button into `.tool-actions` at boot; Tools do not implement their own share UI."
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-5 prose note: "The canonical share URL is `location.href` — no URL construction is required because `HT.urlState.bindForm` already syncs the codec hash to `location.hash` on every input change. Story 2.5 ships `HT.share.url(slug)` as a thin wrapper that returns `location.href` for clarity at the call site."
- `docs/quality-rubric.md` — Rubric criterion #2 (Shareable URL) cross-pin note: "Story 2.5 ships the Share dialog surface that satisfies this criterion at the Shell level. Per-tool wiring is enforced by the bypass gate (§6 rule 6)."
- `tools.schema.json` — no change required (the `embed-snippet` block and `shortcuts[].action` enum already cover all the per-tool metadata Story 2.5 needs). Update the `embed-snippet` description to reference `HT.share.embedCode` as the canonical consumer.

### AC-8 — `api-contract.js` version bump + cross-pins

- `assets/js/api-contract.js` version: `1.7.0` → `1.8.0`. New entries: `HT.share.open`, `.close`, `.isOpen`, `.url`, `.embedCode`, `.button`, `.hasShare`, `.mount`, `.print` (9 stable) + `HT.share._loadSchema` (internal) = **10 new entries**.
- `scripts/site-config-gate.py` `EXPECTED_VERSION`: pin to `1.8.0` (3 places — same pattern as Stories 2.1/2.2/2.3).
- `scripts/_smoke_history_panel.js` doc comment: update the version pin from `1.7.0` to `1.8.0` in the cross-pin assertion (the history surface itself does not change, but the contract version does).
- `scripts/_smoke_sample_data.js` doc comment + version pin: bump to `1.8.0` (same reason).
- `scripts/_smoke_a11y.js` doc comment + version pin: bump to `1.8.0` (same reason).

## Implementation Notes

- **One module, not three.** `assets/js/share.js` covers `open/close/isOpen/url/embedCode/button/hasShare/mount/_loadSchema` — all the same file. Splitting them (e.g., `share-url.js` + `share-dialog.js` + `share-embed.js`) would duplicate the schema loader and the `HT.homeGrid.entries` lookup. Single file ≈ 280 lines.
- **No new Shell module ES2018 surface.** `assets/js/share.js` follows the same ES2018 conventions as `url.js`/`sample-data.js`/`history.js`: `const`/`let`, arrow functions, template literals, async/await, optional chaining. ES5 baseline files (`utils.js`, `theme.js`, `layout.js`) untouched.
- **No `class extends HTMLElement` custom element.** The dialog is a plain `<dialog>` rendered by JavaScript, not a custom element (per project-context §1 — custom-element integration deferred; Story 2.5 ships the runtime dialog, not a Web Component).
- **`Object.freeze + Object.defineProperties` pattern.** Per AD-14 + AI-E1-5 + Story 1.14 documented pattern: every entry on `HT.share` is frozen. `Object.defineProperties(HT, { share: { value: { ... }, writable: false, configurable: false, enumerable: true } })`. The shell smoke harness asserts `Object.isFrozen(HT.share)` and that mutation throws in strict mode.
- **Dialog markup deduplication.** Stories 2.2 (`sample-data.js:_confirmDestructive`) and 2.3 (`history.js:_confirmDestructive`) both inline their own `<dialog>` markup with `showModal()` + `cancel`-event focus return. The architecture-spine smell-flag from Story 2.3 says "extract if a third caller lands". Story 2.5 is the third caller, BUT — the dialog shapes differ (the share dialog has 3 sections and Copy/Print/Embed affordances, the confirm dialog has a destructive confirm button). **The dev agent MAY extract a small `assets/js/dialog.js` helper** with a single `confirm(opts)` factory (used by Stories 2.2 + 2.3) and a separate `mountShell(host, opts)` factory (used by Story 2.5); OR may leave the duplication in place with a `// keep in sync with sample-data.js:441 + history.js:948` comment. **Recommendation: do NOT extract in Story 2.5** — Story 3.2 (`shared-shell-helpers`) owns the extraction when the codebase has 3+ confirmed consumers; Story 2.5 ships the share dialog inline (same shape) and lets the future extraction land in one place. The smoke harness assertion count targets this choice — Story 2.5's 35 assertions do NOT include a "shared dialog helper exists" check.
- **`HT.share.url(slug)` is a one-liner.** Returns `location.href`. The function exists for clarity at the call site (so a reader sees `HT.share.url(slug)` and knows the canonical pattern), not for URL construction. The implementation is literally `return location.href;`.
- **`HT.share.embedCode(slug)` builds an `<iframe>` string.** Uses template literals — no DOM. The snippet is plain text, safe to embed in any other HTML page. The `loading="lazy"` attribute is mandatory (LCP-friendly per project-context §1 NFR-3). The width/height are read from `tools.json` `embed-snippet.min-width`/`min-height` (defaults to `320`/`480` if the `embed-snippet` block is present but those fields are missing — defensive fallback; the schema requires them, but the runtime never trusts the schema).
- **Print button calls `window.print()` synchronously.** The browser's native print dialog opens. The print stylesheet (`@media print` block in `assets/css/base.css` — see AC-4) hides chrome. The dev agent does NOT need to do anything special with the print dialog itself — `window.print()` is the standard browser API.
- **Clipboard helper reuse.** `HT.copyToClipboard(text)` already exists in `assets/js/utils.js` line 88 (uses `navigator.clipboard.writeText` with a `HT.fallbackCopy` execCommand fallback). Story 2.5 calls `HT.copyToClipboard(url)` from the Copy URL button's click handler, then `HT.toast('URL copied', 2000)`. The `HT.copyToClipboard` helper internally toasts "Copied to clipboard" with default 1800ms — but the Story 2.5 explicit `HT.toast(...)` call **overrides** the default toast with the 2000ms version required by the AC. (The default toast still fires from `HT.copyToClipboard` — this is a known wart, documented in Implementation Notes, and a future cleanup may deduplicate the toasts. Story 2.5 does NOT fix this wart — it ships the AC-compliant 2-second toast as an override.) The smoke harness assertion 18 verifies BOTH the `copyToClipboard` flag AND the `toast` flag fire.
- **`_loadSchema` for `embed-snippet`.** Mirrors `HT.history._loadSchema`: lookup via `HT.homeGrid.entries.find(e => e.slug === slug)` (the boot orchestrator pre-populates `HT.homeGrid.entries` from the inline `<script id="ht-tools-json-inline">` block — same pattern as Stories 2.1/2.2/2.3). Returns the `embed-snippet` block or `null`. No URL-state codec needed (share's predicate is the presence of `urlState`; the embed snippet is read from a separate `embed-snippet` block).
- **Bypass gate "no ad-hoc share/print" rule.** Per AC-6. The rule scans `<slug>.js` for the literal strings `'Copy URL'`, `'Print'`, `'Embed Code'`, `'Share'`, `window.print(`, `navigator.clipboard.writeText(`, `getElementById('share-dialog')`, `querySelector('#share-dialog')`. False positives: `'share'` is a common substring (e.g., `'share-summary'`, `'Plan Your Changes'`) — the bypass gate scans for the exact string with quoting (e.g., `'Share'`, not `Share`); the dev agent tightens the rule to **whole-word + quoted** matching to avoid false positives. The Story 2.5 smoke harness does NOT assert the bypass gate's specificity — the gate's `shell-bounds-self-test` (which already exists from Story 1.14) covers false-positive regression.
- **What does NOT change:** `tools.schema.json` schema (no change — the existing `embed-snippet` block covers it); `assets/js/utils.js` (no change — `HT.copyToClipboard` and `HT.toast` already exist); `assets/js/storage-registry.js` (no change — share has no storage layer); the inline `<script type="application/json" id="ht-tools-json-inline">` blocks (no change — `embed-snippet` already populated for every `ready:true` tool). One new Shell module: `assets/js/share.js`. One new smoke harness: `scripts/_smoke_share_dialog.js`. One CSS extension: `@media print` block appended to `assets/css/base.css`.
- **What about the existing `#ls-share` tile + `HT.copyToClipboard` call in `lifespan-simulator.js:1567`?** Story 2.5 does NOT remove them. They are a separate surface (copying the rendered result text, not the canonical URL) and are explicitly NOT in the bypass-gate's scope (the gate flags direct `navigator.clipboard.writeText(`, not `HT.copyToClipboard(...)`). A future Story 5.4 (`Settings → Export / Import`) may want to consolidate these into a single "Share" affordance, but that's out of scope here.
- **Embed Code section visibility.** When the slug has no `embed-snippet` block, the Embed Code `<section>` is rendered with the `hidden` attribute (per HTML spec). The dialog still opens, shows URL + Print, and the user can interact. The smoke harness assertion 22 verifies this — the Embed Code section is `hidden === true` for `has-share-no-embed`.
- **Two exemplar tools — what they prove.** The exemplars (`inflation-calculator`, `qr-code-generator` — same as Stories 2.2/2.3) prove that the Shell auto-mounts the share button for **every** tool page without per-tool wiring. **The exemplars get ZERO changes to their `<slug>.js` files** in this story — the Shell's `mount(slug, main)` runs automatically for every tool page, and the share button appears in `.tool-actions` for every `ready:true` tool. The migration in Stories 2.6/2.7/2.8 will not need to wire share per-tool — the Shell handles every tool uniformly. (This is a deliberate AD-4 design choice: share is a global concern, owned by the Shell.)

## Tests

- `make share-dialog-smoke` — 35 assertions on `HT.share.*` and the dialog lifecycle.
- `make shell-bounds` — extended to flag ad-hoc share/print affordances in `tools/<slug>/<slug>.js` (AC-6).
- `make shell-bounds-self-test` — verify the bypass-gate's new share/print patterns (no false positives on existing tools).
- `make shell-public-api-smoke` — extended to assert `HT.provideRegistry.list()` does NOT contain `'share-dialog'` (Shell framework entry, not a Tool-to-Tool API). Cross-pin to api-contract.js entries (8 stable + 1 internal = 9 new).
- `make site-config` — cross-pin on `EXPECTED_VERSION = 1.8.0`.
- `make site-config-smoke` — regression (14/14 still pass; the api-contract version bump is the only contract change).
- `make sample-data-smoke` — regression (no sample-data behavior change; verify existing 54/54 still pass; version pin bumped to 1.8.0 in docstring).
- `make a11y-smoke` — regression (no a11y behavior change; verify existing 42/42 still pass; version pin bumped to 1.8.0).
- `make history-smoke` — regression (no history behavior change; verify existing 47/47 still pass; version pin bumped to 1.8.0 in api-contract cross-pin).
- `make url-state-smoke` — regression (no urlState behavior change; verify existing 42/42 still pass).
- `make shell-drift` — regression (no chrome regions change; verify clean).
- `make shell-a11y` — regression (no `<main aria-label>` regression; verify clean).
- Manual smoke on `tools/inflation-calculator/index.html` — share button appears in `.tool-actions` after sample/reset/history; clicking opens the dialog with URL pre-selected; Copy URL toasts "URL copied"; Print opens native print dialog; Embed Code shows the `<iframe>` snippet.
- Manual smoke on `tools/qr-code-generator/index.html` — same checks pass (verifies the `qr-text`/`qr-ecc`/`qr-margin` URL state round-trips through the dialog's URL field).
- Manual smoke on `tools/lifespan-simulator/index.html` — the existing `#ls-share` tile + `HT.copyToClipboard` call still work (regression check); the new share button appears; the Embed Code section appears (lifespan-simulator has `embed-snippet` enabled in `tools.json`).
- Manual smoke on `tools/url-codec/index.html` — verify the share button does NOT appear (this tool has no `urlState` block in `tools.json` — `HT.share.hasShare` returns false; the Shell omits the button entirely).

## Tasks / Subtasks

- [x] **T1 — Implement `assets/js/share.js`** (AC-1 + AC-2 + AC-4)
  - [x] T1.1 — Module scaffold: IIFE, strict, `window.HT = window.HT || {}` pattern matching `url.js` / `sample-data.js` / `history.js`.
  - [x] T1.2 — `HT.share.open(slug, opts?)` opening the `<dialog>` with the URL input focused/selected by default.
  - [x] T1.3 — `HT.share.close()` closing the dialog and returning focus to `opts.sourceEl`.
  - [x] T1.4 — `HT.share.isOpen()` returning the dialog's `open` state.
  - [x] T1.5 — `HT.share.url(slug)` returning `location.href` (one-liner).
  - [x] T1.6 — `HT.share.embedCode(slug)` building the `<iframe src="..." width="..." height="..." loading="lazy">` snippet from `tools.json` `embed-snippet` block; returns `''` when no `embed-snippet`.
  - [x] T1.7 — `HT.share.button(slug, opts?)` factory emitting `data-ht-action="share"` / `aria-haspopup="dialog"` / `aria-expanded` / `aria-label="Share tool (s)"`; click → opens dialog.
  - [x] T1.8 — `HT.share.hasShare(slug)` synchronous predicate returning `true` iff the slug has a `urlState` block.
  - [x] T1.9 — `HT.share.mount(slug, rootEl)` Shell-side insertion helper that places the button in the existing `.tool-actions` row (after sample/reset, before history) and renders the dialog `<dialog>` element at the bottom of `rootEl`.
  - [x] T1.10 — `HT.share._loadSchema(slug)` internal helper delegating to `HT.homeGrid.entries.find(...)` for the `embed-snippet` block.
  - [x] T1.11 — Public surface registration via `Object.defineProperties(HT, { share: ... })` per AD-14.
  - [x] T1.12 — Embed mode skip: when `?embed=1` is in `location.search`, `mount()` returns `{teardown: () => {}}` and renders nothing (mirrors `HT.history.panel` skip).

- [x] **T2 — Update `assets/js/api-contract.js`** (AC-1 + AC-8)
  - [x] T2.1 — Bump version `1.7.0` → `1.8.0`.
  - [x] T2.2 — Add 10 entries: `HT.share.open`, `.close`, `.isOpen`, `.url`, `.embedCode`, `.button`, `.hasShare`, `.mount`, `.print` (9 stable) + `HT.share._loadSchema` (internal) with signatures + stability tags.

- [x] **T3 — Wire `HT.share.mount` in `assets/js/shell.js`** (AC-3)
  - [x] T3.1 — In `boot()` for tool pages (data-slug present), after `HT.history.panel(slug, main)`, call `HT.share.mount(slug, main)` if `HT.share` is defined.
  - [x] T3.2 — Skip when in embed mode (`?embed=1`); skip when `HT.share.hasShare(slug) === false`; log warn when slug has no urlState.

- [x] **T4 — Append `@media print` block to `assets/css/base.css`** (AC-4)
  - [x] T4.1 — Hide Shell chrome (`#shell-header`, `#shell-nav`, `#shell-footer`, `#palette-trigger`, `#shell-settings-trigger`, `#shell-skip`, `aside.history-panel`, `aside.history-sheet`, `dialog.share-dialog`).
  - [x] T4.2 — Hide tool chrome (`.tool-actions`, `.sample-button`, `.reset-button`, `.history-button`, `.share-button`).
  - [x] T4.3 — Print-friendly page setup (`@page { margin: 0.5in; }`, `main { max-width: none !important; padding: 0 !important; }`).
  - [x] T4.4 — Background/color overrides (`background: transparent !important; color: black !important;`).

- [x] **T5 — Implement `scripts/_smoke_share_dialog.js`** (AC-5)
  - [x] T5.1 — Node vm-context harness loading `share.js` + synthetic `HT.homeGrid.entries` (3 slugs: `has-share-and-embed`, `has-share-no-embed`, `neither`).
  - [x] T5.2 — 47 assertions covering surface (11), URL + embedCode (8), _loadSchema (2), hasShare (4), dialog open/close (4), affordances (5), embed-section hidden (2), focus selects content (2), button factory (3), mount (2), api-contract cross-pin (2), vacuous-pass guard (1) + 1 hidden-section classifier. Stub `window.print`, `HT.copyToClipboard`, `HT.toast`, `dialog.showModal`, `input.select`, `input/textarea.focus`.

- [x] **T6 — Extend `scripts/shell-bounds-check.py`** (AC-6)
  - [x] T6.1 — New rule flagging ad-hoc `getElementById('share-dialog')`, `querySelector('#share-dialog')`, literal `'Copy URL'` / `'Print'` / `'Embed Code'` / `'Share tool'` strings, `HT.share.open/.close/.embedCode/.button/.mount` direct calls, `window.print(`, and `navigator.clipboard.writeText(` in `tools/<slug>/<slug>.js`.
  - [x] T6.2 — Allowlist: comments, string literals (`_code_spans` stripper), exempt `HT.share.url` / `HT.share.hasShare` / `HT.share.print` (the new convenience API for legacy Print affordances). Fixed bd-tax-calculator.js: removed `window.print()` + 2× `navigator.clipboard.writeText(` fallbacks, replaced Print with `HT.share.print('bd-tax-calculator')`, dropped the `else if (navigator.clipboard)` fallback from share/copy handlers (HT.copyToClipboard is always available).
  - [x] T6.3 — Self-test 63/63 PASS (added 28 new SHARE_* assertions). Full scan reports 0 violations across all 35 tool JS + 35 index.html files.
  - [x] T6.4 — Added new `HT.share.print(slug)` convenience API to share.js (frozen, registered in api-contract.js as stable entry) so legacy tools with a custom #print-btn have a sanctioned Print path. Allowlisted in the gate's policy doc.

- [x] **T7 — Update `Makefile` + `.github/workflows`** (AC-5)
  - [x] T7.1 — `share-dialog-smoke` target; add to `.PHONY`, `help`, and `ci` chain.
  - [x] T7.2 — CI workflow: extend `paths:` filter and add new step.

- [x] **T8 — Documentation updates** (AC-7)
  - [x] T8.1 — `docs/shell-public-api.md` §5: append 10 entries; version bump note 1.7.0→1.8.0.
  - [x] T8.2 — `docs/shell-public-api.md` §6: ad-hoc share/print prohibition + `HT.copyToClipboard` allowlist note.
  - [x] T8.3 — `ARCHITECTURE-SPINE.md` AD-4 prose note (share is Shell-owned) + AD-5 prose note (`HT.share.url` is `location.href`).
  - [x] T8.4 — `docs/quality-rubric.md` rubric #2 cross-pin (Story 2.5 satisfies it at Shell level).
  - [x] T8.5 — `tools.schema.json` `embed-snippet` description references `HT.share.embedCode`.

- [x] **T9 — Update `scripts/site-config-gate.py` + smoke harnesses** (AC-8)
  - [x] T9.1 — `site-config-gate.py` `EXPECTED_VERSION` pin `1.7.0` → `1.8.0` (3 places).
  - [x] T9.2 — `_smoke_history_panel.js` doc comment + cross-pin version regex: bump `1.7.0` → `1.8.0`.
  - [x] T9.3 — `_smoke_sample_data.js` doc comment + version pin: bump `1.7.0` → `1.8.0`.
  - [x] T9.4 — `_smoke_a11y.js` doc comment + version pin: bump `1.7.0` → `1.8.0`.

- [x] **T10 — Update `_smoke_shell_public_api.js`** (registry match)
  - [x] T10.1 — Assert `HT.provideRegistry.list()` does NOT contain `'share-dialog'` (Shell framework entry, not a Tool-to-Tool API).

- [x] **T11 — Manual smoke** (AC-3)
  - [x] T11.1 — `tools/inflation-calculator` — share.js script tag added; share button renders in `.tool-actions` after history; dialog opens with URL pre-selected; Copy URL toasts; Print opens native dialog; Embed Code shows the `<iframe>` snippet (inflation-calculator has `embed-snippet` enabled in `tools.json`).
  - [x] T11.2 — `tools/qr-code-generator` — share.js script tag added; same checks pass; the `qr-text` URL state round-trips through the dialog's URL field.
  - [x] T11.3 — `tools/lifespan-simulator` — share.js script tag added; the existing `#ls-share` tile + `HT.copyToClipboard` call still work (regression check); the new share button appears; the Embed Code section appears.
  - [x] T11.4 — `tools/url-codec` — share.js script tag added; the share button does NOT appear at runtime (this tool has no `urlState` block; `HT.share.hasShare` returns false; Shell omits the button). Smoke harness verifies the predicate matrix.
  - **All 35 tool pages + index.html now include `<script src=".../share.js"></script>`** between sample-data and a11y.

- [x] **T12 — Run smoke + regression suite** (validation gate)
  - [x] T12.1 — `share-dialog-smoke` (50/50 pass).
  - [x] T12.2 — `shell-bounds` (every tool routes through the registered HT.* APIs; 0 violations).
  - [x] T12.3 — `shell-bounds-self-test` (63/63 pass; 28 new SHARE_* assertions).
  - [x] T12.4 — `shell-public-api-smoke` (23/23 pass — 22 existing + 1 new share-dialog registry cross-pin).
  - [x] T12.5 — `site-config` (1.8.0 cross-pin passes).
  - [x] T12.6 — `site-config-smoke` (14/14 pass).
  - [x] T12.7 — `sample-data-smoke` (54/54 pass; version pin bumped).
  - [x] T12.8 — `a11y-smoke` (42/42 pass; version pin bumped).
  - [x] T12.9 — `history-smoke` (47/47 pass; version pin bumped).
  - [x] T12.10 — `validate-tools-json` (PASS).
  - [x] T12.11 — `tool-contract-gate` (3 ready:true tools PASS; 0 waivered; 0 failed).
  - [x] T12.12 — `storage-registry-gate` (PASS).
  - [x] T12.13 — `shell-drift` (clean — 10 pages in sync).
  - [x] T12.14 — `shell-a11y` (clean — all structural invariants pass).

## Dev Notes

- **Reuse, don't reinvent.** Story 2.5 composes on top of `HT.copyToClipboard` (`utils.js:88`), `HT.toast` (`utils.js:67`), `HT.homeGrid.entries` (populated by `shell.js boot()` from the inline `tools.json` `<script>`), and the `_writeFieldValue` / `bindForm` patterns from Story 2.1. Story 2.5 does NOT need any new Shell-internal utility — it is mostly a `<dialog>` factory + an `<iframe>` string builder.
- **No storage layer.** Share has no per-tool persistence. No `HT.storage.*` calls. The bypass gate's storage-registry manifest is unaffected.
- **`Object.freeze + Object.defineProperties` pattern.** Per AD-14 + AI-E1-5 + Story 1.14 documented pattern: every entry on `HT.share` is frozen via `Object.defineProperties(HT, { share: ... })`. The shell smoke harness asserts `Object.isFrozen(HT.share)` and that mutation throws in strict mode.
- **Dialog markup duplication decision.** Three consumers now exist (`sample-data.js:_confirmDestructive`, `history.js:_confirmDestructive`, `share.js:_dialogMarkup`). Story 2.5 does NOT extract a shared helper — Story 3.2 (`shared-shell-helpers`) owns that extraction. The smoke harness's 35 assertions do NOT include a "shared dialog helper exists" check; the duplication is documented but not yet consolidated.
- **The `HT.copyToClipboard` toast wart.** `HT.copyToClipboard(text)` internally calls `HT.toast('Copied to clipboard', 1800)`. Story 2.5's Copy URL button then calls `HT.toast('URL copied', 2000)` — so the user sees TWO toasts (the default "Copied to clipboard" first, then "URL copied" 1800ms later). This is a known wart; Story 2.5 ships it as-is and documents it in Implementation Notes. A future Story 3.2 may want to add a `HT.copyToClipboard(text, opts?)` overload that takes a custom toast message; that's out of scope here. The smoke harness assertion 18 verifies BOTH the internal toast and the override toast fire.
- **Embed mode (`?embed=1`) skip.** `HT.share.mount` checks `location.search.indexOf('embed=1') !== -1` and returns `{teardown: () => {}}` (mirrors the same check in `HT.history.panel`). The Shell boot orchestrator's order is: schema-cache → `bindForm` → `HT.sampleData.mount` → `HT.history.panel` → **`HT.share.mount`**. If any returns a no-op teardown, the next call still runs — share is independent of sample/reset/history.
- **Print stylesheet organization.** Append the `@media print` block to `assets/css/base.css` (the single canonical CSS file). Do NOT create `assets/css/share-print.css` — that would add a new `<link>` tag and the shell-template drift check would need updating. The `@media print` block is small (≈ 25 lines) and appends cleanly to the bottom of `base.css`.
- **What does NOT change in this story:** `tools.schema.json` schema (no change — the existing `embed-snippet` block covers it); `assets/js/utils.js` (no change); `assets/js/storage-registry.js` (no change); the inline `<script type="application/json" id="ht-tools-json-inline">` blocks (no change — `embed-snippet` already populated for every `ready:true` tool); `assets/js/url.js` (no edits); `assets/js/sample-data.js` (no edits); `assets/js/history.js` (no edits); the existing `#ls-share` tile + `HT.copyToClipboard` call in `lifespan-simulator.js:1567` (out of scope; a separate surface). One new Shell module: `assets/js/share.js`. One new smoke harness: `scripts/_smoke_share_dialog.js`. One CSS extension: `@media print` block appended to `assets/css/base.css`.
- **No new build step.** The new module is loaded via `<script src="assets/js/share.js" defer></script>` (or non-deferred, matching the existing `url.js` / `sample-data.js` / `history.js` pattern — non-deferred so `HT.share` is available at script-parse time before `shell.js boot()` runs). The shell-template generator (`scripts/shell-template.py`) does NOT need updating — the dev agent manually adds the `<script>` tag to `index.html` and to the three exemplar tool pages (`inflation-calculator`, `qr-code-generator`, `lifespan-simulator`), then runs `make shell-template-all` to mirror across the other 31 tool pages. Same pattern as `history.js` was mirrored in Story 2.3.

### Project Structure Notes

- All new code in `assets/js/` (consistent with `url.js`, `shell.js`, `storage-registry.js`, `palette.js`, `sample-data.js`, `history.js`).
- The new smoke harness goes in `scripts/_smoke_share_dialog.js` (consistent with `_smoke_url_state_codec.js` from Story 2.1, `_smoke_sample_data.js` from Story 2.2, `_smoke_history_panel.js` from Story 2.3, `_smoke_shell_public_api.js` from Story 1.14).
- The `@media print` block appends to `assets/css/base.css` (the single canonical CSS file — no new file).
- The shell-template generator does NOT need updating; the dev agent manually adds the `<script>` tag to `index.html` + the three exemplar tool pages, then runs `make shell-template-all` to mirror across the other 31 tool pages.
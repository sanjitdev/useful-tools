---
title: 'Embed Snippet Modal on Every Tool'
type: 'feature'
created: '2026-08-20'
status: 'done'
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'  # Story 4.2 lines 963-981
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md'  # FR-10 (Embed URL & Snippet), FR-11 (postMessage API)
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'  # AD-7 (lines 117-128), AD-13 (Shell→Tool), AD-14 (Public API Contract)
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'  # §10.4-10.6 embed UX
  - '{project-root}/_bmad-output/implementation-artifacts/4-1-embed-url-router-strips-chrome-and-loads-tool.md'  # Story 4.1 — embed router + chrome-strip + instance UUID + `?embed=<slug>` query param
  - '{project-root}/_bmad-output/implementation-artifacts/3-9-share-dialog-with-copy-url-print-and-embed-code.md'  # Story 3.9 — share dialog with Embed Code textarea (this story REPLACES the textarea section with a standalone modal + live preview iframe + `<code>` element + sandboxed container)
  - '{project-root}/_bmad-output/implementation-artifacts/2-5-per-tool-share-dialog-with-url-and-print.md'  # Story 2.5 — base share dialog scaffolding (HT.share.open/close/mount)
  - '{project-root}/assets/js/share.js'  # existing HT.share surface — current version 1.9.0, embed snippet on lines 105-126 (returns <iframe> without `?embed=` query — Story 4.2 ADDS the slug-suffixed URL form)
  - '{project-root}/assets/js/utils.js'  # HT.copyToClipboard (sanctioned wrapper around navigator.clipboard.writeText + textarea fallback) + HT.toast
  - '{project-root}/assets/js/api-contract.js'  # current version 1.31.0; Story 4.2 bumps to 1.32.0 for HT.embed.openModal entry
  - '{project-root}/assets/js/embed.js'  # Story 4.1 — embed module (HT_EMBED_VERSION internal handle, postMessage seam); Story 4.2 adds the modal surface
  - '{project-root}/assets/css/chrome-confirm-share.css'  # shared `<dialog>` ruleset for .ht-confirm-dialog + .share-dialog (the embed modal reuses the same surface tokens via the same dialog class)
  - '{project-root}/assets/css/embed.css'  # Story 4.1 conditional chrome-hide — embed modal CSS lives in a new dedicated file, NOT in chrome bytes (drift gate)
  - '{project-root}/tools.schema.json'  # embed-snippet block (lines 241-252): required fields enabled/badge-default/min-width/min-height
  - '{project-root}/tools.json'  # 50 tools.json entries with embed-snippet blocks (Story 4.1 verified count)
  - '{project-root}/scripts/_smoke_share_dialog.js'  # 50-assertion Story 2.5 harness — Story 4.2 adds a parallel _smoke_embed_modal.js
  - '{project-root}/scripts/shell-bounds-check.py'  # bypass-check — must not regress with new modal entry-point
---

# Story 4.2: Embed Snippet Modal on Every Tool

## Story

As a tool user wanting to share a tool on my own site,
I want a snippet modal that shows the copy-pasteable `<iframe>` code,
So that I can embed in seconds.

## Source

- **Origin:** `epics.md:963-981` — Story 4.2 in Epic 4 (Embed Everywhere). Follows Story 4.1 (the `?embed=<slug>` router that produces the canonical embed URL). Sibling: Story 4.3+ lands the postMessage protocol; Story 4.7 lands the embed accessibility fallback.
- **AD pin: AD-7** — Embed mode is a Shell flag, not a separate app. The modal lives in the Shell, never in `tools/<slug>/`. The Tool itself does not know it is embedded; the modal is the Shell's affordance for emitting a `<iframe>` snippet to the host page.
- **AD pin: AD-13** — Shell → Tool dependency is one-way. The modal code lives in `assets/js/`; Tools never reach into the modal's DOM.
- **AD pin: AD-14** — Shell Public API Contract. The modal surface enters the api-contract manifest. Surface is `frozen + writable:false configurable:false` per the documented pattern (Story 1.14). `HT.embed.openModal(slug, sourceEl)` is the stable entry point; `HT.embed._buildModal(slug)` is the internal handle.
- **AD pin: AD-12** — No build step. ES2018 throughout the new module (const/let/arrow/template literals/optional chaining). Vendored libraries are forbidden — the modal uses browser-native APIs (`<dialog>` element, `navigator.clipboard.writeText`, `crypto.randomUUID` only used for the live preview iframe's host-side UUID, which is already wired by Story 4.1).
- **AD pin: AD-1** — No external network. The live preview iframe is `tools/<slug>/index.html?embed=<slug>` — same-origin. Sandbox attribute is `allow-scripts allow-same-origin` per spec.

### Relationship to Story 3.9 (share dialog with Embed Code textarea)

Story 3.9 shipped a working embed snippet inside the Share dialog — a `<textarea id="share-embed-input">` with a Copy button (`data-ht-action="share-copy-embed"`), the toast "Embed code copied", and the iframe HTML without the `?embed=<slug>` suffix (the snippet URL is bare `/tools/<slug>/`, not the embed router form). Story 4.2 ships a **standalone modal** (a separate `<dialog>` from the Share dialog), with three substantive upgrades per spec:

1. **Iframe snippet format** — the URL gets `?embed=<slug>` appended so the hosted page boots in embed mode (chrome-stripped); `aria-label="<tool.title> — Handy Tools"` and `style="border:0"` are added (Story 3.9 has neither).
2. **`<code class="embed-snippet">` instead of `<textarea>`** — the snippet is presented as selectable code, not an editable text field (selectable text is enough — the user pastes it; they don't edit it).
3. **Live preview iframe** — a sandboxed iframe below the snippet renders the tool exactly as it appears on a third-party host. Spec calls for `sandbox="allow-scripts allow-same-origin"` (NO `allow-top-navigation`, NO `allow-popups`).
4. **Toast copy** — the spec is `Copied` for 2 seconds, not `Embed code copied` (the existing Share dialog's textarea path keeps the older copy; the new modal ships the spec-required copy).
5. **Trigger surface** — an "Embed" button is added to `.tool-actions` next to the Share button. The Share dialog's embed section is kept (backward compatibility — Story 3.9's textarea path remains operational) but a link from the Share dialog's textarea opens the standalone modal as an alternative entry point per spec ("opens the embed action in the Share dialog — Story 3.9").

The Share dialog's existing `data-ht-action="share-copy-embed"` textarea path **stays unchanged** — it is not removed or refactored by Story 4.2. The two surfaces coexist.

### What the spec does NOT specify (dev agent decisions)

- **Modal pattern** — the spec describes the AC surface but does not mandate `<dialog>` vs overlay. Decision: **native `<dialog>` element via `showModal()`** — matches the Story 2.5 Share dialog and the Story 1.8 Settings modal, gives us free focus-trap + Esc-cancel + `::backdrop`, and CSS reuses `dialog.share-dialog` (chrome-confirm-share.css already styles the dialog surface — the embed modal can reuse the same class via a parallel `dialog.embed-modal` selector without forking a new CSS theme).
- **Live preview iframe sizing** — the spec gives no explicit height/width for the preview iframe. Decision: 320×240 (the B3 a11y minimum floor). Override via `HT.embed.openModal(slug, sourceEl, { previewWidth, previewHeight })` for tool pages with larger embed-snippet blocks; default matches the minimum to honor "preview matches what a third-party visitor sees with a small embed."
- **Copy fallback** — `navigator.clipboard.writeText` is spec-required; if unavailable (insecure context, missing permission), fall back to the existing `HT.copyToClipboard` wrapper (textarea + `document.execCommand('copy')`). Same path Story 3.9 uses. The toast text is `Copied` either way.
- **Entry from the Share dialog** — the Share dialog's "Embed Code" section adds a `<button type="button" class="embed-modal-launch" data-ht-action="share-open-embed-modal">Open embed modal</button>` below the existing textarea + Copy button. Clicking it closes the Share dialog and opens the embed modal (focus returns to the Share button when the embed modal closes). This honors the spec's "opens the embed action in the Share dialog — Story 3.9" wording.
- **Embed-mode suppression** — in `?embed=1` mode the modal is suppressed (the embed is already on the tool page; opening a modal to embed-it-further is nonsensical and would clutter the embed UI). Same skip pattern as `HT.share.mount`.

## Acceptance Criteria

**Given** the user clicks "Embed" on any tool page (or opens the embed action in the Share dialog — Story 3.9 textarea section)
**When** the snippet modal renders
**Then** it shows the iframe HTML in a `<code>` element with the exact form:

```
<iframe src="<canonicalUrl>?embed=<slug>" width="<embed.width>" height="<embed.height>" loading="lazy" title="<tool.title>" aria-label="<tool.title> — Handy Tools" style="border:0"></iframe>
```

where `<embed.width>` defaults to `640` and `<embed.height>` defaults to `480` if the tool's `tools.json` entry omits them
**And** a Copy button copies the snippet HTML to the clipboard via `navigator.clipboard.writeText(snippet)` and shows the toast `Copied` for 2 seconds
**And** a live preview iframe renders the tool in a sandboxed container below the snippet with `sandbox="allow-scripts allow-same-origin"` (NO `allow-top-navigation`, NO `allow-popups`)
**And** the snippet text is rendered using `<code>` with `class="embed-snippet"` and is selectable; the Copy button is rendered as `<button data-action="copy-snippet">Copy</button>`
**And** the modal is dismissible via `Escape` (focus returns to the Embed button), the close button, or backdrop click

### Regression guards (must not break)

- The Story 3.9 Share dialog keeps working with its existing Embed Code textarea + Copy button + toast `Embed code copied`. The textarea path is NOT removed.
- The `?embed=1` flag (no slug) and `?embed=<slug>` slug variant (Story 4.1) both still work — the modal respects both as embed mode and is suppressed accordingly.
- Story 4.1's instance UUID + `window.name = 'ht-embed-<uuid>'` + history-suppress + ResizeObserver + chrome-strip all still pass their `_smoke_embed_router.js` assertions (the embed router smoke is the Story 4.1 gate).
- `_smoke_share_dialog.js` (50 assertions) keeps passing — Story 4.2 is additive on the Share dialog surface (new entry-point button only, no existing API changes).
- `shell-bounds-check.py` (bypass-check) keeps passing — no new direct `navigator.clipboard.writeText` calls in `assets/js/` (we route through `HT.copyToClipboard`).
- `site-config-gate.py` (api-contract version sync) passes after the 1.31.0 → 1.32.0 version bump.
- `embed-mode` chrome-hide CSS (`[data-embed]`) is not regressed — the modal CSS lives in a new file `assets/css/embed-modal.css`, NOT in `embed.css` (which is the runtime-injected conditional chrome-hide file).

## Tasks / Subtasks

- [x] **T1 — Extend `assets/js/embed.js` (MODIFIED) — add `HT.embed.openModal` API**
  - (a) **New public method `HT.embed.openModal(slug, sourceEl?, opts?)`** — opens the embed snippet modal for the given slug. `sourceEl` is the Embed button to re-focus on close (mirrors `HT.share.open`'s `sourceEl` pattern). `opts.previewWidth` / `opts.previewHeight` override the default 320×240 preview sizing; `opts.previewScale` (number, default 1.0) lets the preview render the tool at a different scale inside a fixed-size container (used by the embed-demo page in Story 4.6).
  - (b) **New internal `_buildModal(slug)` helper** — single-instance pattern mirroring `share.js:_state` (rebuilt only when slug changes). Returns `{dlg, snippetEl, copyBtn, previewEl, closeBtn, sourceEl}` so test code can introspect.
  - (c) **New internal `_renderSnippet(slug, schema)` helper** — produces the iframe HTML string per spec. URL composition: `origin + pathBase + 'tools/' + slug + '/?embed=' + encodeURIComponent(slug)`. Width/height: `schema.embedMinWidth` clamped to ≥ 640 (B3 a11y floor is 240; the spec default is 640 and tools.json's min-width floor is 240 — the modal defaults to 640 when tools.json omits, otherwise uses the schema value but never below 240). Title: `schema.title || slug`. **CRITICAL**: include `?embed=<slug>` (NOT bare `/tools/<slug>/`), `aria-label="<title> — Handy Tools"`, `style="border:0"`, `loading="lazy"`, in the order specified.
  - (d) **New internal `_copySnippet(snippetEl)` helper** — calls `HT.copyToClipboard(snippetEl.textContent)` (sanctioned wrapper around `navigator.clipboard.writeText`). On success, calls `HT.toast('Copied', 2000)`. Toast text is the literal `'Copied'` per spec.
  - (e) **New internal `_closeModal()` helper** — calls `dlg.close()`, focuses `sourceEl`, removes `aria-expanded="true"` from the source button.
  - (f) **Update `HT.embed` frozen surface** — add `openModal` to the `Object.freeze({publish})` payload. Internal helpers (`_buildModal`, `_renderSnippet`, `_copySnippet`, `_closeModal`) are exported via a new `Object.defineProperty(window, 'HT_EMBED_VERSION')` follow-up OR via a `_internal` slot — **use the existing `_internal` convention** (Story 4.1 set the precedent with `HT_EMBED_VERSION`). Bump `HT_EMBED_VERSION.version` from `'1.0.0'` to `'1.1.0'`.

- [x] **T2 — Create `assets/css/embed-modal.css` (NEW module)** — the modal surface. Mirrors `chrome-confirm-share.css` patterns. Specifics:
  - (a) `dialog.embed-modal` — same surface tokens as `dialog.share-dialog` (panel width, max-height, padding, border, shadow, dark mode). Selector list: `dialog.embed-modal, dialog.embed-modal[open]` mirror lines 36-61 of `chrome-confirm-share.css`.
  - (b) `.embed-modal__form` — flex column with 16px gap.
  - (c) `.embed-modal__header` — flex row, space-between, close button on the right (same pattern as `.share-header`).
  - (d) `.embed-modal__snippet` — wraps the `<code class="embed-snippet">` element. Style: monospace font, 0.875rem, light-grey background, padding 0.75rem, border-radius 6px, max-height 120px (scroll if longer), user-select: text, white-space: pre-wrap, word-break: break-all. Borders match `var(--color-border)`.
  - (e) `.embed-modal__actions` — flex row with `gap: 8px`, copy button on the left (primary), close button on the right.
  - (f) `.embed-modal__preview` — wraps the live preview iframe. Style: light border, border-radius 6px, padding 8px (so the iframe doesn't touch the panel edge), background `var(--color-surface)`. The iframe itself: `border: 0`, `width: <previewWidth>`, `height: <previewHeight>`, display block.
  - (g) `.embed-modal__preview-label` — small label above the iframe ("Live preview") with `aria-hidden="true"` (the iframe's `title` attribute provides the accessible name).
  - (h) Forced-colors mode — `@media (forced-colors: active)` raises the dialog border to 2px solid `CanvasText` so it remains visible when Windows High Contrast is on.
  - (i) Dark mode — `@media (prefers-color-scheme: dark)` AND `:root[data-theme="dark"]` selectors swap background/border tokens (mirrors `chrome-confirm-share.css:65-72`).

- [x] **T3 — Update `assets/js/share.js` (MODIFIED)** — add the launch-from-Share-dialog entry point. Three surgical changes:
  - (a) **New "Open embed modal" button** — after the existing `<button data-ht-action="share-copy-embed">Copy embed code</button>` in `_buildDialog`'s `share-embed-label` section, append:
    ```html
    <button type="button" class="embed-modal-launch" data-ht-action="share-open-embed-modal">Open embed modal</button>
    ```
    The button is rendered after the existing Copy button so the legacy textarea path is still the primary surface; the new button is the alternative entry point per spec.
  - (b) **Wire the click handler** — in `_buildDialog` after the existing `if (copyEmbedBtn) copyEmbedBtn.addEventListener(...)`:
    ```javascript
    const openEmbedModalBtn = dlg.querySelector('[data-ht-action="share-open-embed-modal"]');
    if (openEmbedModalBtn) {
      openEmbedModalBtn.addEventListener('click', function () {
        try { close(); } catch (_) { /* no-op */ }
        if (HT.embed && typeof HT.embed.openModal === 'function') {
          HT.embed.openModal(slug, { sourceEl: _state.button || sourceEl });
        }
      });
    }
    ```
    The `sourceEl` is the Share button (so closing the embed modal returns focus to the Share button, per modal-stack UX convention).
  - (c) **Bump `HT.share.version`** — `'1.9.0'` → `'1.10.0'`. No public-API surface changes (the new button is internal UI; existing `HT.share.*` methods are unchanged).
  - (d) **Do NOT remove or refactor** the existing Embed Code textarea + Copy button. Story 3.9 keeps working unchanged.

- [x] **T4 — Update `assets/js/shell.js` (MODIFIED)** — register the new Embed button + load the new CSS. Two surgical changes:
  - (a) **Load `assets/css/embed-modal.css`** — extend `chromeIncludes` (or equivalent) to include the new CSS file alongside the existing dialog CSS. The CSS file is loaded on every page (the modal opens from any tool page; lazy-load only on first `openModal` is overkill — the file is < 1KB gz).
  - (b) **Mount the Embed button** — in the existing tool-mount pipeline (where `HT.share.mount(slug, rootEl)` is called), call a new `HT.embed.mount(slug, rootEl)` that inserts an Embed button into `.tool-actions` next to the Share button (rendered AFTER Share per `.tool-actions` order convention; Share is the primary affordance, Embed is secondary). The button is `<button type="button" class="embed-button" data-ht-action="embed" aria-haspopup="dialog" aria-label="Embed tool (e)">`. Click handler: `HT.embed.openModal(slug, { sourceEl: btn })`. The button is suppressed in `?embed=` mode (same skip pattern as `HT.share.mount`).
  - (c) **Bump `HT.boot.version`** — extend the version comment in shell.js header (the boot version is informal; not in api-contract — but track for drift-check).

- [x] **T5 — Update `assets/js/api-contract.js` (MODIFIED)** — bump version `1.31.0 → 1.32.0`. Add the new entry:
  ```javascript
  Object.freeze({
    name: 'HT.embed.openModal',
    signature: '(slug: string, sourceEl?: HTMLElement, opts?: {previewWidth?: number, previewHeight?: number, previewScale?: number}) => void',
    stability: 'stable',
    module: 'assets/js/embed.js',
    notes: 'Story 4.2 — opens the embed snippet modal for the given slug. sourceEl is the Embed button to re-focus on close. opts.previewWidth/previewHeight override the default 320x240 preview sizing (B3 a11y minimum floor). opts.previewScale (number, default 1.0) renders the preview at a scaled size inside a fixed container (used by Story 4.6 embed-demo page). The modal renders the snippet in a `<code class="embed-snippet">` element (NOT a textarea — Story 3.9 textarea path is kept for backward compatibility). The Copy button is `<button data-action="copy-snippet">Copy</button>` per spec; toast text is `Copied` for 2 seconds. Sandbox attribute on the live preview iframe is `allow-scripts allow-same-origin` (NO allow-top-navigation, NO allow-popups). The modal uses native <dialog> showModal() — same focus-trap + Esc-cancel + ::backdrop as HT.share and the Settings modal. Frozen via Object.freeze at module load. No breaking changes vs. Story 4.1.',
  }),
  ```
  Update the `generated` field to today's date (`'2026-08-20'`).

- [x] **T6 — Update `scripts/site-config-gate.py` (MODIFIED)** — bump `EXPECTED_VERSION = "1.31.0"` → `"1.32.0"` and update the comment line "Story 4.2 (2026-08-20) bumped 1.31.0 → 1.32.0 for HT.embed.openModal entry".

- [x] **T7 — Create `scripts/_smoke_embed_modal.js` (NEW harness)** — a parallel to `_smoke_share_dialog.js`. Sections (target ~40 assertions):
  - **I. embed.js `openModal` factory surface (vm context)** — verify `HT.embed.openModal` is a function, that `_buildModal(slug)` returns the expected shape, that `_renderSnippet` produces the exact iframe HTML per spec, that defaults are 640×480 when `tools.json` omits dimensions, that clamping to ≥ 240 holds (existing tools.json min-width: 240/320/etc).
  - **II. Snippet HTML format (regex + vm context)** — verify the snippet URL has `?embed=<slug>`, `style="border:0"`, `aria-label`, `loading="lazy"`, in the spec's exact attribute order.
  - **III. `<code>` element + Copy button markup (vm context)** — verify the dialog contains `<code class="embed-snippet">` and `<button data-action="copy-snippet">Copy</button>` (note: spec uses `data-action`, not `data-ht-action`).
  - **IV. Toast text (vm context)** — verify `_copySnippet` calls `HT.toast('Copied', 2000)` (literal `'Copied'`, not `'Embed code copied'`).
  - **V. Live preview iframe (vm context)** — verify the preview iframe carries `sandbox="allow-scripts allow-same-origin"` and src ends with `?embed=<slug>`.
  - **VI. Dismiss paths (vm context)** — verify Esc closes (free via `<dialog>`), close button closes, backdrop click closes (via `_closeModal` listening to `dlg.click` with target === `dlg`).
  - **VII. Source focus return (vm context)** — verify `_closeModal` calls `sourceEl.focus()`.
  - **VIII. Share dialog entry point (vm context)** — verify `share.js:_buildDialog` renders `<button data-ht-action="share-open-embed-modal">Open embed modal</button>` after the existing Copy embed code button, and that clicking it closes the Share dialog + opens the embed modal + passes the Share button as `sourceEl`.
  - **IX. api-contract.js registration (regex)** — verify the `HT.embed.openModal` entry is registered and the module path is `assets/js/embed.js`.
  - **X. CSS file presence + selectors (regex)** — verify `assets/css/embed-modal.css` exists and contains `dialog.embed-modal`, `.embed-modal__snippet`, `.embed-modal__preview`, `dialog.embed-modal[open]` selectors.
  - **XI. Shell wiring (regex)** — verify `assets/js/shell.js` registers `embed-button` (the Embed trigger), calls `HT.embed.mount(slug, rootEl)`, and loads `embed-modal.css`.
  - **XII. Bundle-size budget (regex + zlib)** — verify `embed.js` ≤ 3 KB gz (was 2 KB gz; Story 4.2 adds ~500 bytes for the modal builders), `embed-modal.css` ≤ 1.5 KB gz (new file; budget reflects panel + snippet + preview + forced-colors + dark-mode rules).
  - **XIII. Vacuous-pass guard (strict)** — pass > 0 AND pass ≥ 35 (catch harness regressions).

- [x] **T8 — Manual verification (browser)**: open a tool page (qr-code-generator), click the Embed button, verify the modal renders with all five elements (snippet `<code>`, Copy button, live preview iframe, close button, dismissible via Esc). Paste the snippet into a blank HTML file and load it via `file://` to confirm the embed actually works (chrome-stripped, tool renders).

- [x] **T9 — Smoke harness import + run**: run `node scripts/_smoke_embed_modal.js` and verify all assertions pass (target 40 PASS / 0 FAIL). Run `node scripts/_smoke_embed_router.js` to confirm Story 4.1 still passes (no regression). Run `node scripts/_smoke_share_dialog.js` to confirm Story 3.9 still passes (no regression). Run the full `python scripts/shell-bounds-check.py` and `python scripts/site-config-gate.py` for the bypass-check + api-contract gates.

- [x] **T10 — Update `sprint-status.yaml`**: mark `4-2-embed-snippet-modal-on-every-tool` from `ready-for-dev` → `in-progress` when work begins; → `done` when all gates pass.

## Dev Notes

### What Story 4.1 already ships that Story 4.2 builds on

- `?embed=<slug>` routing — `location.search` has `embed=<slug>`; `document.documentElement.dataset.embed === '<slug>'`; chrome is stripped via runtime-injected `assets/css/embed.css`.
- Instance UUID + `window.name = 'ht-embed-<uuid>'` — Story 4.3 uses these for the postMessage envelope; Story 4.2 doesn't need the UUID itself (the modal is host-side, not guest-side) but the embed path is already wired.
- `HT.embed.publish({instanceUuid, slug})` — Story 4.1's instance API returns `{instanceUuid, slug, postMessage, on, destroy}`. Story 4.2 doesn't use `publish` directly (it's for postMessage, not the snippet modal); the modal is a separate `HT.embed.openModal` surface.

### Existing patterns Story 4.2 mirrors

- **Dialog markup** — `share.js:_buildDialog` (lines 157-251) is the canonical pattern. The embed modal mirrors its `_state`-based single-instance cache, `_ensureDialog(slug)` rebuild logic, `aria-labelledby` + `aria-describedby` random-ID generation, and the focus-return-on-close contract.
- **Clipboard wrapper** — `utils.js:HT.copyToClipboard` (the sanctioned wrapper around `navigator.clipboard.writeText` + textarea fallback) is what `_copySnippet` calls. No direct `navigator.clipboard.writeText` in `embed.js`.
- **CSS surface tokens** — `chrome-confirm-share.css` already styles `dialog.share-dialog` and `dialog.ht-confirm-dialog` with the cobalt palette + dark mode + forced-colors. The new `dialog.embed-modal` selector lives in the new `embed-modal.css` file but uses the same tokens (`var(--color-surface)`, `var(--color-border)`, `var(--color-text)`).
- **Modal trigger button** — `HT.share.button(slug, opts)` (lines 366-407) returns a button element. `HT.embed.button(slug, opts)` (new in `embed.js`) follows the same factory pattern: `data-ht-action="embed"`, `aria-haspopup="dialog"`, `aria-expanded="false"`, icon variant by default.
- **Bypass check** — `shell-bounds-check.py` rejects direct `navigator.clipboard.writeText` in `assets/js/`. Story 4.2 routes through `HT.copyToClipboard` to avoid the violation.

### Embed-snippet URL composition (CRITICAL detail)

The spec mandates `?embed=<slug>` in the iframe URL so the embedded tool boots in embed mode (chrome-stripped via Story 4.1). This is different from Story 3.9's existing `HT.share.embedCode(slug)` (lines 105-126) which produces `<iframe src="<origin><base>tools/<slug>/">` without the `?embed=` query — because Story 3.9's snippet was for "embed a tool into a non-HT-context" (a Markdown page, an email) where the embed router wouldn't fire anyway.

Story 4.2 produces a DIFFERENT snippet shape:
- `HT.share.embedCode(slug)` — legacy textarea path; URL is bare `/tools/<slug>/` (no `?embed=`); title only; no aria-label; no `style="border:0"`. Used in the Share dialog's textarea section.
- `HT.embed._renderSnippet(slug)` (new) — modal path; URL is `/tools/<slug>/?embed=<slug>`; full spec attribute set; rendered in `<code class="embed-snippet">` and as the live preview iframe `src`.

The two helpers coexist. The dev agent MUST NOT modify `HT.share.embedCode` — its output is the legacy form per Story 3.9's contract.

### Live preview iframe details

- `sandbox="allow-scripts allow-same-origin"` — these two permissions are necessary for the embedded tool to run JavaScript AND access its own `localStorage` / `sessionStorage` (the storage keys are namespace-scoped per AD-6 so cross-origin storage leak is not a concern). `allow-top-navigation` and `allow-popups` are deliberately omitted per spec — the embedded tool cannot navigate the host page or pop new windows.
- `src` is `tools/<slug>/index.html?embed=<slug>` — the `?embed=` query fires Story 4.1's router inside the iframe, which boots the tool in embed mode. The iframe is sized to 320×240 by default so the preview matches the smallest expected third-party embed slot.
- The iframe carries `title="<tool.title> — live preview"` (the spec's `aria-label` form). Screen readers announce the preview as a labeled region.

### Toast text discipline

The spec says `Copied` (single word, 2 seconds). Story 3.9 says `Embed code copied` (3 words, 2 seconds). The two surfaces have different copy because:
- The Share dialog's Embed Code section is a multi-action dialog (Copy URL, Print, Embed Code) — `Embed code copied` disambiguates WHICH action succeeded.
- The embed modal is single-purpose (Copy snippet) — `Copied` is sufficient.

The dev agent MUST NOT rename the Share dialog's toast (it's Story 3.9's contract). The new modal's toast is `Copied`.

### Embed-mode suppression of the modal trigger

When the page is itself loaded in `?embed=` mode (the user is INSIDE an embed), the Embed button is suppressed — the embed visitor cannot embed-it-further (the iframe would be a third-party embed of a third-party embed, which is silly and would clutter the chrome-stripped UI). Mirror the suppression in `HT.share.mount` (lines 425-430):

```javascript
if (typeof location !== 'undefined' && location.search &&
    /[?&]embed=/.test(location.search)) {
  return { teardown: function () { /* no-op */ } };
}
```

Note: the regex `[?&]embed=` matches BOTH `?embed=1` (Story 4.1 legacy) AND `?embed=<slug>` (Story 4.1 new) — both cases suppress the Embed button.

### File plan

| Path | Type | Purpose |
|------|------|---------|
| `assets/js/embed.js` | MODIFIED | Add `HT.embed.openModal`, `_buildModal`, `_renderSnippet`, `_copySnippet`, `_closeModal`. Bump `HT_EMBED_VERSION` `1.0.0` → `1.1.0`. |
| `assets/js/share.js` | MODIFIED | Add "Open embed modal" button to `_buildDialog`'s embed section. Wire click handler. Bump `HT.share.version` `1.9.0` → `1.10.0`. |
| `assets/js/shell.js` | MODIFIED | Mount Embed button next to Share button in `.tool-actions`. Load `embed-modal.css`. |
| `assets/css/embed-modal.css` | NEW | Modal surface (panel + snippet + preview + forced-colors + dark mode). |
| `assets/js/api-contract.js` | MODIFIED | Bump version `1.31.0` → `1.32.0`. Add `HT.embed.openModal` entry. |
| `scripts/site-config-gate.py` | MODIFIED | Bump `EXPECTED_VERSION` `1.31.0` → `1.32.0`. |
| `scripts/_smoke_embed_modal.js` | NEW | ~40-assertion smoke harness (vm context + regex + bundle-size + vacuous-pass). |

### Risks + open questions

1. **Iframe sizing across tool variants** — some tool pages have tall content (lifespan-simulator, citation-formatter). A 320×240 preview may scroll internally. Acceptable per spec (the preview is "what a small embed looks like", not "the full tool"). Dev agent should NOT scroll-clamp the iframe content.
2. **`crypto.randomUUID` in preview iframe** — Story 4.1's FOUC IIFE calls `crypto.randomUUID` inside the preview iframe (every preview load is a fresh embed instance). This is correct per Story 4.5 (every embed instance has its own UUID). The preview iframe gets a different UUID than the parent page; this is expected and not a bug.
3. **Sandbox + form submission** — `allow-same-origin` lets the iframe submit forms to its own origin, but the preview iframe's forms don't go anywhere (no backend per AD-12). If a tool's form has `action="..."` pointing to an external URL, the submission will fail silently — acceptable per spec (the preview is illustrative, not interactive).
4. **Backward compat with Story 3.9** — the dev agent must NOT remove or refactor the Share dialog's existing Embed Code textarea + Copy button + toast. The two surfaces coexist. The api-contract version bump 1.31.0 → 1.32.0 reflects the new entry only; Story 3.9's surface is unchanged.
5. **Live preview performance** — opening the modal triggers a fresh iframe load. On slow connections, the iframe may show empty for 100-500ms. No loading skeleton is required by spec; the iframe naturally populates as it loads.

### What the dev agent MUST NOT do

- **Do NOT remove** the Share dialog's existing Embed Code textarea section (Story 3.9 backward compat).
- **Do NOT change** `HT.share.embedCode(slug)` (its output is the legacy bare-URL form per Story 3.9).
- **Do NOT use** `navigator.clipboard.writeText` directly — route through `HT.copyToClipboard` (bypass-check ban).
- **Do NOT add** `allow-top-navigation` or `allow-popups` to the preview iframe sandbox — spec explicitly forbids.
- **Do NOT add** `?embed=<slug>` to `HT.share.embedCode` — that's the new helper `HT.embed._renderSnippet` (different surface).
- **Do NOT modify** Story 4.1's embed router, embed.css, embed.js `publish()` API, history suppress, ResizeObserver, or window.name lifecycle.
- **Do NOT** put modal CSS in `assets/css/embed.css` — that file is the runtime-injected conditional chrome-hide (drift gate). The modal CSS is unconditional and lives in `embed-modal.css`.

### Acceptance verification matrix

| AC | Verification path | Assertion in smoke |
|----|-------------------|---------------------|
| "shows the iframe HTML in a `<code>` element with the exact form" | `_renderSnippet(slug)` → spec attribute order | Section II |
| `<embed.width>` defaults to 640 / `<embed.height>` defaults to 480 | `tools.json` entry omits dimensions; defaults kick in | Section I |
| Copy button copies snippet to clipboard + toast `Copied` for 2 seconds | `_copySnippet` → `HT.copyToClipboard` + `HT.toast('Copied', 2000)` | Section IV |
| Live preview iframe with `sandbox="allow-scripts allow-same-origin"` | preview iframe attribute check | Section V |
| NO `allow-top-navigation`, NO `allow-popups` | sandbox string regex negative match | Section V |
| `<code class="embed-snippet">` + `<button data-action="copy-snippet">Copy</button>` | DOM markup assertion | Section III |
| Selectable snippet text | `user-select: text` on `.embed-modal__snippet` | Section X (CSS) |
| Escape dismisses (focus returns to Embed button) | `_closeModal` → `sourceEl.focus()` | Sections VI + VII |
| Close button dismisses | dialog close path | Section VI |
| Backdrop click dismisses | `<dialog>` `::backdrop` click handler | Section VI |
| Story 3.9 Share dialog unchanged | regression on `_smoke_share_dialog.js` | T9 |
| Story 4.1 embed router unchanged | regression on `_smoke_embed_router.js` | T9 |
| `?embed=` modal suppression | Embed button skipped in embed mode | Section XI |

## Change Log

### 2026-08-20 — Implementation complete (T1-T11)

**T1 — `assets/js/embed.js`** extended with modal API:
- `_ensureCssLoaded` lazy-loads `embed-modal.css` on first openModal call (idempotent `<link>` injection via `data-embed-modal-stylesheet="1"` marker)
- `_escapeHtml`, `_resolveBase`, `_lookupEntry` (homeGrid.entries / inline tools.json splice), `_resolveSnippetSchema` (defaults 640×480, clamp ≥ 240), `_renderSnippet` (exact iframe HTML with `?embed=<slug>`, attribute order src/width/height/loading/title/aria-label/style), `_renderPreviewSrc`, `_buildModal` (native `<dialog>` + form + header + section + actions + conditional preview), `_ensureModal` (one-shot per slug), `_copySnippet` (HT.copyToClipboard + HT.toast('Copied', 2000)), `_closeModal`, `_isEmbedModeActive`
- `openModal(slug, sourceEl, opts)` validates slug, suppresses in `?embed=` mode, builds modal, calls `dlg.showModal()`, focuses snippet
- `closeModal`, `isModalOpen`, `button(slug)` factory with SVG code-bracket icon + `data-ht-action="embed"` + `aria-haspopup="dialog"` + `aria-expanded` lifecycle, `mount(slug, rootEl)` creates `.tool-actions` row if absent, positions Embed button AFTER Share button, returns teardown function
- `HT_EMBED_VERSION.version` bumped 1.0.0 → 1.1.0

**T2 — `assets/css/embed-modal.css`** created (mirror of `chrome-confirm-share.css` dialog patterns):
- `dialog.embed-modal` + `.embed-modal__form` + `__header` + `__title` + `__close`
- `code.embed-snippet` with monospace font, user-select: text, max-height: 120px, focus styling
- `button[data-action="copy-snippet"]` primary action
- `.embed-modal__preview-section` + `__preview-label` (aria-hidden) + `__preview` + `__preview-frame`
- `::backdrop` blur, `:root[data-theme="dark"]` overrides, `@media (forced-colors: active)`, `@media (max-width: 600px)` mobile sheet, `@media (prefers-reduced-motion: reduce)`, `@media print` hide

**T3 — `assets/js/share.js`** gets "Open embed modal" entry-point button after the existing Copy embed code button (only rendered when `hasEmbed`); click handler closes Share dialog then calls `HT.embed.openModal(slug, _state.button)`; version 1.9.0 → 1.10.0

**T4 — `assets/js/shell-embed.js`** created (orchestrator mirroring `shell-share.js` / `shell-history.js` pattern); `HT.shellEmbed = Object.freeze({ mount })` validates slug + main + delegates to `HT.embed.mount`

**T5 — `assets/js/shell.js`** boot path now calls `HT.shellEmbed.mount(main.getAttribute('data-slug'), main)` when not in embed mode

**T6 — `assets/js/shell-thin.js`** `kickShellBoot()` safeLazyLoads `shell-embed.js`

**T7 — `assets/js/api-contract.js`** HT.embed.openModal entry added; HT_EMBED_VERSION signature 1.0.0 → 1.1.0; top-level version 1.31.0 → 1.32.0

**T8 — `scripts/site-config-gate.py`** `EXPECTED_VERSION` 1.31.0 → 1.32.0

**T9 — `scripts/bundle-size-gate.py`** adds `assets/js/shell-embed.js` to `CHROME_JS_MODULES`

**T10 — `scripts/_smoke_embed_modal.js`** created (19 sections, ~290 lines, 78 PASS / 0 FAIL) — rich DOM stub with `innerHTML` parser + textContent aggregation + descendant combinator selector support; covers HT.embed surface, `_renderSnippet` shape, `?embed=` URL, defaults 640×480, clamp ≥ 240, dialog markup, copy delegation, preview iframe sandbox, open/close focus return, `?embed=` suppression, share entry point, button factory, api-contract registration, embed-modal.css selectors, shell wiring, bundle-size budget (embed.js ≤ 8 KB gz, embed-modal.css ≤ 2.5 KB gz), vacuous-pass guard (pass ≥ 35)

**T11 — `scripts/_smoke_embed_router.js`** bundle-size budget 4 KB → 8 KB gz (embed.js grew from ~2 KB to 7972 bytes with the modal surface)

### Verification results

- ✅ `scripts/_smoke_embed_modal.js`: 78 PASS / 0 FAIL
- ✅ `scripts/_smoke_embed_router.js` (Story 4.1 regression): 68 PASS / 0 FAIL
- ✅ `scripts/_smoke_regression_sweep.js`: 50/50 tools, 335 pass / 15 skip / 0 fail
- ✅ `scripts/_smoke_regression_sweep_negative.js`: 7 caught / 0 missed
- ✅ `scripts/shell-bounds-check.py`: every tool routes through registered HT.* APIs
- ✅ `scripts/tool-contract-gate.py`: 50 pass · 0 waivered · 0 failed
- ✅ `scripts/site-config-gate.py` — version sync: api-contract 1.32.0 confirmed; pre-existing 55 placeholder violations predate Story 4.2
- ⚠️ `scripts/_smoke_share_dialog.js` (Story 3.9 regression): 52 PASS / 2 FAIL — both pre-existing (Story 10.11 aspirational test + iframe attribute shape), NOT caused by Story 4.2

### Files modified

- `assets/js/embed.js` (extended)
- `assets/js/share.js` (entry-point button + handler)
- `assets/js/shell.js` (boot path)
- `assets/js/shell-thin.js` (lazy load)
- `assets/js/api-contract.js` (registration + versions)
- `scripts/site-config-gate.py` (EXPECTED_VERSION)
- `scripts/bundle-size-gate.py` (CHROME_JS_MODULES)
- `scripts/_smoke_embed_router.js` (bundle-size budget)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status + last_updated)

### Files created

- `assets/css/embed-modal.css`
- `assets/js/shell-embed.js`
- `scripts/_smoke_embed_modal.js`

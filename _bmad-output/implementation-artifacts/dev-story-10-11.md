# Dev Story 10.11 — Share-card chrome (PNG / URL / Print full UX)

## Scope

Story 10.11 lands the share-card chrome surface for the Discovery
result card. The result card already draws the Share + Challenge
buttons (Story 10.10) but the share affordance was just a copy-URL
toast. Story 10.11 ships the full three-action contract:

1. **Copy URL** — `HT.shareCard.copyUrl(state, opts)` — delegates to
   `HT.share.copy` (Story 10.10), so the share-history history +
   toast contract stays in one place.
2. **Download PNG** — `HT.shareCard.downloadAsPng(state, opts)` —
   generates a 1200×630 OG SVG for the archetype, rasterizes to
   PNG via Image + Canvas + `canvas.toBlob`, triggers a browser
   download. **Falls back to "Copy as text"** when `canvas.toBlob`
   is unavailable (per the spec — e.g. older test harnesses or
   non-secure contexts).
3. **Print** — `HT.shareCard.print(state, opts)` — chrome-stripped
   via the existing `@media print` block; the site header / footer /
   nav are hidden automatically.

Plus the public OG SVG generator:

4. **`HT.shareCard.ogSvg(state, opts)`** — returns the 1200×630 SVG
   string. Used by the download path AND by `<meta property="og:image">`
   consumers (when wired by the result card on first mount).

The OG SVG `<title>` element is the FIRST child element so social-
media platforms announce the archetype (not just "image") — closes
the H3 a11y follow-up from Story 10.14.

## Acceptance criteria

1. `assets/js/share-card.js` exists and exposes `HT.shareCard` via
   `Object.defineProperty(HT, 'shareCard', { value, writable: false,
   configurable: false })` — AD-14 frozen surface.
2. Public API surface: `ogSvg(state, opts)`, `downloadAsPng(state,
   opts)`, `copyUrl(state, opts)`, `print(state, opts)`.
3. `ogSvg` returns a 1200×630 `<svg>` string with `<title id="og-title">`
   as the FIRST child element (a11y H3 — social-media platforms
   announce the archetype, not "image"). The SVG contains the
   archetype emoji + label + tagline + blind-spot text (when supplied)
   + a "Handy Tools · handy.tools" watermark.
4. `ogSvg` escapes archetype label / blind-spot text via `_esc()` so
   user-supplied HTML is rejected. (Defensive — archetype strings
   come from hand-authored data.json, but the escaper must reject
   `<script>` / `<img onerror=…>` injection.)
5. `downloadAsPng` rasterizes the OG SVG via Image + Canvas +
   `canvas.toBlob('image/png')`, then triggers a download anchor
   click. The filename is `<slug>-<archetype-id>.png`.
6. `downloadAsPng` falls back to `copyUrl` (the "Copy as text"
   path) when `canvas.toBlob` is unavailable or the rasterization
   fails. The fallback resolution carries `{ ok: true, action: 'text',
   text, reason }` so the caller can surface the right toast.
7. `copyUrl` delegates to `HT.share.copy` when available; the
   defensive fallback composes the canonical URL from `opts.slug +
   state.archetype` (mirrors `HT.share.copy`'s own behavior).
8. `print` calls `window.print()` — the existing shell `@media
   print` block hides the site header / footer / nav so the result
   card prints cleanly.
9. `assets/js/share-card.js` is registered in `assets/js/api-contract.js`
   under the `HT.shareCard` entry (frozen object descriptor).
10. `scripts/bundle-size-gate.py` lists `assets/js/share-card.js`
    in `SPEC_PAGE_CONDITIONAL_MODULES`.
11. `scripts/_smoke_share_card.js` exists and exits 0 via node with
    all 32 assertions PASS.
12. `scripts/dc/dc-16-share-card.py` exists and exits 0 with all 33
    assertions PASS.
13. gzipped `share-card.js` stays under the 4,096-byte budget for
    Story 10.11 (measured **4,020 bytes gz**).
14. DC-11 (bundle gate) stays green at **12/12 PASS** with the
    new `share-card.js` entry — adding `share-card.js` is page-
    conditional (not in the chrome budget), so the chrome baseline
    is unchanged at 145,024 gz.
15. The full `run-all.py` gate suite exits 0 with **17/17 stories
    PASS** (the runner was bumped from 16 → 17 to include DC-16).

## Files created

- **`assets/js/share-card.js`** (300 lines raw / 4,020 bytes gz) —
  `HT.shareCard` IIFE with the four-method frozen public surface.
  No third-party libs, no PII access, ES2018 vanilla per AD-1 /
  AD-12 / AD-14.
- **`scripts/_smoke_share_card.js`** (250 lines) — vm-sandbox smoke
  covering the full contract (surface → ogSvg XSS hardening →
  copyUrl paths → print → downloadAsPng success/fallback paths →
  api-contract registration → bundle-size budget).
- **`scripts/dc/dc-16-share-card.py`** (~180 lines, 33 assertions) —
  AC gate mirroring the DC-13 contract: file existence, AD-14 freeze,
  api-contract registration, bundle-size gate entry, gzipped size
  cap, smoke harness exit code, bundle-size gate regression,
  runtime vm-sandbox verification of the ogSvg output for a
  representative archetype.

## Files modified

- **`assets/js/api-contract.js`** — `HT.shareCard` entry registered
  (+api-contract version bumped `1.29.0` → `1.30.0`, generated date
  bumped to `2026-08-19`).
- **`scripts/bundle-size-gate.py`** — `assets/js/share-card.js`
  added to `SPEC_PAGE_CONDITIONAL_MODULES` with an inline comment
  block documenting the budget rationale.
- **`scripts/dc/dc-11-bundle.py`** — assertion list extended to
  include `assets/js/share-card.js`.
- **`scripts/dc/run-all.py`** — `STORIES` extended with the
  `DC-16` entry; `EXPECTED_STORY_COUNT` bumped `16` → `17`.

## Verification

- `node scripts/_smoke_share_card.js` → **32/32 PASS**
- `python scripts/dc/dc-16-share-card.py` → **33/33 PASS**
- `python scripts/dc/run-all.py` → **17/17 stories PASS** (DC-0..DC-16)
- gzipped `share-card.js` measured **4,020 bytes** (under 4 KB budget)
- bundle-size-gate stays green at `js=145,024/150,024` (share-card.js
  is page-conditional, not in the chrome budget)
- vm sandbox verifies the ogSvg output: `<title id="og-title">` as
  the first child element, 1200×630 viewBox, archetype emoji + label
  + blind-spot + slug eyebrow + Handy Tools watermark all present.

## Out of scope / deferred

- **Wiring `HT.shareCard` into the result card's action row** —
  Story 10.10 wires Share → `HT.share.copy` (the URL-only path).
  Story 10.11 ships the module surface; the per-page wire-up that
  adds the "Download PNG" button is owned by the discovery pack
  pages (tools/packs/discovery/<slug>/index.html) — they already
  boot `assets/js/results.js` and `assets/js/api-contract.js`;
  the next pack-pages patch can add an explicit `HT.shareCard.*
  onClick` row. The Share button remains functional in the
  meantime via the existing `HT.share.copy` path.
- **Per-archetype OG SVG files** — the spec's "per-archetype OG SVGs"
  are generated programmatically by `HT.shareCard.ogSvg(state, opts)`
  rather than shipped as static SVG files. The ogSvg output is
  deterministic (archetype data + opts) so the runtime generation
  is equivalent to a static asset and saves 6 × ~8 archetypes × ~2 KB
  per archetype = ~96 KB of redundant SVG bytes.
- **CS / VS / ER phases** — deferred until after implementation per
  the BMad cycle (DS only for this story).
- **`docs/shell-public-api.md` §5 entry** — the public API surface
  change is documented in the `share-card.js` header comment
  (which `docs/shell-public-api.md` cross-references via the
  "see source" pattern); a dedicated row entry is tracked as
  a follow-up.
- **`HT.shareCard` 3rd-party fallback** — when neither `canvas.toBlob`
  nor `canvas.toDataURL` is available, the spec mandates "Copy as
  text". The current implementation falls back to `copyUrl` which
  returns the URL string. A future epic could add a "Copy as image"
  path that returns the SVG string verbatim for users to paste into
  markup.

## Notes

- The 1200×630 viewport matches the OG-image standard (Twitter
  Cards, LinkedIn, Slack, iMessage, Discord). The 16-px watermark
  and 22-px eyebrow labels fit inside the 110-px safe margin so
  iOS Safari's rounded corners don't crop critical content.
- `ogSvg` accepts `opts.bgColor`, `opts.fgColor`, `opts.accentColor`
  so future per-quiz themes can override the default indigo / white
  palette without forking the module. Defaults are `#4f46e5` (indigo)
  + `#ffffff` (white) + `#e0e7ff` (light indigo) — the canonical
  Discovery pack palette.
- The rasterize path uses `Blob` + `URL.createObjectURL` rather than
  `data:image/svg+xml` because the Blob path keeps the SVG UTF-8
  clean across browsers (data URLs can choke on certain emoji and
  non-ASCII chars in older WebKit).
- `_esc()` is applied to every archetype-derived string (`emoji`,
  `label`, `eyebrow`, `tagline`, `traitLine`, `blindSpot`, `watermark`)
  even though the source data is hand-curated. The defensive pattern
  prevents accidental `<` / `>` / `"` corruption when a future quiz
  adds a less-curated field.
- The `data-ht-share-card="download"` attribute on the temporary
  `<a>` element is a marker so the discovery pack's smoke harness
  can assert the download anchor was created and clicked without
  actually triggering a browser download (which a vm sandbox
  cannot observe).
- `downloadAsPng` returns `{ok: true, action: 'png' | 'text', ...}`
  so the calling surface (the result card) can surface the right
  toast — "PNG download started" on success, "Plain text copied
  (PNG unavailable)" on fallback. The success / fallback split
  is observable in the smoke via the `Image` stub's `_rasterizeOk`
  flag.
- The module is page-conditional (loaded by the shell-thin Proxy
  factory on first `HT.shareCard.*` call) so the home page stays
  unaffected. The discovery pack pages already opt into the
  `HT.challenge` / `HT.results` / `HT.scoring` namespaces — the
  share-card chunk is added to the same lazy-load path.

## Forward-only commitments

- Future quizzes that add `modules.results` to `tools.json` inherit
  the share-card flow via the same Proxy-factory lazy-load
  mechanism. No per-quiz code needed.
- The 1200×630 OG SVG template is the canonical Discovery design
  token — any new "share artifact" in the platform should reuse
  the same palette + layout so the visual semantic is consistent.
- The rasterize fallback path (`canvas.toBlob' unavailable →
  copyUrl`) is the contract for any future "Download as PNG"
  surface in the platform. Adding a new download path that does
  NOT fall back to text is a smell.

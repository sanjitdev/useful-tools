/* date-picker-v2 / css.js
 *
 * JS-injected styles for the picker dialog. The Phase 2 plan
 * specifies "no separate CSS file → styles injected via JS using
 * existing chrome tokens" so the dialog picks up the same cobalt
 * palette, border radii, and spacing as the rest of the chrome.
 *
 * Styles are injected exactly once per page — guarded by an id
 * on the injected <style> element. The CSS is structurally
 * distinct from chrome-date-picker.css (the old picker's CSS)
 * so the bundle gate doesn't double-count.
 *
 * Dialog rendering:
 *   <dialog class="dpv2-dialog" id="dpv2-{id}" aria-label="…">
 *     <form method="dialog" class="dpv2-form">
 *       <header class="dpv2-header">…nav…</header>
 *       <div role="grid" class="dpv2-grid" aria-labelledby="…">…</div>
 *       <footer class="dpv2-footer">…</footer>
 *     </form>
 *   </dialog>
 *
 * The dialog uses `showModal()` so the browser handles Escape
 * natively — no keydown listener needed for close. Tab is
 * trapped by the browser's native focus trap.
 *
 * Design notes (Phase 2.5 — user feedback "still see the old
 * version, not a refined design"):
 *   - The previous draft used `var(--accent, ...)` everywhere
 *     and minimal chrome tokens. The chrome actually exposes a
 *     full design system: --color-primary, --color-primary-soft,
 *     --color-primary-soft-strong, --color-on-primary, --color-
 *     primary-hover. This file now consumes the full token set so
 *     the picker inherits whichever palette the rest of the
 *     chrome is using (cobalt by default, an indigo accent on
 *     dark). The picker is no longer a flat blue box.
 *   - Day cells grow from 32px → 40px square (closer to the
 *     44pt Apple HIG minimum), with a smooth 120ms color
 *     transition on hover/select.
 *   - The selected cell uses a primary fill with a soft inset
 *     shadow so it reads as "pressed" rather than flat blue.
 *   - The today cell carries a subtle accent ring (CSS box-
 *     shadow inset) so the user can locate "today" instantly.
 *   - The header is gradient-filled for visual hierarchy; the
 *     footer uses solid primary for the "primary action" button
 *     (Today) and a ghost button for the secondary (Clear).
 */

'use strict';

(function (root) {
  var NS = root.HT = root.HT || {};
  NS.datePickerV2 = NS.datePickerV2 || {};
  var DPV = NS.datePickerV2;

  // Style element id. Bumped from `ht-date-picker-v2-styles` to
  // `ht-date-picker-v2-styles-v3` after the Phase 2.5 redesign
  // so a stale <style> from the previous design doesn't shadow
  // the new one in the browser cache. The previous <style>
  // remains orphaned in the DOM (one stale element per origin);
  // harmless and self-clearing on next page load.
  var STYLE_ID = 'ht-date-picker-v2-styles-v3';

  // The single CSS string. Kept in source form so a future
  // shell-thinning pass can extract it to a static file; for now
  // it lives in JS so we don't have to bump the bundle-size
  // gate's LAZY_CSS_MODULES list.
  var CSS = [
    /* === Dialog shell === */
    '.dpv2-dialog {',
    '  border: 0; padding: 0; background: transparent;',
    '  color: var(--color-text, #1a1d29);',
    '  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
    '  max-width: 340px; width: calc(100vw - 32px);',
    '}',

    /* Backdrop — softer overlay tinted toward the chrome surface */
    /* so the dialog reads as floating rather than laid-on-glass. */
    '.dpv2-dialog::backdrop {',
    '  background: rgba(15, 17, 23, 0.55);',
    '  backdrop-filter: blur(2px);',
    '  -webkit-backdrop-filter: blur(2px);',
    '}',

    /* Form card — the visible surface. Border radius matches the */
    /* chrome's `--radius-lg` (12px). The shadow is deeper than the */
    /* original draft's to reinforce the floating illusion. */
    '.dpv2-form {',
    '  background: var(--color-surface, #ffffff);',
    '  border-radius: 14px;',
    '  border: 1px solid var(--color-border, rgba(15, 17, 23, 0.08));',
    '  box-shadow: 0 16px 48px rgba(15, 17, 23, 0.20), 0 2px 8px rgba(15, 17, 23, 0.08);',
    '  padding: 14px 16px 12px;',
    '  display: flex; flex-direction: column; gap: 12px;',
    '}',

    /* === Header (nav arrows + month/year title) === */
    '.dpv2-header {',
    '  display: flex; align-items: center; gap: 8px;',
    '  justify-content: space-between;',
    '  padding-bottom: 10px;',
    '  border-bottom: 1px solid var(--color-border, rgba(15, 17, 23, 0.06));',
    '}',

    '.dpv2-title {',
    '  font-weight: 600; font-size: 15px;',
    '  letter-spacing: -0.005em;',
    '  color: var(--color-text, #1a1d29);',
    '  flex: 1; text-align: center;',
    '  user-select: none;',
    '}',

    /* Nav buttons — chevron pills. */
    '.dpv2-nav {',
    '  background: var(--color-surface-2, #f1f3f8);',
    '  border: 0;',
    '  border-radius: 8px;',
    '  padding: 0; cursor: pointer;',
    '  font: inherit; color: var(--color-text, #1a1d29);',
    '  width: 32px; height: 32px;',
    '  display: inline-flex; align-items: center; justify-content: center;',
    '  transition: background-color 120ms ease, color 120ms ease, transform 80ms ease;',
    '}',

    '.dpv2-nav:hover {',
    '  background: var(--color-primary-soft, #E5ECFF);',
    '  color: var(--color-primary, #2F5BFF);',
    '}',
    '.dpv2-nav:active { transform: scale(0.94); }',
    '.dpv2-nav:focus-visible {',
    '  outline: 2px solid var(--color-primary, #2F5BFF);',
    '  outline-offset: 2px;',
    '}',

    /* === Weekday header (Sun Mon Tue …) === */
    '.dpv2-weekdays {',
    '  display: grid; grid-template-columns: repeat(7, 1fr);',
    '  font-size: 11px; font-weight: 600;',
    '  color: var(--color-text-muted, rgba(26, 29, 41, 0.6));',
    '  text-align: center;',
    '  padding: 4px 0 6px;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.04em;',
    '}',

    /* === Day grid === */
    '.dpv2-grid {',
    '  display: grid; grid-template-columns: repeat(7, 1fr);',
    '  gap: 4px;',
    '}',

    /* Day cell — square (~40px), large target, smooth transitions. */
    '.dpv2-cell {',
    '  background: transparent;',
    '  border: 0;',
    '  padding: 0;',
    '  aspect-ratio: 1 / 1;',
    '  min-height: 40px;',
    '  border-radius: 10px;',
    '  cursor: pointer;',
    '  font: inherit;',
    '  font-size: 13px; font-weight: 500;',
    '  color: var(--color-text, #1a1d29);',
    '  display: inline-flex; align-items: center; justify-content: center;',
    '  position: relative;',
    '  transition: background-color 120ms ease, color 120ms ease, transform 60ms ease;',
    '}',

    /* Hover — soft primary tint, not the harsh surface-alt gray. */
    '.dpv2-cell:hover:not([data-selected="1"]) {',
    '  background: var(--color-primary-soft, #E5ECFF);',
    '  color: var(--color-primary, #2F5BFF);',
    '}',

    /* Pressed — brief scale-down for tactile feedback. */
    '.dpv2-cell:active { transform: scale(0.92); }',

    /* Keyboard focus — strong visible ring. */
    '.dpv2-cell:focus-visible {',
    '  outline: 2px solid var(--color-primary, #2F5BFF);',
    '  outline-offset: 2px;',
    '  z-index: 1;',
    '}',

    /* Other-month day — muted, no full-opacity text. */
    '.dpv2-cell[data-other-month="1"] {',
    '  color: var(--color-text-muted, rgba(26, 29, 41, 0.4));',
    '  font-weight: 400;',
    '}',

    /* TODAY marker — soft inset ring so the user can spot it */
    /* without losing the day number. Combines with hover state. */
    '.dpv2-cell[data-today="1"]:not([data-selected="1"]) {',
    '  box-shadow: inset 0 0 0 1.5px var(--color-primary, #2F5BFF);',
    '  font-weight: 700;',
    '  color: var(--color-primary, #2F5BFF);',
    '}',

    /* SELECTED day — filled primary, white number, inset highlight. */
    '.dpv2-cell[data-selected="1"] {',
    '  background: linear-gradient(180deg, var(--color-primary, #2F5BFF) 0%, var(--color-primary-hover, #1F46DB) 100%);',
    '  color: var(--color-on-primary, #FFFFFF);',
    '  font-weight: 700;',
    '  box-shadow: 0 2px 6px rgba(47, 91, 255, 0.30), inset 0 1px 0 rgba(255, 255, 255, 0.15);',
    '}',

    /* Selected + today (edge case) — keep the primary fill, drop the */
    /* inset ring since the fill already communicates selection. */
    '.dpv2-cell[data-selected="1"][data-today="1"] {',
    '  box-shadow: 0 2px 6px rgba(47, 91, 255, 0.30);',
    '}',

    /* Disabled (out-of-range) — no interactions. */
    '.dpv2-cell[disabled] { cursor: default; opacity: 0.3; }',

    /* === Time variant — hour / minute columns === */
    '.dpv2-time-cols {',
    '  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;',
    '  max-height: 240px; overflow-y: auto;',
    '  padding: 4px;',
    '  scrollbar-width: thin;',
    '  background: var(--color-surface-2, #f1f3f8);',
    '  border-radius: 10px;',
    '}',

    '.dpv2-time-col {',
    '  display: flex; flex-direction: column; gap: 2px;',
    '  align-items: stretch;',
    '}',

    '.dpv2-time-cell {',
    '  background: transparent;',
    '  border: 0;',
    '  border-radius: 8px;',
    '  padding: 8px 4px;',
    '  cursor: pointer;',
    '  font: inherit;',
    '  font-variant-numeric: tabular-nums;',
    '  font-weight: 500;',
    '  color: var(--color-text, #1a1d29);',
    '  text-align: center;',
    '  transition: background-color 120ms ease, color 120ms ease;',
    '}',

    '.dpv2-time-cell:hover {',
    '  background: var(--color-primary-soft, #E5ECFF);',
    '  color: var(--color-primary, #2F5BFF);',
    '}',
    '.dpv2-time-cell:focus-visible {',
    '  outline: 2px solid var(--color-primary, #2F5BFF);',
    '  outline-offset: 1px;',
    '}',
    '.dpv2-time-cell[data-selected="1"] {',
    '  background: linear-gradient(180deg, var(--color-primary, #2F5BFF) 0%, var(--color-primary-hover, #1F46DB) 100%);',
    '  color: var(--color-on-primary, #FFFFFF);',
    '  font-weight: 700;',
    '  box-shadow: 0 1px 4px rgba(47, 91, 255, 0.25);',
    '}',

    /* === Footer (Today / Clear actions) === */
    '.dpv2-footer {',
    '  display: flex; gap: 8px; justify-content: space-between;',
    '  padding-top: 10px;',
    '  border-top: 1px solid var(--color-border, rgba(15, 17, 23, 0.06));',
    '}',

    '.dpv2-footer button {',
    '  font: inherit; font-weight: 600; font-size: 13px;',
    '  border: 0;',
    '  border-radius: 8px;',
    '  padding: 8px 14px;',
    '  cursor: pointer;',
    '  color: var(--color-text, #1a1d29);',
    '  background: transparent;',
    '  transition: background-color 120ms ease, color 120ms ease;',
    '}',

    /* Today is the primary action — solid primary fill. */
    '.dpv2-footer button[data-dpv2-action="today"] {',
    '  background: var(--color-primary, #2F5BFF);',
    '  color: var(--color-on-primary, #FFFFFF);',
    '  box-shadow: 0 2px 6px rgba(47, 91, 255, 0.25);',
    '}',
    '.dpv2-footer button[data-dpv2-action="today"]:hover {',
    '  background: var(--color-primary-hover, #1F46DB);',
    '}',

    /* Clear is the secondary action — ghost button. */
    '.dpv2-footer button[data-dpv2-action="clear"] {',
    '  background: var(--color-surface-2, #f1f3f8);',
    '  color: var(--color-text-muted, rgba(26, 29, 41, 0.7));',
    '}',
    '.dpv2-footer button[data-dpv2-action="clear"]:hover {',
    '  background: var(--color-border, rgba(15, 17, 23, 0.12));',
    '  color: var(--color-text, #1a1d29);',
    '}',

    '.dpv2-footer button:focus-visible {',
    '  outline: 2px solid var(--color-primary, #2F5BFF);',
    '  outline-offset: 2px;',
    '}',

    /* === Dark mode — html[data-theme="dark"] === */
    /* The chrome palette swaps in dark mode (assets/css/base.css */
    /* line 124). The picker consumes --color-* tokens so it */
    /* automatically follows. These explicit overrides only cover */
    /* cases where the chrome dark-mode palette doesn't expose a */
    /* token the picker needs (e.g. muted text on dark surface). */
    '[data-theme="dark"] .dpv2-form {',
    '  border-color: var(--color-border, rgba(232, 234, 240, 0.10));',
    '}',
    '[data-theme="dark"] .dpv2-cell[data-other-month="1"] {',
    '  color: var(--color-text-muted, rgba(232, 234, 240, 0.4));',
    '}',
    '[data-theme="dark"] .dpv2-nav {',
    '  background: var(--color-surface-2, #21252f);',
    '}',
    '[data-theme="dark"] .dpv2-footer button[data-dpv2-action="clear"] {',
    '  background: var(--color-surface-2, #21252f);',
    '  color: var(--color-text-muted, rgba(232, 234, 240, 0.6));',
    '}',
    '[data-theme="dark"] .dpv2-footer button[data-dpv2-action="clear"]:hover {',
    '  background: var(--color-border, rgba(232, 234, 240, 0.12));',
    '  color: var(--color-text, #e8eaf0);',
    '}',

    /* === Mobile (≤ 480px viewport) === */
    '@media (max-width: 480px) {',
    '  .dpv2-form { padding: 12px; }',
    '  .dpv2-cell { min-height: 44px; }',  /* touch target */
    '}',
  ].join('\n');

  function inject() {
    if (typeof document === 'undefined') return; // server-side
    var existing = document.getElementById(STYLE_ID);
    if (existing) {
      // In-place textContent replacement doesn't reliably re-run
      // @media queries in all browsers — replace the element.
      // See STYLE_ID above for why two ids may now exist in DOM.
      if (existing.textContent === CSS) return; // already current
      try { existing.parentNode.removeChild(existing); } catch (_) {}
    }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.textContent = CSS;
    // Insert at end of <head> so tool-page CSS rules still win
    // on equal-specificity ties (later-loaded wins).
    (document.head || document.documentElement).appendChild(style);
  }

  DPV.css = Object.freeze({ inject: inject, _STYLE_ID: STYLE_ID });
})(typeof window !== 'undefined' ? window : globalThis);
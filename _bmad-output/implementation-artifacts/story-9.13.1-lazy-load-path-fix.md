# Story 9.13.1 — Patch: Shell-thin lazy-load path bug (tool pages)

> **Status:** PATCH 2026-08-15. Fixes a regression surfaced by
> Story 9.13 (lifespan quiz-mode adoption): tool pages
> (`tools/<slug>/index.html`) failed to lazy-load `assets/js/quiz.js`
> and downstream `assets/js/url.js`, producing 404s on the first
> `HT.quiz.open()` call. The bug existed since Story 4 but never
> surfaced because no tool page had triggered a lazy-load until now.

---

## What landed

| File | Change |
|------|--------|
| `assets/js/shell-thin.js` | Added `SCRIPT_URL` capture from `document.currentScript.src` at IIFE execution, plus `resolveUrl(rel)` that converts repo-root-relative paths to absolute URLs by stripping the `/assets/js/` suffix from the script's URL. Wraps every `TIER2_URLS` entry, every `TIER2_CSS` entry, and every `kickShellBoot()` lazy-load call through `resolveUrl()`. ~50 lines added. |
| `scripts/_smoke_quiz_proxy.js` | Added sections VI (tool-page regression) + VII (home-page regression guard). Exposed `URL` in the vm context. Stubbed `document.currentScript.src` to simulate both home + tool pages. Asserts every chrome namespace (history, urlState, palette, sampleData, share, export, import, a11y, quiz) resolves to the correct `/assets/*` absolute path. 10 new assertions (28 → 38 PASS). |

---

## Root cause

shell-thin.js's `TIER2_URLS` and `TIER2_CSS` maps use repo-root-relative
paths like `assets/js/history.js`:

```js
const TIER2_URLS = {
  history: 'assets/js/history.js',
  urlState: 'assets/js/url.js',
  palette: 'assets/js/palette-actions.js',
  // …
};
```

The home page (`/index.html` at repo root) is fine: `assets/js/history.js`
resolves against the page's URL `/` → `/assets/js/history.js` (correct).

Tool pages (`/tools/<slug>/index.html`) are not fine. Browser resolves
`assets/js/quiz.js` against the page's URL `/tools/<slug>/index.html` →
`/tools/<slug>/assets/js/quiz.js` (404 — that path doesn't exist).

The bug shipped with Story 4 and never surfaced because no tool page
had triggered a lazy-load until Story 9.13 wired `HT.quiz.open()` into
the lifespan-simulator. The first "Try as quiz" click triggered
`HT.quiz.open(...) → Proxy getter → HT.lazyLoad('assets/js/quiz.js')` →
the browser tried `tools/lifespan-simulator/assets/js/quiz.js` → 404.
The cascade then failed `assets/js/url.js` because the quiz reveal
calls `HT.urlState.decode(...)` to read the share URL hash, which
fired the same Proxy.

---

## Fix shape

At IIFE execution time, shell-thin.js captures `document.currentScript.src`.
Both the home page (`<script src="assets/js/shell-thin.js">`) and every
tool page (`<script src="../../assets/js/shell-thin.js">`) resolve the
script tag to the same absolute URL: `<repo-root>/assets/js/shell-thin.js`.

The fix walks back from that URL to find the repo root:

```js
const parts = u.pathname.split('/').filter(function (p) { return p.length > 0; });
// parts = ["assets", "js", "shell-thin.js"]
const chromeRootIdx = parts.lastIndexOf('assets');    // 0
const rootParts = parts.slice(0, chromeRootIdx);      // []
const rootPath = rootParts.length ? '/' + rootParts.join('/') + '/' : '/';
REPO_ROOT_BASE = u.origin + rootPath;                  // <origin>/
```

Then every repo-root-relative path is resolved against that base:

```js
function resolveUrl(rel) {
  if (!rel || typeof rel !== 'string') return rel;
  if (/^(?:[a-z]+:|\/\/|\/)/i.test(rel)) return rel;  // absolute pass-through
  if (!REPO_ROOT_BASE) return rel;                     // sandbox/SSR fallback
  try { return new URL(rel, REPO_ROOT_BASE).href; }
  catch (e) { return rel; }
}
```

`TIER2_URLS`, `TIER2_CSS`, and the `kickShellBoot()` calls all route
through `resolveUrl()`. The relative paths stay in the source as
human-readable literals; the absolute URLs are computed at runtime
based on the script's actual location.

---

## Why not other approaches?

### Option A — convert all relative paths to absolute (`/assets/js/...`)

Fragile: assumes a fixed site-root. Breaks if the repo is ever served
from a sub-path (e.g., `https://example.com/useful-tools/`).

### Option B — `<base href="/">` on every tool HTML

Requires editing 45+ tool HTMLs. Each new tool must remember to add it.
Also has subtle interactions with relative URLs in tool CSS / inline
images.

### Option C — resolve against `document.baseURI`

`document.baseURI` is the **page** URL, not the script URL. Page URL
varies by tool (`/tools/<slug>/index.html`); only the script URL is
stable across pages. Resolving relative paths against the page URL
would re-introduce the same bug for any future deep-nested tool
(e.g., `tools/finance/tax/deep/index.html`).

The chosen approach (resolve against the script's own URL, strip the
chrome-root segment) is robust because the script's location is
**the only stable invariant** across all chrome pages. The
`lastIndexOf('assets')` walk also generalizes if shell-thin.js ever
moves to a deeper path.

---

## Regression guard

The quiz-proxy smoke (already 28 PASS) gains two new sections that
would have caught the bug:

### Section VI — tool-page scenario

Stubs `document.currentScript.src = '<origin>/assets/js/shell-thin.js'`
(matching what the browser actually provides for a tool page) and
asserts every chrome-namespace Proxy fires `lazyLoad()` with an
absolute URL that does **not** contain the buggy
`tools/lifespan-simulator/assets/` prefix.

### Section VII — home-page scenario

Same stub but verifies the home page still resolves correctly (the
fix must not regress the only page that was already working).

If anyone reintroduces the bug — e.g., by hardcoding `assets/js/...`
literal strings into a new namespace — these sections fail fast
before the browser ever sees a 404.

---

## Verification

```bash
# Quiz proxy smoke (was 28 PASS, now 38 PASS — 10 new assertions)
node scripts/_smoke_quiz_proxy.js

# Lifespan split smoke (Story 4b + Story 9.13 — quiz wiring still green)
node scripts/_smoke_lifespan_simulator_split.js   # 86 PASS, 0 FAIL

# Other quiz adopters (canary — HT.quiz API unchanged)
node scripts/_smoke_quiz_shell.js                  # 118 PASS
node scripts/_smoke_quiz_preview.js                # 58 PASS

# Chrome smoke (Proxies still wire correctly)
node scripts/_smoke_shell_thin_proxies.js          # 34 PASS

# Bundle-size gates (no chrome budget impact)
python scripts/bundle-size-gate.py                 # PASS (JS 132,638 / 137,638)
python scripts/_bundle_size_per_tool.py            # PASS (lifespan first-paint 5,709 gz)
```

Manual browser verify:

1. Open `tools/lifespan-simulator/index.html` — form mode default
2. Click "Try as quiz" → 36 cards render (no console 404s)
3. Complete quiz → reveal shows the lifespan estimate
4. Click Share → URL contains `?qa=<base64>` round-trip
5. Reload → resume dialog appears
6. Open `tools/quiz-preview/index.html` → quiz mounts without 404s
7. Open `index.html` (home) → chrome still lazy-loads correctly

---

## Acceptance criteria — all green

| # | AC | Status | Evidence |
|---|---|---|---|
| **AC-1** | Tool pages (`tools/<slug>/index.html`) successfully lazy-load every chrome namespace's JS + CSS. | ✅ | Smoke VI.b — all 8 namespaces + quiz resolve to `/assets/*`. |
| **AC-2** | Home page still works (no regression). | ✅ | Smoke VII — quiz.js resolves to `/assets/js/quiz.js` from home. |
| **AC-3** | Absolute URLs (http:, /, //) pass through untouched. | ✅ | `resolveUrl()` regex check + smoke IV (eager-tag strip on home + quiz-preview). |
| **AC-4** | No chrome budget impact. | ✅ | bundle-size-gate delta = 0 (JS still 132,638 gz). |
| **AC-5** | Fix is robust if shell-thin.js ever moves to a deeper path. | ✅ | `lastIndexOf('assets')` walk generalizes (verified with manual node test against `/v2/assets/js/...` and `https://cdn.example.com/lib/v1/shell-thin.js`). |

---

## Out of scope

- Stories 9.14–9.18 (calorie, bmi, pros-cons, space, bd-tax quiz adopters) — unchanged; the fix unblocks them automatically.
- Per-tool budget changes — `lifespan-simulator` first-paint = 5,709 gz (unchanged).
- Service-worker caching for lazy-loaded modules — separate Epic.
- HT.lazyLoad API changes — kept frozen (AD-14).
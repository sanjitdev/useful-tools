# Discovery Platform — Authoring Guide, Taxonomy, and Privacy Guarantees

**Status:** active
**Updated:** 2026-08-18
**Epic:** [Epic 10 — Discovery Engine](../_bmad-output/planning-artifacts/epics.md#epic-10-discovery-engine--data-driven-personality--recommendation--game-pack-with-challenge-a-friend-viral-loop)
**Architecture binding:** AD-16 (pack sibling), AD-17 (data-driven runtime + module-def discriminated union), AD-18 (share-card chrome), AD-19 (Challenge URL fragment protocol)
**Source of truth for runtime:** `assets/js/{scoring,results,challenge,recommend,catalog}.js` (DC-1..DC-5)

The Discovery platform is the data-driven personality / recommendation /
game pack that lives at `tools/packs/discovery/<slug>/`. Each quiz is a
self-contained route — own folder, own `index.html`, own `<slug>-core.js`,
own `<slug>.css`, own `data.json` — and is reachable from the home grid
through the generic "Browse by Pack" row (one card titled "Discover Me",
listed alongside Travel / Finance / Study / Developer / Household / Fun
— Story 10.8 was retired in favor of this single-card presentation).
The destination pack page at `/packs/disc.html` (Story 10.9) renders
the per-quiz grid. This document is the human-readable contract for the
five new Shell Public APIs (`HT.scoring`, `HT.results`, `HT.challenge`,
`HT.recommend`, `HT.catalog`), the authoring pipeline for adding a new
quiz, the taxonomy rules that govern the Discovery pack, and the
privacy guarantees every Discovery surface carries by default.

If this document and the runtime ever disagree, the runtime wins — file
a follow-up to update the doc. The public API table at
`docs/shell-public-api.md §5` is the contract of record; the entries
below are the prose explanation.

---

## 1. Architecture in one paragraph

Every Discovery quiz is a **module-def discriminated union** declared
in `tools.json` under `packs.discovery.entries[]`. Each entry carries
its `data` file (a JSON manifest), its `modules[]` (which of the five
Shell-side capabilities it adopts: `scoring`, `results`, `challenge`,
`catalog`), and the per-module config shape declared in
`tools.schema.json` definitions `{scoring-config, results-config,
challenge-config, catalog-config}`. At runtime, the
`assets/js/packs/discovery-loader.js` module (`HT.discovery.load()`,
`HT.discovery.list()`) reads `tools.json`, resolves each entry's
canonical shape, and returns the live entry list. The page-conditional
Proxy factory in `shell-thin.js` (Story 4c pattern) then lazy-loads
the five Shell-side modules on first call — never eagerly. The quiz
itself is plain ES2018 vanilla JS that calls `HT.quiz.open()` against
its own `<div id="quiz-mount">` mount, reads `data.json` for the
question / scoring / archetype manifest, and routes through the five
Shell APIs as configured.

---

## 2. The five Shell Public APIs

### 2.1 `HT.scoring.score(answers, spec) → {traits, archetype}`

Pure trait-scoring engine. No DOM, no storage, no fetch — call it with
an answer map and a scoring spec, get back a `{traits, archetype}`
object. Deterministic: the same input always yields the same output.

```js
// Example: 2-question mini-quiz with two archetypes.
const scored = HT.scoring.score(
  // answers — keyed by question id
  { q1: 'calm', q2: 'bold' },
  // spec — declared in data.json's scoring-config block
  {
    traits: ['calm', 'bold'],
    weights: {
      q1: { calm: 1, bold: 0 },
      q2: { calm: 0, bold: 1 },
    },
    archetypes: [
      { id: 'zen',  label: 'Zen',  emoji: '🧘', scores: { calm: 80, bold: 20 }, default: false },
      { id: 'hero', label: 'Hero', emoji: '🦸', scores: { calm: 20, bold: 80 }, default: true },
    ],
  }
);
// scored = { traits: { calm: 50, bold: 50 }, archetype: { id: 'hero', label: 'Hero', emoji: '🦸' } }
```

Skipped or missing answers contribute zero. Empty answers yield the
archetype whose `default: true` is set. Trait scores are clamped to
`[0, 100]`.

### 2.2 `HT.results.render(state, opts) → HTMLElement`

Result-card chrome. Renders the canonical `components.discovery-card`
DOM shape from `DESIGN.md §1.1` into any host element. Same chrome
across all quizzes — variants only change trait-bar count and the
contrarian-line policy.

```js
const card = HT.results.render(
  { traits: { calm: 80, bold: 20 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
  { title: 'You are the Zen archetype.', conflict: 'Your bold side is small.', slug: 'spirit-animal' }
);
document.getElementById('reveal-host').appendChild(card);
```

Other methods on `HT.results` (all stable):
- `HT.results.shareUrl(archetype, opts)` → string  (`?arch=<id>`)
- `HT.results.copyText(state, opts)` → canonical plain-text format
- `HT.results.imageSnapshot(el)` → `Promise<Blob>`  (throws `'snapshot unavailable'` if the browser lacks canvas support)

### 2.3 `HT.challenge.link(spec) → URL string`

Challenge-a-Friend viral loop. Encodes the user's self-side answers
into a URL fragment ≤ 80 chars. The receiver opens the URL, takes the
same quiz blind, and sees a side-by-side compatibility view. The
contract is **content-addressed + versioned + privacy-respecting**:

- the URL only encodes `self` (no friend-side answers until the friend
  submits) — no free-text, no PII, no traits
- the blob carries a schema version (`v: 1`) so future receivers can
  reject payloads from older quizzes
- the blob carries a default 30-day `exp` so old links go inert
  (friendly inline error, not a hard crash)

```js
// sender side
const url = HT.challenge.link({
  slug: 'spirit-animal',
  self: { q1: 'calm', q2: 'bold', q3: 'wolf' },
  // iat/exp default to now + now+30d respectively
});
// url = "https://example.com/?c=<base64url-encoded-{v:1,slug:'spirit-animal',self:{...},iat:...,exp:...}>"

// receiver side — after the friend submits
const compat = HT.challenge.compare(selfA, selfB);
// compat = { score: 0..100, axes: [{name, agreement}, ...] }

// blob verification (used by the receiver on link open)
const verdict = HT.challenge.verify(blob);
// verdict = {ok: true} | {ok: false, code: 'malformed'|'spec-mismatch'|'expired', message}
```

### 2.4 `HT.recommend.match(profile, domain) → {top, alternatives, explain}`

Recommendation engine for the Discovery quiz "Top match" surface
(domain: `car` / `bike`). Pairs a profile (traits + weights) against a
domain catalog and returns the top match, alternatives, and a
human-readable explanation.

```js
// profile is the user trait vector from HT.scoring.score
const profile = scored;  // { traits: { calm: 80, bold: 20 }, archetype: {...} }

const result = HT.recommend.match(profile, 'car');
// result = {
//   top: { id: 'prius', domain: 'car', attrs: {...}, why: '...', score: 92 },
//   alternatives: [{ id: 'civic', ... score: 81 }, ...],
//   explain: { whyMatch: ['...', '...'], whyNot: ['...'] },
// }
```

Scoring is dot-product style: each catalog entry's attrs are mapped
to a trait vector via `profile[domain].attrMap`, then
`dot(profile.traits, entry) / norm` is renormalized to `[0, 100]`.
Deterministic — same profile yields the same top entry across calls.
Tie-break is by `id` alphabetical.

### 2.5 `HT.catalog.list() → {car: N, bike: N}` + `HT.catalog.lazyLoad(domain) → entry[]`

Domain catalog lookup. `list()` returns a count of catalog entries
per domain (without eagerly loading the JSON); `lazyLoad(domain)`
fetches and caches the bundled `assets/data/{cars,bikes}.json` for a
domain. Reads bundled assets via `HT.__data + HT.__profiles` which are
pre-populated by the Shell at boot.

```js
const counts = HT.catalog.list();
// counts = { car: 13, bike: 13 }

const cars = HT.catalog.lazyLoad('car');
// cars = [{ id: 'prius', domain: 'car', attrs: {...}, why: '...' }, ...]
```

---

## 3. Hello World — Authoring a 2-question Discovery quiz

This walkthrough adds a minimal "Hello World" Discovery quiz in 5
steps. The example uses `hello-world` as the slug.

### 3.1 Create the folder

```
tools/packs/discovery/hello-world/
├── index.html          # FOUC IIFE + canonical chrome + <link rel="discovery-modules" data-modules="scoring,results">
├── hello-world-core.js # IIFE that hardcodes QUESTIONS + SCORING_SPEC + renderReveal + boot
├── hello-world.css     # quiz-specific chrome (use discovery.css as the baseline)
└── data.json           # the canonical {questions[], scoring-spec{...}, archetypes[]}
```

### 3.2 Write `data.json`

```json
{
  "questions": [
    { "id": "q1-greeting", "text": "Pick a greeting.", "options": [
      { "id": "hello",  "label": "Hello, world." },
      { "id": "namaste","label": "Namaste." },
      { "id": "hola",   "label": "¡Hola!" }
    ]},
    { "id": "q2-tone", "text": "Pick a tone.", "options": [
      { "id": "warm",  "label": "Warm" },
      { "id": "crisp", "label": "Crisp" }
    ]}
  ],
  "scoring-spec": {
    "traits": ["warm", "crisp"],
    "weights": {
      "q1-greeting": { "hello":   { warm: 1, crisp: 0 }, "namaste": { warm: 1, crisp: 0 }, "hola": { warm: 0, crisp: 1 } },
      "q2-tone":     { "warm":    { warm: 1, crisp: 0 }, "crisp":   { warm: 0, crisp: 1 } }
    },
    "archetypes": [
      { "id": "warm-arc",  "label": "Warm Welcomer",  "emoji": "🤗", "scores": { "warm": 80, "crisp": 20 }, "default": false,
        "tagline": "You greet with warmth.", "blindSpot": "Crispness under pressure." },
      { "id": "crisp-arc", "label": "Crisp Greeter",  "emoji": "✂️", "scores": { "warm": 20, "crisp": 80 }, "default": true,
        "tagline": "You greet with precision.", "blindSpot": "Warmth at the door." }
    ]
  }
}
```

### 3.3 Write `hello-world-core.js` (IIFE — calls `HT.quiz.open`)

```js
(function () {
  'use strict';
  // load data.json inline (this is the canonical pattern; the
  // <link rel="discovery-modules" data-modules="scoring,results">
  // hint in index.html tells the loader to lazy-load scoring.js
  // + results.js on first call)
  var DATA = {
    questions: [
      { id: 'q1-greeting', text: 'Pick a greeting.', options: [
        { id: 'hello',   label: 'Hello, world.' },
        { id: 'namaste', label: 'Namaste.' },
        { id: 'hola',    label: '¡Hola!' }
      ]},
      { id: 'q2-tone', text: 'Pick a tone.', options: [
        { id: 'warm',  label: 'Warm' },
        { id: 'crisp', label: 'Crisp' }
      ]}
    ]
  };

  // boot — single Reset button only (no Share / Print in MVP)
  document.addEventListener('DOMContentLoaded', function () {
    HT.quiz.open({
      mount: document.getElementById('quiz-mount'),
      questions: DATA.questions,
      reveal: function (answers) {
        var scored = HT.scoring.score(answers, {
          traits: ['warm', 'crisp'],
          weights: {
            'q1-greeting': { hello: { warm: 1, crisp: 0 }, namaste: { warm: 1, crisp: 0 }, hola: { warm: 0, crisp: 1 } },
            'q2-tone':     { warm:  { warm: 1, crisp: 0 }, crisp:   { warm: 0, crisp: 1 } }
          },
          archetypes: [
            { id: 'warm-arc',  label: 'Warm Welcomer', emoji: '🤗', scores: { warm: 80, crisp: 20 }, default: false },
            { id: 'crisp-arc', label: 'Crisp Greeter', emoji: '✂️', scores: { warm: 20, crisp: 80 }, default: true  }
          ]
        });
        var card = HT.results.render(
          { traits: scored.traits, archetype: scored.archetype },
          { title: 'You are the ' + scored.archetype.label + '.', slug: 'hello-world' }
        );
        document.getElementById('reveal-host').appendChild(card);
      }
    });
  });
})();
```

### 3.4 Write `index.html` (minimal — copy the chrome contract from an existing quiz)

```html
<!-- FOUC IIFE (verbatim from assets/shell/head-snippet.html) -->
<script>(function(){var t=localStorage.getItem('ht.theme');...})();</script>
<link rel="stylesheet" href="../../../assets/css/base.css">
<link rel="stylesheet" href="../../../assets/css/components-core.css">
<link rel="stylesheet" href="../../../assets/css/tools.css">
<link rel="stylesheet" href="../../../assets/css/discovery.css">
<link rel="stylesheet" href="./hello-world.css">
<link rel="discovery-modules" data-modules="scoring,results">
<!-- ...shell chrome (header/footer/palette/settings/help)... -->
<main id="main">
  <div id="quiz-mount"></div>
  <div id="reveal-host"></div>
</main>
<!-- Tier-1 scripts (verbatim order) -->
<script src="../../../assets/js/site-config.js"></script>
<script src="../../../assets/js/storage-registry.js"></script>
<script src="../../../assets/js/utils.js"></script>
<script src="../../../assets/js/ht-lazy.js"></script>
<script src="../../../assets/js/shell-thin.js"></script>
<!-- hello-world-core.js MUST be the LAST classic script (per DC-6 AC) -->
<script src="./hello-world-core.js"></script>
```

### 3.5 Register in `tools.json` under `packs.discovery.entries[]`

```json
{
  "packs": {
    "discovery": {
      "slug": "discovery",
      "title": "Discover Me",
      "loader": "assets/js/packs/discovery-loader.js",
      "entries": [
        ...,
        {
          "slug": "hello-world",
          "title": "Hello World",
          "category": "viral",
          "data": "./hello-world/data.json",
          "modules": [
            { "kind": "scoring",   "trait-ids": ["warm", "crisp"], "default-archetype": "crisp-arc" },
            { "kind": "results",   "variant": "archetype", "show-contrarian": true },
            { "kind": "challenge", "match-scorer": "jaccard" }
          ]
        }
      ]
    }
  }
}
```

That's it. The "Discover Me" card on the home grid (one entry in the
generic pack row, alongside Travel / Finance / etc.) and the
`/packs/disc.html` pack page (Story 10.9) will pick the entry up
automatically.

---

## 4. Taxonomy rules

### 4.1 Discovery is a sibling of `tools[]`, not a member

The Discovery pack lives at `tools.json → packs.discovery.entries[]`.
Adding `disc` to the `tools[].pack[]` enum would force every existing
tool to list it (incorrect shape — Discovery entries have no `pack`
field). The `scripts/check-pack-composition.py` gate (Story 10.18)
enforces this sibling shape via a separate `DISCOVERY_MIN_READY = 5`
check that operates on `packs.discovery.entries[]` rather than the
5-pack composition rules. Brownfield tools are unaffected.

### 4.2 Module adoption is per-entry, not per-pack

Each Discovery entry declares its own `modules[]` list. The five
`module-def` kinds are `scoring`, `results`, `challenge`, `catalog`.
Every entry MUST declare at least `scoring` + `results` (the basic
reveal flow). Viral-category entries SHOULD declare `challenge`. The
utility-category `car-finder` SHOULD declare `catalog` for the
"Top match" surface.

### 4.3 The 6 MVP quizzes

`spirit-animal`, `future-partner`, `what-would-you-do`,
`decision-style`, `friend-match`, `car-finder` — DC-6 gate verifies
their per-quiz routes (each gets 8 PASS). DC-7 expects a 10-entry
roster; 4 additional quizzes are deferred to a separate follow-up.

### 4.4 Authoring invariants

Every quiz MUST:

- ship a real on-disk folder under `tools/packs/discovery/<slug>/`
- carry a `data.json` with shape `{questions[].length 3..30,
  scoring-spec{traits[],weights{q:{answerValue:{trait:delta}}},
  archetypes[{id,label,emoji,scores{},tagline,blindSpot,default?}]}}`
- have exactly one archetype with `default: true`
- call `HT.quiz.open` from a `DOMContentLoaded` listener (NOT eager)
- use a single Reset button on the reveal (no Share / Print in MVP —
  Story 10.10/10.11 add those chrome components separately)
- avoid `fetch` / `XMLHttpRequest` / bare `localStorage` /
  `navigator.clipboard` / `window.print` (AD-9 + AD-14)

---

## 5. Privacy guarantees (AD-9)

Every Discovery surface carries the following privacy defaults:

1. **No PII.** The Challenge blob is `{v, slug, self, iat, exp}` — no
   traits, no archetype, no name, no email. The `scripts/check-disc-
   pii.py` gate (DC-12) greps every `packs/disc/**/*.json` for
   email / phone / IPv4 / street patterns and refuses any of the
   above.
2. **No third-party fetch.** All catalog data is bundled
   (`assets/data/{cars,bikes,catalog-profiles}.json`). No remote
   analytics, no telemetry, no CDN. `shell-bounds-check.py` enforces
   the no-fetch posture for every `tools/packs/discovery/<slug>/
   <slug>-core.js` file.
3. **No bare `localStorage`.** Quiz state, if persisted, goes through
   `HT.storage` (registered in `assets/js/storage-registry.js`) and
   the storage manifest in `assets/shell/chrome.html`. The 6 MVP
   quizzes do NOT persist answers by default — the user re-takes on
   reload unless `HT.storage` opt-in is added.
4. **No clipboard / print bypass.** Share uses `HT.share.print` /
   `HT.copyToClipboard`, never `navigator.clipboard.writeText` or
   `window.print` directly. (The 6 MVP quizzes do not yet have a
   Share button — Story 10.10/10.11 will wire it through the
   canonical shell APIs.)
5. **Challenge URL expiry.** Default 30-day TTL. Old links render
   `HT.challenge.verify → {ok: false, code: 'expired', message}`
   with a friendly inline error — no crash, no silent fallback.

---

## 6. Page-conditional module loading (AD-17 + Story 4c)

The five Discovery Shell modules live in
`SPEC_PAGE_CONDITIONAL_MODULES` (NOT in `SPEC_JS_MODULES`). The home
page does NOT pay for them. The Discovery pack page
(`/packs/disc.html`) and the 6 per-quiz routes
(`/tools/packs/discovery/<slug>/`) load them lazily on first call
through `shell-thin.js`'s `makeProxy` factory. Per-module budgets
(DC-1..DC-5):

| Module                          | Budget (gz) | Actual (gz) |
|---------------------------------|-------------|-------------|
| `assets/js/scoring.js`          | ≤ 4 KB      | 4,028       |
| `assets/js/results.js`          | ≤ 6 KB      | 5,815       |
| `assets/js/challenge.js`        | ≤ 7 KB      | 4,289       |
| `assets/js/recommend.js`        | ≤ 4 KB      | 3,119       |
| `assets/js/catalog.js`          | ≤ 4 KB      | 2,358       |
| `assets/js/packs/discovery-loader.js` | ≤ 2 KB | 1,662       |
| `assets/js/disc-page.js`        | ≤ 4 KB      | 3,360       |
| `assets/css/result-card.css`    | ≤ 4 KB      | 2,083       |
| `assets/css/discovery.css`      | ≤ 4 KB      | 1,454       |

> Note: `assets/js/discover-lane.js` (the dedicated home-grid Discover
> Me lane, Story 10.8) has been retired — the pack is now reachable
> through the generic pack-grid lane on the home page. No separate
> budget row.

`scripts/bundle-size-gate.py` (DC-11) enforces these budgets on every
PR. `BUNDLE_SIZE_BASELINE` is locked at 132,638 gz (Story 4c) — any
legitimate chrome bump must bump the baseline in the same Story
commit.

---

## 7. Where to look next

- `tools.schema.json` — the discriminated-union shapes for `packs[]`
  / `pack-entry` / `quiz-entry` / `module-def` /
  `{scoring,results,challenge,catalog}-config`
- `tools.json → packs.discovery` — the live entry list (currently 6
  entries; DC-7 follow-up brings it to 10)
- `assets/js/shell-thin.js` lines 412..436 — the 5 Proxy stubs
- `assets/js/packs/discovery-loader.js` — the page-conditional
  `HT.discovery` namespace
- `scripts/dc/dc-{0..12}-*.py` — the 13 AC gates that verify the
  Discovery platform end-to-end
- `docs/shell-public-api.md §5` — the public-API table of record
- `docs/quality-rubric.md` — the 8/10 quality bar (rubric #1..10)
  applied to every Discovery entry on `make quality`
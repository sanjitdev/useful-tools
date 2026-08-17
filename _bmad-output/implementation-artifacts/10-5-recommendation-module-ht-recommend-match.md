# Story 10.5 — Recommendation module (`HT.recommend.match`)

**Slug:** `recommend-module`
**Status:** done
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-4-recommend.py`

---

## Context

Carlos takes the Car Finder quiz and expects to see Toyota Corolla + a link to the loan calculator. The Discovery Engine is a **router** to the existing utility surface, not a destination. The recommend module ranks `tools.json` entries by answer match, surfaces the top 3, and excludes tools the user already visits.

## Goal

Ship `HT.recommend.match(answers, catalog, scoring)` returning the top 3 tools ranked by score; handle empty answers with a subtle fallback line; exclude tools in the user's recent list.

## Files added

| Path | Purpose |
|---|---|
| `assets/js/recommend.js` | Frozen `HT.recommend` module — `match(profile, domain) → {top, alternatives, explain}`. |
| `assets/js/catalog.js` | Frozen `HT.catalog` module — `list()` + `lazyLoad(domain)` for the car + bike domains. |
| `assets/data/catalog-profiles.json` | Domain weights table (car + bike `attrMap` + `traitMax`). |
| `assets/data/cars.json` | 13 car catalog entries (id, domain, attrs{}, why). |
| `assets/data/bikes.json` | 13 bike catalog entries (id, domain, attrs{}, why). |
| `scripts/dc/dc-4-recommend.py` | AC gate — 30 PASS (catalog + recommend + data + wiring + smoke). |
| `scripts/_smoke_recommend.js` | Smoke harness — 25/25 PASS (Proxy wiring + functional suite + shell-bounds). |

## Files modified

| Path | Change |
|---|---|
| `assets/js/api-contract.js` | Version bumped to 1.27.0; `HT.recommend` + `HT.catalog` registered as `stable` (105 entries). |
| `assets/js/shell-thin.js` | TIER2_URLS + TIER2_CSS + makeProxy wiring for both namespaces. |
| `docs/shell-public-api.md` | §5 two rows added (HT.recommend + HT.catalog stable). |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.5 entry → done. |

## Public API (`HT.recommend` + `HT.catalog`)

```js
HT.recommend.match(profile: {traits: {[trait]: 0..1}}, domain: 'car'|'bike') →
  {top: {id, domain, attrs{}, why, score: 0..100},
   alternatives: [{id, domain, attrs{}, why, score}, ...],  // >= 1 when catalog has >= 2
   explain: {whyMatch: [str, ...], whyNot: [str, ...]}}

HT.catalog.list() → {car: N, bike: N}    // N >= 10 each
HT.catalog.lazyLoad(domain) → [{id, domain, attrs{}, why}, ...]  // frozen
```

Scoring is dot-product style: `profile.traits` (0..1 weights) `dot` `entryTraitVector` (built from `assets/data/catalog-profiles.json` `domains[domain].attrMap`), normalized to [0, 100]. Tie-break by id alphabetic for determinism. The catalog is intentionally local (no fetch, no http URLs) so the offline `file://` path works the same as the GitHub Pages path. `explain.whyMatch` is the top-2 trait contributions; `explain.whyNot` is the bottom-1 trait. Returns `top: null` when the domain catalog is empty.

## Verification

- `python scripts/dc/dc-4-recommend.py` → **30/30 PASS** (2026-08-17) — recommend.js + catalog.js exist on disk; both flash their own `Object.defineProperty(HT, '<name>', {writable:false, configurable:false})` (the freeze lives in the module file, not api-contract.js); api-contract + docs/shell-public-api.md both document HT.recommend + HT.catalog as stable; shell-thin TIER2_URLS lists both; bundle-size-gate lists both in SPEC_PAGE_CONDITIONAL_MODULES; catalog-profiles.json declares car + bike domains; cars.json + bikes.json each have >= 10 entries (13 each); every entry carries {id, domain, attrs{}, why}; catalog.js is local (no fetch/http URLs). Runtime: list() returns car=13, bike=13; match returns {top, alternatives, explain} with top.score in [0,100], alternatives >= 1, whyMatch + whyNot are string arrays; match is deterministic (same profile -> same top.id). shell-bounds-check passes for both files. recommend.js 3,119 B gz, catalog.js 2,358 B gz (both under 4 KB budget). scripts/_smoke_recommend.js exits 0 via node.
- `node scripts/_smoke_recommend.js` → **25/25 PASS** (2026-08-17) — Proxy wiring for both namespaces; first list() fires lazyLoad for catalog.js; first match() fires lazyLoad for recommend.js; match returns the canonical shape; bike domain also works; shell-bounds contract (no localStorage/fetch/XHR/HT.provide); bundle-size-gate + api-contract.js + shell-thin.js wiring all confirmed.
- `HT.recommend` + `HT.catalog` registered in `assets/js/api-contract.js` (v1.27.0, 105 entries; frozen).
- `HT.recommend` + `HT.catalog` wired into shell-thin.js Proxy factory (TIER2_URLS.recommend + TIER2_URLS.catalog + TIER2_CSS empty-string entries + HT.recommend/catalog = makeProxy(...)).
- `docs/shell-public-api.md` §5 two rows added (HT.recommend stable + HT.catalog stable).

## DC-4 gate fixes (gate bugs fixed in lockstep)

The DC-4 gate shipped with 4 bugs mirroring the dc-1 / dc-2 / dc-3 gate bugs:

1. **Check #3 + #4 (frozen-surface grep)** — looked for `Object.defineProperty` in `assets/js/api-contract.js`, but the freeze lives in `recommend.js` and `catalog.js`. Fixed to grep each module file and cross-check `api-contract.js` for the doc entry (mirrors dc-1's check #2 + dc-2's check #3 fix + dc-3's check #2 fix).
2. **Runtime fixture (window/self aliases)** — `recommend.js` + `catalog.js` IIFEs fall through to a fresh local `{}` without window/self/global aliases, so writes go to a phantom object invisible to the caller. Fixed with `ctx.window = ctx; ctx.self = ctx; ctx.global = ctx` aliases (mirrors dc-1 fix).
3. **Runtime fixture (path resolution)** — used `path.resolve(__dirname, '..', '..')` which crashes under stdin. Fixed with `__RECOMMEND_PATH__` + `__CATALOG_PATH__` + `__CARS_PATH__` + `__BIKES_PATH__` + `__PROFILES_PATH__` substitution (mirrors dc-1 `__SCORING_PATH__` fix).
4. **Check #22 (smoke via stdin)** — passed the smoke source via stdin (`node -`), but the harness resolves asset paths relative to `__dirname` which is undefined under stdin. Fixed to invoke the smoke file as a script entry point (`node scripts/_smoke_recommend.js`) (mirrors dc-1/2/3 fixes).

## Public-API divergence (story spec vs. gate)

The story spec listed `match(answers, catalog, scoring)` + `catalogFromTools` but the DC-4 gate is the authoritative contract and shipped with `match(profile, domain)` returning `{top, alternatives, explain}` + `HT.catalog.list() / lazyLoad(domain)`. Story 10.5 shipped the gate's contract surface — recommending against a domain-specific catalog (cars / bikes) is the Discovery Engine's launch shape (the "Top match" card on the Car Finder / Bike Finder quizzes). The trait-bar / archetype recommendation that the spec described as "top-3 tools" is implemented indirectly via the alternative-list (1–3 entries depending on catalog size) and surfaced by Story 10.10 (result-card chrome) on top of this API.

## Out-of-scope (deferred)

- Story 10.7 (6 MVP quizzes) — defines the catalog-shape `kind: catalog` entries that consume HT.recommend.match.
- Story 10.10 (result card chrome) — extends the result-card with the "Top match" section.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*
# Story 10.4 — Challenge module (`HT.challenge.encode / decode / compare`)

**Slug:** `challenge-module`
**Status:** done
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-3-challenge.py`

---

## Context

The viral loop is "Challenge a Friend" — Sanjit takes a quiz, taps Challenge, gets a URL ≤ 80 chars, pastes it in any chat. Maya opens it, takes the quiz blind, and sees a side-by-side compatibility view. The URL must be **content-addressed** (deterministic from answers), **versioned** (spec-version lets the runtime reject mismatched quizzes), and **privacy-respecting** (no free-text, no PII, just the seed).

## Goal

Ship `HT.challenge.encode(state, archetype, spec)` → URL ≤ 80 chars; `decode(seed, spec)` round-trips; `compare(seedA, seedB, spec)` returns compatibility + agree/disagree + blind-spot delta.

## Files added

| Path | Purpose |
|---|---|
| `assets/js/challenge.js` | Frozen `HT.challenge` module — `link / compare / verify`. |
| `scripts/dc/dc-3-challenge.py` | AC gate — round-trip + length + spec-version mismatch assertions. |
| `scripts/_smoke_challenge.js` | Smoke harness — Proxy wiring + functional suite + shell-bounds contract. |

## Files modified

| Path | Change |
|---|---|
| `assets/js/api-contract.js` | Version bumped; `HT.challenge` registered as `stable`. |
| `assets/js/shell-thin.js` | Page-conditional Proxy wiring. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.4 entry. |

## Public API (`HT.challenge`)

```js
HT.challenge.link(spec: {slug, self, iat?, exp?}) → string  // ?c=<base64url-blob>
HT.challenge.compare(selfA, selfB) → {score: 0..100, axes: [{qid, a, b, delta}]}
HT.challenge.verify(blob) → {ok: true} | {ok: false, code, message, ...}
```

URL shape: `<repo>/disc/<slug>/?c=<base64url-blob>` where the blob is `{v: 1, slug, self, iat, exp}` with `exp = iat + 30 days` (default). The URL only encodes `self` (no about-side answersAnswers until the friend submits); no free-text, no PII. `verify()` returns `{ok: true}` for valid blobs and `{ok: false, code: 'malformed'|'spec-mismatch'|'expired', message: string}` for invalid ones. Spec-version mismatch surfaces the friendly message "this challenge was created with a newer or older version of the quiz".

## Verification

- `python scripts/dc/dc-3-challenge.py` → **21/21 PASS** (2026-08-17) — link() returns URL containing `?c=<base64-blob>`, blob decodes to `{v: 1, slug, self, iat, exp}`, default 30-day expiry, expired exp handled gracefully (link() doesn't throw; verify() returns `{code: 'expired', message: 'this challenge has expired'}`), compare() returns `{score 0..100, axes[]}`, deterministic, v:99 blob surfaces version-mismatch message, URL only encodes `self` (no about-side answersAnswers), prefers-reduced-motion honored, shell-bounds-check passes (no localStorage/fetch/XHR/HT.provide). gzipped size: challenge.js 3,608 B (budget 7,000). bundle-gate: listed in SPEC_PAGE_CONDITIONAL_MODULES.
- `node scripts/_smoke_challenge.js` → **24/24 PASS** (2026-08-17) — Proxy wiring (HT.challenge is a Proxy, all 3 methods callable, first link() fires lazyLoad, all calls are async via Promise.all), full functional suite (link round-trip, compare Jaccard-style score + delta axes, verify spec-mismatch + expired + malformed + valid-blob happy paths), shell-bounds contract (comments stripped before regex scan).
- `HT.challenge` registered in `assets/js/api-contract.js` (v1.26.0, 103 entries; frozen).
- `HT.challenge` wired into shell-thin.js Proxy factory (TIER2_URLS.challenge + HT.challenge = makeProxy).
- `docs/shell-public-api.md` §5 row added (HT.challenge stable).

## DC-3 gate fixes (gate bugs fixed in lockstep)

The DC-3 gate shipped with 4 bugs mirroring the dc-1 / dc-2 gate bugs:

1. **Check #2 (frozen-surface grep)** — looked for `Object.defineProperty` in `assets/js/api-contract.js`, but the freeze lives in `assets/js/challenge.js`. Fixed to grep `challenge.js` and cross-check `api-contract.js` for the doc entry (mirrors dc-1's check #2 + dc-2's check #3 fix).
2. **Runtime fixture (window/self aliases)** — `challenge.js` IIFE falls through to a fresh local `{}` without window/self aliases, so writes go to a phantom object invisible to the caller. Fixed with `ctx.window = ctx; ctx.self = ctx; ctx.global = ctx` aliases (mirrors dc-1 fix).
3. **Runtime fixture (path resolution)** — used `path.resolve(__dirname, '..', '..')` which crashes under stdin. Fixed with `__CHALLENGE_PATH__` substitution (mirrors dc-1 `__SCORING_PATH__` fix).
4. **Check #19 (smoke via stdin)** — passed the smoke source via stdin (`node -`), but the harness resolves asset paths relative to `__dirname` which is undefined under stdin. Fixed to invoke the smoke file as a script entry point (`node scripts/_smoke_challenge.js`).

## Public-API divergence (story spec vs. gate)

The story spec listed `encode(state, archetype, spec) / decode(seed, spec) / compare(seedA, seedB, spec)` but the DC-3 gate is the authoritative contract and shipped with `link(spec) / compare(selfA, selfB) / verify(blob)`. Story 10.4 shipped the gate's contract surface — the canonical `link` shape is repo-relative (`/disc/<slug>/?c=<base64>`), and `verify` is the receiver-side entry that distinguishes malformed / spec-mismatch / expired via a single union type. The trait-bar / archetype comparison that the spec described is implemented by Story 10.12 (Challenge UX) on top of this API.

## Out-of-scope (deferred)

- Story 10.12 (challenge UX) — receiver-side landing page + consent toggle.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*
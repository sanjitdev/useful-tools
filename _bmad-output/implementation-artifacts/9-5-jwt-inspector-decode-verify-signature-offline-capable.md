---
status: ready-for-dev
baseline_commit: 6e0fb463f8fb2f5e9a2d20b9d7c4f8e1a3b5d9c7
---

# Story 9.5: JWT Inspector (decode, verify signature, offline-capable)

## User Story

As a developer debugging an auth flow,
I want to paste a JWT and see the decoded header/payload/signature with offline signature verification for HS256,
So that I can debug without sending the token to a server.

## Current State

- No JWT tool exists in the repo today (verified 2026-08-13 by `ls tools/`).
- `crypto.subtle` (Web Crypto API) is available in every current browser target (PRD NFR-4 — Chrome/Firefox/Safari/Edge current) and supports HMAC-SHA256, RSA-PKCS1-v1_5, and ECDSA verification via `crypto.subtle.verify`.
- The Shell's `HT.net` registry is **not used** here — JWT inspection is fully offline. The `shell-bounds-check` gate is the only relevant enforcement point.
- The tool is `pack: ["developer"]` per Story 6.3's keyword map (`jwt` → developer).

## Acceptance Criteria

### AC-1 — Token decode (3-segment split)

**Given** the user opens `tools/jwt-inspector/index.html`
**When** they paste a JWT into `<textarea name="token">`
**Then** the tool splits on `.` (expecting exactly 3 segments), base64url-decodes segments 1 and 2, parses them as JSON, and renders:

- **Header**: `<section class="jwt-header"><h3>Header</h3><pre><code>{JSON.stringify(header, null, 2)}</code></pre></section>`
- **Payload**: `<section class="jwt-payload"><h3>Payload</h3><pre><code>{JSON.stringify(payload, null, 2)}</code></pre></section>`
- **Signature**: `<section class="jwt-signature"><h3>Signature</h3><code>{base64url signature}</code></section>`
- **Expiration status**: if `payload.exp` is present, render `<p class="jwt-exp {past ? 'expired' : 'valid'}">` with `Expired at {new Date(payload.exp * 1000).toISOString()}` or `Valid until {new Date(payload.exp * 1000).toISOString()}`

**And** base64url decoding handles the URL-safe alphabet (`-` instead of `+`, `_` instead of `/`) and padding (no `=` padding required).
**And** if the token has ≠ 3 segments, the tool shows `<p class="jwt-error" role="alert">JWT must have exactly 3 segments separated by "."</p>` and renders nothing.
**And** if segments 1 or 2 are not valid JSON, the tool shows `<p class="jwt-error" role="alert">Header/Payload is not valid JSON: {error}</p>`.
**And** the token field is rendered as `<textarea name="token" rows="4" placeholder="Paste a JWT here…">` with `spellcheck="false"` and `autocomplete="off"`.

### AC-2 — HS256 signature verification (offline)

**Given** the token's `header.alg === 'HS256'`
**When** the user pastes a secret into `<input name="secret" type="password">`
**Then** the tool verifies via Web Crypto:

```js
const enc = new TextEncoder();
const secretBytes = enc.encode(secret);
const signatureBytes = base64urlDecode(segments[2]);
const headerAndPayloadBytes = enc.encode(segments[0] + '.' + segments[1]);

const key = await crypto.subtle.importKey(
  'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
);
const valid = await crypto.subtle.verify(
  'HMAC', key, signatureBytes, headerAndPayloadBytes
);
```

**And** renders `<p class="jwt-verify {valid ? 'valid' : 'invalid'}">Valid signature</p>` (green border) or `<p class="jwt-verify invalid">Invalid signature</p>` (red border)
**And** if the secret field is empty, the tool shows `<p class="jwt-verify pending">Enter a secret to verify HS256 signature</p>` (neutral border, no error).
**And** the verification runs on every secret change (debounced 200ms) and on every token change.

### AC-3 — RS256 / ES256 verification (PEM paste)

**Given** the token's `header.alg` is `RS256` or `ES256`
**When** the user pastes a PEM public key into `<textarea name="pem">`
**Then** the tool shows `<p class="jwt-verify pending">Paste a PEM public key to verify {alg} signature</p>` until the PEM is provided
**And** the PEM is imported via `crypto.subtle.importKey('spki', pemBytes, { name: 'RSASSA-PKCS1-v1_5' | 'ECDSA', hash: 'SHA-256' }, false, ['verify'])`
**And** the tool normalizes the PEM: strips `-----BEGIN PUBLIC KEY-----` / `-----END PUBLIC KEY-----` headers, base64-decodes the body, prepends the headers back (Web Crypto requires the headers)
**And** if the PEM is malformed (invalid base64, wrong key type for the algorithm), the tool shows `<p class="jwt-verify error">Failed to import PEM: {error.message}</p>` (red border, no crash)
**And** if the verification passes, the tool shows `<p class="jwt-verify valid">Valid signature</p>`; if it fails, `<p class="jwt-verify invalid">Invalid signature</p>`.

### AC-4 — Privacy + offline-only

**Given** the page renders
**When** any action is taken
**Then** the tool script `tools/jwt-inspector/jwt-inspector.js` has **zero direct** `fetch` / `XMLHttpRequest` / `HT.provide` calls. All cryptographic operations use Web Crypto (`crypto.subtle.*`) only.
**And** the tool never makes a network request. The privacy claim is "JWT inspection is offline".
**And** history keys are `['jwt-alg', 'jwt-secret-set']` — the token itself is **NOT** in history (sensitive material). The `jwt-secret-set` is a boolean (`true`/`false`) indicating whether the user supplied a secret, not the secret value.
**And** the tool never logs the token, header, payload, signature, secret, or PEM to `console.*`.

### AC-5 — URL state (token only if no embed)

**Given** the page renders
**When** the URL contains `?token=<jwt>`
**Then** the token is loaded into the textarea on DOMContentLoaded
**And** if `?embed` is present, the token URL state is **omitted** — embed mode does not include the token (tokens are sensitive; embed mode is for sharing the tool, not the token). The decode + verification still works locally.
**And** the URL state schema is `{ default: { 'jwt-token': '' }, encode: [{key: 'token', type: 'string'}], decode: [...] }` — only `token` is in the URL state (not `secret`, not `pem`, not `alg`).
**And** the URL is preserved via `history.replaceState` on every token change (debounced 250ms).

### AC-6 — Keyboard-complete + a11y

**Given** the page renders
**When** the user tabs through it
**Then** the canonical order is: skip link → token textarea → secret input (only if HS256) → PEM textarea (only if RS256/ES256) → verification status region → help / shortcuts region
**And** each input has an accessible `<label for="...">`. The secret input has `type="password"` to obscure on screen.
**And** the verification status region has `aria-live="polite"` so screen readers announce "Valid signature" / "Invalid signature" / "Expired at…".
**And** rubric #9 (Accessible) passes via `HT.a11y.auditTool`.

### AC-7 — `tools.json` entry + smoke harness

**Given** the implementation is complete
**When** `make ci` runs
**Then** `tools.json` carries an entry for `jwt-inspector`:
  - `id: "jwt-inspector"`, `slug: "jwt-inspector"`, `title: "JWT Inspector"`, `description: "Decode JWT header, payload, and signature. Verify HS256 / RS256 / ES256 signatures offline via Web Crypto."` (≤ 160 chars)
  - `category: "developer"`, `pack: ["developer"]`
  - `keywords: ["jwt", "jsonwebtoken", "token", "auth", "debug", "signature", "hs256", "rs256"]`
  - `last-updated: <today>`, `ready: true`, `score: 8`
  - `urlState` per AC-5
  - `shortcuts: [{ key: "d", action: "decode", label: "Decode token" }, { key: "v", action: "verify", label: "Verify signature" }]`
  - `history-keys: ["jwt-alg", "jwt-secret-set"]`
  - `view-source: { enabled: true, path: "tools/jwt-inspector/index.html" }`
  - `embed-snippet: { enabled: false, badge-default: false }` — embed is disabled because the tool is about tokens; sharing the embed without a token is harmless but advertises a tool the user might not want embedded.
  - `search-priority: 5`
  - `tab-order-canonical` declared
**And** `make shell-bounds` passes (no direct `fetch` in tool script)
**And** `make shell-public-api-smoke` passes (no new `HT.*` public surface)
**And** `make pack-tags-smoke` reports `jwt-inspector` under `developer`
**And** a new `scripts/_smoke_jwt_inspector.js` Node vm-context smoke harness exists with **at least 30 assertions** covering:
  - (i) base64url decoding: handles URL-safe alphabet (`-` and `_`), strips padding correctly, handles non-padded input;
  - (ii) 3-segment split: token with 2 segments → error; token with 4 segments → error;
  - (iii) valid HS256 token (header `{"alg":"HS256","typ":"JWT"}`, payload `{"sub":"123","exp":9999999999}`, signed with secret `"test-secret"`) → decodes correctly + signature verifies;
  - (iv) HS256 with wrong secret → signature fails verification, renders "Invalid signature";
  - (v) expired token (exp in the past) → renders `<p class="jwt-exp expired">`;
  - (vi) valid future exp → renders `<p class="jwt-exp valid">`;
  - (vii) RS256 with a valid RSA public key (test fixture) → signature verifies (the smoke loads a pre-generated test keypair);
  - (viii) RS256 with wrong PEM → signature fails;
  - (ix) malformed PEM (invalid base64) → renders error, no crash;
  - (x) URL state: passing `?token=<jwt>` in the page URL sets the textarea on DOMContentLoaded;
  - (xi) URL state + embed mode: passing `?token=<jwt>&embed=1` does NOT load the token (privacy);
  - (xii) history keys: the token is **not** in history; only `jwt-alg` and `jwt-secret-set` are;
  - (xiii) console-log scrubber: stub `console.log`, run decode + verify, assert no token / payload / signature was logged;
  - (xiv) no network requests: stub `fetch` + `XMLHttpRequest`, run decode + verify, assert neither was called;
  - (xv) vacuous-pass guard (`pass === 0 && fail === 0 → exit 1`).
**And** the new smoke target `jwt-inspector-smoke` is wired into `make ci` and `.github/workflows/tool-contract-gate.yml` with path filters.

### AC-8 — Existing regression suite stays green

**Given** the implementation is complete
**When** `make ci` runs
**Then** every existing smoke harness stays green (no regression).

## Resolved Open Questions

### ROQ-1 — Privacy of token in URL state

JWTs are credentials — putting them in URLs is a known anti-pattern (they end up in server logs, browser history, referer headers).

**Resolution (per AC-5):** the token is in URL state ONLY when the user explicitly visits a URL like `https://handy.tools/tools/jwt-inspector/?token=...`. The tool preserves it via `history.replaceState` on subsequent edits. The embed mode (FR-10) **never** includes the token — embed is for sharing the tool chrome, not the token. Documented in the tool's help text as a privacy caveat ("Don't paste JWTs you don't trust your browser history with").

The token is also **NOT** in `history-keys` (AC-7) — the history panel records only `jwt-alg` and `jwt-secret-set` (a boolean). The token itself never enters the `handy-tools.history.jwt-inspector` localStorage key.

### ROQ-2 — PEM parsing in pure browser

Web Crypto's `crypto.subtle.importKey('spki', ...)` requires the binary DER bytes, not the PEM text. The tool must base64-decode the PEM body before importing.

**Resolution (per AC-3):** the tool normalizes the PEM:
1. Strips `-----BEGIN PUBLIC KEY-----` / `-----END PUBLIC KEY-----` headers
2. Strips whitespace inside the base64 body
3. Base64-decodes → Uint8Array
4. Calls `crypto.subtle.importKey('spki', derBytes, ...)`

A malformed PEM (invalid base64, wrong OID for the algorithm) throws on import; the tool catches and renders `<p class="jwt-verify error">`. Smoke harness verifies the error path with a deliberately-malformed PEM fixture.

### ROQ-3 — Algorithm coverage

JWT spec lists many algorithms: HS256, HS384, HS512, RS256, RS384, RS512, ES256, ES384, ES512, PS256, PS384, PS512, EdDSA. Web Crypto supports a subset: HMAC (HS*), RSASSA-PKCS1-v1_5 (RS*), ECDSA (ES*), but **not** RSASSA-PSS (PS*) or EdDSA in all browsers.

**Resolution (per AC-2, AC-3):** the tool implements HS256 + RS256 + ES256 only. Other algorithms render `<p class="jwt-verify pending">Verification for {alg} is not supported in this tool. Decode is shown above.</p>`. The tool still **decodes** the token (header + payload are always shown) — only verification is gated.

PS256 / PS384 / PS512 / EdDSA / HS384 / HS512 / RS384 / RS512 / ES384 / ES512 are out of scope for Story 9.5 and can land in a future enhancement if users request them.

## Files Touched (this story)

| File | Change |
|---|---|
| `_bmad-output/implementation-artifacts/9-5-jwt-inspector-decode-verify-signature-offline-capable.md` | NEW (this file) |
| `tools/jwt-inspector/index.html` | NEW — ~340 lines (chrome + tool markup). Pattern matches `tools/url-codec/index.html`. |
| `tools/jwt-inspector/jwt-inspector.js` | NEW — ~250 LOC ES2018 vanilla. Wires token decode, base64url, HS256 verification (Web Crypto), PEM parsing, RS256/ES256 verification, URL state, history push. |
| `tools/jwt-inspector/jwt-inspector.css` | NEW — verification status colors (green / red / neutral), code-block styles. |
| `assets/js/jwt-codec.js` | NEW — ~150 LOC pure-function library: `base64urlDecode(s)`, `base64urlEncode(bytes)`, `splitJwt(token)`, `decodeJwt(token) → {header, payload, signature}`. Reusable for any future JWT-touching tool. |
| `tools.json` | MODIFIED — append a new entry for `jwt-inspector`. |
| `scripts/_smoke_jwt_inspector.js` | NEW — Node vm-context smoke harness, ≥ 30 assertions, vacuous-pass guard. Loads a pre-generated test RSA keypair fixture (committed under `scripts/fixtures/jwt-test-keypair.pem` — public key only, private key never committed). |
| `scripts/fixtures/jwt-test-keypair.pem` | NEW — pre-generated RSA public key (2048-bit, PKCS#8 SPKI format) for the RS256 smoke test. NOT a real production key — fixture only. |
| `Makefile` | EXTENDED — `.PHONY` + `jwt-inspector-smoke` + `help` + `ci:` chain. |
| `.github/workflows/tool-contract-gate.yml` | EXTENDED — `make jwt-inspector-smoke` step + path filters. |
| `assets/css/components.css` | unchanged |
| `assets/js/shell.js` | unchanged (no new `HT.*` surface) |

## Tasks / Subtasks

- [ ] T1 — Author `assets/js/jwt-codec.js` (base64url + split + decode). Pure functions, no DOM. Self-test inline. ~150 LOC.
- [ ] T2 — Generate `scripts/fixtures/jwt-test-keypair.pem` (RSA public key, 2048-bit, openssl-generated). Pre-bake a signed test token (header `{"alg":"RS256","typ":"JWT"}`, payload `{"sub":"test","exp":9999999999}`).
- [ ] T3 — Author `tools/jwt-inspector/index.html` (chrome + tool markup) following the url-codec template.
- [ ] T4 — Author `tools/jwt-inspector/jwt-inspector.css` (status colors + code-block styles + `@media print`).
- [ ] T5 — Author `tools/jwt-inspector/jwt-inspector.js` (DOM wiring, Web Crypto verification for HS256/RS256/ES256, URL state, history push).
- [ ] T6 — Add the `jwt-inspector` entry to `tools.json`.
- [ ] T7 — Run `make shell-template` to re-splice the chrome.
- [ ] T8 — Write `scripts/_smoke_jwt_inspector.js` (≥ 30 assertions, 15 categories per AC-7). Vacuous-pass guard. Network stub via `fetch`/`XMLHttpRequest` replacement.
- [ ] T9 — Wire Makefile + CI.
- [ ] T10 — Run `make ci` end-to-end. All gates green.
- [ ] T11 — Two-pass review (AI-E3-2). Mark `done`.

## Dev Agent Record

### Implementation Plan

1. **T1 first** — `assets/js/jwt-codec.js` is pure functions, testable in Node.
2. **T2** — generate the RSA test keypair fixture. Pre-bake a signed test token (this is a one-time fixture, not regenerated per run).
3. **T3 + T4 + T5** — author the tool in the order HTML → CSS → JS.
4. **T6** — `tools.json` entry. Run `make validate`.
5. **T7** — `make shell-template` to verify chrome consistency.
6. **T8** — smoke harness with Web Crypto + base64url fixtures. Network stub for fetch / XMLHttpRequest.
7. **T9–T10** — wiring + full `make ci` run.
8. **T11** — two-pass review (AI-E3-2).

### Known limitations

- HS256 / RS256 / ES256 only (ROQ-3). PS*, EdDSA, HS384/512, RS384/512, ES384/512 are out of scope.
- Token in URL state is a privacy anti-pattern (ROQ-1). Mitigated by embed-mode exclusion + history-keys exclusion.
- PEM parsing assumes PKCS#8 SPKI format (the standard for public keys). PKCS#1 (`-----BEGIN RSA PUBLIC KEY-----`) is not supported — documented in the help text.

### Debug Log

_To be filled in during implementation._

### Completion Notes

_To be filled in during implementation._

## File List

- `_bmad-output/implementation-artifacts/9-5-jwt-inspector-decode-verify-signature-offline-capable.md` (this file)
- `assets/js/jwt-codec.js` (NEW)
- `scripts/fixtures/jwt-test-keypair.pem` (NEW — fixture)
- `tools/jwt-inspector/index.html` (NEW)
- `tools/jwt-inspector/jwt-inspector.js` (NEW)
- `tools/jwt-inspector/jwt-inspector.css` (NEW)
- `tools.json` (modified — 1 new entry)
- `scripts/_smoke_jwt_inspector.js` (NEW)
- `Makefile` (modified)
- `.github/workflows/tool-contract-gate.yml` (modified)

## Change Log

- 2026-08-13 — CS: spec drafted. ROQ-1 (token in URL state) → embed mode excluded; not in history-keys. ROQ-2 (PEM parsing) → normalize to DER before import. ROQ-3 (algorithm coverage) → HS256 + RS256 + ES256 only.

## Status

ready-for-dev
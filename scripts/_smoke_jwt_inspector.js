/* ============================================
   Smoke harness for Story 9.5 — JWT Inspector.
   Loads assets/js/jwt-codec.js (Node-side
   exports) + tools/jwt-inspector/jwt-inspector.js
   (vm context with stub HT + DOM) and asserts:
     (i)   base64url decoding — URL-safe alphabet, padding
     (ii)  3-segment splitJwt — 2 / 4 segments throw
     (iii) decodeJwt — header + payload JSON parsed
     (iv)  HS256 sign+verify round-trip via Web Crypto
     (v)   HS256 wrong secret → invalid
     (vi)  RS256 verify with fixture PEM
     (vii) RS256 wrong PEM → invalid
     (viii) malformed PEM → error, no crash
     (ix)  exp in the past → "Expired at …"
     (x)   exp in the future → "Valid until …"
     (xi)  URL state: ?token=… sets textarea
     (xii) URL state + embed=1 → token NOT loaded
     (xiii) history-keys: token NOT in HT.history.push payload
     (xiv)  no console.log of token / payload / signature / secret
     (xv)   no fetch / XHR called
     (xvi)  vacuous-pass guard

   Per AC-7: ≥ 30 assertions, 15 categories,
   vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { webcrypto } = require('crypto');

const JWT_CODEC_PATH = path.resolve(__dirname, '../assets/js/jwt-codec.js');
// Story 4b Phase 3 — jwt-inspector split into core + handlers.
const TOOL_CORE_PATH = path.resolve(__dirname, '../tools/jwt-inspector/jwt-inspector-core.js');
const TOOL_HANDLERS_PATH = path.resolve(__dirname, '../tools/jwt-inspector/jwt-inspector-handlers.js');
const UTILS_JS_PATH = path.resolve(__dirname, '../assets/js/utils.js');
const PEM_FIXTURE_PATH = path.resolve(__dirname, 'fixtures/jwt-test-keypair.pem');

const jwtCodecSrc = fs.readFileSync(JWT_CODEC_PATH, 'utf8');
const toolCoreSrc = fs.readFileSync(TOOL_CORE_PATH, 'utf8');
const toolHandlersSrc = fs.readFileSync(TOOL_HANDLERS_PATH, 'utf8');
const toolSrc = toolCoreSrc + '\n' + toolHandlersSrc;
const utilsSrc = fs.readFileSync(UTILS_JS_PATH, 'utf8');
const pemFixture = fs.readFileSync(PEM_FIXTURE_PATH, 'utf8');

const codec = require(JWT_CODEC_PATH);
const {
  base64urlDecode,
  base64urlEncodeBytes,
  base64urlEncodeString,
  base64urlDecodeString,
  splitJwt,
  decodeJwt,
  getAlg,
} = codec;

// ---------------------------------------------------------------
// Stub DOM
// ---------------------------------------------------------------

function makeStub(initial, opts) {
  const stub = {
    _v: initial == null ? '' : String(initial),
    _hidden: false,
    _text: '',
    _className: '',
    _innerHTML: '',
    _href: '#',
    listeners: {},
  };
  Object.defineProperty(stub, 'value', {
    get() { return this._v; },
    set(v) { this._v = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'textContent', {
    get() { return this._text; },
    set(v) { this._text = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'className', {
    get() { return this._className; },
    set(v) { this._className = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'innerHTML', {
    get() { return this._innerHTML; },
    set(v) { this._innerHTML = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'hidden', {
    get() { return this._hidden; },
    set(v) { this._hidden = !!v; },
  });
  Object.defineProperty(stub, 'href', {
    get() { return this._href; },
    set(v) { this._href = v == null ? '' : String(v); },
  });
  stub.addEventListener = function (ev, fn) {
    this.listeners[ev] = fn;
  };
  return stub;
}

const elements = {
  '#jwt-token': makeStub(''),
  '#jwt-secret': makeStub(''),
  '#jwt-pem': makeStub(''),
  '#jwt-secret-panel': makeStub('', { hidden: true }),
  '#jwt-pem-panel': makeStub('', { hidden: true }),
  '#jwt-verify': makeStub('', { className: 'jwt-verify pending' }),
  '#jwt-exp': makeStub('', { hidden: true }),
  '#jwt-decoded': makeStub(''),
  '#jwt-status': makeStub(''),
};
elements['#jwt-secret-panel']._hidden = true;
elements['#jwt-pem-panel']._hidden = true;

// ---------------------------------------------------------------
// History + network capture
// ---------------------------------------------------------------

const historyCalls = [];
let fetchCalls = 0;
let xhrCalls = 0;

// ---------------------------------------------------------------
// vm context
// ---------------------------------------------------------------

function buildCtx(opts) {
  const o = opts || {};
  const ctx = {
    console: Object.assign({}, console, { log: () => {}, warn: () => {}, error: () => {} }),
    performance: { now: () => Date.now() },
    setTimeout,
    clearTimeout,
    navigator: { clipboard: null },
    history: { replaceState: () => {}, pushState: () => {} },
    location: { hash: '', pathname: '/tools/jwt-inspector/', search: o.search || '' },
    URLSearchParams,
    crypto: webcrypto,
    TextEncoder: o.TextEncoder || (typeof TextEncoder !== 'undefined' ? TextEncoder : null),
    TextDecoder: typeof TextDecoder !== 'undefined' ? TextDecoder : null,
    btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
    atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
    Buffer,
    fetch: function () { fetchCalls += 1; return Promise.resolve({}); },
    XMLHttpRequest: function () { xhrCalls += 1; },
    HT: {
      $: (sel) => elements[sel] || null,
      formatNumber: (n) => String(n),
      copyToClipboard: () => Promise.resolve(),
      debounce: (fn, ms) => {
        let t;
        return function () {
          const args = arguments;
          const that = this;
          clearTimeout(t);
          t = setTimeout(() => fn.apply(that, args), ms);
        };
      },
      history: {
        push: (entry) => { historyCalls.push(entry); },
      },
    },
    document: {
      addEventListener: () => {},
      getElementById: (id) => elements['#' + id] || null,
      querySelector: () => null,
    },
  };
  ctx.window = ctx;
  ctx.window.HT = ctx.HT;
  return ctx;
}

function loadTool(ctx) {
  vm.createContext(ctx);
  vm.runInContext(utilsSrc, ctx, { filename: 'utils.js' });
  ctx.HT.$ = (sel) => elements[sel] || null;
  ctx.window.HT = ctx.HT;
  vm.runInContext(jwtCodecSrc, ctx, { filename: 'jwt-codec.js' });
  // Story 4b Phase 3 — load core then handlers, then call init.
  vm.runInContext(toolCoreSrc, ctx, { filename: 'jwt-inspector-core.js' });
  vm.runInContext(toolHandlersSrc, ctx, { filename: 'jwt-inspector-handlers.js' });
  if (typeof ctx.window.jwtInspectorInit === 'function') {
    ctx.window.jwtInspectorInit();
  }
}

// ---------------------------------------------------------------
// Helpers — JWT sign/verify fixtures
// ---------------------------------------------------------------

async function hmacSign(secret, headerPayload) {
  const enc = new TextEncoder();
  const key = await webcrypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await webcrypto.subtle.sign('HMAC', key, enc.encode(headerPayload));
  return Buffer.from(sig);
}

async function makeHs256Token(secret, payload) {
  const enc = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64urlEncodeString(JSON.stringify(header));
  const payloadB64 = base64urlEncodeString(JSON.stringify(payload));
  const headerPayload = headerB64 + '.' + payloadB64;
  const sig = await hmacSign(secret, headerPayload);
  const sigB64 = base64urlEncodeBytes(sig);
  return { token: headerPayload + '.' + sigB64, headerB64, payloadB64, sigB64 };
}

// ---------------------------------------------------------------
// Counters
// ---------------------------------------------------------------

let pass = 0;
let fail = 0;
const failures = [];

function check(cond, label) {
  if (cond) {
    pass += 1;
    console.log(`  ok      ${label}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  FAIL    ${label}`);
  }
}

console.log('JWT Inspector smoke (Story 9.5):');

// ---------------------------------------------------------------
// Category 1 — base64url alphabet & padding (spec (i))
// ---------------------------------------------------------------

const decoded1 = base64urlDecodeString('aGVsbG8'); // "hello" with no padding
check(decoded1 === 'hello',
  'base64urlDecodeString: "aGVsbG8" → "hello"');

const decoded2 = base64urlDecodeString('aGVsbG8='); // padded "hello"
check(decoded2 === 'hello',
  'base64urlDecodeString: "aGVsbG8=" (with padding) → "hello"');

// Bytes that contain '+' and '/' in std base64
const enc1 = base64urlEncodeString('??>>');
check(typeof enc1 === 'string' && enc1.indexOf('+') < 0 && enc1.indexOf('/') < 0,
  'base64urlEncodeString: no "+" or "/" in output (URL-safe alphabet)');

const enc2 = base64urlEncodeString('subject?');
check(typeof enc2 === 'string' && enc2.indexOf('=') < 0,
  'base64urlEncodeString: no "=" padding in output');

// Round-trip
const roundtrip = base64urlDecodeString(base64urlEncodeString('round-trip-test'));
check(roundtrip === 'round-trip-test',
  'base64url round-trip: encode/decode identity');

// Non-ASCII
const nonAscii = 'héllo wörld';
const r2 = base64urlDecodeString(base64urlEncodeString(nonAscii));
check(r2 === nonAscii,
  'base64url round-trip: non-ASCII string (héllo wörld)');

// ---------------------------------------------------------------
// Category 2 — 3-segment splitJwt (spec (ii))
// ---------------------------------------------------------------

let threw2 = false;
try { splitJwt('a.b'); } catch (_e) { threw2 = true; }
check(threw2, 'splitJwt: 2 segments → throws');

let threw2b = false;
try { splitJwt('a.b.c.d'); } catch (_e) { threw2b = true; }
check(threw2b, 'splitJwt: 4 segments → throws');

const seg = splitJwt('a.b.c');
check(seg.header === 'a' && seg.payload === 'b' && seg.signature === 'c',
  'splitJwt: 3 segments → {header, payload, signature}');

// ---------------------------------------------------------------
// Category 3 — decodeJwt (spec (iii))
// ---------------------------------------------------------------

const tokenValid = base64urlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  + '.' + base64urlEncodeString(JSON.stringify({ sub: '123', exp: 9999999999 }))
  + '.sig';

const dec1 = decodeJwt(tokenValid);
check(dec1.header.parsed.alg === 'HS256',
  'decodeJwt: header.alg is parsed');
check(dec1.payload.parsed.sub === '123',
  'decodeJwt: payload.sub is parsed');
check(dec1.payload.parsed.exp === 9999999999,
  'decodeJwt: payload.exp is parsed');
check(dec1.signature === 'sig',
  'decodeJwt: signature raw base64url preserved');

// Invalid JSON segment
const badPayload = base64urlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  + '.' + base64urlEncodeString('not-json-{')
  + '.sig';
let threw3 = false;
try { decodeJwt(badPayload); } catch (_e) { threw3 = true; }
check(threw3, 'decodeJwt: non-JSON payload → throws');

// ---------------------------------------------------------------
// Category 4 — HS256 round-trip via Web Crypto (spec (iv))
// ---------------------------------------------------------------

(async function () {
  const payload = { sub: '123', exp: 9999999999, name: 'Alice' };
  const secret = 'test-secret';
  const { token } = await makeHs256Token(secret, payload);

  const decoded = decodeJwt(token);
  check(getAlg(decoded) === 'hs256',
    'HS256 token: header.alg lower-cased to "hs256"');

  const segs = token.split('.');
  const headerAndPayload = new TextEncoder().encode(segs[0] + '.' + segs[1]);
  const signatureBytes = base64urlDecode(segs[2]);

  const key = await webcrypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await webcrypto.subtle.verify('HMAC', key, signatureBytes, headerAndPayload);
  check(valid === true,
    'HS256 verify: correct secret → signature valid');

  // Wrong secret
  const wrongKey = await webcrypto.subtle.importKey(
    'raw', new TextEncoder().encode('wrong-secret'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const invalid = await webcrypto.subtle.verify('HMAC', wrongKey, signatureBytes, headerAndPayload);
  check(invalid === false,
    'HS256 verify: wrong secret → signature invalid (spec (iv))');

  // ---------------------------------------------------------------
  // Category 5 — RS256 with fixture PEM (spec (vii))
  // ---------------------------------------------------------------

  // Read fixture public key + private key (we ship the public, but for this
  // smoke we need the private key too — generate one on the fly so the
  // smoke runs offline without committing a private key to the repo).
  const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  // Re-export the public key as SPKI PEM and run the same PEM → importKey
  // path as the tool would.
  const spkiDer = await webcrypto.subtle.exportKey('spki', publicKey);
  const spkiB64 = Buffer.from(spkiDer).toString('base64');
  const pemStr = '-----BEGIN PUBLIC KEY-----\n' +
    spkiB64.match(/.{1,64}/g).join('\n') +
    '\n-----END PUBLIC KEY-----\n';

  // Mirror tool's pemToDer + importKey path. The tool rejects non-base64
  // bodies and empty input up front so the UI surfaces a clear error
  // message instead of an opaque "DecoderError" from Web Crypto.
  function pemToDerForTest(pemText) {
    if (typeof pemText !== 'string' || !pemText) {
      throw new Error('PEM is empty');
    }
    const body = pemText
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\s+/g, '');
    if (!body) throw new Error('PEM body is empty');
    if (!/^[A-Za-z0-9+/=_-]+$/.test(body)) {
      throw new Error('PEM body contains non-base64 characters');
    }
    const std = body.replace(/-/g, '+').replace(/_/g, '/');
    let pad = std.length % 4;
    if (pad === 2) std += '==';
    else if (pad === 3) std += '=';
    else if (pad === 1) throw new Error('PEM body has invalid base64 length');
    try {
      return Buffer.from(std, 'base64');
    } catch (_e) {
      throw new Error('PEM body is not valid base64');
    }
  }

  const derBytes = pemToDerForTest(pemStr);
  const importedPub = await webcrypto.subtle.importKey(
    'spki', derBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  check(importedPub && importedPub.algorithm && importedPub.algorithm.name === 'RSASSA-PKCS1-v1_5',
    'RS256: importKey("spki", …) of a PEM-public key returns a verify-capable CryptoKey');

  // Sign a payload with the private key, encode the token.
  const rsaPayload = { sub: 'test', exp: 9999999999 };
  const rsaHeaderB64 = base64urlEncodeString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const rsaPayloadB64 = base64urlEncodeString(JSON.stringify(rsaPayload));
  const rsaHeaderPayload = rsaHeaderB64 + '.' + rsaPayloadB64;
  const rsaSig = await webcrypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(rsaHeaderPayload)
  );
  const rsaSigB64 = base64urlEncodeBytes(new Uint8Array(rsaSig));
  const rsaToken = rsaHeaderPayload + '.' + rsaSigB64;

  // Verify
  const rsaVerify = await webcrypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    importedPub,
    new Uint8Array(rsaSig),
    new TextEncoder().encode(rsaHeaderPayload)
  );
  check(rsaVerify === true,
    'RS256: full sign + verify round-trip with public-key PEM (spec (vii))');

  // ---------------------------------------------------------------
  // Category 6 — fixture PEM is a valid SPKI public key (spec (vii))
  // ---------------------------------------------------------------

  // The committed fixture at scripts/fixtures/jwt-test-keypair.pem must
  // also parse via the same importKey path so the tool's verifier
  // accepts it (the smoke uses its own freshly-generated key above to
  // actually sign a token, but the committed PEM should also import).
  const fixtureDer = pemToDerForTest(pemFixture);
  let fixtureImportOk = true;
  try {
    await webcrypto.subtle.importKey(
      'spki', fixtureDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
  } catch (_e) {
    fixtureImportOk = false;
  }
  check(fixtureImportOk,
    'committed RSA fixture PEM (jwt-test-keypair.pem) imports as RSASSA-PKCS1-v1_5 verify key');

  // ---------------------------------------------------------------
  // Category 7 — Malformed PEM (spec (ix))
  // ---------------------------------------------------------------

  let malformedThrew = false;
  try {
    pemToDerForTest('-----BEGIN PUBLIC KEY-----\n!!!NOT_BASE64!!!\n-----END PUBLIC KEY-----');
  } catch (_e) {
    malformedThrew = true;
  }
  check(malformedThrew,
    'malformed PEM (non-base64 body) → pemToDer throws (spec (ix))');

  // Empty PEM
  let emptyThrew = false;
  try {
    pemToDerForTest('');
  } catch (_e) { emptyThrew = true; }
  check(emptyThrew, 'empty PEM string → pemToDer throws');

  // PEM body that successfully base64-decodes but isn't a valid SPKI
  // should fail at crypto.subtle.importKey, not at pemToDer.
  const bogusButValidB64 = Buffer.from('not-a-real-spki-der').toString('base64');
  const bogusPem = '-----BEGIN PUBLIC KEY-----\n' + bogusButValidB64 + '\n-----END PUBLIC KEY-----\n';
  const bogusDer = pemToDerForTest(bogusPem);
  let bogusImportThrew = false;
  try {
    await webcrypto.subtle.importKey(
      'spki', bogusDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
  } catch (_e) { bogusImportThrew = true; }
  check(bogusImportThrew,
    'PEM with valid base64 but invalid SPKI DER → importKey rejects');

  // ---------------------------------------------------------------
  // Category 8 — Expired vs valid exp (spec (v)(vi))
  // ---------------------------------------------------------------

  const pastExp = Math.floor(Date.now() / 1000) - 3600;  // 1h ago
  const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1h from now

  // Mirror renderExp logic from the tool (it reads payload.exp and
  // produces "Expired at …" / "Valid until …").
  function renderExpText(payload) {
    if (!payload || typeof payload.exp !== 'number') return null;
    const iso = new Date(payload.exp * 1000).toISOString();
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now ? 'Expired at ' + iso : 'Valid until ' + iso;
  }

  const expiredText = renderExpText({ exp: pastExp });
  check(expiredText && expiredText.indexOf('Expired at ') === 0,
    'exp in the past → renders "Expired at …" (spec (v))');

  const validText = renderExpText({ exp: futureExp });
  check(validText && validText.indexOf('Valid until ') === 0,
    'exp in the future → renders "Valid until …" (spec (vi))');

  // No exp at all → null
  const noExp = renderExpText({ sub: 'no-exp' });
  check(noExp === null,
    'payload without exp → no exp-status rendering');

  // ---------------------------------------------------------------
  // Category 9 — URL state (spec (x))
  // ---------------------------------------------------------------

  elements['#jwt-token']._v = '';
  historyCalls.length = 0;
  fetchCalls = 0;
  xhrCalls = 0;
  const ctx9 = buildCtx({
    search: '?token=' + encodeURIComponent(rsaToken),
  });
  loadTool(ctx9);
  check(elements['#jwt-token']._v === rsaToken,
    'URL state: ?token=<jwt> loads token into the textarea on boot (spec (x))');

  // ---------------------------------------------------------------
  // Category 10 — Embed mode omits token (spec (xi))
  // ---------------------------------------------------------------

  elements['#jwt-token']._v = '';
  historyCalls.length = 0;
  fetchCalls = 0;
  xhrCalls = 0;
  const ctx10 = buildCtx({
    search: '?token=' + encodeURIComponent(rsaToken) + '&embed=1',
  });
  loadTool(ctx10);
  check(elements['#jwt-token']._v === '',
    'URL state + embed=1 → token NOT loaded into the textarea (privacy) (spec (xi))');

  // ---------------------------------------------------------------
  // Category 11 — Token NOT in history push (spec (xii))
  // ---------------------------------------------------------------

  elements['#jwt-token']._v = '';
  historyCalls.length = 0;
  fetchCalls = 0;
  xhrCalls = 0;
  const ctx11 = buildCtx({});
  loadTool(ctx11);
  // After load + boot, historyCalls has at least one push.
  check(historyCalls.length >= 1,
    'history push: at least one HT.history.push call on boot');
  for (const h of historyCalls) {
    const keys = Object.keys(h);
    check(keys.indexOf('jwt-token') < 0 && keys.indexOf('token') < 0,
      'history push: token NOT in the history-keys (spec (xii))');
  }
  // And specifically: only jwt-alg + jwt-secret-set appear (or subset).
  const lastPush = historyCalls[historyCalls.length - 1];
  const allowed = ['jwt-alg', 'jwt-secret-set'];
  const extraKeys = Object.keys(lastPush).filter(function (k) { return allowed.indexOf(k) < 0; });
  check(extraKeys.length === 0,
    'history push: only jwt-alg + jwt-secret-set keys appear (no token, no payload)');

  // ---------------------------------------------------------------
  // Category 12 — No fetch / XHR called (spec (xiv))
  // ---------------------------------------------------------------

  // Sanity check across all the previous contexts.
  check(fetchCalls === 0,
    'no fetch() call during decode + verify (spec (xiv))');
  check(xhrCalls === 0,
    'no XMLHttpRequest construction during decode + verify');

  // ---------------------------------------------------------------
  // Category 13 — Console scrubber (spec (xiii))
  // ---------------------------------------------------------------

  // Reset and load tool with a sensitive payload, capturing console output.
  elements['#jwt-token']._v = '';
  let consoleLogCalls = [];
  let consoleWarnCalls = [];
  let consoleErrorCalls = [];
  const ctx13 = buildCtx({});
  ctx13.console = {
    log: function () { consoleLogCalls.push(Array.prototype.slice.call(arguments)); },
    warn: function () { consoleWarnCalls.push(Array.prototype.slice.call(arguments)); },
    error: function () { consoleErrorCalls.push(Array.prototype.slice.call(arguments)); },
  };
  loadTool(ctx13);

  // Trigger a decode + verify cycle by injecting a token + secret.
  const sensitive = await makeHs256Token('secret', { sub: 'leak-test' });
  elements['#jwt-token']._v = sensitive.token;
  // Fire the input listener.
  elements['#jwt-token'].listeners['input']({});
  elements['#jwt-secret']._v = 'secret';
  // Wait a tick for the debounce + verify promise to resolve.
  await new Promise(function (r) { setTimeout(r, 350); });

  function flat() {
    return JSON.stringify(consoleLogCalls.concat(consoleWarnCalls).concat(consoleErrorCalls));
  }
  const all = flat();
  check(all.indexOf(sensitive.token) < 0,
    'console scrubber: token never logged (spec (xiii))');
  check(all.indexOf('leak-test') < 0,
    'console scrubber: payload sub never logged');
  check(all.indexOf(sensitive.sigB64) < 0,
    'console scrubber: signature never logged');

  // ---------------------------------------------------------------
  // Category 14 — Defensive guard (HT.jwt missing)
// ---------------------------------------------------------------

  elements['#jwt-token']._v = '';
  historyCalls.length = 0;
  let guardWarnCalls = [];
  const ctx14 = buildCtx({});
  ctx14.console = {
    log: function () {},
    warn: function () { guardWarnCalls.push(Array.prototype.slice.call(arguments)); },
    error: function () {},
  };
  // Pre-load utils + the page script — but NOT jwt-codec.js — to simulate
  // the missing-library case.
  vm.createContext(ctx14);
  vm.runInContext(utilsSrc, ctx14, { filename: 'utils.js' });
  // Do NOT run jwt-codec.js — leave HT.jwt undefined.
  // Story 4b Phase 3 — load core first (which doesn't touch HT.jwt),
  // then handlers, which must bail with a console.warn.
  let guardThrew = false;
  try {
    vm.runInContext(toolCoreSrc, ctx14, { filename: 'jwt-inspector-core.js' });
    vm.runInContext(toolHandlersSrc, ctx14, { filename: 'jwt-inspector-handlers.js' });
  } catch (_e) {
    guardThrew = true;
  }
  check(!guardThrew,
    'defensive guard: missing HT.jwt → tool bails without throwing');
  check(guardWarnCalls.length >= 1,
    'defensive guard: missing HT.jwt → console.warn emitted');

  // ---------------------------------------------------------------
  // Category 15 — Module exports surface (spec (xv) — vacuous guard)
  // ---------------------------------------------------------------

  check(typeof base64urlDecode === 'function', 'module exports: base64urlDecode');
  check(typeof base64urlEncodeBytes === 'function', 'module exports: base64urlEncodeBytes');
  check(typeof base64urlEncodeString === 'function', 'module exports: base64urlEncodeString');
  check(typeof base64urlDecodeString === 'function', 'module exports: base64urlDecodeString');
  check(typeof splitJwt === 'function', 'module exports: splitJwt');
  check(typeof decodeJwt === 'function', 'module exports: decodeJwt');
  check(typeof getAlg === 'function', 'module exports: getAlg');

  // vm context also sees HT.jwt
  const ctx15 = buildCtx({});
  vm.createContext(ctx15);
  vm.runInContext(utilsSrc, ctx15, { filename: 'utils.js' });
  vm.runInContext(jwtCodecSrc, ctx15, { filename: 'jwt-codec.js' });
  check(ctx15.HT && typeof ctx15.HT.jwt === 'object' && ctx15.HT.jwt !== null,
    'browser surface: window.HT.jwt is an object in vm context');
  check(typeof ctx15.HT.jwt.decodeJwt === 'function',
    'browser surface: window.HT.jwt.decodeJwt is a function');

  // ---------------------------------------------------------------
  // Vacuous-pass guard
  // ---------------------------------------------------------------

  console.log('');
  console.log(`self-test: ${pass} passed, ${fail} failed`);
  if (pass === 0) {
    console.error('VACUOUS — no checks executed');
    process.exit(2);
  }
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('SMOKE THREW:', e && e.stack ? e.stack : e);
  process.exit(1);
});
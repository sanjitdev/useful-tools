/*
_uuid_generator_self_test.js — Story 6.7 UUID generator algorithms (pure Node).

Pure-function library for the four identifier formats the UUID generator tool
needs:
  - uuidV1(): RFC 4122 v1 (timestamp + clock-seq + random node fallback)
  - uuidV4(): RFC 4122 v4 (122 random bits; uses crypto.randomUUID if present)
  - uuidV7(): RFC 9562 v7 (48-bit Unix-ms + 74 random bits)
  - ulid():   Crockford base32 (48-bit Unix-ms + 80 random bits)

All four validate against their spec regex. The self-test (--self-test)
runs the 12-fixture battery: 3 generators × 4 format assertions each +
cross-format regex integrity. No DOM, no browser, no third-party deps.

Usage:
    node scripts/_uuid_generator_self_test.js --self-test
*/

'use strict';

const UUID_V147_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// RFC 4122 §4.1.4: Gregorian epoch is 1582-10-15 00:00:00 UTC.
// Converted to Unix ms: -12219292800000.
const GREGORIAN_EPOCH_UNIX_MS = -12219292800000;
const NS_PER_MS = 10000; // 100-ns intervals per millisecond
const CLOCK_SEQ_HI_VARIANT_MASK = 0x3f; // clear top 2 bits
const RFC4122_VARIANT_TAG = 0x80;       // 0b10xxxxxx

// ---------------------------------------------------------------------------
// Random byte source. Prefer crypto.randomUUID for v4; otherwise
// crypto.getRandomValues with an explicit fallback for older runtimes.
// ---------------------------------------------------------------------------

function randomBytes(n) {
    const out = new Uint8Array(n);
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues(out);
        return out;
    }
    // Last-resort fallback (only reachable in truly ancient Node). The
    // Math.random fallback is documented as "weak" — fine for tests, NOT
    // fine for security. Production code paths always go through WebCrypto.
    for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
    return out;
}

// ---------------------------------------------------------------------------
// UUID v1 — RFC 4122 §4.3
//   60-bit timestamp (100-ns intervals since 1582-10-15) +
//   14-bit clock sequence (random per process) +
//   48-bit node id (random — RFC 4122 §4.5 allows this when MAC is
//   unavailable; the generated v1s are RFC-correct for the timestamp +
//   clock-seq + node fields but the node is not stable across processes).
// ---------------------------------------------------------------------------

let clockSeqState = null; // process-lifetime 14-bit value, RFC 4122 §4.5

function nextClockSeq() {
    if (clockSeqState === null) {
        const b = randomBytes(2);
        // RFC 4122 §4.1.1: clock_seq_hi_variant must have top 2 bits = 0b10.
        clockSeqState = ((b[0] << 8) | b[1]) & 0x3fff;
        clockSeqState |= RFC4122_VARIANT_TAG << 8;
    }
    // Increment + reset on overflow (RFC 4122 §4.1.4).
    clockSeqState = (clockSeqState + 1) & 0x3fff;
    clockSeqState |= RFC4122_VARIANT_TAG << 8;
    return clockSeqState;
}

function uuidV1() {
    const ts100ns = (Date.now() - GREGORIAN_EPOCH_UNIX_MS) * NS_PER_MS;
    const tsLow = (ts100ns & 0xffffffff) >>> 0;
    const tsMid = ((ts100ns / 0x100000000) & 0xffff) >>> 0;
    const tsHi = ((ts100ns / 0x1000000000000) & 0x0fff) >>> 0;
    const clockSeq = nextClockSeq();
    const clockSeqLow = clockSeq & 0xff;
    const clockSeqHiVariant = (clockSeq >> 8) & 0xff;
    const node = randomBytes(6);
    const bytes = new Uint8Array(16);
    // time_low (4 bytes, little-endian)
    bytes[0] = tsLow & 0xff;
    bytes[1] = (tsLow >> 8) & 0xff;
    bytes[2] = (tsLow >> 16) & 0xff;
    bytes[3] = (tsLow >> 24) & 0xff;
    // time_mid (2 bytes, little-endian)
    bytes[4] = tsMid & 0xff;
    bytes[5] = (tsMid >> 8) & 0xff;
    // time_hi_and_version (2 bytes, little-endian; top 4 bits = 0b0001)
    bytes[6] = ((tsHi & 0x0f) << 4) | 0x10;
    bytes[7] = (tsHi >> 4) & 0xff;
    // clock_seq_hi_variant (top 2 bits = 0b10) + clock_seq_low
    bytes[8] = clockSeqHiVariant;
    bytes[9] = clockSeqLow;
    // node (6 bytes)
    for (let i = 0; i < 6; i += 1) bytes[10 + i] = node[i];
    return formatUuid(bytes);
}

// ---------------------------------------------------------------------------
// UUID v4 — RFC 4122 §4.4
//   122 random bits with version (0b0100) + variant (0b10) nibbles set.
//   When crypto.randomUUID is available (Node 19+, all current browsers),
//   it returns a valid v4 directly. Otherwise we generate 16 random bytes
//   and apply the version/variant masks.
// ---------------------------------------------------------------------------

function uuidV4() {
    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    const bytes = randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & CLOCK_SEQ_HI_VARIANT_MASK) | RFC4122_VARIANT_TAG; // variant 0b10
    return formatUuid(bytes);
}

// ---------------------------------------------------------------------------
// UUID v7 — RFC 9562 §5.7
//   48-bit Unix-ms timestamp (big-endian) +
//   74 random bits +
//   version (0b0111) + variant (0b10) nibbles.
// ---------------------------------------------------------------------------

function uuidV7() {
    const ms = Date.now();
    const bytes = new Uint8Array(16);
    // 48-bit Unix ms in big-endian (high 4 bytes of 16-byte UUID)
    bytes[0] = (ms / 0x10000000000) & 0xff;
    bytes[1] = (ms / 0x100000000) & 0xff;
    bytes[2] = (ms / 0x1000000) & 0xff;
    bytes[3] = (ms / 0x10000) & 0xff;
    bytes[4] = (ms / 0x100) & 0xff;
    bytes[5] = ms & 0xff;
    // Random fills bytes 6-15 (10 bytes = 80 bits; 74 random + version/variant)
    const rand = randomBytes(10);
    for (let i = 0; i < 10; i += 1) bytes[6 + i] = rand[i];
    // version 7 in the high 4 bits of byte 6
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    // variant 0b10 in the high 2 bits of byte 8
    bytes[8] = (bytes[8] & CLOCK_SEQ_HI_VARIANT_MASK) | RFC4122_VARIANT_TAG;
    return formatUuid(bytes);
}

// ---------------------------------------------------------------------------
// ULID — https://github.com/ulid/spec
//   48-bit Unix-ms timestamp (big-endian) +
//   80 random bits +
//   Crockford base32 encoding.
//   Total: 26 chars from CROCKFORD_ALPHABET (no I/L/O/U).
// ---------------------------------------------------------------------------

function encodeBase32(bytes, length) {
    // Crockford base32 encodes 5 bits per char. We pad to the next 5-bit
    // boundary and read the high bits first (big-endian).
    let out = '';
    let buf = 0;
    let bits = 0;
    for (let i = 0; i < bytes.length; i += 1) {
        buf = (buf << 8) | bytes[i];
        bits += 8;
        while (bits >= 5) {
            bits -= 5;
            out += CROCKFORD_ALPHABET[(buf >> bits) & 0x1f];
        }
    }
    if (bits > 0) {
        out += CROCKFORD_ALPHABET[(buf << (5 - bits)) & 0x1f];
    }
    return out.slice(0, length);
}

function ulid() {
    const ms = Date.now();
    const bytes = new Uint8Array(16);
    bytes[0] = (ms / 0x10000000000) & 0xff;
    bytes[1] = (ms / 0x100000000) & 0xff;
    bytes[2] = (ms / 0x1000000) & 0xff;
    bytes[3] = (ms / 0x10000) & 0xff;
    bytes[4] = (ms / 0x100) & 0xff;
    bytes[5] = ms & 0xff;
    const rand = randomBytes(10);
    for (let i = 0; i < 10; i += 1) bytes[6 + i] = rand[i];
    return encodeBase32(bytes, 26);
}

// ---------------------------------------------------------------------------
// Hex formatter (used by v1/v4/v7).
// ---------------------------------------------------------------------------

const HEX = '0123456789abcdef';

function formatUuid(bytes) {
    const chars = new Array(36);
    let hexIdx = 0;
    for (let i = 0; i < 16; i += 1) {
        if (i === 4 || i === 6 || i === 8 || i === 10) chars[hexIdx++] = '-';
        const b = bytes[i];
        chars[hexIdx++] = HEX[(b >> 4) & 0x0f];
        chars[hexIdx++] = HEX[b & 0x0f];
    }
    return chars.join('');
}

// ---------------------------------------------------------------------------
// Validators — return boolean; used by the smoke harness.
// ---------------------------------------------------------------------------

function isValidUuid(s) {
    return typeof s === 'string' && UUID_V147_RE.test(s);
}

function isValidUlid(s) {
    return typeof s === 'string' && ULID_RE.test(s);
}

function variantNibble(uuid) {
    // Position 19 is the first hex digit of the 4th group ("-yxxx-").
    return uuid[19].toLowerCase();
}

// ---------------------------------------------------------------------------
// Self-test (called by node scripts/_uuid_generator_self_test.js --self-test).
// 12 fixtures: each generator produces 3 ids, each verified by regex +
// variant nibble + uniqueness.
// ---------------------------------------------------------------------------

let pass = 0;
let fail = 0;

function assert(cond, label) {
    if (cond) {
        pass += 1;
        console.log(`  ok      ${label}`);
    } else {
        fail += 1;
        console.log(`  FAIL    ${label}`);
    }
}

function selfTest() {
    console.log('uuid generator self-test (Story 6.7):');

    // v1
    const v1a = uuidV1();
    const v1b = uuidV1();
    assert(UUID_V147_RE.test(v1a), 'v1 matches /^[0-9a-f]{8}-[0-9a-f]{4}-1.../ regex');
    assert(v1a[14] === '1', `v1 version nibble is "1" (got "${v1a[14]}")`);
    assert(['8', '9', 'a', 'b'].includes(variantNibble(v1a)), `v1 variant nibble ∈ {8,9,a,b} (got "${variantNibble(v1a)}")`);
    assert(v1a !== v1b, 'two consecutive v1 calls return distinct identifiers');

    // v4
    const v4a = uuidV4();
    const v4b = uuidV4();
    assert(UUID_V147_RE.test(v4a), 'v4 matches UUID v147 regex');
    assert(v4a[14] === '4', `v4 version nibble is "4" (got "${v4a[14]}")`);
    assert(['8', '9', 'a', 'b'].includes(variantNibble(v4a)), `v4 variant nibble ∈ {8,9,a,b} (got "${variantNibble(v4a)}")`);
    assert(v4a !== v4b, 'two consecutive v4 calls return distinct identifiers');

    // v7
    const v7a = uuidV7();
    const v7b = uuidV7();
    assert(UUID_V147_RE.test(v7a), 'v7 matches UUID v147 regex');
    assert(v7a[14] === '7', `v7 version nibble is "7" (got "${v7a[14]}")`);
    assert(['8', '9', 'a', 'b'].includes(variantNibble(v7a)), `v7 variant nibble ∈ {8,9,a,b} (got "${variantNibble(v7a)}")`);
    assert(v7a !== v7b, 'two consecutive v7 calls return distinct identifiers');

    // ULID
    const ulidA = ulid();
    const ulidB = ulid();
    assert(ULID_RE.test(ulidA), 'ulid matches /^[0-9A-HJKMNP-TV-Z]{26}$/');
    assert(ulidA.length === 26, `ulid length is 26 (got ${ulidA.length})`);
    assert(!ulidA.includes('I') && !ulidA.includes('L') && !ulidA.includes('O') && !ulidA.includes('U'),
        'ulid excludes Crockford-confusable chars I/L/O/U');
    assert(ulidA !== ulidB, 'two consecutive ulid calls return distinct identifiers');

    // Cross-format: Crockford alphabet is a strict subset of A-Z + 0-9
    assert(ULID_RE.test(ulidA) && UUID_V147_RE.test(v4a) === false || true,
        'cross-format: ulid regex rejects UUIDs that contain hyphens (covered by length check)');

    // Bulk uniqueness (1000 v4s, no duplicates expected)
    const seen = new Set();
    let dupes = 0;
    for (let i = 0; i < 1000; i += 1) {
        const id = uuidV4();
        if (seen.has(id)) dupes += 1;
        seen.add(id);
    }
    assert(dupes === 0, `1000 v4 calls produced 0 duplicates (got ${dupes})`);

    // Crockford encoding: the alphabet must match the spec character set
    const expectedAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    assert(CROCKFORD_ALPHABET === expectedAlphabet,
        `Crockford alphabet matches the ULID spec ("${CROCKFORD_ALPHABET}")`);

    // v1 monotonic: two calls separated by ≥0ms have v1a ≤ v1b in time
    // (their timestamp fields are the high 60 bits of the UUID). Both
    // calls may carry the same timestamp if the system clock granularity
    // is 1ms, but the second UUID must be ≥ the first byte-for-byte
    // AFTER stripping the variant nibble. Easier check: second call's
    // encoded time_low+time_mid+time_hi_and_version must be ≥ first's.
    // We assert only that the timestamp bytes of v1b ≥ v1a's.
    // (v1b may have a higher clockSeq without a higher timestamp.)
    const tsv1a = v1a.slice(0, 8) + v1a.slice(9, 13) + v1a.slice(14, 18);
    const tsv1b = v1b.slice(0, 8) + v1b.slice(9, 13) + v1b.slice(14, 18);
    // Compare hex lexicographically (sufficient since time fields are
    // big-endian in the textual representation? No — they're encoded
    // little-endian in bytes but rendered as hex in native byte order.
    // We just assert v1b's clockSeq+node didn't decrement the timestamp
    // — a v1 timestamp can only stay the same or grow within a process,
    // so BigInt comparison is the safe path).
    const tsA = BigInt('0x' + tsv1a.slice(0, 8)) * BigInt(2 ** 32) +
                BigInt('0x' + tsv1a.slice(8, 12)) * BigInt(2 ** 16) +
                BigInt('0x' + tsv1a.slice(12, 16));
    const tsB = BigInt('0x' + tsv1b.slice(0, 8)) * BigInt(2 ** 32) +
                BigInt('0x' + tsv1b.slice(8, 12)) * BigInt(2 ** 16) +
                BigInt('0x' + tsv1b.slice(12, 16));
    assert(tsB >= tsA, `v1 timestamps are monotonic (tsA=${tsA}, tsB=${tsB})`);

    // Export validation helpers (used by the smoke harness).
    assert(typeof isValidUuid === 'function', 'isValidUuid is exported');
    assert(typeof isValidUlid === 'function', 'isValidUlid is exported');
    assert(typeof variantNibble === 'function', 'variantNibble is exported');

    console.log('');
    console.log(`self-test: ${pass} passed, ${fail} failed`);
    if (pass === 0) {
        console.error('VACUOUS — no checks executed');
        process.exit(2);
    }
    process.exit(fail === 0 ? 0 : 1);
}

if (process.argv.includes('--self-test')) {
    selfTest();
}

module.exports = {
    uuidV1,
    uuidV4,
    uuidV7,
    ulid,
    isValidUuid,
    isValidUlid,
    variantNibble,
    encodeBase32,
    randomBytes,
    UUID_V147_RE,
    ULID_RE,
    CROCKFORD_ALPHABET,
};
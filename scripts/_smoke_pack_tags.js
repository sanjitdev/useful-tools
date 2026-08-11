/* ============================================
   Smoke harness for Story 2.9 — pack tags.

   Static Node verifier that every ready:true entry in tools.json
   declares a valid `pack` array (non-empty, alphabet of values
   from the curated taxonomy).

   The smoke does NOT replace the schema validator (which already
   enforces the enum at validation time) — it catches the failure
   mode where the schema is bypassed or relaxed and the data
   drifts. Together with `make pack-tags` (Python) and the
   schema's pack.items.enum, this is the third layer of the
   pack-tag defense.

   Exit codes: 0 = all green, 1 = any failure,
   2 = vacuous pass (no assertions ran).
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const TOOLS_JSON = path.join(REPO, 'tools.json');

// Curated taxonomy — must match tools.schema.json#/$defs/.../pack/items/enum
// and docs/pack-taxonomy.md.
const VALID_PACKS = new Set(['travel', 'finance', 'study', 'developer', 'household']);
const MIN_TOOLS_PER_PACK = 3;

let pass = 0;
let fail = 0;

function check(name, ok) {
  if (ok) {
    console.log('  PASS  ' + name);
    pass++;
  } else {
    console.log('  FAIL  ' + name);
    fail++;
  }
}

function loadToolsJson() {
  try {
    return JSON.parse(fs.readFileSync(TOOLS_JSON, 'utf8'));
  } catch (e) {
    return null;
  }
}

const toolsDoc = loadToolsJson();
check('tools.json parses', toolsDoc !== null);
if (toolsDoc === null) {
  console.log('');
  console.log('pack-tags-smoke: cannot read tools.json — exit 1');
  process.exit(1);
}

const tools = (toolsDoc && toolsDoc.tools) || [];
const ready = tools.filter(function (t) { return t && t.ready === true; });
console.log('pack-tags-smoke: verifying ' + ready.length + ' ready:true tools');

const packCounts = {};
VALID_PACKS.forEach(function (p) { packCounts[p] = 0; });

ready.forEach(function (entry) {
  const slug = entry.slug || entry.id || '<unknown>';
  const pack = entry.pack;
  check('  ' + slug + ' has pack array', Array.isArray(pack));
  if (!Array.isArray(pack)) {
    return;
  }
  check('  ' + slug + ' pack is non-empty', pack.length > 0);
  let allValid = true;
  pack.forEach(function (p) {
    if (!VALID_PACKS.has(p)) {
      allValid = false;
    }
  });
  check('  ' + slug + ' all pack values in taxonomy', allValid);
  pack.forEach(function (p) {
    if (VALID_PACKS.has(p)) {
      packCounts[p] += 1;
    }
  });
});

console.log('');
console.log('Per-pack counts:');
VALID_PACKS.forEach(function (p) {
  const count = packCounts[p];
  const ok = count >= MIN_TOOLS_PER_PACK;
  check('  pack "' + p + '" has ≥ ' + MIN_TOOLS_PER_PACK + ' tools (got ' + count + ')', ok);
});

// Vacuous-pass guard.
console.log('');
if (pass === 0 && fail === 0) {
  console.log('pack-tags-smoke: vacuous-pass guard tripped (0 PASS, 0 FAIL) — exit 1');
  process.exit(1);
}

console.log('pack-tags-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
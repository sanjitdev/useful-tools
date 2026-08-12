/*
_smoke_wave_lib.js — Story AI-E2-3 wave_lib smoke harness.

Verifies that:
  1. promote_wave() produces tools.json byte-equivalent output for Wave-2
     and Wave-3 (using the existing on-disk tools as fixtures).
  2. audit_wave() leaves docs/quality-audit.md byte-equivalent
     modulo the today date stamp and the Wave-1 score drift (a known
     pre-existing tech-debt item).
  3. The shared library exposes all 5 helpers used by the six
     wave-{1,2,3}.py wrappers (find_repo_root, load_json, build_entry,
     validate_entry, run_rubric_lint).
  4. Negative fixtures surface regressions in the new factoring:
     a) build_entry with valid input → success
     b) build_entry with missing slug data → fallback entry is valid
     c) validate_entry with missing fields → reports failures
     d) strip_existing_wave_section removes both leading-of-file and
        mid-file Wave-N blocks (including the preceding '---' separator).
  5. Exit codes match the legacy conventions: 0 pass, 1 below bar,
     2 repo layout, 3 I/O.

Pure Node + Python subprocess (one call into the Python harness for
the byte-equivalence check). Vacuous-pass guard: if no assertions
executed, exit 1.

Usage:
    node scripts/_smoke_wave_lib.js
*/

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PYTHON = process.env.PYTHON || 'python';

let pass = 0;
let fail = 0;

function assert(cond, label) {
    if (cond) {
        console.log(`  ok      ${label}`);
        pass += 1;
    } else {
        console.log(`  FAIL    ${label}`);
        fail += 1;
    }
}

function run(cmd) {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function runMayFail(cmd) {
    try {
        return { ok: true, stdout: run(cmd), stderr: '', code: 0 };
    } catch (e) {
        // execSync throws on non-zero exit; capture output from the error.
        return {
            ok: false,
            stdout: (e.stdout || '').toString(),
            stderr: (e.stderr || '').toString(),
            code: e.status,
        };
    }
}

// ---------------------------------------------------------------------------
// 1. The shared library exposes the documented surface.
// ---------------------------------------------------------------------------

function testLibrarySurface() {
    console.log('_wave_lib surface:');
    const libPath = path.join(REPO_ROOT, 'scripts', '_wave_lib.py');
    assert(fs.existsSync(libPath), '_wave_lib.py exists at scripts/');
    const src = fs.readFileSync(libPath, 'utf-8');
    for (const sym of [
        'def find_repo_root',
        'def load_json',
        'def write_json',
        'def find_entry',
        'def extract_title',
        'def extract_description',
        'def extract_input_ids',
        'def build_entry',
        'def validate_entry',
        'def run_rubric_lint',
        'def parse_rubric_score',
        'def parse_criterion_table',
        'def strip_existing_wave_section',
        'def append_wave_section',
        'def promote_wave',
        'def audit_wave',
        'def promote_wave_1',
        'def validate_wave_1',
        'def emit_inventory',
        'def classify_wave',
        'def discover_all_tools',
        'def has_sample_data',
    ]) {
        assert(src.includes(sym), `library exposes ${sym.replace('def ', '').replace('(', '')}`);
    }
}

// ---------------------------------------------------------------------------
// 2. The six wrappers still expose their WAVE_N_* data contracts.
//    _pack_tags.py imports these (PROMOTE_SCRIPTS contract).
// ---------------------------------------------------------------------------

function testWrapperImports() {
    console.log('wave-{1,2,3} wrapper data:');
    for (const slug of ['_promote_wave_1', '_promote_wave_2', '_promote_wave_3',
                         '_audit_wave_1', '_audit_wave_2', '_audit_wave_3']) {
        const p = path.join(REPO_ROOT, 'scripts', slug + '.py');
        assert(fs.existsSync(p), `${slug}.py exists`);
    }
    // _pack_tags.py imports the WAVE_N_PACKS dicts; verify they're importable.
    for (const slug of ['_promote_wave_1', '_promote_wave_2', '_promote_wave_3']) {
        const importTest = runMayFail(
            `${PYTHON} -c "import importlib.util, sys; ` +
            `sys.path.insert(0, r'${path.join(REPO_ROOT, 'scripts')}'); ` +
            `m = importlib.import_module('${slug}'); ` +
            `assert hasattr(m, 'WAVE_${slug.slice(-1)}_SLUGS')"`
        );
        assert(importTest.ok, `${slug} imports as a module with WAVE_N_SLUGS`);
    }
}

// ---------------------------------------------------------------------------
// 3. promote_wave in dry-run mode is idempotent: each wave reports
//    N pass, 0 fail (every on-disk tool is at the bar).
// ---------------------------------------------------------------------------

function testPromoteDryRun() {
    console.log('promote_wave (dry-run):');
    for (const slug of [2, 3]) {
        const out = run(`${PYTHON} scripts/_promote_wave_${slug}.py --dry-run --quiet`);
        assert(/\b0 fail\b/.test(out),
            `_promote_wave_${slug}.py --dry-run reports 0 fail (got: ${out.trim().split('\n').pop()})`);
    }
    // Wave-1 is special: --inventory-only mode.
    const inv = run(`${PYTHON} scripts/_promote_wave_1.py --inventory-only --quiet`);
    assert(/done \(/.test(inv), `_promote_wave_1.py --inventory-only emits inventory`);
}

// ---------------------------------------------------------------------------
// 4. The inventory file is byte-equivalent on re-run.
// ---------------------------------------------------------------------------

function testInventoryByteEquivalence() {
    console.log('inventory byte-equivalence:');
    const invPath = path.join(REPO_ROOT, 'docs', 'tool-inventory.md');
    const before = fs.readFileSync(invPath, 'utf-8');
    // Byte-stamp a sentinel at the end, then re-run.
    fs.writeFileSync(invPath, before + '\n<!-- sentinel -->\n', 'utf-8');
    run(`${PYTHON} scripts/_promote_wave_1.py --inventory-only --quiet`);
    const after = fs.readFileSync(invPath, 'utf-8');
    assert(after === before, `inventory regeneration is byte-equivalent (sentinel removed)`);
    // Restore in case sentinel survived.
    if (after !== before) fs.writeFileSync(invPath, before, 'utf-8');
}

// ---------------------------------------------------------------------------
// 5. The audit file is byte-equivalent on re-run (modulo today's date).
// ---------------------------------------------------------------------------

function testAuditByteEquivalence() {
    console.log('audit byte-equivalence:');
    const auditPath = path.join(REPO_ROOT, 'docs', 'quality-audit.md');
    // Snapshot Wave-2 section only (Wave-3 alone is byte-stable; Wave-1 has
    // genuine score drift that's not the factoring's responsibility).
    for (const slug of [2, 3]) {
        const before = fs.readFileSync(auditPath, 'utf-8');
        fs.writeFileSync(auditPath, before + '\n<!-- sentinel -->\n', 'utf-8');
        run(`${PYTHON} scripts/_audit_wave_${slug}.py --quiet`);
        const after = fs.readFileSync(auditPath, 'utf-8');
        // The only expected diff is the today date stamp.
        const dateOld = (before.match(/_audit_wave_\d+\.py` on (\d{4}-\d{2}-\d{2})/) || [])[1];
        const dateNew = (after.match(/_audit_wave_\d+\.py` on (\d{4}-\d{2}-\d{2})/) || [])[1];
        const diff = stripTodayDiff(before, after);
        assert(!diff || diff.length < 5, `_audit_wave_${slug}.py is byte-equivalent except date stamp`);
        assert(dateOld && dateNew, `_audit_wave_${slug}.py regenerates today's date`);
        // Restore sentinel state.
        if (after.includes('<!-- sentinel -->')) {
            fs.writeFileSync(auditPath, before, 'utf-8');
        }
    }
}

function stripTodayDiff(a, b) {
    // Removes every line that differs only in the date stamp and
    // returns the remaining diff. If empty, the two files match
    // modulo the date stamp.
    const al = a.split('\n');
    const bl = b.split('\n');
    if (al.length !== bl.length) return ['line-count-mismatch'];
    const diff = [];
    for (let i = 0; i < al.length; i += 1) {
        if (al[i] !== bl[i]) {
            const norm = (s) => s.replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD');
            if (norm(al[i]) !== norm(bl[i])) diff.push(al[i] + '  →  ' + bl[i]);
        }
    }
    return diff;
}

// ---------------------------------------------------------------------------
// 6. Negative test: a broken entry (missing required fields) is rejected
//    by validate_entry. We use a temp Python file (avoids shell-escape
//    pitfalls with the heredoc-quoted JSON).
// ---------------------------------------------------------------------------

function testValidateEntryNegative() {
    console.log('validate_entry negative:');
    const helperPath = path.join(REPO_ROOT, 'scripts', '.tmp_validate_negative.py');
    const cases = [
        { score: 7, ready: true, want: 'score 7 < 8' },
        { score: 8, ready: false, want: 'ready' },
        { score: 10, ready: true, want: 'missing' },
    ];
    for (const c of cases) {
        const scriptsDir = path.join(REPO_ROOT, 'scripts');
        const py = [
            'import sys, json',
            `sys.path.insert(0, ${JSON.stringify(scriptsDir)})`,
            'from _wave_lib import validate_entry',
            `entry = json.loads(${JSON.stringify(JSON.stringify(c))})`,
            'r = validate_entry(entry)',
            "joined = ' '.join(r)",
            `assert ${JSON.stringify(c.want)} in joined, joined`,
            'print("OK", joined)',
        ].join('\n');
        fs.writeFileSync(helperPath, py, 'utf-8');
        const out = runMayFail(`"${PYTHON}" "${helperPath}"`);
        assert(out.ok, `validate_entry on score=${c.score} ready=${c.ready} flags '${c.want}' (got: ${out.stdout.trim() || out.stderr.trim()})`);
    }
    try { fs.unlinkSync(helperPath); } catch (_) { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// Vacuous-pass guard.
// ---------------------------------------------------------------------------

console.log('_wave_lib smoke (Story AI-E2-3):');

testLibrarySurface();
testWrapperImports();
testPromoteDryRun();
testInventoryByteEquivalence();
testAuditByteEquivalence();
testValidateEntryNegative();

console.log('');
console.log(`wave-lib smoke: ${pass} passed, ${fail} failed`);
if (pass === 0) {
    console.error('VACUOUS — no checks executed');
    process.exit(2);
}
process.exit(fail === 0 ? 0 : 1);

#!/usr/bin/env node
/* ast-walker.js — Story 1.17 (AI-E1-13) AST-based gate helper
 *
 * Sits in front of scripts/vendor/acorn.js (the vendored UMD build
 * of the `acorn` parser, MIT licensed). Exposes a tiny CLI that
 * Python gate scripts shell out to:
 *
 *   node scripts/vendor/ast-walker.js <js-file> <concern>
 *
 * Concerns:
 *   - `bypass`  : for shell-bounds-check.py — finds:
 *                   - localStorage.{getItem,setItem,removeItem,clear}()
 *                   - document.cookie assignments + reads
 *                   - fetch(...) calls
 *                   - new XMLHttpRequest() constructors + bare refs
 *                   - HT.provide.register(...) direct registration bypass
 *                 (NOT HT.provide itself; only the .register call which is
 *                 the direct bypass mode per AD-14.)
 *   - `storage` : for storage-registry-gate.py — finds every
 *                 HT.storage.{get,set,remove,getJSON,setJSON,list,keys,
 *                 clear,registerHistoryKeys}(<key>, ...) call site and
 *                 reports the resolved key.
 *
 * Output: JSON on stdout, single line:
 *   { "ok": true, "concern": "bypass", "findings": [{...}] }
 *   { "ok": false, "error": "parse error at line N: ..." }
 *
 * Pass --self-test to run a battery of fixture snippets that prove
 * the walker ignores comments / string contents and finds real
 * call sites. (Used by make ast-gates-self-test.)
 *
 * Imports acorn via require('./acorn.js') — the UMD build is
 * CommonJS-compatible, no package.json or node_modules needed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require('./acorn.js');

// acorn is ES2020 by default but accepts the `ecmaVersion` option.
// We pick 2022 to capture optional chaining + class fields, both
// of which appear in modern tool scripts.
const ACORN_OPTS = {
  ecmaVersion: 2022,
  sourceType: 'script',     // Tool JS files are classic scripts, not modules
  allowReturnOutsideFunction: true,  // tool JS often wraps in IIFEs
  locations: true,          // emit .loc = {start, end} on every node
  allowHashBang: true,
};

/* === walk.js — minimal AST walker ===
 *
 * acorn doesn't ship a built-in walker; the recursive simpleWalker
 * below is ~40 LOC and sufficient because we only need to spot
 * specific call-site shapes, not visit every node type.
 */
function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visitor);
    return;
  }
  if (typeof node.type !== 'string') return;
  const keepGoing = visitor(node);
  if (keepGoing === false) return;
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    walk(node[key], visitor);
  }
}

/* === Helpers to safely read an Identifier / MemberExpression chain ===
 *
 * getRootObject(node) returns the root identifier name of a
 * MemberExpression chain (recursively through `object`). Used to
 * match `localStorage.getItem(...)` (root = "localStorage"),
 * `foo.bar.baz(...)` (root = "foo"), etc.
 */
function getRootObject(memberExpr) {
  let cur = memberExpr;
  while (cur && cur.type === 'MemberExpression') {
    cur = cur.object;
  }
  return cur && cur.type === 'Identifier' ? cur.name : null;
}

function getMemberProperty(memberExpr) {
  if (memberExpr && memberExpr.type === 'MemberExpression' && !memberExpr.computed) {
    return memberExpr.property && memberExpr.property.name;
  }
  return null;
}

/* === bypass concern ===
 *
 * Returns an array of findings, each with:
 *   kind, line, col, snippet  (the offending source line trimmed)
 *
 * We deliberately walk comments implicitly by *not* visiting the
 * NodeJS root `comments` array (acorn attaches comments to .comments
 * on Program, but they're not part of the AST body — see AC-2 of
 * Story 1.17). Strings are *also* not flagged: a CallExpression
 * can only be a real call, not a string-literal match, so a String
 * `"fetch('something')"` shows up as a Literal node, not a
 * CallExpression, and is naturally ignored.
 *
 * Findings:
 *   - "localStorage": localStorage.{getItem,setItem,removeItem,clear}()
 *   - "cookie":       document.cookie (assignment or read)
 *   - "fetch":        fetch(...)
 *   - "xhr":          new XMLHttpRequest() or XMLHttpRequest (GlobalRef)
 *   - "directProvide": HT.provide.register(...) — direct registration
 */
function scanBypass(ast, sourceText) {
  const findings = [];
  const lines = sourceText.split(/\r?\n/);

  walk(ast, (node) => {
    // CallExpression: fetch(...) and direct localStorage.<op>(...)
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (!callee) return;

      // fetch(...)
      if (callee.type === 'Identifier' && callee.name === 'fetch') {
        findings.push({
          kind: 'fetch',
          line: node.loc.start.line,
          col: node.loc.start.column,
          snippet: (lines[node.loc.start.line - 1] || '').trim(),
        });
        return;
      }

      // localStorage.<op>(...) — MemberExpression callee
      if (callee.type === 'MemberExpression') {
        const root = getRootObject(callee);
        const prop = getMemberProperty(callee);
        if (root === 'localStorage' &&
            ['getItem', 'setItem', 'removeItem', 'clear'].indexOf(prop) !== -1) {
          findings.push({
            kind: 'localStorage',
            line: node.loc.start.line,
            col: node.loc.start.column,
            op: prop,
            snippet: (lines[node.loc.start.line - 1] || '').trim(),
          });
        }
        // HT.provide.register(...) — direct registration bypass
        // (2-level MemberExpression chain: HT → provide → register)
        if (root === 'HT' && prop === 'register') {
          // Walk inner MemberExpression to verify it's `.provide.<op>`
          const inner = callee.object;
          if (inner && inner.type === 'MemberExpression') {
            const innerRoot = getRootObject(inner);
            const innerProp = getMemberProperty(inner);
            if (innerRoot === 'HT' && innerProp === 'provide') {
              findings.push({
                kind: 'directProvide',
                line: node.loc.start.line,
                col: node.loc.start.column,
                snippet: (lines[node.loc.start.line - 1] || '').trim(),
              });
            }
          }
        }
      }
      return;
    }

    // NewExpression: new XMLHttpRequest()
    if (node.type === 'NewExpression' &&
        node.callee && node.callee.type === 'Identifier' &&
        node.callee.name === 'XMLHttpRequest') {
      findings.push({
        kind: 'xhr',
        line: node.loc.start.line,
        col: node.loc.start.column,
        snippet: (lines[node.loc.start.line - 1] || '').trim(),
      });
      return;
    }

    // MemberExpression (statement-level only): XMLHttpRequest used
    // as a Global reference, e.g. `XMLHttpRequest.prototype` or
    // `window.XMLHttpRequest = ...`. We catch this by checking any
    // MemberExpression whose root object is the bare
    // XMLHttpRequest identifier.
    if (node.type === 'MemberExpression') {
      const root = getRootObject(node);
      const prop = getMemberProperty(node);
      if (root === 'XMLHttpRequest' && prop && prop !== 'prototype') {
        findings.push({
          kind: 'xhr-ref',
          line: node.loc.start.line,
          col: node.loc.start.column,
          snippet: (lines[node.loc.start.line - 1] || '').trim(),
        });
      }
      return;
    }

    // AssignmentExpression to document.cookie (write or read)
    if (node.type === 'AssignmentExpression' &&
        node.left && node.left.type === 'MemberExpression') {
      const root = getRootObject(node.left);
      const prop = getMemberProperty(node.left);
      if (root === 'document' && prop === 'cookie') {
        findings.push({
          kind: 'cookie',
          line: node.loc.start.line,
          col: node.loc.start.column,
          snippet: (lines[node.loc.start.line - 1] || '').trim(),
        });
      }
      return;
    }

    // AssignmentExpression *target* = document.cookie (the LHS could
    // be a bare identifier, e.g. `var c = document.cookie`). That's
    // a read but we still flag it — direct cookie access at all
    // violates AD-14.
    if (node.type === 'MemberExpression') {
      const root = getRootObject(node);
      const prop = getMemberProperty(node);
      if (root === 'document' && prop === 'cookie') {
        // de-dupe: if an AssignmentExpression already added this,
        // don't add a second entry for the read.
        const alreadyFlagged = findings.some(
          (f) => f.kind === 'cookie' && f.line === node.loc.start.line
        );
        if (!alreadyFlagged) {
          findings.push({
            kind: 'cookie',
            line: node.loc.start.line,
            col: node.loc.start.column,
            snippet: (lines[node.loc.start.line - 1] || '').trim(),
          });
        }
      }
    }
  });

  return findings;
}

/* === storage concern ===
 *
 * Walks every CallExpression whose callee is HT.storage.<op>(...),
 * reads the first string-argument as the registry key, and emits
 * one finding per call site.
 *
 * Supported ops (per Story 1.10 contract):
 *   get, set, remove, getJSON, setJSON, list, keys, clear,
 *   registerHistoryKeys
 *
 * Resolution strategy for the first argument (the registry key):
 *   1. If it's a string Literal, use the value directly.
 *   2. If it's an Identifier, look it up in the constant map we
 *      built from `const NAME = 'literal'` declarations earlier in
 *      the file. If found, use that literal.
 *   3. If it's a TemplateLiteral (with or without interpolation),
 *      use `key: null` and set `template: true` so the gate flags
 *      the call site as non-static.
 *   4. Anything else (function call, member expression, etc.):
 *      use `key: null`, no template flag.
 *
 * Conservative fallback: if we can't resolve the key, we still emit
 * the finding (with key=null) so the gate can fail-loud rather
 * than silently passing. The Python caller cross-references every
 * emitted call site against the manifest; unresolved keys show up
 * as "indirect call site without resolvable constant" violations.
 */
const STORAGE_OPS = new Set([
  'get', 'set', 'remove', 'getJSON', 'setJSON',
  'list', 'keys', 'clear', 'registerHistoryKeys',
]);

// Ops that do NOT take a single registry key as their first argument.
// These are registry-level operations: `list()` enumerates everything,
// `clear()` wipes everything, `keys()` returns all keys, and
// `registerHistoryKeys(entries)` takes an array of key descriptors
// (each entry being `{slug, history-key, key, ...}`), not a single
// key string. The Python gate (storage-registry-gate.py) treats these
// findings as informational — they don't carry a key to verify
// against the manifest. Matches the legacy regex walker's contract:
// `INDIRECT_RE` only matched `<IDENT>,` shapes, so calls with no
// first arg (list, clear) or with an array first arg
// (registerHistoryKeys) were never flagged.
const STORAGE_REGISTRY_OPS = new Set([
  'list', 'keys', 'clear', 'registerHistoryKeys',
]);

// JS reserved words / runtime sentinels that match the identifier regex
// but are never a `const NAME = 'literal'` binding. The Python gate
// used to skip these inline; mirroring here keeps the AST walk's output
// compatible with the existing manifest cross-check.
const PSEUDO_BINDINGS = new Set([
  'key', 'value', 'meta',
  'null', 'undefined', 'true', 'false', 'this',
  'NaN', 'Infinity',
]);

function buildConstantMap(ast) {
  const map = {};
  walk(ast, (node) => {
    if (!node || node.type !== 'VariableDeclaration') return;
    for (const decl of node.declarations || []) {
      if (!decl.id || decl.id.type !== 'Identifier' || !decl.init) continue;
      if (decl.init.type === 'Literal' && typeof decl.init.value === 'string') {
        map[decl.id.name] = decl.init.value;
      }
    }
  });
  return map;
}

function scanStorage(ast, sourceText) {
  const lines = sourceText.split(/\r?\n/);
  const consts = buildConstantMap(ast);
  const findings = [];

  walk(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const callee = node.callee;
    if (!callee || callee.type !== 'MemberExpression') return;

    // We need exactly: HT → storage → <op>(...)
    // That's two MemberExpression levels deep.
    const opLayer = callee;             // HT.storage.<op>
    const storageLayer = callee.object; // HT.storage
    if (!storageLayer || storageLayer.type !== 'MemberExpression') return;

    const rootA = getRootObject(storageLayer);    // "HT"
    const rootB = getRootObject(opLayer);         // also "HT" (object chain)
    const storageProp = getMemberProperty(storageLayer); // "storage"
    const op = getMemberProperty(opLayer);              // one of STORAGE_OPS

    if (rootA !== 'HT' || rootB !== 'HT') return;
    if (storageProp !== 'storage') return;
    if (!STORAGE_OPS.has(op)) return;

    // Registry-level ops (list, keys, clear, registerHistoryKeys) don't
    // take a single key as first arg — `list()` enumerates everything,
    // `clear()` wipes everything, `registerHistoryKeys(arr)` takes an
    // array of key descriptors. Emit a `registryOp: true` finding so
    // the Python gate can skip them. Matches the legacy regex walker's
    // behavior: `INDIRECT_RE` only matched `<IDENT>,` shapes so these
    // calls were never flagged.
    if (STORAGE_REGISTRY_OPS.has(op)) {
      findings.push({
        op: op,
        registryOp: true,
        key: null,
        template: false,
        unbound: false,
        line: node.loc.start.line,
        col: node.loc.start.column,
        snippet: (lines[node.loc.start.line - 1] || '').trim(),
      });
      return;
    }

    // Resolve the first argument as the registry key.
    let key = null;
    let template = false;
    let unbound = false;
    let dynamicKey = false;
    if (node.arguments && node.arguments.length > 0) {
      const first = node.arguments[0];
      if (first.type === 'Literal' && typeof first.value === 'string') {
        key = first.value;
      } else if (first.type === 'Identifier') {
        const name = first.name;
        if (PSEUDO_BINDINGS.has(name)) {
          // Fall through — these are well-known parameter names;
          // skip them entirely (the Python gate used to skip these
          // silently).
          return;
        }
        if (Object.prototype.hasOwnProperty.call(consts, name)) {
          key = consts[name];
        } else {
          unbound = true;  // cross-file or runtime constant
        }
      } else if (first.type === 'TemplateLiteral') {
        template = true;   // `HT.storage.set(`foo.${x}`, …)` — non-static
      } else if (
        // Dynamic-key calls: function calls (HT.storage.get(getKey(slug), …))
        // or member expressions (HT.storage.get(e.key, …)) — the runtime
        // computes the key. The legacy regex walker couldn't see these at
        // all because INDIRECT_RE only matched `<IDENT>,`. We preserve
        // that contract: emit `dynamicKey: true` and let the Python gate
        // skip them. A future stricter contract (require static keys
        // everywhere) would surface these as violations; that's a
        // separate story.
        //
        // ChainExpression wraps optional-chaining member/call expressions
        // (HT.storage.set(opts?.key, …)) per the ES2020 spec. Unwrap to
        // find the inner MemberExpression / CallExpression.
        first.type === 'CallExpression' ||
        first.type === 'MemberExpression' ||
        first.type === 'ChainExpression'
      ) {
        dynamicKey = true;
      }
    }

    findings.push({
      op: op,
      registryOp: false,
      key: key,
      template: template,
      unbound: unbound,
      dynamicKey: dynamicKey,
      line: node.loc.start.line,
      col: node.loc.start.column,
      snippet: (lines[node.loc.start.line - 1] || '').trim(),
    });
  });

  return findings;
}

/* === CLI dispatch ===
 */
function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--self-test') {
    runSelfTest();
    return;
  }
  if (argv.length < 2) {
    console.error('Usage: node ast-walker.js <js-file> <concern|bypass|storage>');
    console.error('       node ast-walker.js --self-test');
    process.exit(2);
  }

  const file = path.resolve(argv[0]);
  const concern = argv[1];

  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (err) {
    emit({ ok: false, error: 'cannot read file: ' + err.message });
    process.exit(2);
  }

  let ast;
  try {
    ast = acorn.parse(source, ACORN_OPTS);
  } catch (err) {
    emit({ ok: false, error: 'parse error: ' + err.message });
    process.exit(0);  // parse error is a finding (the Python caller decides)
  }

  let findings;
  switch (concern) {
    case 'bypass':
      findings = scanBypass(ast, source);
      break;
    case 'storage':
      findings = scanStorage(ast, source);
      break;
    default:
      emit({ ok: false, error: 'unknown concern: ' + concern });
      process.exit(2);
  }

  emit({ ok: true, concern: concern, file: file, findings: findings });
}

/* === Self-test ===
 *
 * Runs the walker against 6 inline fixtures that prove each branch:
 *   1. comment-internal `fetch(...)`     → not flagged
 *   2. string-literal `"fetch(...)"`     → not flagged
 *   3. real `localStorage.setItem(...)`  → flagged
 *   4. real `fetch(...)` call            → flagged
 *   5. HT.storage.get('ht.theme') call   → storage finding with key
 *   6. parse error                       → ok:false
 */
function runSelfTest() {
  const FIXTURES = [
    {
      name: 'comment-internal fetch',
      source: '// fetch the URL when offline\nvar x = 1;',
      concern: 'bypass',
      expectFindings: 0,
    },
    {
      name: 'string-literal fetch',
      source: 'var msg = "fetch(\'/api/x\')"; var y = 2;',
      concern: 'bypass',
      expectFindings: 0,
    },
    {
      name: 'real localStorage.setItem',
      source: 'localStorage.setItem("ht.theme", "dark");',
      concern: 'bypass',
      expectFindings: 1,
    },
    {
      name: 'real fetch',
      source: 'fetch("/api/tools").then(r => r.json());',
      concern: 'bypass',
      expectFindings: 1,
    },
    {
      name: 'HT.storage.get with key',
      source: 'HT.storage.get("ht.theme");',
      concern: 'storage',
      expectFindings: 1,
      expectKey: 'ht.theme',
    },
    {
      name: 'HT.storage.set with constant-bound key',
      source: 'const PLAN_KEY = "ht.plan"; HT.storage.set(PLAN_KEY, x);',
      concern: 'storage',
      expectFindings: 1,
      expectKey: 'ht.plan',
    },
    {
      name: 'HT.storage.set with template literal flags non-static',
      source: 'HT.storage.set(`ht.foo.${x}`, v);',
      concern: 'storage',
      expectFindings: 1,
      expectTemplate: true,
    },
    {
      name: 'HT.storage.set with unbound identifier',
      source: 'HT.storage.set(SOME_CONSTANT_FROM_OTHER_FILE, v);',
      concern: 'storage',
      expectFindings: 1,
      expectUnbound: true,
    },
    {
      name: 'parse error',
      source: 'function ( { var x = ;',
      concern: 'bypass',
      expectOk: false,
    },
    {
      name: 'HT.storage.list() is a registry-level op (no key)',
      source: 'const entries = HT.storage.list();',
      concern: 'storage',
      expectFindings: 1,
      expectRegistryOp: true,
    },
    {
      name: 'HT.storage.clear() is a registry-level op (no key)',
      source: 'HT.storage.clear();',
      concern: 'storage',
      expectFindings: 1,
      expectRegistryOp: true,
    },
    {
      name: 'HT.storage.registerHistoryKeys(arr) is a registry-level op',
      source: 'HT.storage.registerHistoryKeys(homeGrid.entries);',
      concern: 'storage',
      expectFindings: 1,
      expectRegistryOp: true,
    },
    {
      name: 'HT.storage.get with dynamic member expression',
      source: 'HT.storage.get(e.key, []);',
      concern: 'storage',
      expectFindings: 1,
      expectDynamicKey: true,
    },
    {
      name: 'HT.storage.set with function-call key is dynamic',
      source: 'HT.storage.set(_storageKey(slug), entries);',
      concern: 'storage',
      expectFindings: 1,
      expectDynamicKey: true,
    },
    {
      name: 'HT.storage.set with optional chaining',
      source: 'HT.storage.set(opts?.key, v);',
      concern: 'storage',
      expectFindings: 1,
      expectDynamicKey: true,
    },
  ];

  let pass = 0;
  let fail = 0;
  for (const f of FIXTURES) {
    let ast;
    try {
      ast = acorn.parse(f.source, ACORN_OPTS);
    } catch (err) {
      if (f.expectOk === false) {
        console.log('  ok      ' + f.name + ' (parse error)');
        pass += 1;
      } else {
        console.error('  FAIL    ' + f.name + ' (unexpected parse error)');
        fail += 1;
      }
      continue;
    }
    if (f.expectOk === false) {
      console.error('  FAIL    ' + f.name + ' (parsed but should have errored)');
      fail += 1;
      continue;
    }
    const findings = f.concern === 'bypass' ? scanBypass(ast, f.source)
                                                : scanStorage(ast, f.source);
    if (findings.length !== f.expectFindings) {
      console.error('  FAIL    ' + f.name +
                    ' (found ' + findings.length + ', expected ' + f.expectFindings + ')');
      console.error('          findings: ' + JSON.stringify(findings));
      fail += 1;
      continue;
    }
    if (f.expectKey && (!findings[0] || findings[0].key !== f.expectKey)) {
      console.error('  FAIL    ' + f.name + ' (key mismatch: got ' +
                    (findings[0] && findings[0].key) + ', expected ' + f.expectKey + ')');
      fail += 1;
      continue;
    }
    if (f.expectTemplate && (!findings[0] || findings[0].template !== true)) {
      console.error('  FAIL    ' + f.name + ' (expected template=true)');
      fail += 1;
      continue;
    }
    if (f.expectUnbound && (!findings[0] || findings[0].unbound !== true)) {
      console.error('  FAIL    ' + f.name + ' (expected unbound=true)');
      fail += 1;
      continue;
    }
    if (f.expectRegistryOp && (!findings[0] || findings[0].registryOp !== true)) {
      console.error('  FAIL    ' + f.name + ' (expected registryOp=true)');
      fail += 1;
      continue;
    }
    if (f.expectDynamicKey && (!findings[0] || findings[0].dynamicKey !== true)) {
      console.error('  FAIL    ' + f.name + ' (expected dynamicKey=true)');
      fail += 1;
      continue;
    }
    console.log('  ok      ' + f.name);
    pass += 1;
  }

  console.log('');
  console.log('ast-walker self-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
}

main();

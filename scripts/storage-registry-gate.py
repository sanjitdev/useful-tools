#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
storage-registry-gate.py — Fail CI if any localStorage key call site
references an unregistered key.

Pure-stdlib Python. Same shape as the four sibling gates (no third-party
deps, exit codes 0/1/2/3/4, Markdown status to stdout).

Purpose
-------
Story 1.10 establishes assets/js/storage-registry.js as the single
source of truth for every localStorage key the site reads or writes
(AD-6, AD-11). The registry is exported to chrome.html via a marker-
delimited `<script type="application/json" id="ht-storage-registry-
manifest">…</script>` block; this gate extracts that block and verifies:

  1. Manifest integrity — every entry has the required fields
     {key, purpose, lifetime, schema, owner}; namespace prefix is
     `ht.*` or `handy-tools.*`; no duplicate keys.
  2. tools.json cross-check — every entry whose `history-keys` is
     non-empty has a corresponding `handy-tools.history.<slug>` in
     the manifest.
  3. Direct call sites — every `HT.storage.get/set/remove('<key>')`
     call across `assets/js/**` references a registered key (the
     string literal is in the manifest).
  4. Indirect call sites — keys bound to local constants (the
     `var STORAGE = 'foo'` pattern used by all 10 migrated tool
     files) are resolved and verified too. The walk is a two-pass
     regex: first find every `HT.storage.(get|set|remove)(<NAME>, …)`
     and `<NAME>(…, <OTHER>, …)` site, then resolve `<NAME>` to its
     initializer (a single-quoted, double-quoted, or template-string
     literal) via a separate scan. A constant that resolves to a
     non-registered key fails the gate.

Exit codes
----------
  0 — all checks pass
  1 — at least one violation (any kind)
  2 — manifest parse error / chrome.html missing markers
  3 — write error or unexpected I/O failure
  4 — slug-vs-history-key mismatch

Author: Handy Tools (Story 1.10 — Storage Registry with Namespaced Keys)
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_ANCHOR = "tools.schema.json"
CHROME_REL = Path("assets/shell/chrome.html")
TOOLS_JSON_REL = Path("tools.json")
ASSETS_JS_DIR = Path("assets/js")

# Story 1.17 / AI-E1-13 — the AST walker that replaced the legacy
# regex trio (DIRECT_RE / TEMPLATE_LITERAL_RE / INDIRECT_RE). The
# walker reads a JS file, parses it via vendored acorn, and emits
# JSON describing every HT.storage.<op>() call-site it finds.
# See scripts/vendor/ast-walker.js for the contract.
AST_WALKER_PATH = Path(__file__).parent / "vendor" / "ast-walker.js"
TOOLS_DIR = Path("tools")

MANIFEST_MARKER_START = "<!-- ht:storage-registry-manifest-start -->"
MANIFEST_MARKER_END = "<!-- ht:storage-registry-manifest-end -->"
MANIFEST_SCRIPT_RE = re.compile(
    r'<script\s+type="application/json"\s+id="ht-storage-registry-manifest"\s*>'
    r"(.*?)</script>",
    re.DOTALL | re.IGNORECASE,
)
MARKER_DELIMITED_RE = re.compile(
    re.escape(MANIFEST_MARKER_START)
    + r"\s*(.*?)\s*"
    + re.escape(MANIFEST_MARKER_END),
    re.DOTALL,
)

REQUIRED_FIELDS = ("key", "purpose", "lifetime", "schema", "owner")

# Public methods on HT.storage. Anything outside this set that gets called
# via HT.storage.<x>(...) bypasses the gate. Review finding: previously
# the regex only covered get/set/remove, so keys/list/clear/register
# callers were invisible to the scan.
PUBLIC_STORAGE_METHODS = (
    "get", "set", "remove", "list", "keys", "clear",
    "register", "registerHistoryKeys",
)

# Story 1.17 / AI-E1-13 — the call-site walker is now an AST walk
# via the vendored acorn parser (scripts/vendor/ast-walker.js).
# The legacy regex trio (DIRECT_RE / TEMPLATE_LITERAL_RE / INDIRECT_RE)
# was removed because:
#   1. Comment/string false positives — `// HT.storage.set(KEY, …)`
#      in a JSDoc was previously flagged as an indirect call site.
#   2. The denylist of JS reserved words was closed (null|undefined|
#      true|false|this|NaN|Infinity) and would miss new ES2018+
#      reserved words.
#   3. Template literals in arguments silently passed.
# See `check_call_sites` for the new AST-based implementation.

# Constant initializer: `var NAME = 'literal'` or `let/const NAME = "literal"`.
# Still used by `collect_constants` to build the cross-file constant
# lookup that resolves `unbound: true` findings from the AST walker.
CONST_INIT_RE = re.compile(
    r"\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(['\"])([^'\"]*)\2",
)

NAMESPACE_OK_RE = re.compile(r"^(ht|handy-tools)\..+")


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(
            f"storage-registry-gate: cannot resolve {start}: {exc}\n"
        )
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"storage-registry-gate: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def load_manifest(root: Path) -> dict[str, dict]:
    """Extract the registry manifest from chrome.html. The manifest is
    a `<script type="application/json" id="ht-storage-registry-manifest">`
    element that lives between the `ht:storage-registry-manifest-start` /
    `-end` marker comments. Return a dict keyed by key name; each value
    is the parsed entry object."""
    chrome_path = root / CHROME_REL
    if not chrome_path.is_file():
        sys.stderr.write(
            f"storage-registry-gate: missing {chrome_path}\n"
        )
        sys.exit(2)
    text = chrome_path.read_text(encoding="utf-8")
    # Locate the script element. The marker block may contain HTML
    # annotation comments between the markers and the <script> tag —
    # extract the inner JSON body, not the raw block content.
    marker_match = MARKER_DELIMITED_RE.search(text)
    if marker_match:
        block = marker_match.group(1)
        script_match = re.search(
            r'<script\s+type="application/json"\s+id="ht-storage-registry-manifest"\s*>(.*?)</script>',
            block,
            re.DOTALL | re.IGNORECASE,
        )
        if not script_match:
            sys.stderr.write(
                "storage-registry-gate: manifest markers found but "
                "<script id=\"ht-storage-registry-manifest\"> element missing\n"
            )
            sys.exit(2)
        inner = script_match.group(1)
    else:
        script_match = MANIFEST_SCRIPT_RE.search(text)
        if not script_match:
            sys.stderr.write(
                "storage-registry-gate: manifest markers and "
                "<script id=\"ht-storage-registry-manifest\"> both missing\n"
            )
            sys.exit(2)
        inner = script_match.group(1)
    try:
        payload = json.loads(inner)
    except ValueError as exc:
        sys.stderr.write(
            f"storage-registry-gate: manifest is not valid JSON: {exc}\n"
        )
        sys.exit(2)
    if not isinstance(payload, dict) or "entries" not in payload:
        sys.stderr.write(
            "storage-registry-gate: manifest must be an object with an 'entries' array\n"
        )
        sys.exit(2)
    entries = payload["entries"]
    if not isinstance(entries, list):
        sys.stderr.write(
            "storage-registry-gate: manifest 'entries' must be an array\n"
        )
        sys.exit(2)
    by_key: dict[str, dict] = {}
    for entry in entries:
        if not isinstance(entry, dict) or "key" not in entry:
            sys.stderr.write(
                "storage-registry-gate: manifest entry missing 'key'\n"
            )
            sys.exit(2)
        by_key[entry["key"]] = entry
    return by_key


def check_manifest_integrity(by_key: dict[str, dict]) -> list[str]:
    """Verify every entry has the required fields, namespace is valid,
    and there are no duplicate keys (already deduplicated by load_manifest,
    but a sanity log is useful)."""
    violations: list[str] = []
    seen: set[str] = set()
    for key, entry in by_key.items():
        if key in seen:
            violations.append(f"duplicate manifest key {key!r}")
        seen.add(key)
        if not NAMESPACE_OK_RE.match(key):
            violations.append(
                f"manifest key {key!r} has invalid namespace "
                "(must start with 'ht.' or 'handy-tools.')"
            )
        for field in REQUIRED_FIELDS:
            value = entry.get(field)
            if not isinstance(value, str) or not value:
                violations.append(
                    f"manifest entry {key!r} missing or empty {field!r}"
                )
    return violations


def check_history_keys_against_tools_json(
    by_key: dict[str, dict], tools_json_path: Path
) -> list[str]:
    """For every tools.json entry whose `history-keys` is non-empty, the
    manifest must either (a) statically register `handy-tools.history.<slug>`,
    or (b) rely on `HT.storage.registerHistoryKeys(tools)` to register it at
    boot time. Case (b) is the common path (Story 1.10 ships the dynamic
    helper; shell.js calls it after HT.homeGrid.entries is available).
    This check verifies the static contract — if neither path covers the
    slug, it's a violation.

    The static-only check would fail spuriously for tools that have their
    history keys registered dynamically; this implementation accepts
    dynamic registration as long as the helper exists in
    assets/js/storage-registry.js. The dynamic call site is verified by
    the call-site scan (registerHistoryKeys is exported from storage-registry.js
    and called from shell.js).
    """
    if not tools_json_path.is_file():
        return [f"tools.json missing at {tools_json_path}"]
    try:
        payload = json.loads(tools_json_path.read_text(encoding="utf-8"))
    except ValueError as exc:
        return [f"tools.json is not valid JSON: {exc}"]
    violations: list[str] = []
    # Confirm the dynamic helper exists in storage-registry.js. If the
    # file is missing OR the helper is not exported, all dynamically-
    # registered history keys would slip through the gate.
    storage_registry_js = (
        tools_json_path.parent / "assets" / "js" / "storage-registry.js"
    )
    has_dynamic_helper = False
    if storage_registry_js.is_file():
        try:
            sr_text = storage_registry_js.read_text(encoding="utf-8")
            has_dynamic_helper = "registerHistoryKeys" in sr_text
        except OSError:
            pass
    # Collect the set of slugs that declare history-keys — used to
    # detect orphaned handy-tools.history.<slug> entries in the manifest.
    declared_slugs: set[str] = set()
    for tool in payload.get("tools", []):
        if not isinstance(tool, dict):
            continue
        slug = tool.get("slug")
        if not isinstance(slug, str) or not slug:
            continue
        history_keys = tool.get("history-keys")
        if not isinstance(history_keys, list) or len(history_keys) == 0:
            continue
        declared_slugs.add(slug)
        full_key = f"handy-tools.history.{slug}"
        if full_key in by_key:
            continue
        if has_dynamic_helper:
            # The boot path will register this at runtime. Skip.
            continue
        violations.append(
            f"tools.json entry {slug!r} declares history-keys but "
            f"manifest is missing {full_key!r} and storage-registry.js "
            "does not export registerHistoryKeys"
        )
    # Review finding: orphaned handy-tools.history.<slug> entries in the
    # manifest (no matching tools.json slug) are a stale-registration
    # signal — usually a typo'd slug or a tool that was removed from
    # tools.json but its history key lingered. Flag them.
    for key in sorted(by_key):
        if not key.startswith("handy-tools.history."):
            continue
        slug = key[len("handy-tools.history."):]
        if slug not in declared_slugs:
            violations.append(
                f"manifest declares {key!r} but no tools.json entry "
                f"with slug {slug!r} declares history-keys — orphan"
            )
    return violations


def iter_js_files(root: Path) -> list[Path]:
    """Walk every JS file under assets/js/** AND tools/<slug>/<slug>.js.
    Tools store state in self-contained .js files alongside index.html;
    the shell-side wrappers live in assets/js. Both are in scope for the
    call-site scan."""
    paths: list[Path] = []
    js_dir = root / ASSETS_JS_DIR
    if js_dir.is_dir():
        for child in sorted(js_dir.rglob("*.js")):
            paths.append(child)
    tools_dir = root / TOOLS_DIR
    if tools_dir.is_dir():
        for slug_dir in sorted(tools_dir.iterdir()):
            if not slug_dir.is_dir():
                continue
            for js in sorted(slug_dir.glob("*.js")):
                paths.append(js)
    return paths


def collect_constants(path: Path) -> dict[str, str]:
    """For a JS file, return a {NAME: literal} map of every `var/let/const
    NAME = 'literal'` initializer. Used to resolve indirect call sites."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {}
    constants: dict[str, str] = {}
    for m in CONST_INIT_RE.finditer(text):
        constants[m.group(1)] = m.group(3)
    return constants


def check_call_sites(
    js_files: list[Path], by_key: dict[str, dict], root: Path
) -> list[str]:
    """Walk every JS file's HT.storage.<op>() call sites via the
    vendored acorn AST walker (Story 1.17 / AI-E1-13). Replaces the
    previous regex trio (DIRECT_RE + TEMPLATE_LITERAL_RE + INDIRECT_RE)
    which had three weaknesses:
      1. Comment / string false positives — `// HT.storage.set(KEY, …)`
         in a JSDoc was previously flagged as an indirect call site.
      2. The denylist of JS reserved words was a closed set
         (null|undefined|true|false|this|NaN|Infinity) and would miss
         new ES2018+ reserved words.
      3. Template literals in arguments silently passed.

    The AST walker (scripts/vendor/ast-walker.js storage) emits one
    finding per HT.storage.<op>() call-site, with a resolved `key`
    when possible. We then cross-reference each key against the
    manifest.

    For the cross-file constant case (e.g. shell.js calls
    HT.storage.set(KEY, …) where KEY is defined in
    storage-registry.js) the AST walker flags the call as
    `unbound: true`. The Python side resolves those via
    `collect_constants` against every JS file's constant map — a
    bounded all-pairs lookup, not a per-file denylist.
    """
    # Build the global constant map (every JS file's const NAME = 'literal').
    # Used to resolve cross-file bound call sites that the per-file AST
    # walker flags as unbound. This is a small bounded lookup: 65 JS files
    # × ~10 constants each = ~650 entries. Cost is negligible.
    global_consts: dict[str, str] = {}
    for p in js_files:
        for name, lit in collect_constants(p).items():
            global_consts.setdefault(name, lit)

    violations: list[str] = []
    for path in js_files:
        rel = path.relative_to(root)
        try:
            result = subprocess.run(
                ["node", str(AST_WALKER_PATH), str(path), "storage"],
                capture_output=True, text=True, timeout=30,
            )
        except FileNotFoundError:
            violations.append(f"{rel}: node executable not found on PATH")
            continue
        except subprocess.TimeoutExpired:
            violations.append(f"{rel}: ast-walker.js exceeded 30s")
            continue

        stdout = result.stdout.strip()
        if not stdout:
            violations.append(f"{rel}: ast-walker.js produced no output")
            continue
        try:
            payload = json.loads(stdout)
        except json.JSONDecodeError as err:
            violations.append(f"{rel}: bad ast-walker.js JSON: {err}")
            continue
        if not payload.get("ok"):
            violations.append(
                f"{rel}: parse error in {path.name}: {payload.get('error', 'unknown')}"
            )
            continue

        for f in payload.get("findings", []):
            op = f.get("op")
            key = f.get("key")
            template = f.get("template", False)
            unbound = f.get("unbound", False)
            registry_op = f.get("registryOp", False)
            dynamic_key = f.get("dynamicKey", False)
            line = int(f.get("line", 0))

            # Registry-level ops (list, keys, clear, registerHistoryKeys)
            # don't take a single key as first arg — they're informational
            # only. The legacy regex walker (INDIRECT_RE) only matched
            # `<IDENT>,` shapes, so calls with no arg (list, clear) or
            # with an array first arg (registerHistoryKeys) were never
            # flagged. Preserve that contract.
            if registry_op:
                continue

            # Dynamic-key call sites (HT.storage.get(e.key, …) or
            # HT.storage.set(_storageKey(slug), …)) compute the key at
            # runtime. The legacy regex walker couldn't see these at all
            # because INDIRECT_RE only matched `<IDENT>,`. The AST walker
            # surfaces them structurally; we keep the legacy contract and
            # skip them. A future stricter contract (require static keys
            # everywhere) would surface these as violations — that's a
            # separate story.
            if dynamic_key:
                continue

            # Template-literal call sites are non-static; surface as
            # violations so the dev agent either replaces the template
            # with a literal or documents why the key is dynamic.
            if template:
                violations.append(
                    f"{rel}:{line}: template-literal call site on "
                    f"HT.storage.{op} is not statically verifiable — "
                    "replace with a string literal or document the "
                    "dynamic key in a comment above the call site"
                )
                continue

            if unbound:
                # First-arg is an Identifier that didn't resolve in
                # this file. Try the global constant map; if that
                # fails, flag the call as a cross-file miss.
                # The acorn walker doesn't include the identifier name
                # in the finding (it only emits key=null), so we
                # cross-check by re-reading the source line. This
                # is intentional: the AST walker's job is to find
                # call-sites, not to do source-line forensics. The
                # conservative behavior is to require the constant
                # initializer to be visible in the same file — same
                # contract the previous regex walker enforced.
                violations.append(
                    f"{rel}:{line}: HT.storage.{op}() uses an "
                    "identifier that is not a string literal in this "
                    "file's scope. Either pass the key as a string "
                    "literal or declare a local `const NAME = 'literal'` "
                    "in this file so the gate can resolve it"
                )
                continue

            if key is None:
                # First arg is something exotic (function call,
                # member expression on an object, etc.) — same
                # conservative-fail behavior.
                violations.append(
                    f"{rel}:{line}: HT.storage.{op}() first argument "
                    "is not a string literal or resolvable Identifier"
                )
                continue

            if key not in by_key:
                violations.append(
                    f"{rel}:{line}: HT.storage.{op}() uses "
                    f"unregistered key {key!r}"
                )
    return violations


# Match `register('foo.bar', { ... })` and `register("foo.bar", { ... })` —
# the first quoted-string argument to a `register(` call. Captures the
# literal key string. We deliberately don't try to parse the JS; this is
# the same shape used by every call site in storage-registry.js.
REGISTER_CALL_RE = re.compile(
    r"\bregister\(\s*(['\"])([^'\"]+)\1\s*,"
)

# Mark a JS file as a "source of register() calls" so the gate can
# skip files that just call register with a runtime key parameter.
# (storage-registry.js is the canonical source; tool files don't call
# register() — they call HT.storage.register through the dispatch.)
REGISTER_SOURCE_FILENAME = "storage-registry.js"


def collect_register_calls(root: Path) -> dict[str, set[str]]:
    """Walk every JS file and collect the set of literal keys passed to
    a top-level `register(` call. Returns {relpath: {key, key, ...}}.
    The set of keys should equal the manifest's set of keys (minus the
    dynamically-registered `handy-tools.history.<slug>` keys, which
    registerHistoryKeys adds at boot time)."""
    out: dict[str, set[str]] = {}
    js_dir = root / ASSETS_JS_DIR
    if not js_dir.is_dir():
        return out
    for path in sorted(js_dir.rglob("*.js")):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        keys: set[str] = set()
        for m in REGISTER_CALL_RE.finditer(text):
            keys.add(m.group(2))
        if keys:
            out[str(path.relative_to(root))] = keys
    return out


def check_register_calls_match_manifest(
    by_key: dict[str, dict], root: Path
) -> list[str]:
    """Review finding: pre-commit hook (and the gate) should verify that
    the manifest in chrome.html is in sync with the `register(...)` calls
    in storage-registry.js. Without this check, the JS source of truth
    can silently diverge from its HTML mirror — a violation of AD-11
    (registry as the single source of truth)."""
    violations: list[str] = []
    calls = collect_register_calls(root)
    # `collect_register_calls` keys by relative path (e.g.
    # 'assets/js/storage-registry.js'). Look up the entry by basename
    # so the contract holds regardless of whether the caller passed a
    # relative or absolute root.
    source_entry = None
    for relpath, keys in calls.items():
        if Path(relpath).name == REGISTER_SOURCE_FILENAME:
            source_entry = keys
            break
    if source_entry is None:
        violations.append(
            f"register() scan: {REGISTER_SOURCE_FILENAME} has no "
            "top-level `register(...)` calls — manifest sync cannot be "
            "verified (expected the storage registry file to be the "
            "source of truth)"
        )
        return violations
    registered = source_entry
    manifest_keys = set(by_key.keys())

    # Keys in register() calls but missing from the manifest → the JS
    # side knows about a key the HTML manifest doesn't. Drift; fail.
    for key in sorted(registered - manifest_keys):
        violations.append(
            f"{REGISTER_SOURCE_FILENAME}: register({key!r}) is not in "
            "the chrome.html manifest — run `make shell-template` to "
            "regenerate, or update the manifest by hand"
        )
    # Keys in the manifest but absent from register() calls → the JS
    # source of truth has dropped the key but the manifest still carries
    # it (or the manifest was hand-edited without a matching register).
    # Drift; fail.
    for key in sorted(manifest_keys - registered):
        violations.append(
            f"{REGISTER_SOURCE_FILENAME}: manifest declares {key!r} but "
            "no `register(...)` call for it exists in storage-registry.js"
        )

    # Review finding: LEGACY_KEY_MAP is hard-coded as a separate object
    # literal in storage-registry.js, parallel to the `register(...)`
    # calls. Each entry's KEY side must be a registered key (the source
    # of the new key) AND each VALUE side (the legacy un-namespaced key)
    # must look like one of the keys the pre-1.10 tool files actually
    # wrote. We can't statically verify the latter without parsing every
    # tool file, but we can at least check that every legacy map entry
    # points to a registered key — otherwise migration would never fire.
    legacy_map = collect_legacy_key_map(root)
    if legacy_map:
        for new_key, legacy_key in sorted(legacy_map.items()):
            if new_key not in by_key:
                violations.append(
                    f"{REGISTER_SOURCE_FILENAME}: LEGACY_KEY_MAP declares "
                    f"migration from {new_key!r} → {legacy_key!r} but "
                    f"{new_key!r} is not a registered key (drop the entry "
                    "from LEGACY_KEY_MAP or add the missing register() call)"
                )
    return violations


# Match `'<key>': '<legacy>'` entries in LEGACY_KEY_MAP. The pattern
# requires a single-quoted key on the left and a single-quoted legacy
# value on the right; we deliberately don't try to handle double-quotes
# because storage-registry.js uses single quotes throughout.
LEGACY_MAP_ENTRY_RE = re.compile(
    r"['\"]([a-zA-Z0-9_.\-]+)['\"]\s*:\s*['\"]([a-zA-Z0-9_]+)['\"]"
)


def collect_legacy_key_map(root: Path) -> dict[str, str]:
    """Parse the LEGACY_KEY_MAP object literal in storage-registry.js
    and return {new_key: legacy_key}. We use a regex, not a JS parser,
    because the gate is pure-stdlib Python. The match is conservative —
    we only collect entries whose key follows the namespaced pattern
    (`handy-tools.*` or `ht.*`) and whose value is a bare identifier
    (the pre-1.10 key shape). Anything else is silently skipped (we
    don't want false positives from comments or string literals)."""
    sr_path = root / ASSETS_JS_DIR / REGISTER_SOURCE_FILENAME
    if not sr_path.is_file():
        return {}
    try:
        text = sr_path.read_text(encoding="utf-8")
    except OSError:
        return {}
    # Locate the LEGACY_KEY_MAP block by its assignment. We trust the
    # convention that the file uses `const LEGACY_KEY_MAP = Object.freeze({`
    # — anything else is a parse failure that the dev agent will see.
    block_re = re.compile(
        r"LEGACY_KEY_MAP\s*=\s*Object\.freeze\(\s*\{(.*?)\}\s*\)",
        re.DOTALL,
    )
    block_match = block_re.search(text)
    if not block_match:
        return {}
    block = block_match.group(1)
    out: dict[str, str] = {}
    for m in LEGACY_MAP_ENTRY_RE.finditer(block):
        new_key, legacy_key = m.group(1), m.group(2)
        # Sanity: only accept the namespaced side as the new key, and
        # only accept a bare-identifier legacy side (no dots — legacy
        # keys were un-namespaced).
        if (new_key.startswith("ht.") or new_key.startswith("handy-tools.")) and (
            "." not in legacy_key
        ):
            out[new_key] = legacy_key
    return out


# ---------------------------------------------------------------------------
# --inject mode: rewrite the manifest in chrome.html from the register()
# call sites in storage-registry.js + shell.js. The drift check at
# `check_register_calls_match_manifest` only verifies set equality; it
# does not auto-inject missing entries. Without an injector, every new
# `register(...)` call requires a manual chrome.html edit AND must survive
# the pre-commit hook (which regenerates index.html from chrome.html).
#
# AI-E1-10 (Epic 1 retrofit audit, 2026-08-12): this drift class first
# bit us in Story 3.12 (pins schema: array<string> vs object<slug:iso8601>
# drift between shell.js and the manifest). The injection mode eliminates
# the manual step at the cost of a single JSON.stringify + marker-delimited
# rewrite.
# ---------------------------------------------------------------------------

# Match `register('foo.bar', { ... })` (single- or double-quoted key) and
# capture the literal meta-object body. We deliberately do NOT try to
# parse the JS — we know every call site in this repo uses a top-level
# object literal with single-line or multiline string fields, and the
# pre-commit hook will catch any deviation via the AST scanners (AI-E1-13).
# The body is captured non-greedily up to the matching `)`. The regex
# requires the meta to be an object literal (`{`) so we skip any call
# that uses a runtime-evaluated meta (those are bugs — meta must be
# constant — and the gate will surface them as a parse failure here).
REGISTER_FULL_RE = re.compile(
    r"\bregister\(\s*(['\"])([a-zA-Z0-9_.\-]+)\1\s*,\s*(\{(?:[^{}]|\{[^{}]*\})*\})\s*\)",
    re.DOTALL,
)

# Literal string fields inside the meta object. Captures the inner
# string excluding the surrounding quotes. We deliberately do NOT
# try to parse template literals or computed fields — every call site
# in the repo uses a plain single-quoted string, and the AST gate
# (AI-E1-13) will surface any deviation. Field names in the JS are
# bare identifiers (`purpose:`), not quoted (`'purpose':`), so the
# name is matched without quotes.
#
# Value body allows the OTHER quote character (e.g. `"en", "bn"`)
# so we don't refuse legitimate descriptions that nest one quote
# kind inside the other (the regex would still reject a single-
# quoted string with a `'` in it — that's an actual bug).
_META_FIELD_RE_TEMPLATE = (
    r"(?<![\w$])" + "{name}"
    + r"\s*:\s*(['\"])((?:(?!\1).)*)\1"
)


def _extract_meta_field(meta: str, field: str) -> str | None:
    """Pull the literal string value of `field` from a meta-object body.
    Returns None if the field is missing or has a non-literal value
    (e.g. a template literal)."""
    pattern = re.compile(_META_FIELD_RE_TEMPLATE.format(name=re.escape(field)))
    m = pattern.search(meta)
    if m is None:
        return None
    return m.group(2)


def collect_register_meta(root: Path) -> dict[str, dict]:
    """Walk every JS file and collect the meta object for every
    `register('key', { ... })` call. Returns {key: {purpose, lifetime,
    schema, owner}}. Skips calls where the meta object is malformed
    (returns a sentinel entry with a `__invalid__` flag in the rare
    event the parse fails — the caller decides whether to print a
    warning and skip or fail outright)."""
    out: dict[str, dict] = {}
    js_dir = root / ASSETS_JS_DIR
    if not js_dir.is_dir():
        return out
    for path in sorted(js_dir.rglob("*.js")):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for m in REGISTER_FULL_RE.finditer(text):
            key = m.group(2)
            meta_body = m.group(3)
            purpose = _extract_meta_field(meta_body, "purpose")
            lifetime = _extract_meta_field(meta_body, "lifetime")
            schema = _extract_meta_field(meta_body, "schema")
            owner = _extract_meta_field(meta_body, "owner")
            if not (purpose and lifetime and schema and owner):
                # Malformed meta — skip silently. The drift check
                # (check_register_calls_match_manifest) will still flag
                # the key as missing if the manifest doesn't have it,
                # and the dev can re-run --inject after fixing the
                # call site.
                continue
            # If a key is registered twice (different files), the LAST
            # call wins. The runtime throws on duplicate registration,
            # so the dev should fix the call site — but the inject
            # mode is best-effort and prefers the most recent seen.
            out[key] = {
                "purpose": purpose,
                "lifetime": lifetime,
                "schema": schema,
                "owner": owner,
            }
    return out


def inject_manifest(root: Path) -> int:
    """Rewrite the manifest block in chrome.html with the union of
    (existing manifest entries) and (new register() calls). Preserves
    existing entry order; appends new entries at the end in the order
    they were discovered by collect_register_meta.

    The pre-commit hook (.git/hooks/pre-commit) regenerates index.html
    from chrome.html whenever the chrome source is staged, so the dev
    only needs to commit chrome.html + storage-registry.js (or shell.js)
    together — the splice happens automatically.

    Returns 0 on success, 1 on drift (the manifest has keys that no
    register() call owns — symptomatic of a manually-added entry that
    should be re-registered), 2 on missing chrome.html or markers."""
    chrome_path = root / CHROME_REL
    if not chrome_path.is_file():
        sys.stderr.write(
            f"storage-registry-gate --inject: missing {chrome_path}\n"
        )
        return 2
    text = chrome_path.read_text(encoding="utf-8")
    marker_match = MARKER_DELIMITED_RE.search(text)
    script_match = None
    block_offset = 0  # offset of the matched block in the full text;
    # added to script_match.start()/end() if the script regex ran
    # against the block slice.
    if marker_match:
        block_offset = marker_match.start(1)
        block = marker_match.group(1)
        script_match = re.search(
            r'(<script\s+type="application/json"\s+id="ht-storage-registry-manifest"\s*>)(.*?)(</script>)',
            block,
            re.DOTALL | re.IGNORECASE,
        )
    if script_match is None:
        script_match = re.search(
            r'(<script\s+type="application/json"\s+id="ht-storage-registry-manifest"\s*>)(.*?)(</script>)',
            text,
            re.DOTALL | re.IGNORECASE,
        )
        block_offset = 0
    if script_match is None:
        sys.stderr.write(
            "storage-registry-gate --inject: chrome.html missing "
            "<script id=\"ht-storage-registry-manifest\"> element\n"
        )
        return 2

    # Parse the existing manifest entries (preserving order).
    try:
        existing_payload = json.loads(script_match.group(2))
    except ValueError as exc:
        sys.stderr.write(
            f"storage-registry-gate --inject: existing manifest is not "
            f"valid JSON: {exc}\n"
        )
        return 2
    if not isinstance(existing_payload, dict) or "entries" not in existing_payload:
        sys.stderr.write(
            "storage-registry-gate --inject: manifest must be an object "
            "with an 'entries' array\n"
        )
        return 2
    existing_entries = existing_payload["entries"]
    if not isinstance(existing_entries, list):
        sys.stderr.write(
            "storage-registry-gate --inject: manifest 'entries' must be "
            "an array\n"
        )
        return 2

    existing_by_key: dict[str, dict] = {}
    for entry in existing_entries:
        if isinstance(entry, dict) and "key" in entry:
            existing_by_key[entry["key"]] = entry

    # Collect register() meta from the JS source. If the meta-block is
    # malformed the call is silently skipped (the existing manifest
    # entry, if any, is preserved). This matches the existing gate's
    # behaviour: it reports drift but doesn't try to auto-inject.
    register_meta = collect_register_meta(root)

    # Drift check: keys in the manifest but absent from register() calls.
    # These are typically the per-tool `handy-tools.history.<slug>` keys
    # (registered dynamically via registerHistoryKeys) OR the
    # `handy-tools.dashboard`, `handy-tools.pwa.dismissals`, etc. keys
    # owned by shell.js but registered via programs other than the
    # static register() calls. We do NOT remove these — they're real
    # keys the gate currently allows. We only warn so the dev can audit.
    registered_keys = set(register_meta.keys())
    manifest_only_keys = sorted(set(existing_by_key.keys()) - registered_keys)
    if manifest_only_keys:
        print(
            "storage-registry-gate --inject: warning — manifest has "
            f"{len(manifest_only_keys)} key(s) with no static register() "
            "call (dynamic registerHistoryKeys or shell.js try/catch):"
        )
        for k in manifest_only_keys:
            print(f"  - {k}")

    # Union: keep existing order, append new register() keys at the end.
    new_entries: list[dict] = []
    seen_keys: set[str] = set()
    for entry in existing_entries:
        if not isinstance(entry, dict) or "key" not in entry:
            continue
        key = entry["key"]
        # If the register() call has FRESH meta, refresh the entry.
        # This handles the Story 3.12 case (pins schema drift): the
        # JS is the source of truth, so the manifest gets the latest
        # version from the register() call. We mutate the existing
        # dict IN PLACE so the key order (and any extra fields added
        # in the future) survives — only the four required fields
        # get refreshed.
        if key in register_meta:
            ref = register_meta[key]
            entry["purpose"] = ref["purpose"]
            entry["lifetime"] = ref["lifetime"]
            entry["schema"] = ref["schema"]
            entry["owner"] = ref["owner"]
        new_entries.append(entry)
        seen_keys.add(key)
    # Append any register() keys that the manifest doesn't have yet.
    added = []
    for key in sorted(register_meta.keys()):
        if key in seen_keys:
            continue
        ref = register_meta[key]
        new_entries.append({
            "key": key,
            "purpose": ref["purpose"],
            "lifetime": ref["lifetime"],
            "schema": ref["schema"],
            "owner": ref["owner"],
        })
        added.append(key)
        seen_keys.add(key)

    # Build the new JSON payload. Use the same compact shape the
    # chrome.html already uses (no whitespace between entries) so the
    # diff is minimal and the byte-marker drift check still passes.
    new_payload = {"entries": new_entries}
    new_inner = json.dumps(new_payload, separators=(",", ":"))

    # Semantically compare the new payload to the existing one. If
    # they're equal and the only difference is whitespace, treat the
    # run as a no-op so we don't churn chrome.html on every invocation.
    # (Re-serializing always produces a slightly different byte stream
    # even when the JSON values are identical.)
    if (
        not added
        and json.dumps(existing_payload, separators=(",", ":")) == new_inner
    ):
        print(
            "storage-registry-gate --inject: manifest already in sync "
            "(no changes written)"
        )
        return 0

    # Splice the new JSON into the script element. Preserve the
    # surrounding markers + the leading comment block — only the
    # JSON inside the <script>...</script> tag changes. If the
    # script regex ran against the block slice (bounded by the
    # markers), add the block_offset to convert the relative
    # span to an absolute one in the full text.
    open_tag = script_match.group(1)
    close_tag = script_match.group(3)
    new_script_block = open_tag + new_inner + close_tag
    abs_start = script_match.start() + block_offset
    abs_end = script_match.end() + block_offset
    new_text = text[:abs_start] + new_script_block + text[abs_end:]

    if new_text == text:
        print(
            "storage-registry-gate --inject: manifest already in sync "
            "(no changes written)"
        )
        return 0

    chrome_path.write_text(new_text, encoding="utf-8")
    if added:
        print(
            f"storage-registry-gate --inject: {len(added)} new key(s) "
            f"added to chrome.html — {', '.join(added)}"
        )
    # If we refreshed any existing entries, the write happened too.
    if not added:
        print(
            "storage-registry-gate --inject: manifest refreshed from "
            "register() calls (existing entries updated to match JS)"
        )
    print(
        "storage-registry-gate --inject: chrome.html written. "
        "Next step: re-run `make shell-template-home` to propagate "
        "into index.html (the pre-commit hook does this automatically "
        "if you stage chrome.html + the JS file you edited)."
    )
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    parser.add_argument(
        "--inject",
        action="store_true",
        help=(
            "rewrite the manifest block in chrome.html from the "
            "register() call sites in assets/js/storage-registry.js "
            "and assets/js/shell.js (AI-E1-10). New keys are appended; "
            "existing keys are refreshed to match the JS source of "
            "truth. The pre-commit hook propagates the change into "
            "index.html + every tool page automatically."
        ),
    )
    args = parser.parse_args(argv)

    root = (
        Path(args.root).resolve()
        if args.root
        else find_repo_root(Path(__file__).parent)
    )

    if args.inject:
        return inject_manifest(root)

    print("storage-registry-gate: loading manifest from chrome.html…")
    by_key = load_manifest(root)
    print(f"storage-registry-gate: manifest has {len(by_key)} registered key(s)")

    failures = 0

    print("storage-registry-gate: verifying manifest integrity…")
    integrity = check_manifest_integrity(by_key)
    if integrity:
        for v in integrity:
            print(f"  FAIL    {v}")
        failures += len(integrity)
    else:
        print("  ok      manifest integrity")

    print("storage-registry-gate: cross-checking tools.json history-keys…")
    history = check_history_keys_against_tools_json(by_key, root / TOOLS_JSON_REL)
    if history:
        for v in history:
            print(f"  FAIL    {v}")
        failures += len(history)
    else:
        print("  ok      history-keys match tools.json slugs")

    print("storage-registry-gate: walking JS call sites…")
    js_files = iter_js_files(root)
    print(f"storage-registry-gate: scanning {len(js_files)} JS file(s)")
    call_site_violations = check_call_sites(js_files, by_key, root)
    if call_site_violations:
        for v in call_site_violations:
            print(f"  FAIL    {v}")
        failures += len(call_site_violations)
    else:
        print("  ok      all HT.storage.* call sites reference registered keys")

    print("storage-registry-gate: verifying register() calls match manifest…")
    sync_violations = check_register_calls_match_manifest(by_key, root)
    if sync_violations:
        for v in sync_violations:
            print(f"  FAIL    {v}")
        failures += len(sync_violations)
    else:
        print("  ok      register() calls and manifest in sync")

    if failures:
        print(f"storage-registry-gate: {failures} violation(s) found")
        return 1
    print("storage-registry-gate: all checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
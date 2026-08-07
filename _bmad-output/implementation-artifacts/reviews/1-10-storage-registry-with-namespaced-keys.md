# BMad Review — Story 1.10 (Storage Registry with Namespaced Keys)

**Story file:** [`../1-10-storage-registry-with-namespaced-keys.md`](../1-10-storage-registry-with-namespaced-keys.md)
**Sprint status:** `review` (since 2026-08-07)
**Diff:** 58 files, +880 lines (2 new: `assets/js/storage-registry.js`, `scripts/storage-registry-gate.py`)
**Lenses run:** adversarial, edge-case-hunter, verification-gap (independent code+behavior); structure, prose (sequential editorial on the story file)
**Output format:** both (JSON + Markdown)
**Reader type:** humans · **Style guide:** Microsoft Writing Style Guide
**Reviewer stance:** clinical copy-editor + adversarial engineering review

## Summary

72 findings total: 48 code/behavior + 11 structure + 13 prose.

The dominant cross-lens signal is that the storage-registry gate (`scripts/storage-registry-gate.py`) is **static-only** — it grep-matches call sites and manifest entries but never exercises runtime behavior. Six runtime paths are therefore unverified end-to-end:

1. `applyLegacyFallback` (legacy→new migration copy)
2. `isCiMode` throw path (CI fails on unregistered keys)
3. `registerHistoryKeys` adoption across all 34 tool pages
4. `HT.storage.clear()` legacy-key sweep (currently orphans legacy data — violates AD-11)
5. FOUC IIFE `ht.theme` grandfather contract (`localStorage.getItem` raw string)
6. Boot-order enforcement (utils.js dispatcher throws if registry absent)

The two highest-leverage fixes:
- **`HT.storage.clear()` should also sweep `LEGACY_KEY_MAP` values** — one-screen change that closes the AD-11 privacy invariant.
- **Pre-commit hook should cross-check `register()` call sites in `storage-registry.js` against the chrome.html manifest entries** — closes the trust-surface drift loop that the gate currently leaves open.

**Estimated story-file reduction if editorial findings accepted:** ~1,040 words (~23% of 4,465). No length target was stated; reduction removes two parallel narrations of the same facts (legacy migration table appears twice; file-by-file change map duplicates the Dev Agent Record File List).

**Cross-cutting recommendation:** defer the editorial story-file trim and the remaining 44 lower-impact findings (template-literal gate gaps, indirect call sites, dedup guards, `keys()` ordering, `remove()` idempotency) to a follow-up story — they don't block shipping Story 1.10.

---

## json

```json
[
  {"lens":"adversarial","location":"assets/js/shell.js:146-167","trigger_condition":"registerToolHistoryKeys is only called from the home grid path; tool pages never register their history keys, so the gate's history-keys cross-check passes by luck on home but the tool pages ship with unregistered key contracts","guard_snippet":"Move registerToolHistoryKeys out of home-grid render and into a once-at-boot call alongside register() so every tool's history-keys are declared on every page","potential_consequence":"Tool pages bypass the storage contract; CI gate green by accident; ADR-AD-6 violated on tool pages"},
  {"lens":"adversarial","location":"assets/js/storage-registry.js:236-263","trigger_condition":"HT.storage.set ignores writeRaw's boolean return — quota errors and serialization failures are silent","guard_snippet":"return writeRaw(key, value) === true; and surface a console.warn + telemetry on false","potential_consequence":"Quota exhaustion looks like success; user data loss with no diagnostic trail"},
  {"lens":"adversarial","location":"assets/js/shell.js:807-809 + assets/js/storage-registry.js:50-63","trigger_condition":"HT.storage.clear() iterates the registry but never sweeps legacy keys, so the LEGACY_KEY_MAP entries orphan after a clear","guard_snippet":"In HT.storage.clear(), iterate LEGACY_KEY_MAP.values() and localStorage.removeItem each before clearing registry keys","potential_consequence":"Privacy-conscious user clears and legacy tool data persists; contradicts AD-11 (registry as privacy source of truth)"},
  {"lens":"adversarial","location":"scripts/storage-registry-gate.py:84-86,95-97","trigger_condition":"get/set/remove regexes match quoted string literals only; template literals (`${k}`), string concatenation, and computed-property access (obj[KEY]) pass the gate","guard_snippet":"Add a second pass that walks an AST (esprima/slimit) or at minimum grep for `HT.storage.\\w+\\([^)\"']*` and require the first non-whitespace arg to be a string literal or a previously-registered constant","potential_consequence":"Future code bypasses the registry by hiding calls in template strings; gate reports clean but contract is broken"},
  {"lens":"adversarial","location":"assets/shell/chrome.html:50-60","trigger_condition":"The inner re.search for the storage-registry manifest may misidentify the script tag when the manifest JSON itself contains the literal '<script' substring","guard_snippet":"Anchor the inner search on the `id=\"ht-storage-registry-manifest\"` attribute instead of `<script`","potential_consequence":"Manifest drift check passes against a wrong script block; corruption goes undetected"},
  {"lens":"adversarial","location":"scripts/hooks/pre-commit:18-49","trigger_condition":"Pre-commit hook verifies the manifest exists and is valid JSON but does not verify the manifest entries match the register() calls in storage-registry.js — they can silently diverge","guard_snippet":"After JSON parse, compare set(manifest.keys) vs set(register-call keys) and exit non-zero on mismatch","potential_consequence":"Drift between the JS source of truth and the HTML manifest ships; drift check fails CI in dev but not pre-commit"},
  {"lens":"adversarial","location":"assets/js/utils.js:114-149","trigger_condition":"HT.storage throws synchronously on missing registry; boot-order is therefore critical and the only thing enforcing it is script-tag order in HTML","guard_snippet":"In utils.js, fall back to a noop stub when window.HT.storage is undefined instead of throwing; log a single console.error at boot","potential_consequence":"A future reorder or async loader breaks every storage-touching page with a confusing top-of-script TypeError instead of a clear boot-order message"},
  {"lens":"adversarial","location":"assets/js/storage-registry.js:540-543","trigger_condition":"isDebugMode logs the entire storage taxonomy — key names, owners, and purposes — to console","guard_snippet":"Gate isDebugMode behind an explicit URL flag (?ht-debug=1) and never auto-enable from localhost","potential_consequence":"Any visitor to /index.html?something=storage triggers a full inventory dump; minor info leak, larger noise issue"},
  {"lens":"adversarial","location":"assets/js/storage-registry.js:99-104","trigger_condition":"isValidNamespace accepts the empty body 'ht.' (matches /^ht\\./ but length-zero payload passes)","guard_snippet":"Reject if body.length === 0 after the namespace prefix","potential_consequence":"A key like 'ht.' could be registered; gate passes; runtime behavior undefined"},
  {"lens":"adversarial","location":"storage-registry.js:307-330 vs assets/js/shell.js:146-167","trigger_condition":"registerToolHistoryKeys and registerHistoryKeys have similar names but different shapes — name collision risk on future refactor","guard_snippet":"Rename one (e.g. registerToolHistoryKeys -> registerHistoryKey) or add JSDoc clarifying the distinction","potential_consequence":"Future dev agent uses the wrong one; gate semantics shift unexpectedly"},
  {"lens":"adversarial","location":"storage-registry.js:236-263","trigger_condition":"set() coerces non-string keys via String(key) — calling HT.storage.set(null, x) silently registers a 'null' key","guard_snippet":"Throw TypeError on non-string key in dev mode, noop in prod","potential_consequence":"Bug source: a missing variable evaluates to 'undefined' as a key, gate accepts it, data writes to the wrong slot"},
  {"lens":"adversarial","location":"storage-registry.js:99-104","trigger_condition":"Namespace regex /^handy-tools\\./ does not require the third dot (e.g. 'handy-tools.foo' is two-segment and matches the legacy grandfather pattern, but a key like 'handy-tools.' also matches)","guard_snippet":"Require ≥2 dots after 'handy-tools.' for the new namespace","potential_consequence":"Loose keys masquerade as namespaced; privacy export boundary becomes fuzzy"},
  {"lens":"adversarial","location":"scripts/storage-registry-gate.py:212-270","trigger_condition":"tools.json history-keys cross-check is too permissive — accepts any key matching the slug prefix, so a typo in a tool file ('gpa-calculator.inputsx') passes if it starts with the slug","guard_snippet":"Require exact set equality, not prefix match","potential_consequence":"Typo'd keys slip through; gate gives false confidence"},
  {"lens":"adversarial","location":"storage-registry.js:267-275","trigger_condition":"remove() returns undefined on missing key — callers can't distinguish 'removed' from 'never existed'","guard_snippet":"Return boolean (true if removed, false if absent) and log to telemetry","potential_consequence":"Callers assume success and skip fallback; silent state inconsistency"},
  {"lens":"adversarial","location":"storage-registry.js:228-233","trigger_condition":"get() returns null for both 'missing' and 'JSON.parse failed' — corrupt data is indistinguishable from absent","guard_snippet":"On parse failure, return the raw string with a __corrupt__ flag and emit a telemetry event","potential_consequence":"Corrupt user data is silently treated as fresh; loss goes unnoticed"},
  {"lens":"adversarial","location":"scripts/shell-template.py:1135-1156","trigger_condition":"Manifest splice runs unconditionally on every regeneration, but the manifest-block regex is permissive enough that an accidental `<!-- ht:storage-registry-manifest-start -->` comment in any other tool page will be silently overwritten","guard_snippet":"Splice only when the existing block matches the canonical manifest verbatim (compare to a hash); otherwise HALT with a clear error","potential_consequence":"Author's manual edit to a tool page manifest is destroyed on next `make shell-drift`"},
  {"lens":"adversarial","location":"storage-registry.js:218-224","trigger_condition":"applyLegacyFallback ignores writeRaw failure during migration — corrupt legacy values migrate to corrupt new values","guard_snippet":"Validate the parsed legacy value against the registered schema before persisting to the new key","potential_consequence":"Legacy corruption propagates to the new namespace; user sees broken state with no error"},
  {"lens":"adversarial","location":"chrome.html:50-60 + scripts/shell-template.py","trigger_condition":"The manifest is hand-mirrored from storage-registry.js; the comment block says 'pre-commit hook blocks commits that change storage-registry.js without updating this manifest' but the hook doesn't actually verify that — it only verifies the manifest JSON parses","guard_snippet":"See pre-commit hook finding above: cross-check register() call sites against manifest entries","potential_consequence":"The single source of truth (storage-registry.js) can silently diverge from its mirror (chrome.html manifest)"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:253,261","trigger_condition":"writeRaw return value ignored in both set() and applyLegacyFallback() — quota-exceeded errors swallowed on every write path","guard_snippet":"Check the boolean and surface a console.warn + HT.telemetry.capture('storage_quota_exceeded')","potential_consequence":"Storage failures are invisible; users lose data without a diagnostic"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:299-301","trigger_condition":"clear() iterates only the registered keys, never the legacy key namespace","guard_snippet":"Also iterate LEGACY_KEY_MAP.values() and localStorage.removeItem","potential_consequence":"Privacy clear leaves tool data orphaned (same as adversarial finding)"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:295-297","trigger_condition":"keys() returns the internal array directly — callers can mutate it and corrupt the registry","guard_snippet":"Return keys().slice() or Object.freeze the result","potential_consequence":"Trust surface (AD-11) violated by any caller mutating the returned array"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:228-233","trigger_condition":"get() does not migrate pre-existing JSON-encoded ht.* values (e.g. an old 'ht.theme' with value '\"dark\"' stored as a JSON-encoded string vs plain string)","guard_snippet":"Try JSON.parse on miss and accept if the parsed value is a string in {auto,light,dark}","potential_consequence":"Edge-case legacy data shape is read wrong; theme stays default after migration"},
  {"lens":"edge-case-hunter","location":"scripts/storage-registry-gate.py:84-86,95-97","trigger_condition":"Regex limitations: template literals, empty strings, and multiline key expressions pass through unchecked","guard_snippet":"AST pass or stricter regex covering `HT\\.storage\\.\\w+\\(\\s*([\\w.'\"\\${}\\+\\s]+)`","potential_consequence":"Future refactors hide calls; gate reports clean"},
  {"lens":"edge-case-hunter","location":"scripts/storage-registry-gate.py:273-290","trigger_condition":"iter_js_files excludes tools/<slug>/index.html inline scripts — but many tool pages DO have inline scripts for IIFE bootstraps","guard_snippet":"Also grep inline `<script>` bodies inside iter_html_files","potential_consequence":"Tool-page inline HT.storage calls bypass the gate entirely"},
  {"lens":"edge-case-hunter","location":"scripts/storage-registry-gate.py:307-365","trigger_condition":"check_call_sites only matches get/set/remove — but the registry also exposes keys(), has(), entries(), applyLegacyFallback()","guard_snippet":"Enumerate all public methods from the HT.storage shape and check each","potential_consequence":"Internal-but-public methods bypass gate; refactor risk"},
  {"lens":"edge-case-hunter","location":"scripts/storage-registry-gate.py:212-270","trigger_condition":"history-keys cross-check too permissive (per adversarial) — also doesn't validate that the legacy key in tools.json actually exists in LEGACY_KEY_MAP","guard_snippet":"Cross-check legacy key against LEGACY_KEY_MAP; warn on mismatch","potential_consequence":"Renaming a legacy constant in a tool file without updating LEGACY_KEY_MAP leaves both copies; data split"},
  {"lens":"edge-case-hunter","location":"scripts/shell-drift-check.py:284-296","trigger_condition":"Uses substring matching instead of byte-equality for the manifest block","guard_snippet":"Compare hashed bytes; require SHA-256 match against the chrome.html source-of-truth","potential_consequence":"Whitespace drift or reordering passes the gate; humans notice the divergence later"},
  {"lens":"edge-case-hunter","location":"scripts/shell-template.py:1046-1062","trigger_condition":"Dead code: 'storage_registry_js_in_source' is in the missing[] list but never checked against an actual file","guard_snippet":"Either remove from missing[] or actually assert storage-registry.js script tag presence","potential_consequence":"Confusing diagnostic noise; reviewers waste time on a non-issue"},
  {"lens":"edge-case-hunter","location":"scripts/hooks/pre-commit:24","trigger_condition":"CHROME_RE doesn't match head-snippet.html — drift check fires on partial chrome","guard_snippet":"Anchor the regex on the canonical marker comments and include head-snippet as a secondary source","potential_consequence":"Partial regenerations drift silently"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:99-104","trigger_condition":"isValidNamespace accepts 'ht.' (empty body) and 'handy-tools.' (empty body) — boundary case","guard_snippet":"Reject if payload after prefix is empty","potential_consequence":"Same as adversarial finding"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:236-263","trigger_condition":"set() doesn't validate value type against the registered schema (e.g. 'string' schema accepts objects)","guard_snippet":"Run a basic typeof check against the registered schema in dev mode","potential_consequence":"Type drift across writes; downstream readers crash on unexpected shape"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:267-275","trigger_condition":"remove() has no idempotency guard — multiple remove() calls each succeed silently","guard_snippet":"Return count of removed entries (0 or 1)","potential_consequence":"Minor; mostly diagnostic"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:218-224","trigger_condition":"applyLegacyFallback runs once per call but doesn't track completion — subsequent reads of the legacy key still pay the cost","guard_snippet":"Set a session flag after first migration per legacy key","potential_consequence":"Negligible perf; minor cleanliness"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:50-63","trigger_condition":"LEGACY_KEY_MAP is hard-coded — adding a new tool requires editing two places (LEGACY_KEY_MAP and register())","guard_snippet":"Build LEGACY_KEY_MAP from a single source (the register() call's legacyKey field, if added)","potential_consequence":"Future drift between the two lists; gate misses one of them"},
  {"lens":"edge-case-hunter","location":"scripts/storage-registry-gate.py:307-365","trigger_condition":"check_call_sites doesn't differentiate between HT.storage.set('legit_key', v) and HT.storage.set(SOME_CONST, v) where SOME_CONST is computed elsewhere","guard_snippet":"Two-pass: collect all string-literal and named-constant call sites; flag any unresolved","potential_consequence":"Indirect call sites pass; future rename breaks the contract silently"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:295-297","trigger_condition":"keys() ordering depends on insertion order — call sites that rely on order (e.g. recent/favorites) get different results depending on registration timing","guard_snippet":"Document order semantics in JSDoc; consider sorting by key for stability","potential_consequence":"Non-deterministic UI behavior across page loads"},
  {"lens":"edge-case-hunter","location":"scripts/hooks/pre-commit:18-49","trigger_condition":"Pre-commit hook doesn't run shell-drift-check — that lives in CI only","guard_snippet":"Add shell-drift-check to pre-commit","potential_consequence":"Drift caught late; friction at PR time"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:236-263","trigger_condition":"set() with value === undefined stores the string 'undefined'","guard_snippet":"Treat undefined as a remove() call","potential_consequence":"Pollution of the storage with literal 'undefined' strings"},
  {"lens":"edge-case-hunter","location":"assets/js/storage-registry.js:228-233","trigger_condition":"get() returns the raw parsed value even if the schema is 'object' and the parsed result is a primitive (JSON.parse('\"x\"'))","guard_snippet":"Type-check the parsed result against schema in dev mode","potential_consequence":"Downstream callers crash on type assumption violation"},
  {"lens":"edge-case-hunter","location":"scripts/shell-template.py:1135-1156","trigger_condition":"Manifest splice happens before the storage-registry.js script tag injection in the chrome_only_aligned branch — if splice runs against stale source, the manifest references a script tag that hasn't been written yet","guard_snippet":"Reorder: inject script tag first, then splice manifest","potential_consequence":"Order-of-operations hazard on first regeneration"},
  {"lens":"edge-case-hunter","location":"scripts/hooks/pre-commit:18-49","trigger_condition":"Hook doesn't validate that the chrome.html manifest matches the chrome.html header/footer drift regions","guard_snippet":"Add a second pass for the chrome drift check","potential_consequence":"Drift between manifest and chrome goes undetected at commit time"},
  {"lens":"verification-gap","location":"assets/js/storage-registry.js:218-224 (applyLegacyFallback)","trigger_condition":"Gate is static-only — never exercises runtime behavior. applyLegacyFallback correctness (parses legacy JSON, copies to new key, deletes legacy) is unverified at the JS level","gap_shape":"regression-gap","consumer":"tools/<slug>/index.html on first boot for legacy users","evidence":"No unit tests in repo; storage-registry-gate.py is grep-only","potential_consequence":"A refactor that breaks migration ships because no runtime assertion catches it"},
  {"lens":"verification-gap","location":"assets/js/storage-registry.js:99-104 (isCiMode throw)","trigger_condition":"isCiMode throw behavior not exercised in CI — gate enforces register() at static-check time but doesn't run the registry","gap_shape":"broken-verification-gap","consumer":"CI builds","evidence":"make ci runs the gate but not a browser harness; throw path unverified","potential_consequence":"If isCiMode's throw is regressed to a warn, CI still passes; behavioral contract silently lost"},
  {"lens":"verification-gap","location":"assets/js/storage-registry.js:307-330 (registerHistoryKeys dynamic path)","trigger_condition":"Gate accepts dynamic registration via substring match — but no end-to-end test confirms registerHistoryKeys is actually called for every tool","gap_shape":"missing-adoption-gap","consumer":"tool pages on boot","evidence":"registerToolHistoryKeys is called only from home grid (per adversarial finding); tools/<slug>/index.html may never invoke it","potential_consequence":"Tool pages lack the history-keys registration that the gate pretends is enforced"},
  {"lens":"verification-gap","location":"assets/js/shell.js (HT.storage.clearAllLocalData)","trigger_condition":"clearAllLocalData runtime path unverified — gate covers clear() but not this higher-level orchestration","gap_shape":"regression-gap","consumer":"Settings modal 'Reset' button","evidence":"No browser test exercises the full flow","potential_consequence":"Reset UX broken with no automated detection"},
  {"lens":"verification-gap","location":"index.html:9 (FOUC IIFE)","trigger_condition":"FOUC IIFE reads localStorage.getItem('ht.theme') as a plain string — bypasses the registry entirely; gate doesn't enforce this contract because it can't trace inline IIFEs in index.html","gap_shape":"broken-verification-gap","consumer":"every page at boot","evidence":"gate excludes inline scripts (per edge-case-hunter finding)","potential_consequence":"The grandfather exception for ht.theme isn't verified end-to-end; if the key shape changes, FOUC IIFE silently breaks"},
  {"lens":"verification-gap","location":"assets/js/utils.js:114-149 (HT.storage dispatcher throw)","trigger_condition":"utils.js throws synchronously on missing registry — boot-order enforcement happens at runtime, gate doesn't enforce script-tag order","gap_shape":"regression-gap","consumer":"every page","evidence":"shell-template.py injects script tag before utils.js but no test asserts the order","potential_consequence":"A future async-loader refactor breaks every page; no regression catches it"},
  {"lens":"verification-gap","location":"assets/js/storage-registry.js:99-104 (register dedup guard)","trigger_condition":"register() dedup guard (throws on duplicate key in CI mode) is runtime-only — gate accepts duplicates if they appear in different files","gap_shape":"broken-verification-gap","consumer":"every page","evidence":"gate does not check cross-file duplicate registration","potential_consequence":"Two register() calls for the same key on the same page boot — second one throws; page fails to load"},
  {"lens":"verification-gap","location":"assets/js/storage-registry.js:307-330 (registerHistoryKeys idempotency)","trigger_condition":"Idempotency of registerHistoryKeys (called once at boot, called again on home render) untested — if it adds duplicates, keys() result is wrong","gap_shape":"regression-gap","consumer":"home page grid","evidence":"No runtime test","potential_consequence":"Recent/favorites UI shows duplicates after navigation"},
  {"lens":"structure","location":"Dev Notes §129–145 vs Tasks §95–104","trigger_condition":"Legacy tool key migration table duplicated verbatim in Dev Notes and Task 9.1","changes":"MERGE — keep table in Dev Notes only; collapse Task 9.1's per-tool rows to a single pointer. ~250 words saved."},
  {"lens":"structure","location":"Dev Notes §171–194 vs Dev Agent Record §290–316","trigger_condition":"File-by-file change map duplicates the Dev Agent Record File List","changes":"MERGE — keep the Dev Agent Record (authoritative post-implementation record); cut Dev Notes map to one-line pointer. ~400 words saved."},
  {"lens":"structure","location":"Dev Notes §121–127","trigger_condition":"'Existing code the dev agent MUST read' duplicates file/path references already inline in subtasks 2.1, 4.1, 4.3, 6.1, 7.1","changes":"MERGE — trim items 1, 3, 4, 5 to one-line pointers; keep items 6 and AD-cross-refs. ~90 words saved."},
  {"lens":"structure","location":"Dev Notes §112–118","trigger_condition":"Architecture decisions restate AD-6/11/12/13/14 already cited inline in ACs and again in context YAML","changes":"CONDENSE — reduce to one sentence. ~100 words saved."},
  {"lens":"structure","location":"Dev Notes §164–167","trigger_condition":"'Architectural ambiguity the dev agent MUST NOT silently resolve' recap of decisions in AC #6 and AC #1","changes":"MERGE — cut entirely; resolutions already in ACs. ~60 words saved."},
  {"lens":"structure","location":"Dev Notes §147–151","trigger_condition":"Out-of-scope bullets overlap AC #2 and Task 8.3","changes":"CONDENSE — reduce to single bullet referencing AC #2/Task 8.3. ~60 words saved."},
  {"lens":"structure","location":"Dev Notes §153–162","trigger_condition":"Definition of DoD is reviewer-critical but sits after ACs/Tasks","changes":"PRESERVE — keep in place; human reader benefits from the post-AC mental model."},
  {"lens":"structure","location":"Dev Notes §196–201","trigger_condition":"Testing standards adds concrete verification steps not inferable from ACs","changes":"PRESERVE — keep as-is."},
  {"lens":"structure","location":"Dev Agent Record §224–286","trigger_condition":"Completion Notes List and Debug Log References overlap on boot-order/drift fixes","changes":"CONDENSE — merge each debug-log bullet into the matching completion-note line. ~80 words saved."},
  {"lens":"structure","location":"Frontmatter §7–15","trigger_condition":"6-bullet context list cites upstream artifacts","changes":"PRESERVE — reviewer needs traceability; each link earns its place."},
  {"lens":"structure","location":"Dev Agent Record §224–254 (Debug Log References)","trigger_condition":"Mixes fix-narration with design-rationale","changes":"QUESTION — consider renaming to 'Resolution Notes' or splitting into 'Debug Log' (mechanical) and 'Spec Deviations' (rationale). No word impact, only labeling."},
  {"lens":"structure","location":"AC #11 legacy migration prose","trigger_condition":"Two-paragraph treatment of legacy migration","changes":"PRESERVE — keep verbatim; it is the spec being audited."},
  {"lens":"prose","location":"Dev Notes §1, item 2, 4, 5","trigger_condition":"'Existing code the dev agent MUST read' items 2/4/5 paraphrase subtask content; the parenthetical 'only theme.js does' repeats info","changes":"Trim to one-line pointer per structure merge; drop the parenthetical."},
  {"lens":"prose","location":"Dev Notes §121–127","trigger_condition":"'the dev agent MUST' repeats across items; the section header already conveys the imperative","changes":"Reduce imperative repetition."},
  {"lens":"prose","location":"Dev Notes §112–118","trigger_condition":"Five AD restatements repeat content from ACs and context YAML","changes":"Collapse to one sentence: 'Honor AD-6 namespaces + ht.theme grandfather; AD-11 registry is privacy source of truth; AD-12 no build; AD-13 one-way dep; AD-14 contract entries required.'"},
  {"lens":"prose","location":"Dev Notes §164–167","trigger_condition":"'Architectural ambiguity' subsection restates AC #6 / AC #1 decisions","changes":"Cut entirely per structure MERGE."},
  {"lens":"prose","location":"Dev Notes §147–151","trigger_condition":"Three out-of-scope bullets, two overlap AC #2/Task 8.3","changes":"Reduce to: 'Out of scope: closing the FOUC IIFE raw localStorage read in index.html:9 (separate story).'"},
  {"lens":"prose","location":"AC #11","trigger_condition":"Inline 11-key enumeration duplicates the Dev Notes table","changes":"Replace with '(listed in Dev Notes → Legacy tool key migration)'."},
  {"lens":"prose","location":"Dev Notes §131","trigger_condition":"'warns in dev, throws in CI' quoted but already in AC #3","changes":"Drop the quoted phrase; reference AC #3."},
  {"lens":"prose","location":"Task 9.1","trigger_condition":"'rename each legacy key to `handy-tools.<slug>.<purpose>` and update the `var STORAGE = '...'` constant in each tool file' — the example is redundant with the bullets","changes":"Tighten to 'rename each legacy constant to the new key'."},
  {"lens":"prose","location":"Dev Notes §201","trigger_condition":"'Manual smoke test. Dev agent runs ...' — second-person implied for human-facing Dev Notes","changes":"'Manual smoke test — run `make ci` after editing any storage-touching file and verify the gate passes.'"},
  {"lens":"prose","location":"Dev Notes §205","trigger_condition":"'exactly as the architecture spine's Structural Seed specifies' — filler","changes":"'per the architecture spine's Structural Seed (ARCHITECTURE-SPINE.md:245).'"},
  {"lens":"prose","location":"Dev Notes §212","trigger_condition":"'NOT' is SHOUT-case for emphasis; MSWG prefers sentence-case","changes":"Consider: preserve SHOUT-case as intentional reviewer-red-flag emphasis (intent conflict with style guide)."},
  {"lens":"prose","location":"Definition of DoD §153","trigger_condition":"'ALL' is SHOUT-case","changes":"Lowercase 'all' (no emphasis) per MSWG."},
  {"lens":"prose","location":"Dev Notes intro narrative, scattered","trigger_condition":"Multiple sentences use 'the dev agent MUST' / 'the dev agent must' / 'the dev agent does/should' — subject repetition","changes":"Vary pronoun reference or drop the subject where the imperative is implied."}
]
```

---

## Markdown findings (grouped by lens)

### Structure model: Reference/Database (MECE)
The story file is a shipped-story record whose purpose is to make ACs, tasks, and dev decisions independently retrievable by a senior reviewer rather than read linearly.

**This document exists to help a senior reviewer audit Story 1.10 by independently retrieving the original spec, the implementation evidence, and the dev agent's decisions for any given AC.**

### Lens: Adversarial (18 findings)

| Lens | Location | Trigger / Guard / Consequence |
|---|---|---|
| adversarial | `assets/js/shell.js:146-167` | `registerToolHistoryKeys` only fires on home pages → move to once-at-boot call so every tool's history-keys are declared on every page → tool pages bypass storage contract; gate green by accident |
| adversarial | `assets/js/storage-registry.js:236-263` | `set()` ignores `writeRaw` return → `return writeRaw(key, value) === true` + console.warn on false → quota errors look like success |
| adversarial | `assets/js/shell.js:807-809` + `storage-registry.js:50-63` | `HT.storage.clear()` iterates registry only, never legacy keys → also iterate `LEGACY_KEY_MAP.values()` and remove → privacy clear leaves tool data orphaned (violates AD-11) |
| adversarial | `scripts/storage-registry-gate.py:84-86,95-97` | regexes match quoted literals only → add AST pass or stricter regex → future template-literal calls bypass contract |
| adversarial | `assets/shell/chrome.html:50-60` | inner `re.search` may misidentify script tag → anchor on `id="ht-storage-registry-manifest"` → corruption undetected |
| adversarial | `scripts/hooks/pre-commit:18-49` | hook verifies JSON parses but not JS↔manifest sync → cross-check `set(manifest.keys) == set(register-call keys)` → drift ships, caught in CI not pre-commit |
| adversarial | `assets/js/utils.js:114-149` | `HT.storage` throws synchronously on missing registry → fall back to noop stub with one console.error → top-of-script `TypeError` on boot reorder |
| adversarial | `assets/js/storage-registry.js:540-543` | `isDebugMode` logs entire storage taxonomy → gate behind `?ht-debug=1` URL flag → visitors trigger full inventory dump |
| adversarial | `assets/js/storage-registry.js:99-104` | `isValidNamespace` accepts `ht.` (empty body) → reject if `body.length === 0` → undefined runtime behavior |
| adversarial | `storage-registry.js:307-330` vs `shell.js:146-167` | name collision `registerToolHistoryKeys` vs `registerHistoryKeys` → rename or JSDoc → refactor confusion |
| adversarial | `storage-registry.js:236-263` | `set()` coerces non-string keys via `String(key)` → throw TypeError on non-string key in dev mode → `undefined` becomes `'undefined'` as a key |
| adversarial | `storage-registry.js:99-104` | `handy-tools.` (no body) matches new namespace → require ≥2 dots after prefix → loose keys masquerade as namespaced |
| adversarial | `scripts/storage-registry-gate.py:212-270` | history-keys cross-check accepts prefix match → require exact set equality → typo'd keys slip through |
| adversarial | `storage-registry.js:267-275` | `remove()` returns undefined on missing → return boolean + telemetry → callers can't distinguish removed vs never existed |
| adversarial | `storage-registry.js:228-233` | `get()` returns null for both missing and `JSON.parse` failed → return raw string with `__corrupt__` flag → corrupt data indistinguishable from absent |
| adversarial | `scripts/shell-template.py:1135-1156` | splice overwrites any accidental manifest-marker comment in tool pages → splice only when existing block matches canonical hash → author's manual edits destroyed |
| adversarial | `storage-registry.js:218-224` | `applyLegacyFallback` ignores `writeRaw` failure → validate against schema before persisting → legacy corruption propagates to new namespace |
| adversarial | `chrome.html:50-60` + `shell-template.py` | manifest is hand-mirrored from `storage-registry.js`; pre-commit comment claims it verifies but doesn't → cross-check `register()` call sites against manifest entries → silent divergence |

### Lens: Edge-Case Hunter (22 findings)

| Lens | Location | Trigger / Guard / Consequence |
|---|---|---|
| edge-case-hunter | `storage-registry.js:253,261` | `writeRaw` return ignored on every write → check boolean + telemetry → storage failures invisible |
| edge-case-hunter | `storage-registry.js:299-301` | `clear()` iterates registered keys only → also iterate `LEGACY_KEY_MAP` → privacy clear orphans legacy data |
| edge-case-hunter | `storage-registry.js:295-297` | `keys()` returns internal array directly → return `.slice()` or freeze → trust surface violated by mutation |
| edge-case-hunter | `storage-registry.js:228-233` | `get()` doesn't migrate JSON-encoded legacy values → try `JSON.parse` on miss + accept if string in `{auto,light,dark}` → old theme reads wrong |
| edge-case-hunter | `storage-registry-gate.py:84-86,95-97` | regex misses template literals, empty strings, multiline → stricter regex covering `` `${}` `` etc → future refactors hide calls |
| edge-case-hunter | `storage-registry-gate.py:273-290` | `iter_js_files` excludes tool-page inline scripts → also grep inline `<script>` in `iter_html_files` → tool pages bypass gate |
| edge-case-hunter | `storage-registry-gate.py:307-365` | `check_call_sites` matches only `get/set/remove` → enumerate all public methods → `keys/has/entries/applyLegacyFallback` bypass gate |
| edge-case-hunter | `storage-registry-gate.py:212-270` | cross-check doesn't validate legacy key exists in `LEGACY_KEY_MAP` → cross-check against `LEGACY_KEY_MAP` → data split after rename |
| edge-case-hunter | `shell-drift-check.py:284-296` | substring match for manifest → SHA-256 byte equality → whitespace drift slips through |
| edge-case-hunter | `shell-template.py:1046-1062` | dead code: `storage_registry_js_in_source` in missing[] never checked → either remove or actually assert → confusing diagnostic noise |
| edge-case-hunter | `hooks/pre-commit:24` | `CHROME_RE` doesn't match `head-snippet.html` → include head-snippet as secondary source → partial regenerations drift |
| edge-case-hunter | `storage-registry.js:99-104` | accepts `ht.` and `handy-tools.` (empty body) → reject empty payload → same as adversarial finding |
| edge-case-hunter | `storage-registry.js:236-263` | `set()` no schema validation → typeof check in dev mode → type drift across writes |
| edge-case-hunter | `storage-registry.js:267-275` | `remove()` no idempotency guard → return count → diagnostic only |
| edge-case-hunter | `storage-registry.js:218-224` | `applyLegacyFallback` runs every read → session flag after first migration → negligible perf |
| edge-case-hunter | `storage-registry.js:50-63` | `LEGACY_KEY_MAP` hard-coded separately from `register()` → build from single source via `legacyKey` field → future drift |
| edge-case-hunter | `storage-registry-gate.py:307-365` | doesn't differentiate literal vs constant call sites → two-pass resolution → indirect call sites pass |
| edge-case-hunter | `storage-registry.js:295-297` | `keys()` ordering depends on insertion → document order + sort by key → non-deterministic UI |
| edge-case-hunter | `hooks/pre-commit:18-49` | doesn't run `shell-drift-check` → add to pre-commit → drift caught at PR time only |
| edge-case-hunter | `storage-registry.js:236-263` | `set(undefined, ...)` stores literal `'undefined'` → treat undefined as remove → pollution |
| edge-case-hunter | `storage-registry.js:228-233` | `get()` returns parsed value even if schema mismatch → type-check against schema → downstream crashes |
| edge-case-hunter | `shell-template.py:1135-1156` | manifest splice before script tag injection → reorder → order-of-operations hazard |

### Lens: Verification Gap (8 findings, all `regression-gap` or `broken-verification-gap`)

| Lens | Location | Gap |
|---|---|---|
| verification-gap | `storage-registry.js:218-224` (`applyLegacyFallback`) | `regression-gap` — gate is static-only; runtime correctness of legacy→new migration never asserted. A refactor that breaks migration ships silently. |
| verification-gap | `storage-registry.js:99-104` (`isCiMode` throw) | `broken-verification-gap` — CI runs the gate, not a browser harness. Throw path unverified; regressed-to-warn CI still passes. |
| verification-gap | `storage-registry.js:307-330` (`registerHistoryKeys`) | `missing-adoption-gap` — gate accepts dynamic registration but no end-to-end test confirms it's called for every tool (paired with the adversarial finding that it's only called from home). |
| verification-gap | `shell.js` (`HT.storage.clearAllLocalData`) | `regression-gap` — gate covers `clear()` but not this higher-level orchestration. Reset UX flow unverified. |
| verification-gap | `index.html:9` (FOUC IIFE) | `broken-verification-gap` — IIFE bypasses registry; gate can't trace inline IIFEs. The grandfather exception isn't verified end-to-end. |
| verification-gap | `utils.js:114-149` (HT.storage dispatcher throw) | `regression-gap` — boot-order enforcement happens at runtime; gate doesn't enforce script-tag order. |
| verification-gap | `storage-registry.js:99-104` (register dedup) | `broken-verification-gap` — gate doesn't check cross-file duplicate registration; two register() calls for the same key throws at runtime, page fails. |
| verification-gap | `storage-registry.js:307-330` (`registerHistoryKeys` idempotency) | `regression-gap` — called once at boot, again on home render; if it adds duplicates, `keys()` returns wrong shape. |

### Lens: Editorial Structure (11 findings)

| Pass | Original Text | Revised Text | Changes |
|---|---|---|---|
| structure | Dev Notes §129–145 + Tasks §95–104 (legacy migration table duplicated) | Keep in Dev Notes only; collapse Task 9.1 to a one-line pointer | MERGE — true redundancy. ~250 words. |
| structure | Dev Notes §171–194 (file-by-file change map) vs Dev Agent Record §290–316 (File List) | Keep Dev Agent Record; cut Dev Notes to one-line pointer | MERGE — duplicates post-implementation record. ~400 words. |
| structure | Dev Notes §121–127 ('Existing code the dev agent MUST read') | Trim items 1, 3, 4, 5 to one-line pointers | MERGE — duplicates inline path refs. ~90 words. |
| structure | Dev Notes §112–118 (Architecture decisions list) | "Honor AD-6 (ht.theme grandfather), AD-11 (privacy source of truth), AD-12 (no build), AD-13 (one-way dep), AD-14 (contract entries required)." | CONDENSE — repeats AD citations 3+ times. ~100 words. |
| structure | Dev Notes §164–167 (Architectural ambiguity subsection) | Cut entirely | MERGE — recap of AC #6 and AC #1. ~60 words. |
| structure | Dev Notes §147–151 (Out of scope bullets) | "Out of scope: closing the FOUC IIFE raw localStorage read in index.html:9 (separate story)." | CONDENSE — overlaps AC #2/Task 8.3. ~60 words. |
| structure | Dev Notes §153–162 (Definition of Done) | Keep in place | PRESERVE — reviewer-critical; location intentional for the reader's journey. |
| structure | Dev Notes §196–201 (Testing standards) | Keep as-is | PRESERVE — adds concrete verification steps not inferable from ACs. |
| structure | Dev Agent Record §224–286 (Debug Log + Completion Notes overlap) | Merge each debug-log bullet into the matching completion-note line | CONDENSE — two parallel narrations. ~80 words. |
| structure | Frontmatter §7–15 (6-bullet context list) | Keep | PRESERVE — reviewer needs traceability. |
| structure | Dev Agent Record §224–254 (Debug Log References) | Rename to "Resolution Notes" or split into "Debug Log" + "Spec Deviations" | QUESTION — labeling clarity; no word impact. |
| structure | AC #11 (legacy migration prose) | Keep verbatim | PRESERVE — spec being audited. |

### Lens: Editorial Prose (13 findings, dedup'd)

Voice & style: Dev Notes uses terse engineering-brief register with second-person imperatives and AD-citation shorthand (intentional, preserve). Dev Agent Record uses third-person machine-narrative voice with em-dash telegraphic bullets (non-negotiable). Subtasks read as checklist with imperative-staccato cadence (preserve). Legacy migration table is compact and must survive. Established acronyms (AD, AC, FR, DoD, IIFE, FOUC, ES5) are expected knowledge.

| Pass | Original Text | Revised Text | Changes |
|---|---|---|---|
| prose | Dev Notes §1 + items 2/4/5 (parenthetical "only theme.js does" + duplicated MUST-read pointers) | One-line pointer per item; drop parenthetical | Trim per structure-pass merge. |
| prose | Dev Notes §121–127 ('the dev agent MUST' repeats across items) | Drop 'the dev agent MUST' where section header already conveys imperative | Reduce imperative repetition. |
| prose | Dev Notes §112–118 (five AD restatements) | "Honor AD-6 namespaces + ht.theme grandfather; AD-11 registry is privacy source of truth; AD-12 no build; AD-13 one-way dep; AD-14 contract entries required." | Collapse to one sentence. |
| prose | Dev Notes §164–167 (Architectural ambiguity subsection) | Cut entirely | Per structure-pass MERGE. |
| prose | Dev Notes §147–151 (three out-of-scope bullets) | "Out of scope: closing the FOUC IIFE raw localStorage read in index.html:9 (separate story)." | Per structure-pass CONDENSE. |
| prose | AC #11 (inline 11-key enumeration) | "(listed in Dev Notes → Legacy tool key migration)" | Duplicates Dev Notes table. |
| prose | Dev Notes §131 ("warns in dev, throws in CI" quoted) | Drop quote; reference AC #3 | Already in AC #3. |
| prose | Task 9.1 ('rename each legacy key ... update the `var STORAGE = '...'` constant in each tool file') | "rename each legacy constant to the new key" | Example redundant with bullets. |
| prose | Dev Notes §201 ("Dev agent runs") | "run `make ci` after editing any storage-touching file and verify the gate passes." | MSWG — second-person implied. |
| prose | Dev Notes §205 ("exactly as the architecture spine's Structural Seed specifies") | "per the architecture spine's Structural Seed (ARCHITECTURE-SPINE.md:245)." | "exactly as … specifies" is filler. |
| prose | Dev Notes §212 (SHOUT-case 'NOT') | Consider: preserve SHOUT-case as intentional reviewer-red-flag emphasis | Intent conflict with MSWG; preserve. |
| prose | Definition of DoD §153 (SHOUT-case 'ALL') | "all" (lowercase) per MSWG | MSWG — no SHOUT-case emphasis. |
| prose | Dev Notes intro narrative (scattered 'the dev agent MUST/must/does/should') | Vary pronoun or drop subject where implied | Reduce subject repetition. |

8 further minor fixes; ask to expand.

---

## Action plan (this session)

**Addressed in code (4 high-leverage fixes):**
1. `HT.storage.clear()` sweeps legacy keys (closes AD-11 privacy invariant).
2. Pre-commit hook cross-checks `register()` call sites in `storage-registry.js` against the chrome.html manifest entries.
3. `applyLegacyFallback` validates migrated values against the registered schema and surfaces `writeRaw` failure.
4. `set()` surfaces quota errors via `writeRaw` return check + `console.warn`.

**Deferred to follow-up story:**
- Template-literal / indirect-call-site gate hardening (8 findings)
- Editorial story-file trim (~1,040 words, ~23%) — 24 findings
- `remove()` boolean return, `keys()` ordering, dedup guard, boot-order harness, FOUC IIFE verification, `clearAllLocalData` runtime test (10 findings)
- isDebugMode gating, legacy table single-source, schema-validated get() (4 findings)
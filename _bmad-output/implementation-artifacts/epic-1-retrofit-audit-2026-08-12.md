# Epic 1 Retrofit Audit — Apply Epic 2/3 Standards Retroactively

**Date:** 2026-08-12
**Auditor:** Amelia (Developer)
**Project:** useful-tools
**Scope:** All 16 Epic 1 stories (1.1 through 1.16)
**Workflow:** Read-only audit; produces concrete retrofitting action items

---

## Why this audit happened

Epic 1 shipped 16 stories as the foundational Shell + Tool Contract work. At the time we did not have the review discipline we developed in Epic 2 and Epic 3 — no second-pass reviews, no negative-test batteries, no vacuous-pass guards standardized, no residue-tracking convention. This audit applies the lessons from the Epic 2 and Epic 3 retros to Epic 1 retroactively and produces a list of retrofitting action items.

**Method:** Read each story's Dev Agent Record + File List + Tasks/Subtasks + Status, then cross-reference against the 12 patterns we now apply. Spot-check claims directly against the codebase before recording an action item. Filter out hallucinated specifics.

---

## Findings (verified)

### F1 — Vacuous-pass guard already in place

`_smoke_regression_sweep.js:905-908` already has `if (ready.length === 0 || totalChecks === 0) { console.error('VACUOUS — no checks executed'); process.exit(2); }`. The audit prompt's claim that the guard was missing was incorrect. **No action needed.**

### F2 — `baseline_commit` missing on 4 of 16 stories

Stories 1.13, 1.14, 1.15, 1.16 have no `baseline_commit:` in their YAML frontmatter (verified via grep). Per AI-E1-1, every story needs one. **Action needed:** AI-E1-9.

### F3 — Storage-registry manifest drift (verified)

`storage-registry-gate.py:159` parses the inline manifest in `chrome.html` and checks it against `register()` calls in `storage-registry.js`. The gate VERIFIES agreement at CI time but does NOT auto-inject — every new `register()` call requires the dev agent to also update the manifest block in `chrome.html`. This is the architectural smell that caused Story 3.12's schema drift (`array<string>` vs `object<slug:iso8601>`). Per AI-E3-4 (Epic 3 retro). **Action needed:** AI-E1-10.

### F4 — Magic numbers still inlined (verified)

`tools.schema.json:215` has `history-keys` `maxItems: 10` as an inline literal. `assets/js/shell.js` (Story 1.6) has the theme cycle (`auto → light → dark → auto`) as an inline array literal. `assets/js/search.js` (Story 1.11) embeds ranking-tier scores (`1000`, `500`, `200`, `50`, `10`) directly in code. Per AI-E2-2 (Epic 2 retro) + AI-E3-8 (Epic 3 retro). **Action needed:** AI-E1-11.

### F5 — Residue tracking missing on stories 1.4, 1.7, 1.11-1.16

Eight stories (1.4, 1.7, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16) have `Status: done` but no `## Residue` block, no `## Deferred` section, or have empty placeholder sections in Dev Agent Record. Per AI-E3-6 (Epic 3 retro). **Action needed:** AI-E1-12.

### F6 — String/comment-aware scanning still needed

`scripts/shell-bounds-check.py` uses substring match for `localStorage.`, `fetch(`, `XMLHttpRequest`. A tool whose JS contains `// fetch the URL` in a comment will FAIL (false positive). `scripts/_es5_grep.py` (Epic 2/3) and the Epic 1 `INDIRECT_RE` in `storage-registry-gate.py:30-35` rely on denylists that miss new ES2018+ reserved words. Per AI-E1-4 (Epic 1 retro). **Action needed:** AI-E1-13.

### F7 — Smoke harness coverage gap

Epic 1 Python gates: `validate-tools-json`, `rubric-lint`, `tool-contract-gate`, `tool-inventory`, `shell-drift-check`, `shell-a11y-check`, `storage-registry-gate` (~7 Python gates total). Epic 1 Node smokes: `storage-smoke.html`, `compound-smoke.html`, `verify-compound-fix.py`, `_smoke_settings_modal.js`. Epic 3 Node smokes: 23 files, 1,400+ assertions. The Epic 1 harness budget is reasonable for greenfield but lacks (a) search-perf harness (`_smoke_search_perf.js` would verify Story 1.11's AC-8 perf budget ≤ 50ms cold / ≤ 10ms warm), (b) negative-fixture companions for sweep-like harnesses (rubric-lint, tool-inventory). Per AI-E2-1 (Epic 2 retro). **Action needed:** AI-E1-14.

### F8 — Embed-mode guard retroactively applied

Story 1.6's Spec Change Log entry references `?embed=1` hiding the theme toggle; Story 1.7 hides the palette trigger; Story 1.8 hides the settings cog. The pattern (`_isEmbed()` + `data-embed-suppressed="1"`) is consistent with the Story 3.6 codification. **No action needed** — pattern is honored retroactively.

### F9 — Frozen-internal handle pattern not applied to surfaces

Per Epic 3 Pattern 1: every new surface should have a `HT_X_INIT` / `HT_X_VERSION` constant. The api-contract.js version covers the contract globally, but individual surfaces (palette, settings, search, storage, home-grid) lack per-surface handles. **Low priority.** **No action needed for now.**

### F10 — Byte-aligned drift gate brittleness

`scripts/shell-template.py` uses byte-aligned chrome regions (`<!-- shell:header -->` to `<!-- shell:footer -->` markers) for the drift check. Pattern is brittle; per AI-E3-5 (Epic 3 retro), should be replaced with structural DOM walk. **Action needed but high-risk:** AI-E1-15.

### F11 — Documentation debt

`docs/` directory has no central index (`docs/README.md` or `docs/index.md`). AI-E1-5 through AI-E1-8 (Epic 1 retro deferred items) reference patterns that should be documented but have no clear home. **Action needed:** AI-E1-16.

### F12 — Vacuous story-file sections

Stories 1.4, 1.7 have `Tasks/Subtasks` sections that are entirely `[ ]` (unchecked) but `Status: done`. This is a contradiction the sprint-status workflow should flag at submission time. **Action needed (subsumed by F5):** AI-E1-12 covers residue-block retrofit which surfaces these.

---

## Filtered-out findings (not pursued)

The audit prompt returned several claims that did not survive verification:

- **F1.1 (vacuous-pass guard missing in `_smoke_regression_sweep.js:306`)** — guard exists at line 905. False alarm.
- **F2.1 (rubric-lint.py missing negative fixtures for criteria 4, 6, 7)** — Epic 2/3 retrofits may have addressed these; needs verification per criterion before recording. Lower priority than F3-F7.
- **F8.1 (pre-Story-1.6 epoch `?embed=1` violated AD-7)** — embed mode was added in Story 1.6 retroactively per its Spec Change Log; pre-1.6 epoch shipped before embed mode existed. No retroactive bug to fix.
- **O.1 (template mismatch — frozen-after-approval vs bmad-style Tasks/Subtasks)** — Epic 1 stories use a different template (likely approved before Epic 2's bmad cycle was standard); intentional evolution, not a defect.

---

## Recommended Retrofit Priority

| # | Action item | Effort | Impact |
|---|---|---|---|
| 1 | AI-E1-9 (populate `baseline_commit` on 4 stories) | 1 h | low (workflow hygiene) |
| 2 | AI-E1-10 (auto-inject storage-registry manifest) | 4 h | high (eliminates drift class) |
| 3 | AI-E1-11 (hoist magic numbers to named consts) | 4 h | medium (single-source for caps) |
| 4 | AI-E1-12 (residue-block retrofit on 8 stories) | 8 h | medium (surfaces hidden debt) |
| 5 | AI-E1-13 (AST-based gate scanners) | 8 h | high (eliminates false positives) |
| 6 | AI-E1-14 (search-perf smoke + negative-fixture battery) | 7 h | medium (closes Epic 1 coverage gap) |
| 7 | AI-E1-15 (replace byte-aligned gates with DOM walk) | 12 h | high (long-term brittleness fix) |
| 8 | AI-E1-16 (docs/README.md index) | 1 h | low (discoverability) |

**Total estimated effort: ~45 hours.**

**Critical path:** AI-E1-10 (storage-registry auto-inject) and AI-E1-13 (AST scanners) are the highest-leverage fixes. They close the drift class that bit us in Story 3.12 and the false-positive class that plagued the gate scripts since Epic 1.

**No critical path before Epic 4.** All 8 items can land during Epic 4's first sprint as parallel work, mirroring how Epic 3's parallel items landed during Epic 3's first sprint.

---

## Action items added to sprint-status.yaml

- **AI-E1-9** (low): Populate `baseline_commit` on Stories 1.13, 1.14, 1.15, 1.16.
- **AI-E1-10** (high): Auto-inject storage-registry manifest into `chrome.html` from `register()` calls.
- **AI-E1-11** (medium): Hoist magic numbers (`HISTORY_CAP`, `THEME_CYCLE`, `RANKING_TIERS`, `WHO_DELTAS`) to named consts.
- **AI-E1-12** (medium): Add `## Residue & Deferred` block to Stories 1.4, 1.7, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16.
- **AI-E1-13** (medium): Switch `storage-registry-gate.py` and `shell-bounds-check.py` from regex to AST using vendored `acorn`.
- **AI-E1-14** (medium): Add `_smoke_search_perf.js` (≤ 50ms cold / ≤ 10ms warm) + negative-fixture battery for sweep-like harnesses.
- **AI-E1-15** (medium): Replace shell-template byte-aligned gates with structural DOM walk.
- **AI-E1-16** (low): Author `docs/README.md` index.

---

## Conclusion

Epic 1 is broadly well-instrumented for a foundational epic — 7 Python gates, 2 HTML browser smokes, 1 Node smoke. The 8 retrofit items above close the gap to Epic 2/3 standards without rewriting Epic 1 code. None are blocking Epic 4. The highest-leverage items (AI-E1-10 storage-registry auto-inject, AI-E1-13 AST scanners) eliminate drift classes that have already cost us review cycles (Story 3.12 schema drift).

**Audit complete. No files modified.** Retrofitting action items appended to `sprint-status.yaml` for Epic 4 first-sprint capture.

**Auditor:** Amelia (Developer)
**Workflow:** Read-only audit (no files modified)
**Source artifact:** `_bmad-output/implementation-artifacts/epic-1-retrofit-audit-2026-08-12.md`
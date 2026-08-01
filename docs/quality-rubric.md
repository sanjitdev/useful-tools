---
title: Handy Tools — Quality Rubric
rubricVersion: 1
schemaVersionRef: 1
status: active
updated: 2026-07-31
---

# Handy Tools — Quality Rubric

This document is the **rubric of record** for the 8/10 Tool Quality Bar (PRD §4.1,
FR-1, FR-2, FR-3). It is versioned alongside `tools.schema.json`. The companion
linter at `scripts/rubric-lint.py` reads `tools.json` plus each tool's folder to
emit a Markdown report; this doc names every criterion, its mechanical signal,
and the per-criterion remediation hint surfaced when the criterion fails.

A tool ships (`ready: true`) only when its score is **≥ 8/10** *or* it carries a
structured waiver (per FR-2 and `tools.json`'s `score-waiver` field). The JSON
Schema enforces shape; this rubric (and `scripts/rubric-lint.py`) enforces
*semantics*. Story 1.3 wires the same check into GitHub Actions CI.

## Scoring & Gate

| Aspect | Rule |
|---|---|
| Per-criterion result | `PASS` (counts 1) · `FAIL` (counts 0) · `MANUAL` (counts 0, reviewer must run the manual checklist) · `WARN` (counts 1, soft signal) |
| Total score | `PASS + WARN` count, max 10 |
| Ready gate | Score ≥ 8 *and* `ready: true` in `tools.json` (per AD-2) |
| Waiver | `score-waiver` field with `reason`, `since-release`, `reviewer`, `expires-after-releases`. Story 1.3 owns CI expiry enforcement |
| Linter exit | 0 = pass · 1 = score/ready mismatch · 2 = slug/file missing · 3 = schema invalid · 4 = sub-8 with waiver in effect |

### Gate truth table (AD-2)

`ready: true` is allowed iff *all* of the following hold:

| Linter score | Persisted `score` | `ready` | `score-waiver` | Outcome | Exit code |
|---|---|---|---|---|---|
| ≥ 8 | set | `true` | absent | **PASS** | 0 |
| ≥ 8 | set | `false` | absent | **MISMATCH** | 1 |
| < 8 | set | `true` | absent | **MISMATCH** | 1 |
| < 8 | set | `false` | present (not expired) | **WAIVER** | 4 |
| < 8 | set | `true` | present (not expired) | **PASS** (manual review completed) | 0 |
| < 8 | set | `false` | absent | **FAIL** | 1 |
| ≥ 8 | unset | `true` | absent | **MISMATCH** (reviewer hasn't set `score`) | 1 |

Persisted `score` is the *reviewed* score (a human set it after the manual
phase). The linter writes its mechanical score to the report but does not
overwrite `score`. Story 1.3 (CI Gate) enforces the same truth table on
every push.

**Important (AD-2):** `tools.schema.json` does **not** enforce
`ready=true ⇒ score≥8`. The schema keeps shape and the linter keeps semantics.
Story 1.3 (CI Gate) is the application-layer enforcement point.

## The Ten Criteria

Each criterion below is captured as: **Definition** · **Manual verification** ·
**Automated check** (what `scripts/rubric-lint.py` looks for) · **Pass condition** ·
**Failing-mode remediation**.

### 1. Keyboard-complete

All inputs are reachable via Tab. The primary action is reachable via Enter or a
declared shortcut. No mouse-only interaction. Tab order matches visual order.

| Signal | What to check |
|---|---|
| Manual | Tab through every interactive element — focus is always visible (`:focus-visible`), Tab order matches visual order, primary action triggers on Enter. |
| Automated | Soft signal: tool's JS contains a `keydown` / `keypress` / `keyup` listener **or** a `<button>` / `<form>` triggerable by Enter. Absence ⇒ `WARN` with remediation. |
| Pass | No mouse-only affordance (slider, drag, hover-only) blocks core flow. |
| Remediation | "No keyboard listener detected; verify Tab/Enter reach every input manually — add `addEventListener('keydown', …)` if a shortcut is intended." |

### 2. Mobile ergonomics

Single-hand usable on a **360 px** viewport. Tap targets ≥ **44 px**. No
hover-only affordances. No horizontal scroll on the default viewport.

| Signal | What to check |
|---|---|
| Manual | Open the tool in DevTools at 360 px. Tap each control with a thumb. No horizontal scroll. No tooltip-only hints. |
| Automated | CSS heuristic: tool's CSS contains no `width: <px>` rule with a width less than 360 px AND no tap-target smaller than 44 px (regex sweep). `WARN` if any heuristic triggers. |
| Pass | All controls usable single-handed at 360 px. |
| Remediation | "<control> tap target is <px>px wide; raise padding so min(W,H) ≥ 44 px (PRD §4.1)." |

### 3. Offline ready

Once visited, the tool works without network. No external fonts, scripts, or
images. The service worker (Epic 5) caches the Shell and per-Tool assets.

| Signal | What to check |
|---|---|
| Manual | After first visit, disable network in DevTools and reload — tool still works. |
| Automated | Tool's HTML/JS contains no `https://` script/style/image URL **and** no `cdn.` reference **and** no `fonts.googleapis` / `fonts.gstatic` link. Any hit ⇒ `FAIL` (AD-1 violation). |
| Pass | No `<script src>`, `<link href>`, or fetch points to an external host. Vendored libraries under `assets/js/vendor/` (e.g., `qrcode.js`) are local and exempt. |
| Remediation | "External script <url> violates AD-1 (Zero Runtime Libraries); vendor the file under `assets/js/vendor/` or replace with inline logic." |

### 4. Shareable state

Inputs and key results are encoded in the URL such that reloading reproduces the
current computation. Pasted links work. (FR-4 + Tool Contract #4.)

| Signal | What to check |
|---|---|
| Manual | Enter values, copy URL, open in a new tab — state restores. |
| Automated | `tools.json[slug].urlState.encode` is non-empty AND every `encode[].key` is mirrored in `decode[].key` AND the Tool's HTML has elements with matching `id`/`name`. Empty `urlState.encode` ⇒ `FAIL`. |
| Pass | URL hash carries the full input set; reload reproduces the result. |
| Remediation | "`urlState.encode` is empty; declare each input field under `encode[]`/`decode[]` so AD-5 (URL is canonical state) holds." |

### 5. Printable

A `@media print` stylesheet renders a clean black-on-white output, hides chrome,
and supports multi-page result sets.

| Signal | What to check |
|---|---|
| Manual | `Ctrl-P` (or `⌘P`) preview shows: chrome hidden, body text in black on white, results visible, no clipped pages. |
| Automated | Tool's CSS contains `@media print` (case-insensitive). Absence ⇒ `FAIL`. |
| Pass | Print preview is single-column, readable, no interactive chrome. |
| Remediation | "No `@media print` block in <slug>.css; add one that hides the header/footer and forces black-on-white text." |

### 6. Sample data

A "Try an example" button populates inputs with realistic data so a first-time
visitor sees the tool work in ≤ 5 seconds.

| Signal | What to check |
|---|---|
| Manual | Land on the tool with empty inputs — a sample-data control is visible, populated inputs produce a non-trivial result. |
| Automated | Tool's JS contains the literal phrase `Try example`, `Try an example`, `Load sample`, or a `data-sample` attribute. Absence ⇒ `FAIL`. |
| Pass | Sample data renders a meaningful result without the user typing anything. |
| Remediation | "No sample-data button detected; add a control labeled 'Try an example' that fills the inputs with realistic data." |

### 7. History

Last 10 inputs/outputs persisted in `localStorage` per tool, recoverable via a
visible "History" control. User can clear and export.

| Signal | What to check |
|---|---|
| Manual | Open the tool, run it a few times, reload — History panel shows the recent runs and lets you restore one. |
| Automated | `tools.json[slug].history-keys` is non-empty AND each `id` resolves to an input element in the tool's HTML. Empty `history-keys` ⇒ `FAIL`. |
| Pass | A History panel renders recent entries; restoring an entry repopulates the inputs. |
| Remediation | "`history-keys` is empty; declare the input ids whose values belong in `handy-tools.history.<slug>`." |

### 8. Error recovery

Invalid inputs preserve user input, identify the failing field, explain the
fix, and offer a sample. No silent coercion of dangerous values.

| Signal | What to check |
|---|---|
| Manual | Type an invalid value (e.g., letters into a number) — input is preserved, the failing field is marked, and a one-line explanation names the fix. |
| Automated | Tool's HTML/JS contains at least one of: `role="alert"`, `aria-invalid`, `aria-describedby` (paired with a `.field-error` or `[data-error]` element). Absence ⇒ `WARN`. |
| Pass | All validation messages surface inline at the failing field; no silent coercion. |
| Remediation | "No error-recovery markers detected; verify each input renders inline errors with `role='alert'` + `aria-invalid`." |

### 9. Accessible

Visible focus. WCAG 2.1 AA contrast. ARIA labels on inputs.
`prefers-reduced-motion` honored. Tool works in VoiceOver / NVDA.

| Signal | What to check |
|---|---|
| Manual | Tab through every control with VoiceOver/NVDA on — focus is announced, controls have accessible names. Toggle `prefers-reduced-motion` — animations stop. |
| Automated | Manual-only. (Mechanical WCAG / SR testing belongs in Story 1.13's audit scaffold — axe-core and a headless harness.) |
| Pass | WCAG 2.1 AA conformance per DESIGN.md contrast tokens; SR-navigable. |
| Remediation | "Run WCAG 2.1 AA checklist in `docs/quality-rubric.md#9-accessible`; revisit DESIGN.md cobalt tokens for ≥ 4.5:1 contrast." |

### 10. Source visible

The tool's `index.html` opens with a "View source" link to the repo path. No
minification. Build artifacts ship only when the source is also visible.

| Signal | What to check |
|---|---|
| Manual | The Tool footer has a "View source" link pointing to `tools/<slug>/index.html` on the public repo (per AD-11 trust surface). |
| Automated | Manual-only. (`tools.json[slug].view-source.path` is checked by Story 1.12's view-source route — that story owns the cross-field + filesystem check.) |
| Pass | "View source" link present in footer and works on the public repo URL. |
| Remediation | "Add a footer link 'View source' → `<repo>/blob/main/tools/<slug>/index.html>` (per AD-11 + FR-16)." |

## Mechanical-signal coverage matrix

| # | Criterion | Mechanical? | Signal type |
|---|---|---|---|
| 1 | Keyboard-complete | yes (soft) | `WARN` if no keydown listener |
| 2 | Mobile ergonomics | partial (CSS heuristic) | `WARN` if heuristic triggers |
| 3 | Offline ready | yes | `FAIL` if external host detected |
| 4 | Shareable state | yes | `FAIL` if `urlState.encode` empty |
| 5 | Printable | yes | `FAIL` if no `@media print` |
| 6 | Sample data | yes | `FAIL` if no sample-data marker |
| 7 | History | yes | `FAIL` if `history-keys` empty |
| 8 | Error recovery | partial | `WARN` if no error markers |
| 9 | Accessible | no | `MANUAL` |
| 10 | Source visible | no | `MANUAL` |

Two of ten criteria (`Accessible`, `Source visible`) are fully manual — the
linter can verify the contract fields (`view-source.enabled`, `view-source.path`,
file existence) but the actual rendered footer link and the WCAG 2.1 AA
review are reviewer work. Eight criteria have at least one mechanical signal.
PRD FR-1 explicitly excludes "runtime programmatic scoring" from MVP scope;
manual or CI-asserted only.

## Versioning

This document declares `rubricVersion: 1` and `schemaVersionRef: 1` in its
frontmatter. Changes to criteria require a PR that:

1. Updates the rubric doc's `rubricVersion` (bumped on major rewrites, additive
   sub-criteria don't require a bump).
2. Updates `scripts/rubric-lint.py` to match (when mechanical signals change).
3. Updates `_bmad-output/implementation-artifacts/deferred-work.md` if a
   criterion moves between mechanical/manual/coverage categories.

The doc is checked into the repo alongside `tools.schema.json` so the rubric
cannot drift from the schema in version control.

## Cross-walk to `tools.json` semantics

| `tools.json` field | Rubric relationship |
|---|---|
| `score` (integer 0–10) | Mechanical count of `PASS` + `WARN` results. Manual-criterion entries (`Accessible`, `Source visible`) count toward `score` only when a reviewer marks them `PASS` in the audit doc (`docs/quality-audit.md`, Story 1.13). |
| `ready` (boolean) | `true` ⇔ `score ≥ 8` AND `score-waiver` either absent or not expired. **The schema does not enforce this; Story 1.3 CI Gate does.** |
| `score-waiver` | Allows a tool below 8 to ship with justification. Expiry (two releases per PRD) is owned by Story 1.3. |
| `urlState.encode/decode` | Mechanical signal for criterion #4. |
| `history-keys` | Mechanical signal for criterion #7. |
| `view-source.path` | Cross-checked against `tools/<slug>/index.html` existence — owned by Story 1.12. |
| `last-updated` | Bumped whenever the rubric is re-run for this tool; surfaced on `/quality` (Story 5.8). |

## See also

- PRD §4.1 (Tool Contract / Quality Bar) — `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md`
- AD-2 (Tool Contract rule), AD-3 (Site Data), AD-11 (Trust Surface) — `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md`
- Story 1.13 (Audit Scaffold) — `_bmad-output/planning-artifacts/epics.md`
- `tools.schema.json` — companion schema
- `scripts/rubric-lint.py` — companion linter
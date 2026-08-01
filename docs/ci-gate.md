---
title: Tool Contract CI Gate — Contract Document
gateVersion: 1
schemaVersionRef: 1
status: active
updated: 2026-08-01
---

# Tool Contract CI Gate — Contract Document

This document is the **contract of record** for `scripts/tool-contract-gate.py`
and the GitHub Actions workflow `.github/workflows/tool-contract-gate.yml`. It
is versioned alongside `tools.schema.json`; the schema's `schemaVersion`
bump implies a doc review. The companion script is generated from this
doc — when the truth table below changes, the script changes with it.

The gate implements PRD **FR-2** (Tool Contract Gate) and architecture
**AD-2** (Tool Contract rule). The companion rubric is `docs/quality-rubric.md`;
that doc's "Scoring & Gate" section is the source of truth for the truth
table; this doc reproduces it so a maintainer can read either file
independently and arrive at the same answer.

## What the gate checks

The gate walks every entry in `tools.json` and applies the following
truth table to each one. The gate's exit code is the OR of every entry's
outcome: 0 if all entries pass (or all sub-8 are under unexpired
waivers); 1 if at least one entry violates the table.

| Linter score | Persisted `score` | `ready` | `score-waiver` | Outcome | Exit contribution |
|---|---|---|---|---|---|
| — | `>= 8` | `true`  | absent                       | **PASS**      | 0 |
| — | `>= 8` | `false` | absent                       | **MISMATCH**  | 1 |
| — | `< 8`  | —       | absent                       | **FAIL**      | 1 |
| — | `< 8`  | `true`  | absent                       | **MISMATCH**  | 1 |
| — | `< 8`  | `false` | present, not expired         | **WAIVER**    | 0 |
| — | `< 8`  | `true`  | present, not expired         | **PASS** (manual review completed) | 0 |
| — | `< 8`  | `false` | present, expired             | **EXPIRED**   | 1 |

The persisted `score` is the **authoritative reviewed score** (a human
sets it after the manual-criterion review phase). The rubric linter's
mechanical output is informational — the gate does not re-run it. The
relationship between the linter and the gate is documented in
`docs/quality-rubric.md#Cross-walk to tools.json semantics`.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | All entries pass, or all sub-8 entries are under unexpired waivers. |
| 1 | At least one entry is in MISMATCH, FAIL, or EXPIRED. |
| 2 | `tools.json` is missing or unparseable. |
| 3 | `tools.json` has a top-level type error (not a dict, no `tools` array, or `releaseVersion` is not valid SemVer). |

## Adding a waiver

A waiver is a structured object on a `tools.json` entry that allows a
sub-8 tool to ship with justification. The schema's `score-waiver`
definition is the source of truth for the shape:

```json
"score-waiver": {
  "reason": "Brownfield migration; rubric re-audit scheduled.",
  "since-release": "0.1.0",
  "reviewer": "sanjit",
  "expires-after-releases": 2
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `reason` | string (non-empty) | yes | Human-readable justification surfaced in `/quality`. |
| `since-release` | SemVer string | yes | The `tools.json[releaseVersion]` value at the time the waiver was granted. The gate uses this as the start of the waiver's lifetime. |
| `reviewer` | string (non-empty) | yes | The maintainer who approved the waiver. Surfaced in `/quality`. |
| `expires-after-releases` | integer (≥ 1) | yes | How many release events the waiver covers (the granting release + `expires-after-releases - 1` subsequent releases). FR-2 specifies "two releases" as the default; longer-lived waivers are permitted when explicitly justified. |

The gate reads the waiver object as-is. It does not introduce new schema
fields. If a future waiver needs more metadata (e.g., a `granted-at`
timestamp), that change lands in `tools.schema.json` first, then here.

## Waiver expiry

FR-2 specifies "two releases." The gate implements this as follows:

- The waiver's lifetime starts at the release that has
  `tools.json[releaseVersion] == score-waiver.since-release` (inclusive).
- The lifetime ends at the release that has
  `tools.json[releaseVersion] > score-waiver.since-release + (expires-after-releases - 1) SemVer bumps`.
- A waiver with `expires-after-releases: 2` therefore covers the
  release it was added in plus the next release — two release events
  total.

### Worked example

| Release | `score-waiver.since-release` | `tools.json[releaseVersion]` | `expires-after-releases` | Outcome |
|---|---|---|---|---|
| 0.1.0 | 0.1.0 | 0.1.0 | 2 | **WAIVER** (1 of 2 covered; distance = 1) |
| 0.1.1 | 0.1.0 | 0.1.1 | 2 | **WAIVER** (2 of 2 covered; distance = 2) |
| 0.1.2 | 0.1.0 | 0.1.2 | 2 | **EXPIRED** (3 patch bumps; distance = 3) |
| 0.2.0 | 0.1.0 | 0.2.0 | 2 | **WAIVER** (1 minor bump; distance = 2 = `expires-after-releases`) |
| 0.2.1 | 0.1.0 | 0.2.1 | 2 | **EXPIRED** (1 minor + 1 patch bump; distance = 3 > 2) |

The gate counts the **number of release events** in the inclusive range
`[since-release, current-release]`. A SemVer major/minor/patch bump is
one release event. The gate does not count prereleases as separate
events (a waiver granted in `0.1.0-alpha` covers `0.1.0` and `0.1.1` —
the prerelease and the release are the same release for expiry
purposes).

When Epic 5 lands `sw.js`, the gate will read the actual release log
(`/locales/release-history.json` or similar) and use that as the
authoritative history. The current implementation counts SemVer bumps
as a conservative proxy; this is noted in the deferred-work ledger.

## Local reproduction

The gate runs identically locally and in CI. To reproduce the gate
against the current working tree:

```bash
# All three: validator, linter, gate.
make ci

# Just the gate:
make gate

# Print the gate's contract (one-liner reference):
make gate-list
```

A clean `tools.json` (no entries, or every entry PASS/WAIVER) produces:

```
**Summary:** N pass · M waivered · 0 failed.
```

A violating `tools.json` produces a non-zero exit code and surfaces the
named entry in the report's "Fail" / "Mismatch" / "Waiver expired"
group. The CI workflow's "Enforce AD-2 gate" step exits with the same
code; the PR check fails; the PR cannot merge.

### Synthesizing a violation

To verify the gate locally, edit `tools.json` (or a copy) so that one
entry has `score: 2, ready: true` (no waiver). Running `make gate`
exits 1 with a MISMATCH row for the slug. Restore the file when done;
the seed file's `tools: []` produces exit 0 and is the only path
checked into the repo.

## Bypassing the gate

The gate is enforced by **GitHub branch protection** on `main`. The
required check is named `Tool Contract Gate` (the workflow's `name:`
field). The check is configured on the GitHub repo's Settings →
Branches page; not in code.

The only escape hatch is a `score-waiver`. The waiver's `reviewer`
field names the human who granted it; the waiver's `reason` is
surfaced on `/quality`; the waiver's expiry is enforced by the gate
without further human intervention. There is no `--no-verify` style
bypass; none exists by design.

## Versioning

This document declares `gateVersion: 1` and `schemaVersionRef: 1` in
its frontmatter. Changes to the truth table require a PR that:

1. Updates this doc's truth table.
2. Updates `scripts/tool-contract-gate.py` to match (the script
   reproduces the table).
3. Updates `docs/quality-rubric.md#Scoring & Gate` to match (the
   rubric doc also carries the table; both docs must stay in sync).
4. Updates `tools.schema.json`'s `score-waiver` definition if the
   shape changes (e.g., a new required field).
5. Bumps `gateVersion` on a major rewrite; additive sub-rules
   (e.g., a new outcome) do not require a bump.

The doc is checked into the repo alongside `tools.schema.json` and
`docs/quality-rubric.md` so the three sources of truth cannot drift
in version control.

## See also

- PRD §4.1 FR-2 (Tool Contract Gate) — `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md`
- AD-2 (Tool Contract rule) — `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md`
- Rubric truth table — `docs/quality-rubric.md#Scoring & Gate`
- Companion script — `scripts/tool-contract-gate.py`
- GitHub Actions workflow — `.github/workflows/tool-contract-gate.yml`
- Validator (Story 1.1) — `scripts/validate-tools-json.py`
- Linter (Story 1.2) — `scripts/rubric-lint.py`

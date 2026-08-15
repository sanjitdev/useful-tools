# docs/ — Reference index

This directory holds reference documentation that supplements the BMad
artifacts in `_bmad-output/` (PRD, architecture, epics, retrospectives)
and the code itself. Every document here is **hand-authored and
version-controlled** — the index below tells a new contributor (or a
returning reviewer) which doc answers which question.

---

## When to look here

The BMad planning artifacts describe **what** the project is and
**why**. The files in this directory describe **how the pieces
fit together** and **which gate / smoke / convention enforces each
invariant**. Reach for a `docs/` file when:

- A gate failure references a contract or rubric you haven't read
- You're about to add a tool and need to know which standards apply
- You're auditing drift between code and documented behavior
- You're packaging a tool into a pack and need the taxonomy

If the question is "what does the codebase look like", look at the
code or `tools.json` first. If the question is "why is it shaped
that way", look in `_bmad-output/`.

---

## Index

| Doc | Covers |
| --- | --- |
| [`ci-gate.md`](ci-gate.md) | Contract of record for the Tool Contract CI gate (`scripts/tool-contract-gate.py`). Versioned with `tools.schema.json`; the script is generated from this doc's truth table. |
| [`quality-rubric.md`](quality-rubric.md) | 10-criterion quality rubric every tool is scored against. The "Scoring & Gate" section is the source of truth the CI gate enforces. |
| [`quality-audit.md`](quality-audit.md) | Latest audit run + historical scores per tool. Tracks the rubric score trend across waves and surfaces tool drift. |
| [`tool-inventory.md`](tool-inventory.md) | Snapshot of the tool roster: slug, title, owner story, pack membership, last-updated timestamp. Companion to `tools.json` but human-readable. |
| [`tool-ideas.md`](tool-ideas.md) | Parking lot for tool concepts not yet promoted to `tools.json`. Each idea has a one-liner rationale + the epic it would belong to. |
| [`pack-taxonomy.md`](pack-taxonomy.md) | Definition of the 5 packs (productivity, finance, health, planning, education). Which tools belong, ordering rules, the `dashboard` schema. |
| [`shell-public-api.md`](shell-public-api.md) | The `HT.*` frozen-public surface (AD-14): every method, signature, version, and the gate that enforces it (`shell-public-api-smoke`). The mirror of `assets/js/api-contract.js` in prose. §10 documents the canonical tool-script load order with the bug story (post-home-redesign retrofit). |
| [`bundle-size-budget.md`](bundle-size-budget.md) | Per-module gzipped breakdown of the chrome surface (162,915 bytes JS + 22,480 bytes CSS as of 2026-08-15), the NFR-1 gap (5.4× over the 30 KB JS target), top-3 reduction candidates, and the Story 4 path back to < 30 KB. Companion to the `bundle-size` CI gate. |

---

## Conventions used across these docs

- **YAML frontmatter** (`title`, `updated`, `status`) is required at the top of every doc except this index. Frontmatter is how the audit scripts and search filters locate docs — don't drop it.
- **`updated:` date** must bump on every meaningful edit. The retro audits use it to surface stale docs.
- **`status: active | draft | deprecated`** — `draft` means under review, `deprecated` means superseded by a code change and safe to delete after one release cycle.
- **Cross-references** between docs are anchored file paths (`docs/quality-rubric.md#scoring--gate`), not section numbers — section numbers drift.

---

## Companion artifacts outside this directory

- **`_bmad-output/planning-artifacts/`** — PRD, architecture, epics, UX
- **`_bmad-output/implementation-artifacts/`** — story files, sprint status, retro/audit notes
  - [`post-home-redesign-retrofit-2026-08-13.md`](../_bmad-output/implementation-artifacts/post-home-redesign-retrofit-2026-08-13.md) — retrofit audit for the post-home-redesign fix round (4 commits: home polish + 2 boot crashes + category spacing + load-order doc)
- **`_bmad/bmm/config.yaml`** — workflow configuration (comm language, output paths)
- **`assets/js/api-contract.js`** — machine-checkable mirror of `shell-public-api.md`
- **`tools.schema.json`** — machine-checkable mirror of `ci-gate.md`'s truth table

If you spot a doc that's missing from this index, add a row — the
index is the entry point.

---

**AI-E1-16:** added 2026-08-12 in response to the Epic 1 retrofit audit
(`_bmad-output/implementation-artifacts/epic-1-retrofit-audit-2026-08-12.md`,
finding F11). The audit found AI-E1-5 through AI-E1-8 (Epic 1 deferred
items) referenced patterns that should be documented but had no
discoverable home. This index is the home.

**Updated 2026-08-13:** added a Companion-artifacts row pointing to the
post-home-redesign retrofit audit (`_bmad-output/implementation-artifacts/post-home-redesign-retrofit-2026-08-13.md`).
The audit captured four bug classes (category spacing, shell.js TDZ,
HT.$ load order, undocumented `utils.js` helpers) and surfaced four
follow-up items; the shell-public-api.md link got an inline §10 pointer.

**Updated 2026-08-15:** added a row pointing to `bundle-size-budget.md`
(Story x-3). The doc captures the per-module gzipped breakdown
(162,915 bytes JS, 22,480 bytes CSS), explains the NFR-1 gap (5.4×
over the 30 KB JS target), and identifies the top-3 reduction
candidates + the Story 4 path back to < 30 KB. The
`scripts/bundle-size-gate.py` gate is now wired into `make ci`.
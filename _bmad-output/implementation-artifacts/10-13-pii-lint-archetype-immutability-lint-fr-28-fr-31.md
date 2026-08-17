# Story 10.13 — PII lint + archetype immutability lint [FR-28, FR-31]

**Slug:** `pii-immutability-lints`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-12-lints.py`

---

## Context

No quiz can ship with prompts that ask for personal data. No archetype label can be derived from user input. Two regex-style gates catch both: PII patterns (email, phone, IPv4, street address) in `packs/disc/*/prompts.json` and `archetypes.json`; placeholder patterns (`{{name}}`, `{user.name}`, `{{email}}`) in archetype text.

## Goal

Ship `scripts/check-disc-pii.py` + `scripts/check-archetype-immutability.py`; wire into `tool-contract-gate.yml`; assert existing 50 tool entries are unaffected.

## Files added

| Path | Purpose |
|---|---|
| `scripts/check-disc-pii.py` | Regex lint — EMAIL_RE, PHONE_RE, IPV4_RE, STREET_RE against `packs/disc/**/*.json`. |
| `scripts/check-archetype-immutability.py` | Regex lint — `{{...}}` / `{user.*}` placeholder detection in `archetypes.json`. |
| `scripts/dc/dc-12-lints.py` | Combined AC gate — both lints + brownfield clean. |

## Files modified

| Path | Change |
|---|---|
| `tools.schema.json` | New lint allowlist field per quiz (`pii-allowlist: ["what's your favorite x"]`). |
| `.github/workflows/tool-contract-gate.yml` | Two new `run:` steps for the lints. |
| `Makefile` | `.PHONY` gains `disc-pii-lint` + `disc-immutability-lint`; `ci:` chain updated. |
| `docs/discovery-privacy-posture.md` (Story 10.17) | Documents the lint rationale + allowlist. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.13 entry. |

## Lint Patterns

```python
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
PHONE_RE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
STREET_RE = re.compile(r"\b\d+\s+\w+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b")
PLACEHOLDER_RE = re.compile(r"\{\{[^}]+\}\}|\{user\.[^}]+\}")
```

Allowlist: 3 patterns ("what's your favorite color", "what's your favorite season", "what's your favorite animal").

## Verification

- `python scripts/check-disc-pii.py` → PASS (no PII in `packs/disc/**`).
- `python scripts/check-archetype-immutability.py` → PASS (no placeholders in archetype text).
- `python scripts/dc/dc-12-lints.py` → PASS.
- Brownfield clean: existing 50 tools not scanned.

## Out-of-scope (deferred)

- Story 10.17 (docs) — the lint rationale + allowlist documentation.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*
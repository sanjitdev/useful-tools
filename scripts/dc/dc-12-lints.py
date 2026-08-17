#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-12-lints.py — AC for DC-12 / Story 10.13 (PII + archetype
immutability lints, FR-28 + FR-31).

Verifies:
  1. scripts/check-disc-pii.py exists, runs cleanly (vacuous pass if
     packs/disc/ is empty), and exits 0
  2. scripts/check-archetype-immutability.py exists, runs cleanly,
     and exits 0
  3. Brownfield clean — the existing 50 tool entries (under tools/)
     are NOT scanned
  4. Negative fixtures — synthetic packs/disc/* files containing PII
     / placeholders are caught and FAIL both lints
  5. The two lints are wired into .github/workflows/tool-contract-gate.yml
  6. The two lints are exposed as Make targets (disc-pii-lint +
     disc-immutability-lint)

Run: `make dc-12-lints` or `python scripts/dc/dc-12-lints.py`.
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import check, exit_with_summary, file_exists, read_text, repo_root


SCRIPTS = [
    ("scripts/check-disc-pii.py", "disc-pii"),
    ("scripts/check-archetype-immutability.py", "disc-immutability"),
]


def run(cmd, cwd=None, expect_rc=None):
    """Run a command and return (rc, stdout, stderr)."""
    r = subprocess.run(
        cmd, capture_output=True, text=True, cwd=cwd or repo_root()
    )
    return r.returncode, r.stdout, r.stderr


def main():
    print("DC-12 — PII + archetype immutability lints (Story 10.13)")

    # 1 + 2. Each script exists, parses as Python, and exits 0
    # (vacuous-pass guard: each script exits 0 if packs/disc/ is empty).
    for path, label in SCRIPTS:
        check(file_exists(path), f"{path} exists")
        if not file_exists(path):
            continue
        # Parse-check
        r = run([sys.executable, "-c", f"import ast; ast.parse(open({path!r}).read())"])
        check(r[0] == 0, f"{path} parses as Python")
        # Run for real — should exit 0 (vacuous or actual-pass)
        rc, _, _ = run([sys.executable, path])
        check(rc == 0, f"{path} exits 0 (no PII / no placeholders)")

    # 3. Brownfield clean — the existing 50 tool entries are not scanned.
    # Heuristic: the lints only walk packs/disc/. We assert that
    # walking tools/<slug>/ doesn't match the scan roots.
    for path, label in SCRIPTS:
        src = read_text(path) or ""
        # The lint scripts should not import or walk tools/.
        # Defensive assertion: any reference to "tools/" as a scan root
        # would be a brownfield violation.
        scans_tools = "Path('tools')" in src or '"tools"' in src or "'tools'" in src
        check(
            not scans_tools,
            f"{path} does not scan the existing tools/ directory (brownfield safe)",
        )

    # 4. Negative fixtures — synthesize a packs/disc/ tree with PII +
    # placeholders, run the lints against it, and assert they exit 1.
    pii_script = repo_root() / "scripts" / "check-disc-pii.py"
    immut_script = repo_root() / "scripts" / "check-archetype-immutability.py"

    if file_exists(str(pii_script)) and file_exists(str(immut_script)):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            fake_packs = tmp_path / "packs" / "disc" / "spirit-animal"
            fake_packs.mkdir(parents=True)
            # prompts.json with one PII prompt + one clean prompt
            (fake_packs / "prompts.json").write_text(
                '{\n'
                '  "questions": [\n'
                '    {"id": "q1", "label": "Your email is user@example.com"},\n'
                '    {"id": "q2", "label": "Call me at 555-867-5309"},\n'
                '    {"id": "q3", "label": "What color is the sky?"}\n'
                '  ]\n'
                '}\n',
                encoding="utf-8",
            )
            # archetypes.json with a Mustache placeholder
            (fake_packs / "archetypes.json").write_text(
                '{\n'
                '  "archetypes": [\n'
                '    {"id": "fox", "label": "The Clever Fox", '
                '"blindSpot": "Hello {{user.name}}, you are tricky"},\n'
                '    {"id": "owl", "label": "The Wise Owl"}\n'
                '  ]\n'
                '}\n',
                encoding="utf-8",
            )
            # tools.json stub for the allowlist lookup
            fake_tools = tmp_path / "tools.json"
            fake_tools.write_text('{"packs": {"disc": []}}\n', encoding="utf-8")

            env = {**os.environ, "PYTHONPATH": ""}
            rpii = subprocess.run(
                [sys.executable, str(pii_script)],
                capture_output=True, text=True, cwd=tmp_path, env=env,
            )
            rc_pii = rpii.returncode
            rimm = subprocess.run(
                [sys.executable, str(immut_script)],
                capture_output=True, text=True, cwd=tmp_path, env=env,
            )
            rc_imm = rimm.returncode
            check(rc_pii != 0, f"check-disc-pii.py exits non-zero against PII fixture (rc={rc_pii}, stderr={rpii.stderr[:200]})")
            check(rc_imm != 0, f"check-archetype-immutability.py exits non-zero against placeholder fixture (rc={rc_imm}, stderr={rimm.stderr[:200]})")

    # 5. CI wiring — the two scripts appear in
    # .github/workflows/tool-contract-gate.yml
    wf = read_text(".github/workflows/tool-contract-gate.yml") or ""
    if wf:
        check(
            "check-disc-pii.py" in wf,
            "tool-contract-gate.yml references check-disc-pii.py",
        )
        check(
            "check-archetype-immutability.py" in wf,
            "tool-contract-gate.yml references check-archetype-immutability.py",
        )
    else:
        check(False, "tool-contract-gate.yml exists")
        check(False, "tool-contract-gate.yml references check-disc-pii.py")
        check(False, "tool-contract-gate.yml references check-archetype-immutability.py")

    # 6. Makefile wiring — both scripts are exposed as targets
    mk = read_text("Makefile") or ""
    if mk:
        check(
            "disc-pii-lint:" in mk or "disc-pii-lint :" in mk,
            "Makefile exposes `disc-pii-lint` target",
        )
        check(
            "disc-immutability-lint:" in mk or "disc-immutability-lint :" in mk,
            "Makefile exposes `disc-immutability-lint` target",
        )
    else:
        check(False, "Makefile exists")
        check(False, "Makefile exposes disc-pii-lint target")
        check(False, "Makefile exposes disc-immutability-lint target")

    exit_with_summary("DC-12")


if __name__ == "__main__":
    main()

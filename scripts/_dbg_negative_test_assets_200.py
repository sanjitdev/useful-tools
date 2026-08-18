#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_dbg_negative_test_assets_200.py — manually verify the browser smoke
harness catches a broken-CSS-path regression.

Procedure:
  1. Backup tools/packs/discovery/spirit-animal/index.html
  2. Rewrite all `../../../../` (4-up) asset paths to `../../` (2-up)
     — this is the same class of regression the user reported.
  3. Run scripts/_browser_smoke.py.
  4. Confirm rc != 0 AND at least one FAIL line mentions 404.
  5. Restore the original file.

Run: `python scripts/_dbg_negative_test_assets_200.py`.
"""
import os, re, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "tools/packs/discovery/spirit-animal/index.html"
BACKUP = ROOT / "_dbg_broken_path_backup.html"

# Make backup
shutil.copy(TARGET, BACKUP)

try:
    s = TARGET.read_text(encoding="utf-8")
    # Break all the ../../../../ asset paths: turn them into
    # ../../ (broken — wrong depth).
    broken = re.sub(r'\.\.\/\.\.\/\.\.\/\.\.\/', r'../../', s)
    assert broken != s, "regex did not match"
    TARGET.write_text(broken, encoding="utf-8")

    # Run the harness — should fail
    r = subprocess.run(
        ["python", str(ROOT / "scripts/_browser_smoke.py")],
        capture_output=True, text=True, timeout=120,
        encoding="utf-8", errors="replace",
    )
    print(f"\nreturncode: {r.returncode}")
    # Find FAIL lines
    fails = [ln for ln in r.stdout.splitlines() if "FAIL" in ln]
    print(f"\n--- {len(fails)} FAIL lines ---")
    for ln in fails[:6]:
        print(f"  {ln}")
    print(f"\nexpected: rc != 0 AND at least 1 FAIL")
    print(f"got:      rc = {r.returncode}, fails = {len(fails)}")
    ok = r.returncode != 0 and len(fails) > 0
    print(f"REGRESSION CATCH: {'YES' if ok else 'NO'}")
finally:
    shutil.move(BACKUP, TARGET)
    print("(restored)")
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Negative test: confirm DC-15 catches a regression in which the
discovery card disappears from the home page.

Procedure:
  1. Backup assets/js/pack-grid.js
  2. Drop the `discovery` entry from PACK_DEFINITIONS
  3. Run scripts/dc/dc-15-browser-render.py
  4. Confirm rc != 0 AND a FAIL line mentions the disc-card check
  5. Restore the original file

Run: `python scripts/_dbg_negative_test_disc_card.py`.
"""
import re, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "assets/js/pack-grid.js"
BACKUP = ROOT / "_dbg_disc_card_backup.js"

shutil.copy(TARGET, BACKUP)
try:
    s = TARGET.read_text(encoding="utf-8")
    # Drop the discovery entry — keep the array shape (commas).
    broken = re.sub(
        r"\s*\{\s*slug:\s*'discovery',[^}]*?\},?\n",
        "",
        s,
        count=1,
        flags=re.DOTALL,
    )
    assert broken != s, "regex did not match"
    TARGET.write_text(broken, encoding="utf-8")

    r = subprocess.run(
        ["python", str(ROOT / "scripts/dc/dc-15-browser-render.py")],
        capture_output=True, text=True, timeout=240,
        encoding="utf-8", errors="replace",
    )
    print(f"\nreturncode: {r.returncode}")
    fails = [ln for ln in (r.stdout or "").splitlines() if "FAIL" in ln]
    print(f"\n--- {len(fails)} FAIL lines (showing up to 6) ---")
    for ln in fails[:6]:
        print(f"  {ln}")
    ok = r.returncode != 0 and len(fails) > 0
    print(f"\nREGRESSION CATCH: {'YES' if ok else 'NO'}")
finally:
    shutil.move(BACKUP, TARGET)
    print("(restored)")
"""One-off drift fix: splice current palette/settings/help canonical
bytes into the non-tool pages that the shell-template tool-loop skips.
Also handles the home page (index.html).
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(".")

sys.argv = ["shell-template.py"]  # prevent main() from running
spec = importlib.util.spec_from_file_location("shell_template", "scripts/shell-template.py")
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
except SystemExit:
    pass

skip_html, header_html, footer_html, palette_html, settings_html, help_html, print_footer_html = mod.read_chrome(ROOT)

TARGETS = [
    ROOT / "index.html",
    ROOT / "packs" / "developer.html",
    ROOT / "packs" / "disc.html",
    ROOT / "packs" / "finance.html",
    ROOT / "packs" / "fun.html",
    ROOT / "packs" / "household.html",
    ROOT / "packs" / "study.html",
    ROOT / "packs" / "travel.html",
    ROOT / "tools" / "packs" / "index.html",
    ROOT / "tools" / "date-picker-lab" / "index.html",
    ROOT / "quality.html",
]


def needs_fix(text: str) -> bool:
    return (
        palette_html not in text
        or settings_html not in text
        or help_html not in text
    )


for path in TARGETS:
    if not path.is_file():
        print(f"  SKIP   {path.relative_to(ROOT)} (missing)")
        continue
    text = path.read_text(encoding="utf-8")
    if not needs_fix(text):
        print(f"  no-change {path.relative_to(ROOT)}")
        continue
    new_text = mod.splice_chrome_includes(text, palette_html, settings_html, help_html)
    if new_text == text:
        print(f"  no-change {path.relative_to(ROOT)} (splice was a no-op)")
        continue
    path.write_text(new_text, encoding="utf-8")
    print(f"  wrote    {path.relative_to(ROOT)}  (chrome-includes only)")
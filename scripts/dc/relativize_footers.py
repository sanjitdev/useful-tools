"""Re-apply depth-aware footer relative paths to all chrome pages.

This is a recovery script. The chrome.html footer is canonical for
tool pages (depth 2), where `../../quality.html` and
`../../view-source.html` resolve correctly. For other depths the
script substitutes the appropriate prefix.

Depth table (file path → repo-root-relative prefix):
  - depth 0  (index.html, quality.html, view-source.html)
            → ./ (e.g. ./quality.html)
  - depth 1  (packs/*.html)
            → ../ (e.g. ../quality.html)
  - depth 2  (tools/*/index.html, tools/packs/index.html)
            → ../../ (matches chrome.html canonical; no rewrite needed)
  - depth 3  (tools/packs/discovery/*/{index,compare}.html)
            → ../../../ (e.g. ../../../quality.html)

The /privacy link is removed entirely (no privacy.html exists in the
project).
"""
import re
from pathlib import Path

ROOT = Path(".")


def depth_for(path: Path) -> int:
    rel = path.relative_to(ROOT)
    # Number of directory components (excluding the filename).
    return len(rel.parts) - 1


def fix_footer(text: str, depth: int) -> str:
    if depth == 0:
        prefix = "./"
    elif depth == 1:
        prefix = "../"
    elif depth == 2:
        prefix = "../../"
    elif depth == 3:
        prefix = "../../../"
    else:
        return text
    text = re.sub(r'href="/quality"', f'href="{prefix}quality.html"', text)
    text = re.sub(r'href="/view-source\?tool="', f'href="{prefix}view-source.html"', text)
    # Remove /privacy link entirely.
    text = re.sub(r'\s*<a href="/privacy">Privacy</a>', "", text)
    return text


def fix_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    new = fix_footer(text, depth_for(path))
    if new != text:
        path.write_text(new, encoding="utf-8")
        return True
    return False


def main():
    targets = [
        ROOT / "index.html",
        ROOT / "quality.html",
        ROOT / "view-source.html",
        *sorted((ROOT / "packs").glob("*.html")),
        *sorted((ROOT / "tools").glob("*/index.html")),
        *sorted((ROOT / "tools/packs/discovery").glob("*/*.html")),
        ROOT / "tools/packs/index.html",
    ]
    count = 0
    for p in targets:
        if p.is_file() and fix_file(p):
            count += 1
    print(f"Updated {count} of {len(targets)} files")


if __name__ == "__main__":
    main()
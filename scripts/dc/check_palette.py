import importlib.util
import sys
from pathlib import Path

sys.argv = ["shell-drift-check.py"]
spec = importlib.util.spec_from_file_location("shell_drift_check", "scripts/shell-drift-check.py")
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
except SystemExit:
    pass

html = Path("packs/study.html").read_text(encoding="utf-8")
root = mod.parse_html(html)
main_node = mod.find_landmark(root, mod.is_main_landmark)
print("packs/study.html main found?", main_node is not None)
if main_node:
    print("main attrs:", main_node.attrs)

html2 = Path("tools/budget-planner/index.html").read_text(encoding="utf-8")
root2 = mod.parse_html(html2)
main_node2 = mod.find_landmark(root2, mod.is_main_landmark)
print("budget-planner main found?", main_node2 is not None)
if main_node2:
    print("main attrs:", main_node2.attrs)

# Show all top-level tags
def tags(node, prefix="", depth=0):
    if depth > 2:
        return
    print(f"{prefix}{node.tag} id={node.attrs.get('id','')} class={node.attrs.get('class','')[:60]}")
    for c in node.children[:20]:
        tags(c, prefix + "  ", depth+1)
print("--- packs/study.html structure (top 3 levels) ---")
tags(root)
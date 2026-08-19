"""Compare canonical tools.json serialization vs index.html inline block."""
import json
import sys
from pathlib import Path

data = json.loads(Path("tools.json").read_text(encoding="utf-8"))
serialized = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

content = Path("index.html").read_text(encoding="utf-8")
marker = 'id="ht-tools-json-inline">'
i = content.find(marker)
if i == -1:
    print("marker not found")
    sys.exit(1)
i += len(marker)
j = content.find("</script>", i)
actual = content[i:j]
print("match:", serialized == actual)
print("len(serialized):", len(serialized))
print("len(actual):", len(actual))
if serialized != actual:
    for k in range(min(len(serialized), len(actual))):
        if serialized[k] != actual[k]:
            print(f"first diff at {k}:")
            print("  expected:", repr(serialized[k:k+80]))
            print("  actual:  ", repr(actual[k:k+80]))
            break

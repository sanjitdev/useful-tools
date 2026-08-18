#!/usr/bin/env python3
"""Reproduce: load a quiz, fire onComplete programmatically, dump the
post-completion DOM. See if .quiz-result-card is in there."""
import os, subprocess, threading, time, http.server, socketserver, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8810

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)
    def log_message(self, *a, **kw): pass

httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
time.sleep(0.4)

try:
    cmd = [
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "--headless=new", "--disable-gpu", "--no-sandbox",
        "--no-first-run",
        f"--user-data-dir={Path(os.environ.get('TEMP','/tmp'))}/quiz_result",
        "--virtual-time-budget=10000",
        "--dump-dom",
        f"http://127.0.0.1:{PORT}/tools/packs/discovery/spirit-animal/",
    ]
    env = os.environ.copy()
    env.pop("DEBUGGING_PID", None)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30,
                       env=env, encoding="utf-8", errors="replace")
    dom = r.stdout
    # The quiz form mounts but the result card only appears after user
    # finishes. The DOM dump should NOT have .quiz-result-card.
    has_result = 'class="quiz-result-card' in dom or 'quiz-result-card discovery-card' in dom
    print(f"result card rendered (unexpected without user completing): {has_result}")
    # Look for any error or fallback text
    for kw in ('HT.quiz failed', 'HT.scoring failed', 'HT.results failed', 'quiz-result-'):
        n = dom.count(kw)
        if n:
            print(f"  count({kw!r}) = {n}")
    # Show quiz-mount contents (just to confirm a quiz form is there)
    m = re.search(r'<section[^>]*id="quiz-mount"[^>]*>(.*?)</section>', dom, re.DOTALL)
    if m:
        print(f"\nquiz-mount inner preview:\n{m.group(1)[:500]}")
finally:
    httpd.shutdown(); httpd.server_close()
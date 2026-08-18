#!/usr/bin/env python3
"""Dump the test page DOM and inspect what the result card looks like."""
import os, subprocess, threading, time, http.server, socketserver, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8840

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
        "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
        f"--user-data-dir={Path(os.environ.get('TEMP','/tmp'))}/result_test",
        "--virtual-time-budget=30000",
        "--dump-dom",
        f"http://127.0.0.1:{PORT}/_test_result.html",
    ]
    env = os.environ.copy()
    env.pop("DEBUGGING_PID", None)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30,
                       env=env, encoding="utf-8", errors="replace")
    dom = r.stdout
    # Look at the result card
    m = re.search(r'<article[^>]*class="quiz-result-card[^"]*"[^>]*>(.*?)</article>', dom, re.DOTALL)
    if m:
        inner = m.group(1)
        print(f"Card found. inner length: {len(inner)} chars")
        print(f"--- card inner (first 1500 chars) ---")
        print(inner[:1500])
        # Check specific pieces
        for kw in ('quiz-result-header', 'quiz-result-emoji', 'quiz-result-archetype',
                  'quiz-result-tagline', 'quiz-result-contrarian',
                  'quiz-result-trait-bar-list', 'quiz-result-trait-bar',
                  'quiz-result-actions', 'data-action="share"', 'data-action="challenge"',
                  '>Fox<', '🦊'):
            n = inner.count(kw)
            print(f"  '{kw}' count: {n}")
    else:
        print("Card NOT found. Showing relevant fragments:")
        for kw in ('quiz-result-card', 'HT.results', 'Result card mounted',
                   'id="mount"', 'innerHTML length'):
            n = dom.count(kw)
            print(f"  '{kw}' count: {n}")
        # Show what's inside #mount
        mm = re.search(r'(<div[^>]*id="mount"[^>]*>.*?</div>)', dom, re.DOTALL)
        if mm:
            print(f"\n#mount block: {mm.group(1)[:1000]!r}")
        # Check for any article element anywhere
        art = re.findall(r'<article[^>]*>', dom)
        print(f"articles in dom: {len(art)}")
        for a in art[:3]:
            print(f"  {a}")
        # Show console errors
        if r.stderr:
            print(f"\nstderr:\n{r.stderr[:1000]}")
finally:
    httpd.shutdown(); httpd.server_close()
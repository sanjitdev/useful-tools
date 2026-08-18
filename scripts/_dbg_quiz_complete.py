#!/usr/bin/env python3
"""
Programmatic test: load a quiz page in headless Edge, then trigger
onComplete by injecting JS via the dev tools URL. Inspect result.
"""
import os, subprocess, threading, time, http.server, socketserver, re, urllib.request, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8820

# We need to load quiz.js, scoring.js, results.js + the quiz's core.js in
# a vm sandbox with stubbed DOM. Easier: just programmatically complete
# the quiz by hitting the answer buttons in headless Edge via JS injection.
# But Edge headless --dump-dom doesn't easily run JS before dumping.
#
# Approach: load a page that has a "complete me" query param hook, OR
# use a Node-based vm sandbox test like _smoke_discovery_result.js.

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)
    def log_message(self, *a, **kw): pass

httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
time.sleep(0.4)

# Test by simulating a user clicking through with --headless + a small JS
# injection. Edge --headless --dump-dom doesn't have a JS-injection flag
# without DevTools. Instead, just open the page and confirm the form is
# there; that's what we already know works.
#
# Better path: directly inspect the spirit-animal-core.js onComplete path
# in isolation. We've already done that above (no bugs in code). The
# actual user-visible bug must be in:
#   - HT.scoring.score() returning malformed output
#   - HT.results.render() failing silently
#   - the reveal DOM structure mismatch
# Look at quiz.js to see what the quiz shell emits around the reveal.

try:
    # Just confirm quiz form renders with a complete-but-no-result state
    url = f"http://127.0.0.1:{PORT}/tools/packs/discovery/spirit-animal/"
    cmd = [
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "--headless=new", "--disable-gpu", "--no-sandbox",
        "--no-first-run",
        f"--user-data-dir={Path(os.environ.get('TEMP','/tmp'))}/quiz_complete",
        "--virtual-time-budget=10000",
        "--dump-dom",
        url,
    ]
    env = os.environ.copy()
    env.pop("DEBUGGING_PID", None)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30,
                       env=env, encoding="utf-8", errors="replace")
    dom = r.stdout
    # Look at what the quiz shell creates in the reveal structure.
    # After the user completes, the shell emits .quiz-reveal with the
    # .quiz-reveal-body slot the quiz appends into.
    # Check the reveal structure exists (it's created lazily onComplete)
    has_reveal = 'quiz-reveal' in dom
    print(f"quiz-reveal in dom: {has_reveal}")
    # Check if there's any error message
    for kw in ('failed to load', 'Error', 'undefined', 'quiz-reveal-body'):
        n = dom.count(kw)
        if n:
            print(f"  count({kw!r}) = {n}")
    # Look for the quiz mount section's full content
    m = re.search(r'<section[^>]*id="quiz-mount"[^>]*>(.*?)</section>', dom, re.DOTALL)
    if m:
        s = m.group(1)
        # Count quiz-card elements
        n_cards = len(re.findall(r'class="quiz-card"', s))
        print(f"quiz-card count: {n_cards}")
        # Check for the answer form / button
        for kw in ('quiz-options', 'quiz-next', 'data-quiz-current'):
            n = s.count(kw)
            if n:
                print(f"  {kw} count = {n}")
finally:
    httpd.shutdown(); httpd.server_close()
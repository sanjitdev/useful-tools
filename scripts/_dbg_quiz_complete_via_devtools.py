#!/usr/bin/env python3
"""
Reproduce the bug: use Edge with DevTools protocol to simulate
clicking through 8 questions, then dump the DOM.
"""
import json, os, socket, subprocess, threading, time, http.server, socketserver, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8830
DEBUG_PORT = 9223  # Edge DevTools port

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)
    def log_message(self, *a, **kw): pass

httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
time.sleep(0.4)

try:
    # Launch Edge with --remote-debugging-port
    user_data = Path(os.environ.get("TEMP", "/tmp")) / "edge_devtools"
    user_data.mkdir(parents=True, exist_ok=True)
    cmd = [
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
        f"--user-data-dir={user_data}",
        f"--remote-debugging-port={DEBUG_PORT}",
        "--virtual-time-budget=10000",
        f"http://127.0.0.1:{PORT}/tools/packs/discovery/spirit-animal/",
    ]
    env = os.environ.copy()
    env.pop("DEBUGGING_PID", None)
    proc = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL)
    time.sleep(3)  # let Edge start

    # Get the WebSocket URL via http endpoint
    try:
        tabs = json.loads(urllib.request.urlopen(
            f"http://127.0.0.1:{DEBUG_PORT}/json").read())
        # pick the spirit-animal tab
        ws_url = None
        for tab in tabs:
            if 'spirit-animal' in tab.get('url', ''):
                ws_url = tab['webSocketDebuggerUrl']
                break
        if not ws_url:
            print("No spirit-animal tab found. Tabs:")
            for t in tabs:
                print(f"  {t.get('url','')}  ws={t.get('webSocketDebuggerUrl','')[:50]}")
            proc.terminate()
            raise SystemExit(1)
        print(f"ws_url: {ws_url}")
    except Exception as e:
        print(f"Could not reach DevTools: {e}")
        proc.terminate()
        raise

    # Skip WS plumbing — instead, use Page.captureScreenshot via simple HTTP.
    # We just want to know what the DOM looks like after completion.
    # Easier: re-launch Edge WITHOUT devtools and use a JS hook approach:
    #   Open a special test URL that auto-completes the quiz.
    proc.terminate()
    time.sleep(0.5)
finally:
    httpd.shutdown(); httpd.server_close()
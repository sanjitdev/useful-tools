# Brainstorm Intent — Handy Tools Expansion

## 1. Stance

Handy Tools is the **local-first tool kit for the rest of the internet**: a keyboard-driven, privacy-forward, vanilla-JS/HTML/CSS suite whose differentiator is **trust and ergonomics**, not tool count. Core JTBDs it must satisfy: (a) answer a small private question in <5s without installing, signing up, or being tracked (JTBD-1, JTBD-2); (b) compute something to paste into Slack/email with auto-copy (JTBD-3, P1); (c) share a calculation with one link that recreates exact inputs (JTBD-4, M2, TT5); (d) make tiny decisions without thinking about the tool itself — muscle memory via ⌘K (JTBD-10, M1, TT1); (e) fall back to a zero-ads/no-sign-in alternative when phone apps fail (JTBD-8, TT14). Depth on a small curated set beats catalog breadth (FSI-3).

## 2. Pillars

- **Command-palette-first shell** — Single SPA shell with ⌘K palette, sidebar + home grid as fallbacks; deep-linkable URL state for every tool. (S1, M1, R3, TT1, FSI-9)
- **Composable workflow packs** — Tools grouped into named packs (Travel, Personal Finance, Developer, etc.) with chainable outputs and shared inputs panels. (C1–C5, EXP-1–EXP-10, PR-5, insight-2)
- **Share/embed/print by default** — Every tool exposes URL-encoded state, iframe embed mode, copy-on-result, print stylesheet, OG cards, export. (M2, M3, M4, P1, TT5, TT15, FSI-4)
- **Offline-first, zero-trust surface** — Service worker caches shell + last-used tools; vendored only; no CDN/fonts/analytics; runs from file:// where possible. (A3, TT14, TT17, PR-12, FSI-2, QUAL-5)
- **Keyboard-first power UX** — Per-tool shortcuts, `?` keymap overlay, history sidebar, intent routing from plain English. (TT1, TT4, TT10, TT13, FSI-6, FSI-10)
- **Tool Contract quality gate** — Shared metadata, mount/destroy lifecycle, accessible labels, live result region, tests, score 8/10 minimum to ship. (E1, E2, QUAL-1, QUAL-10, PR-19, PR-24, FSI-8)

## 3. Tool expansion priorities

**Workflow packs (5–8):**
- **Developer pack** — JSON/CSV/YAML formatter, diff, JWT inspector, UUID, timestamp, regex, URL/Base64, SQL formatter. (EXP-5, FSI-7)
- **Personal finance pack** — Budget, savings goal, net worth, debt payoff, inflation, salary↔hourly, tax, split. (EXP-8, C1)
- **Travel pack** — Timezone meeting planner, countdown, currency, packing list, tip, trip budget. (EXP-2, TT9)
- **Study pack** — Pomodoro, flashcard timer, GPA, citation formatter, word/reading-time, exam countdown. (EXP-4, C2)
- **Household pack** — Grocery list, recipe scaler, unit converter, meal planner, pantry expiry. (EXP-1, C3, C4)
- **Communication pack** — Case converter, whitespace cleaner, dedupe, slug, Unicode inspector, character counter. (EXP-6)
- **Accessibility pack** — Contrast checker, color-blindness sim, rem↔px, focus-order tester, alt-text helper. (EXP-7, QUAL-3)
- **Security pack** — Password/passphrase generator, entropy, hash, secret redaction, never-transmit guarantee. (EXP-9)

**Individual tools (3–5):**
- **QR Studio** — QR/barcode/WiFi/vCard/event with presets + decoder. (C5)
- **Plain-English intent router** — Address-bar math + natural-language → tool dispatcher. (FSI-1, TT10, PR-18)
- **Decision cockpit** — Decision wheel, pros/cons, Eisenhower matrix as emotional-tools brand hook. (JTBD-5, A1, PR-7)
- **Local observability panel** — Performance timings, errors, cache state, diagnostics export. (QUAL-11, FSI-11)

## 4. Quality bar (non-negotiables)

- **A11y gate** — WCAG AA contrast, keyboard-only completion, 44px touch targets, screen-reader announcements, `prefers-reduced-motion`. (QUAL-3)
- **Performance budget** — Home LCP <1.5s on mid-range mobile; tool interactive <1s; CLS=0; shell <14KB compressed; no render-blocking 3rd-party. (QUAL-2, PR-11)
- **Offline-first** — Service worker caches shell + tools; offline fallback page; no CDN fonts/icons; versioned cache migration. (QUAL-6, PR-12)
- **Privacy** — No analytics, no external requests, transparent storage dashboard, local export/import. (QUAL-5, TT14, FSI-2)
- **Correctness** — Pure calc isolated from DOM; golden vectors; boundary + invalid-input tests; explicit rounding. (QUAL-4, JTBD-9, PR-15)
- **i18n** — All copy in message catalogs; locale-aware number/date/currency; RTL-safe; Bengali/Hindi/Spanish seed locales. (QUAL-7, FSI-5)
- **Visual consistency** — Shared tokens, spacing scale, form controls, result cards, dark/high-contrast themes. (QUAL-9, S2)
- **Per-tool score ≥8/10** before publish — a11y, mobile, offline, speed, print, share, tests. (PR-19, insight-7)
- **Error recovery** — Preserve input, name invalid field, explain fix, offer sample/reset, never silently coerce. (PR-21, QUAL-12)
- **Tool Contract** — metadata, mount/destroy, accessible labels, live region, persistence, URL share, print, sample, tests. (QUAL-1, PR-24, E1)

## 5. Anti-features

- **No third-party libraries** — Vendor nothing; bundle size, offline, and trust depend on it. (A3, PR-12)
- **No accounts, sign-in, or cloud sync by default** — Local-first is the brand; sync is opt-in and end-to-end local if ever. (JTBD-1, JTBD-8, FSI-2)
- **No analytics, fingerprinting, or cookies** — Privacy is the value prop, not a footer note. (TT14, QUAL-5)
- **No CDN, no external fonts, no remote images** — Breaks offline, leaks via 3rd-party, kills performance. (QUAL-6, PR-12)
- **No shipping tools below the 8/10 quality bar** — One bad tool kills the brand. (FSI-8, PR-19)

## 6. Open questions

1. **Monetization shape** — Tip jar + "Sponsor a tool" only, or add a hosted-tier sync / embed-Pro later? (R2)
2. **Tool-curation policy** — Hard cap on total tools to preserve depth-over-breadth, or expand indefinitely with strict gating? (FSI-3, FSI-8)
3. **PWA / file:// scope** — Should every tool truly work from `file://`, and what does that cost in features (service worker, fetch)? (PR-12, QUAL-8)
4. **Embed contract** — postMessage API + URL I/O contract beyond `?embed=1`; how much is "platform primitive"? (PR-14, FSI-4)
5. **Localization sequencing** — Which seed locales first (Bengali/Hindi/Spanish/Arabic per FSI-5) and what triggers the next wave?

## 7. Recommended next skill

**bmad-product-brief.** The brainstorm has produced a clear positioning (local-first, keyboard-first, trust-differentiated), a pillar structure, prioritized packs/tools, measurable quality bars, and explicit anti-features — exactly the input a product brief needs to commit to scope before PRD/architecture/spec work. Brief first locks the stance; downstream skills (bmad-architecture, bmad-prd, bmad-ux) then derive the Tool Contract, design system, and epics from it.
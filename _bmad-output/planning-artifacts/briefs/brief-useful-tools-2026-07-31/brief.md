---
title: Product Brief — Handy Tools
status: draft
created: 2026-07-31
updated: 2026-07-31
project: useful-tools
---

# Product Brief: Handy Tools

## Executive Summary

Handy Tools is a free, dependency-free collection of small, useful everyday tools that anyone can use the moment a need arises — no sign-up, no installs, no tracking, no network calls. It already ships 34 tools covering time, finance, text, color, planning, and developer needs; this brief defines how it grows into a best-of-the-internet craftsman suite without losing what makes it good.

The thesis is **Trust**. Handy Tools wins because it is the tool suite a careful person — a teacher, a writer, a parent, a developer, a doctor, a small business owner — can use without thinking about whether it is watching them, slowing them down, or trying to upsell them. Composure, speed, and embeddability follow; they are unpacked below.

## The Problem

The everyday utility web is degraded. "Calculator" searches return ad-laden result farms, fake CAPTCHA gates, hidden redirects to affiliate offers, and tracking pixels on a page that exists to do one unit of math. "QR code generator" is the same, with extra tracking. Browser extensions have closed the gap but cost attention, install prompts, and permissions. Native apps install fast and stop being trusted slowly.

The user who wants to do something small — split a bill, count a deadline, format JSON, weigh a planet — is forced to either (a) surrender privacy and attention to a sketch site, or (b) install software for a 12-second job. The cost is small per task; the aggregate is a slow erosion of trust in the open web.

## The Solution

It runs entirely in the browser. Every tool works offline once visited. There is no analytics, no fingerprinting, no cookie banner, no upsell, no account. The site loads fast on a phone in a tunnel. Every result is copy-and-share-by-default. Every tool has keyboard shortcuts, a shareable URL, a printable view, and a small history.

We treat each tool as a small, complete product with a fixed quality contract — accessibility, correctness, mobile ergonomics, shareability — not as a folder of files. We treat the *home page* as a launcher, not a catalog. The command palette (⌘K) is the front door; the grid is a friendly lobby.

## What Makes This Different

**Trust as a product.** Privacy is not a footer note; it is the brand. The site is auditable: it has a "View source" link in every footer, a transparent localStorage panel that names exactly what is and isn't stored, and a `/privacy` page that shows a wire log of network requests for a session (zero by default). When a tool is wrong, it is honest about being wrong: formulas, assumptions, edge cases, and limits are visible. This is the differentiator no ad-supported competitor can copy without abandoning their business model.

**Composure over catalog.** The moat is not 200 calculators; it is 40 carefully designed tools with a shared design language, a shared keyboard model, and a shared quality contract. We say no to tools that already exist well elsewhere (general web search, full spreadsheets, IDE-class developer tools). We say yes to tools that benefit from our local-first, keyboard-first, share-first defaults — and to tools that compose with the ones we have.

**Embeddability as distribution.** Every tool exposes a `?embed=1` mode that strips chrome, accepts URL-encoded state, and fits inside an `<iframe>`. Handy Tools becomes a quiet layer of the open web: a calculation on a blog post, a QR generator in a school's homework portal, a Pomodoro timer in a docs site — without our brand or analytics leaking into those contexts. Embeds reward the same things this project already rewards.

**Speed and craft as signature.** LCP under 1.5s on mid-range mobile. Keyboard navigation end-to-end. Every form has a sample-data button. Every result has a copy button and a share link. Every error preserves the user's input and offers a fix. These small acts of craft accumulate into the feeling of a tool made by someone who used it.

## Who This Serves

**Primary user: the moment-of-need person.** They have a 12-second task and need it done. They came from a search, a chat message, a bookmark, or a remembered URL. Their success criterion is simple: the answer is correct, the page did not betray them, and they can move on. We serve them when they are tired, distracted, on a phone, or in a meeting.

**Secondary users** are people who return often enough to want a curated experience: ⌘K command palette, favorites, recent tools, custom dashboards, shareable links, an installed PWA on their home screen. These are the same person in a different mode; we serve both modes with one product.

**Non-targets.** We deliberately do not serve enterprise IT, regulated industries, or use cases that need authenticated state. Those are different products.

## Success Criteria

A year from now, we measure success by these signals:

**Engagement (leading).** Are people using the suite?
- ≥1.5 tools used per session on average.
- ≥35% of weekly visitors return.
- PWA install rate ≥4% of mobile visitors.
- Shareable-URL usage ≥10% of completed tasks.

**Trust (core).** Is the brand defensible?
- Privacy and source-transparency audits pass publicly.
- Every tool meets the 8/10 quality bar (rubric defined in the PRD).
- No third-party network requests; zero analytics.

**Quality (core).** Are the tools excellent?
- LCP under 1.5s on mid-range mobile.
- Lighthouse Performance and Accessibility ≥95.
- Every tool keyboard-complete in ≤90 seconds by an external tester.

**Reach (lagging).** Is the work visible?
- ≥50,000 monthly visits from organic search.
- ≥100 third-party sites embedding at least one tool.
- ≥300 GitHub stars as a craftsman-portfolio signal.

## Scope (v2)

**In:**
- **Platform primitives**: a single shell, one design system, one command palette, one settings modal, one home data source (`tools.json`).
- **Quality bar**: every existing tool promoted to the new contract (a11y, mobile, offline, share, print, sample data, history, error recovery).
- **Packs, not piles**: 4–5 workflow packs composed from existing and new tools — Travel (timezone, currency, tip, countdown), Finance (budget, savings, loan, tax, split), Study (GPA, Pomodoro, flashcard timer, exam countdown, citation), Developer (JSON, CSV, YAML, regex, diff, JWT, UUID, timestamp), Household (recipe scaler, grocery list, area/volume, paint, tip, split).
- **Embedding**: every tool exposes an iframe-ready `?embed=1` and a `postMessage` API; ship an `/embed/<tool>` redirect and a small "embed snippet" copy target on each tool page.
- **Trust surface**: `/privacy` page with an interactive "what is stored" panel; per-tool source link; transparent changelog; public quality score per tool.
- **Internationalization scaffold**: message catalogs; locale-aware numbers, dates, currency; starter locales for Bengali, Hindi, Spanish, and Arabic (RTL-safe CSS).
- **Offline-first**: service worker caches shell + last-used tools; offline fallback page; works from `file://` where browser APIs permit.

**Out (for v2):**
- User accounts, sign-in, cloud sync.
- Third-party CDN fonts, analytics, tag managers, A/B testing, ad networks.
- A native app.
- A marketplace for community tools (deferred to v3+).
- Tools that need a server (currency exchange rates that update live, weather, geolocation, etc.) — these will be cached/local approximations only.

## Vision

In two to three years, Handy Tools is the craftsman-portfolio reference for what a small, careful web project can be when trust is the product. It is the default recommendation in privacy-and-productivity communities, embedded in classrooms and small-business workflows, and the example a teacher points to when explaining that the open web still rewards people who respect their users. It is not the biggest tool suite. It is the one that doesn't need to be.

The longer arc, if the foundation holds, is a quiet API: any website can embed a tool, any tool can compose with any other, and a user can carry their dashboard with them as a single JSON file. The system becomes the platform, but only after the craft is undeniable.

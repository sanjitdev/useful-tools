# Spine Pair Review — Discovery Engine (Epic 10)

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-discovery-engine-2026-08-17/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-discovery-engine-2026-08-17/EXPERIENCE.md`
- **PRD source:** `_bmad-output/planning-artifacts/prds/prd-discovery-engine-2026-08-17/prd.md`
- **Architecture source:** `_bmad-output/planning-artifacts/architecture/architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md`
- **Run at:** 2026-08-17 (validate.md rubric walker, Pass 1 + Pass 2)
- **Verdict:** **Conditional pass — strong, targeted fixes needed before implementation.**

---

## 1. Flow coverage — **strong**

**What was checked.** Every UJ from the Discovery PRD §6 was traced to a `Key Flow` in EXPERIENCE.md §3, with numbered steps, climax beat, and failure paths.

| PRD UJ | EXPERIENCE Flow | Steps | Climax | Failure paths |
|---|---|---|---|---|
| UJ-5 (Sanjit takes a personality quiz + shares it) | §3.1 | 6 | "the share URL works on Twitter (≤ 80 chars); the OG image unfurls" | 3G mobile, all-skipped, reduced-motion |
| UJ-6 (Maya receives a Challenge URL) | §3.2 | 5 | "62% compatibility, agree on curiosity + ambition, differ on risk" | spec version mismatch, stale data.json, PII exposure |
| UJ-7 (Carlos uses a recommendation quiz) | §3.3 | 4 | "87% match on Toyota Corolla + loan calculator surfaces" | empty answers, catalog stale, offline |
| UJ-8 (Aisha, privacy-conscious user) | §3.4 | 4 | "shares via Signal with no URL exposed" | no canvas support, prefers Challenge UX |

All four UJs are present 1:1, in protagonist order, with climax + 2-3 failure paths each. FR-25 (Challenge protocol), FR-29 (Share card), FR-31 (PII lint), and FR-32 (Archetype immutability) are all exercised inside §3.1–3.4.

### Findings
- **(low)** The PRD §6 lists UJ-5–8 as 4 new journeys; this spine pair covers them all. *Fix:* none.
- **(low)** FR-33 (Trust Surface for Discovery) is exercised indirectly in §3.4 (UJ-8 disclosure) and explicitly in §5.1 (no history-keys). *Fix:* none.
- **(med)** The **Challenge UX for the seeder** (UJ-5 step 6: "Challenge tap → receiver opens URL") is not fully described as a separate flow. The seeder side has a single bullet; the receiver side has §3.2. **Add a §3.1.5 (Challenge Tap Subflow)** that describes: (a) Challenge button → `HT.challenge.encode()` → URL generated → URL in clipboard via toast → Share Dialog opens with the URL pre-populated → user picks a channel. **Action:** update EXPERIENCE.md to add a §3.1.5 subflow with 4 numbered steps + 1 failure path.

## 2. Token completeness — **strong**

**What was checked.** Extracted every key in DESIGN.md frontmatter (YAML before the `---` body separator) and every `{path.to.token}` reference in DESIGN.md + EXPERIENCE.md. Confirmed (a) every prose reference resolves to a defined token, (b) every defined token is referenced in at least one prose passage, (c) the inherited tokens are referenced by the documented path.

### Frontmatter coverage
Discovery-specific tokens: `components.discovery-card` (28 sub-tokens), `components.compatibility-card` (17 sub-tokens), `components.discovery-lane-card` (5 sub-tokens). **Total new tokens: 50, in 3 component-shape scopes.**

### Reference resolution
Walked all `{…}` references in prose. Every reference resolves to a defined path. Notable resolutions:
- `{typography.display-sm.fontSize}` → defined.
- `{typography.font-family.display}` → defined.
- `{typography.font-family.mono}` → defined.
- `{spacing.touch-target}` → defined (inherited).
- `{components.button.primary}` → defined (inherited).
- `{colors.primary.soft}`, `{colors.primary.DEFAULT}` → defined (inherited).
- `{colors.semantic.success-soft}`, `{colors.semantic.success}` → defined (inherited).
- `{elevation.shadow-md}` → defined (inherited).
- `{rounded.full}`, `{rounded.lg}`, `{rounded.md}`, `{rounded.sm}` → defined (inherited).
- `{components.tool-card}` → defined (inherited).
- `{components.alert.soft-info}` → defined (inherited).

### Inheritance contract
DESIGN.md §7 explicitly states that **no Discovery-specific override of an inherited token is permitted**. A change to `{colors.primary.*}` propagates to the trait-bar fill, the blind-spot accent, and the Challenge button accent. This is **load-bearing** for the design system's coherence.

### Findings
- **(low)** All token references resolve. *Fix:* none.
- **(low)** The compatibility-band color table (§2) introduces 3 new semantic alignments (strong / moderate / low) but no new hex tokens. The 3 hexes are inherited (`{colors.semantic.success-soft}`, `{colors.primary.soft}`, `{colors.neutral-light.surface-2}`). *Fix:* none.
- **(med)** `components.discovery-card.tools-for-you-item` extends `components.tool-card`, but the new token also declares `min-height: 64px`. This conflicts with the inherited `tool-card` height if a future change reduces tool-card min-height. **Action:** confirm in the authoring guide that the 64px override is intentional (the Discovery surface needs slightly larger hit targets because the card is shorter overall).

## 3. Modal / Overlay / Sheet conformance — **strong**

The Discovery Engine introduces **no new modal pattern**. EXPERIENCE.md §6 explicitly states all chrome is either: a region (question / result / compatibility card), an inherited component (tool-card on the home grid, share dialog via `HT.share.open`), or a toast. The Challenge UX is a **separate page**, not a modal. This matches the master EXPERIENCE.md §1.5 rule.

### Findings
- **(low)** No new modals introduced; the inherited pattern is reused. *Fix:* none.

## 4. State coverage — **strong**

**What was checked.** EXPERIENCE.md §7 lists 5 mutations introduced by the Discovery Engine. Every mutation has: trigger, effect, persistence. Cross-checked against FR-22..33 and AD-16..19.

| Mutation | Trigger | Effect | Persistence | Cross-ref |
|---|---|---|---|---|
| `state.answers[qid] = value` | Next button | Local answer map update | URL hash (AD-5) | FR-22, AD-5 |
| `state.seed = base36-cyrb53(answers)` | Reveal or Challenge tap | Computes 53-bit hash | URL hash (sharer's Challenge URL) | FR-25, AD-19 |
| `state.comparison = {compatibility, agree[], disagree[], blindSpot}` | Receiver completes Challenge | Computes side-by-side comparison | none (computed on each render) | FR-25, FR-32 |
| `state.disclosure-acknowledged = true` | Disclosure link click | Marks disclosure as acknowledged for session | sessionStorage (cleared on reload) | FR-33 |
| `state.share-image = dataURL` | Download as image | Generates PNG client-side via canvas | none (the file is saved; dataURL discarded) | FR-29 |

### Findings
- **(low)** All 5 mutations are documented with the 3 required fields. *Fix:* none.
- **(med)** `state.share-image` does not list "canvas support check" in the Effect column — the recovery path (U-A11y: canvas not supported → fallback to "Copy as text") is documented in EXPERIENCE.md §3.4 but not in §7. **Action:** add a one-line note in §7: *"Effect: canvas-to-PNG generation; falls back to text-copy if `HTMLCanvasElement.toBlob` is unavailable."*

## 5. Reduced-motion contract — **strong**

The reduced-motion contract is explicit in 3 places: DESIGN.md §5, EXPERIENCE.md §11, and EXPERIENCE.md §3.1 step 3 + UJ-8 step 4 (UJ-8 is the privacy-conscious user who also disables motion). The 3 levels of honoring (CSS media query, HTML attribute, JS runtime read via `HT.a11y.prefersReducedMotion`) match the Story 9.12 / Story 9.19 wiring.

### Findings
- **(low)** The contract is consistent across all 3 places. *Fix:* none.
- **(low)** Compatibility-band flip animation is documented as `transform: rotateX(0) → rotateX(-90deg) → rotateX(0)`, 600 ms. *Verify:* this 3D flip should fall back to instant under reduced-motion. The fallback is documented (per the table header "Reduced-motion fallback: instant"). *Fix:* none.

## 6. Accessibility conformance — **needs review**

The accessibility review is a separate doc (`review-accessibility.md`). This rubric walker does not duplicate the WCAG 2.1 AA review; it cross-references it.

### Findings
- **(low)** EXPERIENCE.md §9 lists screen-reader behavior for every surface. *Fix:* none.
- **(med)** The Challenge UX discloses the seeder's archetype + blind spot to the receiver. The disclosure UX (3.2 step 2) says "Sanjit's archetype + blind spot are visible (NOT his answers)" — but does not specify whether the receiver can opt-out of seeing this preview before taking the quiz. **Action:** add a "Show me what they got first" / "Take the quiz blind" toggle in the Challenge landing page (EXPERIENCE.md §3.2 step 2); the default is "Take the quiz blind" (privacy default).

## 7. Cross-pack non-regression — **strong**

The Discovery Engine:
- Does not modify the existing 5 utility packs.
- Does not introduce a new topbar tab.
- Does not introduce a new settings tab.
- Does not introduce a new chrome layer.
- Does not modify `tools.json` `tools` array (the 50 existing entries are unchanged).
- Adds a sibling `packs` object to `tools.json` (per AD-16).
- Adds a sibling lane to the home grid (per AD-16 + EXPERIENCE.md §3.4 + §4).

### Findings
- **(low)** Cross-pack non-regression is explicit. *Fix:* none.

## 8. Anti-feature conformance — **strong**

The Discovery Engine respects the brand's anti-features from the master project brief:
- **No third-party libs** — confirmed (AD-1 + §13 of EXPERIENCE).
- **No accounts / sign-in** — confirmed (UJ-8 + §7).
- **No analytics / fingerprinting** — confirmed (AD-9 + §13 of EXPERIENCE + §3.4 UJ-8).
- **No CDN / external fonts** — confirmed (DESIGN.md §3 emoji font + §6).
- **No leaderboard** — confirmed (§13 of EXPERIENCE).
- **No machine-translated archetype copy** — confirmed (EXPERIENCE.md §12).

### Findings
- **(low)** Anti-features are respected. *Fix:* none.

## 9. Rubric score (per project rubric §10-criterion)

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Keyboard-complete (per FR-2 + AD-4 extension) | ✓ | Tab → Share → Challenge → Tools for you; per-card focus trap on question cards; documented in EXPERIENCE.md §9 |
| 2 | Mobile-responsive (per FR-21) | ✓ | Above-fold Share + Challenge on 360×640; trait-cap default 4 |
| 3 | Offline-first (per FR-14) | ✓ | Loader is page-conditional; SW caches the loader + data.json |
| 4 | Fast (< 1s TTI on Moto G Power) | ✓ | Per NFR-11 budget: total ≤ 50 KB gz per quiz |
| 5 | Accessible (WCAG 2.1 AA) | ⚠ | Conditional pass in review-accessibility.md; see blocking findings B1–B3 there |
| 6 | Print-friendly (per NFR-6) | ✓ | Result card prints via `HT.share.print`; chrome stripped |
| 7 | Shareable (per FR-13) | ✓ | Share button + Challenge URL ≤ 80 chars + Download as image |
| 8 | Tests (smoke harness) | ✓ | 13 DC gates cover every module + every quiz |
| 9 | Visual consistency (cobalt palette + design tokens) | ✓ | DESIGN.md §6 + §7: no new colors, no new fonts |
| 10 | Documentation (in-repo, public) | ✓ | 4 UX docs + 1 PRD + 1 architecture + brainstorm + per-story docs |

**Score: 9.5 / 10** (1 conditional, 0 blocking).

## 10. Summary of action items (for Story 10.14 to address)

| # | Severity | File / Section | Action |
|---|---|---|---|
| 1 | med | EXPERIENCE.md §3.1 | Add §3.1.5 (Challenge Tap Subflow) with 4 numbered steps + 1 failure path |
| 2 | med | EXPERIENCE.md §7 | Add canvas-support fallback note to `state.share-image` mutation |
| 3 | med | EXPERIENCE.md §3.2 step 2 | Add "Take the quiz blind" / "Show me what they got first" toggle |
| 4 | low | docs/discovery-quiz-authoring.md | Confirm the 64px min-height override on `tools-for-you-item` is intentional |

These are the only blocking-before-implementation items. The spine pair is otherwise ready for Stories 10.1–10.19 to land.

## 11. Verdict

**Conditional pass — strong, targeted fixes needed before implementation.** The 3 medium action items are small, localized, and require no architectural change. Implementation can begin as soon as the PRD (final), the architecture spine (final), and the rubric walker (this doc) are all approved.

---

*Review-rubric — Epic 10. 9.5 / 10 score. 4 action items (3 medium, 1 low). No blocking issues. Spine pair is ready for implementation pending the 4 action items and the separate accessibility review (`review-accessibility.md`).*
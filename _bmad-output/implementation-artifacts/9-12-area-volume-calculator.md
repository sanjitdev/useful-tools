# Story 9.12 — Area & Volume Calculator

Status: **backlog** (pre-implementation; updated to `done` once shipped)

## Context

Household pack needs a geometry calculator that covers the everyday shapes
people measure: rectangles (rooms, rugs), triangles (gables), circles (tables,
pipes), L-shapes (odd rooms), and 3D shapes for mulch/concrete fill (box,
cylinder). This story ships that tool with unit conversion (imperial ↔ metric),
URL state, and full chrome integration. Reuses the same per-tool split
pattern (core + handlers) as the rest of Epic 9.

## Acceptance criteria

AC-1: User picks a shape from 6 options (rectangle, triangle, circle,
  L-shape, box-3d, cylinder-3d). The tool shows only the inputs that shape
  requires.

AC-2: Each 2D shape computes area; each 3D shape computes volume.
  Rectangle = w × h, Triangle = 0.5 × b × h, Circle = π × r²,
  L-shape = (r1w × r1h) + (r2w × r2h), Box = w × h × d,
  Cylinder = π × r² × h.

AC-3: User can toggle units between imperial (ft², ft³) and metric (m², m³).
  Conversion: 1 m² = 10.7639 ft², 1 m³ = 35.3147 ft³. The displayed result
  updates immediately when units change.

AC-4: URL state encodes the active shape + all inputs as numeric params
  (`?shape=l-shape&r1w=10&r1h=8&r2w=6&r2h=4&unit=m2`). Reloading the page
  restores the state.

AC-5: Sample button loads an example for each shape (e.g. rectangle 12×10 ft,
  L-shape 10×8 + 6×4, cylinder r=2 ft h=5 ft). Reset clears everything to
  defaults. Print formats the result card; Share copies a share URL.

AC-6: Reduced-motion media query disables all transitions; print stylesheet
  hides interactive controls.

AC-7: Smoke harness with ≥ 30 assertions across 12 categories, vacuous-pass
  guard. No console errors, no fetch, no XHR, no localStorage.

AC-8: Regression sweep across all 50+ tools stays green.

## Files

Create:
- `tools/area-volume/index.html`
- `tools/area-volume/area-volume.css`
- `tools/area-volume/area-volume-core.js` (pure math + URL state)
- `tools/area-volume/area-volume-handlers.js` (DOM wiring)
- `scripts/_smoke_area_volume.js`
- `assets/icons/area-volume.svg`
- `_bmad-output/implementation-artifacts/9-12-area-volume-calculator.md`

Modify:
- `tools.json` — append area-volume entry (pack: household, score 8)
- `Makefile` — add `area-volume-smoke` to .PHONY + help + ci
- `.github/workflows/tool-contract-gate.yml` — add smoke step + path filters
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — mark done

## Architecture notes

- core exports `HT.areaVolumeCore` with: `computeShape(shape, params)`,
  `convertUnits(value, fromUnit, toUnit)`, `encodeState(state)`,
  `decodeState(search)`, `toCanonicalParams(shape)`.
- handlers wires DOM events (shape radio change, input change, unit toggle,
  sample/reset/print/share buttons) and re-renders result card on any change.
- URL state pattern matches grocery-list / paint-calculator: each shape has
  a canonical set of params; params missing from URL fall back to defaults.
- No fetch, no localStorage (matches AC-7 privacy).

## Verification

```
make area-volume-smoke
make validate
make gate
```

Manual:
- Pick `cylinder-3d`, r=2, h=5, unit=ft³ → expect ≈ 62.83 ft³.
- Pick `l-shape`, r1=10×8 + r2=6×4 → expect 104 sq ft.
- Toggle to m² → expect ≈ 9.66 m².
- Reload → state persists from URL.
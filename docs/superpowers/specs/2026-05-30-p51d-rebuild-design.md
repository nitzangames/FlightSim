# P-51D Mustang — Rebuild from Boxes to Lathe

**Date:** 2026-05-30
**Scope:** Replace `lib/plane/p51.js` with a lathe-fuselage / extruded-wings build that reads as a bare-metal P-51D from the chase cam. Add US star-and-bar markings. Plus a one-line display rename of the WW2 Fighter to "Spitfire" in `lib/game/planes.js`. No stat, controller, collision, or roster changes.

**Reference:** Barracuda Decals P-51D sheet (top-down + side views — bare-metal SX-B variant is the primary target).

## Goal

Make the P-51D unmistakably read as a bare-metal P-51D Mustang from the chase cam — long Merlin nose, bubble canopy, tapered (not Spitfire-elliptical) wings, distinctive belly scoop, US star-and-bar insignia — without departing from the project's faceted flat-shaded lowpoly style.

The current `p51.js` is built entirely from `BoxGeometry`. Result: a faceted box-plane. The recent Spitfire rebuild (commit `11d6883`, file `lib/plane/ww2-fighter.js`) demonstrated a lathe-fuselage + extruded-wings approach that works well within the project's style — this spec applies the same approach, tuned to P-51D proportions.

## In Scope

### 1. Fuselage — `LatheGeometry`

Profile points (radius, axial-Z) for a long teardrop with max radius just under the canopy. Length ~11 (z: -5.5 → 5.5) — longer and slimmer than the Spitfire's profile to express the in-line Merlin's nose.

Approximate profile:

```
(0.00, -5.50),   // nose tip
(0.42, -5.45),
(0.55, -4.20),   // back of cowling
(0.60, -2.20),
(0.58,  0.00),   // belly under canopy
(0.50,  1.50),
(0.32,  2.80),
(0.18,  3.90),
(0.00,  4.80),   // tail tip
```

14 lathe segments → faceted but readable round body.

### 2. Nose — yellow spinner + cowling band

- Spinner: `ConeGeometry(0.42, 1.4, 8)`, yellow. Position `z = -6.1` (forward of the fuselage tip).
- Nose cowling band: a thin `CylinderGeometry` (~radius 0.56, length ~1.0) wrapped around the front of the fuselage in yellow so the yellow blends from spinner into the body. Position `z ≈ -4.8`.

This "yellow nose + bare-metal body" cue is the strongest reference signal in the SX-B view.

### 3. Wings — `ExtrudeGeometry`

P-51D planform differs from Spitfire ellipse: nearly straight leading edge, slight trailing-edge taper, rounded (not pointed) tips.

Built as one full-span `THREE.Shape` traced with ~24 vertices: rectangular root section, then taper outboard, then rounded tip arcs. Span 11, root chord ~2.6, tip chord ~0.9, thickness via `depth: 0.20`.

Mount: low-wing, root at the fuselage underside, `position.set(0, -0.45, -0.3)`.

### 4. Bubble canopy

Hemisphere `SphereGeometry(0.42, 12, 8, 0, Math.PI*2, 0, Math.PI/2)` stretched along Z. Position so it sits aft of the wing root, on top of the fuselage. Already close in the current build — port over, tune position.

### 5. Belly radiator scoop

Keep `BoxGeometry(0.85, 0.45, 1.6)` in silver. The P-51 scoop is genuinely a flat-sided duct — rounding it would be inaccurate. Position under the fuselage just aft of the wing.

### 6. Tail surfaces

- Vertical fin: `ExtrudeGeometry` — flatter top edge than the Spitfire's leaf-shape, more rectangular silhouette characteristic of the P-51D.
- Horizontal stab: `ExtrudeGeometry` — tapered straight-edged trapezoid per side.

Both in silver.

### 7. US star-and-bar insignia helper

`makeStarBar(THREE, diameter)` returns a `THREE.Group` of stacked planar pieces, mirroring the `makeRoundel` pattern in `ww2-fighter.js`:

- Blue `CircleGeometry` disc (outer circle)
- White 5-point star inside (built as a `THREE.Shape` → `ShapeGeometry`)
- White rectangular bars left + right of the disc
- Red horizontal stripe through the bars (post-1947 style — but acceptable for a P-51D)

Each layer offset by ~0.002 along local Y to prevent z-fighting. Six placements:

- Wing top L + R
- Wing bottom L + R (rotated 180° so they face down)
- Fuselage sides L + R (rotated 90° so they face sideways)

Wing insignia diameter ~1.4; fuselage insignia diameter ~0.55 (smaller because the fuselage radius is ~0.5 at that station).

### 8. Display rename

In `lib/game/planes.js`, change `name: 'WW2 Fighter'` → `name: 'Spitfire'`. Also update the nearby comment `Spitfire-class WW2 entry` for consistency. No file/function/key changes — `ww2` stays as the plane key everywhere (saves untouched, tests untouched).

## Out of Scope

- Stat tuning (`maxSpeed`, pitch/yaw, collision radii).
- Controller / camera changes.
- Squadron codes (`SX-B`, `B6-Y`) — would need canvas-texture planes.
- OD-green variant — pick one livery and ship it.
- Renaming the file `p51.js` → `p51d.js`. The file already represents a Mustang; the "D" suffix is implicit.
- Renaming the `ww2` plane key, `ww2-fighter.js` file, or `buildWW2Fighter` function (per user direction — display name rename only).

## Constraints

- All new geometry uses `MeshPhongMaterial({ flatShading: true, shininess: 0 })` to match project style.
- Module surface preserved: `export function buildP51(THREE)` returns a `THREE.Group`; `g.userData.propeller` remains a spinnable mesh/group for `shell/main.js`'s chase loop.
- Keep approximate dimensions (~11 m wingspan, ~11 m length) so the existing `collisionRadius: 5.5` / `vertRadius: 1.3` in `lib/game/planes.js` stays reasonable. No collision tuning planned.
- Vertex count stays modest — chase view should not cost meaningfully more than the current box build.

## Validation

Two-track validation, mirroring the Spitfire rebuild:

1. **Six-view ortho screenshots** via `tools/inspect-p51.cjs` (puppeteer headless) and `p51-inspect.html`. Inspect after each phase: silhouette, livery, marking placement, no z-fighting.
2. **In-game chase cam** at `http://localhost:8085/` → Menu → P-51 Mustang → Fly. Confirm:
   - Plane reads as a bare-metal P-51D from chase view.
   - Star-and-bars visible on wing tops in level flight, wing bottoms during a roll, fuselage in banked turns.
   - Propeller still spins (`g.userData.propeller` wired).
   - Existing tests pass (`tests/planes.test.js`).

## Tooling additions

- `p51-inspect.html` — copy of `ww2-inspect.html` swapping `buildWW2Fighter` for `buildP51`.
- `tools/inspect-p51.cjs` — copy of `tools/inspect-ww2.cjs` swapping the URL to `/p51-inspect.html`.

## Phasing (commit cadence)

1. **Inspect tooling + baseline screenshot.** Commit before any model change so we have a before/after.
2. **Lathe fuselage + yellow spinner/nose band.** Replace box halves; bare-metal body, yellow nose.
3. **Tapered wings + rebuilt tail.** Swap box wings/tail for extruded planforms.
4. **Bubble canopy tuning + belly scoop reposition.** Cosmetic pass.
5. **`makeStarBar` helper + 6 placements.** Markings.
6. **Display rename `WW2 Fighter` → `Spitfire`.** One-line change, isolated commit.

Each phase: edit → screenshot via `tools/inspect-p51.cjs` → compare to reference → commit.

# WW2 Fighter — Spitfire Look & Feel

**Date:** 2026-05-29
**Scope:** Visual update to `lib/plane/ww2-fighter.js`. No stat changes, no controller changes, no roster changes.

## Goal

Make the WW2 Fighter read unmistakably as a Supermarine Spitfire from the
chase-cam, without departing from the project's faceted flat-shaded lowpoly
style. Reference: Spitfire Mk.I / Mk.Vb three-view, focusing on the silhouette
and roundel markings rather than camouflage / squadron codes.

## In Scope

1. **Silhouette**
   - Elliptical wings (asymmetric — straight-ish leading edge, elliptical
     trailing edge that closes at the tip). One `ExtrudeGeometry` per side
     built from a `THREE.Shape` with `curveSegments: 6–8` for faceted edges.
   - Teardrop bubble canopy: hemisphere `SphereGeometry` scaled along Z,
     replacing the current box canopy (same construction as `p51.js`).
   - Longer pointed nose: extend the spinner cone and slightly taper the
     fuselage front so the Merlin-engine-nose silhouette reads correctly.

2. **RAF roundels**
   - `makeRoundel(diameter)` helper returns a `THREE.Group` of three stacked
     `CircleGeometry` rings — blue outer, white middle, red center — each
     offset a small ε along the local Y axis to avoid z-fighting.
   - Six placements: wing top L/R, wing bottom L/R (facing down), fuselage
     sides L/R (facing sideways). Sized roughly proportional to surface.

## Out of Scope (deferable)

- Two-tone camouflage patches and grey underside.
- Yellow leading-edge identification stripes (Mk.V).
- Squadron code letters (`WZ·T`, `UD·D`) — would need a canvas-texture plane.
- Stat tuning, controller behavior, collision radius.

## Constraints

- Keep `MeshPhongMaterial({ flatShading: true })` for all new geometry to
  match the existing project style.
- Preserve the existing module surface: `export function buildWW2Fighter(THREE)`
  returns a `THREE.Group`, and `g.userData.propeller` must remain wired to a
  spinnable mesh/group so the chase loop in `shell/main.js` can spin it.
- Keep approximate dimensions (~11 m wingspan, ~9 m length) so the existing
  `collisionRadius: 5.7` / `vertRadius: 1.3` in `lib/game/planes.js` remains
  reasonable. No collision tuning planned.
- Vertex / mesh count should stay modest — a Spitfire chase view should not
  cost meaningfully more than the current model.

## Validation

- Visually verify in `http://localhost:8085/` (Menu → WW2 Fighter → Fly):
  silhouette reads as a Spitfire from chase cam; roundels visible on wing
  tops in level flight and on wing bottoms during a roll; fuselage roundels
  visible on banked turns.
- Confirm `g.userData.propeller` still spins.
- Existing tests (`tests/planes.test.js`) continue to pass.

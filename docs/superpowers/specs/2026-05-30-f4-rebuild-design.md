# F-4 Phantom II — Reshape + Repaint

**Date:** 2026-05-30
**Scope:** Reshape `lib/plane/f4.js` fuselage from `BoxGeometry` to a shaped `ExtrudeGeometry` side profile, swap the camo livery for bare-metal silver with a red radome nose and light-blue canopy, and add US star-and-bar insignia. Keep the bent wings, anhedral stabs, trapezoidal swept fin, twin exhaust nozzles, and tandem canopy shape (all already correct). No stat, controller, collision, or roster changes.

**Reference:** McDonnell Douglas F-4B Phantom II three-view by Skytamer.com — bare metal with red radome, US star-and-bars, twin engines, bent wings, anhedral stabs.

## Goal

Make the F-4 unmistakably read as an F-4 Phantom II from chase cam — pointed RED radome nose, twin side intakes, bent wings (already done), anhedral horizontal stabilizers (already done), tall swept fin (already done), twin exhausts (already done), bare-metal silver livery with US star-and-bars.

The current `f4.js` already has the right structural silhouette (bent wings + anhedral stabs are notably correct). The visual gap is the box fuselage (no shaping), Vietnam camo (wrong era for the iconic F-4 look), and missing markings.

## In Scope

### 1. Fuselage — `ExtrudeGeometry` side profile

Replace `BoxGeometry(1.4, 1.05, 9.5)` with an `ExtrudeGeometry` of a 2D side-view shape (shape-X = length, shape-Y = height), extruded along width ~1.4 (engine bay width).

Side-profile shape — subtle belly bulge: nose end ~0.2 tall at z=-4.75, swells smoothly to ~1.05 tall at the canopy/engine area (z ≈ -1.5 to 1.0), tapers down to ~0.4 tall at z=4.75 (tail end). The bulge is on the BELLY (negative Y) to suggest engine housing.

Approximate vertices (shape coords, top-half then bottom-half traced counter-clockwise):

```
(-4.75,  0.10),  // forward top tip
(-3.50,  0.40),  // top rises
(-1.00,  0.55),  // top peaks at canopy/engine area
( 1.00,  0.55),
( 2.50,  0.40),  // top descends toward tail
( 4.75,  0.20),  // top trailing
( 4.75, -0.20),  // bottom trailing
( 2.50, -0.55),  // bottom rises (engine bulge ends)
( 1.00, -0.65),  // engine belly low
(-1.00, -0.65),
(-3.50, -0.35),  // bottom rises toward nose
(-4.75, -0.10),  // forward bottom tip
```

`ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: false })`. Material SILVER.

Mesh orientation: `rotation.y = -π/2` so shape +X (length) maps to world +Z (aft) and the extrude depth runs along world -X. The plan will pin the exact `position.x` offset (~+0.70) so the body is centered on world X=0.

### 2. Nose cone — RED radome

Keep the existing `ConeGeometry(0.55, 2.4, 10)`, change material to `RED_NOSE = 0xb21a1a`. Position adjustments may be needed to align with the new fuselage front end (currently `position.z = -5.95`).

### 3. Canopy — light blue glass

Keep the existing `SphereGeometry` tandem-stretched canopy. Change material color from `0x2a3340` (dark) to `LIGHT_BLUE = 0x6ab4d8` so the glass reads as the F-4B's distinctive light-blue tint visible in the reference.

### 4. Side intakes — larger rectangular boxes

Replace the small `BoxGeometry(0.55, 0.7, 1.6)` intakes with larger `BoxGeometry(0.70, 0.80, 2.4)` boxes positioned snug against the sides of the new fuselage. Material SILVER (matching body, with a slight darker shade for variation? or just SILVER). Position outboard of the body width (X = ±0.95) at the wing root height.

### 5. Wings + tail surfaces — recolor only

Keep ALL the existing geometry (inner panel, outer panel with 23° dihedral kink, anhedral horizontal stabs, swept fin). Change materials from `BROWN`/`GREEN` to **SILVER** uniformly. Removes the camo, gives the bare-metal look. NO geometry changes.

### 6. Exhaust nozzles — no change

The existing twin `CylinderGeometry` exhaust nozzles + dark holes are correct. NO changes.

### 7. US star-and-bar insignia — 6 placements

Duplicate the `makeStarBar(THREE, diameter)` helper from `lib/plane/p51.js` into `lib/plane/f4.js` (same pattern as F-86). 6 placements (matching P-51's count):

- Wing top L+R (diameter ~1.0, positioned mid-span on the inner panel)
- Wing bottom L+R (diameter ~1.0, with `rotation.z = π` to face down)
- Fuselage sides L+R (diameter ~0.5, with nested-Group rotation to keep bars horizontal)

## Out of Scope

- Stat tuning, controller, collision changes.
- Underwing missiles or drop tanks (the reference shows them, but they're combat loadout not airframe).
- Pylons, fuel tanks, weapons.
- "USAF" or squadron text on wings.
- Wing fences or other small surface details.
- Renaming the file.
- Replacing the twin exhaust with shaped variable nozzles.

## Constraints

- All new geometry uses `MeshPhongMaterial({ flatShading: true, shininess: 0 })` to match project style.
- Module surface preserved: `export function buildF4(THREE)` returns a `THREE.Group`. No `userData.propeller` (jet).
- Keep approximate dimensions (~12 m wingspan, ~10 m length) so existing `collisionRadius: 4.4` / `vertRadius: 1.3` in `lib/game/planes.js` stays reasonable. No collision tuning planned.
- Don't touch the bent-wing geometry — it's already correct and complex.
- Don't touch the anhedral stabs — already correct.

## Validation

Two-track validation, mirroring P-51 / F-86 rebuilds:

1. **Six-view ortho screenshots** via `tools/inspect-f4.cjs` (puppeteer headless) and `f4-inspect.html`. Inspect after each phase: silhouette, livery, marking placement, no z-fighting.
2. **In-game chase cam** at `http://localhost:8085/` → Menu → F-4 Phantom → Fly. Confirm:
   - Plane reads as a bare-metal F-4 from chase view with red radome nose.
   - Bent wings, anhedral stabs, twin nozzles all visible.
   - Star-and-bars visible on wing tops, wing bottoms (during roll), fuselage sides (during banked turns).
   - Existing tests pass (`tests/planes.test.js`).

## Tooling additions

- `f4-inspect.html` — copy of `f86-inspect.html` swapping `buildF86` for `buildF4`.
- `tools/inspect-f4.cjs` — copy of `tools/inspect-f86.cjs` swapping the URL.

## Phasing (commit cadence)

1. **Inspect tooling + baseline screenshot.** Commit before any model change.
2. **Reshape fuselage** (ExtrudeGeometry side profile) **+ red nose + light-blue canopy.** All visible-color changes that don't touch wings/tail.
3. **Larger side intakes + recolor wings/tail/fin to SILVER.** Removes the camo.
4. **`makeStarBar` helper + 6 placements** (wing tops L+R + wing bottoms L+R + fuselage sides L+R).

Each phase: edit → screenshot via `tools/inspect-f4.cjs` → compare to reference → commit.

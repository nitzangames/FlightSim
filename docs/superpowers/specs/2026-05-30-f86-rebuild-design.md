# F-86 Sabre — Rebuild from Primitives to Lathe + Extrude

**Date:** 2026-05-30
**Scope:** Replace `lib/plane/f86.js` with a lathe-fuselage + extruded swept-wings F-86 Sabre. Bare-metal silver with yellow accent bands and US star-and-bar insignia. No stat, controller, collision, or roster changes.

**Reference:** North American F-86F Sabre 3-view blueprint (bare metal with yellow bands) + display-model photo (silver, yellow mid-fuselage stripe, US insignia).

## Goal

Make the F-86 unmistakably read as an F-86 Sabre from chase cam — open round nose intake, sharply swept tapered wings, bubble canopy, swept tail surfaces, yellow accent bands, US star-and-bars — without departing from the project's faceted flat-shaded lowpoly style.

The current `f86.js` is built from box primitives, a cylinder fuselage, and a pointed nose cone with a ring intake. Result: a generic faceted jet shape. The recent P-51 rebuild demonstrated a lathe-fuselage + extruded-wings approach that works well within the project's style — this spec applies the same approach, tuned for F-86 geometry. Major silhouette differences vs. P-51: no propeller, open round nose intake instead of pointed nose, sharply swept tapered wings, jet exhaust at the rear.

## In Scope

### 1. Fuselage — open-ended `LatheGeometry`

Profile points (radius, axial-Z). Unlike the P-51, the F-86 fuselage profile does NOT close at the endpoints — the LatheGeometry will be an open tube at both ends, exposing the intake at the front and the exhaust at the rear.

Approximate profile:
```
(0.55, -4.00),   // intake front edge
(0.56, -3.80),   // small intake lip
(0.60, -3.00),   // forward fuselage
(0.62, -1.50),   // max body radius (mid)
(0.60,  0.00),   // mid-aft taper begins
(0.55,  1.50),   // tapering toward exhaust
(0.48,  3.00),   // narrowing
(0.45,  4.00),   // exhaust nozzle radius
```

12 lathe segments → faceted but round-reading body. Length ~8.

### 2. Intake mouth

A dark `CircleGeometry` disc placed inside the front mouth, facing forward (+Z direction looking from the front, i.e., world -Z), creating the visual impression of the intake's dark interior. Diameter ~0.50 (slightly smaller than the mouth radius 0.55 so the body's lip is visible). Position at z = -3.95 (just inside the front edge).

### 3. Exhaust nozzle

At the rear, keep a thin `CylinderGeometry` ring (steel-colored) wrapping the back of the fuselage (radius matches profile end ~0.45) plus a dark `CircleGeometry` disc inside facing rearward.

### 4. Wings — `ExtrudeGeometry`, swept-tapered, one per side

P-51 had a single full-span shape, but the F-86's sharp sweep makes it cleaner to extrude one swept-tapered wing shape and mirror it for left/right.

Wing shape (right wing, in local XY):
- Root chord ~2.5, tip chord ~1.0
- Sweep ~35° measured at the leading edge
- Span (one side, root to tip) ~3.8 (so wingspan ~9.0 with both sides + small root gap)
- Rounded tip via a short arc

Mounted at fuselage mid-body, `wing.position.set(±0.55, -0.25, -0.5)`. Material SILVER, depth 0.18, `bevelEnabled: false`.

### 5. Bubble canopy

`SphereGeometry(0.45, 12, 8, 0, 2π, 0, π/2)` stretched along Z, material CANOPY (bluish-tinted). Position forward of the wings, `position.set(0, 0.55, -2.2)`, scale `(0.85, 1.0, 1.7)`.

### 6. Vertical fin — `ExtrudeGeometry`

Swept fin with a rounded top. Shape walks: base aft → base forward (dorsal fillet extension) → curved leading edge up → rounded top → vertical trailing edge back to base. ~7 vertices. Material SILVER, depth 0.12.

### 7. Horizontal stabilizers — `ExtrudeGeometry`, mirrored

Swept-back tapered trapezoid per side. Span ~1.5 (one side, root to tip), root chord ~0.8, tip chord ~0.4. Conventional low-mount: attached to the rear fuselage near the fin base, NOT a T-tail. Material SILVER, depth 0.10. Position ~z=3.0, y=0.1.

### 8. Yellow accent bands

Four placements per user selection:

- **Nose band**: `CylinderGeometry(0.63, 0.63, 0.30, 14)`, material YELLOW, rotated and positioned to wrap the front of the fuselage just aft of the intake at z ≈ -3.0.
- **Mid-fuselage band**: `CylinderGeometry(0.63, 0.63, 0.30, 14)`, material YELLOW, at z ≈ 0.5.
- **Wingtip bands**: a small `BoxGeometry(0.10, 0.20, ~1.0)` chunk at each wingtip, YELLOW, positioned at the outboard edge of each wing.
- **Vertical fin band**: a thin `BoxGeometry(0.13, 0.30, 0.6)` strip wrapping the upper portion of the fin, YELLOW.

### 9. US star-and-bar insignia — local `makeStarBar` helper

Duplicate the `makeStarBar(THREE, diameter)` helper from `lib/plane/p51.js` into `lib/plane/f86.js`. Mirrors `makeRoundel` pattern: blue disc + white star + white bars + red stripe segments. 4 placements:

- Wing top L + R (diameter ~0.7, positioned mid-span)
- Fuselage sides L + R (diameter ~0.45, positioned aft of the wings) — same nested-Group rotation trick as P-51 to keep bars horizontal

NO wing-bottom insignia (per user — the F-86 reference shows top-only).

## Out of Scope

- Stat tuning (`maxSpeed`, pitch/yaw, collision radii).
- Controller / camera / exhaust-cone flame changes.
- USAF text on wings — would need a texture or many small letter geometries.
- Checkerboard tail pattern — complex for lowpoly faceted style.
- Wing bottom insignia.
- Squadron codes / serial numbers (e.g., `FU-897`).
- Renaming the file `f86.js` → `sabre.js`.

## Constraints

- All new geometry uses `MeshPhongMaterial({ flatShading: true, shininess: 0 })` to match project style.
- Module surface preserved: `export function buildF86(THREE)` returns a `THREE.Group`. No `userData.propeller` (it's a jet — no spinning prop). The existing `shell/main.js` correctly skips propeller animation for jets without that field, so no changes there.
- Keep approximate dimensions (~9 m wingspan, ~8 m length) so the existing `collisionRadius: 4.5` / `vertRadius: 1.4` in `lib/game/planes.js` stays reasonable. No collision tuning planned.
- Vertex count stays modest — chase view should not cost meaningfully more than the current build.

## Validation

Two-track validation, mirroring the P-51 rebuild:

1. **Six-view ortho screenshots** via `tools/inspect-f86.cjs` (puppeteer headless) and `f86-inspect.html`. Inspect after each phase: silhouette, intake visibility, livery, marking placement, no z-fighting.
2. **In-game chase cam** at `http://localhost:8085/` → Menu → F-86 Sabre → Fly. Confirm:
   - Plane reads as a bare-metal F-86 from chase view with visible nose intake.
   - Swept wings and tail surfaces read correctly.
   - Yellow bands visible in all four locations.
   - Star-and-bars visible on wing tops and fuselage sides.
   - Existing tests pass (`tests/planes.test.js`).

## Tooling additions

- `f86-inspect.html` — copy of `p51-inspect.html` swapping `buildP51` for `buildF86`.
- `tools/inspect-f86.cjs` — copy of `tools/inspect-p51.cjs` swapping the URL to `/f86-inspect.html`.

## Phasing (commit cadence)

1. **Inspect tooling + baseline screenshot.** Commit before any model change.
2. **Lathe fuselage with open intake + intake disc + exhaust + bubble canopy.** Replaces fuselage/nose/canopy/exhaust primitives.
3. **Swept tapered wings** via ExtrudeGeometry.
4. **Swept fin + horizontal stabilizers** via ExtrudeGeometry.
5. **Yellow accent bands** (nose, mid-fuselage, wingtips, fin).
6. **`makeStarBar` helper + 4 placements** (wing top L+R, fuselage sides L+R).

Each phase: edit → screenshot via `tools/inspect-f86.cjs` → compare to reference → commit.

// Sandbox collision: only the terrain ground and water surface matter (no
// canyon walls, no obstacle lists). `crashed` compares against the surface
// beneath the plane — terrain on land, water-level otherwise — so flying
// into a lake crashes the plane the same way as flying into a hillside.
// `clampToCeiling` is a soft altitude cap that keeps the plane in-world
// without ending the run.
//
// CEILING is high enough to comfortably overfly the procedural mountains
// (with HEIGHT_AMP=5 and biome scaling, arctic peaks can reach ~700m).
// 5000m gives plenty of room to climb above the world.

import { WATER_LEVEL } from '../terrain/height.js';

export const CEILING = 5000;

// --- Shallow-impact graze ---------------------------------------------------
// A glancing terrain hit (the plane's nose nearly parallel to the slope) is
// survivable: the plane scrapes, bleeds speed, and keeps flying. A steeper hit
// (or water, or a building) still crashes. The slope is measured from 3 height
// samples around the impact point, and the impact angle is the angle between
// the plane's nose and that surface.
export const GRAZE_MAX_ANGLE_DEG = 20;   // ≤ this survives; steeper crashes
const NORMAL_SAMPLE_D = 2;               // metres between the 3 slope samples
const GRAZE_BASE_LOSS = 0.05;            // speed lost by a near-parallel skim
const GRAZE_SPAN_LOSS = 0.45;            // extra speed lost approaching the limit
// Minimum up.y to allow a graze: you can't skip off the ground inverted (or
// knife-edge) however shallow the angle — the canopy/wingtip digs in. up.y is
// 1 upright, 0 knife-edge, < 0 inverted, so this requires the plane upright.
const GRAZE_MIN_UP_Y = 0.05;
// Minimum speed to skip off the terrain, as a fraction of cruise (= 1.5× the
// stall speed). Below this you pancake instead of glancing off — so you can't
// settle the plane onto a slope and "land", and since each graze bleeds speed,
// riding a hillside self-terminates once you drop under this.
const GRAZE_MIN_SPEED_FRAC = 0.6;

// Up-pointing surface normal from 3 height samples (center + X + Z offsets).
export function terrainNormalAt(terrain, x, z) {
  const d = NORMAL_SAMPLE_D;
  const h0 = terrain.getHeight(x, z);
  const hx = terrain.getHeight(x + d, z);
  const hz = terrain.getHeight(x, z + d);
  let nx = -(hx - h0), ny = d, nz = -(hz - h0);
  const m = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / m, y: ny / m, z: nz / m };
}

// Angle (degrees) between the plane's nose (physics.forward) and the terrain
// surface at the plane's position. 0 = skimming parallel; 90 = straight in.
export function impactAngleDeg(physics, terrain) {
  const n = terrainNormalAt(terrain, physics.x, physics.z);
  const f = physics.forward;
  const dot = Math.min(1, Math.abs(f.x * n.x + f.y * n.y + f.z * n.z));
  return Math.asin(dot) * 180 / Math.PI;
}

// If the plane is in contact with LAND at a shallow angle, returns the data the
// physics needs to graze off it: { normal, surfaceY, downExtent, lossFrac,
// angleDeg }. Returns null when there's no contact, or when the contact should
// be a crash instead (water, a building, or too steep) — the caller falls back
// to crashed() in those cases.
export function grazeVerdict(physics, terrain, horizRadius, vertRadius) {
  if (!terrain) return null;
  const land = terrain.getHeight(physics.x, physics.z);
  if (land < WATER_LEVEL) return null;                 // over water → crash path
  const uy = physics.up ? physics.up.y : 1;
  const horizT = Math.sqrt(Math.max(0, 1 - uy * uy));
  const downExtent = vertRadius * Math.abs(uy) + horizRadius * horizT;
  if (physics.y - downExtent > land) return null;      // no contact
  if (uy < GRAZE_MIN_UP_Y) return null;                // inverted/knife-edge → crash
  if (physics.speed < physics.cfg.maxSpeed * GRAZE_MIN_SPEED_FRAC) return null;  // too slow → crash
  if (crashedAgainstBuildings(physics, terrain, horizRadius)) return null;  // hit a building
  const n = terrainNormalAt(terrain, physics.x, physics.z);
  const f = physics.forward;
  const dot = Math.min(1, Math.abs(f.x * n.x + f.y * n.y + f.z * n.z));
  const angleDeg = Math.asin(dot) * 180 / Math.PI;
  if (angleDeg > GRAZE_MAX_ANGLE_DEG) return null;     // too steep → crash
  const lossFrac = GRAZE_BASE_LOSS + GRAZE_SPAN_LOSS * (angleDeg / GRAZE_MAX_ANGLE_DEG);
  return { normal: n, surfaceY: land, downExtent, lossFrac, angleDeg };
}

// Approximate collision dimensions per building type, at scale=1. Each
// village BuildingInstance has its own b.scaleX/Y, which we multiply in.
// Treated as cylinders (XZ radius + Y height) — rotation does not affect
// a vertical cylinder, so we skip rotated AABBs.
//   r = horizontal half-extent at scale=1 (max of width/depth halves)
//   h = total height including roof at scale=1
const BUILDING_HIT = {
  house:         { r: 2.0, h: 4.5 },   // walls 3×4 + 1.5 gable roof
  barn:          { r: 3.5, h: 5.1 },   // walls 5×7 + 1.6 gable
  windmill:      { r: 1.6, h: 7.4 },   // 1.5 tower + 1.4 cap, base 3m radius
  church:        { r: 4.5, h: 8.5 },   // nave 6 long + 7m bell tower + roof
  castle_keep:   { r: 3.0, h: 8.8 },   // 4×4 walls + roof slab + crenel
  castle_tower:  { r: 1.7, h: 8.0 },   // 2.4×2.4 + 2.0 peaked roof
  castle_wall:   { r: 3.5, h: 4.0 },   // 0.8 deep, 6 long, 3.5 tall + crenel
  castle_chapel: { r: 2.0, h: 4.5 },   // reuses house shape
  // Monastery features. Church is the wide cross-shaped complex (transept
  // dominates the horizontal extent) with a tall bell tower; wing is a long
  // thin building. Heights include roof + spire on the church.
  monastery_church: { r: 5.5, h: 11.5 },
  monastery_wing:   { r: 2.0, h: 4.2 },
};

// Ground crash test — orientation-aware. The plane is modelled as a flat
// ellipsoid with horizontal half-extent = horizRadius (wingspan) and
// vertical half-extent = vertRadius (cockpit/canopy/tail height). The
// distance from the plane origin to the lowest world point depends on
// how much the plane is tilted:
//   • upright/inverted (|up.y| = 1) → vertRadius is what matters
//   • knife-edge       (|up.y| = 0) → horizRadius is what matters
// Interpolate via the ellipsoid projection formula:
//   downExtent = vertRadius * |up.y| + horizRadius * sqrt(1 - up.y²)
// Without this, an inverted biplane crashes 1m above where the (visible)
// upper wing actually clears the terrain — because the model's origin
// sits at the lower wing, the upper wing is the world-down extreme when
// inverted, and the symmetric sphere over-estimates the clearance needed.
export function crashed(physics, terrain, horizRadius, vertRadius) {
  if (!terrain) return false;
  // The surface beneath the plane — terrain on land, water level over a
  // lake or ocean. Using max() means flying into water crashes the same
  // way as flying into a hillside (we don't currently want a separate
  // "ditch on water" sequence).
  const surfaceY = Math.max(terrain.getHeight(physics.x, physics.z), WATER_LEVEL);
  const uy = physics.up ? physics.up.y : 1;
  const horizT = Math.sqrt(Math.max(0, 1 - uy * uy));
  const downExtent = vertRadius * Math.abs(uy) + horizRadius * horizT;
  if (physics.y - downExtent <= surfaceY) return true;
  // Buildings still use the spherical radius — flying past a windmill or
  // a castle tower hasn't shown the same user-perceptible asymmetry.
  if (crashedAgainstBuildings(physics, terrain, horizRadius)) return true;
  return false;
}

// Hit-test the plane against any building in the nearest village's footprint.
// Cheap: one nearest-village lookup (linear scan, ~50 villages) + at most a
// few dozen per-building cylinder checks. Returns true on the first hit.
export function crashedAgainstBuildings(physics, terrain, radius) {
  if (!terrain || !terrain.nearestVillage) return false;
  const v = terrain.nearestVillage(physics.x, physics.z);
  if (!v || !v.buildings) return false;
  // Only check when plane is within the village footprint envelope.
  if (v.distance > v.padRadius + 30) return false;
  for (const b of v.buildings) {
    const dim = BUILDING_HIT[b.type];
    if (!dim) continue;
    const dx = physics.x - b.x;
    const dz = physics.z - b.z;
    const hitR = dim.r * b.scaleX + radius;
    if (dx * dx + dz * dz >= hitR * hitR) continue;
    const minY = b.y - radius;
    const maxY = b.y + dim.h * b.scaleY + radius;
    if (physics.y >= minY && physics.y <= maxY) return true;
  }
  return false;
}

export function clampToCeiling(physics, ceiling = CEILING) {
  if (physics.y > ceiling) {
    physics.y = ceiling;
    if (physics.fallSpeed !== undefined && physics.fallSpeed < 0) physics.fallSpeed = 0;
    return true;
  }
  return false;
}

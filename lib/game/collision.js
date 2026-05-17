// Sandbox collision: only the terrain ground matters (no canyon walls, no
// obstacle lists). `crashed` is a terrain-height comparison. `clampToCeiling`
// is a soft altitude cap — keeps the plane in-world without ending the run.
//
// CEILING is high enough to comfortably overfly the procedural mountains
// (with HEIGHT_AMP=5 and biome scaling, arctic peaks can reach ~700m).
// 5000m gives plenty of room to climb above the world.

export const CEILING = 5000;

// Approximate collision dimensions per building type, at scale=1. Each
// village BuildingInstance has its own b.scaleX/Y, which we multiply in.
// Treated as cylinders (XZ radius + Y height) — rotation does not affect
// a vertical cylinder, so we skip rotated AABBs.
//   r = horizontal half-extent at scale=1 (max of width/depth halves)
//   h = total height including roof at scale=1
const BUILDING_HIT = {
  house:    { r: 2.0, h: 4.5 },   // walls 3×4 + 1.5 gable roof
  barn:     { r: 3.5, h: 5.1 },   // walls 5×7 + 1.6 gable
  windmill: { r: 1.6, h: 7.4 },   // 1.5 tower + 1.4 cap, base 3m radius
  church:   { r: 4.5, h: 8.5 },   // nave 6 long + 7m bell tower + roof
};

export function crashed(physics, terrain, radius) {
  if (!terrain) return false;
  const groundY = terrain.getHeight(physics.x, physics.z);
  if (physics.y - radius <= groundY) return true;
  if (crashedAgainstBuildings(physics, terrain, radius)) return true;
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

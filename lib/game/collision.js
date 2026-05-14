// Sandbox collision: only the terrain ground matters (no canyon walls, no
// obstacle lists). `crashed` is a terrain-height comparison. `clampToCeiling`
// is a soft altitude cap — keeps the plane in-world without ending the run.
//
// CEILING is high enough to comfortably overfly the procedural mountains
// (with HEIGHT_AMP=5 and biome scaling, arctic peaks can reach ~700m).
// 5000m gives plenty of room to climb above the world.

export const CEILING = 5000;

export function crashed(physics, terrain, radius) {
  if (!terrain) return false;
  const groundY = terrain.getHeight(physics.x, physics.z);
  return physics.y - radius <= groundY;
}

export function clampToCeiling(physics, ceiling = CEILING) {
  if (physics.y > ceiling) {
    physics.y = ceiling;
    if (physics.fallSpeed !== undefined && physics.fallSpeed < 0) physics.fallSpeed = 0;
    return true;
  }
  return false;
}

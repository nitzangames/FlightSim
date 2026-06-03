// Village pad flattening — the SINGLE source of truth for how a village
// lowers the ground around it. Used by BOTH the render path (chunk-build.js,
// per terrain vertex) and the collision/HUD path (terrain index getHeight,
// per query point). Because both call the same function, the rendered ground
// and the collision surface can never disagree — which is what previously let
// the plane crash into a mountain that had been visually flattened away.
//
// The flatten lerps the raw terrain height toward a village's groundY across
// its pad (fully flat) and falloff (smooth ramp back to raw terrain). The
// radii are warped by a smooth per-village angular function so the flattened
// footprint reads as an irregular blob/basin rather than a perfect circle.

// Outward-only warp amplitude. Buildings scatter out to ~0.92·padRadius in
// every direction (see village-layout), so the flat region can't shrink below
// that without stranding a building on a slope — hence the warp only ever
// grows the radius. Exported so the registry's affectingChunk margin can match
// the true (warped) reach.
export const PAD_WARP_AMP = 0.45;

// Angular radius multiplier in [1, 1+PAD_WARP_AMP]. Smooth 2nd+3rd harmonics
// keep it continuous at the 0/2π wrap; phases come from the village's
// paletteSeed so each footprint is a different shape, deterministically.
export function padWarp(paletteSeed, dx, dz) {
  const a = Math.atan2(dz, dx);
  const p1 = paletteSeed * 6.2831853;
  const p2 = paletteSeed * 19.739 + 1.7;
  const n = 0.5 + 0.25 * Math.sin(2 * a + p1) + 0.25 * Math.sin(3 * a + p2); // [0,1]
  return 1 + PAD_WARP_AMP * n;
}

// Blend rawY toward the groundY of any village whose (warped) pad/falloff
// covers (x, z), taking the strongest blend where footprints overlap. Returns
// the flattened ground height. `villages` is any iterable of village records
// with { x, z, groundY, padRadius, falloffRadius, paletteSeed }. The
// squared-distance early-out keeps it cheap when scanning the full registry.
export function flattenGroundHeight(rawY, x, z, villages) {
  let bestT = 0;
  let bestGroundY = 0;
  for (const V of villages) {
    const dx = x - V.x, dz = z - V.z;
    const dd = dx * dx + dz * dz;
    const maxR = V.falloffRadius * (1 + PAD_WARP_AMP);
    if (dd >= maxR * maxR) continue;
    const d = Math.sqrt(dd);
    const w = padWarp(V.paletteSeed, dx, dz);
    const padR = V.padRadius * w, falloffR = V.falloffRadius * w;
    if (d >= falloffR) continue;
    const u = padR >= falloffR ? 1 : (falloffR - d) / (falloffR - padR);
    const t = u >= 1 ? 1 : (u <= 0 ? 0 : u);
    const smoothT = t * t * (3 - 2 * t);
    if (smoothT > bestT) { bestT = smoothT; bestGroundY = V.groundY; }
  }
  return bestT > 0 ? rawY * (1 - bestT) + bestGroundY * bestT : rawY;
}

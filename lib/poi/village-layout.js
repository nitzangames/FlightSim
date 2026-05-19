import { FOREST_TEMPLATE } from './templates/forest.js';
import { DESERT_TEMPLATE } from './templates/desert.js';
import { ARCTIC_TEMPLATE } from './templates/arctic.js';
import { CASTLE_TEMPLATE } from './templates/castle.js';

const TEMPLATES_BY_KEY = {
  forest: FOREST_TEMPLATE,
  desert: DESERT_TEMPLATE,
  arctic: ARCTIC_TEMPLATE,
  castle: CASTLE_TEMPLATE,
};

// Tiny seeded PRNG (mulberry32) — splits paletteSeed into a stream.
function prng(seed) {
  let s = Math.floor(seed * 0x100000000) >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function pick(arr, r) { return arr[Math.floor(r * arr.length) % arr.length]; }
function jitter3(color, r, amt = 0.05) {
  return [color[0] + (r-0.5)*2*amt, color[1] + (r-0.5)*2*amt, color[2] + (r-0.5)*2*amt]
    .map(v => Math.max(0, Math.min(1, v)));
}

function aabbOverlap(a, b) {
  return Math.abs(a.x - b.x) < (a.rx + b.rx) && Math.abs(a.z - b.z) < (a.rz + b.rz);
}

// Building visual scale (applied to ALL instance scaleX/Y/Z and to the
// collision AABBs). Real-world building dimensions in lib/poi/buildings.js
// would be ~3 m houses, which read as tiny dots from a 500 m flight altitude.
// 2.5x makes them ~7.5 m tall (large house / barn-loft scale) — still believable
// but actually readable from the air.
const BUILDING_SCALE = 2.5;

const BUILDING_AABB = {
  house:    { rx: 2.0, rz: 2.5 },   // half-extents at scale=1; tryPlace multiplies by scale
  barn:     { rx: 3.0, rz: 4.0 },
  windmill: { rx: 1.8, rz: 1.8 },
  church:   { rx: 2.5, rz: 4.5 },
};

export function layoutVillage(village) {
  // Castles use a separate fixed-roster layout — keep + 4 towers + 4 walls
  // + chapel in a square plan. Same return shape as the village layout so
  // the chunk pipeline doesn't care which kind of POI this is.
  if (village.templateKey === 'castle') return layoutCastle(village);
  // Pick template by the village's biome. Falls back to forest if a future
  // village's templateKey doesn't match any known template.
  const T = TEMPLATES_BY_KEY[village.templateKey] || FOREST_TEMPLATE;
  const rng = prng(village.paletteSeed);
  const out = [];
  const placed = [];          // for AABB collision

  // Per-village palette: pick a wall tone and a roof tone from template.
  const wallTone = pick(T.palette.walls, rng());
  const roofTone = pick(T.palette.roofs, rng());

  function tryPlace(type, x, z, rotY, scale) {
    const half = BUILDING_AABB[type];
    // Try up to 3 shifts along the street axis if overlap detected.
    let shift = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      const tx = x + Math.cos(rotY) * shift;
      const tz = z + Math.sin(rotY) * shift;
      const candidate = { x: tx, z: tz, rx: half.rx * scale, rz: half.rz * scale };
      if (!placed.some(p => aabbOverlap(candidate, p))) {
        placed.push(candidate);
        const wallColor = jitter3(wallTone, rng());
        const roofColor = jitter3(roofTone, rng());
        out.push({
          type, x: tx, y: village.groundY, z: tz, rotY,
          scaleX: scale, scaleY: scale, scaleZ: scale,
          wallColor, roofColor,
          templateKey: village.templateKey,
        });
        return true;
      }
      shift += 2.5;
    }
    return false;
  }

  const tierCfg = T.sizeTiers[village.sizeTier];
  const houseCount = tierCfg.buildingCount[0] + Math.floor(rng() * (tierCfg.buildingCount[1] - tierCfg.buildingCount[0] + 1));
  const sHouseScale = () => BUILDING_SCALE * (0.85 + rng() * 0.3);
  const sBarnScale  = () => BUILDING_SCALE * (0.9  + rng() * 0.2);
  const sFixedScale = () => BUILDING_SCALE * 1.0;

  // Place specials first so houses scatter AROUND them. Specials sit on a
  // ring near the centre of the pad with random angles, so each village has
  // a different "town square" orientation.
  const specialRing = village.padRadius * 0.18;
  if (village.sizeTier === 'L') {
    // Church at the anchor centre — that's the village square.
    tryPlace('church', village.x, village.z, rng() * Math.PI * 2, sFixedScale());
  }
  if (village.sizeTier === 'M' || village.sizeTier === 'L') {
    const aBarn = rng() * Math.PI * 2;
    const aMill = aBarn + Math.PI + (rng() - 0.5) * 0.6; // roughly opposite
    tryPlace('barn',
      village.x + Math.cos(aBarn) * specialRing,
      village.z + Math.sin(aBarn) * specialRing,
      rng() * Math.PI * 2, sBarnScale());
    tryPlace('windmill',
      village.x + Math.cos(aMill) * specialRing,
      village.z + Math.sin(aMill) * specialRing,
      0, sFixedScale());
  } else if (rng() < 0.5) {
    // S tier — barn 50% chance, at a random position near the edge.
    const a = rng() * Math.PI * 2;
    const r = village.padRadius * 0.55;
    tryPlace('barn', village.x + Math.cos(a) * r, village.z + Math.sin(a) * r,
      rng() * Math.PI * 2, sBarnScale());
  }

  // Scatter houses across the pad. Polar coords with sqrt(r) for uniform-area
  // distribution. AABB collision (in tryPlace) pushes overlapping houses
  // outward; if all 4 shift attempts fail the house is skipped, which gives
  // a natural "where it fits" cluster rather than a forced row.
  const houseMaxR = village.padRadius * 0.92;
  for (let i = 0; i < houseCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 8 && !placed; attempt++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * houseMaxR;
      const hx = village.x + Math.cos(a) * r;
      const hz = village.z + Math.sin(a) * r;
      const rot = rng() * Math.PI * 2;
      placed = tryPlace('house', hx, hz, rot, sHouseScale());
    }
  }

  // Clamp any building origin that drifted past padRadius (rare, from shifts).
  const padR = village.padRadius;
  for (const b of out) {
    if (b.type === 'runway') continue;
    const dx = b.x - village.x, dz = b.z - village.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > padR * padR) {
      const s = padR / Math.sqrt(d2);
      b.x = village.x + dx * s;
      b.z = village.z + dz * s;
    }
  }

  // --- Runway ---
  // One long asphalt strip through the village centre, at a random angle.
  // Length is 1.8x pad radius (so it stays inside the flattened pad), width
  // 16 m — enough for the largest in-flight plane (F-15 at ~11.4 m wingspan)
  // plus a margin. Lifted 0.05 m above the pad so it sits on the ground
  // without z-fighting. Placed AFTER houses so the AABB check doesn't push
  // it sideways. Collision skips type='runway' so flying over it is safe
  // (and so taxi/landing on it doesn't trigger a crash).
  const runwayAngle  = rng() * Math.PI * 2;
  const runwayLength = village.padRadius * 1.8;
  const runwayWidth  = 16.0;
  const asphalt      = [0.32, 0.32, 0.34];
  out.push({
    type: 'runway',
    x: village.x, y: village.groundY + 0.05, z: village.z,
    rotY: runwayAngle,
    scaleX: runwayWidth, scaleY: 1, scaleZ: runwayLength,
    wallColor: asphalt,
    roofColor: asphalt,
    templateKey: village.templateKey,
  });

  // Expose runway endpoints + direction on the layout output as a sidecar
  // value via the first entry's metadata, so callers can find a runway
  // without parsing the buildings array. (Attached to the LAST building
  // instead is fragile; we'd rather plumb it through the registry — see
  // villages.js, which copies these onto the village object after layout.)
  out.runway = {
    x: village.x, y: village.groundY, z: village.z,
    angle: runwayAngle,
    length: runwayLength,
    width: runwayWidth,
  };

  return out;
}

// Castle layout — square plan: keep at the centre, 4 corner towers, 4 wall
// segments connecting the towers, 1 inner chapel. Same return shape as
// layoutVillage so the chunk pipeline doesn't care which it gets.
function layoutCastle(village) {
  const T = CASTLE_TEMPLATE;
  const rng = prng(village.paletteSeed);
  const out = [];
  const wallTone = pick(T.palette.walls, rng());
  const roofTone = pick(T.palette.roofs, rng());
  // Castle features are larger than village houses — use a higher base
  // scale so the keep and towers read as substantial stone structures.
  const CASTLE_SCALE = 3.5;
  const sScale = () => CASTLE_SCALE;
  function add(type, x, z, rotY, scale) {
    out.push({
      type, x, y: village.groundY, z, rotY,
      scaleX: scale, scaleY: scale, scaleZ: scale,
      wallColor: jitter3(wallTone, rng()),
      roofColor: jitter3(roofTone, rng()),
      templateKey: village.templateKey,
    });
  }

  // Castle outer square — distance from centre to corner / wall midpoint.
  // Pad radius 70 m × CASTLE_SCALE-aware: half-corner = 22 m gives a tight
  // ~30 m × 30 m bailey footprint, fits inside the flattened pad.
  const HALF_CORNER = 22;
  const baseAngle = rng() * Math.PI * 2;

  // Keep at centre.
  add('castle_keep', village.x, village.z, baseAngle, sScale());

  // 4 corner towers at ±HALF_CORNER on each axis (rotated by baseAngle).
  const cosA = Math.cos(baseAngle), sinA = Math.sin(baseAngle);
  const corners = [
    [-HALF_CORNER, -HALF_CORNER], [ HALF_CORNER, -HALF_CORNER],
    [ HALF_CORNER,  HALF_CORNER], [-HALF_CORNER,  HALF_CORNER],
  ];
  for (const [lx, lz] of corners) {
    const x = village.x + lx * cosA - lz * sinA;
    const z = village.z + lx * sinA + lz * cosA;
    add('castle_tower', x, z, baseAngle, sScale());
  }

  // 4 wall segments midway between each pair of corners. Each wall is
  // oriented so its long axis (local Z) runs along the side of the square.
  const sides = [
    // [midX, midZ, wallRot] — wallRot adds to baseAngle.
    [ 0, -HALF_CORNER, 0           ],  // south side: walls run along X (local Z = world X after rot 0)
    [ HALF_CORNER, 0,  Math.PI / 2 ],  // east side: walls run along Z
    [ 0,  HALF_CORNER, 0           ],  // north
    [-HALF_CORNER, 0,  Math.PI / 2 ],  // west
  ];
  for (const [lx, lz, dRot] of sides) {
    const x = village.x + lx * cosA - lz * sinA;
    const z = village.z + lx * sinA + lz * cosA;
    add('castle_wall', x, z, baseAngle + dRot, sScale());
  }

  // Small chapel inside the bailey, offset from centre toward a random
  // corner so it doesn't overlap the keep.
  const chapelAng = rng() * Math.PI * 2;
  const chapelR   = 8;
  add('castle_chapel',
    village.x + Math.cos(chapelAng) * chapelR,
    village.z + Math.sin(chapelAng) * chapelR,
    rng() * Math.PI * 2,
    CASTLE_SCALE * 0.6);

  // No runway on castles — but we still expose a markerTarget so the
  // generic marker pipeline can build a ring over the keep.
  out.markerTarget = {
    x: village.x, y: village.groundY, z: village.z,
    horizontal: true,             // axis along world +Y, ring is horizontal
  };
  return out;
}

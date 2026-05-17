import { FOREST_TEMPLATE } from './templates/forest.js';

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
  // TODO: select template by village.templateKey once other biomes ship a
  // template. Today only FOREST_TEMPLATE exists, so it's hardcoded.
  const T = FOREST_TEMPLATE;
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
        });
        return true;
      }
      shift += 2.5;
    }
    return false;
  }

  // Main-street axis (radians)
  const theta = rng() * Math.PI * 2;
  const along = (t) => [
    village.x + Math.cos(theta) * t,
    village.z + Math.sin(theta) * t,
  ];
  // Perpendicular direction for two rows
  const perp = theta + Math.PI / 2;
  const pAlong = (a, p) => [
    village.x + Math.cos(theta) * a + Math.cos(perp) * p,
    village.z + Math.sin(theta) * a + Math.sin(perp) * p,
  ];

  const tierCfg = T.sizeTiers[village.sizeTier];
  const houseCount = tierCfg.buildingCount[0] + Math.floor(rng() * (tierCfg.buildingCount[1] - tierCfg.buildingCount[0] + 1));
  // Spacing and row offsets scale with building visual size so 2.5x-bigger
  // houses still fit cleanly along the street.
  const spacing = 5.5 * BUILDING_SCALE;
  const rowOffsetM = 3 * BUILDING_SCALE;
  const rowOffsetL = 4 * BUILDING_SCALE;
  const sHouseScale  = () => BUILDING_SCALE * (0.85 + rng() * 0.3);
  const sBarnScale   = () => BUILDING_SCALE * (0.9  + rng() * 0.2);
  const sFixedScale  = ()  => BUILDING_SCALE * 1.0;

  if (village.sizeTier === 'S') {
    // Single row of houses, centered.
    for (let i = 0; i < houseCount; i++) {
      const t = (i - (houseCount - 1) / 2) * spacing;
      const [x, z] = along(t);
      const rot = theta + Math.PI/2 + (rng() - 0.5) * 0.5;
      tryPlace('house', x, z, rot, sHouseScale());
    }
    if (rng() < 0.5) {
      const [x, z] = along(((houseCount - 1) / 2 + 1) * spacing);
      tryPlace('barn', x, z, theta, sBarnScale());
    }
  } else if (village.sizeTier === 'M') {
    const perRow = Math.ceil(houseCount / 2);
    for (let i = 0; i < houseCount; i++) {
      const row = i < perRow ? -rowOffsetM : rowOffsetM;
      const idxInRow = i < perRow ? i : i - perRow;
      const t = (idxInRow - (perRow - 1) / 2) * spacing;
      const [x, z] = pAlong(t, row);
      const rot = theta + Math.PI/2 + (rng() - 0.5) * 0.5;
      tryPlace('house', x, z, rot, sHouseScale());
    }
    const endT = (Math.ceil(houseCount / 2) - 1) / 2 * spacing + 11 * BUILDING_SCALE;
    const [bx, bz] = along(-endT);
    tryPlace('barn', bx, bz, theta, sBarnScale());
    const [wx, wz] = along(endT);
    tryPlace('windmill', wx, wz, 0, sFixedScale());
  } else {
    // L tier — church at anchor first, then two rows of houses (AABB shifts push houses away from church).
    tryPlace('church', village.x, village.z, theta, sFixedScale());
    const perRow = Math.ceil(houseCount / 2);
    for (let i = 0; i < houseCount; i++) {
      const row = i < perRow ? -rowOffsetL : rowOffsetL;
      const idxInRow = i < perRow ? i : i - perRow;
      const t = (idxInRow - (perRow - 1) / 2) * spacing;
      const [x, z] = pAlong(t, row);
      const rot = theta + Math.PI/2 + (rng() - 0.5) * 0.5;
      tryPlace('house', x, z, rot, sHouseScale());
    }
    const endT = (Math.ceil(houseCount / 2) - 1) / 2 * spacing + 10 * BUILDING_SCALE;
    const [bx, bz] = along(-endT);
    tryPlace('barn', bx, bz, theta, sBarnScale());
    const [wx, wz] = along(endT);
    tryPlace('windmill', wx, wz, 0, sFixedScale());
  }

  // Clamp any building origin that drifted past padRadius (rare, from shifts).
  const padR = village.padRadius;
  for (const b of out) {
    const dx = b.x - village.x, dz = b.z - village.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > padR * padR) {
      const s = padR / Math.sqrt(d2);
      b.x = village.x + dx * s;
      b.z = village.z + dz * s;
    }
  }

  return out;
}

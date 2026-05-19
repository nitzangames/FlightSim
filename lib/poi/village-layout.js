import { FOREST_TEMPLATE } from './templates/forest.js';
import { DESERT_TEMPLATE } from './templates/desert.js';
import { ARCTIC_TEMPLATE } from './templates/arctic.js';

const TEMPLATES_BY_KEY = {
  forest: FOREST_TEMPLATE,
  desert: DESERT_TEMPLATE,
  arctic: ARCTIC_TEMPLATE,
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
    if (b.type === 'road') continue;
    const dx = b.x - village.x, dz = b.z - village.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > padR * padR) {
      const s = padR / Math.sqrt(d2);
      b.x = village.x + dx * s;
      b.z = village.z + dz * s;
    }
  }

  // --- Roads ---
  // Two crossed dirt paths through the village centre. Length spans most of
  // the pad; width 4 m. Lifted 0.05 m above the flattened pad so they sit on
  // the ground without z-fighting. Roads are placed AFTER houses so the per-
  // building AABB check doesn't reject them; they don't need collision and
  // collision.js skips type='road' in the hit test.
  const roadTheta = rng() * Math.PI * 2;
  const roadLen   = village.padRadius * 1.7;
  const roadWidth = 4.0;
  const roadColor = [0.45, 0.32, 0.20];
  function pushRoad(angle) {
    out.push({
      type: 'road',
      x: village.x, y: village.groundY + 0.05, z: village.z,
      rotY: angle,
      scaleX: roadWidth, scaleY: 1, scaleZ: roadLen,
      wallColor: roadColor,
      roofColor: roadColor,
      templateKey: village.templateKey,
    });
  }
  pushRoad(roadTheta);
  pushRoad(roadTheta + Math.PI / 2);

  return out;
}

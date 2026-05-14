// Region biomes for the open world. Palettes adapted from CanyonRun3D's
// lib/canyon/biomes.js (the alien biome is dropped — 5 total).
//
// biomeAt(x, z) maps a world position to one of 5 biomes via a 3×3 lookup
// of (temperature, moisture) noise. Region scale ≈ 6km (the noise period
// is 12km, each biome occupies roughly half a period in temp).
//
// scatterKey identifies which mesh the chunk should use for its trees/props
// when this biome is at the chunk center. See lib/scatter/index.js.

export const BIOMES = [
  {
    name:        'forest',
    sky:         [0.66, 0.78, 0.90],
    fog:         [0.81, 0.85, 0.88],
    fogNear:     300, fogFar: 900,
    sun:         [1.00, 0.97, 0.90],
    hemiSky:     [0.72, 0.88, 1.00],
    hemiGround:  [0.42, 0.50, 0.31],
    hemiIntensity: 0.60,
    terrainTint: [1.00, 1.00, 1.00],   // unchanged base palette
    scatterKey:  'conifer',
  },
  {
    name:        'desert',
    sky:         [0.90, 0.78, 0.55],
    fog:         [0.94, 0.78, 0.55],
    fogNear:     300, fogFar: 900,
    sun:         [1.00, 0.92, 0.74],
    hemiSky:     [0.94, 0.84, 0.65],
    hemiGround:  [0.62, 0.50, 0.30],
    hemiIntensity: 0.65,
    terrainTint: [1.70, 1.40, 0.40],   // bright yellow desert
    scatterKey:  'cactus',
  },
  {
    name:        'arctic',
    sky:         [0.72, 0.82, 0.88],
    fog:         [0.82, 0.87, 0.92],
    fogNear:     250, fogFar: 800,
    sun:         [0.92, 0.95, 1.00],
    hemiSky:     [0.82, 0.89, 0.94],
    hemiGround:  [0.62, 0.66, 0.70],
    hemiIntensity: 0.55,
    terrainTint: [2.50, 2.50, 2.80],   // snow white (over-bright so it clamps to white)
    scatterKey:  'icespike',
  },
  {
    name:        'volcanic',
    sky:         [0.23, 0.14, 0.12],
    fog:         [0.29, 0.16, 0.13],
    fogNear:     200, fogFar: 650,
    sun:         [1.00, 0.45, 0.30],
    hemiSky:     [0.42, 0.20, 0.16],
    hemiGround:  [0.25, 0.10, 0.06],
    hemiIntensity: 0.50,
    terrainTint: [1.50, 0.30, 0.20],   // hot red-orange lava rock
    scatterKey:  'vent',
  },
  {
    name:        'autumn',
    sky:         [0.90, 0.78, 0.56],
    fog:         [0.92, 0.78, 0.54],
    fogNear:     300, fogFar: 950,
    sun:         [1.00, 0.94, 0.78],
    hemiSky:     [0.95, 0.86, 0.62],
    hemiGround:  [0.55, 0.36, 0.18],
    hemiIntensity: 0.65,
    terrainTint: [1.60, 0.75, 0.30],   // saturated orange autumn (distinct from desert yellow)
    scatterKey:  'maple',
  },
];

const NAME_TO_BIOME = Object.fromEntries(BIOMES.map(b => [b.name, b]));

// 3×3 (temperature × moisture) lookup. 9 cells, 5 biomes — arctic/desert/
// forest each appear twice so the world stays balanced.
//                      dry         mid         wet
const LOOKUP = [
  /* cold */ ['arctic',   'arctic',   'forest'],
  /* mid  */ ['desert',   'forest',   'autumn'],
  /* hot  */ ['desert',   'volcanic', 'autumn'],
].map(row => row.map(name => NAME_TO_BIOME[name]));

// Smoothed value noise — deterministic, no external dependency.
function hash2(ix, iy) {
  let h = (ix | 0) * 374761393 + (iy | 0) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}
function noise(x, y, scale) {
  const sx = x / scale, sy = y / scale;
  const ix = Math.floor(sx), iy = Math.floor(sy);
  const fx = sx - ix, fy = sy - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const h00 = hash2(ix,     iy);
  const h10 = hash2(ix + 1, iy);
  const h01 = hash2(ix,     iy + 1);
  const h11 = hash2(ix + 1, iy + 1);
  return (h00 * (1-u) + h10 * u) * (1-v) + (h01 * (1-u) + h11 * u) * v;
}

// Region scale — the noise function has a period of `SCALE`, but the
// 3-bucket lookup means each biome only occupies ~SCALE/3 of that period.
// So for ~6km biomes on the temp axis we want SCALE ≈ 18km. Moisture uses
// a slightly different period so cells don't align on a grid.
const TEMP_SCALE  = 18000;
const MOIST_SCALE = 22500;
// Distinct seed offsets so the two channels are independent.
const TEMP_OFFSET = { x:  100, z:  100 };
const MOIST_OFFSET = { x: 9000, z: 9000 };

export function biomeAt(x, z) {
  const t = noise(x + TEMP_OFFSET.x,  z + TEMP_OFFSET.z,  TEMP_SCALE);
  const m = noise(x + MOIST_OFFSET.x, z + MOIST_OFFSET.z, MOIST_SCALE);
  const ti = Math.min(2, Math.floor(t * 3));
  const mi = Math.min(2, Math.floor(m * 3));
  return LOOKUP[ti][mi];
}

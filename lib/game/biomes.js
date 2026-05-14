// Region biomes for the open world. Each biome owns its own full color palette
// (per-altitude `bands`), atmosphere palette (sky/fog/sun/hemi), height scale
// (so desert is flat, arctic is jagged), and scatter mesh key. Replaces the
// older terrainTint approach — multiplying base colors washed out distinctions.
//
// biomeAt(x, z) maps a world position to one of 5 biomes via a 3×3 lookup
// of (temperature × moisture) noise. heightScaleAt(x, z) returns a smoothly-
// interpolated scalar so the height field doesn't show cliffs at biome edges.
//
// scatterKey identifies which mesh the chunk should use for its trees/props.

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
    bands: {
      deepWater: [0.18, 0.42, 0.62],
      sand:      [0.86, 0.78, 0.55],
      grassLow:  [0.52, 0.74, 0.40],
      grassMid:  [0.40, 0.62, 0.32],
      rock:      [0.55, 0.55, 0.58],
      snow:      [0.97, 0.97, 0.99],
    },
    heightScale: 1.0,           // default rolling hills + mountains
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
    bands: {
      deepWater: [0.42, 0.55, 0.50],   // sparse oasis
      sand:      [0.97, 0.88, 0.55],   // bright dune sand
      grassLow:  [0.95, 0.82, 0.48],   // sand top to bottom — no real grass
      grassMid:  [0.92, 0.76, 0.40],
      rock:      [0.88, 0.68, 0.34],   // tan/orange sandstone, not grey
      snow:      [0.95, 0.88, 0.65],   // pale dune crests (no actual snow)
    },
    heightScale: 0.35,                  // FLAT — dunes, not mountains
    scatterKey:  'cactus',
  },
  {
    name:        'arctic',
    sky:         [0.72, 0.82, 0.88],
    fog:         [0.82, 0.87, 0.92],
    fogNear:     250, fogFar: 800,
    sun:         [0.92, 0.95, 1.00],
    hemiSky:     [0.92, 0.95, 0.98],
    hemiGround:  [0.88, 0.92, 0.96],   // white ground bounce (snow reflects everywhere)
    hemiIntensity: 0.65,
    bands: {
      deepWater: [0.30, 0.45, 0.55],   // icy water
      sand:      [0.96, 0.98, 1.00],   // frosted shore — basically white
      grassLow:  [0.98, 0.99, 1.00],   // snow everywhere
      grassMid:  [0.97, 0.98, 1.00],   // still snow
      rock:      [0.92, 0.95, 0.98],   // ice-glazed rock, only a hint darker
      snow:      [1.00, 1.00, 1.00],   // pure white peaks
    },
    heightScale: 1.5,                   // JAGGED peaks
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
    bands: {
      deepWater: [0.70, 0.18, 0.05],   // lava — bright red-orange
      sand:      [0.40, 0.18, 0.10],   // dark ash shores
      grassLow:  [0.30, 0.12, 0.08],   // scorched
      grassMid:  [0.22, 0.10, 0.07],
      rock:      [0.18, 0.10, 0.08],   // black basalt
      snow:      [0.95, 0.35, 0.10],   // glowing magma at peaks
    },
    heightScale: 1.0,                   // normal — with occasional steep cones
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
    bands: {
      deepWater: [0.20, 0.32, 0.42],
      sand:      [0.92, 0.72, 0.40],   // warm tan shore
      grassLow:  [0.92, 0.55, 0.18],   // bright autumn orange
      grassMid:  [0.80, 0.42, 0.14],   // deep red-orange
      rock:      [0.65, 0.40, 0.18],   // warm red-brown rock, not grey
      snow:      [0.95, 0.85, 0.55],   // golden frosted peaks
    },
    heightScale: 0.8,                   // gentle rolling hills
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

// Region scale — the noise function has a period of `SCALE`, but the 3-bucket
// lookup means each biome occupies ~SCALE/3 of that period. So for ~1km biomes
// we want SCALE ≈ 3km.
const TEMP_SCALE  = 3000;
const MOIST_SCALE = 3750;
// Distinct seed offsets so the two channels are independent.
const TEMP_OFFSET  = { x:  100, z:  100 };
const MOIST_OFFSET = { x: 9000, z: 9000 };

export function biomeAt(x, z) {
  const t = noise(x + TEMP_OFFSET.x,  z + TEMP_OFFSET.z,  TEMP_SCALE);
  const m = noise(x + MOIST_OFFSET.x, z + MOIST_OFFSET.z, MOIST_SCALE);
  const ti = Math.min(2, Math.floor(t * 3));
  const mi = Math.min(2, Math.floor(m * 3));
  return LOOKUP[ti][mi];
}

// Smoothly interpolated height scale across the 3×3 lookup. Unlike biomeAt
// (discrete buckets), this returns a continuous value so heights don't show
// vertical cliffs at biome edges. Same noise inputs — when (t,m) crosses a
// bucket boundary, this lerps between the neighbouring biomes' heightScales.
export function heightScaleAt(x, z) {
  const t = noise(x + TEMP_OFFSET.x,  z + TEMP_OFFSET.z,  TEMP_SCALE)  * 3;
  const m = noise(x + MOIST_OFFSET.x, z + MOIST_OFFSET.z, MOIST_SCALE) * 3;
  const ti  = Math.min(2, Math.floor(t));
  const mi  = Math.min(2, Math.floor(m));
  const ti1 = Math.min(2, ti + 1);
  const mi1 = Math.min(2, mi + 1);
  const tf = Math.min(1, Math.max(0, t - ti));
  const mf = Math.min(1, Math.max(0, m - mi));
  const s00 = LOOKUP[ti ][mi ].heightScale;
  const s10 = LOOKUP[ti1][mi ].heightScale;
  const s01 = LOOKUP[ti ][mi1].heightScale;
  const s11 = LOOKUP[ti1][mi1].heightScale;
  return (s00 * (1-tf) + s10 * tf) * (1-mf) + (s01 * (1-tf) + s11 * tf) * mf;
}

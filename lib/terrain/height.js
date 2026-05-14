import { fbm, ridge } from './noise.js';
import { heightScaleAt } from '../game/biomes.js';

export const WATER_LEVEL = 0;
// Thresholds for chunk-build's per-altitude color bands. Scaled along with
// HEIGHT_AMP so the grass→rock→snow transitions land on plausible elevations
// instead of everything above ~9m being "snow".
export const GRASS_MID_LINE = 80;
export const ROCK_LINE      = 160;
export const SNOW_LINE      = 220;
export const MAX_HEIGHT_RANGE = 600;

const F = 0.012;     // base frequency (1/m)
const SEED1 = 1;     // base hills
const SEED2 = 7;     // mountains
const SEED3 = 23;    // basins/lakes
// Real-world scale: bump terrain heights so mountains feel like real terrain
// to a 7m biplane, not miniature hills. 5x gives forest peaks ~300m,
// arctic peaks ~450m (with biome heightScale applied on top).
const HEIGHT_AMP = 5;

// World height at (x, z). x and z are world meters.
// Three octaves: rolling hills + mountains + basins. The mountain exponent is
// 1.0 (was 1.6) so peaks rise gradually rather than spiking — more foothills
// and mid-altitude terrain visible between low ground and peaks. Biome height
// scale is applied last via heightScaleAt — desert flat (0.35), arctic
// jagged (1.5), etc.
export function terrainHeight(x, z, worldSeed = 0) {
  const s1 = SEED1 ^ worldSeed;
  const s2 = SEED2 ^ worldSeed;
  const s3 = SEED3 ^ worldSeed;

  const base = (fbm(x * F, z * F, s1) * 2 - 1) * 18;                       // [-18, 18]
  const mountains = ridge(x * F * 0.7, z * F * 0.7, s2) * 48;              // [0, 48], linear
  const basins = Math.pow(ridge(x * F * 0.25 + 5, z * F * 0.25 - 9, s3), 3.0) * -20;

  return (base + mountains + basins - 12) * HEIGHT_AMP * heightScaleAt(x, z);
}

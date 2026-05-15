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
// Three octaves: rolling hills + mountains + basins.
//   • Mountains use FBM (not ridge) for ROUNDED peaks — ridge inherently
//     produces sharp V-shaped peaks. The pow(fbm, 2) bias keeps valleys
//     low and gradually rises toward smooth dome-like mountains.
//   • Base hills get a chunkier amplitude so there's variation outside
//     mountain regions instead of pancake-flat low ground.
// Biome height scale is applied last via heightScaleAt — desert flat (0.35),
// arctic jagged (1.5), etc.
export function terrainHeight(x, z, worldSeed = 0) {
  const s1 = SEED1 ^ worldSeed;
  const s2 = SEED2 ^ worldSeed;
  const s3 = SEED3 ^ worldSeed;

  // Rolling hills: lower frequency for smoother hill character (1.0 -> 0.5)
  const base = (fbm(x * F * 0.5, z * F * 0.5, s1) * 2 - 1) * 26;
  // Mountains in two layers:
  //   • A LOW-FREQUENCY mask defines WHERE mountain ranges exist.
  //   • A medium-frequency FBM defines the mountain shape within them.
  // The mask uses a smoothstep ramp (not a hard clamp) so the foothills
  // blend in smoothly — no kink at the mask boundary.
  const mountainRange = fbm(x * F * 0.10, z * F * 0.10, s2);            // [0,1] smooth, ranges
  const mountainShape = fbm(x * F * 0.25, z * F * 0.25, s2 + 17);       // [0,1] smooth, peaks
  // Smoothstep: 0 below range=0.30, 1 above range=0.70, smooth in between.
  const t = Math.max(0, Math.min(1, (mountainRange - 0.30) / 0.40));
  const mountainMask = t * t * (3 - 2 * t);
  // Squared shape biases peaks toward the highest noise values — broad bases,
  // rounded summits.
  const mountains = mountainMask * mountainShape * mountainShape * 110;
  // Basins: ridge cubed gives narrow deep lake basins at ridge centers
  const basins = Math.pow(ridge(x * F * 0.25 + 5, z * F * 0.25 - 9, s3), 3.0) * -20;

  // Baseline +10 keeps most terrain comfortably above water (was -12 with
  // the old amplitudes; reducing mountain contribution dropped the average,
  // so the offset has to come up to maintain "land with occasional lake"
  // rather than "ocean with occasional island").
  return (base + mountains + basins + 10) * HEIGHT_AMP * heightScaleAt(x, z);
}

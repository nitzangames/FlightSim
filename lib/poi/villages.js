import { hash3 } from './hash.js';
import { FOREST_TEMPLATE } from './templates/forest.js';
import { DESERT_TEMPLATE } from './templates/desert.js';
import { ARCTIC_TEMPLATE } from './templates/arctic.js';
import { CASTLE_TEMPLATE } from './templates/castle.js';
import { MONASTERY_TEMPLATE } from './templates/monastery.js';
import { TOWN_TEMPLATE } from './templates/town.js';
import { layoutVillage } from './village-layout.js';
import { PAD_WARP_AMP } from '../terrain/pad-flatten.js';

export const WORLD_SIZE = 64000;
export const CELL_SIZE  = 1000;           // 64x64 anchor grid over 64 km world
export const GRID_N     = WORLD_SIZE / CELL_SIZE;

// Per-cell placement jitter. Without it every POI sits at the exact center of
// its 1 km cell, so they line up on a perfectly regular lattice. We offset each
// POI by up to ±JITTER_FRAC × CELL_SIZE on each axis (independent X/Z rolls) to
// break that up. Capped at 0.2: adjacent centers are CELL_SIZE apart, so the
// minimum spacing is CELL_SIZE − 2·0.2·CELL_SIZE = 600 m, which still clears the
// largest combined falloff (two towns at 270 m each = 540 m) — no overlaps.
const JITTER_FRAC   = 0.2;
const JITTER_X_SALT = 0x5A17ED01;
const JITTER_Z_SALT = 0x5A17ED02;

// Falloff width: how far past the flat pad the ground ramps smoothly back to
// raw terrain. Wide (vs the old 50 m) so a village near a mountain reads as a
// town nestled in a VALLEY — the slope ramps gently down into the basin —
// instead of a flat shelf cut into the peak with a near-vertical edge. The
// render and collision both use this same falloff (see pad-flatten.js), so the
// gentler ramp is consistent and the plane can't crash into a flattened slope.
const FALLOFF_WIDTH = 200;   // metres

// Each template gets an INDEPENDENT roll per cell (salted with its key) so
// the templates' biome+altitude filters are the only thing that drives the
// mix — every template now uses the same baseProbability (0.06). Order in
// this array still matters as a tiebreaker for cells where two templates
// both roll into acceptance: castles/monasteries/towns are listed first so
// they "win" the tie and a special POI doesn't get stomped by a generic
// village in cells where both would have placed.
const TEMPLATES = [
  MONASTERY_TEMPLATE,
  CASTLE_TEMPLATE,
  TOWN_TEMPLATE,
  FOREST_TEMPLATE,
  DESERT_TEMPLATE,
  ARCTIC_TEMPLATE,
];

// Per-template salt — XOR'd into the world seed to give each template its own
// independent placement hash. Values are arbitrary 32-bit constants; just need
// to differ per template so the rolls aren't correlated.
const TEMPLATE_SALT = {
  forest:    0x1F015E57,
  desert:    0x1DE5E27F,
  arctic:    0x1A1C71C0,
  castle:    0x1CA57133,
  monastery: 0x1110A57E,
  town:      0x17074A40,
};
// Keyed lookup so layout can fetch the template by village.templateKey
// without an array search.
const TEMPLATES_BY_KEY = Object.fromEntries(TEMPLATES.map(t => [t.key, t]));
export function getTemplate(key) { return TEMPLATES_BY_KEY[key]; }

// Map size roll → tier using template thresholds. Templates may omit some
// tiers (castles have only S, towns have only L) — fall through in declared
// order until we find one that exists.
function pickSizeTier(template, roll) {
  const t = template.sizeTiers;
  if (t.S && roll < t.S.rollMax) return { tier: 'S', cfg: t.S };
  if (t.M && roll < t.M.rollMax) return { tier: 'M', cfg: t.M };
  if (t.L) return { tier: 'L', cfg: t.L };
  if (t.M) return { tier: 'M', cfg: t.M };
  return { tier: 'S', cfg: t.S };
}

// True if this template's biome+altitude rules accept this cell. A template
// may declare `biome` (single string) OR `biomes` (array) — castles and
// monasteries use the array form to live in multiple biomes.
function templateAcceptsCell(t, biomeKey, altitude) {
  const biomeOK = t.biomes ? t.biomes.includes(biomeKey) : (t.biome === biomeKey);
  if (!biomeOK) return false;
  if (altitude < t.altitudeRange[0] || altitude > t.altitudeRange[1]) return false;
  return true;
}

// Pick a template for this cell using independent per-template rolls. Each
// template gets its own hash; the first one (in TEMPLATES order, which lists
// rare overlays before generic villages) whose roll falls under its
// baseProbability wins. Returns null if no template accepts.
function pickTemplate(i, j, seed, biomeKey, altitude) {
  for (const t of TEMPLATES) {
    if (!templateAcceptsCell(t, biomeKey, altitude)) continue;
    const roll = hash3(i, j, seed ^ TEMPLATE_SALT[t.key]);
    if (roll < t.baseProbability) return t;
  }
  return null;
}

// Build the global village registry. Sync, ~ms.
//
// opts:
//   seed              world seed (uint32)
//   biomeAt(x, z)     → { key } per the game's biome module
//   terrainHeightFn(x, z) → number, natural elevation at (x, z) given seed
//   riverDepthAtFn(x, z)  → number, > 0 if (x, z) is inside a river/lake carve at width 1
export function buildVillageRegistry({ seed, biomeAt, terrainHeightFn, riverDepthAtFn }) {
  const all = [];
  let id = 0;
  const half = WORLD_SIZE / 2;
  for (let j = 0; j < GRID_N; j++) {
    for (let i = 0; i < GRID_N; i++) {
      // Cell center, then a deterministic per-cell jitter so POIs don't sit on
      // a perfectly regular grid. Terrain/biome/river are sampled at the
      // jittered position — where the POI actually lands — so the gates below
      // stay correct.
      const jmax = JITTER_FRAC * CELL_SIZE;
      const x = -half + (i + 0.5) * CELL_SIZE + (hash3(i, j, seed ^ JITTER_X_SALT) - 0.5) * 2 * jmax;
      const z = -half + (j + 0.5) * CELL_SIZE + (hash3(i, j, seed ^ JITTER_Z_SALT) - 0.5) * 2 * jmax;
      const altitude = terrainHeightFn(x, z);
      const biome = biomeAt(x, z);
      // Real biome objects use `name`; test fixtures use `key`. Accept either.
      const biomeKey = biome.name || biome.key;
      if (riverDepthAtFn(x, z) > 0) continue;
      const template = pickTemplate(i, j, seed, biomeKey, altitude);
      if (!template) continue;
      const sizeRoll = hash3(i, j, seed ^ 0xC0FFEE);
      const { tier, cfg } = pickSizeTier(template, sizeRoll);
      const paletteSeed = hash3(i, j, seed ^ 0xBEEFFACE);
      const v = {
        id: id++,
        x, z,
        groundY: altitude,
        sizeTier: tier,
        padRadius: cfg.padRadius,
        falloffRadius: cfg.padRadius + FALLOFF_WIDTH,
        paletteSeed,
        templateKey: template.key,
      };
      // Pre-compute layout once so collision tests can query buildings every
      // frame without re-running procedural placement. Same instances the
      // chunk-build pipeline emits (deterministic per paletteSeed). The
      // layout returns sidecar fields for runway (villages) or markerTarget
      // (castles) used downstream.
      const layout = layoutVillage(v);
      v.buildings = layout;
      v.runway = layout.runway || null;
      v.markerTarget = layout.markerTarget || null;
      all.push(v);
    }
  }

  // chunkSize default matches the existing CHUNK_SIZE in chunk-manager (512).
  function inChunk(cx, cz, chunkSize = 512) {
    const x0 = cx * chunkSize, x1 = x0 + chunkSize;
    const z0 = cz * chunkSize, z1 = z0 + chunkSize;
    return all.filter(v => v.x >= x0 && v.x < x1 && v.z >= z0 && v.z < z1);
  }

  function affectingChunk(cx, cz, chunkSize = 512) {
    const x0 = cx * chunkSize, x1 = x0 + chunkSize;
    const z0 = cz * chunkSize, z1 = z0 + chunkSize;
    // Use the WARPED reach (falloffRadius can bulge by PAD_WARP_AMP), so a chunk
    // a lobe spills into still flattens it — otherwise the rendered pad seams at
    // the chunk boundary where one chunk flattens and its neighbour doesn't.
    return all.filter(v => {
      const reach = v.falloffRadius * (1 + PAD_WARP_AMP);
      return v.x + reach >= x0 && v.x - reach < x1 &&
             v.z + reach >= z0 && v.z - reach < z1;
    });
  }

  return { all, inChunk, affectingChunk };
}

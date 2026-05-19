import { hash3 } from './hash.js';
import { FOREST_TEMPLATE } from './templates/forest.js';
import { DESERT_TEMPLATE } from './templates/desert.js';
import { ARCTIC_TEMPLATE } from './templates/arctic.js';
import { layoutVillage } from './village-layout.js';

export const WORLD_SIZE = 64000;
export const CELL_SIZE  = 1000;           // 64x64 anchor grid over 64 km world
export const GRID_N     = WORLD_SIZE / CELL_SIZE;

const TEMPLATES = [FOREST_TEMPLATE, DESERT_TEMPLATE, ARCTIC_TEMPLATE];
// Keyed lookup so layout can fetch the template by village.templateKey
// without an array search.
const TEMPLATES_BY_KEY = Object.fromEntries(TEMPLATES.map(t => [t.key, t]));
export function getTemplate(key) { return TEMPLATES_BY_KEY[key]; }

// Map size roll → tier using template thresholds.
function pickSizeTier(template, roll) {
  const t = template.sizeTiers;
  if (roll < t.S.rollMax) return { tier: 'S', cfg: t.S };
  if (roll < t.M.rollMax) return { tier: 'M', cfg: t.M };
  return { tier: 'L', cfg: t.L };
}

// Find the template (if any) whose biome and altitude rules match this cell.
function matchTemplate(biomeKey, altitude) {
  for (const t of TEMPLATES) {
    if (t.biome !== biomeKey) continue;
    if (altitude < t.altitudeRange[0] || altitude > t.altitudeRange[1]) continue;
    return t;
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
      // Cell center in world coords
      const x = -half + (i + 0.5) * CELL_SIZE;
      const z = -half + (j + 0.5) * CELL_SIZE;
      const altitude = terrainHeightFn(x, z);
      const biome = biomeAt(x, z);
      // Real biome objects use `name`; test fixtures use `key`. Accept either.
      const template = matchTemplate(biome.name || biome.key, altitude);
      if (!template) continue;
      if (riverDepthAtFn(x, z) > 0) continue;
      const placeRoll = hash3(i, j, seed);
      if (placeRoll >= template.baseProbability) continue;
      const sizeRoll = hash3(i, j, seed ^ 0xC0FFEE);
      const { tier, cfg } = pickSizeTier(template, sizeRoll);
      const paletteSeed = hash3(i, j, seed ^ 0xBEEFFACE);
      const v = {
        id: id++,
        x, z,
        groundY: altitude,
        sizeTier: tier,
        padRadius: cfg.padRadius,
        falloffRadius: cfg.padRadius + 50,
        paletteSeed,
        templateKey: template.key,
      };
      // Pre-compute layout once so collision tests can query buildings every
      // frame without re-running procedural placement. Same instances the
      // chunk-build pipeline emits (deterministic per paletteSeed). The
      // layout returns a sidecar `runway` field used for landing logic.
      const layout = layoutVillage(v);
      v.buildings = layout;
      v.runway = layout.runway || null;
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
    return all.filter(v => (
      v.x + v.falloffRadius >= x0 && v.x - v.falloffRadius < x1 &&
      v.z + v.falloffRadius >= z0 && v.z - v.falloffRadius < z1
    ));
  }

  return { all, inChunk, affectingChunk };
}

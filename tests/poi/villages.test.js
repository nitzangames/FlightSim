import { describe, it, expect } from 'vitest';
import { buildVillageRegistry, WORLD_SIZE, CELL_SIZE } from '../../lib/poi/villages.js';

// Fake forest-everywhere biome + flat-30m terrain + no rivers.
const allForest = () => ({ key: 'forest' });
const flatTerrain = () => 30;
const noRivers = () => 0;
const opts = { seed: 42, biomeAt: allForest, terrainHeightFn: flatTerrain, riverDepthAtFn: noRivers };

describe('buildVillageRegistry', () => {
  it('produces a deterministic Village[] for a given seed', () => {
    const a = buildVillageRegistry(opts).all;
    const b = buildVillageRegistry(opts).all;
    expect(a.length).toBe(b.length);
    expect(a[0]).toEqual(b[0]);
  });

  it('produces zero villages when no template matches the biome', () => {
    const r = buildVillageRegistry({ ...opts, biomeAt: () => ({ key: 'mystery' }) }).all;
    expect(r.length).toBe(0);
  });

  it('produces zero villages when terrain is above every template\'s altitude band', () => {
    // All templates currently cap at 250 m (arctic); 400 m exceeds all of them.
    const r = buildVillageRegistry({ ...opts, terrainHeightFn: () => 400 }).all;
    expect(r.length).toBe(0);
  });

  it('produces villages with valid size tiers + pad radius', () => {
    const r = buildVillageRegistry(opts).all;
    expect(r.length).toBeGreaterThan(20);
    for (const v of r) {
      expect(['S', 'M', 'L']).toContain(v.sizeTier);
      // Forest pad radii (other templates have different values; fixture uses all-forest biome)
      expect([130, 200, 300]).toContain(v.padRadius);
      expect(v.falloffRadius).toBe(v.padRadius + 50);
      expect(v.groundY).toBe(30);
      expect(v.templateKey).toBe('forest');
    }
  });

  it('inChunk returns villages whose anchor falls in the chunk', () => {
    const reg = buildVillageRegistry(opts);
    const CHUNK = 512;
    for (const v of reg.all) {
      const cx = Math.floor(v.x / CHUNK);
      const cz = Math.floor(v.z / CHUNK);
      expect(reg.inChunk(cx, cz, CHUNK)).toContain(v);
    }
  });

  it('affectingChunk returns villages within falloff radius of a chunk', () => {
    const reg = buildVillageRegistry(opts);
    const CHUNK = 512;
    const v = reg.all[0];
    const cx = Math.floor(v.x / CHUNK);
    const cz = Math.floor(v.z / CHUNK);
    expect(reg.affectingChunk(cx, cz, CHUNK)).toContain(v);
  });

  it('affectingChunk catches villages spilling in from an adjacent chunk', () => {
    // The behaviour that distinguishes affectingChunk from inChunk: a village
    // whose anchor is in chunk N can still affect neighbour N±1 because its
    // pad/falloff radius reaches across the boundary.
    const reg = buildVillageRegistry(opts);
    const CHUNK = 512;
    // Find a village whose anchor is within `falloffRadius` of a chunk edge.
    const v = reg.all.find(x => {
      const localX = ((x.x % CHUNK) + CHUNK) % CHUNK;
      return localX < x.falloffRadius || localX > CHUNK - x.falloffRadius;
    });
    expect(v).toBeDefined();
    const anchorChunkX = Math.floor(v.x / CHUNK);
    const anchorChunkZ = Math.floor(v.z / CHUNK);
    // Whichever side the village is near, the neighbour on that side sees it.
    const localX = ((v.x % CHUNK) + CHUNK) % CHUNK;
    const neighborDX = localX < v.falloffRadius ? -1 : 1;
    const affected = reg.affectingChunk(anchorChunkX + neighborDX, anchorChunkZ, CHUNK);
    expect(affected).toContain(v);
    // Sanity: inChunk on the neighbour does NOT contain it (anchor isn't there).
    expect(reg.inChunk(anchorChunkX + neighborDX, anchorChunkZ, CHUNK)).not.toContain(v);
  });
});

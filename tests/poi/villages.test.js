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

  it('produces fewer villages when no forest biome', () => {
    const r = buildVillageRegistry({ ...opts, biomeAt: () => ({ key: 'desert' }) }).all;
    expect(r.length).toBe(0);
  });

  it('produces fewer villages when terrain out of altitude band', () => {
    const r = buildVillageRegistry({ ...opts, terrainHeightFn: () => 200 }).all;
    expect(r.length).toBe(0);
  });

  it('produces villages with valid size tiers + pad radius', () => {
    const r = buildVillageRegistry(opts).all;
    expect(r.length).toBeGreaterThan(20);
    for (const v of r) {
      expect(['S', 'M', 'L']).toContain(v.sizeTier);
      expect([25, 35, 50]).toContain(v.padRadius);
      expect(v.falloffRadius).toBe(v.padRadius + 25);
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
});

import { describe, it, expect } from 'vitest';
import { BIOMES, biomeAt } from '../lib/game/biomes.js';

const KEYS = ['forest', 'desert', 'arctic', 'volcanic', 'autumn'];
const SCATTER_KEYS = ['conifer', 'cactus', 'icespike', 'vent', 'maple'];

describe('BIOMES roster', () => {
  it('contains exactly the five expected names', () => {
    expect(BIOMES.map(b => b.name).sort()).toEqual([...KEYS].sort());
  });

  it('each biome has the required palette + scatter shape', () => {
    for (const b of BIOMES) {
      expect(typeof b.name).toBe('string');
      expect(b.sky.length).toBe(3);
      expect(b.fog.length).toBe(3);
      expect(typeof b.fogNear).toBe('number');
      expect(typeof b.fogFar).toBe('number');
      expect(b.sun.length).toBe(3);
      expect(b.hemiSky.length).toBe(3);
      expect(b.hemiGround.length).toBe(3);
      expect(typeof b.hemiIntensity).toBe('number');
      expect(b.terrainTint.length).toBe(3);
      expect(SCATTER_KEYS).toContain(b.scatterKey);
    }
  });
});

describe('biomeAt', () => {
  it('is deterministic for the same coords', () => {
    const a = biomeAt(1234, 5678);
    const b = biomeAt(1234, 5678);
    expect(a).toBe(b);
  });

  it('returns one of the BIOMES entries', () => {
    const b = biomeAt(0, 0);
    expect(BIOMES).toContain(b);
  });

  it('all 5 biomes are reachable in a 20km × 20km sweep', () => {
    const seen = new Set();
    for (let x = -10000; x < 10000; x += 250) {
      for (let z = -10000; z < 10000; z += 250) {
        seen.add(biomeAt(x, z).name);
        if (seen.size === KEYS.length) return;
      }
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  it('biomes form regions, not pixel noise (neighbors usually match)', () => {
    let matches = 0, total = 0;
    for (let i = 0; i < 200; i++) {
      const x = (i * 37) % 5000, z = (i * 91) % 5000;
      const here = biomeAt(x, z);
      const near = biomeAt(x + 50, z + 50);   // sample 50m away
      total++;
      if (here === near) matches++;
    }
    // 50m is much smaller than 6km region size — most neighbors should match
    expect(matches / total).toBeGreaterThan(0.85);
  });
});

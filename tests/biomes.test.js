import { describe, it, expect } from 'vitest';
import { BIOMES, biomeAt, heightScaleAt } from '../lib/game/biomes.js';

const KEYS = ['forest', 'desert', 'arctic', 'volcanic', 'autumn'];
const SCATTER_KEYS = ['conifer', 'cactus', 'icespike', 'vent', 'maple'];
const BAND_NAMES = ['deepWater', 'sand', 'grassLow', 'grassMid', 'rock', 'snow'];

describe('BIOMES roster', () => {
  it('contains exactly the five expected names', () => {
    expect(BIOMES.map(b => b.name).sort()).toEqual([...KEYS].sort());
  });

  it('each biome has palette + bands + heightScale + scatter shape', () => {
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
      expect(typeof b.heightScale).toBe('number');
      expect(b.heightScale).toBeGreaterThan(0);
      for (const bandName of BAND_NAMES) {
        expect(b.bands[bandName].length).toBe(3);
      }
      expect(SCATTER_KEYS).toContain(b.scatterKey);
    }
  });

  it('desert is the flattest, arctic is the jaggedest', () => {
    const byName = Object.fromEntries(BIOMES.map(b => [b.name, b]));
    expect(byName.desert.heightScale).toBeLessThan(byName.forest.heightScale);
    expect(byName.arctic.heightScale).toBeGreaterThan(byName.forest.heightScale);
  });
});

describe('heightScaleAt', () => {
  it('returns a positive scalar everywhere', () => {
    for (let i = 0; i < 50; i++) {
      const x = (i * 173) % 5000, z = (i * 91) % 5000;
      const s = heightScaleAt(x, z);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThan(3);
    }
  });

  it('is smooth — neighbors differ by less than 50% (no cliffs at borders)', () => {
    let maxJump = 0;
    for (let i = 0; i < 200; i++) {
      const x = (i * 37) % 5000, z = (i * 91) % 5000;
      const a = heightScaleAt(x, z);
      const b = heightScaleAt(x + 5, z + 5);     // 5m apart
      const jump = Math.abs(a - b) / Math.max(a, b);
      if (jump > maxJump) maxJump = jump;
    }
    // 5m apart on a ~1km biome scale → at most a few % gradient
    expect(maxJump).toBeLessThan(0.15);
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

  it('all 5 biomes are reachable in a 10km × 10km sweep', () => {
    const seen = new Set();
    for (let x = -5000; x < 5000; x += 100) {
      for (let z = -5000; z < 5000; z += 100) {
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

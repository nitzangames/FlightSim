import { describe, it, expect } from 'vitest';
import { layoutVillage } from '../../lib/poi/village-layout.js';

const baseVillage = (over = {}) => ({
  id: 0, x: 5000, z: 5000, groundY: 30,
  sizeTier: 'M', padRadius: 110, falloffRadius: 160,
  paletteSeed: 0.4, templateKey: 'forest',
  ...over,
});

describe('layoutVillage', () => {
  it('returns deterministic BuildingInstance[] for same input', () => {
    const v = baseVillage();
    const a = layoutVillage(v);
    const b = layoutVillage(v);
    expect(a.length).toBe(b.length);
    expect(a[0]).toEqual(b[0]);
  });

  it('S tier yields ~20–28 houses + maybe a barn', () => {
    const v = baseVillage({ sizeTier: 'S', padRadius: 75, falloffRadius: 125 });
    const out = layoutVillage(v);
    expect(out.length).toBeGreaterThanOrEqual(20);
    expect(out.length).toBeLessThanOrEqual(30);
  });

  it('M tier yields ~40–52 houses + barn + windmill', () => {
    const v = baseVillage({ sizeTier: 'M' });
    const out = layoutVillage(v);
    const types = out.map(b => b.type);
    expect(types).toContain('barn');
    expect(types).toContain('windmill');
    expect(out.length).toBeGreaterThanOrEqual(40);
    expect(out.length).toBeLessThanOrEqual(55);
  });

  it('L tier yields houses + barn + windmill + church (≥64, ≤92 total)', () => {
    const v = baseVillage({ sizeTier: 'L', padRadius: 160, falloffRadius: 210 });
    const out = layoutVillage(v);
    const types = out.map(b => b.type);
    expect(types).toContain('barn');
    expect(types).toContain('windmill');
    expect(types).toContain('church');
    expect(out.length).toBeGreaterThanOrEqual(64);
    expect(out.length).toBeLessThanOrEqual(92);
  });

  it('all buildings sit on ground at village.groundY', () => {
    const v = baseVillage({ groundY: 42 });
    const out = layoutVillage(v);
    for (const b of out) {
      if (b.type === 'road') continue;   // roads lift 0.05 m to avoid z-fighting
      expect(b.y).toBe(42);
    }
  });

  it('all building origins are within padRadius of anchor', () => {
    const v = baseVillage();
    const out = layoutVillage(v);
    for (const b of out) {
      const dx = b.x - v.x, dz = b.z - v.z;
      expect(Math.sqrt(dx * dx + dz * dz)).toBeLessThanOrEqual(v.padRadius);
    }
  });

  it('wallColor and roofColor are vec3 in [0, 1]', () => {
    const out = layoutVillage(baseVillage());
    for (const b of out) {
      for (const c of [...b.wallColor, ...b.roofColor]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});

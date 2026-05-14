import { describe, it, expect } from 'vitest';
import { crashed, clampToCeiling } from '../lib/game/collision.js';

const terrainAt = (h) => ({ getHeight: () => h });

describe('crashed', () => {
  it('true when plane.y - radius <= ground', () => {
    const physics = { x: 0, z: 0, y: 100 };
    expect(crashed(physics, terrainAt(98), 3)).toBe(true);
    expect(crashed(physics, terrainAt(97), 3)).toBe(true);
  });

  it('false when plane.y - radius > ground', () => {
    const physics = { x: 0, z: 0, y: 100 };
    expect(crashed(physics, terrainAt(96), 3)).toBe(false);
    expect(crashed(physics, terrainAt(50), 3)).toBe(false);
  });

  it('returns false when terrain is null', () => {
    expect(crashed({ x: 0, z: 0, y: 10 }, null, 3)).toBe(false);
  });

  it('queries terrain.getHeight at the plane x/z', () => {
    let seenX = null, seenZ = null;
    const terrain = { getHeight: (x, z) => { seenX = x; seenZ = z; return 0; } };
    crashed({ x: 42, z: -17, y: 100 }, terrain, 3);
    expect(seenX).toBe(42);
    expect(seenZ).toBe(-17);
  });
});

describe('clampToCeiling', () => {
  it('clamps y down to ceiling if above', () => {
    const p = { y: 2000, fallSpeed: 0 };
    expect(clampToCeiling(p, 1500)).toBe(true);
    expect(p.y).toBe(1500);
  });

  it('leaves y alone if below ceiling', () => {
    const p = { y: 800, fallSpeed: 0 };
    expect(clampToCeiling(p, 1500)).toBe(false);
    expect(p.y).toBe(800);
  });

  it('zeroes negative fallSpeed when clamped (so plane doesn\'t keep climbing)', () => {
    const p = { y: 2000, fallSpeed: -5 };
    clampToCeiling(p, 1500);
    expect(p.fallSpeed).toBe(0);
  });

  it('does not touch positive fallSpeed when clamped', () => {
    const p = { y: 2000, fallSpeed: 12 };
    clampToCeiling(p, 1500);
    expect(p.fallSpeed).toBe(12);
  });
});

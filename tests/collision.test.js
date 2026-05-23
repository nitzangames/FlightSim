import { describe, it, expect } from 'vitest';
import { crashed, clampToCeiling } from '../lib/game/collision.js';

const terrainAt = (h) => ({ getHeight: () => h });

// Shorthand for a plane physics object with explicit orientation. up.y in
// [-1, 1]: 1 = level upright, 0 = knife-edge, -1 = inverted.
function plane(y, upY = 1) {
  return { x: 0, z: 0, y, up: { y: upY } };
}

describe('crashed (upright)', () => {
  it('true when plane.y - vertRadius <= ground', () => {
    // y=100, vertRadius=1.2 → lowest world-y = 98.8. Crash when ground >= 98.8.
    expect(crashed(plane(100), terrainAt(98.8), 5, 1.2)).toBe(true);
    expect(crashed(plane(100), terrainAt(99.0), 5, 1.2)).toBe(true);
  });

  it('false when plane.y - vertRadius > ground', () => {
    expect(crashed(plane(100), terrainAt(98.5), 5, 1.2)).toBe(false);
    expect(crashed(plane(100), terrainAt(50),   5, 1.2)).toBe(false);
  });

  it('returns false when terrain is null', () => {
    expect(crashed(plane(10), null, 5, 1.2)).toBe(false);
  });

  it('queries terrain.getHeight at the plane x/z', () => {
    let seenX = null, seenZ = null;
    const terrain = { getHeight: (x, z) => { seenX = x; seenZ = z; return 0; } };
    crashed({ x: 42, z: -17, y: 100, up: { y: 1 } }, terrain, 5, 1.2);
    expect(seenX).toBe(42);
    expect(seenZ).toBe(-17);
  });
});

describe('crashed (orientation-aware)', () => {
  // The whole point of the new collision: an inverted plane should clear
  // the ground at the SAME altitude as upright — using vertRadius, not the
  // (much larger) horizontal wingspan.
  it('inverted plane uses vertRadius like upright', () => {
    // biplane-like: horiz 3.7, vert 1.2. At y=1.5 above ground, both
    // orientations have ~0.3m to spare → no crash either way.
    expect(crashed(plane(101.5, +1), terrainAt(100), 3.7, 1.2)).toBe(false);
    expect(crashed(plane(101.5, -1), terrainAt(100), 3.7, 1.2)).toBe(false);
    // At y=1m above ground, vertRadius=1.2 just clips → crash either way.
    expect(crashed(plane(101.0, +1), terrainAt(100), 3.7, 1.2)).toBe(true);
    expect(crashed(plane(101.0, -1), terrainAt(100), 3.7, 1.2)).toBe(true);
  });

  it('knife-edge (up.y=0) uses horizRadius — wing tip clears the ground', () => {
    // At y=2m above ground with horiz=3.7, the wing tip is below ground → crash.
    expect(crashed(plane(102, 0), terrainAt(100), 3.7, 1.2)).toBe(true);
    // At y=5m above ground, horizRadius=3.7 still clears → no crash.
    expect(crashed(plane(105, 0), terrainAt(100), 3.7, 1.2)).toBe(false);
  });

  it('45-degree bank lies between vertical and horizontal extents', () => {
    // up.y = cos(45°) ≈ 0.707. downExtent = 1.2*0.707 + 3.7*0.707 ≈ 3.46.
    // So crash threshold is y = ground + 3.46.
    expect(crashed(plane(103.5, Math.SQRT1_2), terrainAt(100), 3.7, 1.2)).toBe(false);
    expect(crashed(plane(103.4, Math.SQRT1_2), terrainAt(100), 3.7, 1.2)).toBe(true);
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

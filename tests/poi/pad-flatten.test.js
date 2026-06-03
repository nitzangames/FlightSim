import { describe, it, expect } from 'vitest';
import { flattenGroundHeight, padWarp, PAD_WARP_AMP } from '../../lib/terrain/pad-flatten.js';

// One village sitting at groundY=30 with a 100 m pad and 200 m falloff, on raw
// terrain that (without flattening) would be a 400 m mountain everywhere.
const village = { x: 0, z: 0, groundY: 30, padRadius: 100, falloffRadius: 300, paletteSeed: 0.42 };
const RAW = 400;

describe('flattenGroundHeight (shared render + collision flatten)', () => {
  it('pulls the pad interior fully down to groundY', () => {
    // At the centre the raw 400 m mountain is flattened to the village base.
    expect(flattenGroundHeight(RAW, 0, 0, [village])).toBeCloseTo(30, 5);
  });

  it('leaves terrain untouched well beyond the (warped) falloff', () => {
    // Past falloffRadius * (1+PAD_WARP_AMP) the village has no influence.
    const far = village.falloffRadius * (1 + PAD_WARP_AMP) + 10;
    expect(flattenGroundHeight(RAW, far, 0, [village])).toBe(RAW);
  });

  it('ramps monotonically from groundY out to raw across the falloff', () => {
    // Sampling outward along +x, the blended height never decreases — a smooth
    // basin wall, no cliff. (Uses +x where the warp is a fixed multiplier.)
    let prev = -Infinity;
    for (let d = 0; d <= 500; d += 10) {
      const h = flattenGroundHeight(RAW, d, 0, [village]);
      expect(h).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = h;
      expect(h).toBeGreaterThanOrEqual(30 - 1e-6);
      expect(h).toBeLessThanOrEqual(RAW + 1e-6);
    }
  });

  it('is the SAME function for any caller → render and collision agree', () => {
    // The whole point: identical inputs give identical output, so the mesh and
    // the collision surface can never diverge. Spot-check a mid-falloff point.
    const a = flattenGroundHeight(RAW, 150, 80, [village]);
    const b = flattenGroundHeight(RAW, 150, 80, [village]);
    expect(a).toBe(b);
  });

  it('warp multiplier stays within [1, 1+PAD_WARP_AMP] and is deterministic', () => {
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const w = padWarp(0.42, Math.cos(ang), Math.sin(ang));
      expect(w).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(w).toBeLessThanOrEqual(1 + PAD_WARP_AMP + 1e-9);
    }
    expect(padWarp(0.7, 0.3, -0.5)).toBe(padWarp(0.7, 0.3, -0.5));
  });
});

import { describe, it, expect } from 'vitest';
import {
  crashed, clampToCeiling, impactAngleDeg, grazeVerdict, GRAZE_MAX_ANGLE_DEG,
} from '../lib/game/collision.js';

const terrainAt = (h) => ({ getHeight: () => h });

// Flier with an explicit nose direction (forward) for the graze/angle tests.
// Default speed (100) is comfortably above the graze min-speed gate (0.6×145).
function flier(y, fwd, { x = 0, z = 0, upY = 1, speed = 100, maxSpeed = 145 } = {}) {
  return { x, z, y, up: { y: upY }, forward: fwd, speed, cfg: { maxSpeed } };
}
// Unit forward vector for a dive `deg` below horizontal (heading -Z).
const dive = (deg) => {
  const r = (deg * Math.PI) / 180;
  return { x: 0, y: -Math.sin(r), z: -Math.cos(r) };
};

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

describe('crashed (water)', () => {
  // Water sits at y=0. When terrain dips below that (lake/ocean bed),
  // the crash check should treat the water surface as the floor — flying
  // into a lake at y<1 should still crash even though the seabed is way
  // below the plane.
  it('crashes when within vertRadius of water surface, even with deep seabed', () => {
    expect(crashed(plane(0.5), terrainAt(-80), 5, 1.2)).toBe(true);
    expect(crashed(plane(1.0), terrainAt(-80), 5, 1.2)).toBe(true);   // exactly at threshold
  });

  it('does not crash when high enough above water', () => {
    expect(crashed(plane(2.0), terrainAt(-80), 5, 1.2)).toBe(false);
    expect(crashed(plane(50),  terrainAt(-80), 5, 1.2)).toBe(false);
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

describe('impactAngleDeg', () => {
  it('reads ~0° for level flight over flat ground', () => {
    expect(impactAngleDeg(flier(100, { x: 0, y: 0, z: -1 }), terrainAt(100))).toBeCloseTo(0, 1);
  });
  it('matches the dive angle over flat ground', () => {
    expect(impactAngleDeg(flier(100, dive(30)), terrainAt(100))).toBeCloseTo(30, 0);
    expect(impactAngleDeg(flier(100, dive(10)), terrainAt(100))).toBeCloseTo(10, 0);
  });
  it('reads a level plane flying into a hillside as steep (slope-aware)', () => {
    // Ground rises 2 m per metre in +x; flying +x straight into it.
    const hill = { getHeight: (x) => 100 + 2 * x };
    expect(impactAngleDeg(flier(100, { x: 1, y: 0, z: 0 }), hill)).toBeGreaterThan(50);
  });
});

describe('grazeVerdict', () => {
  const R = 5, VR = 1.2;
  it('null when there is no terrain contact', () => {
    expect(grazeVerdict(flier(100, dive(5)), terrainAt(50), R, VR)).toBeNull();
  });
  it('shallow contact over land → graze with proportional speed loss', () => {
    const g = grazeVerdict(flier(100.5, dive(5)), terrainAt(100), R, VR);
    expect(g).not.toBeNull();
    expect(g.angleDeg).toBeCloseTo(5, 0);
    expect(g.lossFrac).toBeCloseTo(0.05 + 0.45 * (5 / 20), 2);   // ≈ 0.1625
    expect(g.surfaceY).toBe(100);
  });
  it('near-parallel skim loses little; near-limit graze loses a lot', () => {
    const a = grazeVerdict(flier(100.5, dive(0.5)), terrainAt(100), R, VR);
    const b = grazeVerdict(flier(100.5, dive(19.5)), terrainAt(100), R, VR);
    expect(a.lossFrac).toBeLessThan(0.1);
    expect(b.lossFrac).toBeGreaterThan(0.45);
  });
  it('steep dive beyond the threshold → null (crashes)', () => {
    expect(grazeVerdict(flier(100.5, dive(35)), terrainAt(100), R, VR)).toBeNull();
  });
  it('too slow → null (crashes) even at a shallow upright angle', () => {
    // Below 0.6× cruise you pancake instead of skipping — no landing on slopes.
    expect(grazeVerdict(flier(100.5, dive(5), { speed: 50 }), terrainAt(100), R, VR)).toBeNull();
    // Fast enough → grazes.
    expect(grazeVerdict(flier(100.5, dive(5), { speed: 130 }), terrainAt(100), R, VR)).not.toBeNull();
  });
  it('inverted → null (crashes) even at a shallow angle', () => {
    // Same shallow approach that grazes upright, but rolled inverted (up.y = -1).
    expect(grazeVerdict(flier(100.5, dive(5), { upY: -1 }), terrainAt(100), R, VR)).toBeNull();
    // Knife-edge (up.y = 0) also can't skip off the ground.
    expect(grazeVerdict(flier(100.5, dive(5), { upY: 0 }), terrainAt(100), R, VR)).toBeNull();
    // Sanity: the upright version of the same impact still grazes.
    expect(grazeVerdict(flier(100.5, dive(5), { upY: 1 }), terrainAt(100), R, VR)).not.toBeNull();
  });
  it('water contact → null (crashes) even at a shallow angle', () => {
    // seabed at -80, water surface at 0; plane skimming just above the water.
    expect(grazeVerdict(flier(0.5, dive(5)), terrainAt(-80), R, VR)).toBeNull();
  });
  it('exposes the threshold as 20°', () => {
    expect(GRAZE_MAX_ANGLE_DEG).toBe(20);
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

import { describe, it, expect } from 'vitest';
import { PLANES, PLANE_ORDER } from '../lib/game/planes.js';

const STAT_KEYS = ['maxSpeed', 'maxPitchRate', 'maxYawRate', 'fuelDrainRate', 'maxFuel', 'collisionRadius'];

describe('PLANES roster', () => {
  it('contains exactly the expected keys', () => {
    expect(Object.keys(PLANES).sort()).toEqual([
      'a10', 'biplane', 'f15', 'f16', 'f18', 'f22', 'f4', 'f86', 'p51', 'sr71', 'triplane', 'ww2',
    ]);
  });

  it('each plane has name, build (function), and stats', () => {
    for (const key of Object.keys(PLANES)) {
      const p = PLANES[key];
      expect(p.key).toBe(key);
      expect(typeof p.name).toBe('string');
      expect(typeof p.build).toBe('function');
      expect(p.stats).toBeDefined();
      for (const sk of STAT_KEYS) {
        expect(typeof p.stats[sk]).toBe('number');
      }
    }
  });

  it('every plane has fuelDrainRate === 0 (sandbox invariant)', () => {
    for (const key of Object.keys(PLANES)) {
      expect(PLANES[key].stats.fuelDrainRate).toBe(0);
    }
  });

  it('PLANE_ORDER lists every plane in historical tier order', () => {
    expect(PLANE_ORDER).toEqual([
      'biplane', 'triplane', 'ww2', 'p51', 'f86', 'f4', 'a10', 'f16', 'f18', 'f15', 'f22', 'sr71',
    ]);
    expect(PLANE_ORDER.length).toBe(Object.keys(PLANES).length);
  });

  // Speed is roughly tiered (props < jets) but no longer strictly ascends
  // through PLANE_ORDER — the Fokker triplane is intentionally slower than
  // the Sopwith biplane to capture its real-world Dr.I character (slow but
  // extremely agile), and the F-22 trades top speed for thrust-vectoring
  // agility versus the F-15. The invariant we still want is that every
  // prop plane is slower than every jet.
  it('all props are slower than every jet', () => {
    const props = ['biplane', 'triplane', 'ww2', 'p51'];
    const jets  = ['f86', 'f4', 'a10', 'f16', 'f18', 'f15', 'f22', 'sr71'];
    const slowestJet = Math.min(...jets.map(k => PLANES[k].stats.maxSpeed));
    const fastestProp = Math.max(...props.map(k => PLANES[k].stats.maxSpeed));
    expect(fastestProp).toBeLessThan(slowestJet);
  });
});

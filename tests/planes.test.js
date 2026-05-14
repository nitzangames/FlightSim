import { describe, it, expect } from 'vitest';
import { PLANES, PLANE_ORDER } from '../lib/game/planes.js';

const STAT_KEYS = ['maxSpeed', 'maxPitchRate', 'maxYawRate', 'fuelDrainRate', 'maxFuel', 'collisionRadius'];

describe('PLANES roster', () => {
  it('contains exactly the six expected keys', () => {
    expect(Object.keys(PLANES).sort()).toEqual(['biplane', 'f15', 'f22', 'f86', 'triplane', 'ww2']);
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

  it('PLANE_ORDER lists all 6 in tier order biplane → f22', () => {
    expect(PLANE_ORDER).toEqual(['biplane', 'triplane', 'ww2', 'f86', 'f15', 'f22']);
    expect(PLANE_ORDER.length).toBe(Object.keys(PLANES).length);
  });

  it('speed ascends through PLANE_ORDER', () => {
    let prev = -Infinity;
    for (const key of PLANE_ORDER) {
      const s = PLANES[key].stats.maxSpeed;
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });
});

import { describe, it, expect } from 'vitest';
import { hash3 } from '../../lib/poi/hash.js';

describe('hash3', () => {
  it('returns a value in [0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const v = hash3(i, i * 2, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic across calls', () => {
    expect(hash3(7, 13, 42)).toBe(hash3(7, 13, 42));
  });

  it('differs for different inputs', () => {
    const a = hash3(0, 0, 42);
    const b = hash3(1, 0, 42);
    const c = hash3(0, 1, 42);
    const d = hash3(0, 0, 43);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });

  it('distributes roughly uniformly across [0, 1)', () => {
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const v = hash3(i, 0, 1);
      buckets[Math.min(3, Math.floor(v * 4))]++;
    }
    for (const b of buckets) expect(b).toBeGreaterThan(800); // each bucket > 20% of expected 1000
  });
});

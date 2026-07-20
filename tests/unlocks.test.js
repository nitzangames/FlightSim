import { beforeEach, describe, it, expect } from 'vitest';

// Vitest's default environment is node, so there's no DOM. Shim a minimal
// localStorage on globalThis BEFORE importing UnlockState (which reads it
// at construction time).
function makeStorage() {
  const data = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    clear() { for (const k of Object.keys(data)) delete data[k]; },
  };
}

let UnlockState;
beforeEach(async () => {
  globalThis.localStorage = makeStorage();
  // Fresh import each test so the module-internal LS_KEY constant reads
  // the fresh storage (load() is called inside the constructor anyway,
  // so a single import is fine — re-import only matters for top-level
  // state, which UnlockState doesn't have).
  ({ UnlockState } = await import('../lib/game/unlocks.js'));
});

describe('UnlockState', () => {
  it('biplane is unlocked from a clean slate', () => {
    const u = new UnlockState();
    expect(u.isUnlocked('biplane')).toBe(true);
  });

  it('priced planes are locked from a clean slate', () => {
    const u = new UnlockState();
    expect(u.isUnlocked('triplane')).toBe(false);
    expect(u.isUnlocked('f15')).toBe(false);
    expect(u.isUnlocked('sr71')).toBe(false);
  });

  it('markUnlocked flips the flag and persists', () => {
    const u = new UnlockState();
    expect(u.markUnlocked('triplane')).toBe(true);
    expect(u.isUnlocked('triplane')).toBe(true);
    // Persisted: a fresh instance should still see it unlocked.
    const u2 = new UnlockState();
    expect(u2.isUnlocked('triplane')).toBe(true);
  });

  it('markUnlocked is idempotent', () => {
    const u = new UnlockState();
    expect(u.markUnlocked('f22')).toBe(true);
    expect(u.markUnlocked('f22')).toBe(false);
    expect(u.isUnlocked('f22')).toBe(true);
  });

  it('durably fulfills a purchased unlock exactly once', async () => {
    const u = new UnlockState();
    await expect(u.fulfillPurchasedUnlock('f22')).resolves.toBe(true);
    await expect(u.fulfillPurchasedUnlock('f22')).resolves.toBe(false);
    expect(new UnlockState().isUnlocked('f22')).toBe(true);
  });

  it('unknown plane keys are reported as locked, not crashed', () => {
    const u = new UnlockState();
    expect(u.isUnlocked('nope')).toBe(false);
  });
});

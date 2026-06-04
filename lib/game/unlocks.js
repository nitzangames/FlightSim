// Plane unlock state. Persisted via the storage helper (PlaySDK cloud + local
// storage fallback) as a JSON array of plane keys. The biplane (and any plane
// whose unlock.kind === 'free') is always unlocked regardless of what's in
// storage — so a fresh player can fly immediately, and a corrupted save still
// leaves them with a working plane.

import { PLANES } from './planes.js';
import { loadKey, saveKey } from './storage.js';

export const UNLOCKED_KEY = 'flightsim.unlocked';

function parseSet(raw) {
  try {
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

// Async preload — await this at boot then pass the set into UnlockState.
export async function loadUnlocked() {
  return parseSet(await loadKey(UNLOCKED_KEY));
}

function save(set) {
  saveKey(UNLOCKED_KEY, JSON.stringify([...set]));
}

export class UnlockState {
  // initialSet is the Set returned by loadUnlocked(). When omitted (tests,
  // local dev without PlaySDK), fall back to a sync localStorage read so
  // existing callers and unit tests don't have to thread async through.
  // allUnlocked: unlock every plane regardless of save state — used for local
  // dev (the shell passes IS_LOCAL) so all planes are free to test on localhost.
  constructor(initialSet, allUnlocked = false) {
    this._allUnlocked = !!allUnlocked;
    if (initialSet instanceof Set) {
      this._set = initialSet;
    } else {
      let raw = null;
      try { raw = typeof localStorage !== 'undefined' ? localStorage.getItem(UNLOCKED_KEY) : null; } catch {}
      this._set = parseSet(raw);
    }
  }

  isUnlocked(key) {
    const p = PLANES[key];
    if (!p) return false;
    if (this._allUnlocked) return true;
    if (p.unlock && p.unlock.kind === 'free') return true;
    return this._set.has(key);
  }

  // Mark a plane unlocked and persist. Caller is responsible for having
  // already charged the cost (stars deducted, NBucks spent) — this method
  // only flips the bit. Returns true the first time, false on no-op.
  markUnlocked(key) {
    if (this._set.has(key)) return false;
    this._set.add(key);
    save(this._set);
    return true;
  }
}

// Plane unlock state. Persisted to localStorage as a set of plane keys.
// The biplane (and any plane whose unlock.kind === 'free') is always
// unlocked regardless of what's in storage — so a fresh player can fly
// immediately, and a corrupted save still leaves them with a working plane.

import { PLANES } from './planes.js';

const LS_KEY = 'flightsim.unlocked';

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function save(set) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch {}
}

export class UnlockState {
  constructor() {
    this._set = load();
  }

  isUnlocked(key) {
    const p = PLANES[key];
    if (!p) return false;
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

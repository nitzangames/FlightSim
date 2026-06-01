// Player-tweakable settings. Two flags so far:
//   invertY    — flip drag-Y (down = nose up by default; on = drag down = nose down)
//   hapticsOn  — gate every PlaySDK.haptic call in the game loop
// Persisted as JSON via the storage helper so the choice survives reloads
// AND iOS Safari's iframe localStorage eviction (cloud save for signed-in
// users). Defaults are chosen so a fresh player gets the most-common feel:
// non-inverted, haptics on.

import { loadKey, saveKey } from './storage.js';

export const SETTINGS_KEY = 'flightsim.settings';

const DEFAULTS = Object.freeze({
  invertY: false,
  hapticsOn: true,
});

// Module-singleton current state. Other modules read live via the named
// exports below; the panel mutates via setSettings() to keep persistence in
// one place.
let _state = { ...DEFAULTS };

export async function loadSettings() {
  const raw = await loadKey(SETTINGS_KEY);
  if (!raw) { _state = { ...DEFAULTS }; return; }
  try {
    const parsed = JSON.parse(raw);
    _state = {
      invertY:   typeof parsed.invertY   === 'boolean' ? parsed.invertY   : DEFAULTS.invertY,
      hapticsOn: typeof parsed.hapticsOn === 'boolean' ? parsed.hapticsOn : DEFAULTS.hapticsOn,
    };
  } catch { _state = { ...DEFAULTS }; }
}

// Read-current. Cheap and synchronous — every read is one property access on
// the module-local object, so callers can sample inside the per-frame loop.
export function getSettings() { return _state; }

// Merge-and-save. Caller passes a partial object; missing keys keep their
// current value. Save is fire-and-forget (PlaySDK queues against onReady).
export function setSettings(patch) {
  _state = { ..._state, ...patch };
  saveKey(SETTINGS_KEY, JSON.stringify(_state));
}

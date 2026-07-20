// Persistent storage helpers. On nitzan.games the game runs in a cross-origin
// sandboxed iframe, and iOS Safari aggressively evicts third-party iframe
// localStorage between browser launches — players lose their saves. PlaySDK
// mirrors signed-in users' progress to the platform's cloud saves API, which
// survives that eviction. Anonymous users still rely on localStorage and remain
// vulnerable to ITP, but for signed-in users this is the durable path.
//
// PlaySDK.save and PlaySDK.load already queue internally against onReady
// (or the 2s iframe-timeout fallback), so calls issued before cloud-sync
// completes are deferred and resolve with real data — DON'T wrap them in
// another readiness gate here, and DON'T add a wrapper-level localStorage
// fallback that fires before PlaySDK resolves: either pattern silently
// drops saves on iOS cold launches and is exactly what the bug we hit
// shipped as. See GamesPlatform/docs/game-dev-notes.md § Persistence.
//
// The only branch below is "PlaySDK is entirely absent" — tests + offline
// local dev — in which case we fall through to raw localStorage so existing
// callers keep working.

export async function loadKey(key) {
  if (typeof window !== 'undefined' && window.PlaySDK && typeof window.PlaySDK.load === 'function') {
    try { return await window.PlaySDK.load(key); } catch { return null; }
  }
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch {}
  return null;
}

export async function saveKeyDurable(key, value) {
  const s = String(value);
  if (typeof window !== 'undefined' && window.PlaySDK && typeof window.PlaySDK.save === 'function') {
    await window.PlaySDK.save(key, s);
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, s);
    return;
  }
  throw new Error('persistent storage unavailable');
}

export function saveKey(key, value) {
  // Most score/settings writes are intentionally best-effort and fire-and-forget.
  // Purchase fulfillment uses saveKeyDurable directly so a failed persistence
  // write rejects the fulfillment and releases the wallet reservation.
  return saveKeyDurable(key, value).catch(() => {});
}

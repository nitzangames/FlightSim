// Translucent "CRASHED" flash. Schedules onComplete after durationMs and
// auto-disposes if the caller forgets. Below it the worldScene is rendered
// frozen at the crash frame.

export function buildCrashOverlay({ root, durationMs = 1500, onComplete }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;color:#ff5147;font-family:system-ui,-apple-system,sans-serif;font-size:11cqi;font-weight:900;letter-spacing:0.1em;text-shadow:0 2px 14px rgba(0,0,0,0.7);background:rgba(0,0,0,0.0);';
  wrap.textContent = 'CRASHED';
  // Subtle fade so it doesn't snap in
  wrap.style.opacity = '0';
  wrap.style.transition = 'opacity 0.18s ease';
  root.appendChild(wrap);
  requestAnimationFrame(() => { wrap.style.opacity = '1'; });

  let fired = false;
  const timer = setTimeout(() => {
    if (fired) return;
    fired = true;
    onComplete && onComplete();
  }, durationMs);

  function dispose() {
    if (timer) clearTimeout(timer);
    wrap.remove();
  }
  return { dispose };
}

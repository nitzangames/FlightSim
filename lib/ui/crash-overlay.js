// Translucent "CRASHED" flash. Schedules onComplete after durationMs and
// auto-disposes if the caller forgets. Below it the worldScene is rendered
// frozen at the crash frame.

export function buildCrashOverlay({ root, durationMs = 1500, onComplete, subtext = null }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ff5147;font-family:system-ui,-apple-system,sans-serif;text-shadow:0 2px 14px rgba(0,0,0,0.7);';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:11cqmin;font-weight:900;letter-spacing:0.1em;';
  title.textContent = 'CRASHED';
  wrap.appendChild(title);
  // Optional debug line under the crash text (e.g. impact angle on localhost).
  if (subtext) {
    const sub = document.createElement('div');
    sub.style.cssText = 'margin-top:2cqmin;font-size:3.4cqmin;font-weight:700;letter-spacing:0.04em;opacity:0.85;font-family:ui-monospace,Menlo,monospace;';
    sub.textContent = subtext;
    wrap.appendChild(sub);
  }
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

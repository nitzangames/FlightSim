// In-flight settings sheet. Anchored centred over the canvas; backdrop
// captures taps to close. Two toggle rows + a "BACK TO MENU" button — the
// menu nav lives here now because the old bottom-left back arrow was
// replaced by the gear that opens this sheet.
//
// Built once at boot and reused across flights — show()/hide() flip the
// outer wrapper's display, toggles read from settings live so a state
// change is reflected immediately if the sheet is reopened.

import { getSettings, setSettings } from '../game/settings.js';

export function buildSettingsPanel({ root, onBack }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;background:rgba(0,0,0,0.55);z-index:60;';
  wrap.innerHTML = `
    <div data-card style="background:#0e131b;border:1px solid rgba(255,255,255,0.15);border-radius:3cqi;padding:5cqi 6cqi;min-width:62cqi;max-width:80cqi;color:#fff;font-family:ui-monospace,Menlo,monospace;box-shadow:0 4px 24px rgba(0,0,0,0.55);">
      <div style="font-size:5cqi;font-weight:800;letter-spacing:0.08em;margin-bottom:4cqi;text-align:center;">SETTINGS</div>
      <label data-row-invert style="display:flex;align-items:center;justify-content:space-between;gap:3cqi;padding:2.5cqi 0;border-top:1px solid rgba(255,255,255,0.08);cursor:pointer;">
        <span style="font-size:3.6cqi;">Invert Y axis</span>
        <input data-invert type="checkbox" style="width:6cqi;height:6cqi;cursor:pointer;">
      </label>
      <label data-row-haptics style="display:flex;align-items:center;justify-content:space-between;gap:3cqi;padding:2.5cqi 0;border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);cursor:pointer;">
        <span style="font-size:3.6cqi;">Haptics</span>
        <input data-haptics type="checkbox" style="width:6cqi;height:6cqi;cursor:pointer;">
      </label>
      <button data-menu style="display:block;width:100%;margin-top:4cqi;padding:3cqi;border:none;border-radius:1.5cqi;background:#1abc9c;color:#fff;font-size:3.6cqi;font-weight:800;letter-spacing:0.1em;cursor:pointer;">BACK TO MENU</button>
      <button data-close style="display:block;width:100%;margin-top:2cqi;padding:2.5cqi;border:1px solid rgba(255,255,255,0.2);border-radius:1.5cqi;background:transparent;color:#cfd8e0;font-size:3cqi;font-weight:700;letter-spacing:0.1em;cursor:pointer;">RESUME</button>
    </div>
  `;
  root.appendChild(wrap);

  const card    = wrap.querySelector('[data-card]');
  const cbInv   = wrap.querySelector('[data-invert]');
  const cbHap   = wrap.querySelector('[data-haptics]');
  const btMenu  = wrap.querySelector('[data-menu]');
  const btClose = wrap.querySelector('[data-close]');

  // Backdrop tap closes; taps INSIDE the card don't (stopPropagation).
  wrap.addEventListener('click', () => hide());
  card.addEventListener('click', (e) => e.stopPropagation());

  cbInv.addEventListener('change', () => setSettings({ invertY:   cbInv.checked }));
  cbHap.addEventListener('change', () => setSettings({ hapticsOn: cbHap.checked }));
  btClose.addEventListener('click', () => hide());
  btMenu .addEventListener('click', () => { hide(); onBack && onBack(); });

  function show() {
    const s = getSettings();
    cbInv.checked = !!s.invertY;
    cbHap.checked = !!s.hapticsOn;
    wrap.style.display = 'flex';
  }
  function hide() { wrap.style.display = 'none'; }
  function dispose() { wrap.remove(); }

  return { show, hide, dispose };
}

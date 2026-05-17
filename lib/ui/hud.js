// Minimal in-flight HUD:
//   • Back arrow (top-left) — pointer-events:auto, returns to MENU.
//   • SPEED / ALT readouts (bottom-left).
//   • Countdown digit (centered) while flyingCountdown > 0.
//   • Version stamp (bottom-center).
// Wrapper has pointer-events:none so drag-to-steer reaches the canvas; only
// the back button intercepts pointer events.

export function buildHUD({ root, version, onBack }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;color:#fff;font-family:ui-monospace,Menlo,monospace;';
  wrap.innerHTML = `
    <button data-back style="position:absolute;top:3%;left:4%;pointer-events:auto;background:rgba(0,0,0,0.35);color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:50%;width:9cqi;height:9cqi;font-size:5cqi;cursor:pointer;">◄</button>
    <div data-village-marker style="position:absolute;top:3.5%;left:0;right:0;text-align:center;display:none;">
      <div data-village-arrow style="display:inline-block;font-size:7cqi;line-height:1;color:#ffe;text-shadow:0 1px 4px rgba(0,0,0,0.8);transform-origin:50% 50%;">▲</div>
      <div data-village-dist style="font-size:2.8cqi;font-weight:600;letter-spacing:0.5px;color:#ffe;text-shadow:0 1px 4px rgba(0,0,0,0.8);margin-top:0.4cqi;"></div>
      <div style="font-size:2.0cqi;opacity:0.7;letter-spacing:1px;">VILLAGE</div>
    </div>
    <div data-readouts style="position:absolute;bottom:8%;left:5%;font-size:3.6cqi;line-height:1.4;text-shadow:0 1px 4px rgba(0,0,0,0.7);">
      <div>SPEED&nbsp;&nbsp;<span data-speed>0</span> m/s</div>
      <div>ALT&nbsp;&nbsp;&nbsp;&nbsp;<span data-alt>0</span> m</div>
    </div>
    <div data-countdown style="position:absolute;top:38%;left:0;right:0;text-align:center;font-size:24cqi;font-weight:900;letter-spacing:0.05em;text-shadow:0 2px 12px rgba(0,0,0,0.8);display:none;"></div>
    <div style="position:absolute;bottom:2%;left:0;right:0;text-align:center;font-size:2.1cqi;opacity:0.5;">${version}</div>
  `;
  root.appendChild(wrap);

  const elSpeed = wrap.querySelector('[data-speed]');
  const elAlt = wrap.querySelector('[data-alt]');
  const elCountdown = wrap.querySelector('[data-countdown]');
  const elBack = wrap.querySelector('[data-back]');
  const elVillageMarker = wrap.querySelector('[data-village-marker]');
  const elVillageArrow = wrap.querySelector('[data-village-arrow]');
  const elVillageDist = wrap.querySelector('[data-village-dist]');

  elBack.addEventListener('click', () => onBack && onBack());

  function update({ speed, altitude, countdown, villageBearing, villageDistance }) {
    elSpeed.textContent = Math.round(speed);
    elAlt.textContent = Math.round(altitude);
    if (countdown && countdown > 0) {
      const n = Math.ceil(countdown);
      elCountdown.style.display = '';
      elCountdown.textContent = n === 0 ? 'GO!' : String(n);
    } else if (countdown !== undefined && countdown <= 0 && countdown > -0.4) {
      // Brief "GO!" frame when countdown just hit zero
      elCountdown.style.display = '';
      elCountdown.textContent = 'GO!';
    } else {
      elCountdown.style.display = 'none';
    }
    // Village marker — rotating arrow + distance to the nearest village.
    // villageBearing is in radians where 0 means directly ahead.
    if (villageDistance != null && Number.isFinite(villageDistance)) {
      elVillageMarker.style.display = '';
      elVillageArrow.style.transform = `rotate(${villageBearing}rad)`;
      elVillageDist.textContent = villageDistance >= 1000
        ? `${(villageDistance / 1000).toFixed(1)} km`
        : `${Math.round(villageDistance)} m`;
    } else {
      elVillageMarker.style.display = 'none';
    }
  }

  function dispose() { wrap.remove(); }

  return { update, dispose };
}

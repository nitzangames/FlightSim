import { biomeAt } from '../game/biomes.js';

// Minimal in-flight HUD:
//   • Settings gear (top-left) — opens the settings sheet (which is where
//     back-to-menu now lives, along with invert-Y / haptics toggles).
//   • SPEED / ALT / FOUND readouts (bottom-left).
//   • Compass-needle arrow + distance + POI type (top-center).
//   • Countdown digit (centered) while flyingCountdown > 0.
//   • Version stamp (bottom-center).
// Wrapper has pointer-events:none so drag-to-steer reaches the canvas; only
// the gear button intercepts pointer events.
//
// The pointing arrow is an SVG compass-needle dart (sharp head, indented
// rear) rather than an equilateral triangle so the heading is unambiguous
// even at small sizes.

export function buildHUD({ root, version, onSettings }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;color:#fff;font-family:ui-monospace,Menlo,monospace;';
  wrap.innerHTML = `
    <button data-settings aria-label="Settings" style="position:absolute;top:3.5%;left:4%;pointer-events:auto;background:rgba(0,0,0,0.35);color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:50%;width:9cqi;height:9cqi;font-size:5cqi;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;">⚙</button>
    <div data-village-marker style="position:absolute;top:3.5%;left:0;right:0;text-align:center;display:none;">
      <svg data-village-arrow viewBox="0 0 24 32" style="display:inline-block;width:7cqi;height:9.3cqi;color:#ffe;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.85));transform-origin:50% 50%;">
        <polygon points="12,1 22,29 12,22 2,29" fill="currentColor"/>
      </svg>
      <div data-village-dist style="font-size:2.8cqi;font-weight:600;letter-spacing:0.5px;color:#ffe;text-shadow:0 1px 4px rgba(0,0,0,0.8);margin-top:0.4cqi;"></div>
      <div data-village-label style="font-size:2.0cqi;opacity:0.7;letter-spacing:1px;">VILLAGE</div>
    </div>
    <div data-readouts style="position:absolute;bottom:8%;left:18%;font-size:3.6cqi;line-height:1.4;text-shadow:0 1px 4px rgba(0,0,0,0.7);">
      <div>SPEED&nbsp;&nbsp;<span data-speed>0</span> m/s</div>
      <div>ALT&nbsp;&nbsp;&nbsp;&nbsp;<span data-alt>0</span> m</div>
      <div>FOUND&nbsp;<span data-visited>0</span>&nbsp;/&nbsp;<span data-visited-total>0</span></div>
      <div>BIOME&nbsp;<span data-biome>—</span></div>
    </div>
    <div data-stars style="position:absolute;top:3.5%;right:4%;text-align:right;font-size:6cqi;font-weight:800;letter-spacing:0.05em;color:#ffd766;text-shadow:0 2px 8px rgba(0,0,0,0.85);">0 ★</div>
    <div data-bonuses style="position:absolute;top:13%;right:4%;text-align:right;font-size:2.6cqi;font-weight:700;letter-spacing:0.06em;color:#ffd766;text-shadow:0 1px 4px rgba(0,0,0,0.8);line-height:1.5;"></div>
    <canvas data-minimap width="160" height="160" style="position:absolute;bottom:8%;right:4%;width:22cqi;height:22cqi;background:rgba(8,12,18,0.55);border:1px solid rgba(255,255,255,0.25);border-radius:6px;"></canvas>
    <div data-trick-flash style="position:absolute;top:16%;left:0;right:0;text-align:center;font-size:8cqi;font-weight:900;letter-spacing:0.1em;color:#ffd766;text-shadow:0 2px 10px rgba(0,0,0,0.85);display:none;"></div>
    <div data-marker-flash style="position:absolute;top:24%;left:0;right:0;text-align:center;font-size:6.5cqi;font-weight:900;letter-spacing:0.15em;color:#80ffa0;text-shadow:0 2px 10px rgba(0,0,0,0.8);display:none;">FOUND</div>
    <div data-countdown style="position:absolute;top:38%;left:0;right:0;text-align:center;font-size:24cqi;font-weight:900;letter-spacing:0.05em;text-shadow:0 2px 12px rgba(0,0,0,0.8);display:none;"></div>
    <div data-stall style="position:absolute;top:18%;left:0;right:0;text-align:center;font-size:7cqi;font-weight:900;letter-spacing:0.2em;color:#ff5c2c;text-shadow:0 2px 8px rgba(0,0,0,0.85);display:none;">STALL</div>
    <div data-pilots style="position:absolute;bottom:5%;left:0;right:0;text-align:center;font-size:2.4cqi;letter-spacing:0.1em;color:#7aa7d6;text-shadow:0 1px 4px rgba(0,0,0,0.7);display:none;"></div>
    <div style="position:absolute;bottom:2%;left:0;right:0;text-align:center;font-size:2.1cqi;opacity:0.5;">${version}</div>
  `;
  root.appendChild(wrap);

  const elSpeed = wrap.querySelector('[data-speed]');
  const elAlt = wrap.querySelector('[data-alt]');
  const elCountdown = wrap.querySelector('[data-countdown]');
  const elSettings = wrap.querySelector('[data-settings]');
  const elVillageMarker = wrap.querySelector('[data-village-marker]');
  const elVillageArrow = wrap.querySelector('[data-village-arrow]');
  const elVillageDist = wrap.querySelector('[data-village-dist]');
  const elVillageLabel = wrap.querySelector('[data-village-label]');
  const elStall = wrap.querySelector('[data-stall]');
  const elVisited = wrap.querySelector('[data-visited]');
  const elVisitedTotal = wrap.querySelector('[data-visited-total]');
  const elMarkerFlash = wrap.querySelector('[data-marker-flash]');
  const elStars       = wrap.querySelector('[data-stars]');
  const elBonuses     = wrap.querySelector('[data-bonuses]');
  const elTrickFlash  = wrap.querySelector('[data-trick-flash]');
  const elBiome       = wrap.querySelector('[data-biome]');
  const elMinimap     = wrap.querySelector('[data-minimap]');
  const elPilots      = wrap.querySelector('[data-pilots]');
  const minimapCtx    = elMinimap.getContext('2d');
  const MINIMAP_PX    = 160;          // visible canvas internal size
  const MINIMAP_RANGE = 10000;        // world metres visible edge to edge (north-up, north = -Z)
  // Biome background — rasterised at lower resolution (cheap) and blitted
  // upscaled (chunky pixels read fine for a map). At 64×64 the redraw is
  // ~4k biomeAt() lookups per frame, well under a millisecond.
  const BIOME_BG_PX   = 64;
  const biomeBgCanvas = document.createElement('canvas');
  biomeBgCanvas.width = BIOME_BG_PX; biomeBgCanvas.height = BIOME_BG_PX;
  const biomeBgCtx    = biomeBgCanvas.getContext('2d');
  const biomeBgImg    = biomeBgCtx.createImageData(BIOME_BG_PX, BIOME_BG_PX);
  // Per-biome representative colour for the minimap background. Hand-picked
  // to be recognisable at a glance and to roughly match the dominant
  // mid-altitude band colour from lib/game/biomes.js.
  const BIOME_BG_COLOR = {
    forest:   [0x4f, 0x76, 0x32],
    desert:   [0xc4, 0xa0, 0x60],
    arctic:   [0xe2, 0xea, 0xf2],
    volcanic: [0x3c, 0x1f, 0x14],
    autumn:   [0xb0, 0x56, 0x22],
  };
  let stallBlinkT = 0;

  elSettings.addEventListener('click', () => onSettings && onSettings());

  // templateKey from villages.js ('forest' | 'desert' | 'arctic' → village,
  // plus 'castle', 'monastery', 'town' for the specials). Anything missing or
  // unknown falls back to "VILLAGE".
  const POI_LABEL = {
    forest:    'VILLAGE',
    desert:    'VILLAGE',
    arctic:    'VILLAGE',
    castle:    'CASTLE',
    monastery: 'MONASTERY',
    town:      'TOWN',
  };

  // Format an integer with comma thousands separators ("1,234").
  function fmtCount(n) {
    const v = Math.floor(n);
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Rasterise the biome background onto the offscreen canvas. ~4k biomeAt()
  // lookups per frame at 64×64 — well under a millisecond, so we redraw every
  // frame centred on the plane rather than caching with a scroll offset.
  function rasteriseBiomeBackground(planeX, planeZ) {
    const data = biomeBgImg.data;
    const half = BIOME_BG_PX / 2;
    const mPerPx = MINIMAP_RANGE / BIOME_BG_PX;
    for (let py = 0; py < BIOME_BG_PX; py++) {
      const wz = planeZ + (py - half) * mPerPx;
      for (let px = 0; px < BIOME_BG_PX; px++) {
        const wx = planeX + (px - half) * mPerPx;
        const biome = biomeAt(wx, wz);
        const c = BIOME_BG_COLOR[biome.name] || [60, 60, 70];
        const i = (py * BIOME_BG_PX + px) * 4;
        data[i + 0] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 220;
      }
    }
    biomeBgCtx.putImageData(biomeBgImg, 0, 0);
  }

  // Redraw the minimap. north-up (map +Y = world -Z = north). Player at
  // centre as a small triangle rotated to its heading; visited POIs as
  // dots colour-coded by type. Undiscovered POIs are deliberately not
  // shown — the map is an "explored" diary, not a guide.
  function drawMinimap(planeX, planeZ, heading, visitedPois) {
    const half = MINIMAP_PX / 2;
    const scale = MINIMAP_PX / MINIMAP_RANGE;   // world-m → canvas-px
    minimapCtx.clearRect(0, 0, MINIMAP_PX, MINIMAP_PX);

    // Biome background — chunky upscaled blit from offscreen raster.
    rasteriseBiomeBackground(planeX, planeZ);
    minimapCtx.imageSmoothingEnabled = false;
    minimapCtx.drawImage(biomeBgCanvas, 0, 0, MINIMAP_PX, MINIMAP_PX);
    // Compass tick at the top so "up = north" is unambiguous.
    minimapCtx.fillStyle = 'rgba(255,255,255,0.45)';
    minimapCtx.font = '10px ui-monospace,monospace';
    minimapCtx.textAlign = 'center';
    minimapCtx.fillText('N', half, 11);
    // POI dots.
    if (visitedPois) {
      for (const p of visitedPois) {
        const dx = p.x - planeX;
        const dz = p.z - planeZ;
        const px = half + dx * scale;
        const py = half + dz * scale;     // world +Z is south = canvas +Y
        if (px < 1 || px > MINIMAP_PX - 1 || py < 1 || py > MINIMAP_PX - 1) continue;
        // Colour per POI type so castles read different from villages.
        let colour = '#ffd766';
        if      (p.type === 'castle')    colour = '#c9a3ff';
        else if (p.type === 'monastery') colour = '#a3d8ff';
        else if (p.type === 'town')      colour = '#ffaa66';
        minimapCtx.fillStyle = colour;
        minimapCtx.beginPath();
        minimapCtx.arc(px, py, 3, 0, Math.PI * 2);
        minimapCtx.fill();
      }
    }
    // Plane indicator — triangle pointing along heading.
    minimapCtx.save();
    minimapCtx.translate(half, half);
    minimapCtx.rotate(heading);
    minimapCtx.fillStyle = '#80ffa0';
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, -7);
    minimapCtx.lineTo(5, 5);
    minimapCtx.lineTo(-5, 5);
    minimapCtx.closePath();
    minimapCtx.fill();
    minimapCtx.restore();
  }

  function update({ speed, altitude, countdown, villageBearing, villageDistance, villageType, villageVisited, stalling, visitedCount, visitedTotal, flashT, stars, bonuses, trickFlash, biome, planeX, planeZ, heading, visitedPois, pilots }) {
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
      const baseLabel = POI_LABEL[villageType] || 'VILLAGE';
      elVillageLabel.textContent = villageVisited ? `${baseLabel} (FOUND)` : baseLabel;
    } else {
      elVillageMarker.style.display = 'none';
    }
    // STALL warning — blinks at ~3 Hz while the physics flag is set.
    if (stalling) {
      stallBlinkT = (stallBlinkT + 1) % 20;
      elStall.style.display = stallBlinkT < 10 ? '' : 'none';
    } else {
      elStall.style.display = 'none';
      stallBlinkT = 0;
    }
    // Visited counter + flash banner
    if (visitedCount != null) elVisited.textContent = visitedCount;
    if (visitedTotal != null) elVisitedTotal.textContent = visitedTotal;
    elMarkerFlash.style.display = (flashT && flashT > 0) ? '' : 'none';
    if (biome) elBiome.textContent = biome;

    // Stars + active bonus badges (top-right corner). Star symbol after
    // the number reads as a unit ("1,234 ★") instead of a currency prefix.
    if (stars != null) elStars.textContent = `${fmtCount(stars)} ★`;
    if (bonuses && bonuses.length) {
      elBonuses.innerHTML = bonuses
        .map(b => `${b.label} +${b.rate.toFixed(1)} ★/s`)
        .join('<br>');
    } else {
      elBonuses.textContent = '';
    }

    // Trick flash (one-shot loop / barrel-roll payouts).
    if (trickFlash && trickFlash.t > 0) {
      elTrickFlash.style.display = '';
      elTrickFlash.textContent = trickFlash.text;
    } else {
      elTrickFlash.style.display = 'none';
    }

    // Minimap (only when caller passed plane position info).
    if (planeX != null && planeZ != null && heading != null) {
      drawMinimap(planeX, planeZ, heading, visitedPois);
    }

    // Multiplayer pilot indicator. pilots > 0: at least one other pilot is
    // visible. pilots == 0: in a room but alone. pilots < 0 (or undefined):
    // not in a room (offline / SDK unavailable) — hide entirely.
    if (pilots != null && pilots > 0) {
      elPilots.style.display = '';
      elPilots.textContent = pilots === 1 ? '+1 PILOT' : `+${pilots} PILOTS`;
    } else {
      elPilots.style.display = 'none';
    }
  }

  function dispose() { wrap.remove(); }

  return { update, dispose };
}

// Layout B (Hero preview): style dropdown top-right, plane preview fills top
// ~58% via the menu turntable rig, plane name centered, ◄ ► flanking the stat
// bars, big FLY button anchored bottom, version stamp at the bottom.
//
// The picker owns:
//   • DOM overlay (mounted into uiRoot)
//   • a turntable group inside the provided menuScene, holding a DEDICATED
//     plane mesh (built via PLANES[key].build(THREE) — separate from the
//     worldScene plane mesh, since three.js objects can't belong to two scenes).
//
// onPlaneChange / onPlay are owned by shell/main.js.

import { PLANES, PLANE_ORDER } from '../game/planes.js';

const STYLE_KEYS = ['cartograph', 'topographic', 'pencil'];
const STYLE_LABELS = { cartograph: 'Cartograph', topographic: 'Topographic', pencil: 'Pencil Sketch' };

export function buildMenu({ THREE, root, menuScene, version, currentPlane, currentStyle, onPlaneChange, onStyleChange, onPlay }) {
  // --- Turntable rig inside menuScene ---
  const turntable = new THREE.Group();
  menuScene.add(turntable);
  let activeMesh = null;
  function swapMesh(key) {
    if (activeMesh) {
      turntable.remove(activeMesh);
      activeMesh.traverse((n) => {
        if (n.isMesh) {
          n.geometry && n.geometry.dispose();
          if (n.material) {
            if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
            else n.material.dispose();
          }
        }
      });
    }
    activeMesh = PLANES[key].build(THREE);
    turntable.add(activeMesh);
  }
  swapMesh(currentPlane);

  // --- DOM overlay ---
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;pointer-events:auto;color:#fff;font-family:system-ui,-apple-system,sans-serif;';
  wrap.innerHTML = `
    <select data-style style="position:absolute;top:3%;right:5%;background:#0a0e14;color:#fff;border:1px solid #2a3040;border-radius:6px;padding:6px 10px;font-size:4cqi;cursor:pointer;">
      ${STYLE_KEYS.map(k => `<option value="${k}"${k === currentStyle ? ' selected' : ''}>${STYLE_LABELS[k]}</option>`).join('')}
    </select>
    <!-- Plane preview is rendered by the menu camera into menuScene (no DOM here) -->
    <div data-name style="position:absolute;top:62%;left:0;right:0;text-align:center;font-size:9cqi;font-weight:800;letter-spacing:0.05em;"></div>
    <div style="position:absolute;top:72%;left:6%;right:6%;display:flex;justify-content:space-between;align-items:center;">
      <button data-prev style="background:rgba(255,255,255,0.06);color:#7aa7d6;border:none;border-radius:8px;padding:6px 14px;font-size:11cqi;cursor:pointer;">◄</button>
      <div data-stats style="font-size:3.6cqi;opacity:0.75;text-align:center;letter-spacing:0.05em;line-height:1.6;"></div>
      <button data-next style="background:rgba(255,255,255,0.06);color:#7aa7d6;border:none;border-radius:8px;padding:6px 14px;font-size:11cqi;cursor:pointer;">►</button>
    </div>
    <button data-fly style="position:absolute;bottom:9%;left:10%;right:10%;padding:12px 0;background:#0a84ff;color:#fff;border:none;border-radius:12px;font-size:7cqi;font-weight:800;letter-spacing:0.1em;cursor:pointer;">FLY</button>
    <div style="position:absolute;bottom:2.5%;left:0;right:0;text-align:center;font-size:2.1cqi;opacity:0.4;">${version}</div>
  `;
  root.appendChild(wrap);

  const elName = wrap.querySelector('[data-name]');
  const elStats = wrap.querySelector('[data-stats]');
  const elStyle = wrap.querySelector('[data-style]');
  const elPrev = wrap.querySelector('[data-prev]');
  const elNext = wrap.querySelector('[data-next]');
  const elFly = wrap.querySelector('[data-fly]');

  function bars(value, max, slots = 6) {
    const filled = Math.max(0, Math.min(slots, Math.round((value / max) * slots)));
    return '█'.repeat(filled) + '░'.repeat(slots - filled);
  }

  let active = currentPlane;
  function paint() {
    const p = PLANES[active];
    elName.textContent = p.name;
    elStats.innerHTML = `SPEED &nbsp; ${bars(p.stats.maxSpeed, 200)}<br/>AGILITY ${bars(p.stats.maxPitchRate, 0.85)}`;
  }
  paint();

  function cycle(delta) {
    const idx = PLANE_ORDER.indexOf(active);
    const next = PLANE_ORDER[(idx + delta + PLANE_ORDER.length) % PLANE_ORDER.length];
    active = next;
    swapMesh(active);
    paint();
    onPlaneChange && onPlaneChange(active);
  }
  elPrev.addEventListener('click', () => cycle(-1));
  elNext.addEventListener('click', () => cycle(+1));
  elFly.addEventListener('click', () => onPlay && onPlay(active));
  elStyle.addEventListener('change', (e) => onStyleChange && onStyleChange(e.target.value));

  // Per-frame: rotate the turntable
  function update(dt) {
    turntable.rotation.y += dt * 0.5;
  }

  function dispose() {
    wrap.remove();
    if (activeMesh) {
      turntable.remove(activeMesh);
      activeMesh.traverse((n) => {
        if (n.isMesh) {
          n.geometry && n.geometry.dispose();
          if (n.material) {
            if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
            else n.material.dispose();
          }
        }
      });
      activeMesh = null;
    }
    menuScene.remove(turntable);
  }

  return { update, dispose };
}

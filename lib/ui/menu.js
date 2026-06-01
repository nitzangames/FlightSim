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

// Comma thousand-separator for star and NBucks costs ("100,000 ★").
function fmt(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function buildMenu({
  THREE, root, menuScene, version, currentPlane,
  scoreTracker, unlockState, onPlaneChange, onPlay,
}) {
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
    // Auto-fit oversized planes (A-10, F-22, SR-71) into the menu camera's
    // view. Anything whose bounding box already fits inside FIT_SIZE keeps
    // its natural scale — so the biplane still reads small, and only the
    // big jets get zoomed out.
    turntable.scale.setScalar(1);
    activeMesh.updateMatrixWorld(true);
    const box  = new THREE.Box3().setFromObject(activeMesh);
    const size = new THREE.Vector3(); box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const FIT_SIZE = 7.5;
    const s = maxDim > FIT_SIZE ? FIT_SIZE / maxDim : 1;
    turntable.scale.setScalar(s);
  }
  swapMesh(currentPlane);

  // --- DOM overlay ---
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;pointer-events:auto;color:#fff;font-family:system-ui,-apple-system,sans-serif;';
  wrap.innerHTML = `
    <!-- Plane preview is rendered by the menu camera into menuScene (no DOM here) -->
    <div data-wallet style="position:absolute;top:3%;right:5%;font-size:4.2cqi;font-weight:800;letter-spacing:0.05em;color:#ffd766;text-shadow:0 1px 4px rgba(0,0,0,0.6);">0 ★</div>
    <div data-name style="position:absolute;top:54%;left:0;right:0;text-align:center;font-size:9cqi;font-weight:800;letter-spacing:0.05em;"></div>
    <div style="position:absolute;top:66%;left:6%;right:6%;display:flex;justify-content:space-between;align-items:center;">
      <button data-prev style="background:rgba(255,255,255,0.06);color:#7aa7d6;border:none;border-radius:8px;padding:6px 14px;font-size:11cqi;cursor:pointer;">◄</button>
      <div data-stats style="font-size:3.6cqi;opacity:0.75;text-align:center;letter-spacing:0.05em;line-height:1.3;"></div>
      <button data-next style="background:rgba(255,255,255,0.06);color:#7aa7d6;border:none;border-radius:8px;padding:6px 14px;font-size:11cqi;cursor:pointer;">►</button>
    </div>
    <button data-fly style="position:absolute;bottom:10%;left:10%;right:10%;padding:12px 0;background:#0a84ff;color:#fff;border:none;border-radius:12px;font-size:7cqi;font-weight:800;letter-spacing:0.1em;cursor:pointer;">FLY</button>
    <div style="position:absolute;bottom:2.5%;left:0;right:0;text-align:center;font-size:2.1cqi;opacity:0.4;">${version}</div>
  `;
  root.appendChild(wrap);

  const elWallet = wrap.querySelector('[data-wallet]');
  const elName = wrap.querySelector('[data-name]');
  const elStats = wrap.querySelector('[data-stats]');
  const elPrev = wrap.querySelector('[data-prev]');
  const elNext = wrap.querySelector('[data-next]');
  const elFly = wrap.querySelector('[data-fly]');

  function bars(value, max, slots = 6) {
    const filled = Math.max(0, Math.min(slots, Math.round((value / max) * slots)));
    return '█'.repeat(filled) + '░'.repeat(slots - filled);
  }

  // Max values used to scale each stat into 6 bar slots. SPEED is capped at
  // 200 (above the fastest plane). CLIMB / ROLL are capped at 0.85 (the
  // current ceiling among all planes). TURN is derived from roll-rate ÷
  // speed — a proxy for turn radius that matches the bank-to-turn physics
  // in controller.js (slower plane + faster roll = tighter turn), so the
  // triplane scores highest here and the F-15 lowest.
  const SPEED_MAX = 300;     // SR-71's top speed sets the upper end of the scale
  const RATE_MAX  = 0.85;
  const TURN_MAX  = 0.85 / 50;     // triplane: maxYawRate / maxSpeed

  let active = currentPlane;
  let busy   = false;    // suppresses double-clicks during async NBucks call

  function paint() {
    const p = PLANES[active];
    const s = p.stats;
    const isUnlocked = unlockState.isUnlocked(active);
    elName.textContent = isUnlocked ? p.name : `${p.name} 🔒`;
    const turnRate = s.maxYawRate / s.maxSpeed;
    elStats.innerHTML = `
      <div style="display:grid;grid-template-columns:auto auto;column-gap:1.2em;row-gap:0.2em;justify-content:center;text-align:left;">
        <div>SPEED</div><div>${bars(s.maxSpeed, SPEED_MAX)}</div>
        <div>CLIMB</div><div>${bars(s.maxPitchRate, RATE_MAX)}</div>
        <div>ROLL</div><div>${bars(s.maxYawRate, RATE_MAX)}</div>
        <div>TURN</div><div>${bars(turnRate, TURN_MAX)}</div>
      </div>
    `;
    // Update the wallet readout each repaint — the player's star total can
    // grow between menu visits (post-flight earnings), so we re-read.
    elWallet.textContent = `${fmt(scoreTracker.stars)} ★`;
    // Bottom action button — FLY when unlocked; UNLOCK X ★ / X NB otherwise.
    if (isUnlocked) {
      elFly.textContent = 'FLY';
      elFly.style.background = '#0a84ff';
      elFly.style.color = '#fff';
      elFly.disabled = false;
      elFly.style.opacity = '1';
      elFly.style.cursor = 'pointer';
    } else if (p.unlock.kind === 'stars') {
      const need = p.unlock.amount;
      const canAfford = scoreTracker.stars >= need;
      elFly.textContent = canAfford ? `UNLOCK ${fmt(need)} ★` : `NEED ${fmt(need)} ★`;
      elFly.style.background = canAfford ? '#d9a300' : '#3a3a3a';
      elFly.style.color = '#fff';
      elFly.disabled = !canAfford;
      elFly.style.opacity = canAfford ? '1' : '0.55';
      elFly.style.cursor = canAfford ? 'pointer' : 'not-allowed';
    } else if (p.unlock.kind === 'nbucks') {
      const need = p.unlock.amount;
      // NBucks is always clickable — platform handles top-up if balance low.
      elFly.textContent = `UNLOCK ${fmt(need)} NB`;
      elFly.style.background = '#7a5cff';
      elFly.style.color = '#fff';
      elFly.disabled = false;
      elFly.style.opacity = '1';
      elFly.style.cursor = 'pointer';
    }
  }
  paint();

  function cycle(delta) {
    const idx = PLANE_ORDER.indexOf(active);
    const next = PLANE_ORDER[(idx + delta + PLANE_ORDER.length) % PLANE_ORDER.length];
    active = next;
    swapMesh(active);
    paint();
    // Only commit the selection (which persists currentPlane + rebuilds
    // world-plane physics) for planes the player has actually unlocked.
    // Locked planes are browseable but never become the "current" plane.
    if (unlockState.isUnlocked(active)) onPlaneChange && onPlaneChange(active);
  }

  // Attempts to unlock the currently-viewed plane. Stars unlock is sync;
  // NBucks goes through PlaySDK.nbucks.spend (async, user-confirmed).
  async function attemptUnlock() {
    if (busy) return;
    const p = PLANES[active];
    if (unlockState.isUnlocked(active)) return;
    if (p.unlock.kind === 'stars') {
      if (!scoreTracker.spendStars(p.unlock.amount)) return;   // insufficient
      unlockState.markUnlocked(active);
      paint();
      // Now that the plane's unlocked, commit it as the current selection.
      onPlaneChange && onPlaneChange(active);
    } else if (p.unlock.kind === 'nbucks') {
      busy = true;
      try {
        await window.PlaySDK.nbucks.spend({
          amount: p.unlock.amount,
          itemDescription: `Unlock ${p.name}`,
          itemId: `plane.${active}`,
        });
        unlockState.markUnlocked(active);
        paint();
        onPlaneChange && onPlaneChange(active);
      } catch {
        // Cancelled or insufficient — no charge. Nothing to do; the button
        // stays put for a retry.
      } finally {
        busy = false;
      }
    }
  }

  elPrev.addEventListener('click', () => cycle(-1));
  elNext.addEventListener('click', () => cycle(+1));
  elFly.addEventListener('click', () => {
    if (unlockState.isUnlocked(active)) onPlay && onPlay(active);
    else attemptUnlock();
  });

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

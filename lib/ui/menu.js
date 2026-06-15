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

// Star store packages — NBucks (platform hard currency) buys in-game stars.
// Bigger packs give progressively more stars per NBuck (10 → 11.25 → 13).
const STORE_PACKAGES = [
  { nbucks: 100, stars: 1000 },
  { nbucks: 200, stars: 2250 },
  { nbucks: 500, stars: 6500 },
];

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
    <!-- Wallet doubles as the store button: tap to exchange NBucks for stars. -->
    <button data-wallet style="position:absolute;top:3%;right:5%;font-size:4.2cqmin;font-weight:800;letter-spacing:0.05em;background:#ffd766;color:#1a1a1a;border:none;border-radius:10px;padding:0.35em 0.75em;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.45);">0 ★</button>
    <div data-name style="position:absolute;top:54%;left:0;right:0;text-align:center;font-size:9cqmin;font-weight:800;letter-spacing:0.05em;"></div>
    <div style="position:absolute;top:66%;left:6%;right:6%;display:flex;justify-content:space-between;align-items:center;">
      <button data-prev style="background:rgba(255,255,255,0.06);color:#7aa7d6;border:none;border-radius:8px;padding:6px 14px;font-size:11cqmin;cursor:pointer;">◄</button>
      <div data-stats style="font-size:3.6cqmin;opacity:0.75;text-align:center;letter-spacing:0.05em;line-height:1.3;"></div>
      <button data-next style="background:rgba(255,255,255,0.06);color:#7aa7d6;border:none;border-radius:8px;padding:6px 14px;font-size:11cqmin;cursor:pointer;">►</button>
    </div>
    <button data-fly style="position:absolute;bottom:10%;left:10%;right:10%;padding:12px 0;background:#0a84ff;color:#fff;border:none;border-radius:12px;font-size:7cqmin;font-weight:800;letter-spacing:0.1em;cursor:pointer;">FLY</button>
    <div style="position:absolute;bottom:2.5%;left:0;right:0;text-align:center;font-size:2.1cqmin;opacity:0.4;">${version}</div>
    <!-- Star store overlay (hidden until the wallet button is tapped). -->
    <div data-store style="position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;padding:0 8%;background:rgba(8,12,20,0.94);">
      <div style="font-size:7cqmin;font-weight:800;letter-spacing:0.06em;color:#ffd766;">STAR STORE</div>
      <div data-store-balance style="font-size:3.4cqmin;font-weight:700;opacity:0.85;margin-top:1.5%;">0 ★</div>
      <div style="font-size:3cqmin;opacity:0.6;margin:3% 0 6%;text-align:center;">Exchange NBucks for stars</div>
      <div data-store-packages style="display:flex;flex-direction:column;gap:4cqmin;width:100%;"></div>
      <button data-store-close style="margin-top:8%;background:rgba(255,255,255,0.08);color:#cdd6e2;border:none;border-radius:10px;padding:2.5cqmin 8cqmin;font-size:4cqmin;font-weight:700;letter-spacing:0.08em;cursor:pointer;">CLOSE</button>
    </div>
  `;
  root.appendChild(wrap);

  const elWallet = wrap.querySelector('[data-wallet]');
  const elName = wrap.querySelector('[data-name]');
  const elStats = wrap.querySelector('[data-stats]');
  const elPrev = wrap.querySelector('[data-prev]');
  const elNext = wrap.querySelector('[data-next]');
  const elFly = wrap.querySelector('[data-fly]');
  const elStore = wrap.querySelector('[data-store]');
  const elStoreBalance = wrap.querySelector('[data-store-balance]');
  const elStorePackages = wrap.querySelector('[data-store-packages]');
  const elStoreClose = wrap.querySelector('[data-store-close]');

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
    // grow between menu visits (post-flight earnings), so we re-read. The
    // store's own balance line mirrors it while the store is open.
    elWallet.textContent = `${fmt(scoreTracker.stars)} ★`;
    elStoreBalance.textContent = `${fmt(scoreTracker.stars)} ★`;
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

  // --- Star store ---
  // Build one button per package. Each spends NBucks via PlaySDK and, on a
  // confirmed charge, credits the granted stars to the ScoreTracker.
  const pkgButtons = STORE_PACKAGES.map((pkg, i) => {
    const b = document.createElement('button');
    b.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:4cqmin;background:#ffd766;color:#1a1a1a;border:none;border-radius:14px;padding:4cqmin 6cqmin;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
    b.innerHTML = `
      <span style="font-size:6cqmin;font-weight:800;letter-spacing:0.03em;">+${fmt(pkg.stars)} ★</span>
      <span style="font-size:4cqmin;font-weight:800;background:#1a1a1a;color:#ffd766;border-radius:9px;padding:0.35em 0.7em;white-space:nowrap;">${fmt(pkg.nbucks)} NB</span>
    `;
    b.addEventListener('click', () => buyStars(i));
    elStorePackages.appendChild(b);
    return b;
  });

  function setStoreBusy(on) {
    pkgButtons.forEach(b => {
      b.disabled = on;
      b.style.opacity = on ? '0.55' : '1';
      b.style.cursor = on ? 'progress' : 'pointer';
    });
  }

  function openStore() { paint(); elStore.style.display = 'flex'; }
  function closeStore() { elStore.style.display = 'none'; }

  async function buyStars(i) {
    if (busy) return;
    const pkg = STORE_PACKAGES[i];
    busy = true;
    setStoreBusy(true);
    try {
      await window.PlaySDK.nbucks.spend({
        amount: pkg.nbucks,
        itemDescription: `${fmt(pkg.stars)} stars`,
        itemId: `stars.${pkg.nbucks}`,
      });
      scoreTracker.addStars(pkg.stars);
      paint();   // refresh wallet + store balance + plane affordability
    } catch {
      // Cancelled or insufficient NBucks — no charge, nothing to undo.
    } finally {
      busy = false;
      setStoreBusy(false);
    }
  }

  elWallet.addEventListener('click', openStore);
  elStoreClose.addEventListener('click', closeStore);

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

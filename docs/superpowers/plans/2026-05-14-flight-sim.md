# Flight Sim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable free-roam flight sandbox at `/Users/nitzanwilnai/Programming/Claude/JSGames/FlightSim/` — open procedural world, six selectable planes, drag/keyboard controls, crash-back-to-menu, persistent seed.

**Architecture:** Vendor the terrain library from ProceduralTerrain3D and the plane meshes/physics/camera from CanyonRun3D into `lib/`. Write a small fresh shell (`shell/main.js` + `lib/game/*` + `lib/ui/*`) that wires them together with a 3-state machine (MENU / FLYING / CRASH), two scenes (`menuScene` for the picker turntable, `worldScene` for actual flight), and a single shared `WebGLRenderer`. Persist `{seed, plane, style}` in localStorage.

**Tech Stack:** three.js r128 (CDN), vitest for unit tests, python3 http.server for local dev, plain ES modules.

**Spec:** `docs/superpowers/specs/2026-05-14-flight-sim-design.md` — read it before starting.

---

## Task 1: Project skeleton

**Goal:** A blank stage page loads at `http://localhost:8085` showing the version stamp. No game logic yet.

**Files:**
- Create: `package.json`
- Create: `meta.json`
- Create: `index.html`
- Create: `lib/version.js`
- Verify: `.gitignore` (already created)

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "flight-sim",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "python3 -m http.server 8085"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Write `meta.json`**

```json
{
  "slug": "flight-sim",
  "title": "Flight Sim",
  "description": "Free-roam flight sandbox. Pick a plane, fly anywhere across a procedural world of mountains, rivers, and forests. Same seed every flight.",
  "tags": ["3d", "sandbox", "flying", "casual", "exploration"],
  "author": "nitzanwilnai",
  "thumbnail": "thumbnail.png"
}
```

- [ ] **Step 3: Write `lib/version.js`**

```js
// Bump on every commit so the visible build stamp confirms latest code is loaded.
// See GAME_DEV_NOTES — visible version is required on this platform.
export const VERSION = 'v0.1.0';
```

- [ ] **Step 4: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Flight Sim</title>
  <link rel="icon" href="data:,">
  <style>
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      overflow: hidden; background: #000;
      display: flex; align-items: center; justify-content: center;
    }
    #stage {
      position: relative;
      aspect-ratio: 9 / 16;
      max-width: 100vw;
      max-height: 100vh;
      height: 100vh;
      container-type: size;
    }
    canvas {
      display: block; width: 100%; height: 100%;
      touch-action: none;
      -webkit-touch-callout: none; -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    #boot {
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: #0a0e14; color: #fff; font-family: ui-monospace, Menlo, monospace; z-index: 100;
      transition: opacity .4s ease;
    }
    #boot.hidden { opacity: 0; pointer-events: none; }
    #ui-root {
      position: absolute; inset: 0; pointer-events: none; z-index: 50;
      overflow: hidden;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn-play.nitzan.games/lib/play-sdk.js"></script>
</head>
<body>
  <div id="stage">
    <canvas id="game" width="1080" height="1920"></canvas>
    <div id="ui-root"></div>
  </div>
  <div id="boot">Booting…</div>
  <script type="module" src="shell/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Write a minimal placeholder `shell/main.js`** so the page loads without 404

```js
import { VERSION } from '../lib/version.js';
console.log('[flight-sim] ' + VERSION);
document.getElementById('boot').textContent = 'Flight Sim ' + VERSION;
```

- [ ] **Step 6: Install vitest**

Run: `npm install`
Expected: vitest installed in `node_modules/`.

- [ ] **Step 7: Run dev server and verify**

Run: `npm run dev` in one terminal.
Open `http://localhost:8085` in a browser.
Expected: black screen with `Flight Sim v0.1.0` text. Browser console shows `[flight-sim] v0.1.0`.

- [ ] **Step 8: Commit**

```bash
git add package.json meta.json index.html lib/version.js shell/main.js
git commit -m "feat: project skeleton — stage, boot screen, version stamp"
```

---

## Task 2: Vendor terrain library from ProceduralTerrain3D

**Goal:** Copy the entire `lib/terrain/` tree into FlightSim so the game owns its terrain code. No changes to terrain files.

**Files:**
- Create: `lib/terrain/index.js` (copy)
- Create: `lib/terrain/carve.js` (copy)
- Create: `lib/terrain/chunk-build.js` (copy)
- Create: `lib/terrain/chunk-manager.js` (copy)
- Create: `lib/terrain/chunk-runner.js` (copy)
- Create: `lib/terrain/chunk-worker-proxy.js` (copy)
- Create: `lib/terrain/chunk-worker.js` (copy)
- Create: `lib/terrain/height.js` (copy)
- Create: `lib/terrain/noise.js` (copy)
- Create: `lib/terrain/river-graph.js` (copy)
- Create: `lib/terrain/style-system.js` (copy)
- Create: `lib/terrain/trees.js` (copy)
- Create: `lib/terrain/water.js` (copy)

- [ ] **Step 1: Copy the entire terrain tree**

```bash
cp -R /Users/nitzanwilnai/Programming/Claude/JSGames/ProceduralTerrain3D/lib/terrain lib/
```

- [ ] **Step 2: Verify the copy**

```bash
ls lib/terrain/
```
Expected: 13 files — `index.js  carve.js  chunk-build.js  chunk-manager.js  chunk-runner.js  chunk-worker-proxy.js  chunk-worker.js  height.js  noise.js  river-graph.js  style-system.js  trees.js  water.js`.

- [ ] **Step 3: Smoke-check the terrain loads in the browser**

Edit `shell/main.js`:

```js
import { VERSION } from '../lib/version.js';
import { createTerrain } from '../lib/terrain/index.js';
console.log('[flight-sim] ' + VERSION);

const THREE = window.THREE;
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 9/16, 1, 4500);
camera.position.set(0, 120, 0);
camera.lookAt(50, 80, -50);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

const terrain = createTerrain({ THREE, scene, renderer, style: 'cartograph', perfMode: 'high' });

document.getElementById('boot').classList.add('hidden');
setTimeout(() => document.getElementById('boot').remove(), 600);

(function frame() {
  terrain.update(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
})();
```

- [ ] **Step 4: Reload the browser at `localhost:8085`**

Expected: A cartograph-style procedural terrain (olive/tan hills, cream sky, soft fog) fills the portrait stage. No console errors.

- [ ] **Step 5: Commit**

```bash
git add lib/terrain/ shell/main.js
git commit -m "feat: vendor terrain library from ProceduralTerrain3D"
```

---

## Task 3: Vendor plane library from CanyonRun3D

**Goal:** Copy the plane meshes, physics, input, and camera into FlightSim.

**Files:**
- Create: `lib/plane/biplane.js` (copy)
- Create: `lib/plane/triplane.js` (copy)
- Create: `lib/plane/ww2-fighter.js` (copy)
- Create: `lib/plane/f86.js` (copy)
- Create: `lib/plane/f15.js` (copy)
- Create: `lib/plane/f22.js` (copy)
- Create: `lib/plane/controller.js` (copy — PlanePhysics + DragInput)
- Create: `lib/plane/camera.js` (copy — ChaseCamera)

- [ ] **Step 1: Copy the plane files**

```bash
mkdir -p lib/plane
cp /Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/lib/plane/biplane.js lib/plane/
cp /Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/lib/plane/triplane.js lib/plane/
cp /Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/lib/plane/ww2-fighter.js lib/plane/
cp /Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/lib/plane/f86.js lib/plane/
cp /Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/lib/plane/f15.js lib/plane/
cp /Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/lib/plane/f22.js lib/plane/
cp /Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/lib/plane/controller.js lib/plane/
cp /Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/lib/plane/camera.js lib/plane/
```

- [ ] **Step 2: Verify**

```bash
ls lib/plane/
```
Expected: 8 files — `biplane.js  triplane.js  ww2-fighter.js  f86.js  f15.js  f22.js  controller.js  camera.js`.

- [ ] **Step 3: Commit**

```bash
git add lib/plane/
git commit -m "feat: vendor plane meshes, physics, input, chase camera from CanyonRun3D"
```

---

## Task 4: lib/game/state.js — StateMachine + unit test

**Goal:** Generic 3-state machine used by `shell/main.js`. Tested in isolation.

**Files:**
- Create: `lib/game/state.js`
- Create: `tests/state.test.js`
- Create: `vitest.config.js`

- [ ] **Step 1: Write the failing test**

Create `tests/state.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from '../lib/game/state.js';

describe('StateMachine', () => {
  it('fires enter on start', () => {
    const enter = vi.fn();
    const sm = new StateMachine({ initial: 'A', states: { A: { enter } } });
    sm.start();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('transitions: fires exit on current then enter on next', () => {
    const calls = [];
    const sm = new StateMachine({
      initial: 'A',
      states: {
        A: { enter: () => calls.push('A.enter'), exit: () => calls.push('A.exit') },
        B: { enter: () => calls.push('B.enter') },
      },
    });
    sm.start();
    sm.setState('B');
    expect(calls).toEqual(['A.enter', 'A.exit', 'B.enter']);
  });

  it('update calls current state update', () => {
    const update = vi.fn();
    const sm = new StateMachine({ initial: 'A', states: { A: { update } } });
    sm.start();
    sm.update(0.016);
    expect(update).toHaveBeenCalledWith(0.016);
  });

  it('update before start is a no-op', () => {
    const update = vi.fn();
    const sm = new StateMachine({ initial: 'A', states: { A: { update } } });
    sm.update(0.016);
    expect(update).not.toHaveBeenCalled();
  });

  it('setState to unknown name throws', () => {
    const sm = new StateMachine({ initial: 'A', states: { A: {} } });
    sm.start();
    expect(() => sm.setState('NOPE')).toThrow(/unknown state NOPE/);
  });
});
```

- [ ] **Step 2: Write `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 3: Run test to verify it fails (module not found)**

Run: `npx vitest run tests/state.test.js`
Expected: FAIL with "Cannot find module ../lib/game/state.js" or similar.

- [ ] **Step 4: Write the StateMachine**

Create `lib/game/state.js`:

```js
// Generic finite state machine with enter/exit/update hooks.
// Game-specific state bodies are wired in shell/main.js.

export class StateMachine {
  constructor({ initial, states }) {
    if (!states[initial]) throw new Error('unknown initial state ' + initial);
    this.states = states;
    this.current = initial;
    this._started = false;
  }
  start() {
    if (this._started) return;
    this._started = true;
    const s = this.states[this.current];
    if (s.enter) s.enter();
  }
  setState(name) {
    const next = this.states[name];
    if (!next) throw new Error('unknown state ' + name);
    if (this._started) {
      const cur = this.states[this.current];
      if (cur.exit) cur.exit();
    }
    this.current = name;
    if (this._started && next.enter) next.enter();
  }
  update(dt) {
    if (!this._started) return;
    const s = this.states[this.current];
    if (s.update) s.update(dt);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/state.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/game/state.js tests/state.test.js vitest.config.js
git commit -m "feat: lib/game/state.js — generic StateMachine + tests"
```

---

## Task 5: lib/game/planes.js — plane roster + unit test

**Goal:** Pure data module that maps plane keys to `{ name, build, stats }`. Used by menu, shell, collision.

**Files:**
- Create: `lib/game/planes.js`
- Create: `tests/planes.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/planes.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { PLANES, PLANE_ORDER } from '../lib/game/planes.js';

const STAT_KEYS = ['maxSpeed', 'maxPitchRate', 'maxYawRate', 'fuelDrainRate', 'maxFuel', 'collisionRadius'];

describe('PLANES roster', () => {
  it('contains exactly the six expected keys', () => {
    expect(Object.keys(PLANES).sort()).toEqual(['biplane', 'f15', 'f22', 'f86', 'triplane', 'ww2']);
  });

  it('each plane has name, build (function), and stats', () => {
    for (const key of Object.keys(PLANES)) {
      const p = PLANES[key];
      expect(p.key).toBe(key);
      expect(typeof p.name).toBe('string');
      expect(typeof p.build).toBe('function');
      expect(p.stats).toBeDefined();
      for (const sk of STAT_KEYS) {
        expect(typeof p.stats[sk]).toBe('number');
      }
    }
  });

  it('every plane has fuelDrainRate === 0 (sandbox invariant)', () => {
    for (const key of Object.keys(PLANES)) {
      expect(PLANES[key].stats.fuelDrainRate).toBe(0);
    }
  });

  it('PLANE_ORDER lists all 6 in tier order biplane → f22', () => {
    expect(PLANE_ORDER).toEqual(['biplane', 'triplane', 'ww2', 'f86', 'f15', 'f22']);
    expect(PLANE_ORDER.length).toBe(Object.keys(PLANES).length);
  });

  it('speed ascends through PLANE_ORDER', () => {
    let prev = -Infinity;
    for (const key of PLANE_ORDER) {
      const s = PLANES[key].stats.maxSpeed;
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/planes.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/game/planes.js`**

```js
// Plane roster for the sandbox. Stats are the CanyonRun3D `base` values, with
// `fuelDrainRate` zeroed so the engine never quits. coinValue / magnetRadius /
// coinMultiplier from CanyonRun's upgrades config are deleted — unused here.

import { buildBiplane }    from '../plane/biplane.js';
import { buildTriplane }   from '../plane/triplane.js';
import { buildWW2Fighter } from '../plane/ww2-fighter.js';
import { buildF86 }        from '../plane/f86.js';
import { buildF15 }        from '../plane/f15.js';
import { buildF22 }        from '../plane/f22.js';

export const PLANES = {
  biplane:  { key:'biplane',  name:'WW1 Biplane',   build: buildBiplane,    stats: { maxSpeed: 60,  maxPitchRate: 0.45, maxYawRate: 0.45, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 3.7 } },
  triplane: { key:'triplane', name:'WW1 Triplane',  build: buildTriplane,   stats: { maxSpeed: 75,  maxPitchRate: 0.55, maxYawRate: 0.55, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 3.2 } },
  ww2:      { key:'ww2',      name:'WW2 Fighter',   build: buildWW2Fighter, stats: { maxSpeed: 95,  maxPitchRate: 0.55, maxYawRate: 0.55, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 5.7 } },
  f86:      { key:'f86',      name:'F-86 Sabre',    build: buildF86,        stats: { maxSpeed: 130, maxPitchRate: 0.65, maxYawRate: 0.65, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 4.5 } },
  f15:      { key:'f15',      name:'F-15 Eagle',    build: buildF15,        stats: { maxSpeed: 160, maxPitchRate: 0.75, maxYawRate: 0.75, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 6.5 } },
  f22:      { key:'f22',      name:'F-22 Raptor',   build: buildF22,        stats: { maxSpeed: 200, maxPitchRate: 0.85, maxYawRate: 0.85, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 6.8 } },
};

export const PLANE_ORDER = ['biplane', 'triplane', 'ww2', 'f86', 'f15', 'f22'];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/planes.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/game/planes.js tests/planes.test.js
git commit -m "feat: lib/game/planes.js — six-plane roster + tests"
```

---

## Task 6: lib/game/collision.js — terrain crash + ceiling clamp

**Goal:** Two pure functions: `crashed(physics, terrain, radius)` (terrain-height comparison) and `clampToCeiling(physics, ceiling)` (soft altitude cap). Tested with a stub terrain.

**Files:**
- Create: `lib/game/collision.js`
- Create: `tests/collision.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/collision.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crashed, clampToCeiling } from '../lib/game/collision.js';

const terrainAt = (h) => ({ getHeight: () => h });

describe('crashed', () => {
  it('true when plane.y - radius <= ground', () => {
    const physics = { x: 0, z: 0, y: 100 };
    expect(crashed(physics, terrainAt(98), 3)).toBe(true);
    expect(crashed(physics, terrainAt(97), 3)).toBe(true);
  });

  it('false when plane.y - radius > ground', () => {
    const physics = { x: 0, z: 0, y: 100 };
    expect(crashed(physics, terrainAt(96), 3)).toBe(false);
    expect(crashed(physics, terrainAt(50), 3)).toBe(false);
  });

  it('returns false when terrain is null', () => {
    expect(crashed({ x: 0, z: 0, y: 10 }, null, 3)).toBe(false);
  });

  it('queries terrain.getHeight at the plane x/z', () => {
    let seenX = null, seenZ = null;
    const terrain = { getHeight: (x, z) => { seenX = x; seenZ = z; return 0; } };
    crashed({ x: 42, z: -17, y: 100 }, terrain, 3);
    expect(seenX).toBe(42);
    expect(seenZ).toBe(-17);
  });
});

describe('clampToCeiling', () => {
  it('clamps y down to ceiling if above', () => {
    const p = { y: 2000, fallSpeed: 0 };
    expect(clampToCeiling(p, 1500)).toBe(true);
    expect(p.y).toBe(1500);
  });

  it('leaves y alone if below ceiling', () => {
    const p = { y: 800, fallSpeed: 0 };
    expect(clampToCeiling(p, 1500)).toBe(false);
    expect(p.y).toBe(800);
  });

  it('zeroes negative fallSpeed when clamped (so plane doesn\'t keep climbing)', () => {
    const p = { y: 2000, fallSpeed: -5 };
    clampToCeiling(p, 1500);
    expect(p.fallSpeed).toBe(0);
  });

  it('does not touch positive fallSpeed when clamped', () => {
    const p = { y: 2000, fallSpeed: 12 };
    clampToCeiling(p, 1500);
    expect(p.fallSpeed).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collision.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/game/collision.js`**

```js
// Sandbox collision: only the terrain ground matters (no canyon walls, no
// obstacle lists). `crashed` is a terrain-height comparison. `clampToCeiling`
// is a soft altitude cap — keeps the plane in-world without ending the run.
//
// CEILING is high enough to comfortably overfly the procedural mountains
// (they top out near 400–600 m in this terrain), low enough that the player
// can't escape the world.

export const CEILING = 1500;

export function crashed(physics, terrain, radius) {
  if (!terrain) return false;
  const groundY = terrain.getHeight(physics.x, physics.z);
  return physics.y - radius <= groundY;
}

export function clampToCeiling(physics, ceiling = CEILING) {
  if (physics.y > ceiling) {
    physics.y = ceiling;
    if (physics.fallSpeed !== undefined && physics.fallSpeed < 0) physics.fallSpeed = 0;
    return true;
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/collision.test.js`
Expected: PASS — 8 tests.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all three test files (state + planes + collision), 18 tests total.

- [ ] **Step 6: Commit**

```bash
git add lib/game/collision.js tests/collision.test.js
git commit -m "feat: lib/game/collision.js — terrain crash + ceiling clamp"
```

---

## Task 7: lib/ui/menu.js — plane picker (Layout B) with turntable

**Goal:** Plane-selection UI overlaid on the stage, with a `menuScene` turntable rig that shows a dedicated plane mesh rotating. Wires plane cycle arrows, style dropdown, FLY button.

**Files:**
- Create: `lib/ui/menu.js`

- [ ] **Step 1: Write `lib/ui/menu.js`**

```js
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
// onPlaneChange / onStyleChange / onPlay are owned by shell/main.js.

import { PLANES, PLANE_ORDER } from '../game/planes.js';

const STYLE_KEYS = ['lowpoly', 'stylized', 'realistic', 'cartograph'];
const STYLE_LABELS = { lowpoly: 'Lowpoly', stylized: 'Stylized', realistic: 'Realistic', cartograph: 'Cartograph' };

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
```

- [ ] **Step 2: Browser smoke test — temporarily wire menu in `shell/main.js`**

Edit `shell/main.js` to mount the menu and render `menuScene`:

```js
import { VERSION } from '../lib/version.js';
import { buildMenu } from '../lib/ui/menu.js';
console.log('[flight-sim] ' + VERSION);

const THREE = window.THREE;
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const menuScene = new THREE.Scene();
menuScene.background = new THREE.Color(0x0a0e14);
menuScene.add(new THREE.HemisphereLight(0xcfd8e0, 0x202428, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(8, 12, 8); menuScene.add(sun);

const menuCam = new THREE.PerspectiveCamera(30, 9/16, 0.1, 100);
menuCam.position.set(13, 5, 13); menuCam.lookAt(0, 0.3, 0);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  menuCam.aspect = w / h;
  menuCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

const uiRoot = document.getElementById('ui-root');
const menu = buildMenu({
  THREE, root: uiRoot, menuScene, version: VERSION,
  currentPlane: 'biplane', currentStyle: 'cartograph',
  onPlaneChange: (k) => console.log('plane →', k),
  onStyleChange: (s) => console.log('style →', s),
  onPlay: (k) => console.log('FLY:', k),
});

document.getElementById('boot').classList.add('hidden');
setTimeout(() => document.getElementById('boot').remove(), 600);

let last = performance.now();
(function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  menu.update(dt);
  renderer.render(menuScene, menuCam);
  requestAnimationFrame(frame);
})();
```

- [ ] **Step 3: Reload `localhost:8085` and verify**

Expected:
- Plane picker UI visible at portrait aspect: style dropdown top-right, name + stats + arrows in the middle, big FLY button at bottom, version stamp at the bottom.
- Biplane rotates slowly on a turntable in the upper area.
- Click `►` cycles to triplane → ww2 → f86 → f15 → f22 → back to biplane. Console logs each change.
- Click `◄` cycles backward.
- Change style dropdown — console logs new style.
- Click FLY — console logs `FLY: <plane>`.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add lib/ui/menu.js shell/main.js
git commit -m "feat: lib/ui/menu.js — plane picker (Layout B) with turntable"
```

---

## Task 8: lib/ui/hud.js — in-flight HUD

**Goal:** Speed, altitude, back button, countdown overlay, version stamp. Wrapper is pointer-events:none so drags reach the canvas; only the back button is interactive.

**Files:**
- Create: `lib/ui/hud.js`

- [ ] **Step 1: Write `lib/ui/hud.js`**

```js
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

  elBack.addEventListener('click', () => onBack && onBack());

  function update({ speed, altitude, countdown }) {
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
  }

  function dispose() { wrap.remove(); }

  return { update, dispose };
}
```

- [ ] **Step 2: Browser smoke test — temporarily mount HUD in `shell/main.js`**

Append to `shell/main.js` (after the menu setup) to also mount the HUD on top for a quick visual check:

```js
import { buildHUD } from '../lib/ui/hud.js';
const hud = buildHUD({ root: uiRoot, version: VERSION, onBack: () => console.log('back') });
let testCountdown = 3.5;
let testSpeed = 0, testAlt = 200;
function fakeHudTick(dt) {
  testCountdown -= dt;
  if (testCountdown < -1) testCountdown = 3.5; // loop for visual demo
  testSpeed = testCountdown > 0 ? 0 : 142;
  hud.update({ speed: testSpeed, altitude: testAlt, countdown: testCountdown });
}
```

Then inside the frame loop, call `fakeHudTick(dt)` between `menu.update` and `renderer.render`.

- [ ] **Step 3: Reload and verify**

Expected:
- Back arrow visible top-left over the menu, big "3 / 2 / 1 / GO!" cycles in the center every few seconds.
- "SPEED 0 m/s / ALT 200 m" jumps to "SPEED 142 m/s" after GO!.
- Back arrow click logs `back`.
- Click-and-drag elsewhere on the canvas should still work (HUD wrapper doesn't block — verify by hovering: cursor doesn't change to text-select except over button).

- [ ] **Step 4: Remove the fake HUD demo from `shell/main.js`**

(Revert to just the menu setup; HUD is wired properly in Task 10. Leave the `import` removed.)

- [ ] **Step 5: Commit**

```bash
git add lib/ui/hud.js
git commit -m "feat: lib/ui/hud.js — speed, altitude, countdown, back button"
```

---

## Task 9: lib/ui/crash-overlay.js — 1.5s "Crashed" flash

**Goal:** A throwaway full-screen overlay that shows "✕ CRASHED" for 1.5s then fires `onComplete`.

**Files:**
- Create: `lib/ui/crash-overlay.js`

- [ ] **Step 1: Write `lib/ui/crash-overlay.js`**

```js
// Translucent "✕ CRASHED" flash. Schedules onComplete after durationMs and
// auto-disposes if the caller forgets. Below it the worldScene is rendered
// frozen at the crash frame.

export function buildCrashOverlay({ root, durationMs = 1500, onComplete }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;color:#ff5147;font-family:system-ui,-apple-system,sans-serif;font-size:11cqi;font-weight:900;letter-spacing:0.1em;text-shadow:0 2px 14px rgba(0,0,0,0.7);background:rgba(0,0,0,0.0);';
  wrap.textContent = '✕ CRASHED';
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
```

- [ ] **Step 2: Commit (no visual test yet — used end-to-end in Task 10)**

```bash
git add lib/ui/crash-overlay.js
git commit -m "feat: lib/ui/crash-overlay.js — 1.5s crash flash"
```

---

## Task 10: shell/main.js — boot, scene wiring, state machine

**Goal:** The full game. Two scenes, one renderer, three states. Boot order matches the spec. Replaces the smoke-test shell.

**Files:**
- Modify: `shell/main.js` (full rewrite)

- [ ] **Step 1: Replace `shell/main.js` with the full shell**

```js
import { VERSION } from '../lib/version.js';
import { createTerrain } from '../lib/terrain/index.js';
import { PLANES } from '../lib/game/planes.js';
import { PlanePhysics, DragInput } from '../lib/plane/controller.js';
import { ChaseCamera } from '../lib/plane/camera.js';
import { crashed, clampToCeiling, CEILING } from '../lib/game/collision.js';
import { StateMachine } from '../lib/game/state.js';
import { buildMenu } from '../lib/ui/menu.js';
import { buildHUD } from '../lib/ui/hud.js';
import { buildCrashOverlay } from '../lib/ui/crash-overlay.js';

console.log('[flight-sim] ' + VERSION);

const THREE = window.THREE;
const canvas = document.getElementById('game');
const boot = document.getElementById('boot');
const uiRoot = document.getElementById('ui-root');

// --- localStorage keys ---
const LS_SEED  = 'flightsim.seed';
const LS_PLANE = 'flightsim.plane';
const LS_STYLE = 'flightsim.style';

function readOrMintSeed() {
  const cached = localStorage.getItem(LS_SEED);
  if (cached !== null) {
    const n = parseInt(cached, 10);
    if (Number.isFinite(n)) return n | 0;
  }
  const s = (Math.random() * 0xFFFFFFFF) | 0;
  localStorage.setItem(LS_SEED, String(s));
  return s;
}

const seed = readOrMintSeed();
let currentPlane = localStorage.getItem(LS_PLANE) || 'biplane';
let currentStyle = localStorage.getItem(LS_STYLE) || 'cartograph';

// --- Renderer (one, shared between scenes) ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !navigator.userAgent.match(/iPhone|Android|iPad/) });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- worldScene + chase camera ---
const worldScene = new THREE.Scene();
const worldCam = new THREE.PerspectiveCamera(60, 9/16, 1, 4500);
worldCam.rotation.order = 'YXZ';

// --- menuScene + its own camera + its own lights ---
const menuScene = new THREE.Scene();
menuScene.background = new THREE.Color(0x0a0e14);
menuScene.add(new THREE.HemisphereLight(0xcfd8e0, 0x202428, 0.8));
const menuSun = new THREE.DirectionalLight(0xffffff, 1.0);
menuSun.position.set(8, 12, 8);
menuScene.add(menuSun);
const menuCam = new THREE.PerspectiveCamera(30, 9/16, 0.1, 100);
menuCam.position.set(13, 5, 13);
menuCam.lookAt(0, 0.3, 0);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  worldCam.aspect = w / h; worldCam.updateProjectionMatrix();
  menuCam.aspect  = w / h; menuCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- worldScene contents (terrain + plane + chase + physics + input) ---
const terrain = createTerrain({ THREE, scene: worldScene, renderer, style: currentStyle, perfMode: 'high', seed });
// Spawn near the world origin; spawn altitude is 120m above ground.
const spawnPos = new THREE.Vector3(0, terrain.getHeight(0, 0) + 120, 0);

let worldPlaneMesh = null;
function setWorldPlane(key) {
  if (worldPlaneMesh) {
    worldPlaneMesh.traverse((n) => {
      if (n.isMesh) {
        n.geometry && n.geometry.dispose();
        if (n.material) {
          if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
          else n.material.dispose();
        }
      }
    });
    worldScene.remove(worldPlaneMesh);
  }
  worldPlaneMesh = PLANES[key].build(THREE);
  worldScene.add(worldPlaneMesh);
}
setWorldPlane(currentPlane);

let physics = new PlanePhysics(PLANES[currentPlane].stats);
function resetPhysicsToSpawn() {
  physics.x = spawnPos.x; physics.y = spawnPos.y; physics.z = spawnPos.z;
  physics.yaw = 0; physics.pitch = 0; physics.roll = 0;
  physics.speed = physics.cfg.maxSpeed;
  physics.fuel = physics.cfg.maxFuel;
  physics.engineOff = false;
  physics.fallSpeed = 0;
  physics.smoothedPitchRate = 0; physics.smoothedYawRate = 0;
}
resetPhysicsToSpawn();

const chase = new ChaseCamera(THREE, worldCam);
const input = new DragInput(canvas);

// --- Active scene selector — switched by state machine on enter ---
let activeScene = menuScene;
let activeCam = menuCam;

// --- Active UI slot ---
let activeUI = null;
function clearUI() { if (activeUI) { activeUI.dispose(); activeUI = null; } }

// Countdown so terrain finishes any tail-end streaming before plane moves
let flyingCountdown = 0;

// --- State machine ---
const sm = new StateMachine({
  initial: 'MENU',
  states: {
    MENU: {
      enter() {
        activeScene = menuScene; activeCam = menuCam;
        clearUI();
        activeUI = buildMenu({
          THREE, root: uiRoot, menuScene, version: VERSION,
          currentPlane, currentStyle,
          onPlaneChange: (key) => {
            if (key === currentPlane) return;
            currentPlane = key;
            localStorage.setItem(LS_PLANE, key);
            setWorldPlane(key);
            // Rebuild physics with the new plane's stats and reset pose
            physics = new PlanePhysics(PLANES[key].stats);
            resetPhysicsToSpawn();
          },
          onStyleChange: (style) => {
            currentStyle = style;
            localStorage.setItem(LS_STYLE, style);
            terrain.setStyle(style);
          },
          onPlay: () => sm.setState('FLYING'),
        });
      },
      update(dt) {
        // Keep terrain streaming around the spawn point so chunks are loaded
        // by the time the player taps FLY.
        terrain.update(spawnPos);
        // Rotate the turntable
        activeUI && activeUI.update && activeUI.update(dt);
      },
    },

    FLYING: {
      enter() {
        activeScene = worldScene; activeCam = worldCam;
        clearUI();
        resetPhysicsToSpawn();
        input.resetStick();
        // Reset the chase camera so it SNAPS to the new spawn pose instead of
        // lerping from wherever it ended last flight. ChaseCamera treats
        // _initialized=false as "snap on next update".
        chase._initialized = false;
        flyingCountdown = 1.5;
        activeUI = buildHUD({
          root: uiRoot, version: VERSION,
          onBack: () => sm.setState('MENU'),
        });
      },
      update(dt) {
        if (flyingCountdown > 0) {
          flyingCountdown -= dt;
          worldPlaneMesh.position.set(physics.x, physics.y, physics.z);
          worldPlaneMesh.rotation.set(physics.pitch, physics.yaw, physics.roll, 'YXZ');
          if (worldPlaneMesh.userData.propeller) worldPlaneMesh.userData.propeller.rotation.z += dt * 12;
          chase.update(physics, dt);
          terrain.update(worldCam.position);
          const alt = physics.y - terrain.getHeight(physics.x, physics.z);
          activeUI.update({ speed: 0, altitude: alt, countdown: flyingCountdown });
          return;
        }
        physics.update({ ...input.read(), dt });
        clampToCeiling(physics, CEILING);
        worldPlaneMesh.position.set(physics.x, physics.y, physics.z);
        worldPlaneMesh.rotation.set(physics.pitch, physics.yaw, physics.roll, 'YXZ');
        if (worldPlaneMesh.userData.propeller) worldPlaneMesh.userData.propeller.rotation.z += dt * physics.speed * 0.5;
        chase.update(physics, dt);
        terrain.update(worldCam.position);
        const alt = physics.y - terrain.getHeight(physics.x, physics.z);
        activeUI.update({ speed: physics.speed, altitude: alt });
        if (crashed(physics, terrain, physics.cfg.collisionRadius)) {
          sm.setState('CRASH');
        }
      },
    },

    CRASH: {
      enter() {
        activeScene = worldScene; activeCam = worldCam;
        clearUI();
        activeUI = buildCrashOverlay({
          root: uiRoot, durationMs: 1500,
          onComplete: () => sm.setState('MENU'),
        });
      },
      update() { /* frozen frame */ },
    },
  },
});

// --- Frame loop ---
let lastFrame = performance.now();
let bootHidden = false;
let paused = false;
let raf = 0;
function frame() {
  if (paused) return;
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  sm.update(dt);
  renderer.render(activeScene, activeCam);
  if (!bootHidden) { bootHidden = true; boot.classList.add('hidden'); setTimeout(() => boot.remove(), 600); }
  raf = requestAnimationFrame(frame);
}
sm.start();
raf = requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    paused = true;
    cancelAnimationFrame(raf);
  } else {
    paused = false;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }
});

requestAnimationFrame(() => {
  if (window.PlaySDK && window.PlaySDK.ready) window.PlaySDK.ready();
});
```

- [ ] **Step 2: Reload `localhost:8085` and verify the end-to-end flow**

Expected:
- Boot screen fades, menu appears with biplane spinning on turntable, version stamp visible.
- Cycle planes — turntable swaps to triplane, ww2, etc.
- Change style — dropdown updates; world re-palettes invisibly (you'll see it on next flight).
- Tap FLY — HUD appears, countdown 1, 0/GO!, then plane starts moving forward over the procedural world. Chase camera follows.
- Drag the screen — plane banks and pitches accordingly. WASD also works.
- Fly into a mountain or below the terrain — "✕ CRASHED" flashes for 1.5s, then back to menu.
- Tap the back arrow during flight — instant return to menu.
- Reload the page — same world (seed persisted). Same plane selected.

- [ ] **Step 3: Commit**

```bash
git add shell/main.js
git commit -m "feat: shell/main.js — boot, two-scene render, MENU/FLYING/CRASH state machine"
```

---

## Task 11: Capture thumbnail + finalize meta

**Goal:** Produce `thumbnail.png` from a real three.js render (per platform rule) and finalize `meta.json`.

**Files:**
- Create: `thumbnail.png`
- Create: `tools/screenshot.js` (helper script)

- [ ] **Step 1: Write a small screenshot script using the local puppeteer install**

Create `tools/screenshot.js`:

```js
// Captures thumbnail.png by loading the running dev server with ?screenshot=biplane
// (a flag we'll honor in main.js) so we get a clean menu shot of the biplane on
// the turntable. Run: `node tools/screenshot.js` while `npm run dev` is running.
//
// Uses the puppeteer install from a neighbor JSGames project so we don't bloat
// this repo's devDeps for a one-off capture.
const puppeteer = require('/Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/node_modules/puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:8085';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  // Let the turntable spin a beat so we get a flattering 3/4 angle
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: 'thumbnail.png', clip: { x: 0, y: 0, width: 540, height: 960 } });
  await browser.close();
  console.log('thumbnail.png saved');
})();
```

- [ ] **Step 2: Run the dev server in one terminal**

Run: `npm run dev`

- [ ] **Step 3: Capture the thumbnail in another terminal**

Run: `node tools/screenshot.js`
Expected: `thumbnail.png` exists at the repo root, ~540×960, shows the menu with the biplane on the turntable.

- [ ] **Step 4: Inspect the thumbnail**

Open `thumbnail.png`. If the framing is bad (plane too tilted, ugly angle), rerun until you get one you like.

- [ ] **Step 5: Commit**

```bash
git add thumbnail.png tools/screenshot.js
git commit -m "feat: thumbnail.png captured from real three.js menu render"
```

---

## Task 12: Full test pass + sanity check

**Goal:** Confirm everything is green before we call it done.

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All 3 test files pass (state + planes + collision), no failures.

- [ ] **Step 2: Smoke-test the build in a private browser window**

Open `http://localhost:8085` in a private window (so localStorage is empty).

Verify:
- Fresh boot mints a new seed (you can see it in `localStorage.getItem('flightsim.seed')` via devtools console).
- Menu → fly → crash → menu loop works end-to-end.
- Console has only the `[flight-sim] v0.1.0` log line, no errors.
- HUD shows correct speed/altitude during flight.

- [ ] **Step 3: Verify version bump rule**

Confirm `lib/version.js` has been bumped at least once during this work and matches `package.json`. Per platform rule: every commit bumps the version.

- [ ] **Step 4: Final commit (if any pending changes)**

If there are no pending changes, skip. Otherwise:

```bash
git add -A
git commit -m "chore: final pass — tests green, manual smoke test passes"
```

- [ ] **Step 5: Print the git log to confirm the trajectory**

Run: `git log --oneline`
Expected: A clean linear history from "initial design spec" through all twelve task commits.

---

## Out of scope for this plan

These are explicitly NOT done in this plan (deferred per spec):
- Plane unlocks, coins, economy, save sync.
- Audio (engine, wind).
- Runway takeoff or landing.
- Cockpit / cinematic camera modes.
- Multiplayer, leaderboards, POIs, mission map.
- Deploy to the platform (handled separately via `./scripts/deploy-game.sh` from the GamesPlatform repo once the game is ready).

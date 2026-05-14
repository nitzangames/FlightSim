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
import { biomeAt, BIOMES } from '../lib/game/biomes.js';
import { buildScatterRegistry } from '../lib/scatter/index.js';

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
const scatterGeometries = buildScatterRegistry(THREE);
const terrain = createTerrain({
  THREE, scene: worldScene, renderer,
  style: currentStyle, perfMode: 'high', seed,
  biomeAt,
  scatterGeometries,
});
// Spawn near the world origin; spawn altitude is 120m above ground.
const spawnPos = new THREE.Vector3(0, terrain.getHeight(0, 0) + 120, 0);

// --- Biome atmosphere: ensure fog + background exist for lerping ---
const forest = BIOMES.find(b => b.name === 'forest');
if (!worldScene.background) worldScene.background = new THREE.Color(forest.sky[0], forest.sky[1], forest.sky[2]);
if (!worldScene.fog) worldScene.fog = new THREE.Fog(
  new THREE.Color(forest.fog[0], forest.fog[1], forest.fog[2]),
  forest.fogNear, forest.fogFar,
);

// Reusable Color instances so applyBiome doesn't allocate per frame.
const _biomeSky  = new THREE.Color();
const _biomeFog  = new THREE.Color();
const _biomeSun  = new THREE.Color();
const _biomeHemS = new THREE.Color();
const _biomeHemG = new THREE.Color();

// Per-frame palette interpolation toward the biome at the plane's position.
// LERP rate ~0.02 → palette catches up to a new biome over ~1-2 seconds.
const BIOME_LERP = 0.02;
function lerp(a, b, t) { return a + (b - a) * t; }
function applyBiome(planeX, planeZ) {
  const b = biomeAt(planeX, planeZ);
  if (!worldScene.fog || !terrain.sun || !terrain.hemi) return;
  // Sky/background
  _biomeSky.setRGB(b.sky[0], b.sky[1], b.sky[2]);
  worldScene.background.lerp(_biomeSky, BIOME_LERP);
  // Fog
  _biomeFog.setRGB(b.fog[0], b.fog[1], b.fog[2]);
  worldScene.fog.color.lerp(_biomeFog, BIOME_LERP);
  worldScene.fog.near = lerp(worldScene.fog.near, b.fogNear, BIOME_LERP);
  worldScene.fog.far  = lerp(worldScene.fog.far,  b.fogFar,  BIOME_LERP);
  // Sun
  _biomeSun.setRGB(b.sun[0], b.sun[1], b.sun[2]);
  terrain.sun.color.lerp(_biomeSun, BIOME_LERP);
  // Hemi
  _biomeHemS.setRGB(b.hemiSky[0], b.hemiSky[1], b.hemiSky[2]);
  _biomeHemG.setRGB(b.hemiGround[0], b.hemiGround[1], b.hemiGround[2]);
  terrain.hemi.color.lerp(_biomeHemS, BIOME_LERP);
  terrain.hemi.groundColor.lerp(_biomeHemG, BIOME_LERP);
  terrain.hemi.intensity = lerp(terrain.hemi.intensity, b.hemiIntensity, BIOME_LERP);
}

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
  // Identity quaternion: nose at -Z, wings level.
  physics.quat.x = 0; physics.quat.y = 0; physics.quat.z = 0; physics.quat.w = 1;
  physics.forward.x = 0; physics.forward.y = 0; physics.forward.z = -1;
  physics.up.x = 0; physics.up.y = 1; physics.up.z = 0;
  physics.speed = physics.cfg.maxSpeed;
  physics.fuel = physics.cfg.maxFuel;
  physics.engineOff = false;
  physics.fallSpeed = 0;
  physics.smoothedPitchRate = 0; physics.smoothedRollRate = 0;
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
        // Use spawn position for the MENU palette so the picker shows the biome
        // the player will spawn into.
        applyBiome(spawnPos.x, spawnPos.z);
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
          worldPlaneMesh.quaternion.set(physics.quat.x, physics.quat.y, physics.quat.z, physics.quat.w);
          if (worldPlaneMesh.userData.propeller) worldPlaneMesh.userData.propeller.rotation.z += dt * 12;
          chase.update(physics, dt);
          terrain.update(worldCam.position);
          applyBiome(physics.x, physics.z);
          const alt = physics.y - terrain.getHeight(physics.x, physics.z);
          activeUI.update({ speed: 0, altitude: alt, countdown: flyingCountdown });
          return;
        }
        physics.update({ ...input.read(), dt });
        clampToCeiling(physics, CEILING);
        worldPlaneMesh.position.set(physics.x, physics.y, physics.z);
        worldPlaneMesh.quaternion.set(physics.quat.x, physics.quat.y, physics.quat.z, physics.quat.w);
        if (worldPlaneMesh.userData.propeller) worldPlaneMesh.userData.propeller.rotation.z += dt * physics.speed * 0.5;
        chase.update(physics, dt);
        terrain.update(worldCam.position);
        applyBiome(physics.x, physics.z);
        const alt = physics.y - terrain.getHeight(physics.x, physics.z);
        // Pass the still-decrementing countdown so the HUD can flash "GO!" for
        // the ~0.4s after the 3/2/1 sequence ends.
        activeUI.update({ speed: physics.speed, altitude: alt, countdown: flyingCountdown });
        flyingCountdown -= dt;
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
  // PlaySDK uses a Proxy that throws on unknown property access; calling
  // .onReady(cb) is the actual ready-signal API.
  if (window.PlaySDK && typeof window.PlaySDK.onReady === 'function') {
    window.PlaySDK.onReady(() => {});
  }
});

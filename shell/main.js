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
const currentStyle = 'cartograph';

// --- Renderer (one, shared between scenes) ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !navigator.userAgent.match(/iPhone|Android|iPad/) });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- worldScene + chase camera ---
const worldScene = new THREE.Scene();
const worldCam = new THREE.PerspectiveCamera(60, 9/16, 1, 8000);
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
// Spawn well above the tallest realistic peaks (arctic can reach ~700m)
const spawnPos = new THREE.Vector3(0, terrain.getHeight(0, 0) + 500, 0);

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

// In-flight plane scale. Plane meshes are built at real-world size (biplane
// 7.4m wingspan etc.) for the menu turntable, but in-world they're scaled
// down so they read as a small craft against the big terrain. Collision
// radius is scaled with the mesh so crashes line up with what's drawn.
const WORLD_PLANE_SCALE = 0.875;   // 3.5× the previous 0.25 — larger, more readable plane in the world

let worldPlaneMesh = null;

// --- Ground shadow ---
// Simple dark disk projected straight down to terrain height. Always
// horizontal (does not roll/pitch with the plane), sized to cover the
// largest in-flight plane silhouette. Fades with altitude so a high-flying
// plane has no visible shadow.
const SHADOW_RADIUS = 14.0;   // covers the largest plane wingspan at WORLD_PLANE_SCALE=0.875
const SHADOW_FADE_LOW  = 5;     // below this altitude (m AGL): full opacity
const SHADOW_FADE_HIGH = 250;   // above this: invisible
const shadowGeom = new THREE.CircleGeometry(SHADOW_RADIUS, 24);
shadowGeom.rotateX(-Math.PI / 2);  // lie flat on XZ plane
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.4,
  depthWrite: false,
});
const planeShadow = new THREE.Mesh(shadowGeom, shadowMat);
planeShadow.renderOrder = 1;
worldScene.add(planeShadow);

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
  worldPlaneMesh.scale.setScalar(WORLD_PLANE_SCALE);
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

// Update the ground shadow to sit at terrain height directly below the
// plane, fading with altitude. Called every flight frame.
function updatePlaneShadow() {
  const groundY = terrain.getHeight(physics.x, physics.z);
  planeShadow.position.set(physics.x, groundY + 0.2, physics.z);
  const alt = physics.y - groundY;
  // Linear fade from full opacity at low altitude to zero at SHADOW_FADE_HIGH.
  let a = 1;
  if (alt > SHADOW_FADE_LOW) {
    a = 1 - (alt - SHADOW_FADE_LOW) / (SHADOW_FADE_HIGH - SHADOW_FADE_LOW);
    if (a < 0) a = 0;
  }
  planeShadow.material.opacity = 0.45 * a;
  planeShadow.visible = a > 0.01;
}

// HUD nav helper: nearest village direction relative to plane heading.
// Returns { villageBearing, villageDistance } where bearing is radians from
// straight-ahead (0 = ahead, +π/2 = right, -π/2 = left). Empty object when
// the registry has no villages so the HUD hides the marker.
function computeVillageNav(terrain, physics) {
  if (!terrain.nearestVillage) return {};
  const nv = terrain.nearestVillage(physics.x, physics.z);
  if (!nv) return {};
  const dx = nv.x - physics.x;
  const dz = nv.z - physics.z;
  // World bearing convention: 0 when target is along the plane's spawn-forward
  // axis (−Z). atan2(dx, −dz) maps +X to +π/2 so a village on the right reads
  // as a +π/2 rotation, which matches CSS rotate() (CW positive).
  const villageWorldBearing = Math.atan2(dx, -dz);
  const planeHeading = Math.atan2(physics.forward.x, -physics.forward.z);
  let bearing = villageWorldBearing - planeHeading;
  // Normalize to (-π, π]
  while (bearing > Math.PI)  bearing -= 2 * Math.PI;
  while (bearing <= -Math.PI) bearing += 2 * Math.PI;
  return { villageBearing: bearing, villageDistance: nv.distance };
}

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
          currentPlane,
          onPlaneChange: (key) => {
            if (key === currentPlane) return;
            currentPlane = key;
            localStorage.setItem(LS_PLANE, key);
            setWorldPlane(key);
            // Rebuild physics with the new plane's stats and reset pose
            physics = new PlanePhysics(PLANES[key].stats);
            resetPhysicsToSpawn();
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
          // Pass dt=0 so the chase camera's velocity feedforward is zeroed.
          // The plane isn't being physically advanced during the countdown
          // (physics.update is skipped), but physics.speed still reads maxSpeed
          // from resetPhysicsToSpawn — without this, the lead term parks the
          // camera ~speed*dt*LEAD_FRAMES forward of where it sits in flight,
          // and jitters with dt variance.
          chase.update(physics, 0);
          terrain.update(worldCam.position);
          applyBiome(physics.x, physics.z);
          updatePlaneShadow();
          const alt = physics.y - terrain.getHeight(physics.x, physics.z);
          const vNav = computeVillageNav(terrain, physics);
          activeUI.update({ speed: 0, altitude: alt, countdown: flyingCountdown, ...vNav });
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
        updatePlaneShadow();
        const alt = physics.y - terrain.getHeight(physics.x, physics.z);
        // Pass the still-decrementing countdown so the HUD can flash "GO!" for
        // the ~0.4s after the 3/2/1 sequence ends.
        const vNav = computeVillageNav(terrain, physics);
        activeUI.update({ speed: physics.speed, altitude: alt, countdown: flyingCountdown, stalling: physics.stalling, ...vNav });
        flyingCountdown -= dt;
        if (crashed(physics, terrain, physics.cfg.collisionRadius * WORLD_PLANE_SCALE)) {
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

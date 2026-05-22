import { VERSION } from '../lib/version.js';
import { createTerrain } from '../lib/terrain/index.js';
import { PLANES } from '../lib/game/planes.js';
import { PlanePhysics, DragInput } from '../lib/plane/controller.js';
import { ChaseCamera } from '../lib/plane/camera.js';
import { ScoreTracker } from '../lib/game/score.js';
import { WingContrail } from '../lib/plane/contrails.js';
import { FlameCone }    from '../lib/plane/flame-cone.js';
import { PlaneShadow }  from '../lib/plane/shadow.js';
import { loadLastVisitPos } from '../lib/poi/markers.js';
import { crashed, clampToCeiling, CEILING } from '../lib/game/collision.js';
import { StateMachine } from '../lib/game/state.js';
import { buildMenu } from '../lib/ui/menu.js';
import { buildHUD } from '../lib/ui/hud.js';
import { buildCrashOverlay } from '../lib/ui/crash-overlay.js';
import { biomeAt, biomeDominanceAt, BIOMES } from '../lib/game/biomes.js';
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

// Loading-screen helpers: setBootPhase updates the small grey caption under
// the spinner; yieldPaint waits for two animation frames so the browser
// actually paints the new caption before the next synchronous-heavy phase
// blocks the thread. Top-level await is fine inside a <script type="module">.
const bootPhaseEl = boot && boot.querySelector('.boot-phase');
function setBootPhase(text) { if (bootPhaseEl) bootPhaseEl.textContent = text; }
const yieldPaint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

setBootPhase('Generating world…');
await yieldPaint();

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
// Per-plane silhouette tessellated into a ground-conforming grid (see
// lib/plane/shadow.js). Drapes over terrain via per-vertex heightfield
// samples each frame, so the shadow follows hills instead of clipping
// or floating like a flat disk would.
const planeShadow = new PlaneShadow(THREE, worldScene);

// Per-plane wingtip offsets in plane-local coords (+X right, -X left,
// +Y up, -Z forward). One contrail spawns per entry. Planes not listed
// fall back to a generic two-tip layout at (±collisionRadius, 0, 0).
// Positions are the visible mid-outboard edge of the wing for swept-wing
// jets — not the plane's center-of-fuselage Z, which is what the fallback
// computes; with sweep the actual wingtip ends up significantly behind
// the plane's longitudinal centre, so contrails from the fallback emit
// well in front of where the wing edge actually is.
const PLANE_CONTRAIL_TIPS = {
  biplane: [
    { x: -3.5, y: -0.25, z: -1.20 }, { x:  3.5, y: -0.25, z: -1.20 },  // lower wing
    { x: -3.7, y:  1.10, z: -1.50 }, { x:  3.7, y:  1.10, z: -1.50 },  // upper wing
  ],
  triplane: [
    { x: -3.0, y:  1.50, z: -1.10 }, { x:  3.0, y:  1.50, z: -1.10 },  // top wing
    { x: -3.0, y:  0.55, z: -1.05 }, { x:  3.0, y:  0.55, z: -1.05 },  // middle wing
    { x: -2.8, y: -0.40, z: -1.00 }, { x:  2.8, y: -0.40, z: -1.00 },  // bottom wing
  ],
  // P-51's wing is a flat 11 m rectangle at mesh-Y -0.25 and Z -0.5; no
  // sweep, so the tip is just the outboard mid-chord.
  p51: [
    { x: -5.5, y: -0.25, z: -0.50 }, { x: 5.5, y: -0.25, z: -0.50 },
  ],
  // A-10's wings are 17 m straight rectangles; tips at ±8.5 outboard.
  a10: [
    { x: -8.5, y: -0.20, z: -0.40 }, { x: 8.5, y: -0.20, z: -0.40 },
  ],
  // F-4 outer panels have dihedral, so the wingtip sits 0.47 m above the
  // wing root. Mid-outboard of the outer panel after the ZYX rotation:
  // ±4.40 m outboard, 0.95 m behind plane centre, 0.47 m up.
  f4: [
    { x: -4.40, y: 0.47, z: 0.95 }, { x: 4.40, y: 0.47, z: 0.95 },
  ],
  // F-16's cropped delta sweeps back; outboard edge midpoint is ~1.8 m
  // behind centre, ±4.6 m outboard.
  f16: [
    { x: -4.6, y: -0.10, z: 1.80 }, { x: 4.6, y: -0.10, z: 1.80 },
  ],
  // F-18's wing sweeps 28°; outboard edge midpoint is ~1.83 m behind centre,
  // ±4.42 m outboard (BoxGeometry 4.8 × 3.0 at ±2.3 mesh-X after rotation).
  f18: [
    { x: -4.42, y: -0.05, z: 1.83 }, { x: 4.42, y: -0.05, z: 1.83 },
  ],
  // SR-71's delta wing sweeps deep back so the tip is far aft: shape tip
  // (5.6, -5.5) lands at world (±5.6, -0.25, 5.5) — near the tail.
  sr71: [
    { x: -5.6, y: -0.25, z: 5.50 }, { x: 5.6, y: -0.25, z: 5.50 },
  ],
};
function getContrailTips(planeKey) {
  if (PLANE_CONTRAIL_TIPS[planeKey]) return PLANE_CONTRAIL_TIPS[planeKey];
  const r = PLANES[planeKey].stats.collisionRadius;
  return [{ x: -r, y: 0, z: 0 }, { x: r, y: 0, z: 0 }];
}

// Active contrails: rebuilt on every plane change so a biplane gets 4 ribbons,
// a triplane 6, every other plane 2. Each entry pairs the WingContrail mesh
// with the local (x,y,z) wingtip offset to sample each frame.
const contrails = [];
function rebuildContrailsFor(key) {
  for (const c of contrails) c.contrail.dispose();
  contrails.length = 0;
  for (const tip of getContrailTips(key)) {
    contrails.push({ tip, contrail: new WingContrail(THREE, worldScene) });
  }
}

// Engine nozzle positions for jet aircraft only. Coordinates from each
// plane's mesh code: nozzles sit at +Z (rear) of the fuselage. Propeller
// planes (biplane / triplane / ww2 / p51) are absent — they get no exhaust.
// A-10 also omitted: its high-bypass turbofans don't show flame in real
// life, and a glow plume on a low-and-slow CAS plane would look wrong.
const PLANE_JET_NOZZLES = {
  f86:  [{ x:  0.0,  y:  0.00, z: 4.4 }],
  f4:   [{ x: -0.42, y: -0.05, z: 5.05 }, { x: 0.42, y: -0.05, z: 5.05 }],
  f16:  [{ x:  0.0,  y:  0.00, z: 4.4 }],
  f18:  [{ x: -0.35, y: -0.05, z: 4.4 }, { x: 0.35, y: -0.05, z: 4.4 }],
  f15:  [{ x: -0.4,  y: -0.05, z: 5.0 }, { x: 0.4,  y: -0.05, z: 5.0 }],
  f22:  [{ x: -0.4,  y: -0.10, z: 4.7 }, { x: 0.4,  y: -0.10, z: 4.7 }],
  // SR-71 nozzles sit at the back of each engine nacelle — outboard and
  // far aft compared to a normal fighter.
  sr71: [{ x: -2.3, y: -0.20, z: 6.3 }, { x: 2.3, y: -0.20, z: 6.3 }],
};
// Flame cones attach to the WORLD PLANE MESH (not the scene), so they
// inherit its rotation and 0.875× scale and don't need per-frame world
// transform math — the local position is just the nozzle offset.
const flameCones = [];
function rebuildJetExhaustsFor(key) {
  for (const f of flameCones) f.dispose();
  flameCones.length = 0;
  const nozzles = PLANE_JET_NOZZLES[key];
  if (!nozzles) return;
  for (const nozzle of nozzles) {
    const cone = new FlameCone(THREE, worldPlaneMesh);
    cone.setLocalPosition(nozzle.x, nozzle.y, nozzle.z);
    flameCones.push(cone);
  }
}

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
  rebuildContrailsFor(key);
  rebuildJetExhaustsFor(key);
  planeShadow.setScale(PLANES[key].stats.collisionRadius);
}
setWorldPlane(currentPlane);

// Scratch vector for per-frame contrail/nozzle world-position math.
const _tmpWingtip = new THREE.Vector3();
function computeTipWorld(tip) {
  _tmpWingtip.set(
    tip.x * WORLD_PLANE_SCALE,
    tip.y * WORLD_PLANE_SCALE,
    tip.z * WORLD_PLANE_SCALE,
  );
  _tmpWingtip.applyQuaternion(physics.quat);
  _tmpWingtip.x += physics.x;
  _tmpWingtip.y += physics.y;
  _tmpWingtip.z += physics.z;
  return _tmpWingtip;
}

let physics = new PlanePhysics(PLANES[currentPlane].stats);
// Decide where to drop the plane on respawn / launch. If the player has
// flown through any POI this session, spawn ~500 m above that POI's ground
// so they continue exploring from there; otherwise fall back to the world
// origin spawn computed at module load.
function computeSpawn() {
  const last = loadLastVisitPos();
  if (last) {
    return {
      x: last.x,
      y: terrain.getHeight(last.x, last.z) + 500,
      z: last.z,
    };
  }
  return { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };
}
function resetPhysicsToSpawn() {
  const s = computeSpawn();
  physics.x = s.x; physics.y = s.y; physics.z = s.z;
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

// Trick-based score system. Persistent stars (★) + loop / barrel-roll /
// inverted / low-altitude bonuses (see lib/game/score.js). One tracker
// for the whole session.
const scoreTracker = new ScoreTracker();

// --- Active scene selector — switched by state machine on enter ---
let activeScene = menuScene;
let activeCam = menuCam;

// --- Active UI slot ---
let activeUI = null;
function clearUI() { if (activeUI) { activeUI.dispose(); activeUI = null; } }

// Countdown so terrain finishes any tail-end streaming before plane moves
let flyingCountdown = 0;

// Update the ground shadow each flight frame. PlaneShadow handles the
// per-vertex height sampling, yaw orientation, and altitude fade internally.
function updatePlaneShadow() {
  planeShadow.update(physics, terrain);
}

// HUD nav helper: nearest village direction relative to plane heading.
// Returns { villageBearing, villageDistance, villageType } where bearing is
// radians from straight-ahead (0 = ahead, +π/2 = right, -π/2 = left) and
// villageType is the POI templateKey ('forest' | 'castle' | 'monastery' |
// 'town' | …) so the HUD can label it correctly. Empty object when the
// registry has no villages so the HUD hides the marker.
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
  const villageVisited = !!(terrain.markers && terrain.markers.isVisited(`v:${nv.id}`));
  return {
    villageBearing: bearing,
    villageDistance: nv.distance,
    villageType: nv.templateKey,
    villageVisited,
  };
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
        // Same idea for contrails: drop the old ring-buffer so the trail
        // doesn't draw a long streak from the previous crash location to
        // the new spawn position. Flame cones are attached to the plane
        // mesh so they teleport with it and need no reset.
        for (const c of contrails) c.contrail.reset();
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
        // Contrails: update AFTER chase.update so the camera is already at
        // its new pose for this frame, otherwise the billboard direction
        // lags one frame behind the visible camera.
        for (const c of contrails) c.contrail.update(computeTipWorld(c.tip), worldCam);
        // Flame cones are attached to the plane mesh, so all we drive each
        // frame is the shader's time uniform (pulse along the cone axis).
        if (flameCones.length) {
          const tSec = performance.now() / 1000;
          for (const f of flameCones) f.update(tSec);
        }
        if (terrain.markers) terrain.markers.update(physics, dt);
        const alt = physics.y - terrain.getHeight(physics.x, physics.z);
        // Pass the still-decrementing countdown so the HUD can flash "GO!" for
        // the ~0.4s after the 3/2/1 sequence ends.
        const vNav = computeVillageNav(terrain, physics);
        const flash = terrain.markers ? terrain.markers.consumeFlash() : null;
        const score = scoreTracker.update(physics, terrain, dt);
        // Minimap data: every visited landmark's xz + type, plus the
        // plane's xz and heading. The HUD does the drawing.
        const visitedPois = [];
        if (terrain.markers) {
          for (const m of terrain.markers.markers) {
            if (!m.visited) continue;
            const lm = m.landmark;
            // landmark.id is `v:<num>` — pull the village by index so we
            // can report templateKey for colour coding.
            const v = terrain.villageRegistry.all[parseInt(lm.id.slice(2), 10)];
            visitedPois.push({ x: lm.x, z: lm.z, type: v ? v.templateKey : 'village' });
          }
        }
        const planeHeading = Math.atan2(physics.forward.x, -physics.forward.z);
        // Report the biome at the chunk's CENTRE (same lookup the scatter
        // system uses to pick trees) rather than the plane's exact xz. At
        // a biome boundary the chunk-centre biome is what determines the
        // trees + dominant ground colour the pilot actually sees; the
        // plane's exact-xz biome could differ from one to the next as you
        // taxi across the boundary line, which read as "the HUD is lying".
        const CHUNK_SIZE = 256;
        const cx = Math.floor(physics.x / CHUNK_SIZE);
        const cz = Math.floor(physics.z / CHUNK_SIZE);
        const chunkCenterX = (cx + 0.5) * CHUNK_SIZE;
        const chunkCenterZ = (cz + 0.5) * CHUNK_SIZE;
        const currentBiome = biomeAt(chunkCenterX, chunkCenterZ);
        const exactBiome   = biomeAt(physics.x, physics.z);
        // Dominance: how "pure" the chunk's biome blend is. < 85% is the
        // transition zone where scatter is suppressed (see chunk-manager
        // SCATTER_DOMINANCE_THRESHOLD). Annotated in the label so you can
        // tell when you're in a no-tree zone vs a pure-biome interior.
        const dom = biomeDominanceAt(chunkCenterX, chunkCenterZ);
        const domPct = Math.round(dom.weight * 100);
        const baseLabel = (exactBiome.name === currentBiome.name)
          ? currentBiome.name
          : `${currentBiome.name} / ${exactBiome.name}`;
        const biomeLabel = `${baseLabel} ${domPct}%`;
        activeUI.update({
          speed: physics.speed,
          altitude: alt,
          countdown: flyingCountdown,
          stalling: physics.stalling,
          visitedCount: terrain.markers ? terrain.markers.visitedCount : 0,
          visitedTotal: terrain.markers ? terrain.markers.total : 0,
          flashT: flash ? flash.t : 0,
          stars: score.stars,
          bonuses: score.bonuses,
          trickFlash: score.flash,
          biome: biomeLabel,
          planeX: physics.x,
          planeZ: physics.z,
          heading: planeHeading,
          visitedPois,
          ...vNav,
        });
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
setBootPhase('Starting…');
await yieldPaint();
sm.start();
raf = requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    paused = true;
    cancelAnimationFrame(raf);
    // Tab-hide may precede a kill; flush score now so the last few
    // seconds of earnings aren't lost.
    scoreTracker.saveNow();
  } else {
    paused = false;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }
});
// Also flush on full page unload (closing the tab without backgrounding).
window.addEventListener('pagehide', () => scoreTracker.saveNow());

requestAnimationFrame(() => {
  // PlaySDK uses a Proxy that throws on unknown property access; calling
  // .onReady(cb) is the actual ready-signal API.
  if (window.PlaySDK && typeof window.PlaySDK.onReady === 'function') {
    window.PlaySDK.onReady(() => {});
  }
});

import { VERSION } from '../lib/version.js';
import { createTerrain } from '../lib/terrain/index.js';
import { PLANES } from '../lib/game/planes.js';
import { PlanePhysics, DragInput } from '../lib/plane/controller.js';
import { ChaseCamera } from '../lib/plane/camera.js';
import { ScoreTracker, loadStars } from '../lib/game/score.js';
import { UnlockState, loadUnlocked }  from '../lib/game/unlocks.js';
import { loadKey, saveKey } from '../lib/game/storage.js';
import { loadSettings, getSettings } from '../lib/game/settings.js';
import { RemotePlayers } from '../lib/multiplayer/remote-players.js';
import { WingContrail } from '../lib/plane/contrails.js';
import { FlameCone }    from '../lib/plane/flame-cone.js';
import { PlaneShadow }  from '../lib/plane/shadow.js';
import { CrashDebris }  from '../lib/plane/crash-debris.js';
import { loadLastVisitPos, initLastVisitPos, loadVisited } from '../lib/poi/markers.js';
import { crashed, clampToCeiling, CEILING } from '../lib/game/collision.js';
import { StateMachine } from '../lib/game/state.js';
import { buildMenu } from '../lib/ui/menu.js';
import { buildHUD } from '../lib/ui/hud.js';
import { buildSettingsPanel } from '../lib/ui/settings-panel.js';
import { buildCrashOverlay } from '../lib/ui/crash-overlay.js';
import { biomeAt, biomeDominanceAt, BIOMES } from '../lib/game/biomes.js';
import { buildScatterRegistry } from '../lib/scatter/index.js';

console.log('[flight-sim] ' + VERSION);

const THREE = window.THREE;
const canvas = document.getElementById('game');
const boot = document.getElementById('boot');
const uiRoot = document.getElementById('ui-root');

// --- localStorage keys ---
const LS_PLANE = 'flightsim.plane';

// Shared world seed — every player generates the same procedural terrain
// + POI layout so multiplayer presence is meaningful (you and another
// pilot fly over the same villages, can rendezvous at the same castle).
// The actual integer is arbitrary; picked once and frozen — changing it
// would re-shuffle everyone's world and invalidate any landmark a player
// has memorised. The old per-player `flightsim.seed` localStorage entry
// is intentionally ignored; it can stay in storage harmlessly.
const seed = 0x46534D31;

// Preload all persistent save state via the storage helper BEFORE constructing
// anything that depends on it. On nitzan.games the game runs in a sandboxed
// cross-origin iframe whose localStorage iOS Safari evicts between launches;
// PlaySDK.load (awaited here) pulls signed-in users' progress from the cloud
// so it survives that eviction. Anonymous users still rely on localStorage.
const [
  initialStars,
  initialUnlocked,
  initialVisited,
  savedPlane,
] = await Promise.all([
  loadStars(),
  loadUnlocked(),
  loadVisited(),
  loadKey(LS_PLANE),
  initLastVisitPos(),
  loadSettings(),
]);

const unlockState = new UnlockState(initialUnlocked);
// Defensive: if the saved plane key is corrupt or refers to a plane that
// hasn't been unlocked yet (e.g., player cleared unlock storage but kept
// the selection), fall back to the always-free biplane so the player
// always boots into something they can actually fly.
let currentPlane = savedPlane || 'biplane';
if (!PLANES[currentPlane] || !unlockState.isUnlocked(currentPlane)) {
  currentPlane = 'biplane';
}
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
menuCam.position.set(32.5, 12.5, 32.5);
// lookAt below the plane center (which sits around y=0.5) tilts the
// camera upward so the plane visual sits in the upper half of the screen.
// This frees space below for the name + stats + FLY button to spread
// without crowding into the plane preview.
menuCam.lookAt(0, -3.0, 0);

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
  visited: initialVisited,
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
  // Biplane (Fairey Flycatcher rebuild): racetrack wings, span 8.5 lower,
  // 9.0 upper. Tip mid-chord at world (±halfSpan, position.y+thickness/2,
  // position.z).
  biplane: [
    { x: -4.25, y: -0.25, z: -1.20 }, { x:  4.25, y: -0.25, z: -1.20 },  // lower wing (span 8.5)
    { x: -4.50, y:  1.10, z: -1.50 }, { x:  4.50, y:  1.10, z: -1.50 },  // upper wing (span 9.0)
  ],
  // Triplane (Fokker Dr.I rebuild): racetrack wings, spans 7.0 top, 6.8
  // mid, 6.4 bot. Tip mid-chord at world (±halfSpan, position.y+0.08, position.z).
  triplane: [
    { x: -3.50, y:  1.58, z: -1.10 }, { x:  3.50, y:  1.58, z: -1.10 },  // top wing
    { x: -3.40, y:  0.63, z: -1.05 }, { x:  3.40, y:  0.63, z: -1.05 },  // middle wing
    { x: -3.20, y: -0.40, z: -1.00 }, { x:  3.20, y: -0.40, z: -1.00 },  // bottom wing
  ],
  // Spitfire's elliptical wing: SPAN=11 → tips at ±5.5. Wing shape is
  // built in XY then rotated -π/2 around X and translated by (0,-0.45,-1.3),
  // so the wingtip (shape-Y=0 at the spanwise extremes) lands at mesh
  // (±5.5, -0.35, -1.30) — mid-thickness, on the wing's spanwise axis.
  ww2: [
    { x: -5.5, y: -0.35, z: -1.30 }, { x: 5.5, y: -0.35, z: -1.30 },
  ],
  // P-51's wing is a flat 11 m rectangle. After the rebuild the wing
  // sits forward at position (0, -0.45, -1.80) with extrude depth 0.20
  // → mid-thickness world Y = -0.35.
  p51: [
    { x: -5.5, y: -0.35, z: -1.80 }, { x: 5.5, y: -0.35, z: -1.80 },
  ],
  // A-10's wings are 17 m straight rectangles at world Y=-0.30 (rebuilt
  // BoxGeometry, was -0.20). Tips at ±8.5 outboard, mid-thickness Y -0.30.
  a10: [
    { x: -8.5, y: -0.30, z: -0.40 }, { x: 8.5, y: -0.30, z: -0.40 },
  ],
  // F-86's wing sweeps 35° back, so the tip is ~1.9 m aft of the wing-center
  // Z. Wing position (0, -0.25, -0.5), extrude depth 0.18 → mid-thickness
  // world Y -0.16. SEMI_SPAN 3.8, tip mid-chord shape-Y -1.91 → world Z 1.41.
  f86: [
    { x: -3.8, y: -0.16, z: 1.41 }, { x: 3.8, y: -0.16, z: 1.41 },
  ],
  // F-4 outer panel: shape +Y → world -Z (forward) after Rx(-π/2), then
  // Rz(±0.21) rotates shape +X partly into +Y (lifts the tip ~12°).
  // Tip mid-chord local (3.6, -2.625, 0.09) → world (±6.17, +0.34, +1.58).
  f4: [
    { x: -6.17, y: 0.34, z: 1.58 }, { x: 6.17, y: 0.34, z: 1.58 },
  ],
  // F-16's cropped delta wing tip shape midpoint at (X=4.6, Y=-1.0) in
  // local shape coords; after Rx(-π/2) and position.y=-0.05 with extrude
  // depth 0.16 (mid-thickness), world = (±4.6, +0.03, +1.0).
  f16: [
    { x: -4.6, y: 0.03, z: 1.00 }, { x: 4.6, y: 0.03, z: 1.00 },
  ],
  // F-18's wing sweeps 28°; outboard edge midpoint is ~1.83 m behind centre,
  // ±4.42 m outboard (BoxGeometry 4.8 × 3.0 at ±2.3 mesh-X after rotation).
  f18: [
    { x: -4.42, y: -0.05, z: 1.83 }, { x: 4.42, y: -0.05, z: 1.83 },
  ],
  // F-15's wing sweeps 22°; BoxGeometry 5.5 × 3.2 at ±3.0 mesh-X. After
  // Ry(-22°), tip outboard edge midpoint at world (±5.55, -0.05, +1.53).
  f15: [
    { x: -5.55, y: -0.05, z: 1.53 }, { x: 5.55, y: -0.05, z: 1.53 },
  ],
  // F-22's wing is a scaled delta (scale 1.25× on X+Y). Tip shape vertex
  // at (3.6, 0.25) scales to (4.5, 0.3125), then Rx(-π/2) and translation
  // give world tip (±4.50, -0.10, +0.09). Generic fallback (±6.8, 0, 0)
  // is way off.
  f22: [
    { x: -4.50, y: -0.10, z: 0.09 }, { x: 4.50, y: -0.10, z: 0.09 },
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
const scoreTracker = new ScoreTracker(initialStars);

// Multiplayer presence — autojoins a public room on PlaySDK ready (see
// the .onReady wiring at the bottom of this file). Renders remote planes
// into worldScene as their position packets arrive; no collision, no
// scoring interaction. mpRoom is null until quickMatch resolves (or stays
// null if PlaySDK / multiplayer is unavailable, e.g. local dev). The HUD
// reads remotePlayers.count() to show the pilot-online indicator.
const remotePlayers = new RemotePlayers(THREE, worldScene);
let mpRoom = null;

// Crash-debris effect — instantiated once and reused per crash. start()
// disassembles worldPlaneMesh into its children (each becomes a tumbling
// piece with an attached flame sprite) and triggers an expanding shell
// at the impact point; dispose() cleans up before MENU rebuilds the
// plane via setWorldPlane.
const crashDebris = new CrashDebris(THREE, worldScene);

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
  if (!terrain.villageRegistry) return {};
  // Scan for the nearest UNVISITED POI. Once a POI has been flown through
  // the player's already found it, so the compass arrow points past it to
  // the next discovery. When every POI is found, the arrow hides entirely.
  const all = terrain.villageRegistry.all;
  const markers = terrain.markers;
  let best = null;
  let bestD2 = Infinity;
  for (let i = 0; i < all.length; i++) {
    const v = all[i];
    if (markers && markers.isVisited(`v:${v.id}`)) continue;
    const d2 = (v.x - physics.x) ** 2 + (v.z - physics.z) ** 2;
    if (d2 < bestD2) { bestD2 = d2; best = v; }
  }
  if (!best) return {};
  const dx = best.x - physics.x;
  const dz = best.z - physics.z;
  // World bearing convention: 0 when target is along the plane's spawn-forward
  // axis (−Z). atan2(dx, −dz) maps +X to +π/2 so a village on the right reads
  // as a +π/2 rotation, which matches CSS rotate() (CW positive).
  const villageWorldBearing = Math.atan2(dx, -dz);
  const planeHeading = Math.atan2(physics.forward.x, -physics.forward.z);
  let bearing = villageWorldBearing - planeHeading;
  // Normalize to (-π, π]
  while (bearing > Math.PI)  bearing -= 2 * Math.PI;
  while (bearing <= -Math.PI) bearing += 2 * Math.PI;
  return {
    villageBearing: bearing,
    villageDistance: Math.sqrt(bestD2),
    villageType: best.templateKey,
    villageVisited: false,
  };
}

// Settings sheet — built once, lives across state transitions. Opens from
// the in-flight HUD's gear button; closes on backdrop tap or RESUME, or via
// BACK TO MENU which forwards to the state machine. We hide it on MENU /
// CRASH transitions defensively in case the player triggered one of those
// from underneath an open panel.
const settingsPanel = buildSettingsPanel({
  root: uiRoot,
  onBack: () => sm.setState('MENU'),
});

// PlaySDK haptic — gated on the settings toggle and on the SDK actually
// existing (local dev, tests, signed-out web users may not have it). All
// haptic call sites in the FLYING update go through this helper so the
// gate is a single place.
function haptic(kind) {
  if (!getSettings().hapticsOn) return;
  try {
    if (typeof window !== 'undefined' && window.PlaySDK && typeof window.PlaySDK.haptic === 'function') {
      window.PlaySDK.haptic(kind);
    }
  } catch {}
}

// Sustained-state haptic cadence (low + inverted). One shared timer means
// being both low AND inverted still only fires one pulse every 0.6s, not
// two. Reset on FLYING.enter so a fresh launch doesn't carry stale timing.
const SUSTAINED_HAPTIC_INTERVAL_MS = 600;
let _lastSustainedHapticMs = 0;
// Trick-flash edge detector — fires haptic on transition from no flash (or
// a different flash) to a new LOOP / BARREL ROLL flash. POI discoveries
// also set score.flash, so we substring-filter to avoid double-firing on
// the POI path (which already runs through the consumeDiscoveries loop).
let _lastTrickFlashText = null;

// --- State machine ---
const sm = new StateMachine({
  initial: 'MENU',
  states: {
    MENU: {
      enter() {
        activeScene = menuScene; activeCam = menuCam;
        clearUI();
        settingsPanel.hide();
        activeUI = buildMenu({
          THREE, root: uiRoot, menuScene, version: VERSION,
          currentPlane,
          scoreTracker, unlockState,
          onPlaneChange: (key) => {
            if (key === currentPlane) return;
            currentPlane = key;
            saveKey(LS_PLANE, key);
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
        _lastSustainedHapticMs = 0;
        _lastTrickFlashText = null;
        activeUI = buildHUD({
          root: uiRoot, version: VERSION,
          onSettings: () => settingsPanel.show(),
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
        // Apply Y-invert at the input boundary so the rest of the stack
        // (physics, score, tricks) is unaware of the setting.
        const ctrl = input.read();
        if (getSettings().invertY) ctrl.dragY = -ctrl.dragY;
        physics.update({ ...ctrl, dt });
        clampToCeiling(physics, CEILING);
        worldPlaneMesh.position.set(physics.x, physics.y, physics.z);
        worldPlaneMesh.quaternion.set(physics.quat.x, physics.quat.y, physics.quat.z, physics.quat.w);
        if (worldPlaneMesh.userData.propeller) worldPlaneMesh.userData.propeller.rotation.z += dt * physics.speed * 0.5;
        // Multiplayer: interpolate visible peers + broadcast our own state
        // at ~10 Hz. Throttling here (not per frame) keeps the wire rate
        // independent of fps so a 144 Hz monitor doesn't flood the room.
        remotePlayers.update();
        if (mpRoom && remotePlayers.shouldBroadcast(dt)) {
          mpRoom.send({
            plane: currentPlane,
            x: physics.x, y: physics.y, z: physics.z,
            qx: physics.quat.x, qy: physics.quat.y, qz: physics.quat.z, qw: physics.quat.w,
          });
        }
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
        if (terrain.markers) {
          const discoveries = terrain.markers.consumeDiscoveries();
          for (let i = 0; i < discoveries.length; i++) {
            scoreTracker.awardDiscovery();
            haptic('success');
          }
        }
        const score = scoreTracker.update(physics, terrain, dt);

        // Haptics: sustained pulse while low or inverted, edge-triggered
        // thump on trick completions. POI thump already fired above in the
        // discoveries loop. All routed through haptic() which gates on
        // settings.hapticsOn + PlaySDK availability.
        const lowActive = score.bonuses.some(b => b.label === 'LOW');
        const invActive = physics.up.y < -0.3;
        if (lowActive || invActive) {
          const nowMs = performance.now();
          if (nowMs - _lastSustainedHapticMs >= SUSTAINED_HAPTIC_INTERVAL_MS) {
            haptic('light');
            _lastSustainedHapticMs = nowMs;
          }
        }
        const flashText = score.flash ? score.flash.text : null;
        if (flashText && flashText !== _lastTrickFlashText
            && (flashText.includes('LOOP') || flashText.includes('BARREL'))) {
          haptic('medium');
        }
        _lastTrickFlashText = flashText;
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
          pilots: mpRoom ? remotePlayers.count() : -1,
          ...vNav,
        });
        flyingCountdown -= dt;
        if (crashed(
          physics, terrain,
          physics.cfg.collisionRadius * WORLD_PLANE_SCALE,
          physics.cfg.vertRadius       * WORLD_PLANE_SCALE,
        )) {
          sm.setState('CRASH');
        }
      },
    },

    CRASH: {
      enter() {
        activeScene = worldScene; activeCam = worldCam;
        clearUI();
        settingsPanel.hide();
        // Engine-exhaust cones are attached to worldPlaneMesh and would
        // otherwise be detached + flung as debris. Dispose them first so
        // only structural plane parts become wreckage.
        for (const f of flameCones) f.dispose();
        flameCones.length = 0;
        // Disassemble the plane mesh into tumbling pieces. After this
        // call, worldPlaneMesh is an empty Group — we rebuild it in
        // exit() via setWorldPlane.
        crashDebris.start(worldPlaneMesh, physics);
        activeUI = buildCrashOverlay({
          root: uiRoot, durationMs: 3000,
          onComplete: () => sm.setState('MENU'),
        });
      },
      update(dt) {
        crashDebris.update(dt, terrain);
      },
      exit() {
        crashDebris.dispose();
        // Rebuild worldPlaneMesh + contrails + flame cones now that the
        // wreckage has been cleaned up. setWorldPlane disposes the
        // empty group from the previous flight and creates a fresh one.
        setWorldPlane(currentPlane);
      },
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
  // .onReady(cb) is the actual ready-signal API. Once ready we autojoin a
  // public room via quickMatch for the "see other pilots" presence
  // feature. quickMatch joins an existing public room if any has space,
  // or creates a fresh one — so a solo player isn't stranded waiting for
  // someone else to host.
  if (window.PlaySDK && typeof window.PlaySDK.onReady === 'function') {
    window.PlaySDK.onReady(() => {
      const mp = window.PlaySDK.multiplayer;
      if (!mp || typeof mp.quickMatch !== 'function') return;
      mp.on('game',       (from, data) => remotePlayers.onPeerState(from, data));
      mp.on('playerLeft', (data) => remotePlayers.onPeerLeft(data.userId));
      mp.quickMatch({ maxPlayers: 16 })
        .then((room) => { mpRoom = room; })
        .catch(() => { /* offline / quota — silently no-op */ });
    });
  }
});

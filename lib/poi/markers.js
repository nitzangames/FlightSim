// Landmark fly-through markers. Each landmark gets a coloured ring at a
// known position; flying the plane through the ring marks the landmark
// "visited" and persists it to localStorage.
//
// Landmark spec:
//   { id, x, y, z, angle? }
//     x/y/z = ring centre in world coords (lifted automatically by RING_LIFT)
//     angle = optional fixed ring axis direction in XZ plane (rotation around
//             world +Y). When omitted, the ring billboards around Y to face
//             the plane horizontally, so it presents as a fly-through hoop
//             regardless of approach direction.
//
// Usage:
//   const markers = new LandmarkMarkers(THREE, scene, landmarks);
//   markers.update(plane, dt);            // every frame
//   markers.visitedCount, markers.total
//   markers.consumeFlash() → { id } or null when a new ring was just hit

const RING_MAJOR_R = 30;          // ring centre to tube centre
const RING_TUBE_R  = 1.2;         // tube thickness
// Lift the ring centre high enough that a vertical 30 m-radius ring fully
// clears the tallest POI structures (castle keep ≈ 30 m world, monastery
// bell tower ≈ 40 m). With major_r=30 and lift=70, the ring spans
// y_ground+40 → y_ground+100 — well above every building geometry.
const RING_LIFT    = 70;

// Fly-through tolerances. Axial = along the runway direction (the ring's
// normal); radial = perpendicular from ring centre. Generous so a moving
// plane registers reliably across a frame. Used by FIXED-BEARING markers
// (runways) where the approach direction is part of the gameplay.
const HIT_AXIAL   = 12;
const HIT_RADIAL  = 34;
// Billboarded markers (villages/castles/monasteries) re-aim at the plane
// every frame in full 3D, so there's no meaningful "axis" to fly along.
// They register on proximity instead: any approach within this distance of
// the ring centre counts. Set just above the visible hoop's outer radius
// (major 30 + tube 1.2 ≈ 31.2) plus a forgiving margin for a fast plane.
const HIT_DISTANCE_BILLBOARD = 36;

import { loadKey, saveKey } from '../game/storage.js';

export const VISITED_KEY    = 'flightsim.visited';
export const LAST_VISIT_KEY = 'flightsim.lastVisitPos';

function parseVisited(raw) {
  try {
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

// Async preload — await this at boot and pass the set into LandmarkMarkers.
export async function loadVisited() {
  return parseVisited(await loadKey(VISITED_KEY));
}

function saveVisited(set) {
  saveKey(VISITED_KEY, JSON.stringify([...set]));
}

// In-memory cache of the most recently flown-through landmark's world position.
// Seeded from PlaySDK / localStorage at boot via initLastVisitPos(), then kept
// hot by saveLastVisitPos() so computeSpawn() in main.js stays sync.
let _lastVisitPosCache = null;

function parseLastVisitPos(raw) {
  try {
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p.x !== 'number' || typeof p.z !== 'number') return null;
    return { x: p.x, y: typeof p.y === 'number' ? p.y : 0, z: p.z };
  } catch { return null; }
}

// Async — call once at boot to seed the cache before loadLastVisitPos() is used.
export async function initLastVisitPos() {
  _lastVisitPosCache = parseLastVisitPos(await loadKey(LAST_VISIT_KEY));
}

// Used by main.js to spawn the plane over the last POI on respawn / launch.
// Reads from the in-memory cache so callers don't need to await.
export function loadLastVisitPos() { return _lastVisitPosCache; }

function saveLastVisitPos(lm) {
  _lastVisitPosCache = { x: lm.x, y: lm.y, z: lm.z };
  saveKey(LAST_VISIT_KEY, JSON.stringify(_lastVisitPosCache));
}

export class LandmarkMarkers {
  // `initialVisited` is the Set returned by loadVisited(). When omitted,
  // fall back to a sync localStorage read so non-PlaySDK environments
  // (tests, local dev) keep working.
  constructor(THREE, scene, landmarks, initialVisited) {
    this.THREE = THREE;
    this.scene = scene;
    this.landmarks = landmarks;
    this.markers = [];   // [{ landmark, mesh, visited, axisX, axisZ }]
    this.total = landmarks.length;
    this.visitedCount = 0;
    this._flash = null;   // { id, t: seconds remaining }
    // Queue of landmark IDs that became visited THIS frame. Drained by
    // consumeDiscoveries(); separate from _flash because that one persists
    // for 1.6s and is read repeatedly, whereas the discovery payout fires
    // exactly once per visit and must not double-count.
    this._newDiscoveries = [];

    // Shared geometry; per-marker material so visited state can recolor.
    const geom = new THREE.TorusGeometry(RING_MAJOR_R, RING_TUBE_R, 8, 24);
    const matUnvisited = new THREE.MeshBasicMaterial({
      color: 0x60d8ff, transparent: true, opacity: 0.75,
      depthWrite: false,
    });
    const matVisited = new THREE.MeshBasicMaterial({
      color: 0x60ff80, transparent: true, opacity: 0.35,
      depthWrite: false,
    });
    this._matU = matUnvisited;
    this._matV = matVisited;
    this._geom = geom;

    // Persisted set of visited landmark IDs. Kept on the instance (in
    // addition to per-marker .visited flags) so callers can ask
    // `markers.isVisited('v:42')` cheaply without scanning the array.
    if (initialVisited instanceof Set) {
      this._visitedSet = initialVisited;
    } else {
      let raw = null;
      try { raw = typeof localStorage !== 'undefined' ? localStorage.getItem(VISITED_KEY) : null; } catch {}
      this._visitedSet = parseVisited(raw);
    }
    for (const lm of landmarks) {
      const isV = this._visitedSet.has(lm.id);
      // Visited rings are hidden entirely now — once you've flown through
      // a POI, the marker stops appearing so the world reads as "explored"
      // around what you've already found. Old behaviour swapped to the
      // green matVisited material; we keep matVisited around in case it's
      // useful later but never assign it in the live path.
      const mesh = new THREE.Mesh(geom, matUnvisited);
      mesh.visible = !isV;
      mesh.position.set(lm.x, lm.y + RING_LIFT, lm.z);
      // Two orientation modes:
      //   - Fixed bearing: lm.angle is a finite number → ring is vertical and
      //     axis-aligned with that bearing in XZ (e.g., future runway markers).
      //   - Billboard (default): ring stays vertical, axis re-aimed at the
      //     plane each frame so the hoop always faces the pilot — works for
      //     POIs with no canonical approach direction (villages/castles/etc).
      const billboard = !(typeof lm.angle === 'number' && isFinite(lm.angle));
      let axisX, axisY = 0, axisZ;
      if (billboard) {
        // Initial bearing along +Z; update() overrides per frame.
        axisX = 0; axisZ = 1;
      } else {
        mesh.rotation.y = lm.angle;
        axisX = Math.sin(lm.angle); axisZ = Math.cos(lm.angle);
      }
      mesh.renderOrder = 5;
      // The torus bounding sphere stays valid under the per-frame re-aim,
      // so default frustum culling is safe — without it every ring in the
      // world (~300) is a draw call each frame, even behind the camera.
      mesh.frustumCulled = true;
      scene.add(mesh);
      if (isV) this.visitedCount++;
      this.markers.push({
        landmark: lm, mesh, visited: isV, axisX, axisY, axisZ, billboard,
      });
    }
  }

  update(plane, dt) {
    for (const m of this.markers) {
      const lm = m.landmark;
      const dx = plane.x - lm.x;
      const dy = plane.y - (lm.y + RING_LIFT);
      const dz = plane.z - lm.z;
      // Billboard rings re-aim at the plane every frame so they always face
      // it. Done before the visited short-circuit so visited rings still
      // present face-on as the pilot flies past (just in a different colour).
      // Full 3D aim (lookAt) instead of yaw-only: from a high-altitude
      // approach the vertical hoop would foreshorten into a thin ellipse
      // (the "ring looks small" complaint), and the yaw-only hit math
      // collapsed to a narrow ±34 m altitude band centred on RING_LIFT,
      // which a diving plane could pass through without registering.
      if (m.billboard) {
        m.mesh.lookAt(plane.x, plane.y, plane.z);
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        m.axisX = dx / len;
        m.axisY = dy / len;
        m.axisZ = dz / len;
      }
      if (m.visited) continue;
      let hit;
      if (m.billboard) {
        // 3D proximity check — the ring always faces the plane, so there
        // is no "axis to fly along". Hit fires inside a sphere matching
        // the visible hoop.
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        hit = dist < HIT_DISTANCE_BILLBOARD;
      } else {
        // Fixed-bearing (runway): keep the directional fly-through gate.
        const axial = dx * m.axisX + dy * m.axisY + dz * m.axisZ;
        if (Math.abs(axial) > HIT_AXIAL) continue;
        const px = dx - m.axisX * axial;
        const py = dy - m.axisY * axial;
        const pz = dz - m.axisZ * axial;
        const radial = Math.sqrt(px * px + py * py + pz * pz);
        hit = radial < HIT_RADIAL;
      }
      if (hit) {
        m.visited = true;
        // Hide the ring entirely now that this POI has been flown through.
        // Visit flash banner in the HUD still announces it; the in-world
        // ring stops appearing so revisited POIs don't have a marker.
        m.mesh.visible = false;
        this.visitedCount++;
        this._flash = { id: lm.id, t: 1.6 };
        this._newDiscoveries.push(lm.id);
        this._visitedSet.add(lm.id);
        saveVisited(this._visitedSet);
        // Track the most-recent visited POI's world position so respawn
        // can drop the plane over it instead of always returning to origin.
        saveLastVisitPos(lm);
      }
    }
    if (this._flash) {
      this._flash.t -= dt;
      if (this._flash.t <= 0) this._flash = null;
    }
  }

  // O(1) check whether a landmark ID has been flown through this run.
  isVisited(id) { return this._visitedSet.has(id); }

  // Drain the queue of POIs that became visited this frame. Each call
  // returns the pending IDs and clears the queue — so a discovery reward
  // fires exactly once per visit, even though _flash lingers for 1.6s.
  consumeDiscoveries() {
    if (this._newDiscoveries.length === 0) return [];
    const out = this._newDiscoveries;
    this._newDiscoveries = [];
    return out;
  }

  // Returns { id } once per new visit, then null until the next visit.
  consumeFlash() {
    if (!this._flash) return null;
    // Caller reads it; we don't actually clear here so the flash banner
    // can persist for the full duration. Use the t > 0 check instead.
    return { id: this._flash.id, t: this._flash.t };
  }

  dispose() {
    for (const m of this.markers) this.scene.remove(m.mesh);
    this._geom.dispose();
    this._matU.dispose();
    this._matV.dispose();
  }
}

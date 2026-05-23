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
// plane registers reliably across a frame.
const HIT_AXIAL   = 12;
const HIT_RADIAL  = 34;

const LS_KEY      = 'flightsim.visited';
const LS_LAST_KEY = 'flightsim.lastVisitPos';

function loadVisited() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}
function saveVisited(set) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch {}
}

// The world-space position of the most recently flown-through landmark.
// Used by main.js to spawn the plane over the last POI on respawn / launch.
export function loadLastVisitPos() {
  try {
    const raw = localStorage.getItem(LS_LAST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p.x !== 'number' || typeof p.z !== 'number') return null;
    return { x: p.x, y: typeof p.y === 'number' ? p.y : 0, z: p.z };
  } catch { return null; }
}
function saveLastVisitPos(lm) {
  try { localStorage.setItem(LS_LAST_KEY, JSON.stringify({ x: lm.x, y: lm.y, z: lm.z })); } catch {}
}

export class LandmarkMarkers {
  constructor(THREE, scene, landmarks) {
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
    this._visitedSet = loadVisited();
    const visited = this._visitedSet;
    for (const lm of landmarks) {
      const isV = visited.has(lm.id);
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
      mesh.frustumCulled = false;
      scene.add(mesh);
      if (isV) this.visitedCount++;
      this.markers.push({
        landmark: lm, mesh, visited: isV, axisX, axisY, axisZ, billboard,
      });
    }
  }

  update(plane, dt) {
    for (const m of this.markers) {
      // Billboard rings re-aim at the plane every frame so they always face
      // it. Done before the visited short-circuit so visited rings still
      // present face-on as the pilot flies past (just in a different colour).
      if (m.billboard) {
        const lm = m.landmark;
        const yaw = Math.atan2(plane.x - lm.x, plane.z - lm.z);
        m.mesh.rotation.y = yaw;
        m.axisX = Math.sin(yaw);
        m.axisZ = Math.cos(yaw);
      }
      if (m.visited) continue;
      const lm = m.landmark;
      const dx = plane.x - lm.x;
      const dy = plane.y - (lm.y + RING_LIFT);
      const dz = plane.z - lm.z;
      // Signed distance along the ring axis.
      const axial = dx * m.axisX + dy * m.axisY + dz * m.axisZ;
      if (Math.abs(axial) > HIT_AXIAL) continue;
      // Distance perpendicular to the axis (within the ring's plane).
      const px = dx - m.axisX * axial;
      const py = dy - m.axisY * axial;
      const pz = dz - m.axisZ * axial;
      const radial = Math.sqrt(px * px + py * py + pz * pz);
      if (radial < HIT_RADIAL) {
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

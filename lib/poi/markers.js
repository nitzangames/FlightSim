// Landmark fly-through markers. Each landmark gets a coloured ring at a
// known position + orientation; flying the plane through the ring marks
// the landmark "visited" and persists it to localStorage. Generic on the
// landmark shape — works for villages (runway-aligned rings) and will
// extend to castles / monasteries when those POIs ship.
//
// Landmark spec:
//   { id, x, y, z, angle }
//     x/y/z = ring centre in world coords (typically runway centre, lifted)
//     angle = ring axis direction in XZ plane (rotation around world +Y)
//
// Usage:
//   const markers = new LandmarkMarkers(THREE, scene, landmarks);
//   markers.update(plane, dt);            // every frame
//   markers.visitedCount, markers.total
//   markers.consumeFlash() → { id } or null when a new ring was just hit

const RING_MAJOR_R = 30;          // ring centre to tube centre
const RING_TUBE_R  = 1.2;         // tube thickness
const RING_LIFT    = 30;          // m above runway/ground

// Fly-through tolerances. Axial = along the runway direction (the ring's
// normal); radial = perpendicular from ring centre. Generous so a moving
// plane registers reliably across a frame.
const HIT_AXIAL   = 12;
const HIT_RADIAL  = 34;

const LS_KEY = 'flightsim.visited';

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

export class LandmarkMarkers {
  constructor(THREE, scene, landmarks) {
    this.THREE = THREE;
    this.scene = scene;
    this.landmarks = landmarks;
    this.markers = [];   // [{ landmark, mesh, visited, axisX, axisZ }]
    this.total = landmarks.length;
    this.visitedCount = 0;
    this._flash = null;   // { id, t: seconds remaining }

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

    const visited = loadVisited();
    for (const lm of landmarks) {
      const mesh = new THREE.Mesh(geom, visited.has(lm.id) ? matVisited : matUnvisited);
      mesh.position.set(lm.x, lm.y + RING_LIFT, lm.z);
      // TorusGeometry default axis = +Z. Rotating around world +Y by `angle`
      // takes (0,0,1) to (sin a, 0, cos a) — so the ring's axis lies along
      // the runway direction.
      mesh.rotation.y = lm.angle;
      mesh.renderOrder = 5;
      mesh.frustumCulled = false;
      scene.add(mesh);
      const isV = visited.has(lm.id);
      if (isV) this.visitedCount++;
      this.markers.push({
        landmark: lm, mesh, visited: isV,
        axisX: Math.sin(lm.angle), axisZ: Math.cos(lm.angle),
      });
    }
  }

  update(plane, dt) {
    for (const m of this.markers) {
      if (m.visited) continue;
      const lm = m.landmark;
      const dx = plane.x - lm.x;
      const dy = plane.y - (lm.y + RING_LIFT);
      const dz = plane.z - lm.z;
      // Project onto ring axis (signed distance along runway direction).
      const axial = dx * m.axisX + dz * m.axisZ;
      if (Math.abs(axial) > HIT_AXIAL) continue;
      // Radial distance from ring centre, perpendicular to axis.
      const px = dx - m.axisX * axial;
      const pz = dz - m.axisZ * axial;
      const radial = Math.sqrt(px * px + dy * dy + pz * pz);
      if (radial < HIT_RADIAL) {
        m.visited = true;
        m.mesh.material = this._matV;
        this.visitedCount++;
        this._flash = { id: lm.id, t: 1.6 };
        const set = loadVisited(); set.add(lm.id); saveVisited(set);
      }
    }
    if (this._flash) {
      this._flash.t -= dt;
      if (this._flash.t <= 0) this._flash = null;
    }
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

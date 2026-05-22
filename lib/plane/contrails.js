// Wingtip contrails — a billboarded ribbon of recent wingtip positions that
// fades from solid white at the head to invisible at the tail. Each frame we
// shift a ring buffer of N world-space centreline points, then rebuild the
// ribbon's 2*N vertices by offsetting perpendicular to (segment direction ×
// to-camera direction) so the ribbon always faces the pilot.
//
// One WingContrail = one wing. Create two per plane (left + right).

const TRAIL_SEGMENTS   = 64;
const TRAIL_WIDTH      = 0.125;   // m (25% of the previous 0.5)
const TRAIL_HEAD_ALPHA = 0.65;

export class WingContrail {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.N = TRAIL_SEGMENTS;
    this.width = TRAIL_WIDTH;

    // Ring buffer of recent centreline positions in world space.
    // Index 0 = oldest (tail), index N-1 = newest (head).
    this.centerlines = new Array(this.N);
    for (let i = 0; i < this.N; i++) this.centerlines[i] = [0, 0, 0];
    this.hasData = false;

    // Geometry: two verts per segment, N*2 verts total. Quads stitched across
    // adjacent segments into triangle pairs.
    this.positions = new Float32Array(this.N * 2 * 3);
    const trailT   = new Float32Array(this.N * 2);
    for (let i = 0; i < this.N; i++) {
      const t = i / (this.N - 1);   // 0 at tail, 1 at head
      trailT[i * 2 + 0] = t;
      trailT[i * 2 + 1] = t;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geom.setAttribute('aTrailT',  new THREE.BufferAttribute(trailT, 1));
    const indices = new Uint16Array((this.N - 1) * 6);
    for (let i = 0; i < this.N - 1; i++) {
      const i0 = i * 2,     i1 = i * 2 + 1;
      const j0 = (i+1) * 2, j1 = (i+1) * 2 + 1;
      const k  = i * 6;
      indices[k+0] = i0; indices[k+1] = i1; indices[k+2] = j1;
      indices[k+3] = i0; indices[k+4] = j1; indices[k+5] = j0;
    }
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.setDrawRange(0, 0);   // hide until the first update fills the buffer

    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aTrailT;
        varying float vTrailT;
        void main() {
          vTrailT = aTrailT;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vTrailT;
        void main() {
          // Square the gradient so the tail fades faster than the head —
          // gives a clean wisp instead of a long flat smear.
          float a = vTrailT * vTrailT * ${TRAIL_HEAD_ALPHA.toFixed(3)};
          gl_FragColor = vec4(1.0, 1.0, 1.0, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder   = 4;
    scene.add(this.mesh);
    this._scene = scene;

    // Scratch vectors so update() doesn't allocate per frame.
    this._tmpDir   = new THREE.Vector3();
    this._tmpToCam = new THREE.Vector3();
    this._tmpRight = new THREE.Vector3();
  }

  // Call each frame AFTER the plane has been positioned for this frame.
  // wingtipWorld is a THREE.Vector3 in world space; camera is the active camera.
  update(wingtipWorld, camera) {
    // Shift the ring buffer left by one (oldest → drop, reused at head).
    const head = this.centerlines[0];
    for (let i = 0; i < this.N - 1; i++) this.centerlines[i] = this.centerlines[i + 1];
    this.centerlines[this.N - 1] = head;
    head[0] = wingtipWorld.x;
    head[1] = wingtipWorld.y;
    head[2] = wingtipWorld.z;

    if (!this.hasData) {
      // First frame: collapse every centreline point to the head so the
      // initial ribbon is a zero-length point rather than a streak from the
      // world origin.
      for (let i = 0; i < this.N; i++) {
        const c = this.centerlines[i];
        c[0] = wingtipWorld.x; c[1] = wingtipWorld.y; c[2] = wingtipWorld.z;
      }
      this.hasData = true;
      this.mesh.geometry.setDrawRange(0, (this.N - 1) * 6);
    }

    const camPos = camera.position;
    const halfW = this.width / 2;
    for (let i = 0; i < this.N; i++) {
      const c    = this.centerlines[i];
      const next = i < this.N - 1 ? this.centerlines[i + 1] : c;
      const prev = i > 0          ? this.centerlines[i - 1] : c;
      this._tmpDir.set(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]);
      if (this._tmpDir.lengthSq() < 1e-8) {
        this._tmpDir.set(1, 0, 0);
      } else {
        this._tmpDir.normalize();
      }
      this._tmpToCam.set(camPos.x - c[0], camPos.y - c[1], camPos.z - c[2]);
      if (this._tmpToCam.lengthSq() < 1e-8) {
        this._tmpToCam.set(0, 1, 0);
      } else {
        this._tmpToCam.normalize();
      }
      this._tmpRight.crossVectors(this._tmpDir, this._tmpToCam);
      if (this._tmpRight.lengthSq() < 1e-8) {
        // Trail direction and camera direction are parallel — pick world up
        // as a sane fallback so the ribbon doesn't collapse to zero width.
        this._tmpRight.set(0, 1, 0);
      } else {
        this._tmpRight.normalize();
      }
      const ox = this._tmpRight.x * halfW;
      const oy = this._tmpRight.y * halfW;
      const oz = this._tmpRight.z * halfW;
      const p = i * 6;
      this.positions[p + 0] = c[0] + ox;
      this.positions[p + 1] = c[1] + oy;
      this.positions[p + 2] = c[2] + oz;
      this.positions[p + 3] = c[0] - ox;
      this.positions[p + 4] = c[1] - oy;
      this.positions[p + 5] = c[2] - oz;
    }

    this.mesh.geometry.attributes.position.needsUpdate = true;
  }

  // Reset the ring buffer so the trail collapses to a point on next update.
  // Call this when the plane teleports (e.g., respawn) so we don't draw a
  // long streak between the old position and the new one.
  reset() {
    this.hasData = false;
    this.mesh.geometry.setDrawRange(0, 0);
  }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

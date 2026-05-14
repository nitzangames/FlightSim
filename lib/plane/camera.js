// Smoothed chase camera. Maintains a local offset behind+above the plane and
// lerps both position and lookAt target toward freshly-computed targets each
// frame. Smoothing absorbs any per-frame physics jitter.

const POS_LERP  = 0.15;
const LOOK_LERP = 0.20;
const OFFSET = { back: 14, up: 6, ahead: 10, lookDown: 3 };

export class ChaseCamera {
  constructor(THREE, camera) {
    this.THREE = THREE;
    this.camera = camera;
    this.smoothedPos  = new THREE.Vector3();
    this.smoothedLook = new THREE.Vector3();
    this._initialized = false;
  }

  update(plane, _dt) {
    const cy = Math.cos(plane.yaw), sy = Math.sin(plane.yaw);
    const cp = Math.cos(plane.pitch), sp = Math.sin(plane.pitch);

    const fx = -sy * cp, fy = sp, fz = -cy * cp;

    const targetX = plane.x - fx * OFFSET.back;
    const targetY = plane.y - fy * OFFSET.back + OFFSET.up;
    const targetZ = plane.z - fz * OFFSET.back;

    const lookX = plane.x + fx * OFFSET.ahead;
    const lookY = plane.y + fy * OFFSET.ahead - OFFSET.lookDown;
    const lookZ = plane.z + fz * OFFSET.ahead;

    if (!this._initialized) {
      this.smoothedPos.set(targetX, targetY, targetZ);
      this.smoothedLook.set(lookX, lookY, lookZ);
      this._initialized = true;
    } else {
      this.smoothedPos.x += (targetX - this.smoothedPos.x) * POS_LERP;
      this.smoothedPos.y += (targetY - this.smoothedPos.y) * POS_LERP;
      this.smoothedPos.z += (targetZ - this.smoothedPos.z) * POS_LERP;
      this.smoothedLook.x += (lookX - this.smoothedLook.x) * LOOK_LERP;
      this.smoothedLook.y += (lookY - this.smoothedLook.y) * LOOK_LERP;
      this.smoothedLook.z += (lookZ - this.smoothedLook.z) * LOOK_LERP;
    }

    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLook);
  }
}

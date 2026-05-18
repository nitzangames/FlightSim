// Smoothed chase camera. Lerps both position and lookAt target toward freshly-
// computed targets each frame to absorb per-frame physics jitter.
//
// Camera frame is the plane's body frame: "back" along -forward, "up" along
// the plane's local up axis. So the camera rolls with the plane — banking
// banks the camera too (cockpit-style follow), which keeps the plane stable
// on screen during barrel rolls instead of spinning the world wildly.

// Pos lerp is moderate (smooths physics jitter) but the camera target is
// VELOCITY-COMPENSATED: we advance the chase point forward along the plane's
// velocity by the lerp's predicted lag distance, so the smoothed camera
// catches up to the visually-correct position without jittering.
const POS_LERP   = 0.30;
const LOOK_LERP  = 0.35;
// Lead factor: at LERP=0.30 the steady-state lag is ~(1/0.30 - 1) ≈ 2.33
// frames of velocity. Multiplying velocity by this gets us right where the
// camera should sit.
const LEAD_FRAMES = (1 / POS_LERP) - 1;
// Camera offset tuned for the 0.875× world-plane scale (planes are 3.5× the
// original visual size). Distances scale with the plane: back/up/ahead all
// multiplied by 3.5 from the previous tuning so the silhouette fills roughly
// the same fraction of screen.
const OFFSET = { back: 14, up: 5.25, ahead: 10.5, lookDown: 2.1 };

export class ChaseCamera {
  constructor(THREE, camera) {
    this.THREE = THREE;
    this.camera = camera;
    this.smoothedPos  = new THREE.Vector3();
    this.smoothedLook = new THREE.Vector3();
    this.smoothedUp   = new THREE.Vector3(0, 1, 0);
    this._initialized = false;
  }

  update(plane, dt) {
    const fx = plane.forward.x, fy = plane.forward.y, fz = plane.forward.z;
    const ux = plane.up.x,      uy = plane.up.y,      uz = plane.up.z;

    // Velocity feedforward: advance the chase point along the plane's velocity
    // by LEAD_FRAMES of motion, so the smoothed camera (which lags by
    // ~LEAD_FRAMES of velocity in steady state) lands at the visually-correct
    // distance behind the plane regardless of speed.
    const vx = fx * plane.speed * dt * LEAD_FRAMES;
    const vy = fy * plane.speed * dt * LEAD_FRAMES;
    const vz = fz * plane.speed * dt * LEAD_FRAMES;

    // Camera sits behind the plane along -forward and offset along the plane's
    // local up axis, anchored on the advanced (predicted) chase point. Look
    // target is ahead along forward with a slight nose-up tilt so the horizon
    // sits a touch above the plane on screen.
    const targetX = plane.x + vx - fx * OFFSET.back + ux * OFFSET.up;
    const targetY = plane.y + vy - fy * OFFSET.back + uy * OFFSET.up;
    const targetZ = plane.z + vz - fz * OFFSET.back + uz * OFFSET.up;

    const lookX = plane.x + vx + fx * OFFSET.ahead - ux * OFFSET.lookDown;
    const lookY = plane.y + vy + fy * OFFSET.ahead - uy * OFFSET.lookDown;
    const lookZ = plane.z + vz + fz * OFFSET.ahead - uz * OFFSET.lookDown;

    if (!this._initialized) {
      this.smoothedPos.set(targetX, targetY, targetZ);
      this.smoothedLook.set(lookX, lookY, lookZ);
      this.smoothedUp.set(ux, uy, uz);
      this._initialized = true;
    } else {
      this.smoothedPos.x += (targetX - this.smoothedPos.x) * POS_LERP;
      this.smoothedPos.y += (targetY - this.smoothedPos.y) * POS_LERP;
      this.smoothedPos.z += (targetZ - this.smoothedPos.z) * POS_LERP;
      this.smoothedLook.x += (lookX - this.smoothedLook.x) * LOOK_LERP;
      this.smoothedLook.y += (lookY - this.smoothedLook.y) * LOOK_LERP;
      this.smoothedLook.z += (lookZ - this.smoothedLook.z) * LOOK_LERP;
      this.smoothedUp.x += (ux - this.smoothedUp.x) * LOOK_LERP;
      this.smoothedUp.y += (uy - this.smoothedUp.y) * LOOK_LERP;
      this.smoothedUp.z += (uz - this.smoothedUp.z) * LOOK_LERP;
    }

    // Set camera.up BEFORE lookAt — three.js uses it when computing the view
    // basis. Smoothed plane-up means the world doesn't snap during fast rolls.
    this.camera.up.copy(this.smoothedUp);
    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLook);
  }
}

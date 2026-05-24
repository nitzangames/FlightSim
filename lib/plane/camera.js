// Smoothed chase camera. Lerps both position and lookAt target toward freshly-
// computed targets each frame to absorb per-frame physics jitter.
//
// Camera frame is anchored to WORLD up: behind the plane along -forward and
// a fixed altitude offset above (in world Y). Banking and inverting rotate
// the plane on screen rather than rolling the world, and flying upside-down
// keeps the camera above the plane so you see the inverted plane from above
// at the same angle as flying upright.

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
// the same fraction of screen. back/up further multiplied by 1.1 for a
// slightly more zoomed-out flight view.
const OFFSET = { back: 15.4, up: 5.775, ahead: 10.5, lookDown: 2.1 };

export class ChaseCamera {
  constructor(THREE, camera) {
    this.THREE = THREE;
    this.camera = camera;
    this.smoothedPos  = new THREE.Vector3();
    this.smoothedLook = new THREE.Vector3();
    this._initialized = false;
  }

  update(plane, dt) {
    const fx = plane.forward.x, fy = plane.forward.y, fz = plane.forward.z;

    // Velocity feedforward: advance the chase point along the plane's velocity
    // by LEAD_FRAMES of motion, so the smoothed camera (which lags by
    // ~LEAD_FRAMES of velocity in steady state) lands at the visually-correct
    // distance behind the plane regardless of speed.
    const vx = fx * plane.speed * dt * LEAD_FRAMES;
    const vy = fy * plane.speed * dt * LEAD_FRAMES;
    const vz = fz * plane.speed * dt * LEAD_FRAMES;

    // Camera sits behind the plane along -forward and a fixed offset along
    // WORLD up (not plane-up). This keeps the camera above the plane in
    // world space regardless of bank or inversion — when the plane rolls
    // upside-down, the camera stays overhead and you watch the inverted
    // plane from above, same angle as flying upright. Look target is
    // ahead along forward with a slight downward tilt so the plane sits
    // a touch below screen centre.
    const targetX = plane.x + vx - fx * OFFSET.back;
    const targetY = plane.y + vy - fy * OFFSET.back + OFFSET.up;
    const targetZ = plane.z + vz - fz * OFFSET.back;

    const lookX = plane.x + vx + fx * OFFSET.ahead;
    const lookY = plane.y + vy + fy * OFFSET.ahead - OFFSET.lookDown;
    const lookZ = plane.z + vz + fz * OFFSET.ahead;

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

    // Camera up locked to world +Y so the horizon stays horizontal even
    // when the plane banks or inverts. Banking now visibly rolls the
    // plane on screen instead of rolling the world (we traded the
    // cockpit-style follow for an external chase-cam feel).
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLook);
  }
}

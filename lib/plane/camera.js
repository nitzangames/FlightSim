// Smoothed chase camera. Lerps both position and lookAt target toward freshly-
// computed targets each frame to absorb per-frame physics jitter.
//
// Camera frame is the plane's body frame: "back" along -forward, "up" along
// the plane's local up axis. So the camera rolls with the plane — banking
// banks the camera too (cockpit-style follow), which keeps the plane stable
// on screen during barrel rolls instead of spinning the world wildly.

// Position lerp tightened so the camera doesn't trail far behind at high
// speeds (steady-state lag ≈ v/POS_LERP per frame; at 160 m/s and 60fps,
// 0.15 gave ~18m lag — plane appeared tiny on screen). 0.45 gives ~6m.
const POS_LERP  = 0.45;
const LOOK_LERP = 0.50;
// Camera offset tuned for the 0.25× world-plane scale. Close chase so the
// plane reads as the main subject on screen while terrain fills the
// background. Proportionally scaled from the original full-size offsets.
const OFFSET = { back: 4, up: 1.5, ahead: 3, lookDown: 0.6 };

export class ChaseCamera {
  constructor(THREE, camera) {
    this.THREE = THREE;
    this.camera = camera;
    this.smoothedPos  = new THREE.Vector3();
    this.smoothedLook = new THREE.Vector3();
    this.smoothedUp   = new THREE.Vector3(0, 1, 0);
    this._initialized = false;
  }

  update(plane, _dt) {
    const fx = plane.forward.x, fy = plane.forward.y, fz = plane.forward.z;
    const ux = plane.up.x,      uy = plane.up.y,      uz = plane.up.z;

    // Camera sits behind the plane along -forward and offset along the plane's
    // local up axis. Look target is ahead along forward with a slight nose-up
    // tilt (subtract local-up from the look point) so the horizon sits a touch
    // above the plane on screen.
    const targetX = plane.x - fx * OFFSET.back + ux * OFFSET.up;
    const targetY = plane.y - fy * OFFSET.back + uy * OFFSET.up;
    const targetZ = plane.z - fz * OFFSET.back + uz * OFFSET.up;

    const lookX = plane.x + fx * OFFSET.ahead - ux * OFFSET.lookDown;
    const lookY = plane.y + fy * OFFSET.ahead - uy * OFFSET.lookDown;
    const lookZ = plane.z + fz * OFFSET.ahead - uz * OFFSET.lookDown;

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

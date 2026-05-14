// Pure physics + smoothing for the plane. Quaternion-free for testability —
// we represent orientation as (yaw, pitch) Euler angles and let the renderer
// build a quaternion from those each frame. Visual roll is derived from yaw rate.
//
// Smoothing follows the project's standing convention:
//   smoothed += (target - smoothed) * 0.5
// (See feedback_camera_input_smoothing.md.)

const DRAG_CLAMP = 200;
const SMOOTHING = 0.5;
const RESPONSIVENESS = 0.5;  // global scale on pitch/yaw rates (0.5 = half as responsive)
const ENGINE_OFF_DRAG = 0.6;
const GRAVITY = 25;          // m/s² downward acceleration when engine is off
const NAN_FALLBACK = 0;

function safe(n) { return Number.isFinite(n) ? n : NAN_FALLBACK; }
function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

export class PlanePhysics {
  constructor(cfg) {
    this.cfg = cfg;
    this.x = 0; this.y = 30; this.z = 0;
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.speed = cfg.maxSpeed;
    this.fuel = cfg.maxFuel;
    this.engineOff = false;
    this.fallSpeed = 0;          // accumulated downward velocity once engine cuts
    this.distance = 0;
    this.targetPitchRate = 0;
    this.targetYawRate = 0;
    this.smoothedPitchRate = 0;
    this.smoothedYawRate = 0;
  }

  update({ dragX, dragY, dt }) {
    dt = safe(dt);
    dragX = clamp(safe(dragX), -DRAG_CLAMP, DRAG_CLAMP);
    dragY = clamp(safe(dragY), -DRAG_CLAMP, DRAG_CLAMP);

    // Inverted pitch axis: drag DOWN / press S = nose up (pull-back-to-climb).
    this.targetPitchRate = -(dragY / DRAG_CLAMP) * this.cfg.maxPitchRate * RESPONSIVENESS;
    this.targetYawRate   = (dragX / DRAG_CLAMP) * this.cfg.maxYawRate * RESPONSIVENESS;

    this.smoothedPitchRate += (this.targetPitchRate - this.smoothedPitchRate) * SMOOTHING;
    this.smoothedYawRate   += (this.targetYawRate   - this.smoothedYawRate)   * SMOOTHING;

    this.yaw   -= this.smoothedYawRate * dt;
    this.pitch -= this.smoothedPitchRate * dt;
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    this.roll = -this.smoothedYawRate * 0.4;

    this.fuel -= this.cfg.fuelDrainRate * dt;
    if (this.fuel <= 0) { this.fuel = 0; this.engineOff = true; }

    if (this.engineOff) {
      this.speed = Math.max(0, this.speed - ENGINE_OFF_DRAG * this.cfg.maxSpeed * dt);
      this.fallSpeed += GRAVITY * dt;             // gravity accelerates the descent
    } else {
      this.speed = this.cfg.maxSpeed;
      this.fallSpeed = 0;
    }

    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx = -sy * cp;
    const fy =  sp;
    const fz = -cy * cp;

    this.x += fx * this.speed * dt;
    this.y += fy * this.speed * dt - this.fallSpeed * dt;
    this.z += fz * this.speed * dt;
    this.distance += Math.abs(this.speed) * dt;

    this.x = safe(this.x); this.y = safe(this.y); this.z = safe(this.z);
    this.speed = safe(this.speed);
  }
}

// Pointer/keyboard input → drag offsets. Per the project convention, event
// handlers store the latest pointer position only; per-frame sampling lives in
// `read()`.
export class DragInput {
  constructor(domElement) {
    this.dom = domElement;
    this.active = false;
    this.startX = 0; this.startY = 0;
    this.latestX = 0; this.latestY = 0;
    this.lastEventAt = 0;
    this.kb = { fwd: 0, back: 0, left: 0, right: 0, up: 0, down: 0 };
    // Persistent keyboard "stick" position. Holding a key ramps the stick toward
    // its extreme; releasing leaves it where it was (the angle persists). Clamped
    // to ±200 to match the touch-drag clamp. Reset to 0 on resetStick() (called
    // when the player respawns so the new flight starts level).
    this.kbStickX = 0;
    this.kbStickY = 0;

    domElement.addEventListener('pointerdown', (e) => {
      this.active = true;
      this.startX = e.clientX; this.startY = e.clientY;
      this.latestX = e.clientX; this.latestY = e.clientY;
      this.lastEventAt = performance.now();
      try { domElement.setPointerCapture(e.pointerId); } catch {}
    });
    domElement.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      this.latestX = e.clientX; this.latestY = e.clientY;
      this.lastEventAt = performance.now();
    });
    const release = (e) => {
      this.active = false;
      try { if (domElement.hasPointerCapture(e.pointerId)) domElement.releasePointerCapture(e.pointerId); } catch {}
    };
    domElement.addEventListener('pointerup', release);
    domElement.addEventListener('pointercancel', release);

    addEventListener('keydown', (e) => {
      const m = KMAP[e.code]; if (m) this.kb[m] = 1;
    });
    addEventListener('keyup', (e) => {
      const m = KMAP[e.code]; if (m) this.kb[m] = 0;
    });
  }

  resetStick() {
    this.kbStickX = 0;
    this.kbStickY = 0;
    this.active = false;     // ignore any in-progress drag from the previous run
  }

  read() {
    if (this.active && performance.now() - this.lastEventAt > 2000) this.active = false;
    let dx = 0, dy = 0;
    if (this.active) { dx = this.latestX - this.startX; dy = this.latestY - this.startY; }
    // Keyboard ramps the persistent stick by KB_RAMP per call (~6 → full deflection
    // in ~33 frames at 60fps). Releasing both opposing keys leaves the stick at its
    // current value, so the plane keeps banking until you press the opposite key.
    const KB_RAMP = 6;
    if (this.kb.left)  this.kbStickX = Math.max(-200, this.kbStickX - KB_RAMP);
    if (this.kb.right) this.kbStickX = Math.min( 200, this.kbStickX + KB_RAMP);
    if (this.kb.up)    this.kbStickY = Math.max(-200, this.kbStickY - KB_RAMP);
    if (this.kb.down)  this.kbStickY = Math.min( 200, this.kbStickY + KB_RAMP);
    dx += this.kbStickX;
    dy += this.kbStickY;
    return { dragX: dx, dragY: dy };
  }
}
const KMAP = {
  KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right',
  ArrowUp: 'up', ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right',
};

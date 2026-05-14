// Pure physics + smoothing for the plane. Arcade flight model with full 3-axis
// orientation (yaw, pitch, roll) in YXZ Euler order — matches mesh.rotation.set().
//
// Input mapping (arcade — banking turns the plane):
//   dragX  → roll rate   (bank input — left/right drag rolls the plane)
//   dragY  → pitch rate  (drag down / press S = nose up, pull-back-to-climb)
//   yaw    is DERIVED from bank: a banked aircraft carves a turn (sin(roll)
//          tilts the lift vector laterally), so the plane yaws automatically
//          once you bank. No separate yaw input — this is what makes barrel
//          rolls and coordinated turns both feel right.
//
// Pitch and roll wrap at ±π so loops and multi-rotation barrel rolls work
// without unbounded angle growth.
//
// Smoothing follows the project's standing convention:
//   smoothed += (target - smoothed) * 0.5
// (See feedback_camera_input_smoothing.md.)

const DRAG_CLAMP = 200;
const SMOOTHING = 0.5;
const RESPONSIVENESS = 0.5;  // global scale on pitch rate
const ROLL_RATE_SCALE = 6;   // boosts roll-input rate so a full barrel roll
                             // takes ~2-3s at full stick (otherwise it'd be
                             // tied to maxYawRate which is tuned for turning)
const BANK_TO_YAW = 1.5;     // turn rate scale when banked 90° (knife-edge);
                             // tighter than the old direct-yaw turn
const ENGINE_OFF_DRAG = 0.6;
const GRAVITY = 25;          // m/s² downward acceleration when engine is off
const NAN_FALLBACK = 0;

function safe(n) { return Number.isFinite(n) ? n : NAN_FALLBACK; }
function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }
function wrapPi(a) {
  if (a >  Math.PI) return a - 2 * Math.PI;
  if (a < -Math.PI) return a + 2 * Math.PI;
  return a;
}

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
    this.targetRollRate = 0;
    this.smoothedPitchRate = 0;
    this.smoothedRollRate = 0;
    // Derived from bank each frame; kept as a field so anyone reading it gets
    // the current turn rate without re-deriving.
    this.smoothedYawRate = 0;
  }

  update({ dragX, dragY, dt }) {
    dt = safe(dt);
    dragX = clamp(safe(dragX), -DRAG_CLAMP, DRAG_CLAMP);
    dragY = clamp(safe(dragY), -DRAG_CLAMP, DRAG_CLAMP);

    this.targetRollRate  = (dragX / DRAG_CLAMP) * this.cfg.maxYawRate * RESPONSIVENESS * ROLL_RATE_SCALE;
    this.targetPitchRate = -(dragY / DRAG_CLAMP) * this.cfg.maxPitchRate * RESPONSIVENESS;

    this.smoothedRollRate  += (this.targetRollRate  - this.smoothedRollRate)  * SMOOTHING;
    this.smoothedPitchRate += (this.targetPitchRate - this.smoothedPitchRate) * SMOOTHING;

    // Drag right (dragX > 0) → targetRollRate > 0 → roll decreases → roll goes
    // negative → right wing down → banked right. Drag down → pitch decreases →
    // nose up (pull-back-to-climb).
    this.roll  -= this.smoothedRollRate  * dt;
    this.pitch -= this.smoothedPitchRate * dt;
    this.roll  = wrapPi(this.roll);
    this.pitch = wrapPi(this.pitch);

    // Yaw from bank: sin(roll) is negative when banked right → -sin(roll) is
    // positive → yaw decreases → plane turns right (clockwise from above).
    // Inverted (roll ≈ ±π): sin ≈ 0, so the bank-turn effect fades — the
    // player has to roll back upright to resume turning.
    this.smoothedYawRate = -Math.sin(this.roll) * this.cfg.maxYawRate * BANK_TO_YAW;
    this.yaw -= this.smoothedYawRate * dt;

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

// Pointer/keyboard input → drag offsets. Spring-loaded "stick" model: the
// stick is non-zero only while you're actively pressing/dragging — release
// returns it to zero. Combined with the integrated roll/pitch ANGLES in
// PlanePhysics, this gives the right feel: the bank you've built up stays
// banked, but the rate of rolling stops as soon as you stop input.
export class DragInput {
  constructor(domElement) {
    this.dom = domElement;
    this.active = false;
    this.startX = 0; this.startY = 0;
    this.latestX = 0; this.latestY = 0;
    this.lastEventAt = 0;
    this.kb = { left: 0, right: 0, up: 0, down: 0 };
    // Keyboard "stick" — ramps toward ±200 while a key is held, ramps back
    // toward 0 while no key is held. Touch/mouse uses the live drag delta
    // directly (no ramp), so a finger release immediately zeros that input.
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
    // Keyboard ramps toward ±200 while held, back toward 0 while released
    // (~6 per call → full deflection or full return in ~33 frames at 60fps).
    const KB_RAMP = 6;
    if (this.kb.right)     this.kbStickX = Math.min( 200, this.kbStickX + KB_RAMP);
    else if (this.kb.left) this.kbStickX = Math.max(-200, this.kbStickX - KB_RAMP);
    else this.kbStickX = (this.kbStickX > 0) ? Math.max(0, this.kbStickX - KB_RAMP) : Math.min(0, this.kbStickX + KB_RAMP);
    if (this.kb.down)      this.kbStickY = Math.min( 200, this.kbStickY + KB_RAMP);
    else if (this.kb.up)   this.kbStickY = Math.max(-200, this.kbStickY - KB_RAMP);
    else this.kbStickY = (this.kbStickY > 0) ? Math.max(0, this.kbStickY - KB_RAMP) : Math.min(0, this.kbStickY + KB_RAMP);
    // Live drag delta — only contributes while a pointer is held; goes to 0
    // immediately on release.
    let dx = this.kbStickX, dy = this.kbStickY;
    if (this.active) {
      dx += (this.latestX - this.startX);
      dy += (this.latestY - this.startY);
    }
    return { dragX: dx, dragY: dy };
  }
}
const KMAP = {
  KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right',
  ArrowUp: 'up', ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right',
};

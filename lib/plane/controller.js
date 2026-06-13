// Arcade flight sim physics. Quaternion-based orientation with body-frame
// rotations — pitching always rotates around the plane's LOCAL right wing,
// rolling around its LOCAL nose. So pulling back while banked produces a
// coordinated turn (real-flight behavior) and loops/barrel rolls don't suffer
// from Euler gimbal lock.
//
// Input mapping:
//   dragX  → roll rate  (around local nose; drag right = bank right)
//   dragY  → pitch rate (around local right wing; drag down = pull back = nose up)
// No yaw input — yaw emerges naturally from "pulling back while banked".
//
// Vertical model:
//   The plane flies in its local forward direction at maxSpeed.
//   Plus a "lift loss" term that drops altitude when wings aren't level —
//   the plane's local up axis no longer points at world up, so vertical lift
//   is reduced. Knife-edge → full drop rate; inverted → double drop rate.
//   This is what makes the player WANT to roll level (or pull back through
//   the bank to convert it into a turn).
//
// Smoothing follows the project's standing convention:
//   smoothed += (target - smoothed) * 0.5
// (See feedback_camera_input_smoothing.md.)

const DRAG_CLAMP = 200;
const SMOOTHING = 0.5;
const RESPONSIVENESS = 0.5;
const PITCH_RATE_SCALE = 3;     // a full loop takes ~7-10s at full pull-back
const ROLL_RATE_SCALE = 6;      // a full barrel roll takes ~2-3s at full stick
const ENGINE_OFF_DRAG = 0.6;
const GRAVITY = 25;             // m/s² (only used when engine cuts due to fuel)
// Bank-induced sink rate. The harder you turn (bank), the more altitude you
// bleed — the player must pull back (pitch up) or unbank to hold height, just
// like a real plane. Scales with bank via (1 - up.y), so steep banks bite hard
// and a knife-edge dumps altitude fast:
//   30°: ~4 m/s drop    60°: ~15 m/s    90°: 30 m/s    inverted: 60 m/s
// (Raised from 12 → 30 so a hard bank clearly costs altitude; sustained 90°
// flight now drops you quickly unless you actively fight it.)
const LIFT_LOSS_RATE = 30;
// Engine + flight envelope ----------------------------------------------------
// Service ceiling — engine thrust falls linearly from sea-level full to a
// tiny residual at this altitude. Above it the plane can't sustain its
// cruise speed and naturally bleeds energy, so this defines the soft top.
const SERVICE_CEILING = 4000;
const MIN_ALT_FACTOR  = 0.08;     // residual thrust at and above the ceiling
// Throttle responsiveness — how aggressively speed catches up to target.
// Higher = snappier. 0.4 means a step change settles in ~2.5 s.
const THROTTLE_RESPONSE = 0.4;
// Stall — when speed drops below this fraction of maxSpeed, lift collapses
// and the plane begins falling. Real planes stall around 35–45% of cruise.
const STALL_FRACTION = 0.40;
// How hard gravity pulls the plane down when fully stalled (m/s² added to
// fallSpeed per second of being deeply stalled).
const STALL_DROP_RATE = 18;
// Auto nose-over rate during a stall — the nose pitches toward the ground
// (world-frame, see the stall block) when the wings lose lift. ~1.2 rad/s
// (≈70°/s) at full severity drops the nose into a dive over a second or two —
// a deliberate break, not an instant snap. GATED on pilot input: with no input
// the nose drops into a dive; while the pilot actively pulls back (nose-up)
// it's suppressed so they hold the nose up (and keep mushing) until they
// release to recover.
const STALL_NOSE_DOWN_RATE = 0.8;
// While stalled the airframe is high-drag, so the engine can barely accelerate
// it — recovery comes mainly from DIVING, not thrust. Throttle response is cut
// to this fraction during a stall so a stall is a committed altitude-losing
// event instead of an instant bounce-back.
const STALL_THRUST_FACTOR = 0.15;
// Stalled-wing drag (m/s²): bleeds speed while the nose is still high so the
// plane mushes and loses altitude rather than instantly regaining flying speed.
// NOT scaled by severity (so it still bites in the recovery band); eases to
// zero as the nose drops into a dive (airflow reattaches), so the only way out
// is a committed nose-down dive.
const STALL_DRAG_RATE = 22;
// Hysteresis: once stalled, stay stalled until speed climbs to this multiple of
// the stall speed — keeps the stall from popping out the instant speed nudges
// back over the threshold.
const STALL_RECOVERY_MARGIN = 1.25;
// Bank-to-turn scaling: real physics is yawRate = (g/V) * tan(β). K=0.18 gives
// ~6°/s at 30° bank, ~18°/s at 60°, ~31°/s at the cap — closer to real-plane
// rates than the previous gamey K=1.8 (which was 10× too snappy per player
// feedback). Capped at tan ≈ 3 (~72° bank) so 89° does not blow up.
const BANK_TURN_K   = 0.18;
const BANK_TURN_CAP = 3.0;
const NAN_FALLBACK = 0;
// Metres the plane is lifted clear of the surface after a graze, so it doesn't
// immediately re-trigger contact on the next frame.
const GRAZE_CLEARANCE = 0.5;

function safe(n) { return Number.isFinite(n) ? n : NAN_FALLBACK; }
function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

// --- Quaternion helpers (no THREE dependency so the physics stays pure JS) ---
// Quaternions stored as { x, y, z, w } with w being the scalar part.

function qNormalize(q) {
  const m = Math.sqrt(q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w);
  if (m === 0) { q.x = 0; q.y = 0; q.z = 0; q.w = 1; return; }
  q.x /= m; q.y /= m; q.z /= m; q.w /= m;
}
// Post-multiply q by an axis-angle delta. Because we post-multiply, the
// rotation is interpreted in the LOCAL frame of q (i.e., body-frame).
function qRotateLocal(q, ax, ay, az, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const dx = ax * s, dy = ay * s, dz = az * s, dw = Math.cos(half);
  const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  q.x = qw*dx + qx*dw + qy*dz - qz*dy;
  q.y = qw*dy - qx*dz + qy*dw + qz*dx;
  q.z = qw*dz + qx*dy - qy*dx + qz*dw;
  q.w = qw*dw - qx*dx - qy*dy - qz*dz;
}
// PRE-multiply q by an axis-angle delta — rotation in the WORLD frame.
// Used for the bank-to-turn yaw, which must happen around the world vertical
// (not the plane's local up) so a banked plane carves a horizontal circle.
function qRotateWorld(q, ax, ay, az, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const dx = ax * s, dy = ay * s, dz = az * s, dw = Math.cos(half);
  const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  q.x = dw*qx + dx*qw + dy*qz - dz*qy;
  q.y = dw*qy + dy*qw + dz*qx - dx*qz;
  q.z = dw*qz + dz*qw + dx*qy - dy*qx;
  q.w = dw*qw - dx*qx - dy*qy - dz*qz;
}
// Rotate a body-frame vector by q: out = q * v * q⁻¹  (out can be `v` itself).
function qRotateVec(out, q, vx, vy, vz) {
  const ix =  q.w*vx + q.y*vz - q.z*vy;
  const iy =  q.w*vy + q.z*vx - q.x*vz;
  const iz =  q.w*vz + q.x*vy - q.y*vx;
  const iw = -q.x*vx - q.y*vy - q.z*vz;
  out.x = ix*q.w + iw*(-q.x) + iy*(-q.z) - iz*(-q.y);
  out.y = iy*q.w + iw*(-q.y) + iz*(-q.x) - ix*(-q.z);
  out.z = iz*q.w + iw*(-q.z) + ix*(-q.y) - iy*(-q.x);
}

export class PlanePhysics {
  constructor(cfg) {
    this.cfg = cfg;
    this.x = 0; this.y = 30; this.z = 0;
    this.speed = cfg.maxSpeed;
    this.fuel = cfg.maxFuel;
    this.engineOff = false;
    this.fallSpeed = 0;          // accumulated downward velocity once engine cuts
    this.stalling = false;       // set each update; read by the throttle cut
    this.distance = 0;

    // Orientation — unit quaternion. Identity = nose at -Z, right wing at +X,
    // local up at +Y.
    this.quat = { x: 0, y: 0, z: 0, w: 1 };

    // Cached world-space body axes, refreshed each update().
    this.forward = { x: 0, y: 0, z: -1 };
    this.up      = { x: 0, y: 1, z:  0 };
    this.right   = { x: 1, y: 0, z:  0 };

    // Input rates (smoothed body-frame angular velocity components).
    this.targetPitchRate = 0;
    this.targetRollRate = 0;
    this.smoothedPitchRate = 0;
    this.smoothedRollRate = 0;

    // Legacy fields kept at 0 for any consumer that still reads .yaw/.pitch/.roll.
    // The renderer uses the quaternion now (see shell/main.js).
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.smoothedYawRate = 0;
  }

  update({ dragX, dragY, dt }) {
    dt = safe(dt);
    dragX = clamp(safe(dragX), -DRAG_CLAMP, DRAG_CLAMP);
    dragY = clamp(safe(dragY), -DRAG_CLAMP, DRAG_CLAMP);

    // dragX → roll rate around local nose. dragY → pitch rate around local
    // right wing. Drag down (dragY > 0) → pitchRate > 0 → nose up.
    this.targetRollRate  = (dragX / DRAG_CLAMP) * this.cfg.maxYawRate   * RESPONSIVENESS * ROLL_RATE_SCALE;
    this.targetPitchRate = (dragY / DRAG_CLAMP) * this.cfg.maxPitchRate * RESPONSIVENESS * PITCH_RATE_SCALE;

    this.smoothedRollRate  += (this.targetRollRate  - this.smoothedRollRate)  * SMOOTHING;
    this.smoothedPitchRate += (this.targetPitchRate - this.smoothedPitchRate) * SMOOTHING;

    // Roll around local nose (-Z in body frame). Right-hand rule around -Z:
    //   positive angle dips the right wing → bank right. So drag right → roll
    //   rate > 0 → bank right. ✓
    qRotateLocal(this.quat, 0, 0, -1, this.smoothedRollRate * dt);
    // Pitch around local right wing (+X in body frame). Right-hand rule around
    // +X: positive angle takes -Z (forward) toward +Y (up) → nose up. ✓
    qRotateLocal(this.quat, 1, 0,  0, this.smoothedPitchRate * dt);
    qNormalize(this.quat);

    // Refresh world-space body axes.
    qRotateVec(this.forward, this.quat, 0, 0, -1);
    qRotateVec(this.up,      this.quat, 0, 1,  0);
    qRotateVec(this.right,   this.quat, 1, 0,  0);

    // MSFS-style bank-to-turn — yawRate = K * tan(bank). Robust through
    // knife-edge AND past inverted:
    //
    //   horizontal lift magnitude = sqrt(1 - up.y²)        always ≥ 0
    //   vertical lift magnitude   = |up.y|, floored 0.1    no singularity at 90°
    //   turn direction            = -sign(right.y)         yaw-invariant bank dir
    //
    // At level: horiz = 0 → no yaw. At 90° bank: horiz = 1, vert ≈ 0 → capped
    // max yaw (used to STOP turning here because of an up.y > 0.05 gate; that
    // gate is gone now). Past inverted (up.y < 0), the formula still works:
    // bank magnitude comes from horiz/vert, direction from right.y sign.
    const horizMag = Math.sqrt(Math.max(0, 1 - this.up.y * this.up.y));
    const safeUpY  = Math.max(0.1, Math.abs(this.up.y));
    const turnSign = this.right.y === 0 ? 0 : -Math.sign(this.right.y);
    // Quadratic in horizMag (= sin(bank)²/cos(bank)) instead of linear tan,
    // so a tiny roll produces a tiny turn — ramps quickly only as bank deepens.
    // At 10° bank: ~5× less yaw than tan(bank); at 45°+ the two converge.
    let tanBank = (horizMag * horizMag / safeUpY) * turnSign;
    if (tanBank >  BANK_TURN_CAP) tanBank =  BANK_TURN_CAP;
    if (tanBank < -BANK_TURN_CAP) tanBank = -BANK_TURN_CAP;
    const bankYaw = -BANK_TURN_K * tanBank;
    if (bankYaw !== 0) {
      qRotateWorld(this.quat, 0, 1, 0, bankYaw * dt);
      qNormalize(this.quat);
      qRotateVec(this.forward, this.quat, 0, 0, -1);
      qRotateVec(this.up,      this.quat, 0, 1,  0);
      qRotateVec(this.right,   this.quat, 1, 0,  0);
    }

    this.fuel -= this.cfg.fuelDrainRate * dt;
    if (this.fuel <= 0) { this.fuel = 0; this.engineOff = true; }

    // --- Engine: thrust scales with altitude (natural ceiling) ---
    // Target cruise speed = maxSpeed * altFactor where altFactor falls
    // linearly from 1 at sea level to MIN_ALT_FACTOR at SERVICE_CEILING.
    // Above the ceiling, target stays at the residual minimum so high-
    // altitude flight bleeds energy unless the plane is in a dive.
    const altFactor  = Math.max(MIN_ALT_FACTOR,
      Math.min(1, 1 - this.y / SERVICE_CEILING));
    const targetSpeed = this.cfg.maxSpeed * altFactor;
    if (this.engineOff) {
      // No engine — speed bleeds off via drag.
      this.speed = Math.max(0, this.speed - ENGINE_OFF_DRAG * this.cfg.maxSpeed * dt);
    } else {
      // Throttle: speed converges toward altitude-adjusted target. Cut hard
      // while stalled (this.stalling, set last frame) — a stalled airframe is
      // high-drag, so it recovers by diving, not by thrust. Keeps the stall
      // from snapping back the instant speed nudges over the threshold.
      const resp = this.stalling ? THROTTLE_RESPONSE * STALL_THRUST_FACTOR : THROTTLE_RESPONSE;
      this.speed += (targetSpeed - this.speed) * resp * dt;
    }
    // --- Pitch transfers energy with gravity ---
    // Nose-up (forward.y > 0) climbing → gravity decelerates the plane.
    // Nose-down (forward.y < 0) diving → gravity accelerates.
    this.speed += -GRAVITY * this.forward.y * dt;
    if (this.speed < 0) this.speed = 0;

    // --- Stall ---
    // Below STALL_FRACTION of cruise the wing loses lift: the plane mushes,
    // loses altitude, and the nose drops into a dive. Hysteresis keeps it
    // stalled until speed climbs well clear (STALL_RECOVERY_MARGIN), so it
    // doesn't pop out the instant speed nudges over the threshold.
    const stallSpeed = this.cfg.maxSpeed * STALL_FRACTION;
    const wasStalling = this.stalling;
    this.stalling = !this.engineOff && (wasStalling
      ? this.speed < stallSpeed * STALL_RECOVERY_MARGIN
      : this.speed < stallSpeed);
    if (this.stalling) {
      // Intensity is floored so the effects don't fade to nothing in the
      // recovery band (speed just over stallSpeed) — the stall stays committed.
      const severity  = clamp(1 - this.speed / stallSpeed, 0, 1);
      const intensity = Math.max(0.35, severity);
      this.fallSpeed += STALL_DROP_RATE * intensity * dt;
      // Reduce control authority — deep stall ≈ half control.
      const ctrlMul = 1 - 0.5 * intensity;
      this.smoothedRollRate  *= ctrlMul;
      this.smoothedPitchRate *= ctrlMul;
      // Stalled-wing drag holds speed down while the nose is still high (NOT
      // scaled by severity, so it bites even in the recovery band). Eases to 0
      // by ~37° nose-down where the wing un-stalls — so the only way out is a
      // committed nose-down dive, and the stall costs real altitude.
      const noseHigh = clamp((0.6 + this.forward.y) / 0.6, 0, 1);   // 1 level → 0 by ~37° dive
      this.speed = Math.max(0, this.speed - STALL_DRAG_RATE * noseHigh * dt);
      // Auto nose-over toward the GROUND (world -Y), regardless of bank: a
      // stalled wing can't hold the nose up. World-frame so a banked stall still
      // drops earthward, easing off near straight-down. GATED on pilot input:
      // no input → the nose dives; pulling back (nose-up) suppresses it in
      // proportion, so the pilot holds the nose up (and keeps mushing) until
      // they release. targetPitchRate > 0 == pulling back.
      const maxUpInput = this.cfg.maxPitchRate * RESPONSIVENESS * PITCH_RATE_SCALE;
      const upInput = Math.max(0, this.targetPitchRate);
      const inputGate = 1 - Math.min(1, upInput / (maxUpInput || 1));
      const noseRate = STALL_NOSE_DOWN_RATE * intensity * inputGate;
      const f = this.forward;
      let nax = f.z, naz = -f.x;                 // forward × worldDown, horizontal axis
      const nam = Math.sqrt(nax * nax + naz * naz);
      if (nam > 1e-3) {
        nax /= nam; naz /= nam;
        const toDown = Math.acos(clamp(-f.y, -1, 1));   // remaining angle to straight-down
        const step = Math.min(noseRate * dt, toDown);
        if (step > 0) qRotateWorld(this.quat, nax, 0, naz, step);
      } else {
        // Forward is near-vertical → the world axis is degenerate; break it in
        // body frame (around the right wing) like the old behaviour.
        qRotateLocal(this.quat, 1, 0, 0, -noseRate * dt);
      }
      qNormalize(this.quat);
      qRotateVec(this.forward, this.quat, 0, 0, -1);
      qRotateVec(this.up,      this.quat, 0, 1,  0);
      qRotateVec(this.right,   this.quat, 1, 0,  0);
    } else if (this.engineOff) {
      // No engine: keep gaining fall speed at 1g (legacy behaviour).
      this.fallSpeed += GRAVITY * dt;
    } else {
      // In flight, bleed off accumulated fall speed once recovered.
      this.fallSpeed = Math.max(0, this.fallSpeed - 8 * dt);
    }

    // --- Bank-induced lift loss (unchanged) ---
    //   1   wings level         no altitude loss
    //   0   knife edge (90°)    full LIFT_LOSS_RATE drop per second
    //  -1   inverted            double LIFT_LOSS_RATE drop per second
    const liftLoss = LIFT_LOSS_RATE * (1 - this.up.y);

    this.x += this.forward.x * this.speed * dt;
    this.y += this.forward.y * this.speed * dt - liftLoss * dt - this.fallSpeed * dt;
    this.z += this.forward.z * this.speed * dt;
    this.distance += Math.abs(this.speed) * dt;

    this.x = safe(this.x); this.y = safe(this.y); this.z = safe(this.z);
    this.speed = safe(this.speed);
  }

  // Survive a shallow terrain graze (see collision.grazeVerdict). Bleeds speed,
  // lifts the plane just clear of the surface, kills the accumulated descent,
  // and redirects the nose to slide ALONG the slope (removes the into-surface
  // component of forward) so the plane scrapes off instead of crashing.
  applyGraze({ normal, surfaceY, downExtent, lossFrac }) {
    this.speed *= (1 - lossFrac);
    if (this.speed < 0) this.speed = 0;
    this.fallSpeed = 0;
    this.y = surfaceY + downExtent + GRAZE_CLEARANCE;
    const f = this.forward;
    const into = f.x * normal.x + f.y * normal.y + f.z * normal.z;   // ≤ 0 going in
    if (into < 0) {
      let tx = f.x - into * normal.x;
      let ty = f.y - into * normal.y;
      let tz = f.z - into * normal.z;
      const tm = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (tm > 1e-5) { this._reorientForward(tx / tm, ty / tm, tz / tm); }
    }
  }

  // Rotate the orientation so the nose points at the given (unit) direction,
  // preserving roll. Used by applyGraze to slide the plane along the slope.
  _reorientForward(tx, ty, tz) {
    const f = this.forward;
    let ax = f.y * tz - f.z * ty;     // axis = forward × target
    let ay = f.z * tx - f.x * tz;
    let az = f.x * ty - f.y * tx;
    const al = Math.sqrt(ax * ax + ay * ay + az * az);
    if (al < 1e-6) return;            // already aligned
    ax /= al; ay /= al; az /= al;
    const angle = Math.acos(clamp(f.x * tx + f.y * ty + f.z * tz, -1, 1));
    qRotateWorld(this.quat, ax, ay, az, angle);
    qNormalize(this.quat);
    qRotateVec(this.forward, this.quat, 0, 0, -1);
    qRotateVec(this.up,      this.quat, 0, 1,  0);
    qRotateVec(this.right,   this.quat, 1, 0,  0);
  }
}

// Pointer/keyboard input → drag offsets. Spring-loaded "stick" model: the
// stick is non-zero only while you're actively pressing/dragging — release
// returns it to zero. Combined with the integrated body-frame orientation in
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
    // Keyboard "stick" — ramps toward ±200 while held, toward 0 while released.
    // Touch/mouse uses the live drag delta directly (no ramp, instant release).
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
    // Losing window focus (cmd-tab, clicking another window) swallows the
    // keyup for any held key, leaving it "down" forever while the game keeps
    // running — the plane then flies itself into the ground.
    addEventListener('blur', () => {
      this.kb.left = this.kb.right = this.kb.up = this.kb.down = 0;
    });
  }

  resetStick() {
    this.kbStickX = 0;
    this.kbStickY = 0;
    this.active = false;     // ignore any in-progress drag from the previous run
  }

  read(dt = 1 / 60) {
    if (this.active && performance.now() - this.lastEventAt > 2000) this.active = false;
    // Ramp tuned as 6 px/frame at 60 fps; scale by dt so a 120 Hz display
    // doesn't get 2× snappier keyboard deflection than a 30 fps phone.
    const KB_RAMP = 360 * dt;
    if (this.kb.right)     this.kbStickX = Math.min( 200, this.kbStickX + KB_RAMP);
    else if (this.kb.left) this.kbStickX = Math.max(-200, this.kbStickX - KB_RAMP);
    else this.kbStickX = (this.kbStickX > 0) ? Math.max(0, this.kbStickX - KB_RAMP) : Math.min(0, this.kbStickX + KB_RAMP);
    if (this.kb.down)      this.kbStickY = Math.min( 200, this.kbStickY + KB_RAMP);
    else if (this.kb.up)   this.kbStickY = Math.max(-200, this.kbStickY - KB_RAMP);
    else this.kbStickY = (this.kbStickY > 0) ? Math.max(0, this.kbStickY - KB_RAMP) : Math.min(0, this.kbStickY + KB_RAMP);
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

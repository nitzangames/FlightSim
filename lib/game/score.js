// Trick-based scoring (stars ★).
//
// One-shot tricks (paid on completion):
//   • LOOP        — cumulative pitch rotation of 2π without breaking
//   • BARREL ROLL — cumulative roll rotation of 2π without breaking
//
// Continuous bonuses (paid per second while the condition holds):
//   • INVERTED — plane's up vector pointing down (up.y below 0)
//   • LOW      — altitude AGL within a low-flying band
// The continuous bonuses stack ADDITIVELY: hold both at once and the
// rates add up, so flying inverted just over the deck earns the most.
//
// Stars persist to localStorage so the player keeps what they earn
// across crashes, plane swaps, page reloads.

const LS_KEY = 'flightsim.stars';

// Inverted: ramps from 0 at level (up.y = 0) to full at up.y ≤ -0.5.
// 0.5 corresponds to ~120° bank — past true vertical knife-edge.
const INVERTED_THRESHOLD = -0.5;
const INVERTED_RATE      = 2;       // ★/s at full inversion

// Low altitude: full bonus below LOW_FULL_AGL, linear ramp up to no
// bonus at LOW_NONE_AGL. LOW_MIN_AGL excludes "actively crashing"
// from the bonus (the plane has clipped the ground).
const LOW_MIN_AGL  = 4;
const LOW_FULL_AGL = 30;
const LOW_NONE_AGL = 100;
const LOW_RATE     = 2;             // ★/s at full low

// One-shot trick rewards.
const LOOP_REWARD        = 100;
const BARREL_ROLL_REWARD = 75;

// Discovery reward — paid once per POI the player flies through for the
// first time ever. Visited state persists in localStorage, so a POI you've
// already explored never pays out again (which is the intent — "new" means
// new to this save).
const DISCOVERY_REWARD   = 1000;

// When the player isn't actively rotating (smoothed rate below the
// threshold), the accumulator decays back to zero. Prevents slow
// oscillation from inching up to 2π over many seconds.
const ROTATION_DECAY_RATE_PER_S = 1.5;
const ROTATION_IDLE_THRESHOLD   = 0.10;   // rad/s

// How often (seconds) to flush stars to localStorage. Frequent enough
// to survive a crash → reload, infrequent enough not to thrash the
// disk. saveNow() forces a flush on tab close.
const SAVE_INTERVAL_S = 2.0;

function loadStars() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return 0;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}
function saveStars(s) {
  try { localStorage.setItem(LS_KEY, String(Math.floor(s))); } catch {}
}

export class ScoreTracker {
  constructor() {
    this.stars = loadStars();
    this.pitchAccum = 0;            // signed cumulative pitch rotation
    this.rollAccum  = 0;            // signed cumulative roll rotation
    this.flash      = null;         // { text, t } centre-banner pop-up
    this._saveAccum = 0;
    // Pay-out gating: a reward only fires once per "deliberate" trick.
    // After each loop / barrel-roll reward, the corresponding _ready flag
    // is cleared and only re-armed when the player STOPS rotating (rate
    // below the idle threshold). So holding the stick pinned keeps
    // spinning the plane but only the first revolution pays out — to earn
    // another reward you have to release/centre and start a fresh trick.
    this._pitchReady = true;
    this._rollReady  = true;
  }

  // physics: PlanePhysics instance (uses .up, .x, .y, .z, .smoothedPitchRate, .smoothedRollRate)
  // terrain: terrain instance (uses .getHeight)
  // dt: seconds since last frame
  // Returns {stars, earnedThisFrame, bonuses:[{label, rate}], flash}
  update(physics, terrain, dt) {
    let earned = 0;
    const bonuses = [];

    // --- LOW altitude bonus ---
    // Earned continuously while flying close to the terrain. LOW is the
    // GATE for the INVERTED bonus below — you only get credit for
    // upside-down flight when you're already paying the LOW bonus.
    const groundY = terrain.getHeight(physics.x, physics.z);
    const altAGL  = physics.y - groundY;
    let lowFactor = 0;
    if (altAGL > LOW_MIN_AGL && altAGL < LOW_NONE_AGL) {
      if (altAGL <= LOW_FULL_AGL) lowFactor = 1;
      else lowFactor = (LOW_NONE_AGL - altAGL) / (LOW_NONE_AGL - LOW_FULL_AGL);
      const rate = LOW_RATE * lowFactor;
      earned += rate * dt;
      bonuses.push({ label: 'LOW', rate });
    }

    // --- INVERTED bonus (gated on LOW) ---
    // up.y = +1 when level upright, -1 when fully inverted. Only pays
    // out when LOW is already active — flying upside down at altitude
    // doesn't earn anything by itself; the risk is the proximity to
    // the ground, the inversion is the multiplier on that risk.
    if (lowFactor > 0 && physics.up.y < 0) {
      // Ramp factor 0 (at up.y=0) → 1 (at up.y ≤ INVERTED_THRESHOLD).
      let t = physics.up.y / INVERTED_THRESHOLD;
      if (t > 1) t = 1;
      if (t > 0.05) {
        // Also scale by lowFactor so the inverted bonus tapers off as
        // the player climbs out of the low-altitude band.
        const rate = INVERTED_RATE * t * lowFactor;
        earned += rate * dt;
        bonuses.push({ label: 'INVERTED', rate });
      }
    }

    // --- LOOP detection ---
    // Integrate body-pitch angular velocity. When the accumulator hits
    // ±2π the player has completed a full vertical revolution.
    // Reward only fires if _pitchReady — see constructor for the gating.
    this.pitchAccum += physics.smoothedPitchRate * dt;
    if (Math.abs(this.pitchAccum) >= 2 * Math.PI) {
      if (this._pitchReady) {
        earned += LOOP_REWARD;
        this.flash = { text: `+${LOOP_REWARD} ★ LOOP!`, t: 1.6 };
        this._pitchReady = false;
      }
      // Always wrap the accumulator (paid or not) so the integrator stays
      // in [-2π, +2π] and the next pay-out condition has to be re-earned.
      this.pitchAccum -= Math.sign(this.pitchAccum) * 2 * Math.PI;
    }
    // Re-arm the reward (and decay the accumulator) once the player
    // stops actively rotating around the pitch axis.
    if (Math.abs(physics.smoothedPitchRate) < ROTATION_IDLE_THRESHOLD) {
      this._pitchReady = true;
      const decay = Math.max(0, 1 - ROTATION_DECAY_RATE_PER_S * dt);
      this.pitchAccum *= decay;
    }

    // --- BARREL ROLL detection --- (mirror of LOOP, on the roll axis)
    this.rollAccum += physics.smoothedRollRate * dt;
    if (Math.abs(this.rollAccum) >= 2 * Math.PI) {
      if (this._rollReady) {
        earned += BARREL_ROLL_REWARD;
        this.flash = { text: `+${BARREL_ROLL_REWARD} ★ BARREL ROLL!`, t: 1.6 };
        this._rollReady = false;
      }
      this.rollAccum -= Math.sign(this.rollAccum) * 2 * Math.PI;
    }
    if (Math.abs(physics.smoothedRollRate) < ROTATION_IDLE_THRESHOLD) {
      this._rollReady = true;
      const decay = Math.max(0, 1 - ROTATION_DECAY_RATE_PER_S * dt);
      this.rollAccum *= decay;
    }

    this.stars += earned;

    // Periodic save.
    this._saveAccum += dt;
    if (this._saveAccum >= SAVE_INTERVAL_S) {
      saveStars(this.stars);
      this._saveAccum = 0;
    }

    // Flash timer.
    if (this.flash) {
      this.flash.t -= dt;
      if (this.flash.t <= 0) this.flash = null;
    }

    return {
      stars: this.stars,
      earnedThisFrame: earned,
      bonuses,
      flash: this.flash,
    };
  }

  // Deduct stars to pay for an unlock. Returns true if the balance was
  // sufficient (and the deduction + persist completed), false otherwise
  // (and the balance is unchanged). Flushes to localStorage immediately
  // so a crash mid-transaction doesn't lose the spend.
  spendStars(amount) {
    if (this.stars < amount) return false;
    this.stars -= amount;
    saveStars(this.stars);
    return true;
  }

  // Award the one-shot discovery bonus for a new POI fly-through. Called
  // from the shell loop with one call per POI the markers system reported
  // as discovered this frame.
  awardDiscovery() {
    this.stars += DISCOVERY_REWARD;
    this.flash = { text: `+${DISCOVERY_REWARD} ★ NEW POI!`, t: 2.0 };
  }

  // Force-flush to localStorage. Hook into the pagehide event so we
  // don't lose the last second of earnings when the tab closes.
  saveNow() { saveStars(this.stars); }
}

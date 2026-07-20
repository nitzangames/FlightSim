// Trick-based scoring (stars ★).
//
// Repeating tricks (paid every full revolution):
//   • LOOP        — every 2π of cumulative pitch rotation
//   • BARREL ROLL — every 2π of cumulative roll rotation
// Hold the stick pinned and the rewards keep coming; the integrator is
// reset to 0 on each pay-out so the next revolution earns from scratch.
//
// Continuous bonuses (paid per second while the condition holds):
//   • INVERTED — plane's up vector pointing down (up.y below 0). Pays at
//                any altitude — the risk is being upside down, full stop.
//   • LOW      — altitude AGL within a low-flying band.
// The continuous bonuses stack ADDITIVELY: hold both at once and the
// rates add up, so flying inverted just over the deck earns the most.
//
// Stars persist via the storage helper (PlaySDK cloud + localStorage fallback)
// so the player keeps what they earn across crashes, plane swaps, page reloads,
// and — critically on mobile — across iframe storage evictions by iOS Safari.

import { loadKey, saveKey, updateKeyDurable } from './storage.js';

export const STARS_KEY = 'flightsim.stars';

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
const LOW_RATE     = 10;            // ★/s at full low

// One-shot trick rewards.
const LOOP_REWARD        = 200;
const BARREL_ROLL_REWARD = 150;

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

// Async preload — call once at boot and pass the result into the ScoreTracker
// constructor. Falls back to a raw localStorage read inside the storage helper
// when PlaySDK isn't around (tests, local dev).
function parseStarState(raw) {
  if (!raw) return { stars: 0, fulfilledNbucksReceipts: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        stars: Number.isFinite(parsed.stars) ? parsed.stars : 0,
        fulfilledNbucksReceipts: Array.isArray(parsed.fulfilledNbucksReceipts)
          ? parsed.fulfilledNbucksReceipts.filter(id => typeof id === 'string')
          : [],
      };
    }
  } catch {}
  // Backward compatibility with the original primitive-number save format.
  const n = parseFloat(raw);
  return { stars: Number.isFinite(n) ? n : 0, fulfilledNbucksReceipts: [] };
}

export async function loadStarState() {
  try { return parseStarState(await loadKey(STARS_KEY)); }
  catch { return { stars: 0, fulfilledNbucksReceipts: [] }; }
}

export async function loadStars() {
  return (await loadStarState()).stars;
}

function serializedStarState(stars, receipts) {
  return JSON.stringify({
    stars: Math.floor(stars),
    fulfilledNbucksReceipts: [...receipts],
  });
}

function saveStars(stars, receipts) {
  saveKey(STARS_KEY, serializedStarState(stars, receipts));
}

export class ScoreTracker {
  constructor(initialStars = 0, fulfilledNbucksReceipts = []) {
    this.stars = initialStars;
    this._fulfilledNbucksReceipts = new Set(fulfilledNbucksReceipts);
    // Remember the loaded baseline so the periodic auto-save can refuse to
    // overwrite a (possibly real) cloud save with our in-memory value when
    // nothing has actually changed this session. Critical because PlaySDK.load
    // can return null for a transient reason (auth race, brief network drop)
    // and we'd otherwise auto-write 0 over a real high-score, with no server-
    // side history to recover from. See incident 2026-05-29.
    this._initialStars = initialStars;
    this.pitchAccum = 0;            // signed cumulative pitch rotation
    this.rollAccum  = 0;            // signed cumulative roll rotation
    this.flash      = null;         // { text, t } centre-banner pop-up
    this._saveAccum = 0;
  }

  // physics: PlanePhysics instance (uses .up, .x, .y, .z, .smoothedPitchRate, .smoothedRollRate)
  // terrain: terrain instance (uses .getHeight)
  // dt: seconds since last frame
  // Returns {stars, earnedThisFrame, bonuses:[{label, rate}], flash}
  update(physics, terrain, dt) {
    let earned = 0;
    const bonuses = [];

    // --- LOW altitude bonus ---
    // Earned continuously while flying close to the terrain.
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

    // --- INVERTED bonus ---
    // up.y = +1 when level upright, -1 when fully inverted. Pays out at
    // any altitude — flying inverted is its own thrill and we don't want
    // to discourage barrel-roll victory laps at altitude.
    if (physics.up.y < 0) {
      // Ramp factor 0 (at up.y=0) → 1 (at up.y ≤ INVERTED_THRESHOLD).
      let t = physics.up.y / INVERTED_THRESHOLD;
      if (t > 1) t = 1;
      if (t > 0.05) {
        const rate = INVERTED_RATE * t;
        earned += rate * dt;
        bonuses.push({ label: 'INVERTED', rate });
      }
    }

    // --- LOOP detection ---
    // Integrate body-pitch angular velocity. Every ±2π pays the reward
    // and the accumulator wraps so the next revolution earns from 0 again.
    this.pitchAccum += physics.smoothedPitchRate * dt;
    if (Math.abs(this.pitchAccum) >= 2 * Math.PI) {
      earned += LOOP_REWARD;
      this.flash = { text: `+${LOOP_REWARD} ★ LOOP!`, t: 1.6 };
      this.pitchAccum -= Math.sign(this.pitchAccum) * 2 * Math.PI;
    }
    // Decay the accumulator while the player isn't actively rotating so
    // slow oscillation can't inch up to 2π over many seconds.
    if (Math.abs(physics.smoothedPitchRate) < ROTATION_IDLE_THRESHOLD) {
      const decay = Math.max(0, 1 - ROTATION_DECAY_RATE_PER_S * dt);
      this.pitchAccum *= decay;
    }

    // --- BARREL ROLL detection --- (mirror of LOOP, on the roll axis)
    this.rollAccum += physics.smoothedRollRate * dt;
    if (Math.abs(this.rollAccum) >= 2 * Math.PI) {
      earned += BARREL_ROLL_REWARD;
      this.flash = { text: `+${BARREL_ROLL_REWARD} ★ BARREL ROLL!`, t: 1.6 };
      this.rollAccum -= Math.sign(this.rollAccum) * 2 * Math.PI;
    }
    if (Math.abs(physics.smoothedRollRate) < ROTATION_IDLE_THRESHOLD) {
      const decay = Math.max(0, 1 - ROTATION_DECAY_RATE_PER_S * dt);
      this.rollAccum *= decay;
    }

    this.stars += earned;

    // Periodic save. Only writes when the value has CHANGED from what we
    // loaded — see constructor for why this gate is load-bearing.
    this._saveAccum += dt;
    if (this._saveAccum >= SAVE_INTERVAL_S) {
      if (this.stars !== this._initialStars) saveStars(this.stars, this._fulfilledNbucksReceipts);
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

  // Forget partial loop/roll progress and any pending flash banner. Called on
  // respawn — without this, crashing at 350° of a loop lets the next flight
  // collect the full reward after a few degrees of rotation (the idle decay
  // only runs inside update(), which is skipped during CRASH/MENU/countdown).
  resetTricks() {
    this.pitchAccum = 0;
    this.rollAccum = 0;
    this.flash = null;
  }

  // Deduct stars to pay for an unlock. Returns true if the balance was
  // sufficient (and the deduction + persist completed), false otherwise
  // (and the balance is unchanged). Flushes to localStorage immediately
  // so a crash mid-transaction doesn't lose the spend.
  spendStars(amount) {
    // `!(amount > 0)` also rejects NaN/undefined — `this.stars < NaN` is
    // false, so without it the subtraction would corrupt the balance to NaN,
    // which persists and loads back as 0 next session (total wipe).
    if (!(amount > 0) || this.stars < amount) return false;
    this.stars -= amount;
    saveStars(this.stars, this._fulfilledNbucksReceipts);
    return true;
  }

  // Credit stars purchased in the menu store (NBucks → stars exchange).
  // The NBucks charge has already been confirmed by the caller via
  // PlaySDK.nbucks.spend; this only adds the granted stars and flushes
  // immediately so a crash right after the purchase can't lose them.
  addStars(amount) {
    if (!(amount > 0)) return;
    this.stars += amount;
    saveStars(this.stars, this._fulfilledNbucksReceipts);
  }

  // NBucks fulfillment boundary. Store the receipt alongside the balance so a
  // replay cannot grant the additive star pack twice, and do not let the SDK
  // commit the reservation until the combined state has persisted.
  async fulfillPurchasedStars(amount, receiptId) {
    if (!(amount > 0)) throw new Error('invalid star purchase');
    const id = typeof receiptId === 'string' ? receiptId : null;
    if (id && this._fulfilledNbucksReceipts.has(id)) return false;
    const saved = await updateKeyDurable(STARS_KEY, (currentRaw) => {
      const current = currentRaw
        ? parseStarState(currentRaw)
        : { stars: this.stars, fulfilledNbucksReceipts: [...this._fulfilledNbucksReceipts] };
      const receipts = new Set(current.fulfilledNbucksReceipts);
      if (id && receipts.has(id)) return serializedStarState(current.stars, receipts);
      if (id) receipts.add(id);
      return serializedStarState(current.stars + amount, receipts);
    });
    const committed = parseStarState(saved);
    this.stars = committed.stars;
    this._fulfilledNbucksReceipts = new Set(committed.fulfilledNbucksReceipts);
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
  // don't lose the last second of earnings when the tab closes. Same
  // unchanged-from-load gate as the periodic save — pagehide also fires
  // on a session where the player flew briefly without earning anything,
  // and we mustn't overwrite the real cloud save in that case.
  saveNow() {
    if (this.stars !== this._initialStars) saveStars(this.stars, this._fulfilledNbucksReceipts);
  }
}

// Plane roster for the sandbox. Stats are the CanyonRun3D `base` values, with
// `fuelDrainRate` zeroed so the engine never quits. coinValue / magnetRadius /
// coinMultiplier from CanyonRun's upgrades config are deleted — unused here.

import { buildBiplane }    from '../plane/biplane.js';
import { buildTriplane }   from '../plane/triplane.js';
import { buildWW2Fighter } from '../plane/ww2-fighter.js';
import { buildP51 }        from '../plane/p51.js';
import { buildF86 }        from '../plane/f86.js';
import { buildF4 }         from '../plane/f4.js';
import { buildA10 }        from '../plane/a10.js';
import { buildF16 }        from '../plane/f16.js';
import { buildF18 }        from '../plane/f18.js';
import { buildF15 }        from '../plane/f15.js';
import { buildF22 }        from '../plane/f22.js';
import { buildSR71 }       from '../plane/sr71.js';

// Per-plane character is expressed through three handling stats that the
// controller actually consumes:
//   • maxSpeed       — cruise speed at sea level (engine performance falls
//                      off with altitude in controller.js).
//   • maxPitchRate   — how fast the nose can pitch up/down (== climb rate).
//   • maxYawRate     — bound to roll in controller.js, so this drives roll
//                      AND (via bank-to-turn) the turn rate.
// Differentiating pitch from roll per plane lets us shape feel:
//   biplane   — slow, balanced WWI trainer
//   triplane  — slowest but most agile (Dr.I dogfighter)
//   ww2       — fast-for-prop, balanced
//   f86       — fast jet, less agile than props at low speeds
//   f15       — fastest, heavy, sluggish to climb / roll
//   f22       — fast AND agile (thrust-vectoring fighter)
// Unlock cost helpers — every plane has an `unlock` field whose `kind` is
// one of 'free' (always unlocked, biplane only), 'stars' (deducted from
// the in-game ScoreTracker), or 'nbucks' (charged via PlaySDK.nbucks.spend
// on the platform — premium gate).
const free       = { kind: 'free' };
const stars      = (amount) => ({ kind: 'stars',  amount });
const nbucks     = (amount) => ({ kind: 'nbucks', amount });

export const PLANES = {
  // collisionRadius   = horizontal half-extent (wingtip / fuselage half-width)
  // vertRadius        = vertical half-extent in plane-local coords (max of top
  //                     and bottom extents from the model origin). Used by
  //                     collision.js to project the plane's bounding ellipsoid
  //                     onto world-down so inverted flight clears the ground
  //                     correctly — see comments in collision.js.
  biplane:  { key:'biplane',  name:'WW1 Biplane',   build: buildBiplane,    unlock: free,            stats: { maxSpeed:  55, maxPitchRate: 0.55, maxYawRate: 0.65, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 4.5, vertRadius: 1.4 } },
  triplane: { key:'triplane', name:'WW1 Triplane',  build: buildTriplane,   unlock: stars(1000),     stats: { maxSpeed:  50, maxPitchRate: 0.75, maxYawRate: 0.85, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 3.5, vertRadius: 1.7 } },
  ww2:      { key:'ww2',      name:'Spitfire',      build: buildWW2Fighter, unlock: stars(2000),     stats: { maxSpeed:  95, maxPitchRate: 0.60, maxYawRate: 0.55, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 5.5, vertRadius: 1.2 } },
  // P-51 is the faster, longer-ranged WWII escort fighter (Merlin V-12).
  // Slightly less agile than the lighter Spitfire but a notable climb
  // upgrade in speed.
  p51:      { key:'p51',      name:'P-51 Mustang',  build: buildP51,        unlock: stars(5000),     stats: { maxSpeed: 115, maxPitchRate: 0.55, maxYawRate: 0.55, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 5.5, vertRadius: 1.5 } },
  f86:      { key:'f86',      name:'F-86 Sabre',    build: buildF86,        unlock: stars(10000),    stats: { maxSpeed: 130, maxPitchRate: 0.45, maxYawRate: 0.55, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 3.9, vertRadius: 1.8 } },
  // F-4 is the Vietnam-era twin-engine heavy fighter — fast, hard-hitting,
  // not particularly agile. "Phantoms accelerate, they don't turn."
  f4:       { key:'f4',       name:'F-4 Phantom',   build: buildF4,         unlock: stars(17500),    stats: { maxSpeed: 155, maxPitchRate: 0.50, maxYawRate: 0.50, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 6.2, vertRadius: 1.8 } },
  // A-10 is the close-air-support jet — slowest jet in the roster but
  // surprisingly maneuverable at low speed, with the widest wingspan.
  a10:      { key:'a10',      name:'A-10 Warthog',  build: buildA10,        unlock: stars(25000),    stats: { maxSpeed: 120, maxPitchRate: 0.65, maxYawRate: 0.60, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 8.5, vertRadius: 1.5 } },
  // F-16 is the 4th-gen "viper" — very agile fly-by-wire single-engine.
  f16:      { key:'f16',      name:'F-16 Falcon',   build: buildF16,        unlock: stars(35000),    stats: { maxSpeed: 145, maxPitchRate: 0.65, maxYawRate: 0.75, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 4.6, vertRadius: 1.8 } },
  // F-18 is heavier twin-engine carrier fighter, less raw agility than F-16
  // but excellent high-alpha character.
  f18:      { key:'f18',      name:'F-18 Hornet',   build: buildF18,        unlock: stars(42500),    stats: { maxSpeed: 145, maxPitchRate: 0.55, maxYawRate: 0.65, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 4.5, vertRadius: 1.6 } },
  f15:      { key:'f15',      name:'F-15 Eagle',    build: buildF15,        unlock: stars(50000),    stats: { maxSpeed: 175, maxPitchRate: 0.35, maxYawRate: 0.40, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 5.6, vertRadius: 1.6 } },
  // Premium gates: F-22 + SR-71 are NBucks (platform hard currency). The
  // F-22 sits just past the F-15 star tier so it's the natural "I'll pay
  // a little" pick, and the SR-71 is the trophy.
  f22:      { key:'f22',      name:'F-22 Raptor',   build: buildF22,        unlock: nbucks(200),     stats: { maxSpeed: 165, maxPitchRate: 0.70, maxYawRate: 0.75, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 4.5, vertRadius: 1.3 } },
  // SR-71 is the fastest plane in the roster — Mach 3+ in reality, but
  // designed for sustained high-altitude cruise, not dogfighting. Pitch
  // and roll rates are the worst here on purpose: it goes straight, fast.
  sr71:     { key:'sr71',     name:'SR-71 Blackbird', build: buildSR71,     unlock: nbucks(300),     stats: { maxSpeed: 300, maxPitchRate: 0.25, maxYawRate: 0.30, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 5.6, vertRadius: 1.2 } },
};

// Menu cycle order: rough historical progression (WWI props → WWII props
// → 1950s → Vietnam → modern multi-role → Mach 3 specialty at the end).
export const PLANE_ORDER = ['biplane', 'triplane', 'ww2', 'p51', 'f86', 'f4', 'a10', 'f16', 'f18', 'f15', 'f22', 'sr71'];

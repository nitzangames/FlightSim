// Plane roster for the sandbox. Stats are the CanyonRun3D `base` values, with
// `fuelDrainRate` zeroed so the engine never quits. coinValue / magnetRadius /
// coinMultiplier from CanyonRun's upgrades config are deleted — unused here.

import { buildBiplane }    from '../plane/biplane.js';
import { buildTriplane }   from '../plane/triplane.js';
import { buildWW2Fighter } from '../plane/ww2-fighter.js';
import { buildF86 }        from '../plane/f86.js';
import { buildF15 }        from '../plane/f15.js';
import { buildF22 }        from '../plane/f22.js';

export const PLANES = {
  biplane:  { key:'biplane',  name:'WW1 Biplane',   build: buildBiplane,    stats: { maxSpeed: 60,  maxPitchRate: 0.45, maxYawRate: 0.45, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 3.7 } },
  triplane: { key:'triplane', name:'WW1 Triplane',  build: buildTriplane,   stats: { maxSpeed: 75,  maxPitchRate: 0.55, maxYawRate: 0.55, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 3.2 } },
  ww2:      { key:'ww2',      name:'WW2 Fighter',   build: buildWW2Fighter, stats: { maxSpeed: 95,  maxPitchRate: 0.55, maxYawRate: 0.55, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 5.7 } },
  f86:      { key:'f86',      name:'F-86 Sabre',    build: buildF86,        stats: { maxSpeed: 130, maxPitchRate: 0.65, maxYawRate: 0.65, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 4.5 } },
  f15:      { key:'f15',      name:'F-15 Eagle',    build: buildF15,        stats: { maxSpeed: 160, maxPitchRate: 0.75, maxYawRate: 0.75, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 6.5 } },
  f22:      { key:'f22',      name:'F-22 Raptor',   build: buildF22,        stats: { maxSpeed: 200, maxPitchRate: 0.85, maxYawRate: 0.85, fuelDrainRate: 0, maxFuel: 1, collisionRadius: 6.8 } },
};

export const PLANE_ORDER = ['biplane', 'triplane', 'ww2', 'f86', 'f15', 'f22'];

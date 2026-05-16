// Forest-biome village template. Other biomes (desert, arctic) will add their
// own templates here later; the registry iterates all enabled templates.

export const FOREST_TEMPLATE = {
  key: 'forest',
  biome: 'forest',
  altitudeRange: [10, 80],     // meters; village pad must sit here
  riverClearance: 600,         // meters; cell center must be >= this from any river segment
  baseProbability: 0.12,       // tunable; with biome+altitude+clearance gates ~70 villages
  sizeTiers: {
    S: { rollMax: 0.55, buildingCount: [4, 5], padRadius: 25 },
    M: { rollMax: 0.85, buildingCount: [7, 9], padRadius: 35 },
    L: { rollMax: 1.00, buildingCount: [11, 14], padRadius: 50 },
  },
  // Palette: 3 wall creams, 3 roof rust/browns. layout picks per-village tones.
  palette: {
    walls: [[0.95, 0.89, 0.76], [0.90, 0.83, 0.66], [0.87, 0.77, 0.59]],
    roofs: [[0.61, 0.23, 0.17], [0.48, 0.18, 0.13], [0.66, 0.29, 0.21]],
    accents: [[0.42, 0.29, 0.16]], // dock + windmill timber
  },
  buildings: ['house', 'barn', 'windmill', 'church'],
};

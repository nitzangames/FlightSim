// Castle template — placed on ridges / high ground (vs villages in lowland).
// Biome-restricted to forest + arctic (no desert castles). Each castle has a
// fixed building roster (keep + 4 towers + 4 wall segments + chapel), so size
// tiers aren't needed.

export const CASTLE_TEMPLATE = {
  key: 'castle',
  biomes: ['forest', 'arctic'],   // multi-biome — villages.js handles this
  altitudeRange: [80, 320],
  baseProbability: 0.12,          // see forest.js — equal across all 6 templates
  // Single tier — the roller in villages.js picks 'S' for compatibility but
  // it's effectively ignored; castle layout uses fixed building counts.
  sizeTiers: {
    S: { rollMax: 1.00, buildingCount: [10, 10], padRadius: 70 },
  },
  palette: {
    walls:   [[0.62, 0.62, 0.60], [0.55, 0.55, 0.54], [0.68, 0.68, 0.66]], // stone
    roofs:   [[0.25, 0.28, 0.32], [0.20, 0.23, 0.28], [0.32, 0.30, 0.30]], // slate
    accents: [[0.30, 0.25, 0.20]],
  },
  buildings: ['castle_keep', 'castle_tower', 'castle_wall', 'castle_chapel'],
};

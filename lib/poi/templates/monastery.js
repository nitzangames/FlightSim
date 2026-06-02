// Monastery — high-arctic landmark. Fixed roster: 1 church + 3 cloister
// wings arranged in a U around the south side. Whitewashed walls, dark
// slate roofs, tall bell tower with a spire for a distinctive silhouette
// visible from far away.

export const MONASTERY_TEMPLATE = {
  key: 'monastery',
  biomes: ['arctic'],
  altitudeRange: [180, 400],
  baseProbability: 0.12,         // see forest.js — equal across all 6 templates.
                                 // Resulting count will still be lower than the
                                 // others because the 180-400 m altitude band
                                 // intersected with arctic-only is narrow.
  sizeTiers: {
    S: { rollMax: 1.00, buildingCount: [4, 4], padRadius: 55 },
  },
  palette: {
    walls:   [[0.94, 0.92, 0.88], [0.90, 0.88, 0.84]],   // whitewashed
    roofs:   [[0.20, 0.24, 0.34], [0.16, 0.20, 0.30]],   // dark slate
    accents: [[0.15, 0.18, 0.25]],
  },
  buildings: ['monastery_church', 'monastery_wing'],
};

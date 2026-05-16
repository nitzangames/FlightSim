# Forest Village POI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add procedurally placed forest-biome villages (50–70 per 64 km world, three size tiers, deterministic per seed) to FlightSim, integrated with the existing chunk + biome pipeline.

**Architecture:** Three independently testable units — placement (anchor grid scan, pure JS), layout (per-village procedural building list, pure JS), rendering (THREE InstancedMesh per chunk × type, with shared `buildingMaterial`). Villages plug into chunk-build for terrain flattening + tree exclusion, and into chunk-manager for InstancedMesh assembly + LOD shrink-fade.

**Tech Stack:** vanilla JS ES modules (existing pattern), THREE.js r128 via CDN, vitest for unit tests, no build step.

**Spec:** `docs/superpowers/specs/2026-05-16-flightsim-village-poi-design.md`

---

## File structure

**Create:**
- `lib/poi/hash.js` — `hash3(a, b, s) → [0, 1)` deterministic integer hash.
- `lib/poi/templates/forest.js` — `FOREST_TEMPLATE` config (biome, altitude band, size tiers, palette).
- `lib/poi/villages.js` — `buildVillageRegistry({ seed, biomeAt, riverSegments, terrainHeightFn })` → `{ all, inChunk, affectingChunk }`.
- `lib/poi/village-layout.js` — `layoutVillage(village)` → `BuildingInstance[]`.
- `lib/poi/buildings.js` — `buildHouseGeometry(THREE)`, `buildBarnGeometry`, `buildWindmillTowerGeometry`, `buildWindmillBladeGeometry`, `buildChurchGeometry`. Each returns `THREE.BufferGeometry` with `position` + `normal` + `colorRole` attributes.
- `tests/poi/hash.test.js`
- `tests/poi/villages.test.js`
- `tests/poi/village-layout.test.js`

**Modify:**
- `lib/terrain/index.js` — build registry, create `buildingMaterial` + `windmillBladeMaterial`, drive `uTime` for blades, pass registry + materials to `ChunkManager`.
- `lib/terrain/chunk-worker-proxy.js` — pass village list to worker job payload.
- `lib/terrain/chunk-runner.js` — same passthrough for main-thread fallback.
- `lib/terrain/chunk-worker.js` — receive village data, hand to `buildChunkBuffers`.
- `lib/terrain/chunk-build.js` — flatten terrain in village pads, exclude trees, emit `buildings` map.
- `lib/terrain/chunk-manager.js` — assemble InstancedMesh per (chunk × building type), dispose on eviction.
- `lib/version.js` — bump `v0.1.58 → v0.1.59`.
- `package.json` — bump `0.1.58 → 0.1.59`.
- `.zipignore` — keep `poi-mockups.html` excluded (already done).

---

## Phase 1 — Foundation (pure JS, unit-tested)

### Task 1: Hash utility

**Files:**
- Create: `lib/poi/hash.js`
- Create: `tests/poi/hash.test.js`

- [ ] **Step 1: Write the failing test**

`tests/poi/hash.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { hash3 } from '../../lib/poi/hash.js';

describe('hash3', () => {
  it('returns a value in [0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const v = hash3(i, i * 2, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic across calls', () => {
    expect(hash3(7, 13, 42)).toBe(hash3(7, 13, 42));
  });

  it('differs for different inputs', () => {
    const a = hash3(0, 0, 42);
    const b = hash3(1, 0, 42);
    const c = hash3(0, 1, 42);
    const d = hash3(0, 0, 43);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });

  it('distributes roughly uniformly across [0, 1)', () => {
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const v = hash3(i, 0, 1);
      buckets[Math.min(3, Math.floor(v * 4))]++;
    }
    for (const b of buckets) expect(b).toBeGreaterThan(800); // each bucket > 20% of expected 1000
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd /Users/nitzanwilnai/Programming/Claude/JSGames/FlightSim && npm test -- tests/poi/hash.test.js
```
Expected: `Cannot find module '../../lib/poi/hash.js'`.

- [ ] **Step 3: Implement hash**

`lib/poi/hash.js`:
```js
// Deterministic uint32 hash → [0, 1). Used by placement, size tier, and palette
// rolls — three independent hashes per anchor cell, all seeded by the world seed.
export function hash3(a, b, s) {
  let h = (a | 0) * 73856093;
  h = (h ^ ((b | 0) * 19349663)) >>> 0;
  h = (h ^ (s | 0)) >>> 0;
  // Avalanche
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0x100000000;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npm test -- tests/poi/hash.test.js
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/poi/hash.js tests/poi/hash.test.js
git commit -m "feat(poi): hash3 deterministic [0,1) utility for village placement"
```

---

### Task 2: Forest template config

**Files:**
- Create: `lib/poi/templates/forest.js`

- [ ] **Step 1: Write template**

`lib/poi/templates/forest.js`:
```js
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/poi/templates/forest.js
git commit -m "feat(poi): FOREST_TEMPLATE config (biome, altitude, palette, size tiers)"
```

---

### Task 3: Village registry

**Files:**
- Create: `lib/poi/villages.js`
- Create: `tests/poi/villages.test.js`

- [ ] **Step 1: Write the failing test**

`tests/poi/villages.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { buildVillageRegistry, WORLD_SIZE, CELL_SIZE } from '../../lib/poi/villages.js';

// Fake forest-everywhere biome + flat-30m terrain + no rivers.
const allForest = () => ({ key: 'forest' });
const flatTerrain = () => 30;
const noRivers = () => 0;
const opts = { seed: 42, biomeAt: allForest, terrainHeightFn: flatTerrain, riverDepthAtFn: noRivers };

describe('buildVillageRegistry', () => {
  it('produces a deterministic Village[] for a given seed', () => {
    const a = buildVillageRegistry(opts).all;
    const b = buildVillageRegistry(opts).all;
    expect(a.length).toBe(b.length);
    expect(a[0]).toEqual(b[0]);
  });

  it('produces fewer villages when no forest biome', () => {
    const r = buildVillageRegistry({ ...opts, biomeAt: () => ({ key: 'desert' }) }).all;
    expect(r.length).toBe(0);
  });

  it('produces fewer villages when terrain out of altitude band', () => {
    const r = buildVillageRegistry({ ...opts, terrainHeightFn: () => 200 }).all;
    expect(r.length).toBe(0);
  });

  it('produces villages with valid size tiers + pad radius', () => {
    const r = buildVillageRegistry(opts).all;
    expect(r.length).toBeGreaterThan(20);
    for (const v of r) {
      expect(['S', 'M', 'L']).toContain(v.sizeTier);
      expect([25, 35, 50]).toContain(v.padRadius);
      expect(v.falloffRadius).toBe(v.padRadius + 25);
      expect(v.groundY).toBe(30);
      expect(v.templateKey).toBe('forest');
    }
  });

  it('inChunk returns villages whose anchor falls in the chunk', () => {
    const reg = buildVillageRegistry(opts);
    const CHUNK = 512;
    for (const v of reg.all) {
      const cx = Math.floor(v.x / CHUNK);
      const cz = Math.floor(v.z / CHUNK);
      expect(reg.inChunk(cx, cz, CHUNK)).toContain(v);
    }
  });

  it('affectingChunk returns villages within falloff radius of a chunk', () => {
    const reg = buildVillageRegistry(opts);
    const CHUNK = 512;
    const v = reg.all[0];
    const cx = Math.floor(v.x / CHUNK);
    const cz = Math.floor(v.z / CHUNK);
    // Adjacent chunk should also "be affected" if anchor near corner.
    expect(reg.affectingChunk(cx, cz, CHUNK)).toContain(v);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- tests/poi/villages.test.js
```
Expected: module-not-found error.

- [ ] **Step 3: Implement registry**

`lib/poi/villages.js`:
```js
import { hash3 } from './hash.js';
import { FOREST_TEMPLATE } from './templates/forest.js';

export const WORLD_SIZE = 64000;
export const CELL_SIZE  = 1000;           // 64x64 anchor grid over 64 km world
export const GRID_N     = WORLD_SIZE / CELL_SIZE;

const TEMPLATES = [FOREST_TEMPLATE];

// Map size roll → tier using template thresholds.
function pickSizeTier(template, roll) {
  const t = template.sizeTiers;
  if (roll < t.S.rollMax) return { tier: 'S', cfg: t.S };
  if (roll < t.M.rollMax) return { tier: 'M', cfg: t.M };
  return { tier: 'L', cfg: t.L };
}

// Find the template (if any) whose biome and altitude rules match this cell.
function matchTemplate(biomeKey, altitude) {
  for (const t of TEMPLATES) {
    if (t.biome !== biomeKey) continue;
    if (altitude < t.altitudeRange[0] || altitude > t.altitudeRange[1]) continue;
    return t;
  }
  return null;
}

// Build the global village registry. Sync, ~ms.
//
// opts:
//   seed              world seed (uint32)
//   biomeAt(x, z)     → { key } per the game's biome module
//   terrainHeightFn(x, z) → number, natural elevation at (x, z) given seed
//   riverDepthAtFn(x, z)  → number, > 0 if (x, z) is inside a river/lake carve at width 1
export function buildVillageRegistry({ seed, biomeAt, terrainHeightFn, riverDepthAtFn }) {
  const all = [];
  let id = 0;
  const half = WORLD_SIZE / 2;
  for (let j = 0; j < GRID_N; j++) {
    for (let i = 0; i < GRID_N; i++) {
      // Cell center in world coords
      const x = -half + (i + 0.5) * CELL_SIZE;
      const z = -half + (j + 0.5) * CELL_SIZE;
      const altitude = terrainHeightFn(x, z);
      const biome = biomeAt(x, z);
      const template = matchTemplate(biome.key, altitude);
      if (!template) continue;
      if (riverDepthAtFn(x, z) > 0) continue;
      const placeRoll = hash3(i, j, seed);
      if (placeRoll >= template.baseProbability) continue;
      const sizeRoll = hash3(i, j, seed ^ 0xC0FFEE);
      const { tier, cfg } = pickSizeTier(template, sizeRoll);
      const paletteSeed = hash3(i, j, seed ^ 0xBEEFFACE);
      all.push({
        id: id++,
        x, z,
        groundY: altitude,
        sizeTier: tier,
        padRadius: cfg.padRadius,
        falloffRadius: cfg.padRadius + 25,
        paletteSeed,
        templateKey: template.key,
      });
    }
  }

  // chunkSize default matches the existing CHUNK_SIZE in chunk-manager (512).
  function inChunk(cx, cz, chunkSize = 512) {
    const x0 = cx * chunkSize, x1 = x0 + chunkSize;
    const z0 = cz * chunkSize, z1 = z0 + chunkSize;
    return all.filter(v => v.x >= x0 && v.x < x1 && v.z >= z0 && v.z < z1);
  }

  function affectingChunk(cx, cz, chunkSize = 512) {
    const x0 = cx * chunkSize, x1 = x0 + chunkSize;
    const z0 = cz * chunkSize, z1 = z0 + chunkSize;
    return all.filter(v => (
      v.x + v.falloffRadius >= x0 && v.x - v.falloffRadius < x1 &&
      v.z + v.falloffRadius >= z0 && v.z - v.falloffRadius < z1
    ));
  }

  return { all, inChunk, affectingChunk };
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npm test -- tests/poi/villages.test.js
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/poi/villages.js tests/poi/villages.test.js
git commit -m "feat(poi): village registry — anchor grid sampler with biome/altitude/river gates"
```

---

### Task 4: Village layout

**Files:**
- Create: `lib/poi/village-layout.js`
- Create: `tests/poi/village-layout.test.js`

- [ ] **Step 1: Write the failing test**

`tests/poi/village-layout.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { layoutVillage } from '../../lib/poi/village-layout.js';

const baseVillage = (over = {}) => ({
  id: 0, x: 5000, z: 5000, groundY: 30,
  sizeTier: 'M', padRadius: 35, falloffRadius: 60,
  paletteSeed: 0.4, templateKey: 'forest',
  ...over,
});

describe('layoutVillage', () => {
  it('returns deterministic BuildingInstance[] for same input', () => {
    const v = baseVillage();
    const a = layoutVillage(v);
    const b = layoutVillage(v);
    expect(a.length).toBe(b.length);
    expect(a[0]).toEqual(b[0]);
  });

  it('S tier yields 4–5 buildings + maybe a barn (max 6)', () => {
    const v = baseVillage({ sizeTier: 'S', padRadius: 25, falloffRadius: 50 });
    const out = layoutVillage(v);
    expect(out.length).toBeGreaterThanOrEqual(4);
    expect(out.length).toBeLessThanOrEqual(6);
  });

  it('M tier yields 7–9 houses + barn + windmill', () => {
    const v = baseVillage({ sizeTier: 'M' });
    const out = layoutVillage(v);
    const types = out.map(b => b.type);
    expect(types).toContain('barn');
    expect(types).toContain('windmill');
    expect(out.length).toBeGreaterThanOrEqual(9);
    expect(out.length).toBeLessThanOrEqual(11);
  });

  it('L tier yields 11–14 houses + barn + windmill + church', () => {
    const v = baseVillage({ sizeTier: 'L', padRadius: 50, falloffRadius: 75 });
    const out = layoutVillage(v);
    const types = out.map(b => b.type);
    expect(types).toContain('barn');
    expect(types).toContain('windmill');
    expect(types).toContain('church');
    expect(out.length).toBeGreaterThanOrEqual(14);
    expect(out.length).toBeLessThanOrEqual(17);
  });

  it('all buildings sit on ground at village.groundY', () => {
    const v = baseVillage({ groundY: 42 });
    const out = layoutVillage(v);
    for (const b of out) expect(b.y).toBe(42);
  });

  it('all building origins are within padRadius of anchor', () => {
    const v = baseVillage();
    const out = layoutVillage(v);
    for (const b of out) {
      const dx = b.x - v.x, dz = b.z - v.z;
      expect(Math.sqrt(dx * dx + dz * dz)).toBeLessThanOrEqual(v.padRadius);
    }
  });

  it('wallColor and roofColor are vec3 in [0, 1]', () => {
    const out = layoutVillage(baseVillage());
    for (const b of out) {
      for (const c of [...b.wallColor, ...b.roofColor]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- tests/poi/village-layout.test.js
```
Expected: module-not-found error.

- [ ] **Step 3: Implement layout**

`lib/poi/village-layout.js`:
```js
import { FOREST_TEMPLATE } from './templates/forest.js';

// Tiny seeded PRNG (mulberry32) — splits paletteSeed into a stream.
function prng(seed) {
  let s = Math.floor(seed * 0x100000000) >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function pick(arr, r) { return arr[Math.floor(r * arr.length) % arr.length]; }
function lerp3(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function jitter3(color, r, amt = 0.05) {
  return [color[0] + (r-0.5)*2*amt, color[1] + (r-0.5)*2*amt, color[2] + (r-0.5)*2*amt]
    .map(v => Math.max(0, Math.min(1, v)));
}

function aabbOverlap(a, b) {
  return Math.abs(a.x - b.x) < (a.rx + b.rx) && Math.abs(a.z - b.z) < (a.rz + b.rz);
}

const BUILDING_AABB = {
  house:    { rx: 2.0, rz: 2.5 },   // approx half-extents (3x4 box + roof overhang)
  barn:     { rx: 3.0, rz: 4.0 },
  windmill: { rx: 1.8, rz: 1.8 },
  church:   { rx: 2.5, rz: 4.5 },
};

export function layoutVillage(village) {
  const T = FOREST_TEMPLATE;
  const rng = prng(village.paletteSeed);
  const out = [];
  const placed = [];          // for AABB collision

  // Per-village palette: pick a wall tone and a roof tone from template.
  const wallTone = pick(T.palette.walls, rng());
  const roofTone = pick(T.palette.roofs, rng());

  function tryPlace(type, x, z, rotY, scale) {
    const half = BUILDING_AABB[type];
    // Try up to 3 shifts along the street axis if overlap detected.
    let shift = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      const tx = x + Math.cos(rotY) * shift;
      const tz = z + Math.sin(rotY) * shift;
      const candidate = { x: tx, z: tz, rx: half.rx * scale, rz: half.rz * scale };
      if (!placed.some(p => aabbOverlap(candidate, p))) {
        placed.push(candidate);
        const wallColor = jitter3(wallTone, rng());
        const roofColor = jitter3(roofTone, rng());
        out.push({
          type, x: tx, y: village.groundY, z: tz, rotY,
          scaleX: scale, scaleY: scale, scaleZ: scale,
          wallColor, roofColor,
        });
        return true;
      }
      shift += 2.5;
    }
    return false;
  }

  // Main-street axis (radians)
  const theta = rng() * Math.PI * 2;
  const along = (t) => [
    village.x + Math.cos(theta) * t,
    village.z + Math.sin(theta) * t,
  ];
  // Perpendicular direction for two rows
  const perp = theta + Math.PI / 2;
  const pAlong = (a, p) => [
    village.x + Math.cos(theta) * a + Math.cos(perp) * p,
    village.z + Math.sin(theta) * a + Math.sin(perp) * p,
  ];

  const tierCfg = T.sizeTiers[village.sizeTier];
  const houseCount = tierCfg.buildingCount[0] + Math.floor(rng() * (tierCfg.buildingCount[1] - tierCfg.buildingCount[0] + 1));
  const spacing = 5.5;

  if (village.sizeTier === 'S') {
    // Single row of houses, centered.
    for (let i = 0; i < houseCount; i++) {
      const t = (i - (houseCount - 1) / 2) * spacing;
      const [x, z] = along(t);
      const rot = theta + Math.PI/2 + (rng() - 0.5) * 0.5;
      tryPlace('house', x, z, rot, 0.85 + rng() * 0.3);
    }
    if (rng() < 0.5) {
      const [x, z] = along(((houseCount - 1) / 2 + 1) * spacing);
      tryPlace('barn', x, z, theta, 0.9 + rng() * 0.2);
    }
  } else if (village.sizeTier === 'M') {
    // Two rows offset by ±3m perpendicular.
    const perRow = Math.ceil(houseCount / 2);
    for (let i = 0; i < houseCount; i++) {
      const row = i < perRow ? -3 : 3;
      const idxInRow = i < perRow ? i : i - perRow;
      const t = (idxInRow - (perRow - 1) / 2) * spacing;
      const [x, z] = pAlong(t, row);
      const rot = theta + Math.PI/2 + (rng() - 0.5) * 0.5;
      tryPlace('house', x, z, rot, 0.85 + rng() * 0.3);
    }
    const endT = (Math.ceil(houseCount / 2) - 1) / 2 * spacing + 7;
    const [bx, bz] = along(-endT);
    tryPlace('barn', bx, bz, theta, 0.9 + rng() * 0.2);
    const [wx, wz] = along(endT);
    tryPlace('windmill', wx, wz, 0, 1.0);
  } else {
    // L tier — two rows + a central church at the village anchor.
    const perRow = Math.ceil(houseCount / 2);
    for (let i = 0; i < houseCount; i++) {
      const row = i < perRow ? -4 : 4;
      const idxInRow = i < perRow ? i : i - perRow;
      // Skip the central 2 slots to leave a square for the church.
      const t = (idxInRow - (perRow - 1) / 2) * spacing;
      if (Math.abs(t) < spacing * 1.2) continue;
      const [x, z] = pAlong(t, row);
      const rot = theta + Math.PI/2 + (rng() - 0.5) * 0.5;
      tryPlace('house', x, z, rot, 0.85 + rng() * 0.3);
    }
    tryPlace('church', village.x, village.z, theta, 1.0);
    const endT = (Math.ceil(houseCount / 2) - 1) / 2 * spacing + 10;
    const [bx, bz] = along(-endT);
    tryPlace('barn', bx, bz, theta, 0.9 + rng() * 0.2);
    const [wx, wz] = along(endT);
    tryPlace('windmill', wx, wz, 0, 1.0);
  }

  // Clamp any building origin that drifted past padRadius (rare, from shifts).
  const padR = village.padRadius;
  for (const b of out) {
    const dx = b.x - village.x, dz = b.z - village.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > padR * padR) {
      const s = padR / Math.sqrt(d2);
      b.x = village.x + dx * s;
      b.z = village.z + dz * s;
    }
  }

  return out;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npm test -- tests/poi/village-layout.test.js
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/poi/village-layout.js tests/poi/village-layout.test.js
git commit -m "feat(poi): village-layout deterministic per-village procedural building list"
```

---

## Phase 2 — Geometry + material (smoke-tested visually)

### Task 5: Building geometry library

**Files:**
- Create: `lib/poi/buildings.js`

- [ ] **Step 1: Implement geometry library**

`lib/poi/buildings.js`:
```js
// Per-building BufferGeometry builders. Each returns a geometry with:
//   - position   (Float32, vec3)
//   - normal     (Float32, vec3, explicit per-face)
//   - colorRole  (Float32, scalar — 0 = wall, 1 = roof)
//
// The material uses two per-instance attributes (aWallColor / aRoofColor)
// and the vertex shader picks via colorRole.

function pushQuad(verts, normals, roles, a, b, c, d, n, role) {
  // Two triangles a-b-c and a-c-d (assumes CCW from outside).
  verts.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < 6; i++) { normals.push(...n); roles.push(role); }
}

function pushTri(verts, normals, roles, a, b, c, n, role) {
  verts.push(...a, ...b, ...c);
  for (let i = 0; i < 3; i++) { normals.push(...n); roles.push(role); }
}

// Box with walls (role=0) — top is replaced by roof in the building primitives,
// so we omit the +Y face. Caller draws the roof on top.
function pushWallsNoTop(verts, normals, roles, w, h, d, cx, cy, cz) {
  const x0 = cx - w/2, x1 = cx + w/2;
  const y0 = cy, y1 = cy + h;
  const z0 = cz - d/2, z1 = cz + d/2;
  const role = 0;
  // -Y face (bottom)
  pushQuad(verts, normals, roles,
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0,-1,0], role);
  // +X face
  pushQuad(verts, normals, roles,
    [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1,0,0], role);
  // -X face
  pushQuad(verts, normals, roles,
    [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1,0,0], role);
  // +Z face
  pushQuad(verts, normals, roles,
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0,0,1], role);
  // -Z face
  pushQuad(verts, normals, roles,
    [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0,0,-1], role);
}

// Gable roof with ridge along Z (or X if ridgeAxis === 'x'), atop a box of size w×d.
// Roof base sits at y=cy+yBase, peak at y=cy+yBase+h.
function pushGableRoof(verts, normals, roles, w, h, d, cx, cy, cz, ridgeAxis = 'z') {
  const hw = w/2, hd = d/2;
  const y0 = cy, y1 = cy + h;
  const role = 1;
  const c0 = [cx-hw, y0, cz-hd], c1 = [cx+hw, y0, cz-hd];
  const c2 = [cx+hw, y0, cz+hd], c3 = [cx-hw, y0, cz+hd];
  if (ridgeAxis === 'z') {
    const rs = [cx, y1, cz-hd], re = [cx, y1, cz+hd];
    const len = Math.sqrt(h*h + hw*hw);
    const rN = [h/len, hw/len, 0];        // +X slope outward normal
    const lN = [-h/len, hw/len, 0];       // -X slope
    // Right slope (quad c1-c2-re-rs)
    pushQuad(verts, normals, roles, c1, c2, re, rs, rN, role);
    // Left slope (quad c3-c0-rs-re)
    pushQuad(verts, normals, roles, c3, c0, rs, re, lN, role);
    // Front gable (-Z)
    pushTri(verts, normals, roles, c0, c1, rs, [0,0,-1], role);
    // Back gable (+Z)
    pushTri(verts, normals, roles, c2, c3, re, [0,0,1], role);
  } else {
    const rs = [cx-hw, y1, cz], re = [cx+hw, y1, cz];
    const len = Math.sqrt(h*h + hd*hd);
    const fN = [0, hd/len, h/len];
    const bN = [0, hd/len, -h/len];
    pushQuad(verts, normals, roles, c3, c2, re, rs, fN, role);
    pushQuad(verts, normals, roles, c1, c0, rs, re, bN, role);
    pushTri(verts, normals, roles, c0, c3, rs, [-1,0,0], role);
    pushTri(verts, normals, roles, c2, c1, re, [1,0,0], role);
  }
}

function makeGeometry(THREE, verts, normals, roles) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('colorRole',new THREE.Float32BufferAttribute(roles, 1));
  return g;
}

export function buildHouseGeometry(THREE) {
  const v = [], n = [], r = [];
  pushWallsNoTop(v, n, r, 3, 3, 4, 0, 0, 0);
  pushGableRoof(v, n, r, 3, 1.5, 4, 0, 3, 0, 'z');
  return makeGeometry(THREE, v, n, r);
}

export function buildBarnGeometry(THREE) {
  const v = [], n = [], r = [];
  pushWallsNoTop(v, n, r, 5, 3.5, 7, 0, 0, 0);
  pushGableRoof(v, n, r, 5, 1.6, 7, 0, 3.5, 0, 'z');
  return makeGeometry(THREE, v, n, r);
}

export function buildChurchGeometry(THREE) {
  const v = [], n = [], r = [];
  // Nave
  pushWallsNoTop(v, n, r, 4, 5, 6, 0, 0, 0);
  pushGableRoof(v, n, r, 4, 1.5, 6, 0, 5, 0, 'z');
  // Bell tower at -Z front
  pushWallsNoTop(v, n, r, 2, 7, 2, 0, 0, -4);
  pushGableRoof(v, n, r, 2, 1.5, 2, 0, 7, -4, 'x');
  return makeGeometry(THREE, v, n, r);
}

export function buildWindmillTowerGeometry(THREE) {
  // Cylinder tower + cone cap. Reuse THREE primitives — vertices are dense
  // enough for the look we want; we patch in normals + colorRole.
  const tower = new THREE.CylinderGeometry(1.5, 1.5, 6, 12);
  tower.translate(0, 3, 0);
  const cap = new THREE.ConeGeometry(1.6, 1.4, 8);
  cap.translate(0, 6 + 0.7, 0);
  // Tag tower as wall, cap as roof
  function withRole(g, role) {
    const N = g.attributes.position.count;
    const arr = new Float32Array(N);
    arr.fill(role);
    g.setAttribute('colorRole', new THREE.Float32BufferAttribute(arr, 1));
    return g;
  }
  withRole(tower, 0);
  withRole(cap, 1);
  // Merge into one geometry. r128 doesn't ship BufferGeometryUtils by default
  // in our build — do a manual concat of position/normal/colorRole.
  function concat(geos) {
    let posLen = 0, normLen = 0, roleLen = 0;
    for (const g of geos) {
      posLen  += g.attributes.position.array.length;
      normLen += g.attributes.normal.array.length;
      roleLen += g.attributes.colorRole.array.length;
    }
    const pos = new Float32Array(posLen);
    const norm = new Float32Array(normLen);
    const role = new Float32Array(roleLen);
    let po = 0, no = 0, ro = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, po);   po += g.attributes.position.array.length;
      norm.set(g.attributes.normal.array, no);    no += g.attributes.normal.array.length;
      role.set(g.attributes.colorRole.array, ro); ro += g.attributes.colorRole.array.length;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.setAttribute('normal',   new THREE.Float32BufferAttribute(norm, 3));
    merged.setAttribute('colorRole',new THREE.Float32BufferAttribute(role, 1));
    return merged;
  }
  return concat([tower, cap]);
}

// Single blade — long thin box. Blade rotates around its parent's origin in shader.
export function buildWindmillBladeGeometry(THREE) {
  const g = new THREE.BoxGeometry(0.4, 4.5, 0.15);
  g.translate(0, 2.25, 0);  // base at y=0, tip at y=4.5
  // Tag all vertices as accent (use roof color attribute as proxy)
  const N = g.attributes.position.count;
  const arr = new Float32Array(N);
  arr.fill(1);
  g.setAttribute('colorRole', new THREE.Float32BufferAttribute(arr, 1));
  return g;
}
```

- [ ] **Step 2: Smoke-test in browser**

Open `http://localhost:8085/poi-mockups.html` to verify the building primitives still look correct visually (the mockup uses similar geometry; this is the shipping version). No automated test for THREE-dependent code in this phase — relying on the visual mockup parity.

- [ ] **Step 3: Commit**

```bash
git add lib/poi/buildings.js
git commit -m "feat(poi): building geometry library (house, barn, windmill, church)"
```

---

### Task 6: Building material with onBeforeCompile

**Files:**
- Modify: `lib/terrain/index.js`

- [ ] **Step 1: Add buildingMaterial creation in createTerrain**

After the `treeMaterial` definition (around line 65–83), add:

```js
// --- Building material ---
// Shared by all village building types (house, barn, windmill tower, church).
// Distance shrink-fade matches the tree pattern (600–750m). Per-instance
// colors via two InstancedBufferAttributes (aWallColor, aRoofColor), routed
// in the vertex shader by per-vertex `colorRole` (0 = wall, 1 = roof).
const buildingMaterial = new THREE.MeshPhongMaterial({
  vertexColors: true, flatShading: true, shininess: 0
});
buildingMaterial.userData.uFadeStart = { value: 600 };
buildingMaterial.userData.uFadeEnd   = { value: 750 };
buildingMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uFadeStart = buildingMaterial.userData.uFadeStart;
  shader.uniforms.uFadeEnd   = buildingMaterial.userData.uFadeEnd;
  shader.vertexShader =
    `uniform float uFadeStart;\n` +
    `uniform float uFadeEnd;\n` +
    `attribute vec3 aWallColor;\n` +
    `attribute vec3 aRoofColor;\n` +
    `attribute float colorRole;\n` +
    shader.vertexShader
      .replace('#include <color_vertex>',
        `vColor = mix(aWallColor, aRoofColor, colorRole);`)
      .replace('#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
         {
           vec4 _worldInst = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           float _dist = distance(_worldInst.xyz, cameraPosition);
           float _fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, _dist);
           transformed *= _fade;
         }
         #endif`);
};

// --- Windmill blade material ---
// Spinning blades — uTime drives rotation around the LOCAL X axis. Same fade
// behaviour. Shares the wall/roof color attributes (we set both to the same
// accent color per instance so the shader path is identical).
const windmillBladeMaterial = new THREE.MeshPhongMaterial({
  vertexColors: true, flatShading: true, shininess: 0
});
windmillBladeMaterial.userData.uTime      = { value: 0 };
windmillBladeMaterial.userData.uFadeStart = { value: 600 };
windmillBladeMaterial.userData.uFadeEnd   = { value: 750 };
windmillBladeMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime      = windmillBladeMaterial.userData.uTime;
  shader.uniforms.uFadeStart = windmillBladeMaterial.userData.uFadeStart;
  shader.uniforms.uFadeEnd   = windmillBladeMaterial.userData.uFadeEnd;
  shader.vertexShader =
    `uniform float uTime;\n` +
    `uniform float uFadeStart;\n` +
    `uniform float uFadeEnd;\n` +
    `attribute vec3 aWallColor;\n` +
    `attribute vec3 aRoofColor;\n` +
    `attribute float colorRole;\n` +
    shader.vertexShader
      .replace('#include <color_vertex>',
        `vColor = mix(aWallColor, aRoofColor, colorRole);`)
      .replace('#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
         {
           // Rotate around local X by uTime * 0.6 rad/s (visible spin).
           float _ang = uTime * 0.6;
           float _c = cos(_ang), _s = sin(_ang);
           vec3 _r = vec3(
             transformed.x,
             transformed.y * _c - transformed.z * _s,
             transformed.y * _s + transformed.z * _c
           );
           transformed = _r;
           // Distance fade as for the building material.
           vec4 _worldInst = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           float _dist = distance(_worldInst.xyz, cameraPosition);
           float _fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, _dist);
           transformed *= _fade;
         }
         #endif`);
};
```

- [ ] **Step 2: Drive uTime in the frame loop**

In the `update(cameraPos)` method (around line 120–130), alongside the existing `treeMaterial.userData.uTime.value = t;`, add:

```js
windmillBladeMaterial.userData.uTime.value = t;
```

- [ ] **Step 3: Commit (no functional change yet — materials unused until wired up)**

```bash
git add lib/terrain/index.js
git commit -m "feat(poi): buildingMaterial + windmillBladeMaterial with fade and color routing"
```

---

## Phase 3 — Pipeline integration

### Task 7: Wire registry into createTerrain

**Files:**
- Modify: `lib/terrain/index.js`

- [ ] **Step 1: Import + build registry at terrain init**

At top of file alongside other imports:

```js
import { buildVillageRegistry } from '../poi/villages.js';
import { riverDepthAt } from './carve.js';
```

(`riverDepthAt` may already be imported — check before adding.)

Inside `createTerrain`, after the river graph and biome data are available (after `const graph = buildRiverGraph(...)`), add:

```js
// Forest village registry — anchor grid scan, deterministic per seed.
// Sync, ~10–30ms for 4096 cells. Eligibility uses the same biomeAt,
// terrainHeight, and river segments the chunk pipeline uses, so renderer
// and registry agree on which cells qualify.
const villageRegistry = (biomeAt && opts.enableVillages !== false)
  ? buildVillageRegistry({
      seed,
      biomeAt,
      terrainHeightFn: (x, z) => terrainHeight(x, z, seed),
      riverDepthAtFn: (x, z) => riverDepthAt(x, z, graph.segments, 1),
    })
  : { all: [], inChunk: () => [], affectingChunk: () => [] };
console.log('[poi] villages:', villageRegistry.all.length);
```

- [ ] **Step 2: Pass registry + building materials to ChunkManager**

Find the ChunkManager construction and add fields:

```js
const cm = new ChunkManager({
  THREE, scene, runner, terrainMaterial, treeMaterial, treeGeometry,
  billboardMaterial, billboardGeometry, perfMode,
  biomeAt, scatterGeometries,
  villageRegistry,           // NEW
  buildingMaterial,          // NEW
  windmillBladeMaterial,     // NEW
});
```

- [ ] **Step 3: Commit**

```bash
git add lib/terrain/index.js
git commit -m "feat(poi): build village registry in createTerrain and pass to ChunkManager"
```

---

### Task 8: Pass village list through worker proxy

**Files:**
- Modify: `lib/terrain/chunk-worker-proxy.js`
- Modify: `lib/terrain/chunk-runner.js`
- Modify: `lib/terrain/chunk-worker.js`

The worker currently receives `{ cx, cz, lod, seed, riverSegments, vertexGrid }`. We need to add `villagesAffectingChunk: Village[]` for the chunk's affected villages.

- [ ] **Step 1: Update ChunkWorkerProxy.requestChunk signature**

In `lib/terrain/chunk-worker-proxy.js`, find the method that sends a job to the worker. Add a `villages` field to the payload:

```js
requestChunk({ cx, cz, lod, vertexGrid, villages }) {
  // ... existing code ...
  this.worker.postMessage({
    type: 'chunk', cx, cz, lod, vertexGrid,
    villages: villages || [],
  });
  // ...
}
```

- [ ] **Step 2: Same for ChunkRunner (main-thread fallback)**

In `lib/terrain/chunk-runner.js`, the analogous `requestChunk` method should also accept `villages` and pass it to `buildChunkBuffers`.

- [ ] **Step 3: Worker reads villages from payload and forwards to buildChunkBuffers**

In `lib/terrain/chunk-worker.js`, in the message handler:

```js
const out = buildChunkBuffers({
  cx, cz, lod, seed, riverSegments, vertexGrid,
  biomeAt: localBiomeAt, bandsAt: localBandsAt,
  villages: data.villages || [],
});
```

(`data.villages` since the message payload calls it `villages`.)

- [ ] **Step 4: Commit**

```bash
git add lib/terrain/chunk-worker-proxy.js lib/terrain/chunk-runner.js lib/terrain/chunk-worker.js
git commit -m "feat(poi): plumb villagesAffectingChunk through worker proxy and runner"
```

---

### Task 9: ChunkManager queries registry and forwards villages

**Files:**
- Modify: `lib/terrain/chunk-manager.js`

The `ChunkManager.update(cameraPos)` iterates desired chunks and enqueues those that need build/upgrade. For each enqueued chunk, call `villageRegistry.affectingChunk(cx, cz, CHUNK_SIZE)` and pass that list to the runner.

- [ ] **Step 1: Store villageRegistry in constructor**

In the constructor field assignment:

```js
this.villageRegistry = villageRegistry || { all: [], inChunk: () => [], affectingChunk: () => [] };
this.buildingMaterial = buildingMaterial;
this.windmillBladeMaterial = windmillBladeMaterial;
```

- [ ] **Step 2: Pass villages when enqueueing a chunk**

Find the existing `runner.requestChunk(...)` call. Modify it to:

```js
const villages = this.villageRegistry.affectingChunk(cx, cz, CHUNK_SIZE);
runner.requestChunk({ cx, cz, lod, vertexGrid, villages });
```

(Replace existing call signature with this.)

- [ ] **Step 3: Commit**

```bash
git add lib/terrain/chunk-manager.js
git commit -m "feat(poi): ChunkManager queries village registry for affecting villages per chunk"
```

---

### Task 10: Chunk-build terrain flattening

**Files:**
- Modify: `lib/terrain/chunk-build.js`

- [ ] **Step 1: Accept `villages` in buildChunkBuffers**

Add `villages` to the destructured args:

```js
export function buildChunkBuffers({ cx, cz, lod, seed, riverSegments, vertexGrid, biomeAt, bandsAt, villages = [] }) {
```

- [ ] **Step 2: Apply flattening pass after natural height, before river carve**

Find the section where positions[] has the natural heightfield written (after `terrainHeight` calls but before `applyRiverCarve`). Insert:

```js
// --- Village pad flattening ---
// For each affecting village, lerp the vertex toward village.groundY using
// a smoothstep falloff between padRadius and falloffRadius. Overlapping
// villages take the max-`t`. No-op when villages is empty.
if (villages.length > 0) {
  for (let i = 0; i < totalInterior; i++) {
    const vx = positions[i * 3];
    const vz = positions[i * 3 + 2];
    let bestT = 0;
    let bestGroundY = 0;
    for (const V of villages) {
      const dx = vx - V.x, dz = vz - V.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d >= V.falloffRadius) continue;
      // smoothstep(edge1, edge0, x): 1 at pad, 0 at falloff
      const u = (V.falloffRadius - d) / (V.falloffRadius - V.padRadius);
      const t = Math.max(0, Math.min(1, u));
      const smoothT = t * t * (3 - 2 * t);
      if (smoothT > bestT) { bestT = smoothT; bestGroundY = V.groundY; }
    }
    if (bestT > 0) {
      positions[i * 3 + 1] = positions[i * 3 + 1] * (1 - bestT) + bestGroundY * bestT;
    }
  }
}
```

- [ ] **Step 3: Visually verify (smoke test)**

Open `http://localhost:8085/?seed=42` and fly to a low-altitude forest area. Expected: occasional flat pads visible in the terrain (no buildings yet — those come in Task 12). No regression in non-forest areas.

- [ ] **Step 4: Commit**

```bash
git add lib/terrain/chunk-build.js
git commit -m "feat(poi): chunk-build flattens terrain inside village pads (smoothstep falloff)"
```

---

### Task 11: Chunk-build tree exclusion

**Files:**
- Modify: `lib/terrain/chunk-build.js`

The existing `placeTrees(cx, cz, seed, localSegs, gridPitch)` candidate loop adds a reject check.

- [ ] **Step 1: Extend placeTrees signature to accept villages**

Find the placeTrees function declaration. Change to:

```js
function placeTrees(cx, cz, seed, localSegs, gridPitch, villages = []) {
```

- [ ] **Step 2: Insert village-pad rejection inside the candidate loop**

Inside `placeTrees`, where each candidate `(x, z)` is computed, before pushing the position to the output list, add:

```js
let inVillage = false;
for (const V of villages) {
  const dx = x - V.x, dz = z - V.z;
  const padR = V.padRadius + 4;
  if (dx * dx + dz * dz < padR * padR) { inVillage = true; break; }
}
if (inVillage) continue;
```

- [ ] **Step 3: Pass villages from buildChunkBuffers callers**

Find the two `placeTrees(...)` calls in `buildChunkBuffers` (one for LOD 0 trees, one for LOD 1 billboards). Update both to pass `villages`:

```js
const trees = lod === 0 ? placeTrees(cx, cz, seed, localSegs, TREE_GRID_PITCH, villages) : [];
const billboards = lod === 1 ? placeTrees(cx, cz, seed, localSegs, TREE_GRID_PITCH * 3, villages) : [];
```

- [ ] **Step 4: Visually verify**

Open `http://localhost:8085/?seed=42`, fly to a forest area. Expected: trees absent within ~30–55m of any flattened pad.

- [ ] **Step 5: Commit**

```bash
git add lib/terrain/chunk-build.js
git commit -m "feat(poi): chunk-build excludes trees + scatter from village pads"
```

---

### Task 12: Chunk-build emits buildings

**Files:**
- Modify: `lib/terrain/chunk-build.js`

Only villages whose anchor `(x, z)` is inside the chunk's AABB emit buildings.

- [ ] **Step 1: Emit buildings per-chunk**

Inside `buildChunkBuffers`, after `placeTrees`/`placeBillboards`, add:

```js
// --- Building emission ---
// Only villages whose anchor sits inside THIS chunk emit. Neighbors that
// only feel the flattening/exclusion do not double-render buildings.
const CHUNK_SIZE = 512;
const x0 = cx * CHUNK_SIZE, x1 = x0 + CHUNK_SIZE;
const z0 = cz * CHUNK_SIZE, z1 = z0 + CHUNK_SIZE;
const ownedVillages = villages.filter(V => V.x >= x0 && V.x < x1 && V.z >= z0 && V.z < z1);
const buildings = { house: [], barn: [], windmill: [], windmillBlades: [], church: [] };
if (lod === 0 && ownedVillages.length > 0) {
  // layoutVillage is imported lazily inside the worker.
  const { layoutVillage } = require('../poi/village-layout.js');
  for (const V of ownedVillages) {
    const instances = layoutVillage(V);
    for (const b of instances) {
      if (!buildings[b.type]) continue;
      buildings[b.type].push(b);
      // Each windmill spawns one blade hub (4 blades inside the geometry would
      // be ugly with InstancedMesh; render 4 blade instances per windmill at
      // 90° offsets via per-instance rotation).
      if (b.type === 'windmill') {
        for (let i = 0; i < 4; i++) {
          buildings.windmillBlades.push({
            type: 'windmillBlades',
            x: b.x, y: b.y + 5.5, z: b.z,
            rotY: b.rotY,                   // Y rotation matches windmill base
            rotZ: i * Math.PI / 2,          // 4 blades around the hub axis
            scaleX: b.scaleX, scaleY: b.scaleY, scaleZ: b.scaleZ,
            wallColor: b.wallColor,
            roofColor: [1.0, 0.95, 0.85],   // off-white blades
          });
        }
      }
    }
  }
}
return { positions, indices, normals, colors, trees, billboards, buildings };
```

Note: `require()` won't work in ES module workers. Replace with a top-of-file `import { layoutVillage } from '../poi/village-layout.js';`.

- [ ] **Step 2: Add the import at top of chunk-build.js**

```js
import { layoutVillage } from '../poi/village-layout.js';
```

And REMOVE the inline `require` from Step 1.

- [ ] **Step 3: Commit**

```bash
git add lib/terrain/chunk-build.js
git commit -m "feat(poi): chunk-build emits per-type BuildingInstance lists for owned villages"
```

---

### Task 13: ChunkManager assembles InstancedMeshes

**Files:**
- Modify: `lib/terrain/chunk-manager.js`
- Modify: `lib/terrain/index.js` (export building geometries)

The ChunkManager handles the worker's response and turns the `buildings` map into InstancedMeshes attached to the chunk's group.

- [ ] **Step 1: Build geometries once in createTerrain**

In `lib/terrain/index.js`, after the materials, add (near the tree geometry):

```js
import {
  buildHouseGeometry, buildBarnGeometry, buildChurchGeometry,
  buildWindmillTowerGeometry, buildWindmillBladeGeometry,
} from '../poi/buildings.js';

// One geometry per building type. Reused across all chunks.
const buildingGeometries = {
  house:           buildHouseGeometry(THREE),
  barn:            buildBarnGeometry(THREE),
  church:          buildChurchGeometry(THREE),
  windmill:        buildWindmillTowerGeometry(THREE),
  windmillBlades:  buildWindmillBladeGeometry(THREE),
};
```

Pass these to ChunkManager:

```js
const cm = new ChunkManager({
  THREE, scene, runner, terrainMaterial, treeMaterial, treeGeometry,
  billboardMaterial, billboardGeometry, perfMode,
  biomeAt, scatterGeometries,
  villageRegistry,
  buildingMaterial,
  windmillBladeMaterial,
  buildingGeometries,       // NEW
});
```

- [ ] **Step 2: Store + dispose geometries in ChunkManager**

In `lib/terrain/chunk-manager.js` constructor:

```js
this.buildingGeometries = buildingGeometries || {};
```

In the `dispose()` method (or wherever the manager tears down owned geometries), don't dispose `buildingGeometries` — they're shared across chunks and owned by `createTerrain`, which already disposes them in its own `dispose()`. (Add disposal to `createTerrain.dispose()` if missing.)

- [ ] **Step 3: Assemble InstancedMeshes when a chunk's buffers arrive**

Find where the runner's response is consumed (the spot that currently builds tree InstancedMesh from `out.trees`). After the tree assembly, add:

```js
// --- Building InstancedMeshes ---
const buildingMeshes = [];
const TYPES_NORMAL = ['house', 'barn', 'church', 'windmill'];
for (const type of TYPES_NORMAL) {
  const list = out.buildings && out.buildings[type];
  if (!list || list.length === 0) continue;
  const mat = this.buildingMaterial;
  const geom = this.buildingGeometries[type];
  if (!geom) continue;
  const im = new THREE.InstancedMesh(geom, mat, list.length);
  const wallColor = new Float32Array(list.length * 3);
  const roofColor = new Float32Array(list.length * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    p.set(b.x, b.y, b.z);
    eul.set(0, b.rotY, 0);
    q.setFromEuler(eul);
    s.set(b.scaleX, b.scaleY, b.scaleZ);
    m.compose(p, q, s);
    im.setMatrixAt(i, m);
    wallColor[i * 3] = b.wallColor[0]; wallColor[i * 3 + 1] = b.wallColor[1]; wallColor[i * 3 + 2] = b.wallColor[2];
    roofColor[i * 3] = b.roofColor[0]; roofColor[i * 3 + 1] = b.roofColor[1]; roofColor[i * 3 + 2] = b.roofColor[2];
  }
  im.instanceMatrix.needsUpdate = true;
  im.geometry.setAttribute('aWallColor', new THREE.InstancedBufferAttribute(wallColor, 3));
  im.geometry.setAttribute('aRoofColor', new THREE.InstancedBufferAttribute(roofColor, 3));
  this.group.add(im);
  buildingMeshes.push(im);
}

// Windmill blades — separate material (spinning), different rotation handling.
const bladeList = out.buildings && out.buildings.windmillBlades;
if (bladeList && bladeList.length > 0) {
  const geom = this.buildingGeometries.windmillBlades;
  const im = new THREE.InstancedMesh(geom, this.windmillBladeMaterial, bladeList.length);
  const wallColor = new Float32Array(bladeList.length * 3);
  const roofColor = new Float32Array(bladeList.length * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < bladeList.length; i++) {
    const b = bladeList[i];
    p.set(b.x, b.y, b.z);
    eul.set(0, b.rotY, b.rotZ);   // 4 blades at 90° increments around Z
    q.setFromEuler(eul);
    s.set(b.scaleX, b.scaleY, b.scaleZ);
    m.compose(p, q, s);
    im.setMatrixAt(i, m);
    wallColor[i * 3] = b.wallColor[0]; wallColor[i * 3 + 1] = b.wallColor[1]; wallColor[i * 3 + 2] = b.wallColor[2];
    roofColor[i * 3] = b.roofColor[0]; roofColor[i * 3 + 1] = b.roofColor[1]; roofColor[i * 3 + 2] = b.roofColor[2];
  }
  im.instanceMatrix.needsUpdate = true;
  im.geometry.setAttribute('aWallColor', new THREE.InstancedBufferAttribute(wallColor, 3));
  im.geometry.setAttribute('aRoofColor', new THREE.InstancedBufferAttribute(roofColor, 3));
  this.group.add(im);
  buildingMeshes.push(im);
}
```

- [ ] **Step 4: Store and dispose buildingMeshes with the chunk entry**

Where the chunk is stored in `this.resident.set(key, { ... })`, add `buildingMeshes`. In the chunk-eviction code, iterate `entry.buildingMeshes` and remove + dispose each (but NOT dispose the shared geometry):

```js
if (entry.buildingMeshes) {
  for (const im of entry.buildingMeshes) {
    this.group.remove(im);
    // Per-instance attributes attach to the SHARED geometry; remove them
    // so the next chunk that reuses this geometry doesn't see stale colors.
    im.geometry.deleteAttribute('aWallColor');
    im.geometry.deleteAttribute('aRoofColor');
  }
}
```

NOTE: setting `aWallColor` on the shared geometry conflicts across chunks. **Fix:** clone the geometry per-chunk before setting per-instance attributes:

```js
const geom = this.buildingGeometries[type].clone();
const im = new THREE.InstancedMesh(geom, mat, list.length);
```

Then disposal becomes:
```js
im.geometry.dispose();   // owns its own clone
```

(Apply this geometry-cloning fix in BOTH the normal building loop and the blade loop. Remove the earlier `deleteAttribute` lines — geometry is cloned per chunk so cleanup is just `dispose()`.)

- [ ] **Step 5: Smoke-test in browser**

Open `http://localhost:8085/?seed=42`, fly into a forest biome at low altitude. Expected: visible clusters of buildings + windmill blades spinning. Check console for shader errors.

- [ ] **Step 6: Commit**

```bash
git add lib/terrain/chunk-manager.js lib/terrain/index.js
git commit -m "feat(poi): ChunkManager assembles + disposes per-type building InstancedMeshes"
```

---

## Phase 4 — Polish

### Task 14: Smoke verification, version bump, deploy

**Files:**
- Modify: `lib/version.js`
- Modify: `package.json`

- [ ] **Step 1: Manual smoke test via puppeteer**

```bash
cat > /tmp/cap-poi-smoke.js <<'EOF'
const puppeteer = require('/Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLEERR: ' + m.text()); });
  await page.goto('http://localhost:8085/?seed=42', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => {
    const flyBtn = [...document.querySelectorAll('button,div')].find(el => el.textContent.trim() === 'FLY');
    if (flyBtn) flyBtn.click();
  });
  await new Promise(r => setTimeout(r, 2200));
  await page.mouse.move(540, 960);
  await page.mouse.down();
  await page.mouse.move(540, 760, { steps: 20 });
  await new Promise(r => setTimeout(r, 600));
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '/tmp/poi-smoke.png' });
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'OK');
  await browser.close();
})();
EOF
node /tmp/cap-poi-smoke.js
```

Expected output: `OK` and a screenshot at `/tmp/poi-smoke.png` showing buildings in a forest biome from above. No shader compile errors, no NaN positions.

- [ ] **Step 2: Bump version**

In `lib/version.js`:
```js
export const VERSION = 'v0.1.59';
```

In `package.json`:
```json
  "version": "0.1.59",
```

- [ ] **Step 3: Commit and push**

```bash
git add lib/version.js package.json
git commit -m "feat(poi): forest village POI system — v0.1.59

Common-scenery procedural villages in the forest biome. 64x64 anchor
grid, biome + altitude + river-clearance gates, three size tiers
(S/M/L), deterministic per seed. Each village flattens terrain inside
its pad, excludes trees, and emits InstancedMesh batches per building
type (house, barn, windmill + spinning blades, church) reusing the
distance shrink-fade pattern from trees.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 4: Deploy**

```bash
cd /Users/nitzanwilnai/Programming/Claude/GamesPlatform && ./scripts/deploy-game.sh /Users/nitzanwilnai/Programming/Claude/JSGames/FlightSim
```

Expected: `Deployed successfully!` with the Play URL.

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task —
  - module structure → file structure table at top
  - placement (anchor grid, eligibility) → Task 3
  - layout algorithm + palette → Task 4
  - building geometries → Task 5
  - terrain flattening → Task 10
  - tree exclusion → Task 11
  - building emission → Task 12
  - rendering / InstancedMesh / fade → Tasks 6 + 13
  - windmill blade rotation → Task 13 (+ uTime in Task 6)
  - LOD scope (LOD 0 only) → Task 12 (guarded by `lod === 0`)
  - determinism → Task 1 (hash) feeds Tasks 3 + 4
  - edge cases (cross-chunk villages, two anchors near corner, etc.) → handled by `affectingChunk` (Task 3) + per-chunk independent flatten/exclude/emit (Tasks 10–12)
  - testing → unit tests per file in Tasks 1, 3, 4; visual smoke tests in Tasks 10, 11, 13, 14

- **Type consistency check:** `BuildingInstance` has fields `{ type, x, y, z, rotY, scaleX, scaleY, scaleZ, wallColor, roofColor }` defined in Task 4 and consumed identically in Tasks 12 (emission) and 13 (InstancedMesh assembly). `Village` has fields `{ id, x, z, groundY, sizeTier, padRadius, falloffRadius, paletteSeed, templateKey }` defined in Task 3 and consumed identically in Tasks 4, 10, 11, 12. Hash function signature `hash3(a, b, s) → [0, 1)` consistent across Tasks 1 → 3.

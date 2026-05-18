import { terrainHeight, WATER_LEVEL, SNOW_LINE, ROCK_LINE, GRASS_MID_LINE } from './height.js';
import { applyRiverCarve, riverDepthAt } from './carve.js';
import { layoutVillage } from '../poi/village-layout.js';
import { hash2, fbm } from './noise.js';

export const CHUNK_SIZE = 256;     // meters per chunk
const SKIRT_DROP = 8;              // meters — doubled with the heightfield amplitude
const RIVER_CARVE_DEPTH = 8;       // meters — doubled with the heightfield amplitude
const TREE_GRID_PITCH = 4;         // meters between candidate tree positions
const TREE_PEAK_HEIGHT = 16;       // density peaks here (doubled)
const TREE_DENSITY_HALFWIDTH = 28; // density goes to 0 this far above/below peak (doubled)

// Default (forest) color bands — used when biomeAt isn't passed.
const DEFAULT_BANDS = {
  deepWater:  [0.29, 0.53, 0.72],   // matches the stylized water plane color
  sand:       [0.86, 0.78, 0.55],
  grassLow:   [0.52, 0.74, 0.40],
  grassMid:   [0.40, 0.62, 0.32],
  rock:       [0.55, 0.55, 0.58],
  snow:       [0.97, 0.97, 0.99],
};

// Band transition half-width (m). Each pair of adjacent bands blends over
// ~2*W meters around the boundary, killing the hard contour-line look.
const BAND_BLEND = 30;
// How far per-vertex height jitter can push the band boundary (m). With ~70m
// noise wavelength (BAND_JITTER_FREQ) this gives wavy boundaries instead of
// perfectly horizontal contours.
const BAND_JITTER_AMP  = 25;
const BAND_JITTER_FREQ = 0.014;

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smoothstep01(t) { return t * t * (3 - 2 * t); }

// Writes the per-altitude band color into `colors[p..p+2]`. Water/sand cutoffs
// use the ACTUAL height (`yReal`) so jitter never reclassifies dry terrain
// as submerged or vice versa. Only the above-water grass/rock/snow blending
// uses the jittered height to give wavy contour lines.
function writeColorForHeight(colors, p, yReal, yJittered, bands) {
  if (yReal < WATER_LEVEL - 1) {
    colors[p]     = bands.deepWater[0];
    colors[p + 1] = bands.deepWater[1];
    colors[p + 2] = bands.deepWater[2];
    return;
  }
  if (yReal < WATER_LEVEL + 0.5) {
    colors[p]     = bands.sand[0];
    colors[p + 1] = bands.sand[1];
    colors[p + 2] = bands.sand[2];
    return;
  }
  // Smooth lerps through the above-water bands. Each `t` is the blend
  // weight INTO the next band from where we already are.
  const tMid  = smoothstep01(clamp01((yJittered - (GRASS_MID_LINE - BAND_BLEND)) / (2 * BAND_BLEND)));
  const tRock = smoothstep01(clamp01((yJittered - (ROCK_LINE      - BAND_BLEND)) / (2 * BAND_BLEND)));
  const tSnow = smoothstep01(clamp01((yJittered - (SNOW_LINE      - BAND_BLEND)) / (2 * BAND_BLEND)));
  let r = bands.grassLow[0] + (bands.grassMid[0] - bands.grassLow[0]) * tMid;
  let g = bands.grassLow[1] + (bands.grassMid[1] - bands.grassLow[1]) * tMid;
  let b = bands.grassLow[2] + (bands.grassMid[2] - bands.grassLow[2]) * tMid;
  r += (bands.rock[0] - r) * tRock;
  g += (bands.rock[1] - g) * tRock;
  b += (bands.rock[2] - b) * tRock;
  r += (bands.snow[0] - r) * tSnow;
  g += (bands.snow[1] - g) * tSnow;
  b += (bands.snow[2] - b) * tSnow;
  colors[p]     = r;
  colors[p + 1] = g;
  colors[p + 2] = b;
}

// Build a single chunk. All outputs are typed arrays; safe to transfer to/from a Worker.
// `vertexGrid` is per-side vertex count - 1 (so vertexGrid=32 means a 33×33 lattice).
// `biomeAt` is optional — if provided, the chunk's color palette comes from
// the biome at the chunk's CENTER (so each chunk is uniformly one biome's
// colors; biome boundaries are chunk-aligned, no per-vertex bleeds).
export function buildChunkBuffers({ cx, cz, lod, seed, riverSegments, vertexGrid, biomeAt, bandsAt, villages = [] }) {
  const N = vertexGrid + 1;            // verts per side (interior)
  const totalInterior = N * N;
  const totalSkirt = 4 * N;            // four edges
  const totalVerts = totalInterior + totalSkirt;
  const totalQuads = vertexGrid * vertexGrid;
  const totalSkirtQuads = 4 * vertexGrid;
  const totalTris = (totalQuads + totalSkirtQuads) * 2;

  const positions = new Float32Array(totalVerts * 3);
  const colors    = new Float32Array(totalVerts * 3);
  const normals   = new Float32Array(totalVerts * 3);
  const indices   = new Uint32Array(totalTris * 3);

  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;

  // Sample bands at the chunk's 4 corners and bilinear-interpolate per
  // vertex. Sampling once at chunk center produced a visible seam where
  // adjacent chunks straddled a biome boundary; the corner-bilerp shares
  // sample points across chunk edges, so colors are continuous across the
  // whole world.
  const BAND_NAMES = ['deepWater', 'sand', 'grassLow', 'grassMid', 'rock', 'snow'];
  const b00 = bandsAt ? bandsAt(x0,              z0)              : DEFAULT_BANDS;
  const b10 = bandsAt ? bandsAt(x0 + CHUNK_SIZE, z0)              : DEFAULT_BANDS;
  const b01 = bandsAt ? bandsAt(x0,              z0 + CHUNK_SIZE) : DEFAULT_BANDS;
  const b11 = bandsAt ? bandsAt(x0 + CHUNK_SIZE, z0 + CHUNK_SIZE) : DEFAULT_BANDS;
  // Scratch bands object: same shape as bandsAt() output, mutable, reused
  // every vertex so we never allocate inside the loop.
  const scratchBands = {};
  for (const n of BAND_NAMES) scratchBands[n] = [0, 0, 0];
  function bilerpBandsInto(tx, tz) {
    const a = (1 - tx) * (1 - tz);
    const b = tx       * (1 - tz);
    const c = (1 - tx) *      tz;
    const d = tx       *      tz;
    for (const n of BAND_NAMES) {
      const c00 = b00[n], c10 = b10[n], c01 = b01[n], c11 = b11[n];
      const out = scratchBands[n];
      out[0] = a*c00[0] + b*c10[0] + c*c01[0] + d*c11[0];
      out[1] = a*c00[1] + b*c10[1] + c*c01[1] + d*c11[1];
      out[2] = a*c00[2] + b*c10[2] + c*c01[2] + d*c11[2];
    }
  }

  // Filter river segments to those overlapping this chunk's AABB (with margin).
  const margin = 32;
  const localSegs = [];
  for (const s of riverSegments) {
    const segMinX = Math.min(s.x0, s.x1) - s.width;
    const segMaxX = Math.max(s.x0, s.x1) + s.width;
    const segMinZ = Math.min(s.z0, s.z1) - s.width;
    const segMaxZ = Math.max(s.z0, s.z1) + s.width;
    if (segMaxX < x0 - margin || segMinX > x0 + CHUNK_SIZE + margin) continue;
    if (segMaxZ < z0 - margin || segMinZ > z0 + CHUNK_SIZE + margin) continue;
    localSegs.push(s);
  }

  // Interior vertices
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const t = (i / vertexGrid);
      const u = (j / vertexGrid);
      const x = x0 + t * CHUNK_SIZE;
      const z = z0 + u * CHUNK_SIZE;
      const y = terrainHeight(x, z, seed);
      const idx = j * N + i;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
    }
  }

  // --- Village pad flattening ---
  // For each affecting village, lerp the vertex toward village.groundY using
  // a smoothstep falloff between padRadius and falloffRadius. Overlapping
  // villages take the max-`t`. Runs BEFORE river carve so carving still wins
  // where it overlaps (placement excluded villages on rivers, so no conflict
  // in practice — this is defense-in-depth).
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
        const u = (V.falloffRadius - d) / (V.falloffRadius - V.padRadius);
        const t = u >= 1 ? 1 : (u <= 0 ? 0 : u);
        const smoothT = t * t * (3 - 2 * t);
        if (smoothT > bestT) { bestT = smoothT; bestGroundY = V.groundY; }
      }
      if (bestT > 0) {
        positions[i * 3 + 1] = positions[i * 3 + 1] * (1 - bestT) + bestGroundY * bestT;
      }
    }
  }

  // Carve rivers in-place
  if (localSegs.length > 0) {
    applyRiverCarve(positions.subarray(0, totalInterior * 3), localSegs, RIVER_CARVE_DEPTH);
  }

  // Compute normals on the interior grid (cross-product of edge vectors).
  // Skirt verts inherit interior edge normals.
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const idx = j * N + i;
      const p = idx * 3;
      const cx0 = positions[p], cy0 = positions[p + 1], cz0 = positions[p + 2];
      // Sample four neighbors (clamped at edges)
      const li = Math.max(0, i - 1), ri = Math.min(N - 1, i + 1);
      const lj = Math.max(0, j - 1), rj = Math.min(N - 1, j + 1);
      const lp = (j * N + li) * 3;
      const rp = (j * N + ri) * 3;
      const dp = (rj * N + i) * 3;
      const up = (lj * N + i) * 3;
      const ex = positions[rp] - positions[lp];
      const ey = positions[rp + 1] - positions[lp + 1];
      const ez = positions[rp + 2] - positions[lp + 2];
      const fx = positions[dp] - positions[up];
      const fy = positions[dp + 1] - positions[up + 1];
      const fz = positions[dp + 2] - positions[up + 2];
      // n = -(e × f)  (so y is positive for upward terrain)
      let nx = -(ey * fz - ez * fy);
      let ny = -(ez * fx - ex * fz);
      let nz = -(ex * fy - ey * fx);
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      normals[p]     = nx / len;
      normals[p + 1] = ny / len;
      normals[p + 2] = nz / len;

      // Perturb the height used for band lookup so boundaries are wavy, not
      // perfectly horizontal contour lines. ~70m wavelength, ±25m amplitude.
      // NOTE: yReal (unjittered) is what classifies water/sand; jitter only
      // applies above-water so it never reclassifies dry terrain as submerged.
      const yJitter = (fbm(cx0 * BAND_JITTER_FREQ, cz0 * BAND_JITTER_FREQ, seed + 53) - 0.5) * 2 * BAND_JITTER_AMP;
      // Per-vertex band palette via 4-corner bilerp — smooth across biome
      // boundaries and continuous across chunk edges.
      bilerpBandsInto(i / vertexGrid, j / vertexGrid);
      writeColorForHeight(colors, p, cy0, cy0 + yJitter, scratchBands);
    }
  }

  // Skirt vertices: walk each edge in order, drop Y.
  // Skirt vertex indices start at `totalInterior`.
  let sIdx = totalInterior;
  function emitSkirt(i, j) {
    const interiorIdx = j * N + i;
    const p = interiorIdx * 3;
    const sp = sIdx * 3;
    positions[sp]     = positions[p];
    positions[sp + 1] = positions[p + 1] - SKIRT_DROP;
    positions[sp + 2] = positions[p + 2];
    normals[sp]     = normals[p];
    normals[sp + 1] = normals[p + 1];
    normals[sp + 2] = normals[p + 2];
    colors[sp]     = colors[p];
    colors[sp + 1] = colors[p + 1];
    colors[sp + 2] = colors[p + 2];
    sIdx++;
  }
  // Edges in fixed order: north (j=0), east (i=N-1), south (j=N-1), west (i=0).
  const skirtNorthStart = totalInterior;
  for (let i = 0; i < N; i++) emitSkirt(i, 0);
  const skirtEastStart = sIdx;
  for (let j = 0; j < N; j++) emitSkirt(N - 1, j);
  const skirtSouthStart = sIdx;
  for (let i = 0; i < N; i++) emitSkirt(i, N - 1);
  const skirtWestStart = sIdx;
  for (let j = 0; j < N; j++) emitSkirt(0, j);

  // Interior triangles
  let iOut = 0;
  for (let j = 0; j < vertexGrid; j++) {
    for (let i = 0; i < vertexGrid; i++) {
      const a = j * N + i;
      const b = j * N + i + 1;
      const c = (j + 1) * N + i;
      const d = (j + 1) * N + i + 1;
      indices[iOut++] = a; indices[iOut++] = c; indices[iOut++] = b;
      indices[iOut++] = b; indices[iOut++] = c; indices[iOut++] = d;
    }
  }
  // Skirt triangles per edge: connect each interior edge vertex to its skirt counterpart.
  function emitSkirtStrip(getInteriorIdx, getSkirtIdx) {
    for (let k = 0; k < vertexGrid; k++) {
      const a = getInteriorIdx(k);
      const b = getInteriorIdx(k + 1);
      const c = getSkirtIdx(k);
      const d = getSkirtIdx(k + 1);
      indices[iOut++] = a; indices[iOut++] = c; indices[iOut++] = b;
      indices[iOut++] = b; indices[iOut++] = c; indices[iOut++] = d;
    }
  }
  // North edge: interior j=0, i=0..N-1 ; skirts skirtNorthStart..+N
  emitSkirtStrip(k => k, k => skirtNorthStart + k);
  // East edge: interior i=N-1, j=0..N-1 (need correct winding so face points outward)
  emitSkirtStrip(k => k * N + (N - 1), k => skirtEastStart + k);
  // South edge: interior j=N-1, i=0..N-1
  emitSkirtStrip(k => (N - 1) * N + k, k => skirtSouthStart + k);
  // West edge: interior i=0, j=0..N-1
  emitSkirtStrip(k => k * N, k => skirtWestStart + k);

  // Trees (LOD 0). Billboards removed — distant scatter is invisible; trees
  // grow in from zero via the tree material's shrink-fade as you approach.
  const trees = lod === 0 ? placeTrees(cx, cz, seed, localSegs, TREE_GRID_PITCH, villages) : [];
  const billboards = [];

  // --- Building emission ---
  // Only villages whose anchor sits inside THIS chunk emit. Neighbours that
  // only feel the flattening/exclusion (i.e. anchor in another chunk) do not
  // double-render their buildings here.
  const buildings = { house: [], barn: [], windmill: [], windmillBlades: [], church: [] };
  if (lod === 0 && villages.length > 0) {
    const cx0 = cx * CHUNK_SIZE, cx1 = cx0 + CHUNK_SIZE;
    const cz0 = cz * CHUNK_SIZE, cz1 = cz0 + CHUNK_SIZE;
    for (const V of villages) {
      if (V.x < cx0 || V.x >= cx1 || V.z < cz0 || V.z >= cz1) continue;
      const instances = layoutVillage(V);
      for (const b of instances) {
        if (!buildings[b.type]) continue;
        buildings[b.type].push(b);
        // Each windmill spawns ONE blade instance — the blade geometry is a
        // 4-armed cross, so a single instance produces the whole fan and the
        // shader spins it as one piece (around local Z).
        if (b.type === 'windmill') {
          buildings.windmillBlades.push({
            type: 'windmillBlades',
            x: b.x, y: b.y + 5.5, z: b.z,
            rotY: b.rotY,
            rotZ: 0,
            scaleX: b.scaleX, scaleY: b.scaleY, scaleZ: b.scaleZ,
            wallColor: b.wallColor,
            roofColor: [1.0, 0.95, 0.85],   // off-white blades
            templateKey: b.templateKey,
          });
        }
      }
    }
  }

  return { positions, indices, normals, colors, trees, billboards, buildings };
}

// Deterministic tree placement for a chunk.
// Returns Array<{ x, y, z, scale, tint, rotation }>. `pitch` controls density.
function placeTrees(cx, cz, seed, localSegs, pitch, villages = []) {
  const out = [];
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  for (let j = 0; j < CHUNK_SIZE; j += pitch) {
    for (let i = 0; i < CHUNK_SIZE; i += pitch) {
      // Deterministic jitter inside the cell
      const cellX = x0 + i, cellZ = z0 + j;
      const j1 = hash2(Math.floor(cellX), Math.floor(cellZ), seed | 0);
      const j2 = hash2(Math.floor(cellX) + 11, Math.floor(cellZ) + 17, seed ^ 0x55);
      const x = cellX + (j1 - 0.5) * pitch * 0.85;
      const z = cellZ + (j2 - 0.5) * pitch * 0.85;
      const y = terrainHeight(x, z, seed);
      // Reject under water / above snow
      if (y < WATER_LEVEL + 0.6) continue;
      if (y > SNOW_LINE) continue;
      // Reject inside river width + 1m
      if (riverDepthAt(x, z, localSegs, 1) > 0) continue;
      // Reject inside any village pad (+4 m margin so trees don't poke into walls)
      let inVillage = false;
      for (const V of villages) {
        const dx = x - V.x, dz = z - V.z;
        const padR = V.padRadius + 4;
        if (dx * dx + dz * dz < padR * padR) { inVillage = true; break; }
      }
      if (inVillage) continue;
      // Slope: use central-difference height samples
      const yL = terrainHeight(x - 1, z, seed);
      const yR = terrainHeight(x + 1, z, seed);
      const yU = terrainHeight(x, z - 1, seed);
      const yD = terrainHeight(x, z + 1, seed);
      const slope = Math.max(Math.abs(yR - yL), Math.abs(yD - yU)) / 2;
      if (slope > 2.8) continue;     // doubled with heightfield amplitude
      // Density curve: peaks at TREE_PEAK_HEIGHT
      const density = Math.max(0, 1 - Math.abs(y - TREE_PEAK_HEIGHT) / TREE_DENSITY_HALFWIDTH);
      const acceptRoll = hash2(Math.floor(cellX) * 31, Math.floor(cellZ) * 31, seed * 3);
      if (acceptRoll > density) continue;
      const tintRoll = hash2(Math.floor(cellX) * 13, Math.floor(cellZ) * 17, seed * 5);
      const tint = tintRoll < 0.5 ? 0 : 1;
      const scale = 0.7 + tintRoll * 0.5;
      const rotation = j1 * Math.PI * 2;
      out.push({ x, y, z, scale, tint, rotation });
    }
  }
  return out;
}

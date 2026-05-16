# Forest Village POI Design

**Status:** approved by user, ready for implementation plan
**Scope:** Forest-biome villages only. Future biome templates (desert, arctic) and future POI categories (castles, monasteries) are designed for but out of scope for v1.

## Goal

Add procedurally placed forest villages to the FlightSim world as common scenery — small clusters of low-poly buildings (4–14 each, three size tiers) scattered across forest-biome lowlands, ~50–70 per 64 km world, deterministic per seed. Flavor only in v1; no gameplay role beyond visual interest.

## Architecture overview

```
lib/poi/
├── villages.js                ← anchor sampler + global registry
├── village-layout.js          ← deterministic per-village layout
├── buildings.js               ← geometry library (house, barn, windmill, church)
└── templates/
    └── forest.js              ← FOREST_TEMPLATE: palette, size tiers, layoutFn
```

Three independently testable units:
- **Placement** (anchor grid scan) — pure data, no geometry, no THREE.
- **Layout** (one village → list of Building data) — pure data, deterministic per (x, z, paletteSeed).
- **Rendering** (Building data + chunk → InstancedMesh) — owned by chunk-manager, mirrors the existing tree pattern.

## Data flow

### At terrain init (one-time, sync, main thread)

`terrain/index.js` calls `buildVillageRegistry({ seed, biomeAt, riverSegments, terrainHeightFn })`.

`villages.js` walks a 64×64 = 4096-cell anchor grid over the 64 km world (1 km per cell). For each cell at world position `(cx, cz)` = cell center:

1. **Biome check:** `biomeAt(cx, cz).key === 'forest'`
2. **Altitude check:** `terrainHeightFn(cx, cz) ∈ [10, 80]`
3. **River clearance:** `riverDepthAt(cx, cz, riverSegments, 1) === 0`
4. **Sampling roll:** `hash3(cellX, cellZ, seed) < 0.12`

Eligible cells produce a `Village` entry:
```
{
  id: monotonic,
  x, z: world coordinates of anchor (cell center),
  groundY: terrainHeightFn(x, z),       // flattening target
  sizeTier: 'S' | 'M' | 'L',            // from hash3(cellX, cellZ, seed ^ 0xC0FFEE)
  padRadius: 25 | 35 | 50,              // by sizeTier
  falloffRadius: padRadius + 25,
  paletteSeed: hash3(cellX, cellZ, seed ^ 0xBEEFFACE),
  templateKey: 'forest',
}
```

Size tier from the same hash:
- `< 0.55` → S (4–5 buildings)
- `< 0.85` → M (7–9 buildings)
- `else` → L (11–14 buildings + central feature)

`buildVillageRegistry` returns `{ all: Village[], inChunk(cx, cz) → Village[] }`.

### At chunk build (worker thread, per chunk)

`chunk-build.js` receives `villagesAffectingChunk: Village[]` — entries whose `(x, z)` is within `chunk.aabb.expand(falloffRadius)`. This lets a village near a chunk boundary affect terrain in up to 4 neighbor chunks. The chunk applies:

1. **Terrain flattening** (after natural height pass, before river carve):
   For each vertex (x, z) in the chunk's vertex grid, for each affecting village:
   ```
   d = distance((x,z), (village.x, village.z))
   if d >= falloffRadius: continue
   t = smoothstep(falloffRadius, padRadius, d)   // 1 at pad, 0 at falloff edge
   vertex.y = lerp(vertex.y, village.groundY, t)
   ```
   Overlapping villages take the max-`t` village.

2. **Tree exclusion** (in `placeTrees`):
   For each candidate position, if any affecting village's pad covers it (`d < padRadius + 4`), skip.
   Applied to ALL scatter types (conifer, cactus, ice spike) — modifying `placeTrees` once benefits future biome templates.

3. **Building emission**: only villages whose `(x, z)` falls inside THIS chunk emit buildings. Adjacent chunks that are only affected by flattening/exclusion do NOT emit buildings — prevents double rendering.

Each village whose anchor is in the chunk runs `layoutVillage(village)` to produce a `BuildingInstance[]`. The chunk-build output gains a new field:
```
buildings: { [type: 'house' | 'barn' | 'windmill' | 'church']: BuildingInstance[] }
```
Each `BuildingInstance` is `{ x, y, z, rotY, scaleX, scaleY, scaleZ, wallColor: [r,g,b], roofColor: [r,g,b] }`.

### At chunk render (main thread)

`chunk-manager.js` receives the per-chunk `buildings` map. For each non-empty type list, build one InstancedMesh:
- Geometry: pre-built `houseGeometry` / `barnGeometry` / `windmillGeometry` / `churchGeometry` (built once at init by `buildings.js`).
- Material: shared `buildingMaterial` (one for all building types).
- Per-instance attributes:
  - `instanceMatrix` from `(x, y, z, rotY, scaleXYZ)`
  - `aWallColor` (InstancedBufferAttribute, vec3)
  - `aRoofColor` (InstancedBufferAttribute, vec3)
- The InstancedMesh is added to the chunk's group. When the chunk is evicted, the InstancedMesh is disposed alongside the terrain mesh.

Windmill blades render as a 5th InstancedMesh per chunk (when any village has a windmill); the material includes a `uTime` uniform driving rotation.

## Layout generation

`layoutVillage({ x, z, sizeTier, paletteSeed }) → BuildingInstance[]`

Deterministic, seeded by `paletteSeed`. Algorithm:

1. **Choose a main-street axis** — `theta = (rand() * 2π)` from PRNG seeded by paletteSeed.
2. **Lay out houses** along ±theta in two loose rows offset by ~6m.
   - S: 4–5 houses, single row
   - M: 7–9 houses, two rows
   - L: 11–14 houses, two rows + central 4m × 4m "square" (no houses inside the square)
3. **Add anchors:**
   - S: 50% chance of barn at one end
   - M: barn + windmill on opposite ends
   - L: barn + windmill + church (at central square)
4. **Per-building jitter:** position ±1m, rotation ±15°, scale ±15% (uniform).
5. **Collision avoidance:** linear AABB check against earlier buildings, shift along axis up to 3 attempts; skip if still colliding.
6. **Palette:**
   - `wallTone = pickFromCreams(paletteSeed)` — picked from 3-color cream palette
   - `roofTone = pickFromReds(paletteSeed ^ 1)` — picked from 3-color rust/brown palette
   - Each building's `wallColor`/`roofColor` = village tone + small per-building jitter (±5% RGB)

All positions returned in world coordinates (anchor + offset).

## Building geometry primitives

`buildings.js` exports `buildHouseGeometry(THREE)` etc. Each returns a `THREE.BufferGeometry` with:
- `position` (Float32, vec3) — vertex world-local positions
- `normal` (Float32, vec3) — explicit per-face normals (flat-shading, no `computeVertexNormals`)
- `colorRole` (Float32, scalar) — 0 = wall, 1 = roof; consumed in the vertex shader to pick `aWallColor` vs `aRoofColor`

Approximate triangle counts:
- House: ~24 tris (box 12 + gable roof 12). Dimensions 3 × 3 × 4.
- Barn: ~24 tris. Dimensions 5 × 3.5 × 7.
- Windmill: tower (cylinder 12 segs) + cone cap (8 segs) ≈ 80 tris; 4 blades render separately.
- Church: ~50 tris (nave + bell tower).

Per-chunk render budget worst case: ~14 buildings × ~30 tris = ~420 tris. Across the LOD-0 ring, this is dwarfed by terrain triangle count.

## Material: `buildingMaterial`

Created in `terrain/index.js` alongside `treeMaterial`. Separate material because trees have wind sway baked into their `onBeforeCompile` that would whip building walls.

```
const buildingMaterial = new THREE.MeshPhongMaterial({
  vertexColors: true, flatShading: true, shininess: 0
});
buildingMaterial.userData.uFadeStart = { value: 600 };
buildingMaterial.userData.uFadeEnd   = { value: 750 };
```

`onBeforeCompile` injects two shader modifications:

1. **Distance shrink-fade** — identical pattern to `treeMaterial`'s fade:
   ```
   vec4 worldInst = modelMatrix * instanceMatrix * vec4(0,0,0,1);
   float d = distance(worldInst.xyz, cameraPosition);
   float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, d);
   transformed *= fade;
   ```

2. **Per-instance color routing** — adds `attribute vec3 aWallColor;` and `attribute vec3 aRoofColor;` to the vertex shader, plus `attribute float colorRole;` from geometry. Then:
   ```
   vec3 col = mix(aWallColor, aRoofColor, colorRole);
   vColor = col;
   ```
   This pipes into Phong's existing `USE_COLOR` path (because the material was created with `vertexColors: true`).

The windmill **blades** use a separate material `windmillBladeMaterial` — same fade, but with an extra `uTime` uniform rotating `transformed` around the X axis at 0.6 rad/s.

## LOD scope (v1)

- **LOD 0** (0–768m): full buildings. Shrink-fade at 600–750m.
- **LOD 1** (768–1536m): no buildings. Villages disappear at LOD-0 boundary; the shrink-fade softens the pop.
- **LOD 2** (>1536m): nothing.

If post-playtest the missing-at-distance feels bad, a follow-up adds a single-quad billboard pass at LOD 1.

## Determinism

Three independent hashes per cell, all seeded by the world `seed`:
- placement roll → `hash3(cellX, cellZ, seed)`
- size tier roll → `hash3(cellX, cellZ, seed ^ 0xC0FFEE)`
- palette seed → `hash3(cellX, cellZ, seed ^ 0xBEEFFACE)`

`hash3(a, b, s) = ((a * 73856093) ^ (b * 19349663) ^ s) >>> 0` then `/ 0xffffffff` → [0, 1).

A given world seed produces the same villages, the same layouts, the same colors on every reload.

## Edge cases

- **No eligible cells in world:** registry empty, game runs normally, no buildings render.
- **Village spans chunk boundary:** flattening and tree exclusion run per chunk on the affecting village list; building emission only on the chunk containing the anchor. No double-render. A building's geometry extending past the chunk edge is fine — the chunk group is in world space, geometry visible regardless.
- **Two anchors near a chunk corner:** both affect that chunk's terrain flattening; pad takes the max-`t` value. Both contribute to tree exclusion (union of pads). Buildings emitted only from the chunk containing each anchor.
- **River near a village:** prevented by 600m river clearance check at placement.
- **Mountainside village:** prevented by altitude cap (80m).

## Testing

Unit-testable with vitest (already in deps; the project's tests pattern is `tests/**/*.test.js`):

1. `villages.test.js` — given a seed and fake biome/height functions, registry produces deterministic Village[] with stable IDs.
2. `village-layout.test.js` — `layoutVillage` returns the same Building[] for the same input across calls; no collisions in returned positions; building counts match size tier.
3. `buildings.test.js` — each `buildXxxGeometry` returns valid BufferGeometry with position + normal + colorRole attributes, expected vertex counts.

Visual / integration testing happens locally on `http://localhost:8085` via puppeteer screenshots (existing pattern).

## What v1 explicitly does NOT include

- Desert, arctic, or any non-forest village template
- Castles, monasteries, or any non-village POI category
- Inhabitants, smoke chimneys, lights at dusk, ambient sound
- Roads between villages, cross-chunk paths
- Minimap pings, HUD landmarks, mission targets
- LOD 1 billboard pass

The architecture is shaped to accept all of the above without changes to placement, layout, or render core. They are deliberately deferred.

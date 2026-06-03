import { buildRiverGraph } from './river-graph.js';
import { ChunkManager } from './chunk-manager.js';
import { ChunkRunner } from './chunk-runner.js';
import { ChunkWorkerProxy } from './chunk-worker-proxy.js';
import { buildTerrainMaterial, applyStyle, buildSkyDome, STYLES } from './style-system.js';
import { buildWaterPlane } from './water.js';
import { buildConiferGeometry, buildBillboardGeometry, buildBillboardMaterial } from './trees.js';
import { terrainHeight } from './height.js';
import { flattenGroundHeight } from './pad-flatten.js';
import { riverDepthAt } from './carve.js';
import { buildVillageRegistry } from '../poi/villages.js';
import { LandmarkMarkers } from '../poi/markers.js';
import {
  buildHouseGeometry, buildFlatHouseGeometry, buildSteepHouseGeometry,
  buildBarnGeometry, buildChurchGeometry,
  buildWindmillTowerGeometry, buildWindmillBladeGeometry,
  buildRunwayGeometry,
  buildCastleKeepGeometry, buildCastleTowerGeometry, buildCastleWallGeometry,
  buildMonasteryChurchGeometry, buildMonasteryWingGeometry,
} from '../poi/buildings.js';

const SEED_KEY = 'terrain.seed';
const WORLD_SIZE = 64000;
const RIVER_GRID_N = 256;

function resolveSeed(opts) {
  if (opts.seed !== undefined && opts.seed !== null) return opts.seed | 0;
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('seed');
  if (fromUrl !== null) {
    const parsed = parseInt(fromUrl, 36);
    if (Number.isFinite(parsed)) return parsed;
  }
  const stored = window.localStorage.getItem(SEED_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  const seed = buf[0] >>> 0;
  window.localStorage.setItem(SEED_KEY, String(seed));
  return seed;
}

export function createTerrain(opts) {
  const { THREE, scene, renderer, biomeAt = null, scatterGeometries = null } = opts;
  if (!THREE || !scene || !renderer) {
    throw new Error('createTerrain requires { THREE, scene, renderer }');
  }
  const seed = resolveSeed(opts);

  // 1. River graph (one-time, main thread).
  const graph = buildRiverGraph({ seed, gridN: RIVER_GRID_N, worldSize: WORLD_SIZE });

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

  // 2. Worker (or main-thread fallback).
  let runner;
  let runnerType;
  try {
    runner = new ChunkWorkerProxy({ seed, riverSegments: graph.segments });
    runnerType = 'worker';
  } catch (err) {
    console.warn('[terrain] Worker unavailable, falling back to main-thread chunk gen.', err);
    runner = new ChunkRunner({ seed, riverSegments: graph.segments });
    runnerType = 'main-thread';
  }
  console.log('[terrain] chunk runner:', runnerType, 'seed:', seed);

  // 3. Materials, water, lights.
  const terrainMaterial = buildTerrainMaterial(THREE);
  // MeshPhongMaterial supports flatShading; MeshLambertMaterial in r128 doesn't.
  const treeMaterial = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0 });
  // Wind sway: cone vertices (y > 1.2) sway based on time + per-instance world-XZ phase.
  // Trunk vertices (y ≤ 1.2) stay fixed so the base doesn't visibly slide.
  // Distance fade: trees scale toward 0 at the LOD-0 ring edge so newly-loaded
  // chunks grow their trees in from zero rather than popping in at full size.
  treeMaterial.userData.uTime          = { value: 0 };
  // Doubled from 600/750 — trees emit at LOD 0 AND LOD 1 now, so visibility
  // extends to ~1.5 km from camera.
  treeMaterial.userData.uTreeFadeStart = { value: 1200 };
  treeMaterial.userData.uTreeFadeEnd   = { value: 1500 };
  treeMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime          = treeMaterial.userData.uTime;
    shader.uniforms.uTreeFadeStart = treeMaterial.userData.uTreeFadeStart;
    shader.uniforms.uTreeFadeEnd   = treeMaterial.userData.uTreeFadeEnd;
    shader.vertexShader =
      `uniform float uTime;\nuniform float uTreeFadeStart;\nuniform float uTreeFadeEnd;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
         {
           // instanceMatrix[3].xyz is the per-tree translation (world XZ via modelMatrix).
           vec3 _instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
           float _swayH = max(0.0, position.y - 1.2);
           float _phase = _instOrigin.x * 0.05 + _instOrigin.z * 0.03;
           transformed.x += sin(uTime * 1.2 + _phase) * 0.020 * _swayH;
           transformed.z += cos(uTime * 0.9 + _phase * 1.1) * 0.015 * _swayH;
           // Shrink-fade at LOD ring edge. Tree is scaled around its local
           // origin (trunk base), so fade→0 collapses to a point at ground level.
           vec4 _worldInst = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           float _distToCam = distance(_worldInst.xyz, cameraPosition);
           float _fade = 1.0 - smoothstep(uTreeFadeStart, uTreeFadeEnd, _distToCam);
           transformed *= _fade;
         }
         #endif`
      );
  };
  const treeGeometry = buildConiferGeometry(THREE);
  const billboardMaterial = buildBillboardMaterial(THREE);
  // Near-mode billboard overlay used in LOD-0 chunks. Visible at the far edge
  // of LOD 0 and fades OUT as the tree at the same position grows in. The two
  // fade ranges are mirror images: tree fade 750→600 in, billboard fade
  // 750→600 out, so the silhouette stays unbroken through LOD 1→0 transition.
  const billboardMaterialNear = buildBillboardMaterial(THREE, {
    fadeMode: 'near', fadeStart: 600, fadeEnd: 750,
  });
  const billboardGeometry = buildBillboardGeometry(THREE);

  // --- Building material ---
  // Shared by all village building types (house, barn, windmill tower, church).
  // Distance shrink-fade matches the tree pattern (600–750m). Per-instance
  // colors via two InstancedBufferAttributes (aWallColor, aRoofColor), routed
  // in the vertex shader by per-vertex `colorRole` (0 = wall, 1 = roof).
  const buildingMaterial = new THREE.MeshPhongMaterial({
    vertexColors: true, flatShading: true, shininess: 0,
    // DoubleSide because the prism-roof triangles in buildings.js have
    // inward-facing winding (the explicit per-face normals are outward, so
    // lighting is correct, but FrontSide culling would hide them).
    side: THREE.DoubleSide,
  });
  // Doubled from 900/1200 — buildings emit at LOD 0 AND LOD 1, visible
  // out to ~2.4 km.
  buildingMaterial.userData.uFadeStart = { value: 1800 };
  buildingMaterial.userData.uFadeEnd   = { value: 2400 };
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
  // behaviour. Shares the wall/roof color attributes (both get the same accent
  // tone per instance so the shader path matches buildingMaterial).
  const windmillBladeMaterial = new THREE.MeshPhongMaterial({
    vertexColors: true, flatShading: true, shininess: 0,
    side: THREE.DoubleSide,
  });
  windmillBladeMaterial.userData.uTime      = { value: 0 };
  windmillBladeMaterial.userData.uFadeStart = { value: 1800 };
  windmillBladeMaterial.userData.uFadeEnd   = { value: 2400 };
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
             // Rotate around local Z by uTime * 0.6 rad/s — the blade
             // geometry is a 4-armed cross in the XY plane; Z is the
             // hub axis perpendicular to the fan plane.
             float _ang = uTime * 0.6;
             float _c = cos(_ang), _s = sin(_ang);
             vec3 _r = vec3(
               transformed.x * _c - transformed.y * _s,
               transformed.x * _s + transformed.y * _c,
               transformed.z
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

  // --- Building geometries ---
  // One BufferGeometry per building type, built once and shared across all
  // chunks. ChunkManager clones per-chunk before setting per-instance color
  // attributes so chunks don't stomp each other's attribute data.
  const buildingGeometries = {
    // Default per type (used when no biome variant matches)
    house:          buildHouseGeometry(THREE),
    barn:           buildBarnGeometry(THREE),
    church:         buildChurchGeometry(THREE),
    windmill:       buildWindmillTowerGeometry(THREE),
    windmillBlades: buildWindmillBladeGeometry(THREE),
    // Biome-specific house variants — ChunkManager looks up `${type}_${templateKey}`
    // first and falls back to plain `type` if no variant exists.
    house_forest:   buildHouseGeometry(THREE),
    house_desert:   buildFlatHouseGeometry(THREE),
    house_arctic:   buildSteepHouseGeometry(THREE),
    runway:         buildRunwayGeometry(THREE),
    // Castle pieces
    castle_keep:    buildCastleKeepGeometry(THREE),
    castle_tower:   buildCastleTowerGeometry(THREE),
    castle_wall:    buildCastleWallGeometry(THREE),
    castle_chapel:  buildHouseGeometry(THREE),   // small inner chapel — reuses house shape
    // Monastery pieces
    monastery_church: buildMonasteryChurchGeometry(THREE),
    monastery_wing:   buildMonasteryWingGeometry(THREE),
  };

  // Water plane is sized to comfortably exceed camera far-plane; we move it to follow
  // the camera in XZ each frame so the edge is never visible and depth precision stays
  // useful (a fixed 64 km plane at origin caused horizon flicker when viewed from far).
  const water = buildWaterPlane(THREE, 16000);
  scene.add(water);

  const skyDome = buildSkyDome(THREE);
  scene.add(skyDome);

  // Sun + hemi intensities tuned so vertex colors stay saturated (don't
  // clip toward white). Total scene exposure ~1.0 instead of 1.55.
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(80, 120, 60);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xb8e0ff, 0x6a8050, 0.35);
  scene.add(hemi);

  // 4. Style.
  const styleName = opts.style || 'lowpoly';
  applyStyle(THREE, scene, terrainMaterial, sun, hemi, water, styleName, skyDome);

  // (Orange in-world beacon was removed — the HUD arrow + distance readout
  // is enough to find the nearest POI, and the beacon pillar was cluttering
  // the view once the player learned to use the arrow.)

  // Fly-through markers — one billboarded vertical ring per landmark. The
  // ring rotates around Y each frame to face the plane, so the pilot can
  // fly through it from any approach direction.
  const landmarks = [];
  for (const v of villageRegistry.all) {
    const t = v.markerTarget;
    if (!t) continue;
    landmarks.push({ id: `v:${v.id}`, x: t.x, y: t.y, z: t.z });
  }
  const markers = new LandmarkMarkers(THREE, scene, landmarks, opts.visited);

  // 5. Chunk manager.
  const perfMode = opts.perfMode === 'auto' ? 'high' : (opts.perfMode || 'high');
  const cm = new ChunkManager({
    THREE, scene, runner, terrainMaterial, treeMaterial, treeGeometry,
    billboardMaterial, billboardMaterialNear, billboardGeometry, perfMode,
    biomeAt, scatterGeometries,
    villageRegistry,
    buildingMaterial,
    windmillBladeMaterial,
    buildingGeometries,
  });

  return {
    seed,
    riverSegments: graph.segments,
    lakes: graph.lakes,
    update(cameraPos) {
      cm.update(cameraPos);
      water.position.x = cameraPos.x;
      water.position.z = cameraPos.z;
      skyDome.position.copy(cameraPos);
      // Drive the water + tree wind shaders. Seconds since page load is monotonic and
      // independent of any per-frame dt drift, so wave phase stays continuous through stalls.
      const t = performance.now() / 1000;
      water.material.userData.uTime.value = t;
      treeMaterial.userData.uTime.value = t;
      windmillBladeMaterial.userData.uTime.value = t;
    },
    // Ground height = raw terrain blended toward nearby villages' groundY via
    // the SAME shared function the renderer uses (see pad-flatten.js / the
    // village pad flattening in chunk-build.js), so collision and the visible
    // mesh agree everywhere — no more crashing into a mountain that was
    // visually flattened away. The squared-distance early-out makes the
    // full-registry scan cheap (a few subtractions per village, sqrt only for
    // the handful actually nearby).
    getHeight(x, z) {
      const rawY = terrainHeight(x, z, seed);
      const villages = villageRegistry.all;
      return villages.length ? flattenGroundHeight(rawY, x, z, villages) : rawY;
    },
    villageRegistry,
    markers,
    nearestVillage(x, z) {
      // Linear scan over ~50 villages — cheap. Returns the full village
      // object with a `distance` field tacked on, or null. Callers may use
      // x/z/distance for HUD nav and buildings/falloffRadius for collision.
      const all = villageRegistry.all;
      if (all.length === 0) return null;
      let best = all[0];
      let bestD2 = (best.x - x) ** 2 + (best.z - z) ** 2;
      for (let i = 1; i < all.length; i++) {
        const v = all[i];
        const d2 = (v.x - x) ** 2 + (v.z - z) ** 2;
        if (d2 < bestD2) { bestD2 = d2; best = v; }
      }
      return Object.assign({ distance: Math.sqrt(bestD2) }, best);
    },
    getRiverWidthAt(x, z) {
      const d = riverDepthAt(x, z, graph.segments, 1);
      return d > 0 ? 1 : 0;
    },
    setStyle(name) { applyStyle(THREE, scene, terrainMaterial, sun, hemi, water, name, skyDome); },
    setPerfMode(mode) { cm.setPerfMode(mode === 'auto' ? 'high' : mode); },
    dispose() {
      cm.dispose();
      scene.remove(water);
      water.geometry.dispose();
      water.material.dispose();
      scene.remove(skyDome);
      skyDome.geometry.dispose();
      skyDome.material.dispose();
      scene.remove(sun);
      scene.remove(hemi);
      terrainMaterial.dispose();
      treeMaterial.dispose();
      treeGeometry.dispose();
      billboardMaterial.dispose();
      billboardGeometry.dispose();
    },
  };
}

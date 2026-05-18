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

// Flat slab "roof" — a thin overhanging cap on top of the walls. role=1
// (roof) so the per-instance roof color paints it.
function pushFlatRoof(verts, normals, roles, w, h, d, cx, cy, cz) {
  const role = 1;
  const hw = w/2, hd = d/2;
  const x0 = cx - hw, x1 = cx + hw;
  const y0 = cy, y1 = cy + h;
  const z0 = cz - hd, z1 = cz + hd;
  // +Y face (top)
  pushQuad(verts, normals, roles,
    [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], role);
  // -Y face (underside of overhang)
  pushQuad(verts, normals, roles,
    [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0,-1, 0], role);
  // +X / -X / +Z / -Z thin sides
  pushQuad(verts, normals, roles,
    [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], role);
  pushQuad(verts, normals, roles,
    [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0], role);
  pushQuad(verts, normals, roles,
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], role);
  pushQuad(verts, normals, roles,
    [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0,-1], role);
}

// Default house — moderate gable roof. Used by the forest template.
export function buildHouseGeometry(THREE) {
  const v = [], n = [], r = [];
  pushWallsNoTop(v, n, r, 3, 3, 4, 0, 0, 0);
  pushGableRoof(v, n, r, 3, 1.5, 4, 0, 3, 0, 'z');
  return makeGeometry(THREE, v, n, r);
}

// Desert variant: flat slab roof with slight overhang. Sandstone-style.
export function buildFlatHouseGeometry(THREE) {
  const v = [], n = [], r = [];
  pushWallsNoTop(v, n, r, 3, 3.2, 4, 0, 0, 0);
  pushFlatRoof(v, n, r, 3.4, 0.35, 4.4, 0, 3.2, 0);
  return makeGeometry(THREE, v, n, r);
}

// Arctic variant: steep snow-shedding gable. Roof height doubled.
export function buildSteepHouseGeometry(THREE) {
  const v = [], n = [], r = [];
  pushWallsNoTop(v, n, r, 3, 2.8, 4, 0, 0, 0);
  pushGableRoof(v, n, r, 3, 3.0, 4, 0, 2.8, 0, 'z');
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

// Ground shadow that drapes over terrain. A flat "+"-shaped silhouette
// (wing rectangle × body rectangle) tessellated into a 1 m grid; each
// vertex samples the terrain heightfield every frame so the shadow follows
// the ground contour instead of clipping or floating.
//
// One PlaneShadow is created once. setScale() picks per-plane size when
// the user swaps planes; update() runs every frame in FLYING state.

import { WATER_LEVEL } from '../terrain/height.js';

const TEMPLATE_HALF_WINGSPAN   = 5.0;    // template wing extends to ±5 in X
const TEMPLATE_WING_HALF_CHORD = 1.2;    // wing chord 2.4 m in Z
const TEMPLATE_BODY_HALF_WIDTH = 0.6;    // body width 1.2 m in X
const TEMPLATE_BODY_FRONT      = -3.5;   // template z of the nose
const TEMPLATE_BODY_BACK       =  1.5;   // template z of the tail
const GRID_SPACING             =  1.0;   // m between vertices in template space
const SHADOW_LIFT              =  0.2;   // m above terrain (avoids z-fight)
const ALT_FADE_LOW             =  5;     // m AGL: full opacity below this
const ALT_FADE_HIGH            =  250;   // m AGL: invisible above this
const SHADOW_OPACITY           =  0.45;
// WATER_LEVEL comes from terrain/height.js — shadow draping over a lake
// uses max(terrainY, WATER_LEVEL) so the shadow rides the water surface
// instead of sinking under it.

export class PlaneShadow {
  constructor(THREE, scene) {
    // Template grid covers the bounding box of the silhouette. Vertices
    // inside the cross-shape get alpha=1, outside get alpha=0, so the
    // mesh fades to transparent at the silhouette boundary without us
    // having to triangulate around the L-corners.
    const xMin = -TEMPLATE_HALF_WINGSPAN, xMax = TEMPLATE_HALF_WINGSPAN;
    const zMin = TEMPLATE_BODY_FRONT,     zMax = TEMPLATE_BODY_BACK;
    const nx = Math.ceil((xMax - xMin) / GRID_SPACING) + 1;
    const nz = Math.ceil((zMax - zMin) / GRID_SPACING) + 1;

    const template  = new Float32Array(nx * nz * 3);   // immutable (tx, 0, tz)
    const positions = new Float32Array(nx * nz * 3);   // mutated each frame
    const alphas    = new Float32Array(nx * nz);

    for (let j = 0; j < nz; j++) {
      const tz = zMin + (j / (nz - 1)) * (zMax - zMin);
      for (let i = 0; i < nx; i++) {
        const tx = xMin + (i / (nx - 1)) * (xMax - xMin);
        const idx = j * nx + i;
        template[idx * 3 + 0] = tx;
        template[idx * 3 + 1] = 0;
        template[idx * 3 + 2] = tz;
        const inWing = Math.abs(tz) < TEMPLATE_WING_HALF_CHORD;
        const inBody = Math.abs(tx) < TEMPLATE_BODY_HALF_WIDTH;
        alphas[idx] = (inWing || inBody) ? 1 : 0;
      }
    }

    const indices = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = j * nx + i + 1;
        const c = (j + 1) * nx + i;
        const d = (j + 1) * nx + i + 1;
        // Two triangles per quad — order picked so the front face points up.
        indices.push(a, c, b, b, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geom.setAttribute('aAlpha',  new THREE.BufferAttribute(alphas, 1));
    geom.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uAltFade: { value: 1.0 },
        uOpacity: { value: SHADOW_OPACITY },
      },
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uAltFade;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, vAlpha * uAltFade * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.nx = nx;
    this.nz = nz;
    this.template  = template;
    this.positions = positions;
    this.scale = 1;
  }

  // Pick the shadow's size for the current plane. collisionRadius approx-
  // imates half-wingspan on every plane in the roster, so
  // scale = collisionRadius / template-half-wingspan keeps the shadow's
  // tip-to-tip span close to the actual plane's wingspan.
  setScale(planeCollisionRadius) {
    this.scale = planeCollisionRadius / TEMPLATE_HALF_WINGSPAN;
  }

  update(physics, terrain) {
    // "Surface beneath the plane" — terrain when on land, water when over
    // a lake/ocean. Using max(terrain, water) keeps the shadow on top of
    // whichever surface the pilot is actually looking down at.
    const surfaceY = Math.max(terrain.getHeight(physics.x, physics.z), WATER_LEVEL);
    const altAGL   = physics.y - surfaceY;
    let altFade = 1 - (altAGL - ALT_FADE_LOW) / (ALT_FADE_HIGH - ALT_FADE_LOW);
    if (altFade < 0) altFade = 0;
    if (altFade > 1) altFade = 1;
    this.mesh.material.uniforms.uAltFade.value = altFade;
    if (altFade < 0.01) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    // World yaw such that rotY(yaw)·(0,0,-1) = horizontal projection of
    // physics.forward. With Three's rotY convention that's atan2(-fx, -fz).
    const yaw  = Math.atan2(-physics.forward.x, -physics.forward.z);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const scale = this.scale;
    const px = physics.x;
    const pz = physics.z;

    const n = this.nx * this.nz;
    for (let i = 0; i < n; i++) {
      const tx = this.template[i * 3 + 0];
      const tz = this.template[i * 3 + 2];
      const rx = tx * cosY + tz * sinY;
      const rz = -tx * sinY + tz * cosY;
      const sx = rx * scale + px;
      const sz = rz * scale + pz;
      const sy = Math.max(terrain.getHeight(sx, sz), WATER_LEVEL) + SHADOW_LIFT;
      this.positions[i * 3 + 0] = sx;
      this.positions[i * 3 + 1] = sy;
      this.positions[i * 3 + 2] = sz;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

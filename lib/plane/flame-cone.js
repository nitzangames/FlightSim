// Flame cone — a short tapered cone attached to a jet's engine nozzle that
// reads as the visible afterburner plume. The cone's length pulses with a
// fast sine wave to "flicker", the apex is shaded transparent so the cone
// fades into the surrounding particle exhaust, and the base is hot white-
// blue → yellow → orange so it reads as a high-temperature jet of gas.
//
// One FlameCone per nozzle. Attach to worldPlaneMesh so it inherits the
// plane's rotation and (0.875×) scale automatically — call setLocalPosition
// with the nozzle's local (x, y, z) in pre-scale plane coords.

const FLAME_LENGTH       = 2.5;     // metres, before scale + flicker
const FLAME_BASE_RADIUS  = 0.40;    // metres
const FLAME_RADIAL_SEGS  = 14;
const FLAME_FLICKER_HZ   = 14;
const FLAME_FLICKER_AMP  = 0.22;    // ±22% length pulse (in / out along axis)

export class FlameCone {
  constructor(THREE, parent) {
    // ConeGeometry default: apex at +Y, base at -Y. We rotate so the apex
    // points to +Z (rearward), then translate so the BASE sits at z=0 (the
    // nozzle face). Result: a cone whose base is at the nozzle and apex
    // extends FLAME_LENGTH along +Z.
    const geom = new THREE.ConeGeometry(
      FLAME_BASE_RADIUS, FLAME_LENGTH, FLAME_RADIAL_SEGS, 1, true,
    );
    geom.rotateX(Math.PI / 2);
    geom.translate(0, 0, FLAME_LENGTH / 2);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:   { value: 0 },
        uLength: { value: FLAME_LENGTH },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uLength;
        varying float vT;
        varying float vRadial;
        void main() {
          // vT runs 0 at the cone's base (nozzle face, z=0) to 1 at the
          // apex (z=uLength). vRadial is normalised distance from the
          // cone's central axis (0 at the axis, 1 at the base circle).
          vT      = clamp(position.z / uLength, 0.0, 1.0);
          vRadial = length(position.xy) / ${FLAME_BASE_RADIUS.toFixed(3)};

          // Flicker: scale the cone length with a high-frequency sine so
          // the plume visibly pulses in and out along its axis. Apex
          // moves; base stays anchored at z=0 (the nozzle face).
          float pulse = 1.0 + ${FLAME_FLICKER_AMP.toFixed(3)} * sin(uTime * ${FLAME_FLICKER_HZ.toFixed(3)});
          vec3 pos = position;
          pos.z = pos.z * pulse;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying float vT;
        varying float vRadial;
        void main() {
          // Hot white-blue at the base, through yellow at the midpoint, to
          // a deep orange-red at the apex.
          vec3 cBase = vec3(0.92, 0.96, 1.00);
          vec3 cMid  = vec3(1.00, 0.85, 0.30);
          vec3 cTip  = vec3(1.00, 0.25, 0.05);
          vec3 col   = (vT < 0.35)
            ? mix(cBase, cMid, vT / 0.35)
            : mix(cMid, cTip, (vT - 0.35) / 0.65);

          // Alpha: opaque at base, fades to 0 at apex. Radial edge softens.
          float aLen = 1.0 - vT;
          float aRad = 1.0 - smoothstep(0.55, 1.00, vRadial);
          float a    = aLen * aRad * 0.95;
          gl_FragColor = vec4(col * a, a);   // pre-multiplied for additive
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest:  true,
      blending:   THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    parent.add(this.mesh);
    this._mat = mat;
  }

  setLocalPosition(x, y, z) { this.mesh.position.set(x, y, z); }

  update(timeSec) { this._mat.uniforms.uTime.value = timeSec; }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

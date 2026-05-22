// Jet engine particle exhaust. Point-sprite particles spawn at the nozzle
// each frame in world space, drift on a small random velocity, fade from
// hot yellow to dark orange-red, and die after ~0.5 s. Rendered with
// additive blending so the cluster reads as a glowing plume against the
// dark engine nacelle.

const MAX_PARTICLES   = 140;
const LIFETIME        = 0.55;     // seconds
const SPAWN_RATE      = MAX_PARTICLES / LIFETIME;   // particles per second
const SPREAD_VELOCITY = 5.0;      // m/s — uniform random in [-V/2, +V/2]
const AXIAL_BIAS      = 6.0;      // m/s extra speed along the cone axis (+Z local)
const VELOCITY_DAMP   = 3.0;      // 1/s decay so particles slow as they age
const BASE_SIZE       = 11;       // CSS pixels at ~50 m distance
const DIST_SCALE      = 60;       // distance (m) at which size = BASE_SIZE
const SIZE_JITTER     = 0.6;      // ±60% per-particle size variation
const HUE_JITTER      = 0.25;     // amount of per-particle color randomness

export class JetExhaust {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.maxParticles = MAX_PARTICLES;

    this.positions  = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = new Float32Array(MAX_PARTICLES * 3);
    this.ages       = new Float32Array(MAX_PARTICLES);
    this.alive      = new Float32Array(MAX_PARTICLES);
    // Per-particle randomness: re-rolled at spawn. Drives size jitter and a
    // small hue offset so the cluster looks like many distinct cinders
    // rather than a uniform stream of identical dots.
    this.seeds      = new Float32Array(MAX_PARTICLES);
    this.nextSlot         = 0;
    this.spawnAccumulator = 0;

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geom.setAttribute('aAge',
      new THREE.BufferAttribute(this.ages, 1).setUsage(THREE.DynamicDrawUsage));
    geom.setAttribute('aAlive',
      new THREE.BufferAttribute(this.alive, 1).setUsage(THREE.DynamicDrawUsage));
    geom.setAttribute('aSeed',
      new THREE.BufferAttribute(this.seeds, 1).setUsage(THREE.DynamicDrawUsage));
    geom.setDrawRange(0, MAX_PARTICLES);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uLifetime:   { value: LIFETIME },
        uBaseSize:   { value: BASE_SIZE },
        uDistScale:  { value: DIST_SCALE },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: `
        attribute float aAge;
        attribute float aAlive;
        attribute float aSeed;
        uniform float uLifetime;
        uniform float uBaseSize;
        uniform float uDistScale;
        uniform float uPixelRatio;
        varying float vT;
        varying float vAlive;
        varying float vSeed;
        void main() {
          vAlive = aAlive;
          vSeed  = aSeed;
          float t = clamp(1.0 - aAge / uLifetime, 0.0, 1.0);
          vT = t;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          // Per-particle size variance: aSeed in [0,1] maps to a multiplier
          // in [1 - SIZE_JITTER, 1 + SIZE_JITTER]. Combined with perspective
          // scaling so the cluster reads as varied cinders.
          float sizeMul = 1.0 + (aSeed - 0.5) * 2.0 * ${SIZE_JITTER.toFixed(3)};
          gl_PointSize = uBaseSize * uPixelRatio * t * sizeMul
            * (uDistScale / max(-mv.z, 1.0));
        }
      `,
      fragmentShader: `
        varying float vT;
        varying float vAlive;
        varying float vSeed;
        void main() {
          if (vAlive < 0.5) discard;
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          // Bright concentrated core (smaller smoothstep range) so each
          // particle has a hot kernel and a softer halo.
          float disc = 1.0 - smoothstep(0.20, 0.50, d);
          // Three-stop palette: white-blue core, hot yellow body, deep red
          // dying glow. vT (1=fresh, 0=dying) walks across the stops.
          vec3 core = vec3(0.95, 0.98, 1.00);
          vec3 mid  = vec3(1.00, 0.85, 0.30);
          vec3 cool = vec3(1.00, 0.20, 0.04);
          vec3 col  = (vT > 0.6)
            ? mix(mid, core, (vT - 0.6) / 0.4)
            : mix(cool, mid, vT / 0.6);
          // Per-particle hue jitter — shifts the green channel slightly so
          // some particles read yellower / redder.
          col.g += (vSeed - 0.5) * ${HUE_JITTER.toFixed(3)};
          float a = disc * vT * 0.9;
          gl_FragColor = vec4(col * a, a);   // pre-multiplied for additive
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest:  true,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Points(geom, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }

  // Spawn particles at emitterPos (world space) and age existing ones.
  // emitterPos is a THREE.Vector3-like position. exhaustDir is a unit-ish
  // world-space vector pointing in the plane's rearward direction (where
  // exhaust naturally streams) — new particles get an AXIAL_BIAS push
  // along this direction so they trail back instead of just drifting
  // randomly. Pass null to skip the axial bias.
  update(emitterPos, exhaustDir, dt) {
    // Age existing particles and integrate their drift.
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.alive[i] < 0.5) continue;
      this.ages[i] += dt;
      if (this.ages[i] >= LIFETIME) {
        this.alive[i] = 0;
        continue;
      }
      const p = i * 3;
      this.positions[p + 0] += this.velocities[p + 0] * dt;
      this.positions[p + 1] += this.velocities[p + 1] * dt;
      this.positions[p + 2] += this.velocities[p + 2] * dt;
      const damp = Math.max(0, 1 - VELOCITY_DAMP * dt);
      this.velocities[p + 0] *= damp;
      this.velocities[p + 1] *= damp;
      this.velocities[p + 2] *= damp;
    }

    // Spawn new particles at the configured rate.
    this.spawnAccumulator += dt * SPAWN_RATE;
    const toSpawn = Math.floor(this.spawnAccumulator);
    this.spawnAccumulator -= toSpawn;
    for (let n = 0; n < toSpawn; n++) {
      const slot = this._findFreeSlot();
      if (slot < 0) break;
      this.alive[slot] = 1;
      this.ages[slot]  = 0;
      this.seeds[slot] = Math.random();
      const p = slot * 3;
      this.positions[p + 0] = emitterPos.x;
      this.positions[p + 1] = emitterPos.y;
      this.positions[p + 2] = emitterPos.z;
      let vx = (Math.random() - 0.5) * SPREAD_VELOCITY;
      let vy = (Math.random() - 0.5) * SPREAD_VELOCITY;
      let vz = (Math.random() - 0.5) * SPREAD_VELOCITY;
      if (exhaustDir) {
        vx += exhaustDir.x * AXIAL_BIAS;
        vy += exhaustDir.y * AXIAL_BIAS;
        vz += exhaustDir.z * AXIAL_BIAS;
      }
      this.velocities[p + 0] = vx;
      this.velocities[p + 1] = vy;
      this.velocities[p + 2] = vz;
    }

    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aAge.needsUpdate     = true;
    this.mesh.geometry.attributes.aAlive.needsUpdate   = true;
    this.mesh.geometry.attributes.aSeed.needsUpdate    = true;
  }

  _findFreeSlot() {
    for (let i = 0; i < this.maxParticles; i++) {
      const s = (this.nextSlot + i) % this.maxParticles;
      if (this.alive[s] < 0.5) {
        this.nextSlot = (s + 1) % this.maxParticles;
        return s;
      }
    }
    return -1;
  }

  reset() {
    for (let i = 0; i < this.maxParticles; i++) this.alive[i] = 0;
    this.spawnAccumulator = 0;
    this.mesh.geometry.attributes.aAlive.needsUpdate = true;
  }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// Plane-crash debris + flame/smoke effect.
//
// Disassembles the intact plane mesh into its top-level children and
// gives each a velocity + angular velocity so they tumble away from the
// crash point. A bright shell expands at the impact site (the flash) and
// fire + smoke sprite particles are emitted from the crash centre and
// from every piece as it tumbles, so each piece leaves a fading trail
// of fire and smoke.
//
// Particle pools are pre-allocated on first construction and reused
// across crashes — only pieces (and the one-shot flash sphere) are
// rebuilt per crash. Sprite materials use a canvas-texture radial
// gradient (additive for fire, normal blend for smoke) — the same look
// WW1FlightSim uses for its hit effects.
//
// Caller flow (see shell/main.js CRASH state):
//   const debris = new CrashDebris(THREE, scene);
//   debris.start(worldPlaneMesh, physics);
//   // every frame:
//   debris.update(dt, terrain);
//   // on CRASH exit:
//   debris.dispose();
//   // Then call setWorldPlane(currentPlane) to rebuild — start() detached
//   // every child from worldPlaneMesh so it's now an empty group.

const EXPLOSION_LIFETIME_S = 0.45;
const EXPLOSION_MAX_SCALE  = 18;
const FIRE_EMIT_INTERVAL_S  = 0.05;
const SMOKE_EMIT_INTERVAL_S = 0.09;
const PIECE_FLAME_LIFE_S = 1.8;     // pieces stop emitting fire after this
const PIECE_SMOKE_LIFE_S = 2.8;     // pieces stop emitting smoke after this
const FIRE_POOL_SIZE  = 260;
const SMOKE_POOL_SIZE = 180;
const GRAVITY = 9.8;

function makeFireCanvas() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255, 245, 150, 1.0)');
  grad.addColorStop(0.35, 'rgba(255, 140, 40, 0.9)');
  grad.addColorStop(1.0, 'rgba(180, 40, 20, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function makeSmokeCanvas() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(70,70,70,0.85)');
  grad.addColorStop(1, 'rgba(70,70,70,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

// Build a billboard-sprite pool. All slots share one material so the
// canvas texture is uploaded to the GPU exactly once — but each slot
// gets its own .material.opacity by cloning. Slots start hidden.
function buildPool(THREE, scene, canvas, count, additive, baseOpacity, baseScale) {
  const tex = new THREE.CanvasTexture(canvas);
  const baseMat = new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: baseOpacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const slots = [];
  for (let i = 0; i < count; i++) {
    const sprite = new THREE.Sprite(baseMat.clone());
    sprite.visible = false;
    sprite.scale.set(baseScale, baseScale, baseScale);
    scene.add(sprite);
    slots.push({
      sprite, life: 0, maxLife: 1, baseScale, baseOpacity,
      vx: 0, vy: 0, vz: 0,
    });
  }
  return slots;
}

function emit(pool, x, y, z, maxLife, vy = 0, jitter = 0.6) {
  // Linear scan for a free slot. Pool is large enough that this stays
  // cheap; a free-list would help if it ever became a hotspot.
  for (let i = 0; i < pool.length; i++) {
    const s = pool[i];
    if (s.sprite.visible) continue;
    s.sprite.visible = true;
    s.sprite.position.set(x, y, z);
    s.sprite.material.opacity = s.baseOpacity;
    s.sprite.scale.set(s.baseScale, s.baseScale, s.baseScale);
    s.life = maxLife;
    s.maxLife = maxLife;
    s.vx = (Math.random() - 0.5) * jitter;
    s.vy = vy;
    s.vz = (Math.random() - 0.5) * jitter;
    return;
  }
}

// One pass: drift + grow + fade + hide-on-zero-life.
function updatePool(pool, dt, growRate) {
  for (let i = 0; i < pool.length; i++) {
    const s = pool[i];
    if (!s.sprite.visible) continue;
    s.life -= dt;
    s.sprite.position.x += s.vx * dt;
    s.sprite.position.y += s.vy * dt;
    s.sprite.position.z += s.vz * dt;
    const t = 1 - s.life / s.maxLife;
    s.sprite.material.opacity = Math.max(0, s.baseOpacity * (1 - t));
    const g = 1 + t * growRate;
    const sc = s.baseScale * g;
    s.sprite.scale.set(sc, sc, sc);
    if (s.life <= 0) s.sprite.visible = false;
  }
}

export class CrashDebris {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.pieces = [];         // { mesh, velocity, angVel, age, grounded, fireT, smokeT }
    this.explosion = null;    // { mesh, age }
    // Pre-allocate particle pools once. They live in `scene` indefinitely
    // with visible=false slots; emit() flips slots visible as needed.
    this.firePool  = buildPool(THREE, scene, makeFireCanvas(),  FIRE_POOL_SIZE,  true,  0.95, 2.4);
    this.smokePool = buildPool(THREE, scene, makeSmokeCanvas(), SMOKE_POOL_SIZE, false, 0.8,  3.0);
  }

  // Disassemble `planeMesh` into pieces and start the explosion. Each
  // top-level child is reparented to `scene` with its world transform
  // preserved so grouped sub-assemblies (e.g. propeller + blade) stay
  // together. `physics` gives the impact velocity so debris flies in
  // roughly the plane's direction of travel.
  start(planeMesh, physics) {
    const T = this.THREE;
    const crashCenter = new T.Vector3(physics.x, physics.y, physics.z);
    // 30% of impact velocity carries forward into the debris field —
    // less than full so pieces don't streak off camera before gravity
    // catches them.
    const baseV = new T.Vector3(
      physics.forward.x, physics.forward.y, physics.forward.z,
    ).multiplyScalar(physics.speed * 0.3);

    const children = planeMesh.children.slice();
    for (const child of children) {
      const worldPos = new T.Vector3();
      const worldQuat = new T.Quaternion();
      const worldScale = new T.Vector3();
      child.getWorldPosition(worldPos);
      child.getWorldQuaternion(worldQuat);
      child.getWorldScale(worldScale);
      this.scene.add(child);          // detaches from old parent
      child.position.copy(worldPos);
      child.quaternion.copy(worldQuat);
      child.scale.copy(worldScale);

      // Wide radial spread + strong upward bias so the wreckage field
      // is visibly broad rather than collapsing toward one spot.
      const radial = worldPos.clone().sub(crashCenter);
      if (radial.lengthSq() < 0.01) {
        radial.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      }
      radial.normalize();
      const velocity = baseV.clone()
        .addScaledVector(radial, 10 + Math.random() * 12)
        .add(new T.Vector3(
          (Math.random() - 0.5) * 6,
          6 + Math.random() * 9,
          (Math.random() - 0.5) * 6,
        ));
      const angVel = new T.Vector3(
        (Math.random() * 2 - 1) * 8,
        (Math.random() * 2 - 1) * 8,
        (Math.random() * 2 - 1) * 8,
      );

      this.pieces.push({
        mesh: child, velocity, angVel,
        age: 0, grounded: false,
        // Stagger initial emit so the first frame doesn't dump every
        // piece's first particle into a single slot in the pool.
        fireT:  Math.random() * FIRE_EMIT_INTERVAL_S,
        smokeT: Math.random() * SMOKE_EMIT_INTERVAL_S,
      });
    }

    // Initial burst of fire + smoke at the crash centre so the impact
    // reads instantly, before per-piece emission has time to build up.
    for (let i = 0; i < 18; i++) {
      const ox = (Math.random() - 0.5) * 5;
      const oy = (Math.random() - 0.5) * 4;
      const oz = (Math.random() - 0.5) * 5;
      emit(this.firePool, crashCenter.x + ox, crashCenter.y + oy, crashCenter.z + oz, 0.55, 2 + Math.random() * 4);
    }
    for (let i = 0; i < 14; i++) {
      const ox = (Math.random() - 0.5) * 6;
      const oy = (Math.random() - 0.5) * 3;
      const oz = (Math.random() - 0.5) * 6;
      emit(this.smokePool, crashCenter.x + ox, crashCenter.y + oy + 1, crashCenter.z + oz, 2.5, 1.5 + Math.random() * 1.5, 1.0);
    }

    // Explosion: bright additive shell. Layers on top of the particle
    // burst for the instant "flash" beat.
    const expMat = new T.MeshBasicMaterial({
      color: 0xffaa30, transparent: true, opacity: 0.95,
      depthWrite: false, blending: T.AdditiveBlending,
    });
    const expMesh = new T.Mesh(new T.SphereGeometry(1, 16, 12), expMat);
    expMesh.position.copy(crashCenter);
    expMesh.scale.set(0.5, 0.5, 0.5);
    this.scene.add(expMesh);
    this.explosion = { mesh: expMesh, age: 0 };
  }

  update(dt, terrain) {
    const T = this.THREE;
    // Pieces.
    for (const p of this.pieces) {
      p.age += dt;
      if (!p.grounded) {
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.velocity.y -= GRAVITY * dt;
        const qd = new T.Quaternion().setFromEuler(new T.Euler(
          p.angVel.x * dt, p.angVel.y * dt, p.angVel.z * dt,
        ));
        p.mesh.quaternion.multiplyQuaternions(qd, p.mesh.quaternion);
        const gy = terrain ? terrain.getHeight(p.mesh.position.x, p.mesh.position.z) : 0;
        if (p.mesh.position.y <= gy + 0.25) {
          p.mesh.position.y = gy + 0.25;
          p.velocity.set(0, 0, 0);
          p.angVel.set(0, 0, 0);
          p.grounded = true;
        }
      }
      // Continuous fire emission from the piece's current position. Fire
      // is short-lived (0.5s life) so the visible flame stays close to
      // the piece; smoke is longer (1.6s) and drifts up to form a trail.
      if (p.age < PIECE_FLAME_LIFE_S) {
        p.fireT -= dt;
        if (p.fireT <= 0) {
          p.fireT = FIRE_EMIT_INTERVAL_S;
          emit(this.firePool,
            p.mesh.position.x, p.mesh.position.y, p.mesh.position.z,
            0.5, 0.8 + Math.random() * 1.5);
        }
      }
      if (p.age < PIECE_SMOKE_LIFE_S) {
        p.smokeT -= dt;
        if (p.smokeT <= 0) {
          p.smokeT = SMOKE_EMIT_INTERVAL_S;
          emit(this.smokePool,
            p.mesh.position.x, p.mesh.position.y + 0.3, p.mesh.position.z,
            1.6, 1.6 + Math.random() * 1.2, 0.8);
        }
      }
    }
    // Drive both particle pools forward. Fire grows 1.8× over its life
    // (small puff → puff-out); smoke grows 2.5× as it dissipates.
    updatePool(this.firePool,  dt, 1.8);
    updatePool(this.smokePool, dt, 2.5);
    // Explosion shell: scale up + fade, dispose when done.
    if (this.explosion) {
      this.explosion.age += dt;
      const t = this.explosion.age / EXPLOSION_LIFETIME_S;
      if (t >= 1) {
        this.scene.remove(this.explosion.mesh);
        this.explosion.mesh.geometry.dispose();
        this.explosion.mesh.material.dispose();
        this.explosion = null;
      } else {
        const scale = 0.5 + t * (EXPLOSION_MAX_SCALE - 0.5);
        this.explosion.mesh.scale.set(scale, scale, scale);
        this.explosion.mesh.material.opacity = 0.95 * (1 - t);
      }
    }
  }

  // Tear down the per-crash bits — pieces and the explosion shell. The
  // particle pools live on (with visible=false slots) so they're ready
  // for the next crash without re-uploading the canvas texture.
  dispose() {
    for (const p of this.pieces) {
      this.scene.remove(p.mesh);
      p.mesh.traverse((n) => {
        if (n.isMesh || n.isSprite) {
          n.geometry && n.geometry.dispose && n.geometry.dispose();
          if (n.material) {
            if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
            else n.material.dispose();
          }
        }
      });
    }
    this.pieces = [];
    if (this.explosion) {
      this.scene.remove(this.explosion.mesh);
      this.explosion.mesh.geometry.dispose();
      this.explosion.mesh.material.dispose();
      this.explosion = null;
    }
    // Force every pool slot back to invisible so a fresh crash starts
    // from a clean field instead of inheriting in-flight particles.
    for (const s of this.firePool)  { s.sprite.visible = false; s.life = 0; }
    for (const s of this.smokePool) { s.sprite.visible = false; s.life = 0; }
  }
}

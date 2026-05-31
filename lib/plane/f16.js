// F-16C Fighting Falcon — single-engine 4th-gen fighter ("Viper").
// Signature features: belly "shark mouth" intake under the cockpit, a
// huge one-piece bubble canopy with no centre frame, cropped-delta wings
// blended into the fuselage via LERX (Leading Edge Root eXtensions),
// single tall vertical tail, twin ventral fins under the exhaust.

const GREY    = 0x9aa0a8;   // air-superiority light grey body
const DARK    = 0x6b6f76;   // wing/stab upper surfaces, intake
const INTAKE  = 0x2a2c30;
const STEEL   = 0x40434a;
const EXH     = 0x111111;
const CANOPY  = 0x445058;   // flat grey canopy per reference
const WHITE   = 0xf2f2f2;
const BLUE    = 0x1c3a78;

// USAF star-and-bar style insignia (round disc with white star).
function makeStarBar(THREE, diameter) {
  const g = new THREE.Group();
  const r = diameter * 0.5;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24),
    new THREE.MeshPhongMaterial({ color: BLUE, flatShading: true, shininess: 0 }),
  );
  g.add(disc);
  const starShape = new THREE.Shape();
  const points = 5;
  const outer = r * 0.62, inner = outer * 0.40;
  for (let i = 0; i < points * 2; i++) {
    const ang = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? outer : inner;
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    if (i === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
  }
  const star = new THREE.Mesh(
    new THREE.ShapeGeometry(starShape),
    new THREE.MeshPhongMaterial({ color: WHITE, flatShading: true, shininess: 0 }),
  );
  star.position.z = 0.001;
  g.add(star);
  return g;
}

export function buildF16(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // --- Fuselage (side-profile extrude) ----------------------------------
  // Shape in X (length, +X forward) / Y (vertical). After Ry(-π/2), the
  // shape's +X maps to world -Z (nose-forward).
  const body = new THREE.Shape();
  body.moveTo( 4.9,  0.00);   // nose tip
  body.lineTo( 4.6,  0.18);   // top of radome
  body.lineTo( 2.6,  0.55);   // spine lift ahead of cockpit
  body.lineTo( 1.8,  0.78);   // canopy spine peak
  body.lineTo( 0.4,  0.70);   // top of spine behind canopy
  body.lineTo(-1.8,  0.62);   // dorsal spine to tail
  body.lineTo(-3.8,  0.40);   // start of fin root
  body.lineTo(-4.6,  0.30);   // tail base top
  body.lineTo(-4.6, -0.40);   // tail base bottom (exhaust)
  body.lineTo(-3.8, -0.45);
  body.lineTo(-1.5, -0.55);
  body.lineTo( 1.0, -0.62);   // belly under canopy
  body.lineTo( 2.6, -0.50);
  body.lineTo( 3.8, -0.32);
  body.lineTo( 4.6, -0.15);
  body.lineTo( 4.9,  0.00);
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: 0.86, bevelEnabled: false });
  bodyGeo.translate(0, 0, -0.43);
  const bodyMesh = new THREE.Mesh(bodyGeo, mat(GREY));
  bodyMesh.rotation.y = -Math.PI / 2;
  g.add(bodyMesh);

  // Pointed radome cone forward of the body tip.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 12), mat(GREY));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -5.30;
  g.add(nose);
  // Thin pitot probe.
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), mat(STEEL));
  probe.rotation.x = -Math.PI / 2;
  probe.position.z = -6.00;
  g.add(probe);

  // --- LERX (leading edge root extensions) ------------------------------
  // Flat chines forward of the wing root, tapering to a point near the
  // cockpit side. Shape axes: X = spanwise (outboard), Y = forward chord.
  // After Rx(-π/2): shape X → world X, shape +Y → world -Z (forward).
  const lerxShape = new THREE.Shape();
  lerxShape.moveTo( 0.0,  1.8);    // inboard rear (root, joins wing leading edge)
  lerxShape.lineTo( 1.0,  1.8);    // outboard rear (full LERX width at wing root)
  lerxShape.lineTo( 0.15, 3.6);    // forward apex tapers in toward cockpit side
  lerxShape.lineTo( 0.0,  1.8);
  const lerxGeo = new THREE.ExtrudeGeometry(lerxShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const l = new THREE.Mesh(lerxGeo, mat(GREY));
    l.scale.x = side;             // mirror SPANWISE
    l.rotation.x = -Math.PI / 2;
    l.position.set(0, 0.05, 0.0);
    g.add(l);
  }

  // --- Belly intake ("shark mouth") -------------------------------------
  const intakeBody = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.65, 2.0), mat(GREY));
  intakeBody.position.set(0, -0.78, -1.4);
  g.add(intakeBody);
  // Rounded oval intake mouth.
  const intakeMouth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 16), mat(INTAKE));
  intakeMouth.scale.set(1.15, 1.0, 0.7);
  intakeMouth.rotation.x = Math.PI / 2;
  intakeMouth.position.set(0, -0.78, -2.50);
  g.add(intakeMouth);
  const intakeLip = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24), mat(GREY));
  intakeLip.scale.set(1.15, 1.0, 1.0);
  intakeLip.position.set(0, -0.78, -2.45);
  g.add(intakeLip);

  // --- Cropped delta wings ----------------------------------------------
  // Shape axes: X = spanwise (outboard from root), Y = forward chord.
  // After Rx(-π/2): shape X → world X (spanwise), shape +Y → world -Z (fwd).
  const wingShape = new THREE.Shape();
  wingShape.moveTo( 0.0,  1.8);     // root leading edge (fwd)
  wingShape.lineTo( 4.6, -0.6);     // tip leading edge (out + back)
  wingShape.lineTo( 4.6, -1.4);     // cropped flat tip trailing
  wingShape.lineTo( 0.0, -2.2);     // root trailing edge
  wingShape.lineTo( 0.0,  1.8);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.16, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(GREY));
    w.scale.x = side;
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, -0.05, 0);
    g.add(w);
  }

  // USAF star-and-bar insignia: wing top L+R, wing bottom L+R.
  // Wing extrude lays at Y ∈ [-0.05, +0.11]. Place stars just clear of
  // each surface so they're visible from above / below respectively.
  for (const side of [-1, 1]) {
    const top = makeStarBar(THREE, 0.65);
    top.rotation.x = -Math.PI / 2;
    top.position.set(side * 2.4, 0.13, 0.5);
    g.add(top);
    const bot = makeStarBar(THREE, 0.65);
    bot.rotation.x = Math.PI / 2;
    bot.position.set(side * 2.4, -0.07, 0.5);
    g.add(bot);
  }

  // --- One-piece bubble canopy ------------------------------------------
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(CANOPY),
  );
  canopy.position.set(0, 0.62, -2.0);
  canopy.scale.set(0.78, 0.95, 2.4);
  g.add(canopy);
  // Cockpit sill (dark rail under the bubble).
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 2.6), mat(0x2a2c30));
  sill.position.set(0, 0.50, -2.0);
  g.add(sill);

  // --- Single vertical tail (swept tapered fin) -------------------------
  const finShape = new THREE.Shape();
  finShape.moveTo( 1.6, 0.0);   // leading edge bottom (forward)
  finShape.lineTo( 0.6, 1.9);   // top forward
  finShape.lineTo(-0.4, 1.9);   // top trailing
  finShape.lineTo(-1.4, 0.0);   // bottom trailing
  finShape.lineTo( 1.6, 0.0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  finGeo.translate(0, 0, -0.05);
  const fin = new THREE.Mesh(finGeo, mat(GREY));
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0, 0.55, 3.2);
  g.add(fin);

  // --- Twin ventral fins under the tail ---------------------------------
  const ventShape = new THREE.Shape();
  ventShape.moveTo( 0.7,  0.0);
  ventShape.lineTo( 0.2, -0.55);
  ventShape.lineTo(-0.4, -0.55);
  ventShape.lineTo(-0.7,  0.0);
  ventShape.lineTo( 0.7,  0.0);
  const ventGeo = new THREE.ExtrudeGeometry(ventShape, { depth: 0.06, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const v = new THREE.Mesh(ventGeo, mat(DARK));
    v.rotation.y = -Math.PI / 2;
    v.position.set(side * 0.55, -0.55, 3.0);
    v.rotation.z = side * 0.35;
    g.add(v);
  }

  // --- Horizontal stabilators (all-moving tailplanes) -------------------
  // Same axes as the wing: X = spanwise, Y = forward chord.
  const stabShape = new THREE.Shape();
  stabShape.moveTo( 0.0,  0.8);     // root leading
  stabShape.lineTo( 2.1,  0.4);     // tip leading (out + back)
  stabShape.lineTo( 2.1, -0.4);     // tip trailing
  stabShape.lineTo( 0.0, -1.0);     // root trailing
  stabShape.lineTo( 0.0,  0.8);
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(DARK));
    s.scale.x = side;
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.05, 3.4);
    g.add(s);
  }

  // --- Single exhaust nozzle --------------------------------------------
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.42, 0.55, 14), mat(STEEL));
  ex.rotation.x = Math.PI / 2;
  ex.position.set(0, -0.05, 4.55);
  g.add(ex);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.25, 14), mat(0x222428));
  inner.rotation.x = Math.PI / 2;
  inner.position.set(0, -0.05, 4.78);
  g.add(inner);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 14), mat(EXH));
  hole.rotation.y = Math.PI;
  hole.position.set(0, -0.05, 4.91);
  g.add(hole);

  return g;
}

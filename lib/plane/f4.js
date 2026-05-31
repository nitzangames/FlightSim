// Faceted lowpoly F-4 Phantom II — twin-engine interceptor / fighter-bomber.
// Signature features: long pointed RED radar nose (radome), light-blue
// tandem canopy, twin side intakes, two-piece wings (flat inner panel +
// dihedral-up outer panel at the mid-span kink), trapezoidal vertical tail
// with swept leading edge, twin nozzles, anhedral horizontal stabs.
//
// Bare-metal silver livery with US star-and-bar insignia.

const SILVER   = 0xc6cbd4;   // bare aluminum body + wings + tail
const RED_NOSE = 0xb21a1a;   // radome
const CANOPY   = 0x6ab4d8;   // light-blue glass
const DARK     = 0x2a2a2a;   // intake interior
const STEEL    = 0x46474d;   // exhaust nozzle ring
const EXH      = 0x111111;   // dark exhaust hole

const US_BLUE  = 0x1a3a7a;
const US_WHITE = 0xeaeaea;
const US_RED   = 0xb21a1a;

// US star-and-bar (post-1947 style). Stacked planar pieces with small Y
// offsets to avoid z-fighting. Returned group lies in the XZ plane (facing
// +Y) by default; rotate it on the caller side to place on wing top/bottom
// or fuselage sides. Duplicated from lib/plane/p51.js per design decision
// to keep each plane module self-contained.
function makeStarBar(THREE, diameter) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  const r = diameter / 2;

  // 1) Blue disc.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat(US_BLUE));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.000;
  g.add(disc);

  // 2) White 5-point star, point upward.
  const starShape = new THREE.Shape();
  const outer = r * 0.85;
  const inner = r * 0.34;
  for (let i = 0; i < 10; i++) {
    const radius = (i % 2 === 0) ? outer : inner;
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, z);
    else         starShape.lineTo(x, z);
  }
  starShape.closePath();
  const starGeo = new THREE.ShapeGeometry(starShape);
  const star = new THREE.Mesh(starGeo, mat(US_WHITE));
  star.rotation.x = -Math.PI / 2;
  star.position.y = 0.002;
  g.add(star);

  // 3) White bars on each side; pull inner edges 10% inside the disc.
  const barLen = diameter;
  const barH   = r * 0.66;
  const barOffset = r * 0.90 + barLen / 2;
  for (const sx of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(barLen, barH), mat(US_WHITE));
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(sx * barOffset, 0.002, 0);
    g.add(bar);
  }

  // 4) Red stripe through both bars (two segments to skip the disc).
  const stripeH = barH * 0.33;
  for (const sx of [-1, 1]) {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(barLen, stripeH), mat(US_RED));
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(sx * barOffset, 0.004, 0);
    g.add(seg);
  }

  return g;
}

export function buildF4(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Fuselage — ExtrudeGeometry of a 2D side profile (shape X = length along
  // world Z, shape Y = height along world Y), extruded along the engine-bay
  // width. Subtle belly bulge in the mid-section suggests the twin-engine
  // housing without breaking the lowpoly silhouette.
  //
  // Walk counter-clockwise: forward-top tip → along the top edge to the
  // tail → down at the tail end → along the bottom edge back to the
  // forward-bottom tip → close.
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-4.75,  0.10);   // forward top tip
  bodyShape.lineTo(-3.50,  0.40);   // top rises
  bodyShape.lineTo(-1.00,  0.55);   // top peaks at canopy/engine area
  bodyShape.lineTo( 1.00,  0.55);
  bodyShape.lineTo( 2.50,  0.40);   // top descends toward tail
  bodyShape.lineTo( 4.75,  0.20);   // top trailing edge
  bodyShape.lineTo( 4.75, -0.20);   // tail end (vertical)
  bodyShape.lineTo( 2.50, -0.55);   // bottom rises (engine bulge ends)
  bodyShape.lineTo( 1.00, -0.65);   // engine belly low
  bodyShape.lineTo(-1.00, -0.65);
  bodyShape.lineTo(-3.50, -0.35);   // bottom rises toward nose
  bodyShape.lineTo(-4.75, -0.10);   // forward bottom tip
  // ExtrudeGeometry implicitly closes via the forward edge.
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.4, bevelEnabled: false });
  const body = new THREE.Mesh(bodyGeo, mat(SILVER));
  // rotation.y = -π/2 maps shape +X → world +Z (aft), and extrude (local +Z)
  // → world -X. With depth 1.4, the body spans world X ∈ [-1.4 + position.x,
  // position.x]; setting position.x = +0.70 centers it on world X = 0.
  body.rotation.y = -Math.PI / 2;
  body.position.x = 0.70;
  g.add(body);

  // Nose cone — RED radome. Long pointed cone, base embedded ~0.50 into
  // the body so the red extends into the body silhouette (matching how
  // the F-4B radome carries back past the body's narrow forward tip).
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 10), mat(RED_NOSE));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -5.55;
  g.add(nose);

  // Twin engine nacelles — LONG side pods that run from the intake mouth
  // all the way to the rear, where the exhaust nozzles poke out the back.
  // Narrower than my previous pass (0.70 vs 0.85) so they don't dominate
  // the front view but still read as integrated engine housings.
  const intakeGeo = new THREE.BoxGeometry(0.70, 0.85, 7.20);
  for (const sx of [-0.95, 0.95]) {
    const intake = new THREE.Mesh(intakeGeo, mat(SILVER));
    intake.position.set(sx, -0.20, 1.20);
    g.add(intake);
  }
  // Inner intake faces — dark planes slightly inside the front of each
  // nacelle, facing forward to read as the open intake mouth.
  for (const sx of [-0.95, 0.95]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.50, 0.65), mat(DARK));
    face.rotation.y = Math.PI;
    face.position.set(sx, -0.20, -2.35);
    g.add(face);
  }

  // Wing root.
  const wingRoot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 2.6), mat(SILVER));
  wingRoot.position.set(0, -0.20, -1.2);
  g.add(wingRoot);

  // Two-piece wings — flat inner panel + dihedral-up outer panel, both silver.
  // The two ExtrudeGeometry shapes share the mid-span chord positions so the
  // seam reads as a clean fold. CCW vertex order keeps normals outward-facing.
  const sweep = -32 * Math.PI / 180;     // shared with horizontal stabs
  const KINK  = 1.9;                     // mid-span X where the panels meet
  const innerShape = new THREE.Shape();
  innerShape.moveTo(0.0,    1.0);
  innerShape.lineTo(0.0,   -1.3);
  innerShape.lineTo(KINK,  -1.85);
  innerShape.lineTo(KINK,  -0.30);
  innerShape.lineTo(0.0,    1.0);
  const innerGeo = new THREE.ExtrudeGeometry(innerShape, { depth: 0.18, bevelEnabled: false });
  // Outer panel: span extended from 1.9 to 3.0 (~24% wingspan increase)
  // with the LE and TE sweep rates preserved from the inner panel for a
  // continuous swept silhouette. Tip chord narrows to ~0.45 (was 0.80).
  const outerShape = new THREE.Shape();
  outerShape.moveTo(0.0,  -0.30);
  outerShape.lineTo(0.0,  -1.85);
  outerShape.lineTo(3.0,  -2.71);
  outerShape.lineTo(3.0,  -2.26);
  outerShape.lineTo(0.0,  -0.30);
  const outerGeo = new THREE.ExtrudeGeometry(outerShape, { depth: 0.18, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const inner = new THREE.Mesh(innerGeo, mat(SILVER));
    inner.scale.x = side;
    inner.position.set(side * 0.75, -0.27, -1.05);
    inner.rotation.x = -Math.PI / 2;
    g.add(inner);
    // Outer panel: rotation.order='ZYX' applies Rx FIRST (orienting the
    // shape flat) then Rz (dihedral around the chord axis); the default
    // 'XYZ' order would smear Rz into the un-oriented shape and split the
    // outer panel away from the kink.
    const outer = new THREE.Mesh(outerGeo, mat(SILVER));
    outer.scale.x = side;
    outer.position.set(side * (0.75 + KINK), -0.27, -1.05);
    outer.rotation.order = 'ZYX';
    outer.rotation.x = -Math.PI / 2;
    outer.rotation.z = side * 0.21;       // ~12° dihedral up-kink (subtle tip lift)
    g.add(outer);
  }

  // Long tandem canopy.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.50, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.60, -1.5);
  canopy.scale.set(0.85, 1.0, 3.0);
  g.add(canopy);

  // Tall vertical tail — trapezoidal with swept-back leading edge. Shape in
  // (chord, height) coords; rotation.y = -π/2 maps shape-X to world Z so
  // the fin stands upright in the YZ plane with extrude depth in world X.
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.6, 0.0);
  finShape.lineTo( 0.9, 0.0);
  finShape.lineTo( 0.9, 1.7);
  finShape.lineTo( 0.3, 1.7);
  finShape.lineTo(-0.6, 0.0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: false });
  const fin = new THREE.Mesh(finGeo, mat(SILVER));
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0.07, 0.10, 3.3);
  g.add(fin);

  // Anhedral horizontal stabs — tips droop DOWNWARD, signature F-4 trait.
  // rotation.z = -side*0.18: for side=+1 (right stab, outboard +X) the
  // negative rotation tilts the +X tip toward -Y; for side=-1 (left stab,
  // outboard -X) the positive rotation tilts the -X tip toward -Y. Both
  // tips end up below the inboard root.
  const stabGeo = new THREE.BoxGeometry(2.6, 0.15, 1.1);
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(SILVER));
    s.position.set(side * 1.4, -0.1, 3.6);
    s.rotation.y = side * sweep * 0.6;
    s.rotation.z = -side * 0.18;
    g.add(s);
  }

  // Twin exhaust nozzles — emerge from the back of each engine nacelle.
  // Aligned with nacelle X position (±0.95) and Y (-0.20). Nozzle radius
  // 0.32 fits inside the nacelle half-width 0.35.
  for (const sx of [-0.95, 0.95]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.55, 10), mat(STEEL));
    ex.rotation.x = Math.PI / 2;
    ex.position.set(sx, -0.20, 4.95);
    g.add(ex);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(sx, -0.20, 5.25);
    g.add(hole);
  }

  // US star-and-bar insignia.
  // Wing top + bottom at ±1.6 along the span (mid-inner panel). The inner
  // wing panel extrudes from local y=0 to y=0.18 along its own Y, which
  // maps to world +Y after the -π/2 X rotation; with inner.position.y=-0.27
  // the inner panel occupies world y ∈ [-0.27, -0.09]. Top = -0.09,
  // bottom = -0.27.
  for (const sx of [-1.6, 1.6]) {
    const ins = makeStarBar(THREE, 0.6);
    ins.position.set(sx, -0.07, -1.05);
    g.add(ins);
  }
  for (const sx of [-1.6, 1.6]) {
    const ins = makeStarBar(THREE, 0.6);
    ins.rotation.z = Math.PI;          // flip so the star faces down
    ins.position.set(sx, -0.29, -1.05);
    g.add(ins);
  }
  // Fuselage sides at z=2.0 (aft of cockpit, forward of tail). Body width
  // at that station is ±0.70 (constant — extrude depth half). Place insignia
  // proud at ±0.71 with nested-Group rotation to keep bars horizontal.
  for (const side of [-1, 1]) {
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    const ins = makeStarBar(THREE, 0.5);
    inner.add(ins);
    inner.rotation.y = -side * Math.PI / 2;
    outer.add(inner);
    outer.rotation.z = -side * Math.PI / 2;
    outer.position.set(side * 0.71, 0.05, 2.0);
    g.add(outer);
  }

  return g;
}

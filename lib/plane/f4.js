// Faceted lowpoly F-4 Phantom II — Vietnam-era twin-engine heavy fighter.
// Signature features: long pointed radar nose, two-seat tandem canopy, twin
// side intakes, two-piece wings (flat inner panel + dihedral-up outer panel
// at the mid-span kink), trapezoidal vertical tail with swept leading edge,
// twin nozzles, anhedral horizontal stabs.
//
// Stylised three-tone Vietnam livery: A-10 olive green for the fuselage and
// outer wings, earthy brown for the nose / inner wings / tail, dark grey
// under the intakes.

const GREEN    = 0x4a5040;   // (deprecated — Task 3 removes remaining uses)
const BROWN    = 0x6b5538;   // (deprecated — Task 3 removes remaining uses)
const SILVER   = 0xc6cbd4;   // bare aluminum body + wings + tail
const RED_NOSE = 0xb21a1a;   // radome
const CANOPY   = 0x6ab4d8;   // light-blue glass
const DARK     = 0x2a2a2a;   // intake interior
const STEEL    = 0x46474d;   // exhaust nozzle ring
const EXH      = 0x111111;   // dark exhaust hole

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

  // Nose cone — RED radome. Long pointed cone at the front of the body.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 10), mat(RED_NOSE));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -5.95;
  g.add(nose);

  // Twin side intakes.
  const intakeGeo = new THREE.BoxGeometry(0.55, 0.7, 1.6);
  for (const sx of [-0.85, 0.85]) {
    const intake = new THREE.Mesh(intakeGeo, mat(DARK));
    intake.position.set(sx, -0.2, -1.0);
    g.add(intake);
  }

  // Wing root.
  const wingRoot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 2.6), mat(GREEN));
  wingRoot.position.set(0, -0.20, -1.2);
  g.add(wingRoot);

  // Two-piece wings — flat brown inner panel + dihedral-up green outer panel.
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
  const outerShape = new THREE.Shape();
  outerShape.moveTo(0.0,  -0.30);
  outerShape.lineTo(0.0,  -1.85);
  outerShape.lineTo(1.9,  -2.40);
  outerShape.lineTo(1.9,  -1.60);
  outerShape.lineTo(0.0,  -0.30);
  const outerGeo = new THREE.ExtrudeGeometry(outerShape, { depth: 0.18, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const inner = new THREE.Mesh(innerGeo, mat(BROWN));
    inner.scale.x = side;
    inner.position.set(side * 0.75, -0.27, -1.05);
    inner.rotation.x = -Math.PI / 2;
    g.add(inner);
    // Outer panel: rotation.order='ZYX' applies Rx FIRST (orienting the
    // shape flat) then Rz (dihedral around the chord axis); the default
    // 'XYZ' order would smear Rz into the un-oriented shape and split the
    // outer panel away from the kink.
    const outer = new THREE.Mesh(outerGeo, mat(GREEN));
    outer.scale.x = side;
    outer.position.set(side * (0.75 + KINK), -0.27, -1.05);
    outer.rotation.order = 'ZYX';
    outer.rotation.x = -Math.PI / 2;
    outer.rotation.z = side * 0.40;       // ~23° dihedral up-kink
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
  const fin = new THREE.Mesh(finGeo, mat(BROWN));
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0.07, 0.10, 3.3);
  g.add(fin);

  // Anhedral horizontal stabs.
  const stabGeo = new THREE.BoxGeometry(2.6, 0.15, 1.1);
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(BROWN));
    s.position.set(side * 1.4, -0.1, 3.6);
    s.rotation.y = side * sweep * 0.6;
    s.rotation.z = side * 0.18;
    g.add(s);
  }

  // Twin exhaust nozzles.
  for (const sx of [-0.42, 0.42]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.55, 10), mat(STEEL));
    ex.rotation.x = Math.PI / 2;
    ex.position.set(sx, -0.05, 5.05);
    g.add(ex);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(sx, -0.05, 5.35);
    g.add(hole);
  }

  return g;
}

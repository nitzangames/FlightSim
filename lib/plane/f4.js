// Faceted lowpoly F-4E Phantom II — Israeli Air Force (IDF/AF) livery,
// Yom Kippur War period. Three-tone IDF camouflage approximated by
// alternating per-mesh coloring between olive green and earthy brown
// (no texture — just bare material colors). Black radome nose, dark
// tandem canopy, twin engine nacelles that stop before the stabilizers,
// Star of David markings on the wings.

const GREEN     = 0x4a5040;   // olive
const BROWN     = 0x6b5538;   // earthy brown
const DARK_NOSE = 0x1a1a1a;   // black radome
const CANOPY    = 0x2a3340;   // dark tandem canopy glass
const DARK      = 0x2a2a2a;   // intake interior
const STEEL     = 0x46474d;   // exhaust nozzle ring
const EXH       = 0x111111;   // dark exhaust hole

const IDF_BLUE  = 0x0038b8;   // Israeli flag blue
const IDF_WHITE = 0xeaeaea;

// Star of David — blue hexagram inside a white disc. 12 vertices alternate
// between outer (hexagram tips) and inner (where the two equilateral
// triangles cross). Inner radius = outer * √3/3 ≈ 0.577 for proper
// hexagram proportions. Returned group lies in the XZ plane (facing +Y)
// by default; rotate it on the caller side to place on wing top/bottom.
function makeStarOfDavid(THREE, diameter) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  const r = diameter / 2;

  // White disc background.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat(IDF_WHITE));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.000;
  g.add(disc);

  // Blue hexagram on top.
  const starShape = new THREE.Shape();
  const outer = r * 0.85;
  const inner = outer * Math.sqrt(3) / 3;
  for (let i = 0; i < 12; i++) {
    const radius = (i % 2 === 0) ? outer : inner;
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, z);
    else         starShape.lineTo(x, z);
  }
  starShape.closePath();
  const starGeo = new THREE.ShapeGeometry(starShape);
  const star = new THREE.Mesh(starGeo, mat(IDF_BLUE));
  star.rotation.x = -Math.PI / 2;
  star.position.y = 0.002;
  g.add(star);

  return g;
}

export function buildF4(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Fuselage — three-piece "Mustang-style" body: front frustum tapers from
  // the radome connection (radius 0.55) to the engine-bay cylinder (radius
  // 0.70), straight cylinder for the middle, pointed back cone for the
  // tail. openEnded: true on all three pieces so the coincident cap faces
  // at the joins don't z-fight.

  // Front frustum: forward radius 0.55 matches the radome base; aft radius
  // 0.70 matches the cylinder. Spans world Z from -4.25 to -2.00.
  const frontFrustum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.70, 2.25, 14, 1, true), mat(GREEN),
  );
  frontFrustum.rotation.x = -Math.PI / 2;
  frontFrustum.position.z = -3.125;
  g.add(frontFrustum);

  // Engine-bay cylinder: radius 0.70, spans world Z from -2.00 to +2.50.
  const bodyCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.70, 0.70, 4.50, 14, 1, true), mat(GREEN),
  );
  bodyCylinder.rotation.x = Math.PI / 2;
  bodyCylinder.position.z = 0.25;
  g.add(bodyCylinder);

  // Back cone: base radius 0.70 matches the cylinder at z=2.50, tip at
  // world z=5.75 forms the pointy tail.
  const backCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.70, 3.25, 14, 1, true), mat(GREEN),
  );
  backCone.rotation.x = Math.PI / 2;
  backCone.position.z = 4.125;
  g.add(backCone);

  // Nose cone — black radome. Long pointed cone, base embedded ~0.50 into
  // the body so the dark nose extends into the body silhouette.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 10), mat(DARK_NOSE));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -5.55;
  g.add(nose);

  // Twin engine nacelles — side pods flanking the fuselage. Run from the
  // intake mouth at z=-2.40 back to z=1.60 (shorter than before, so the
  // pods don't crowd the tail). Exhaust nozzles exit from the back of
  // each pod just past z=1.60.
  const intakeGeo = new THREE.BoxGeometry(0.70, 0.85, 4.00);
  for (const sx of [-0.95, 0.95]) {
    const intake = new THREE.Mesh(intakeGeo, mat(BROWN));
    intake.position.set(sx, -0.20, -0.40);
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

  // Star of David insignia on the OUTER sides of the side pods, just
  // forward of the wing leading edge. Pod outer side at world X=±1.30
  // (pod center ±0.95 + half-width 0.35). Wing LE at z≈-2.05, so place
  // insignia at z=-1.85 (just forward of the wing).
  for (const side of [-1, 1]) {
    const ins = makeStarOfDavid(THREE, 0.40);
    ins.rotation.z = -side * Math.PI / 2;
    ins.position.set(side * 1.305, -0.20, -1.85);
    g.add(ins);
  }

  // Wing root.
  const wingRoot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 2.6), mat(BROWN));
  wingRoot.position.set(0, -0.20, -1.2);
  g.add(wingRoot);

  // Two-piece wings — flat inner panel + dihedral-up outer panel.
  // The two ExtrudeGeometry shapes share the mid-span chord positions so the
  // seam reads as a clean fold. CCW vertex order keeps normals outward-facing.
  // Alternating green/brown for the IDF three-tone camo approximation.
  const sweep = -32 * Math.PI / 180;     // shared with horizontal stabs
  const KINK  = 1.9;                     // mid-span X where the panels meet
  const innerShape = new THREE.Shape();
  innerShape.moveTo(0.0,    1.0);
  innerShape.lineTo(0.0,   -1.3);
  innerShape.lineTo(KINK,  -1.85);
  innerShape.lineTo(KINK,  -0.30);
  innerShape.lineTo(0.0,    1.0);
  const innerGeo = new THREE.ExtrudeGeometry(innerShape, { depth: 0.18, bevelEnabled: false });
  // Wider outer panel (span 3.0 → 3.6, ~+10% wingspan) with tip Y values
  // adjusted to maintain a small but visible tip chord (~0.45 unchanged).
  const outerShape = new THREE.Shape();
  outerShape.moveTo(0.0,  -0.30);
  outerShape.lineTo(0.0,  -1.85);
  outerShape.lineTo(3.6,  -2.85);
  outerShape.lineTo(3.6,  -2.40);
  outerShape.lineTo(0.0,  -0.30);
  const outerGeo = new THREE.ExtrudeGeometry(outerShape, { depth: 0.18, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const inner = new THREE.Mesh(innerGeo, mat(GREEN));
    inner.scale.x = side;
    inner.position.set(side * 0.75, -0.50, -1.05);
    inner.rotation.x = -Math.PI / 2;
    g.add(inner);
    // Outer panel: rotation.order='ZYX' applies Rx FIRST (orienting the
    // shape flat) then Rz (dihedral around the chord axis); the default
    // 'XYZ' order would smear Rz into the un-oriented shape and split the
    // outer panel away from the kink.
    const outer = new THREE.Mesh(outerGeo, mat(BROWN));
    outer.scale.x = side;
    outer.position.set(side * (0.75 + KINK), -0.50, -1.05);
    outer.rotation.order = 'ZYX';
    outer.rotation.x = -Math.PI / 2;
    outer.rotation.z = side * 0.21;       // ~12° dihedral up-kink (subtle tip lift)
    g.add(outer);

    // Star of David insignia parented to the outer wing so they inherit
    // the sweep + dihedral. Local frame is the OUTER PANEL's pre-rotation
    // shape coords: +X spanwise toward tip, +Y forward, +Z extrude (wing
    // thickness 0→0.18). Placed at local x=2.0 (mid-outer-span, near the
    // wingtip), y=-2.0 (toward the trailing edge — chord at x=2.0 spans
    // y ∈ [-2.41, -1.47]). ins.rotation.x = ±π/2 re-orients the helper's
    // Y-stacking direction along the wing's local Z so the disc ends up
    // flat against the wing surface after the wing's own rotations.
    const insTop = makeStarOfDavid(THREE, 0.7);
    insTop.rotation.x = Math.PI / 2;
    insTop.position.set(2.0, -2.0, 0.185);
    outer.add(insTop);
    const insBot = makeStarOfDavid(THREE, 0.7);
    insBot.rotation.x = -Math.PI / 2;
    insBot.position.set(2.0, -2.0, -0.005);
    outer.add(insBot);
  }

  // Long tandem canopy.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.50, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.55, -1.5);    // recess into the cylinder (radius 0.70) so the front doesn't float
  canopy.scale.set(0.85, 1.0, 3.0);
  g.add(canopy);

  // Tall vertical tail — trapezoidal with swept-back leading edge.
  // Fin shape in (chord, height): shape +X maps to world +Z (aft) after
  // rotation.y = -π/2. Base extends from world Z=1.8 to Z=4.2 — a long
  // chord with a sharply swept leading edge sweeping forward-down into
  // the body, characteristic of the F-4 fin.
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.5, 0.0);   // base forward (long leading edge sweeping into body)
  finShape.lineTo( 0.9, 0.0);   // base aft
  finShape.lineTo( 0.9, 1.7);   // top aft (vertical trailing edge)
  finShape.lineTo( 0.3, 1.7);   // top forward
  finShape.lineTo(-1.5, 0.0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: false });
  const fin = new THREE.Mesh(finGeo, mat(GREEN));
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0.07, 0.10, 3.3);
  g.add(fin);

  // Anhedral horizontal stabs — tips droop DOWNWARD, signature F-4 trait.
  // Raised root (y=0.20) and steeper anhedral (~17°) so the tips clearly
  // dip below the body line.
  const stabGeo = new THREE.BoxGeometry(2.6, 0.15, 1.1);
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(BROWN));
    s.position.set(side * 1.4, -0.10, 3.6);
    s.rotation.y = side * sweep * 0.6;
    s.rotation.z = -side * 0.30;
    g.add(s);
  }

  // Twin exhaust nozzles — emerge from the BACK of each (now shorter)
  // engine nacelle. Nacelle back face at Z=1.60; nozzle center at 1.85
  // puts the ring just behind the pod opening.
  for (const sx of [-0.95, 0.95]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.55, 10), mat(STEEL));
    ex.rotation.x = Math.PI / 2;
    ex.position.set(sx, -0.32, 1.85);
    g.add(ex);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(sx, -0.32, 2.13);
    g.add(hole);
    // Engine plume anchor (per pod) — tied to the exhaust-hole mesh.
    if (!g.userData.nozzles) g.userData.nozzles = [];
    g.userData.nozzles.push({ x: hole.position.x, y: hole.position.y, z: hole.position.z });
  }

  return g;
}

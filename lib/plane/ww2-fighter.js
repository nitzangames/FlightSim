// Faceted lowpoly WW2 fighter (Supermarine Spitfire). Elliptical wings,
// teardrop fuselage that bulges under the cockpit and tapers to a thin tail,
// swept triangular tail surfaces, RAF roundels on wings and fuselage sides.

const OLIVE = 0x49572b;
const STEEL = 0x46454a;
const PROP_BROWN = 0x2a1f12;

const RAF_BLUE  = 0x1a3a7a;
const RAF_WHITE = 0xeaeaea;
const RAF_RED   = 0xb21a1a;

// RAF Type-A roundel: 3 concentric circles, slight Y offset to avoid z-fighting.
function makeRoundel(THREE, diameter) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  const r = diameter / 2;
  const rings = [
    { color: RAF_BLUE,  radius: r,        y: 0.000 },
    { color: RAF_WHITE, radius: r * 0.66, y: 0.002 },
    { color: RAF_RED,   radius: r * 0.33, y: 0.004 },
  ];
  for (const { color, radius, y } of rings) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), mat(color));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    g.add(m);
  }
  return g;
}

export function buildWW2Fighter(THREE) {
  const g = new THREE.Group();
  const mat = (color) => new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 0 });

  // Fuselage — LatheGeometry profile gives the Spitfire silhouette: gentle
  // bulge under the cockpit, tapers smoothly to a thin tail. Profile points
  // are (radius, axial). After rotation.x = π/2, local +Y → world +Z, so
  // axial values map directly to world Z. Caps via x=0 endpoints.
  const fuseProfile = [
    new THREE.Vector2(0.00, -4.85),
    new THREE.Vector2(0.42, -4.80),
    new THREE.Vector2(0.55, -3.50),
    new THREE.Vector2(0.62, -1.50),
    new THREE.Vector2(0.58,  0.00),
    new THREE.Vector2(0.45,  1.50),
    new THREE.Vector2(0.28,  2.60),
    new THREE.Vector2(0.15,  3.60),
    new THREE.Vector2(0.00,  4.20),
  ];
  const bodyGeo = new THREE.LatheGeometry(fuseProfile, 14);
  const body = new THREE.Mesh(bodyGeo, mat(OLIVE));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Spinner — long pointed Spitfire-style cone.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 8), mat(STEEL));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -5.4;
  g.add(spinner);

  // Propeller
  const propGroup = new THREE.Group();
  propGroup.position.z = -6.0;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.10, 0.22), mat(PROP_BROWN));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Wings — full-span asymmetric ellipse, angle-parameterized so the tips
  // end on the ellipse's vertical tangents (rounded tips, not points).
  const SPAN = 11.0;
  const CHORD_LEAD  = 2.6 * 0.40;
  const CHORD_TRAIL = 2.6 * 0.60;
  const N_WING = 24;
  const wingShape = new THREE.Shape();
  for (let i = 0; i <= N_WING; i++) {
    const theta = (i / N_WING) * Math.PI * 2;
    const x = (SPAN / 2) * Math.cos(theta);
    const r = Math.sin(theta) >= 0 ? CHORD_LEAD : CHORD_TRAIL;
    const y = r * Math.sin(theta);
    if (i === 0) wingShape.moveTo(x, y);
    else         wingShape.lineTo(x, y);
  }
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.20, bevelEnabled: false });
  const wing = new THREE.Mesh(wingGeo, mat(OLIVE));
  wing.rotation.x = -Math.PI / 2;
  // Low-wing mount: wing root attaches at the underside of the fuselage.
  wing.position.set(0, -0.45, -1.3);
  g.add(wing);

  // Cockpit canopy — small teardrop bubble sitting on the fuselage top.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0x223344),
  );
  canopy.position.set(0, 0.55, 0.1);
  canopy.scale.set(1.0, 0.85, 2.2);
  g.add(canopy);

  // Horizontal stabilizer — tapered swept triangle per side.
  const stabShape = new THREE.Shape();
  stabShape.moveTo(0.00,  0.45);
  stabShape.lineTo(1.40,  0.10);
  stabShape.lineTo(1.40, -0.10);
  stabShape.lineTo(0.00, -0.40);
  stabShape.lineTo(0.00,  0.45);
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.08, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(OLIVE));
    s.scale.x = side;
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.05, 3.0);
    g.add(s);
  }

  // Vertical fin — leaf-shape, swept and tapered.
  const finShape = new THREE.Shape();
  finShape.moveTo( 0.50, 0.00);
  finShape.lineTo(-0.60, 0.00);
  finShape.lineTo(-0.30, 1.05);
  finShape.lineTo( 0.05, 1.05);
  finShape.lineTo( 0.50, 0.00);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false });
  const fin = new THREE.Mesh(finGeo, mat(OLIVE));
  fin.rotation.y = Math.PI / 2;
  fin.position.set(0, 0.10, 3.05);
  g.add(fin);

  // RAF roundels.
  // Wing extrudes y∈[-0.45, -0.25]; sit just above / below the surfaces.
  for (const sx of [-3.2, 3.2]) {
    const r = makeRoundel(THREE, 1.4);
    r.position.set(sx, -0.23, -1.3);
    g.add(r);
  }
  for (const sx of [-3.2, 3.2]) {
    const r = makeRoundel(THREE, 1.4);
    r.rotation.z = Math.PI;
    r.position.set(sx, -0.47, -1.3);
    g.add(r);
  }
  // Fuselage sides at z=1.0 (mid-aft). Interpolating profile (0.58,0.0)→
  // (0.45,1.5) gives radius ≈ 0.49 at z=1.0; place roundel snug.
  for (const side of [-1, 1]) {
    const r = makeRoundel(THREE, 0.55);
    r.rotation.z = -side * Math.PI / 2;
    r.position.set(side * 0.50, 0.0, 1.0);
    g.add(r);
  }

  return g;
}

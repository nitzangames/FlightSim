// Faceted lowpoly WW2 fighter (Spitfire-ish proportions): elliptical wings,
// teardrop fuselage, prop nose. ~11m wingspan, ~9m length.

const OLIVE = 0x49572b;
const OLIVE_DARK = 0x303a18;
const STEEL = 0x46454a;
const PROP_BROWN = 0x2a1f12;

const RAF_BLUE  = 0x1a3a7a;
const RAF_WHITE = 0xeaeaea;
const RAF_RED   = 0xb21a1a;

// RAF Type-A roundel: 3 concentric circles, slight Y offset to avoid z-fighting.
// Returns a THREE.Group lying in the XZ plane (normal = +Y). Position and
// rotate the returned group to place it on wing tops/bottoms/fuselage sides.
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

  // Fuselage — long, tapered
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.30, 8.0, 8), mat(OLIVE));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Engine nose
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.4, 8), mat(STEEL));
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -3.7;
  g.add(nose);

  // Spinner
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 8), mat(STEEL));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -4.6;
  g.add(spinner);

  // Propeller
  const propGroup = new THREE.Group();
  propGroup.position.z = -4.95;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.10, 0.22), mat(PROP_BROWN));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Spitfire elliptical wing — a single full-span ExtrudeGeometry. Built as
  // a faceted asymmetric ellipse: leading edge sweep slightly flatter than
  // trailing edge sweep, the iconic Spitfire planform. ~16 facets so the
  // edges still read lowpoly. Wing thickness goes UP (+Y) after rotation.
  const SPAN = 11.0;
  const CHORD = 2.6;
  const N = 16;
  const wingShape = new THREE.Shape();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (t - 0.5) * SPAN;
    const y = Math.sin(Math.PI * t) * (CHORD * 0.40);
    if (i === 0) wingShape.moveTo(x, y);
    else         wingShape.lineTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const x = (t - 0.5) * SPAN;
    const y = -Math.sin(Math.PI * t) * (CHORD * 0.60);
    wingShape.lineTo(x, y);
  }
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.20, bevelEnabled: false });
  const wing = new THREE.Mesh(wingGeo, mat(OLIVE));
  wing.rotation.x = -Math.PI / 2;
  wing.position.set(0, -0.30, -1.3);
  g.add(wing);

  // Cockpit canopy — bubble teardrop, sits behind the wing trailing edge.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0x223344),
  );
  canopy.position.set(0, 0.45, 0.4);
  canopy.scale.set(0.95, 1.0, 2.0);
  g.add(canopy);

  // Tail horizontal
  const tailH = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 1.0), mat(OLIVE));
  tailH.position.set(0, 0.10, 3.4);
  g.add(tailH);

  // Tail vertical
  const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 1.0), mat(OLIVE));
  tailV.position.set(0, 0.80, 3.4);
  g.add(tailV);

  return g;
}

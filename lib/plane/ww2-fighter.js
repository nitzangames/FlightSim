// Faceted lowpoly WW2 fighter (Spitfire-ish proportions): elliptical wings,
// teardrop fuselage, prop nose. ~11m wingspan, ~9m length.

const OLIVE = 0x49572b;
const OLIVE_DARK = 0x303a18;
const STEEL = 0x46454a;
const PROP_BROWN = 0x2a1f12;

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

  // Wings sit just behind the engine nose (Spitfire proportions). Engine nose
  // back edge ~z=-3.0, wing leading edge ~-2.5, wing center ~-1.3.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.20, 2.4), mat(OLIVE));
  wing.position.set(0, -0.20, -1.3);
  g.add(wing);
  for (const sx of [-5.0, 5.0]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 1.6), mat(OLIVE_DARK));
    tip.position.set(sx, -0.30, -1.3);
    g.add(tip);
  }

  // Cockpit canopy — sits behind the wing trailing edge.
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.4), mat(0x223344));
  canopy.position.set(0, 0.55, 0.4);
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

// Faceted lowpoly F-15 Eagle — twin-engine air superiority fighter.

const GREY = 0x9aa0a8;
const GREY_DARK = 0x6e747c;
const STEEL = 0x46474d;
const CANOPY = 0x2a3340;
const EXHAUST = 0x141414;

export function buildF15(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Boxy wide fuselage
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 9.0), mat(GREY));
  g.add(body);

  // Rounded nose radome
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 8), mat(GREY));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -5.3;
  g.add(nose);

  // Twin rectangular intakes
  const intakeGeo = new THREE.BoxGeometry(0.5, 0.7, 1.4);
  for (const sx of [-0.8, 0.8]) {
    const intake = new THREE.Mesh(intakeGeo, mat(GREY_DARK));
    intake.position.set(sx, -0.2, -1.5);
    g.add(intake);
    const inHole = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.55), mat(0x111111));
    inHole.position.set(sx, -0.2, -2.21);
    inHole.rotation.y = Math.PI;
    g.add(inHole);
  }

  // Wing root
  const wingRoot = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 3.4), mat(GREY));
  wingRoot.position.set(0, -0.05, 0.5);
  g.add(wingRoot);

  // Trapezoidal back-swept wings
  const wingGeo = new THREE.BoxGeometry(5.5, 0.18, 3.2);
  const sweep15 = -22 * Math.PI / 180;
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(GREY_DARK));
    w.position.set(side * 3.0, -0.05, 0.5);
    w.rotation.y = side * sweep15;
    g.add(w);
  }

  // Long bubble canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY));
  canopy.position.set(0, 0.55, -1.2);
  canopy.scale.set(0.85, 1.0, 2.0);
  g.add(canopy);

  // Twin canted vertical tails
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 1.5), mat(GREY_DARK));
    fin.position.set(side * 0.7, 0.85, 3.5);
    fin.rotation.z = side * -0.08;
    fin.rotation.x = 0.18;
    g.add(fin);
  }

  // Stabilators
  const tplGeo = new THREE.BoxGeometry(2.2, 0.14, 1.0);
  for (const side of [-1, 1]) {
    const t = new THREE.Mesh(tplGeo, mat(GREY_DARK));
    t.position.set(side * 1.2, 0.0, 4.0);
    t.rotation.y = side * sweep15 * 0.7;
    g.add(t);
  }

  // Twin exhaust nozzles
  for (const sx of [-0.4, 0.4]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.36, 0.6, 10), mat(STEEL));
    ex.rotation.x = Math.PI / 2;
    ex.position.set(sx, -0.05, 4.7);
    g.add(ex);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.34, 12), mat(EXHAUST));
    hole.rotation.y = Math.PI;
    hole.position.set(sx, -0.05, 5.0);
    g.add(hole);
  }

  return g;
}

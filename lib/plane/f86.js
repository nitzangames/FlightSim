// Faceted lowpoly F-86 Sabre — early jet with swept wings, bubble canopy.

const SILVER = 0xa8aab0;
const SILVER_DARK = 0x767880;
const STEEL = 0x46474d;
const CANOPY = 0x223344;
const EXHAUST = 0x1a1a1a;

export function buildF86(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Slim cylindrical fuselage
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.50, 8.0, 10), mat(SILVER));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Pointed nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 10), mat(SILVER));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.8;
  g.add(nose);

  // Air intake ring
  const intake = new THREE.Mesh(new THREE.RingGeometry(0.30, 0.50, 12), mat(0x111111));
  intake.position.z = -3.99;
  g.add(intake);

  // Wing root fairing
  const wingRoot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.0), mat(SILVER_DARK));
  wingRoot.position.set(0, -0.20, -1.7);
  g.add(wingRoot);

  // Swept wings (~38° back-sweep)
  const wingGeo = new THREE.BoxGeometry(4.4, 0.18, 1.6);
  const sweep = -38 * Math.PI / 180;
  const leftWing = new THREE.Mesh(wingGeo, mat(SILVER_DARK));
  leftWing.position.set(-2.10, -0.20, -0.5);
  leftWing.rotation.y = -sweep;
  g.add(leftWing);
  const rightWing = new THREE.Mesh(wingGeo, mat(SILVER_DARK));
  rightWing.position.set(2.10, -0.20, -0.5);
  rightWing.rotation.y = sweep;
  g.add(rightWing);

  // Bubble canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY));
  canopy.position.set(0, 0.55, -0.8);
  canopy.scale.set(0.9, 1.0, 1.6);
  g.add(canopy);

  // Swept tailplanes
  const tplGeo = new THREE.BoxGeometry(2.0, 0.14, 0.9);
  const lTail = new THREE.Mesh(tplGeo, mat(SILVER_DARK));
  lTail.position.set(-1.05, 0.05, 3.4);
  lTail.rotation.y = -sweep * 0.8;
  g.add(lTail);
  const rTail = new THREE.Mesh(tplGeo, mat(SILVER_DARK));
  rTail.position.set(1.05, 0.05, 3.4);
  rTail.rotation.y = sweep * 0.8;
  g.add(rTail);

  // Vertical tailfin (back-tilted)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 1.4), mat(SILVER_DARK));
  fin.position.set(0, 0.85, 3.2);
  fin.rotation.x = 0.25;
  g.add(fin);

  // Exhaust
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.42, 0.6, 10), mat(STEEL));
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.z = 4.1;
  g.add(exhaust);
  const exhaustHole = new THREE.Mesh(new THREE.CircleGeometry(0.38, 12), mat(EXHAUST));
  exhaustHole.rotation.y = Math.PI;
  exhaustHole.position.z = 4.4;
  g.add(exhaustHole);

  return g;
}

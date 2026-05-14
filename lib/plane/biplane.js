// Faceted lowpoly biplane. Returns a THREE.Group oriented so forward = -Z.
// Roughly Sopwith Camel proportions: ~7m wingspan, ~6m length.

const RED = 0xc24935;
const TAN = 0xb89a6c;
const BROWN = 0x4d3826;
const STEEL = 0x6e6c66;

export function buildBiplane(THREE) {
  const g = new THREE.Group();
  const mat = (color) => new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 0 });

  // Fuselage — boxy, tapered (cylinder approximation w/ low segments)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.30, 5.0, 6), mat(TAN));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Engine cowling
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 8), mat(STEEL));
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = -2.4;
  g.add(cowl);

  // Propeller (rotates each frame in the controller)
  const propGroup = new THREE.Group();
  propGroup.position.z = -2.85;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.18), mat(BROWN));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Wings sit just behind the engine cowling — Sopwith proportions put the
  // leading edge ~0.5m back from the cowl. Cowl center is at z=-2.4 with depth
  // 0.8 → cowl back edge at z=-2.0. Wing leading edge ~-1.9, center ~-1.2.

  // Lower wing
  const lowerWing = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.16, 1.4), mat(RED));
  lowerWing.position.set(0, -0.25, -1.2);
  g.add(lowerWing);

  // Upper wing (offset above, slightly forward of lower)
  const upperWing = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.16, 1.4), mat(RED));
  upperWing.position.set(0, 1.1, -1.5);
  g.add(upperWing);

  // Wing struts (left and right, front and back)
  const strutGeo = new THREE.BoxGeometry(0.08, 1.35, 0.08);
  for (const sx of [-2.6, -1.0, 1.0, 2.6]) {
    for (const sz of [-1.55, -0.85]) {
      const strut = new THREE.Mesh(strutGeo, mat(BROWN));
      strut.position.set(sx, 0.42, sz);
      g.add(strut);
    }
  }

  // Tail horizontal
  const tailH = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.10, 0.7), mat(RED));
  tailH.position.set(0, 0.05, 2.2);
  g.add(tailH);

  // Tail vertical
  const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.0, 0.7), mat(RED));
  tailV.position.set(0, 0.55, 2.2);
  g.add(tailV);

  // Cockpit hole (dark patch, just behind the upper wing's trailing edge)
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.7), mat(0x111111));
  cockpit.position.set(0, 0.45, -0.5);
  g.add(cockpit);

  return g;
}

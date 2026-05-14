// Faceted lowpoly WW1 triplane (Fokker Dr.I-style).  ~6m wingspan, ~5m length.

const RED = 0xa11a1a;
const TAN = 0xb89a6c;
const BROWN = 0x4d3826;
const STEEL = 0x6e6c66;

export function buildTriplane(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Short stout fuselage
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.30, 4.6, 6), mat(TAN));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Engine cowling
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.7, 8), mat(STEEL));
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = -2.2;
  g.add(cowl);

  // Propeller (rotates each frame)
  const propGroup = new THREE.Group();
  propGroup.position.z = -2.6;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.10, 0.18), mat(BROWN));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Three wings stacked vertically, just behind the cowling
  const wingGeo = new THREE.BoxGeometry(6.0, 0.16, 1.3);
  const wingTop = new THREE.Mesh(wingGeo, mat(RED));
  wingTop.position.set(0, 1.5, -1.1);
  g.add(wingTop);
  const wingMid = new THREE.Mesh(wingGeo, mat(RED));
  wingMid.position.set(0, 0.55, -1.05);
  g.add(wingMid);
  const wingBot = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.16, 1.3), mat(RED));
  wingBot.position.set(0, -0.4, -1.0);
  g.add(wingBot);

  // Inter-wing struts
  const strutGeo = new THREE.BoxGeometry(0.08, 0.95, 0.08);
  for (const sx of [-2.0, 2.0]) {
    for (const sz of [-1.4, -0.7]) {
      const s1 = new THREE.Mesh(strutGeo, mat(BROWN));
      s1.position.set(sx, 1.0, sz);
      g.add(s1);
      const s2 = new THREE.Mesh(strutGeo, mat(BROWN));
      s2.position.set(sx, 0.05, sz);
      g.add(s2);
    }
  }

  // Tail
  const tailH = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.10, 0.7), mat(RED));
  tailH.position.set(0, 0.05, 2.0);
  g.add(tailH);
  const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.0, 0.7), mat(RED));
  tailV.position.set(0, 0.55, 2.0);
  g.add(tailV);

  // Cockpit
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.7), mat(0x111111));
  cockpit.position.set(0, 0.5, -0.2);
  g.add(cockpit);

  return g;
}

// Faceted lowpoly SR-71 Blackbird — Mach 3+ recon. Long thin fuselage with
// chines blending into the delta wings, huge engine nacelles mid-wing,
// twin canted vertical tails on the nacelles. Wings shifted aft so the
// trailing edge sits at the rear end of the body cylinder, matching the
// real plane's silhouette.

const BLACK  = 0x1a1a1f;
const DARKER = 0x101015;
const CANOPY = 0x2a3340;
const EXH    = 0x111111;
const STEEL  = 0x3a3a40;

export function buildSR71(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Long slim cylindrical fuselage.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 12.0, 12), mat(BLACK));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  // Pointed nose.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.0, 10), mat(BLACK));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -7.5;
  g.add(nose);

  // Chines — flat plates along the sides of the fuselage that blend nose
  // into wing. Signature SR-71 silhouette element.
  const chineGeo = new THREE.BoxGeometry(0.45, 0.12, 9.0);
  for (const side of [-1, 1]) {
    const c = new THREE.Mesh(chineGeo, mat(DARKER));
    c.position.set(side * 0.7, 0, -1.0);
    g.add(c);
  }

  // Delta wings shifted back so the trailing edge sits at the rear end of
  // the body cylinder. CCW vertex order keeps normals outward.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.0,  0.5);     // root leading (just behind cockpit)
  wingShape.lineTo(0.0, -6.0);     // root trailing (rear end of body)
  wingShape.lineTo(5.6, -5.5);     // tip (outboard, swept back)
  wingShape.lineTo(0.0,  0.5);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(BLACK));
    w.scale.x = side;
    w.position.set(0, -0.25, 0);
    w.rotation.x = -Math.PI / 2;
    g.add(w);
  }

  // Engine nacelles mid-wing — huge.
  for (const side of [-1, 1]) {
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.65, 5.0, 12), mat(DARKER));
    nac.rotation.x = Math.PI / 2;
    nac.position.set(side * 2.3, -0.2, 3.8);
    g.add(nac);
    // Spike inlet cone (signature SR-71 feature).
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 8), mat(STEEL));
    spike.rotation.x = -Math.PI / 2;
    spike.position.set(side * 2.3, -0.2, 1.0);
    g.add(spike);
    // Exhaust hole at the rear of the nacelle.
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.58, 12), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(side * 2.3, -0.2, 6.31);
    g.add(hole);
  }

  // Cockpit canopy.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.50, -3.6);
  canopy.scale.set(0.7, 1.0, 2.4);
  g.add(canopy);

  // Twin canted tails on the engine nacelles.
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.4), mat(BLACK));
    fin.position.set(side * 2.3, 0.65, 5.1);
    fin.rotation.z = side * -0.22;
    g.add(fin);
  }

  return g;
}

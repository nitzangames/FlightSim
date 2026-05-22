// Faceted lowpoly A-10 Warthog — Cold War close-air-support attack jet.
// Signature features: long straight wings (no sweep), twin engine pods
// mounted HIGH on the rear fuselage on pylons, twin vertical tails with a
// wing-level horizontal stab joining them (H-tail), and the iconic nose
// cannon barrel sticking forward.

const OLIVE  = 0x4a5040;
const DARK   = 0x2d3027;
const GREY   = 0x6e7280;
const CANOPY = 0x2a3340;
const EXH    = 0x111111;
const BARREL = 0x252830;

export function buildA10(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Chunky fuselage.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 8.5), mat(OLIVE));
  g.add(body);

  // Nose cannon barrel — long thin cylinder protruding forward.
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 2.4, 10), mat(BARREL));
  cannon.rotation.x = Math.PI / 2;
  cannon.position.set(0, -0.15, -5.4);
  g.add(cannon);
  // Cannon muzzle (thicker tip).
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 10), mat(DARK));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, -0.15, -6.45);
  g.add(muzzle);
  // Nose cone.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 1.4), mat(OLIVE));
  nose.position.set(0, 0.0, -4.95);
  g.add(nose);

  // Long straight wings (no sweep).
  const wing = new THREE.Mesh(new THREE.BoxGeometry(17.0, 0.22, 2.6), mat(OLIVE));
  wing.position.set(0, -0.20, -0.4);
  g.add(wing);
  // Wing-tip Hoerner fences.
  const tipGeo = new THREE.BoxGeometry(0.25, 0.55, 1.6);
  for (const side of [-1, 1]) {
    const t = new THREE.Mesh(tipGeo, mat(DARK));
    t.position.set(side * 8.4, -0.45, -0.4);
    g.add(t);
  }

  // Twin engine pods mounted HIGH on the rear fuselage. Pods positioned so
  // their exhaust clears the empennage with breathing room.
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 12), mat(GREY));
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 0.85, 0.95, 1.6);
    g.add(pod);
    // Pylon connecting pod to fuselage.
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.85, 1.6), mat(OLIVE));
    pylon.position.set(side * 0.85, 0.50, 1.6);
    g.add(pylon);
    // Exhaust at the rear of the pod.
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(side * 0.85, 0.95, 2.91);
    g.add(hole);
  }

  // Twin vertical tails — wide outboard placement, lowered so the
  // horizontal stab sits at wing-level for an H-tail empennage.
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.5), mat(OLIVE));
    fin.position.set(side * 2.3, 0.55, 4.0);
    g.add(fin);
  }
  // Horizontal stabilizer connecting both fins.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.16, 1.0), mat(OLIVE));
  stab.position.set(0, -0.20, 4.0);
  g.add(stab);

  // Bubble canopy.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.60, -2.6);
  canopy.scale.set(0.85, 1.0, 1.6);
  g.add(canopy);

  return g;
}

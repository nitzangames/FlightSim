// Faceted lowpoly F-16 Fighting Falcon — single-engine 4th-gen fighter.
// Signature features: single belly "shark mouth" intake under the cockpit,
// big one-piece bubble canopy with no centre frame, cropped delta wings
// blended into the fuselage.

const GREY   = 0x8a8e96;
const DARK   = 0x5b5f66;
const STEEL  = 0x40434a;
const EXH    = 0x111111;
const CANOPY = 0x2a3a44;

export function buildF16(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Fuselage.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 8.2), mat(GREY));
  g.add(body);
  // Pointed radar nose.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.40, 1.5, 10), mat(GREY));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.85;
  g.add(nose);

  // Belly shark-mouth intake (the F-16's most distinctive front-end feature).
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.6), mat(DARK));
  intake.position.set(0, -0.65, -1.8);
  g.add(intake);
  const intakeHole = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), mat(0x111111));
  intakeHole.position.set(0, -0.65, -2.61);
  intakeHole.rotation.y = Math.PI;
  g.add(intakeHole);

  // Cropped delta wings (Shape/ExtrudeGeometry — CCW vertex order so
  // ExtrudeGeometry produces outward-facing normals).
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.0,  1.6);    // root leading (forward)
  wingShape.lineTo(0.0, -2.0);    // root trailing
  wingShape.lineTo(4.6, -2.2);    // tip trailing
  wingShape.lineTo(4.6, -1.4);    // tip leading (back, outboard)
  wingShape.lineTo(0.0,  1.6);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(DARK));
    w.scale.x = side;
    w.position.set(0, -0.10, 0);
    w.rotation.x = -Math.PI / 2;
    g.add(w);
  }

  // One-piece bubble canopy.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.50, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.55, -1.4);
  canopy.scale.set(0.85, 1.05, 2.2);
  g.add(canopy);

  // Single vertical tail.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.6), mat(GREY));
  fin.position.set(0, 0.95, 3.0);
  g.add(fin);
  // Horizontal stabilators.
  const stabGeo = new THREE.BoxGeometry(2.6, 0.15, 1.0);
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(DARK));
    s.position.set(side * 1.3, 0.0, 3.5);
    s.rotation.y = side * -0.22;
    g.add(s);
  }

  // Single exhaust nozzle.
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.40, 0.55, 12), mat(STEEL));
  ex.rotation.x = Math.PI / 2;
  ex.position.z = 4.4;
  g.add(ex);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.38, 12), mat(EXH));
  hole.rotation.y = Math.PI;
  hole.position.z = 4.71;
  g.add(hole);

  return g;
}

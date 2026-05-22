// Faceted lowpoly F/A-18 Hornet — twin-engine carrier fighter.
// Signature features: sharp leading-edge extension (LEX) plates flanking
// the cockpit, twin sharply-canted vertical tails, twin closely-spaced
// exhausts at the rear.

const GREY   = 0x9aa0a8;
const DARK   = 0x6e747c;
const CANOPY = 0x2a3340;
const STEEL  = 0x46474d;
const EXH    = 0x141414;

export function buildF18(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Fuselage.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 8.6), mat(GREY));
  g.add(body);
  // Conical radar nose.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.6, 10), mat(GREY));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -5.1;
  g.add(nose);

  // LEX (leading-edge extensions) — triangular plates flanking the cockpit.
  // The F-18's most distinctive silhouette feature.
  const lexShape = new THREE.Shape();
  lexShape.moveTo(0.0, -3.4);     // sharp forward tip at the cockpit
  lexShape.lineTo(1.4,  0.4);     // wide attachment at the wing root
  lexShape.lineTo(0.2,  0.5);
  lexShape.lineTo(0.0, -3.4);
  const lexGeo = new THREE.ExtrudeGeometry(lexShape, { depth: 0.12, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const lex = new THREE.Mesh(lexGeo, mat(DARK));
    lex.scale.x = side;
    lex.position.set(side * 0.6, 0.15, 0);
    lex.rotation.x = -Math.PI / 2;
    g.add(lex);
  }

  // Twin side intakes under the LEX.
  for (const sx of [-0.85, 0.85]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 1.4), mat(DARK));
    intake.position.set(sx, -0.25, -1.0);
    g.add(intake);
  }

  // Trapezoidal swept wings — pulled in toward the fuselage so the LEX
  // plates flow naturally into the wing leading edge.
  const wingGeo = new THREE.BoxGeometry(4.8, 0.20, 3.0);
  const sweep = -28 * Math.PI / 180;
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(DARK));
    w.position.set(side * 2.3, -0.05, 0.7);
    w.rotation.y = side * sweep;
    g.add(w);
  }

  // Long bubble canopy.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.60, -1.5);
  canopy.scale.set(0.85, 1.0, 2.2);
  g.add(canopy);

  // Twin sharply-canted vertical tails.
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 1.5), mat(DARK));
    fin.position.set(side * 0.85, 0.85, 2.9);
    fin.rotation.z = side * -0.32;
    g.add(fin);
  }
  // Horizontal stabs.
  const stabGeo = new THREE.BoxGeometry(2.4, 0.14, 1.0);
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(DARK));
    s.position.set(side * 1.2, -0.05, 3.7);
    s.rotation.y = side * sweep * 0.7;
    g.add(s);
  }

  // Twin close-set exhaust nozzles.
  for (const sx of [-0.35, 0.35]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.55, 10), mat(STEEL));
    ex.rotation.x = Math.PI / 2;
    ex.position.set(sx, -0.05, 4.4);
    g.add(ex);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.30, 12), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(sx, -0.05, 4.71);
    g.add(hole);
  }

  return g;
}

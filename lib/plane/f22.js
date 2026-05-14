// Faceted lowpoly F-22 Raptor — stealth, twin canted tails, diamond wings.

const GREY = 0x4a5260;
const GREY_DARK = 0x353a45;
const STEEL = 0x2a2d33;
const CANOPY = 0x1a2532;
const EXHAUST = 0x0a0a0a;

export function buildF22(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Faceted body — wider lower deck + narrower upper deck
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 9.0), mat(GREY));
  lower.position.y = -0.15;
  g.add(lower);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 7.0), mat(GREY));
  upper.position.set(0, 0.30, -0.5);
  g.add(upper);

  // Long sharp pointed nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 4.0, 5), mat(GREY));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -5.5;
  g.add(nose);

  // Faceted intakes
  for (const sx of [-0.85, 0.85]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 1.4), mat(GREY_DARK));
    intake.position.set(sx, -0.15, -2.0);
    g.add(intake);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.32), mat(0x000000));
    hole.position.set(sx, -0.15, -2.71);
    hole.rotation.y = Math.PI;
    g.add(hole);
  }

  // Diamond/clipped-delta wings (extruded shape, scaled +25%)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -1.2);
  wingShape.lineTo(3.6, -0.1);
  wingShape.lineTo(3.6, 0.6);
  wingShape.lineTo(0, 1.6);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.16, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(GREY_DARK));
    w.scale.set(side * 1.25, 1.25, 1);
    w.position.set(0, -0.18, 0.4);
    w.rotation.x = -Math.PI / 2;
    g.add(w);
  }

  // Faceted canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 2.0), mat(CANOPY));
  canopy.position.set(0, 0.65, -1.4);
  g.add(canopy);
  const canopyFront = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.6), mat(CANOPY));
  canopyFront.position.set(0, 0.5, -2.5);
  g.add(canopyFront);

  // Twin canted tails (~28° outward)
  const cant = 28 * Math.PI / 180;
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 1.4), mat(GREY_DARK));
    fin.position.set(side * 0.85, 0.7, 3.0);
    fin.rotation.z = side * -cant;
    fin.rotation.x = 0.15;
    g.add(fin);
  }

  // Stabilators — same diamond shape, scaled smaller
  for (const side of [-1, 1]) {
    const t = new THREE.Mesh(wingGeo, mat(GREY_DARK));
    t.scale.set(side * 0.55, 0.55, 0.7);
    t.position.set(0, -0.05, 4.0);
    t.rotation.x = -Math.PI / 2;
    g.add(t);
  }

  // Square thrust-vectoring nozzles
  for (const sx of [-0.4, 0.4]) {
    const ex = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.6), mat(STEEL));
    ex.position.set(sx, -0.1, 4.4);
    g.add(ex);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.38), mat(EXHAUST));
    hole.rotation.y = Math.PI;
    hole.position.set(sx, -0.1, 4.71);
    g.add(hole);
  }

  return g;
}

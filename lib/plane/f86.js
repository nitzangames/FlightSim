// Faceted lowpoly F-86 Sabre — early swept-wing jet fighter. Open round
// nose intake (no propeller), bubble canopy forward of swept wings,
// jet exhaust at the rear. Livery: bare-metal silver with yellow
// accent bands and US star-and-bar insignia.

const SILVER    = 0xc6cbd4;
const YELLOW    = 0xf2c33a;
const CANOPY    = 0x4a90c0;
const INTAKE    = 0x0a0a0a;
const EXHAUST   = 0x1a1a1a;
const NOZZLE    = 0x46474d;

export function buildF86(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Fuselage — LatheGeometry profile. Unlike a prop plane, the profile
  // does NOT close at the front endpoint — the lathe is an open tube at
  // both ends, exposing the intake at the front and the exhaust at the
  // rear. Profile points are (radius, axial-Z); after rotation.x = π/2
  // the axial values map directly to world Z.
  const fuseProfile = [
    new THREE.Vector2(0.55, -4.00),   // intake front edge
    new THREE.Vector2(0.56, -3.80),   // small intake lip
    new THREE.Vector2(0.60, -3.00),   // forward fuselage
    new THREE.Vector2(0.62, -1.50),   // max body radius (mid)
    new THREE.Vector2(0.60,  0.00),   // mid-aft taper begins
    new THREE.Vector2(0.55,  1.50),   // tapering toward exhaust
    new THREE.Vector2(0.48,  3.00),   // narrowing
    new THREE.Vector2(0.45,  4.00),   // exhaust nozzle radius
  ];
  const bodyGeo = new THREE.LatheGeometry(fuseProfile, 12);
  const body = new THREE.Mesh(bodyGeo, mat(SILVER));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Intake mouth — dark disc inside the front opening, faces forward
  // (world -Z). Slightly smaller than the mouth radius so the body lip
  // is visible around it.
  const intake = new THREE.Mesh(new THREE.CircleGeometry(0.50, 16), mat(INTAKE));
  intake.rotation.y = Math.PI;
  intake.position.z = -3.95;
  g.add(intake);

  // Exhaust nozzle — short steel cylinder ring at the rear, plus a dark
  // disc inside facing rearward.
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.45, 0.40, 14), mat(NOZZLE));
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = 4.10;
  g.add(nozzle);
  const exhaustHole = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), mat(EXHAUST));
  exhaustHole.position.z = 4.25;
  g.add(exhaustHole);

  // Bubble canopy — forward-mounted teardrop. Body radius at z=-2.2 is
  // ~0.61, so a canopy base at y≈0.55 sits just above the spine.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.55, -2.20);
  canopy.scale.set(0.85, 1.0, 1.7);
  g.add(canopy);

  // Wings — TEMPORARY box placeholders; replaced with ExtrudeGeometry in Task 3.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.18, 1.5), mat(SILVER));
  wing.position.set(0, -0.25, -0.5);
  g.add(wing);

  // Tail surfaces — TEMPORARY boxes; replaced with ExtrudeGeometry in Task 4.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.4, 1.2), mat(SILVER));
  fin.position.set(0, 0.80, 3.00);
  g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.7), mat(SILVER));
  stab.position.set(0, 0.10, 3.10);
  g.add(stab);

  return g;
}

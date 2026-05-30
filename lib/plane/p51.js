// Faceted lowpoly P-51D Mustang — WW2 long-range escort fighter.
// In-line V-12 Merlin → long nose, bubble canopy aft of the wings,
// signature belly radiator scoop. ~11 m wingspan, ~11 m length.
// Livery: bare-metal silver body with yellow spinner + cowling band.

const SILVER   = 0xc6cbd4;
const YELLOW   = 0xf2c33a;
const SCOOP    = 0xb8bdc6;
const CANOPY   = 0x2a3340;
const DARK     = 0x1c1c20;

export function buildP51(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Fuselage — LatheGeometry profile gives a long teardrop with max radius
  // just under the canopy, tapering to a sharp tail. Profile points are
  // (radius, axial-Z). After rotation.x = π/2, local +Y → world +Z, so axial
  // values map directly to world Z. Caps via x=0 endpoints.
  const fuseProfile = [
    new THREE.Vector2(0.00, -5.50),
    new THREE.Vector2(0.42, -5.45),
    new THREE.Vector2(0.55, -4.20),
    new THREE.Vector2(0.60, -2.20),
    new THREE.Vector2(0.58,  0.00),
    new THREE.Vector2(0.50,  1.50),
    new THREE.Vector2(0.32,  2.80),
    new THREE.Vector2(0.18,  3.90),
    new THREE.Vector2(0.00,  4.80),
  ];
  const bodyGeo = new THREE.LatheGeometry(fuseProfile, 14);
  const body = new THREE.Mesh(bodyGeo, mat(SILVER));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Yellow nose cowling band — short cylinder wrapping the front of the
  // fuselage so the yellow blends from the spinner into the body. The
  // fuselage radius at z∈[-5.45,-4.20] interpolates ~0.42→0.55; pick 0.56
  // so the band sits flush/slightly proud of the body.
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 1.0, 14), mat(YELLOW));
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -4.8;
  g.add(nose);

  // Spinner — yellow pointed cone in front of the cowling.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.4, 10), mat(YELLOW));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -6.1;
  g.add(spinner);

  // Propeller — single bar mesh in a group so the chase loop can spin it.
  const propGroup = new THREE.Group();
  propGroup.position.z = -6.85;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.10), mat(DARK));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Wings — TEMPORARY box; replaced with ExtrudeGeometry in Task 3.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.20, 2.4), mat(SILVER));
  wing.position.set(0, -0.45, -0.3);
  g.add(wing);

  // Bubble canopy.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.55, 0.4);
  canopy.scale.set(0.9, 1.0, 2.0);
  g.add(canopy);

  // Belly radiator scoop — flat-sided duct.
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 1.6), mat(SCOOP));
  scoop.position.set(0, -0.75, 0.3);
  g.add(scoop);

  // Tail surfaces — TEMPORARY boxes; replaced with ExtrudeGeometry in Task 3.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.4), mat(SILVER));
  fin.position.set(0, 0.75, 3.2);
  g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 0.9), mat(SILVER));
  stab.position.set(0, 0.10, 3.4);
  g.add(stab);

  return g;
}

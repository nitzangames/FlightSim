// Faceted lowpoly P-51 Mustang — WW2 long-range escort fighter.
// In-line V-12 Merlin → long nose, bubble canopy aft of the wings,
// signature belly radiator scoop. ~11 m wingspan, ~7.5 m length.
// Livery: yellow front half + grey rear half (classic nose-art split).

const YELLOW = 0xeec441;
const GREY   = 0x8a8e96;
const SILVER = 0xc0c4cc;
const DARK   = 0x35392c;
const CANOPY = 0x2a3340;

export function buildP51(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Fuselage split at z=0 into yellow front + grey rear halves.
  const bodyFront = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 3.75), mat(YELLOW));
  bodyFront.position.z = -1.875;
  g.add(bodyFront);
  const bodyBack = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 3.75), mat(GREY));
  bodyBack.position.z = 1.875;
  g.add(bodyBack);

  // Spinner + prop.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 10), mat(DARK));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -4.25;
  g.add(spinner);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.10), mat(0x1c1c20));
  prop.position.z = -4.6;
  g.add(prop);
  // Expose the propeller mesh so the chase loop can spin it.
  g.userData.propeller = prop;

  // Wings — silver, level rectangle with a small fillet under the cockpit.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.20, 2.4), mat(SILVER));
  wing.position.set(0, -0.25, -0.5);
  g.add(wing);
  const fillet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.8), mat(GREY));
  fillet.position.set(0, -0.10, -0.5);
  g.add(fillet);

  // Bubble canopy aft of wings.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.55, 0.4);
  canopy.scale.set(0.9, 1.0, 2.0);
  g.add(canopy);

  // Signature belly radiator scoop.
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 1.6), mat(SILVER));
  scoop.position.set(0, -0.85, 0.3);
  g.add(scoop);

  // Vertical fin + horizontal stab.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.4), mat(GREY));
  fin.position.set(0, 0.75, 3.2);
  g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 0.9), mat(GREY));
  stab.position.set(0, 0.10, 3.4);
  g.add(stab);

  return g;
}

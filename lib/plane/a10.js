// Faceted lowpoly A-10A Thunderbolt II — Cold War close-air-support
// attack jet. European One three-tone camouflage approximated by
// alternating per-mesh coloring between dark green and lighter olive.
// Signature features: long straight wings, twin engine pods mounted
// HIGH on the rear fuselage, H-tail (twin fins on the outboard ends
// of the horizontal stab), nose-mounted GAU-8 cannon barrel.

const OLIVE      = 0x4a5040;   // main olive drab
const DARK_GREEN = 0x383a30;   // darker camo patches
const GREY       = 0x6e7280;   // engine pod casings
const CANOPY     = 0x2a3340;   // tinted canopy glass
const EXH        = 0x111111;   // dark exhaust hole
const DARK       = 0x1a1a1a;   // engine inlet interior
const BARREL     = 0x252830;   // GAU-8 gun barrel
const MUZZLE     = 0x1a1a1a;   // gun muzzle

const US_BLUE  = 0x1a3a7a;
const US_WHITE = 0xeaeaea;
const US_RED   = 0xb21a1a;

// US star-and-bar (post-1947 style). Duplicated from lib/plane/p51.js
// per the self-contained convention.
function makeStarBar(THREE, diameter) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  const r = diameter / 2;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat(US_BLUE));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.000;
  g.add(disc);
  const starShape = new THREE.Shape();
  const outer = r * 0.85;
  const inner = r * 0.34;
  for (let i = 0; i < 10; i++) {
    const radius = (i % 2 === 0) ? outer : inner;
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, z);
    else         starShape.lineTo(x, z);
  }
  starShape.closePath();
  const starGeo = new THREE.ShapeGeometry(starShape);
  const star = new THREE.Mesh(starGeo, mat(US_WHITE));
  star.rotation.x = -Math.PI / 2;
  star.position.y = 0.002;
  g.add(star);
  const barLen = diameter;
  const barH = r * 0.66;
  const barOffset = r * 0.90 + barLen / 2;
  for (const sx of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(barLen, barH), mat(US_WHITE));
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(sx * barOffset, 0.002, 0);
    g.add(bar);
  }
  const stripeH = barH * 0.33;
  for (const sx of [-1, 1]) {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(barLen, stripeH), mat(US_RED));
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(sx * barOffset, 0.004, 0);
    g.add(seg);
  }
  return g;
}

// Racetrack-shaped wing planform (rectangular middle with half-circle ends).
function makeRacetrackWing(THREE, span, chord, thickness) {
  const r = chord / 2;
  const halfSpan = span / 2;
  const shape = new THREE.Shape();
  const N = 6;
  shape.moveTo(-halfSpan + r, +r);
  shape.lineTo(+halfSpan - r, +r);
  for (let i = 1; i < N; i++) {
    const theta = Math.PI / 2 - i * Math.PI / N;
    shape.lineTo(+halfSpan - r + r * Math.cos(theta), r * Math.sin(theta));
  }
  shape.lineTo(+halfSpan - r, -r);
  shape.lineTo(-halfSpan + r, -r);
  for (let i = 1; i < N; i++) {
    const theta = -Math.PI / 2 - i * Math.PI / N;
    shape.lineTo(-halfSpan + r + r * Math.cos(theta), r * Math.sin(theta));
  }
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
}

export function buildA10(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Chunky fuselage — chunky box-shape characteristic of the A-10.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 8.5), mat(OLIVE));
  g.add(body);

  // Forward nose section — slightly narrower than the main fuselage,
  // in darker camo for contrast.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 1.4), mat(DARK_GREEN));
  nose.position.set(0, 0.0, -4.95);
  g.add(nose);

  // Nose cone — slight taper toward the gun.
  const noseCone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.80, 8), mat(DARK_GREEN));
  noseCone.rotation.x = Math.PI / 2;
  noseCone.position.set(0, 0.0, -6.05);
  g.add(noseCone);

  // GAU-8 cannon barrel — long thin cylinder protruding from the nose.
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 2.2, 10), mat(BARREL));
  cannon.rotation.x = Math.PI / 2;
  cannon.position.set(0, -0.15, -6.30);
  g.add(cannon);
  // Cannon muzzle (slightly thicker tip).
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.30, 10), mat(MUZZLE));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, -0.15, -7.30);
  g.add(muzzle);

  // Long straight wings — racetrack planform, rounded tips. DARK_GREEN
  // for camo contrast against the OLIVE fuselage.
  const wingGeo = makeRacetrackWing(THREE, 17.0, 2.6, 0.22);
  const wing = new THREE.Mesh(wingGeo, mat(DARK_GREEN));
  wing.rotation.x = -Math.PI / 2;
  wing.position.set(0, -0.30, -0.4);
  g.add(wing);

  // Hoerner wingtip fences — distinctive A-10 detail at the wingtips.
  const tipGeo = new THREE.BoxGeometry(0.25, 0.55, 1.6);
  for (const side of [-1, 1]) {
    const t = new THREE.Mesh(tipGeo, mat(OLIVE));
    t.position.set(side * 8.4, -0.55, -0.4);
    g.add(t);
  }

  // Twin engine pods — high-mounted on the rear fuselage on short pylons.
  // Pods in GREY for visual contrast against the green airframe.
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 12), mat(GREY));
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 0.85, 0.95, 1.6);
    g.add(pod);
    // Pylon connecting pod to fuselage.
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.85, 1.6), mat(OLIVE));
    pylon.position.set(side * 0.85, 0.50, 1.6);
    g.add(pylon);
    // Dark inlet face at the FRONT of the pod (reads as the engine intake).
    const inlet = new THREE.Mesh(new THREE.CircleGeometry(0.48, 16), mat(DARK));
    inlet.rotation.y = Math.PI;
    inlet.position.set(side * 0.85, 0.95, 0.25);
    g.add(inlet);
    // Exhaust at the rear of the pod.
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(side * 0.85, 0.95, 2.91);
    g.add(hole);
  }

  // Horizontal stabilizer — racetrack planform.
  const stabGeo = makeRacetrackWing(THREE, 5.6, 1.2, 0.16);
  const stab = new THREE.Mesh(stabGeo, mat(DARK_GREEN));
  stab.rotation.x = -Math.PI / 2;
  stab.position.set(0, 0.30, 4.0);
  g.add(stab);

  // Twin vertical fins — mounted at the OUTBOARD ENDS of the horizontal
  // stab (true H-tail). Each fin is an ExtrudeGeometry with the
  // characteristic A-10 silhouette: rectangular base with rounded top.
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.55, 0.00);   // forward base
  finShape.lineTo(+0.55, 0.00);   // aft base
  finShape.lineTo(+0.55, 1.20);   // aft upper
  finShape.lineTo(+0.30, 1.45);   // top aft rounded
  finShape.lineTo(-0.10, 1.50);   // top apex
  finShape.lineTo(-0.45, 1.35);   // top forward rounded
  finShape.lineTo(-0.55, 1.10);   // forward upper
  finShape.lineTo(-0.55, 0.00);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, mat(OLIVE));
    fin.rotation.y = -Math.PI / 2;
    // Position at outboard end of horizontal stab. Stab is 5.6 wide so
    // ends at world X = ±2.80, with stab thickness 0.16 sitting at
    // y ∈ [0.30, 0.46]. Fin base at y=0.46 (top of stab).
    fin.position.set(side * 2.70, 0.46, 4.0);
    g.add(fin);
  }

  // Bubble canopy — high-mounted, characteristic A-10 forward visibility.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.60, -2.6);
  canopy.scale.set(0.85, 1.0, 1.6);
  g.add(canopy);

  // US star-and-bar insignia. Wing top L+R + wing bottom L+R.
  // Wing extrudes from local y=0 to y=0.22 along its own Y, which maps
  // to world +Y after the -π/2 X rotation; with wing.position.y=-0.30
  // the wing occupies world y ∈ [-0.30, -0.08]. Top surface = -0.08.
  for (const sx of [-5.5, 5.5]) {
    const ins = makeStarBar(THREE, 1.4);
    ins.position.set(sx, -0.06, -0.4);
    g.add(ins);
  }
  for (const sx of [-5.5, 5.5]) {
    const ins = makeStarBar(THREE, 1.4);
    ins.rotation.z = Math.PI;
    ins.position.set(sx, -0.32, -0.4);
    g.add(ins);
  }

  return g;
}

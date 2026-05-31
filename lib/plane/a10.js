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

  // Fuselage — ExtrudeGeometry of a 2D side profile. Length runs from
  // z=-5.5 (nose tip) to z=+4.0 (tail end), width 1.1 via the extrude
  // depth (the A-10 fuselage is noticeably TALLER than wide — narrow
  // cross-section to keep small radar/visual signature, stacked
  // cockpit-over-bathtub gives the tall profile).
  //
  // Shape coords: shapeX = world Z (length), shapeY = world Y (height).
  // After mesh.rotation.y = -π/2, shape +X → world +Z (aft) and the
  // extrude direction → world -X. With depth 1.1, position.x = +0.55
  // centers the body on world X = 0.
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-5.50,  0.00);   // nose tip
  bodyShape.lineTo(-5.00,  0.40);   // nose top rises
  bodyShape.lineTo(-4.00,  0.55);   // forward fuselage top
  bodyShape.lineTo(-3.00,  0.80);   // canopy hump peak (raised)
  bodyShape.lineTo(-1.50,  0.75);   // top descends behind canopy
  bodyShape.lineTo( 0.50,  0.65);   // mid-body top
  bodyShape.lineTo( 2.50,  0.55);   // aft body top
  bodyShape.lineTo( 4.00,  0.35);   // tail top
  bodyShape.lineTo( 4.00, -0.35);   // tail end (vertical)
  bodyShape.lineTo( 2.50, -0.55);   // aft belly
  bodyShape.lineTo( 0.50, -0.65);   // belly under wings
  bodyShape.lineTo(-1.50, -0.70);   // titanium bathtub belly (deeper)
  bodyShape.lineTo(-3.50, -0.65);   // belly rises toward nose
  bodyShape.lineTo(-5.00, -0.40);   // nose bottom
  // ExtrudeGeometry implicitly closes via the rounded forward edge.
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.1, bevelEnabled: false });
  const body = new THREE.Mesh(bodyGeo, mat(OLIVE));
  body.rotation.y = -Math.PI / 2;
  body.position.x = 0.55;
  g.add(body);

  // Nose / gun housing — small slightly-tapered cylinder. Most of it sits
  // inside the body; only a small portion (~0.15) pokes out at the nose
  // tip as a gun fairing. Narrow radius 0.22→0.28 so the visible portion
  // doesn't read as a fat second nose.
  const noseCone = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.20, 10), mat(DARK_GREEN));
  noseCone.rotation.x = Math.PI / 2;
  noseCone.position.set(0, 0.0, -4.95);
  g.add(noseCone);

  // GAU-8 cannon barrel — extends deep into the fuselage (aft end at
  // z=-3.20) but only protrudes a short distance forward of the nose.
  // Visible barrel ~0.70 units in front of the body, not a long spear.
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 2.8, 10), mat(BARREL));
  cannon.rotation.x = Math.PI / 2;
  cannon.position.set(0, -0.15, -4.60);
  g.add(cannon);
  // Cannon muzzle (slightly thicker tip) just at the forward end.
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.30, 10), mat(MUZZLE));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, -0.15, -6.10);
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

  // Twin engine pods — mounted on the rear fuselage with horizontal pylons
  // running sideways into the body. Engines lowered from y=0.95 to y=0.70
  // so the pylon attaches cleanly to the body's upper-side wall.
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 12), mat(GREY));
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 1.20, 0.70, 1.6);
    g.add(pod);
    // Horizontal pylon — box running from the body side outboard to the
    // pod inboard surface, at pod centerline height. Overlaps both ends
    // slightly (x range 0.45 to 0.75 spans body edge 0.55 and pod
    // inboard 0.65) so it visually connects body to pod.
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.22, 1.6), mat(OLIVE));
    pylon.position.set(side * 0.85, 0.70, 1.6);
    g.add(pylon);
    // Dark inlet face at the FRONT of the pod (reads as the engine intake).
    const inlet = new THREE.Mesh(new THREE.CircleGeometry(0.48, 16), mat(DARK));
    inlet.rotation.y = Math.PI;
    inlet.position.set(side * 1.20, 0.70, 0.25);
    g.add(inlet);
    // Smaller tapered exhaust nozzle cylinder sticking out the BACK of
    // the pod (the visible nozzle behind the larger pod casing).
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.40, 12), mat(GREY));
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side * 1.20, 0.70, 3.10);
    g.add(nozzle);
    // Dark exhaust hole inside the nozzle.
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(side * 1.20, 0.70, 3.31);
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
    // Position at outboard end of horizontal stab, lowered so the fin
    // passes THROUGH the stab — small portion (~0.20) visible below the
    // stab bottom face, taller portion (~1.10) above (matches reference
    // where the fin spans both sides of the H-tail stab).
    fin.position.set(side * 2.70, 0.10, 4.0);
    g.add(fin);
  }

  // Bubble canopy — high-mounted at the cockpit hump (z≈-3.0), well
  // forward of the wings as per the A-10 reference.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.70, -3.20);
  canopy.scale.set(0.80, 0.95, 1.4);
  g.add(canopy);

  // US star-and-bar insignia. Wing top L+R + wing bottom L+R.
  // Wing extrudes from local y=0 to y=0.22 along its own Y, which maps
  // to world +Y after the -π/2 X rotation; with wing.position.y=-0.30
  // the wing occupies world y ∈ [-0.30, -0.08]. Top surface = -0.08.
  for (const sx of [-5.5, 5.5]) {
    const ins = makeStarBar(THREE, 0.7);
    ins.position.set(sx, -0.06, -0.4);
    g.add(ins);
  }
  for (const sx of [-5.5, 5.5]) {
    const ins = makeStarBar(THREE, 0.7);
    ins.rotation.z = Math.PI;
    ins.position.set(sx, -0.32, -0.4);
    g.add(ins);
  }

  return g;
}

// Faceted lowpoly Fairey Flycatcher — early-1930s British Fleet Air Arm
// biplane fighter. Bare-metal silver with a yellow fuselage stripe, RAF
// roundels on the wings, and red/white/blue rudder stripes. Bristol Jupiter
// radial engine with 7 visible cylinder bumps at the cowling. Yellow main
// wheels on V-struts.

const SILVER   = 0xc6cbd4;   // bare aluminum fuselage + wings + tail
const YELLOW   = 0xf2c33a;   // fuselage side stripe + wheels
const BROWN    = 0x4d3826;   // wood prop + wing struts
const STEEL    = 0x46474d;   // engine cylinder details + wheel struts
const DARK     = 0x1a1a1a;   // cockpit interior, engine hub

const RAF_BLUE  = 0x1a3a7a;
const RAF_WHITE = 0xeaeaea;
const RAF_RED   = 0xb21a1a;

// RAF Type-A roundel: 3 concentric circles with tiny Y offsets to avoid
// z-fighting. Duplicated from lib/plane/ww2-fighter.js per the project
// convention of keeping each plane module self-contained.
function makeRoundel(THREE, diameter) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  const r = diameter / 2;
  const rings = [
    { color: RAF_BLUE,  radius: r,        y: 0.000 },
    { color: RAF_WHITE, radius: r * 0.66, y: 0.002 },
    { color: RAF_RED,   radius: r * 0.33, y: 0.004 },
  ];
  for (const { color, radius, y } of rings) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), mat(color));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    g.add(m);
  }
  return g;
}

// Racetrack planform — rectangular middle with half-circle ends. Returns
// an ExtrudeGeometry. Shape X = span (left-right), shape Y = chord
// (forward-back), extrude depth = thickness. The caller is responsible
// for orienting the wing (typically rotation.x = -π/2 so shape Y
// becomes world -Z = forward).
function makeRacetrackWing(THREE, span, chord, thickness) {
  const r = chord / 2;
  const halfSpan = span / 2;
  const shape = new THREE.Shape();
  const N = 6; // arc segments per end
  // Top (forward) edge: from left-end to right-end at y = +r
  shape.moveTo(-halfSpan + r, +r);
  shape.lineTo(+halfSpan - r, +r);
  // Right tip semicircle (top to bottom around the +X side)
  for (let i = 1; i < N; i++) {
    const theta = Math.PI / 2 - i * Math.PI / N;
    shape.lineTo(+halfSpan - r + r * Math.cos(theta), r * Math.sin(theta));
  }
  shape.lineTo(+halfSpan - r, -r);
  // Bottom (aft) edge: right-end to left-end at y = -r
  shape.lineTo(-halfSpan + r, -r);
  // Left tip semicircle (bottom to top around the -X side)
  for (let i = 1; i < N; i++) {
    const theta = -Math.PI / 2 - i * Math.PI / N;
    shape.lineTo(-halfSpan + r + r * Math.cos(theta), r * Math.sin(theta));
  }
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
}

export function buildBiplane(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Fuselage — LatheGeometry teardrop. Profile points (radius, axial-Z);
  // after rotation.x = π/2 the axial values map directly to world Z.
  // Length ~6.4 (z: -2.6 → 3.8). Max radius ~0.45 just behind the cowling.
  const fuseProfile = [
    new THREE.Vector2(0.00, -2.60),   // nose tip (behind the cowling/prop)
    new THREE.Vector2(0.42, -2.55),
    new THREE.Vector2(0.45, -2.00),   // max radius near front
    new THREE.Vector2(0.42,  0.00),   // mid-fuselage
    new THREE.Vector2(0.32,  1.50),   // taper toward tail
    new THREE.Vector2(0.20,  2.80),
    new THREE.Vector2(0.00,  3.80),   // tail tip
  ];
  const bodyGeo = new THREE.LatheGeometry(fuseProfile, 12);
  const body = new THREE.Mesh(bodyGeo, mat(SILVER));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Engine cowling — short silver cylinder, slightly wider than the
  // fuselage front, set just ahead of the nose.
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.50, 14), mat(SILVER));
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = -2.85;
  g.add(cowl);

  // Bristol Jupiter radial engine — 7 small steel cylinder "heads" around
  // the cowling perimeter at the front face.
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const r = 0.40;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.20, 6), mat(STEEL));
    cyl.rotation.x = Math.PI / 2;
    cyl.position.set(Math.cos(angle) * r, Math.sin(angle) * r, -3.05);
    g.add(cyl);
  }
  // Engine hub — dark disc at the very front, pushed 0.03 forward of the
  // cowling's front face (at z=-3.10) to avoid z-fighting between the
  // hub disc and the cowling's closed front cap.
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.30, 16), mat(DARK));
  hub.rotation.y = Math.PI;
  hub.position.z = -3.13;
  g.add(hub);

  // Propeller — brown wood two-blade bar.
  const propGroup = new THREE.Group();
  propGroup.position.z = -3.20;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.10, 0.10), mat(BROWN));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Lower wing — racetrack planform (rounded tips), silver.
  const lowerWingGeo = makeRacetrackWing(THREE, 8.5, 1.4, 0.16);
  const lowerWing = new THREE.Mesh(lowerWingGeo, mat(SILVER));
  lowerWing.rotation.x = -Math.PI / 2;
  lowerWing.position.set(0, -0.33, -1.2);
  g.add(lowerWing);

  // Upper wing — racetrack planform, slightly wider, slightly forward.
  const upperWingGeo = makeRacetrackWing(THREE, 9.0, 1.4, 0.16);
  const upperWing = new THREE.Mesh(upperWingGeo, mat(SILVER));
  upperWing.rotation.x = -Math.PI / 2;
  upperWing.position.set(0, 1.02, -1.5);
  g.add(upperWing);

  // Wing struts — brown wooden, two pairs per side.
  const strutGeo = new THREE.BoxGeometry(0.08, 1.35, 0.08);
  for (const sx of [-3.0, -1.2, 1.2, 3.0]) {
    for (const sz of [-1.55, -0.85]) {
      const strut = new THREE.Mesh(strutGeo, mat(BROWN));
      strut.position.set(sx, 0.42, sz);
      g.add(strut);
    }
  }

  // Horizontal stabilizer — racetrack planform.
  const stabGeo = makeRacetrackWing(THREE, 2.4, 0.7, 0.10);
  const tailH = new THREE.Mesh(stabGeo, mat(SILVER));
  tailH.rotation.x = -Math.PI / 2;
  tailH.position.set(0, 0.05, 2.4);
  g.add(tailH);

  // Vertical fin — ExtrudeGeometry with curved top corners (rounded
  // silhouette instead of plain rectangle). Shape +X maps to world +Z
  // (aft) after rotation.y = -π/2.
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.40, 0.00);    // forward base (LE bottom)
  finShape.lineTo(+0.40, 0.00);    // aft base (TE bottom)
  finShape.lineTo(+0.40, 0.78);    // TE upper
  finShape.lineTo(+0.25, 0.98);    // top aft (rounded corner)
  finShape.lineTo( 0.00, 1.08);    // top apex
  finShape.lineTo(-0.25, 0.98);    // top forward (rounded corner)
  finShape.lineTo(-0.40, 0.78);    // LE upper
  finShape.lineTo(-0.40, 0.00);    // back to base
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  const tailV = new THREE.Mesh(finGeo, mat(SILVER));
  tailV.rotation.y = -Math.PI / 2;
  tailV.position.set(0.05, 0.05, 2.40);
  g.add(tailV);

  // Cockpit hole — dark recess just behind the upper wing's trailing edge.
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.7), mat(DARK));
  cockpit.position.set(0, 0.30, -0.5);
  g.add(cockpit);

  // RAF rudder stripes — three vertical color panels (red forward,
  // white middle, blue aft) wrapping the back of the vertical fin.
  const stripeH = 1.00;
  const stripeW = 0.12;
  const stripeT = 0.14;            // slightly wider than fin (0.10) so they wrap
  const rudderColors = [RAF_RED, RAF_WHITE, RAF_BLUE];
  for (let i = 0; i < 3; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(stripeT, stripeH, stripeW), mat(rudderColors[i]),
    );
    panel.position.set(0, 0.55, 2.40 + i * stripeW);
    g.add(panel);
  }

  // RAF roundels — upper wing top and lower wing bottom, L+R. Place just
  // proud of the wing surface (top at y=1.18 for upper, bottom at -0.33
  // for lower).
  for (const sx of [-3.0, 3.0]) {
    const r = makeRoundel(THREE, 1.0);
    r.position.set(sx, 1.19, -1.5);
    g.add(r);
  }
  for (const sx of [-3.0, 3.0]) {
    const r = makeRoundel(THREE, 1.0);
    r.rotation.z = Math.PI;
    r.position.set(sx, -0.34, -1.2);
    g.add(r);
  }

  // Landing gear — two yellow main wheels on vertical steel struts.
  // Wheels positioned forward of the lower wing under the engine area.
  // CylinderGeometry rotated so the wheel disc face points along world X
  // (axle horizontal across the plane).
  const wheelGeo = new THREE.CylinderGeometry(0.30, 0.30, 0.12, 14);
  for (const sx of [-0.85, 0.85]) {
    const wheel = new THREE.Mesh(wheelGeo, mat(YELLOW));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, -1.10, -1.60);
    g.add(wheel);
  }
  // Wheel struts — vertical posts from each wheel up to the fuselage
  // underside (body radius at z=-1.6 is ~0.44, so the strut top sits at
  // y ≈ -0.44).
  const wheelStrutGeo = new THREE.BoxGeometry(0.06, 0.70, 0.06);
  for (const sx of [-0.85, 0.85]) {
    const strut = new THREE.Mesh(wheelStrutGeo, mat(STEEL));
    strut.position.set(sx, -0.75, -1.60);
    g.add(strut);
  }
  // Diagonal cross-braces — inboard top to outboard bottom of each strut,
  // for the classic V-strut undercarriage look.
  const braceGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  for (const sx of [-1, 1]) {
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.05, 0.05), mat(STEEL),
    );
    brace.position.set(sx * 0.45, -0.80, -1.60);
    brace.rotation.z = sx * Math.atan2(-0.30, 0.85);
    g.add(brace);
  }

  return g;
}

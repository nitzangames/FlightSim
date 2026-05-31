// Faceted lowpoly Fairey Flycatcher — early-1930s British Fleet Air Arm
// biplane fighter. Bare-metal silver with a yellow fuselage stripe, RAF
// roundels on the wings, and red/white/blue rudder stripes. Bristol Jupiter
// radial engine with 7 visible cylinder bumps at the cowling.

const SILVER   = 0xc6cbd4;   // bare aluminum fuselage + wings + tail
const YELLOW   = 0xf2c33a;   // fuselage side stripe
const BROWN    = 0x4d3826;   // wood prop + struts
const STEEL    = 0x46474d;   // engine cylinder details
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

  // Bristol Jupiter radial engine — 7 small cylinder "heads" arranged
  // around the cowling perimeter at the front face. Each cylinder is a
  // short steel cone aimed forward, suggesting the cooling fins of the
  // engine cylinder heads.
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const r = 0.40;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.20, 6), mat(STEEL));
    cyl.rotation.x = Math.PI / 2;
    cyl.position.set(Math.cos(angle) * r, Math.sin(angle) * r, -3.05);
    g.add(cyl);
  }
  // Engine hub — dark disc at the very front, centered, suggesting the
  // dark interior of the engine cowling.
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.30, 16), mat(DARK));
  hub.rotation.y = Math.PI;
  hub.position.z = -3.10;
  g.add(hub);

  // Propeller — brown wood two-blade bar.
  const propGroup = new THREE.Group();
  propGroup.position.z = -3.20;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.10, 0.10), mat(BROWN));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Lower wing — silver. Slightly narrower than the upper wing per the
  // Fairey Flycatcher's slight wing stagger.
  const lowerWing = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.16, 1.4), mat(SILVER));
  lowerWing.position.set(0, -0.25, -1.2);
  g.add(lowerWing);

  // Upper wing — silver, wider span and slightly forward.
  const upperWing = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.16, 1.4), mat(SILVER));
  upperWing.position.set(0, 1.10, -1.5);
  g.add(upperWing);

  // Wing struts — brown wooden Vs between the wings, two per side.
  const strutGeo = new THREE.BoxGeometry(0.08, 1.35, 0.08);
  for (const sx of [-3.0, -1.2, 1.2, 3.0]) {
    for (const sz of [-1.55, -0.85]) {
      const strut = new THREE.Mesh(strutGeo, mat(BROWN));
      strut.position.set(sx, 0.42, sz);
      g.add(strut);
    }
  }

  // Tail horizontal stabilizer.
  const tailH = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.10, 0.7), mat(SILVER));
  tailH.position.set(0, 0.05, 2.4);
  g.add(tailH);

  // Tail vertical fin.
  const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.0, 0.7), mat(SILVER));
  tailV.position.set(0, 0.55, 2.4);
  g.add(tailV);

  // Cockpit hole — dark recess just behind the upper wing's trailing edge.
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.7), mat(DARK));
  cockpit.position.set(0, 0.30, -0.5);
  g.add(cockpit);

  // Yellow fuselage stripe — horizontal band along each side of the
  // body. Sits at world Y=0 (centerline) where the body radius is ~0.42.
  // A thin BoxGeometry on each side, proud of the body so it reads
  // clearly without z-fighting.
  const stripeGeo = new THREE.BoxGeometry(0.04, 0.18, 4.50);
  for (const sx of [-0.43, 0.43]) {
    const stripe = new THREE.Mesh(stripeGeo, mat(YELLOW));
    stripe.position.set(sx, 0.05, 0.30);
    g.add(stripe);
  }

  // RAF rudder stripes — three vertical color panels (red forward,
  // white middle, blue aft) covering the back of the vertical fin.
  // Fin spans z ∈ [2.05, 2.75], y ∈ [0.05, 1.05]. Stripes overlap the
  // fin surface on both sides.
  const stripeH = 1.00;
  const stripeW = 0.12;
  const stripeT = 0.14;            // slightly wider than fin (0.10) so they wrap
  const rudderColors = [RAF_RED, RAF_WHITE, RAF_BLUE];
  for (let i = 0; i < 3; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(stripeT, stripeH, stripeW), mat(rudderColors[i]),
    );
    // Stripes run from z=2.40 (forward) to z=2.76 (aft), 0.12 wide each
    panel.position.set(0, 0.55, 2.40 + i * stripeW);
    g.add(panel);
  }

  // RAF roundels — upper wing top and lower wing bottom, L+R. Wing
  // boxes have thickness 0.16 → top/bottom surfaces at y ± 0.08
  // relative to the wing's position.y. Place insignia just proud.
  for (const sx of [-3.0, 3.0]) {
    const r = makeRoundel(THREE, 1.0);
    r.position.set(sx, 1.10 + 0.09, -1.5);   // upper wing TOP (y=1.18)
    g.add(r);
  }
  for (const sx of [-3.0, 3.0]) {
    const r = makeRoundel(THREE, 1.0);
    r.rotation.z = Math.PI;                   // flip so it faces down
    r.position.set(sx, -0.25 - 0.09, -1.2);   // lower wing BOTTOM (y=-0.34)
    g.add(r);
  }

  return g;
}

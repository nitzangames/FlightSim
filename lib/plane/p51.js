// Faceted lowpoly P-51D Mustang — WW2 long-range escort fighter.
// In-line V-12 Merlin → long nose, bubble canopy aft of the wings,
// signature belly radiator scoop. ~11 m wingspan, ~11 m length.
// Livery: bare-metal silver body with yellow spinner + cowling band.

const SILVER   = 0xc6cbd4;
const YELLOW   = 0xf2c33a;
const SCOOP    = 0xb8bdc6;
const CANOPY   = 0x2a3340;
const DARK     = 0x1c1c20;

const US_BLUE  = 0x1a3a7a;
const US_WHITE = 0xeaeaea;
const US_RED   = 0xb21a1a;

// US star-and-bar (post-1947 style). Stacked planar pieces with small Y
// offsets to avoid z-fighting. Returned group lies in the XZ plane (facing
// +Y) by default; rotate it on the caller side to place on wing top/bottom
// or fuselage sides. The `diameter` argument sizes the blue disc; bars and
// red stripe scale with it.
function makeStarBar(THREE, diameter) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  const r = diameter / 2;

  // 1) Blue disc (outer circle of the star).
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat(US_BLUE));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.000;
  g.add(disc);

  // 2) White 5-point star inside, points outward.
  const starShape = new THREE.Shape();
  const outer = r * 0.85;
  const inner = r * 0.34;
  for (let i = 0; i < 10; i++) {
    const radius = (i % 2 === 0) ? outer : inner;
    // Start at top point so the star is upright in XZ.
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

  // 3) White bars on each side of the disc.
  //    Bar length ~ disc diameter; bar height ~ 0.5 of disc radius.
  const barLen = diameter * 1.0;
  const barH   = r * 0.66;
  // Pull bar inner edges ~10% inside the disc so they overlap and the
  // junction reads as one piece rather than a hairline seam.
  const barOffset = r * 0.90 + barLen / 2;
  for (const sx of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(barLen, barH), mat(US_WHITE));
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(sx * barOffset, 0.002, 0);
    g.add(bar);
  }

  // 4) Red horizontal stripe through both bars. Two segments (one over
  //    each bar) so the stripe doesn't draw through the blue disc.
  const stripeH = barH * 0.33;
  for (const sx of [-1, 1]) {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(barLen, stripeH), mat(US_RED));
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(sx * barOffset, 0.004, 0);
    g.add(seg);
  }

  return g;
}

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

  // Spinner — pointed yellow cone, base buried inside the cowling band so
  // the cone and cowling read as one continuous yellow nose. Modest 1.3
  // length keeps the nose proportional to the rest of the plane.
  // openEnded: true skips the back-cap face (hidden inside cylinder).
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.3, 10, 1, true), mat(YELLOW));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -5.80;
  g.add(spinner);

  // Propeller — single bar mesh in a group so the chase loop can spin it.
  const propGroup = new THREE.Group();
  propGroup.position.z = -6.50;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.10), mat(DARK));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Wings — full-span ExtrudeGeometry, smooth single-taper P-51 planform:
  // STRAIGHT leading edge across the entire span, FLAT (vertical) tip
  // edges on both sides, trailing edge sweeps forward from each tip to
  // the root center. Symmetric L/R, no tip arcs.
  const SPAN = 11.0;
  const ROOT_TRAIL = 1.6;   // trailing-edge offset from wing midline at root
  const TIP_HALF   = 0.45;  // tip chord half-width (LE at +TIP_HALF, TE at -TIP_HALF)
  const TIP_X      = SPAN / 2;
  const wingShape = new THREE.Shape();
  // Walk counter-clockwise from the left trailing-tip corner.
  wingShape.moveTo(-TIP_X, -TIP_HALF);   // left trailing-tip corner
  wingShape.lineTo(-TIP_X,  TIP_HALF);   // flat left tip (vertical line)
  wingShape.lineTo( TIP_X,  TIP_HALF);   // straight leading edge across span
  wingShape.lineTo( TIP_X, -TIP_HALF);   // flat right tip (vertical line)
  // Trailing edge sweeps forward from right tip → root center → left tip
  // (single kink at the centerline of symmetry is natural).
  wingShape.lineTo(0, -ROOT_TRAIL);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.20, bevelEnabled: false });
  const wing = new THREE.Mesh(wingGeo, mat(SILVER));
  wing.rotation.x = -Math.PI / 2;
  // Low-wing mount: wing root attaches at the underside of the fuselage.
  wing.position.set(0, -0.45, -0.3);
  g.add(wing);

  // Bubble canopy — sits on top of the fuselage just aft of the wing root.
  // The lathe body's radius at z=0.4 is ~0.56, so a canopy base at y≈0.5
  // is flush with the spine. Stretched along Z for the teardrop look.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.50, 0.6);
  canopy.scale.set(0.9, 1.0, 2.2);
  g.add(canopy);

  // Belly radiator scoop — shaped duct with a SLOPED top: top-rear is
  // high (embedded deep into the fuselage = body fairing), top-front
  // drops below the fuselage underside (creating the visible intake
  // mouth opening between body and scoop front). Bottom is horizontal
  // (radiator outlet face).
  //
  // Shape coords: shapeX = world Z (front-back), shapeY = world Y (up-down).
  // After mesh.rotation.y = -π/2, shape extrude direction → world -X,
  // so depth (0.85) becomes scoop width. Position offsets:
  //   position.x = +0.425 (centers extrude depth around world X=0)
  //   position.y = -0.78  (shape Y=0 at world Y=-0.78, scoop top edge varies)
  //   position.z =  0.6
  // Body underside Y at scoop-front z≈-0.25 is ~-0.59; at scoop-rear z≈1.45
  // is ~-0.50. Top-rear at world Y=-0.33 embeds 0.17 into body. Top-front
  // at world Y=-0.63 sits ~0.04 below body underside → visible intake gap.
  const scoopShape = new THREE.Shape();
  scoopShape.moveTo(-0.55, 0.00);   // bottom-forward (radiator outlet front edge)
  scoopShape.lineTo( 0.55, 0.00);   // bottom-rear (radiator outlet back edge)
  scoopShape.lineTo( 0.85, 0.45);   // angled rear fairing → top-rear (embedded in body)
  scoopShape.lineTo(-0.85, 0.15);   // sloped top → top-forward (drops below body for intake)
  // ExtrudeGeometry implicitly closes via the front intake-lip face.
  const scoopGeo = new THREE.ExtrudeGeometry(scoopShape, { depth: 0.85, bevelEnabled: false });
  const scoop = new THREE.Mesh(scoopGeo, mat(SCOOP));
  scoop.rotation.y = -Math.PI / 2;
  scoop.position.set(0.425, -0.78, 0.6);
  g.add(scoop);

  // Horizontal stabilizer — tapered trapezoid per side (straight leading
  // edge, gently swept trailing edge). Built as one ExtrudeGeometry then
  // mirrored.
  const stabShape = new THREE.Shape();
  stabShape.moveTo(0.00,  0.50);   // root leading edge
  stabShape.lineTo(1.70,  0.20);   // tip leading edge
  stabShape.lineTo(1.70, -0.20);   // tip trailing edge
  stabShape.lineTo(0.00, -0.50);   // root trailing edge
  stabShape.lineTo(0.00,  0.50);
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(SILVER));
    s.scale.x = side;
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.10, 3.2);
    g.add(s);
  }

  // Vertical fin — P-51D silhouette: vertical trailing edge, curved leading
  // edge that begins as a long shallow dorsal fillet ramping up off the
  // fuselage spine, then a smoothly rounded top, then back down the
  // vertical trailing edge. Shape coords: after fin.rotation.y = π/2,
  // shape +X → world -Z (forward), shape +Y → world Y (up).
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.55, 0.00);   // base aft (trailing-edge bottom)
  finShape.lineTo( 0.90, 0.00);   // base forward (extends far forward for dorsal fillet)
  // Curved leading edge sweeping forward → up → aft
  finShape.lineTo( 0.50, 0.45);   // dorsal fillet ramp up
  finShape.lineTo( 0.20, 0.95);   // mid leading edge
  finShape.lineTo( 0.00, 1.30);   // upper leading edge
  // Rounded top apex
  finShape.lineTo(-0.20, 1.40);   // top forward corner
  finShape.lineTo(-0.55, 1.30);   // top aft corner
  // Vertical trailing edge back to base
  finShape.lineTo(-0.55, 0.00);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  const fin = new THREE.Mesh(finGeo, mat(SILVER));
  fin.rotation.y = Math.PI / 2;
  fin.position.set(0, 0.10, 3.0);
  g.add(fin);

  // US star-and-bar insignia.
  // Wings: diameter 0.8 (proportional to wing chord ~1.4 at x=±3.2). Top +
  // bottom faces. The wing extrudes along local +Z which maps to world +Y
  // after the -π/2 X rotation, so the wing occupies y ∈ [-0.45, -0.25].
  // Top surface = -0.25, bottom = -0.45. Place insignia just proud.
  for (const sx of [-3.2, 3.2]) {
    const ins = makeStarBar(THREE, 0.8);
    ins.position.set(sx, -0.23, -0.3);
    g.add(ins);
  }
  for (const sx of [-3.2, 3.2]) {
    const ins = makeStarBar(THREE, 0.8);
    ins.rotation.z = Math.PI;          // flip so the star faces down
    ins.position.set(sx, -0.47, -0.3);
    g.add(ins);
  }
  // Fuselage sides at z=1.3 (mid-aft). Default helper orientation has the
  // disc facing +Y with bars along ±X. We need the disc facing ±X (side of
  // body) and bars HORIZONTAL along world Z (front-back). Nested groups
  // give a clean ordered composition: inner rotates bars from ±X to ±Z,
  // outer rotates disc normal from +Y to ±X.
  for (const side of [-1, 1]) {
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    const ins = makeStarBar(THREE, 0.55);
    inner.add(ins);
    inner.rotation.y = -side * Math.PI / 2;   // bars ±X → ±Z (still horizontal after outer)
    outer.add(inner);
    outer.rotation.z = -side * Math.PI / 2;   // disc normal +Y → ±X
    outer.position.set(side * 0.52, 0.05, 1.3);
    g.add(outer);
  }

  return g;
}

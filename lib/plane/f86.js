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

const US_BLUE  = 0x1a3a7a;
const US_WHITE = 0xeaeaea;
const US_RED   = 0xb21a1a;

// US star-and-bar (post-1947 style). Stacked planar pieces with small Y
// offsets to avoid z-fighting. Returned group lies in the XZ plane (facing
// +Y) by default; rotate it on the caller side to place on wing top or
// fuselage sides. Duplicated from lib/plane/p51.js per design decision
// to keep each plane module self-contained.
function makeStarBar(THREE, diameter) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  const r = diameter / 2;

  // 1) Blue disc (outer circle of the star).
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat(US_BLUE));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.000;
  g.add(disc);

  // 2) White 5-point star inside, point upward.
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

  // 3) White bars on each side of the disc. Pull bar inner edges 10%
  //    inside the disc so they overlap and the junction reads as one piece.
  const barLen = diameter;
  const barH   = r * 0.66;
  const barOffset = r * 0.90 + barLen / 2;
  for (const sx of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(barLen, barH), mat(US_WHITE));
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(sx * barOffset, 0.002, 0);
    g.add(bar);
  }

  // 4) Red horizontal stripe through both bars. Two segments (one per bar)
  //    so the stripe doesn't draw through the blue disc.
  const stripeH = barH * 0.33;
  for (const sx of [-1, 1]) {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(barLen, stripeH), mat(US_RED));
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(sx * barOffset, 0.004, 0);
    g.add(seg);
  }

  return g;
}

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

  // Intake mouth — dark disc recessed inside the front opening, faces
  // forward (world -Z). Noticeably smaller than the mouth radius (0.55)
  // and pushed back from the lip so the body reads as a thick silver
  // ring and the intake feels like a hole in the nose, not the whole nose.
  const intake = new THREE.Mesh(new THREE.CircleGeometry(0.40, 16), mat(INTAKE));
  intake.rotation.y = Math.PI;
  intake.position.z = -3.80;
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
  // Engine plume anchor — read by the shell to place the flame cone. Tied to
  // the exhaust-hole mesh so the flame can't drift from the nozzle.
  g.userData.nozzles = [{ x: 0, y: 0, z: exhaustHole.position.z }];

  // Bubble canopy — forward-mounted teardrop. Body radius at z=-2.2 is
  // ~0.61, so a canopy base at y≈0.55 sits just above the spine.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(CANOPY),
  );
  canopy.position.set(0, 0.55, -2.20);
  canopy.scale.set(0.85, 1.0, 1.7);
  g.add(canopy);

  // Wings — one swept-tapered shape per side, mirrored. Shape coords:
  // shape +X = outboard (wingspan), shape +Y = forward (after the wing's
  // -π/2 X rotation, shape +Y → world -Z = forward of plane).
  // Sweep ~35° back at the leading edge means the tip LE is AFT of the
  // root LE (lower Y in shape coords). Root chord 2.5 → tip chord 1.0,
  // rounded tip via a short arc.
  const ROOT_CHORD = 2.5;
  const TIP_CHORD  = 1.0;
  const SEMI_SPAN  = 3.8;          // root-to-tip distance, one side
  const SWEEP_LE   = 35 * Math.PI / 180;
  const TIP_RADIUS = 0.20;         // small arc radius at the tip
  const N_TIP      = 6;            // arc segments
  const LE_ROOT_Y = ROOT_CHORD / 2;
  const LE_TIP_Y  = LE_ROOT_Y - SEMI_SPAN * Math.tan(SWEEP_LE);
  const TE_ROOT_Y = -ROOT_CHORD / 2;
  const TE_TIP_Y  = LE_TIP_Y - TIP_CHORD;
  const wingShape = new THREE.Shape();
  // Walk counter-clockwise starting at root trailing-edge corner.
  wingShape.moveTo(0.0,        TE_ROOT_Y);
  wingShape.lineTo(0.0,        LE_ROOT_Y);
  wingShape.lineTo(SEMI_SPAN,  LE_TIP_Y);
  // Rounded tip — half-ellipse from LE tip corner (theta=+π/2) to TE tip corner (theta=-π/2).
  for (let i = 1; i < N_TIP; i++) {
    const t = i / N_TIP;
    // Arc center at (SEMI_SPAN, (LE_TIP_Y + TE_TIP_Y) / 2), sweeping
    // outboard from leading edge to trailing edge.
    const theta = Math.PI / 2 - t * Math.PI;
    const cx = SEMI_SPAN;
    const cy = (LE_TIP_Y + TE_TIP_Y) / 2;
    const x = cx + TIP_RADIUS * Math.cos(theta);
    const y = cy + ((LE_TIP_Y - TE_TIP_Y) / 2) * Math.sin(theta);
    wingShape.lineTo(x, y);
  }
  wingShape.lineTo(SEMI_SPAN,  TE_TIP_Y);
  wingShape.lineTo(0.0,        TE_ROOT_Y);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(SILVER));
    w.scale.x = side;
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, -0.25, -0.5);
    g.add(w);
  }

  // Horizontal stabilizers — swept tapered trapezoids per side, mirrored.
  // Conventional mount (low, attached to rear fuselage near fin base).
  // Shape coords: +X outboard, +Y forward.
  const stabShape = new THREE.Shape();
  stabShape.moveTo(0.00,  0.40);   // root LE
  stabShape.lineTo(1.50, -0.05);   // tip LE (swept back ~30°)
  stabShape.lineTo(1.50, -0.40);   // tip TE
  stabShape.lineTo(0.00, -0.40);   // root TE
  stabShape.lineTo(0.00,  0.40);
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(SILVER));
    s.scale.x = side;
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.10, 3.00);
    g.add(s);
  }

  // Vertical fin — swept-back tall fin with a rounded top. Shape coords
  // (after fin.rotation.y = π/2): +X = forward, +Y = up.
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.55, 0.00);   // base aft (trailing edge bottom)
  finShape.lineTo( 0.95, 0.00);   // base forward (dorsal fillet extension)
  finShape.lineTo( 0.55, 0.55);   // dorsal fillet ramp up
  finShape.lineTo( 0.10, 1.10);   // mid leading edge
  finShape.lineTo(-0.15, 1.45);   // upper leading edge
  finShape.lineTo(-0.40, 1.50);   // top apex (forward)
  finShape.lineTo(-0.55, 1.40);   // top aft corner
  finShape.lineTo(-0.55, 0.00);   // vertical trailing edge back to base
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: false });
  const fin = new THREE.Mesh(finGeo, mat(SILVER));
  fin.rotation.y = Math.PI / 2;
  fin.position.set(0, 0.30, 3.10);
  g.add(fin);

  // Yellow accent bands. The fuselage rings use a short cylinder
  // slightly proud of the body radius at each Z station; the wingtip
  // and fin bands are small boxes attached to the relevant surfaces.

  // Nose band — wraps the fuselage just aft of the intake. Body radius
  // at z=-3.0 is ~0.60; band radius 0.63 sits slightly proud.
  const noseBand = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.30, 14), mat(YELLOW));
  noseBand.rotation.x = Math.PI / 2;
  noseBand.position.z = -3.00;
  g.add(noseBand);

  // Mid-fuselage band — wraps the body mid-aft. Body radius at z=0.5 is
  // ~0.59; band radius 0.62 sits slightly proud.
  const midBand = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.30, 14), mat(YELLOW));
  midBand.rotation.x = Math.PI / 2;
  midBand.position.z = 0.50;
  g.add(midBand);

  // Wingtip bands — yellow chunks on the outboard edge of each wing.
  // Wings extrude from local y=0 to y=0.18 along their own Y axis
  // (which becomes world +Y up after the -π/2 X rotation). Wing tip
  // at world X = ±SEMI_SPAN = ±3.8, height range world y ∈ [-0.25, -0.07].
  const tipBandGeo = new THREE.BoxGeometry(0.30, 0.20, 0.9);
  for (const sx of [-3.75, 3.75]) {
    const tipBand = new THREE.Mesh(tipBandGeo, mat(YELLOW));
    // Y centered between wing top (-0.07) and bottom (-0.25).
    // Z = +1.41 = mid-chord at the wing tip (LE at z=+0.91, TE at z=+1.91).
    // X = ±3.75 wraps the band over the tip (semi-span = 3.80).
    tipBand.position.set(sx, -0.16, 1.41);
    g.add(tipBand);
  }

  // Fin band — yellow strip wrapping the upper portion of the fin.
  // Fin extends roughly z ∈ [3.10 - 0.55, 3.10 + 0.95] = [2.55, 4.05]
  // along world Z, and y ∈ [0.30, 0.30 + 1.50] = [0.30, 1.80].
  const finBand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.30, 0.6), mat(YELLOW));
  finBand.position.set(0, 1.30, 3.10);
  g.add(finBand);

  // US star-and-bar insignia. Wing tops only (no bottom, per design).
  // Wing extrudes from local y=0 to y=0.18 along its own Y, which maps
  // to world +Y after the -π/2 X rotation; with wing.position.y=-0.25
  // the wing occupies world y ∈ [-0.25, -0.07]. Top surface = -0.07.
  for (const sx of [-2.2, 2.2]) {
    const ins = makeStarBar(THREE, 0.7);
    ins.position.set(sx, -0.05, 0.6);
    g.add(ins);
  }
  // Fuselage sides at z=1.8 (aft of mid-band). Nested Groups: inner Y
  // rotation keeps bars along world Z (horizontal) after the outer Z
  // rotation puts the disc face on the body side.
  for (const side of [-1, 1]) {
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    const ins = makeStarBar(THREE, 0.45);
    inner.add(ins);
    inner.rotation.y = -side * Math.PI / 2;
    outer.add(inner);
    outer.rotation.z = -side * Math.PI / 2;
    outer.position.set(side * 0.55, 0.05, 1.80);
    g.add(outer);
  }

  return g;
}

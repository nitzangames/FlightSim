// Lockheed Martin F-22 Raptor — 5th-gen stealth air-superiority fighter.
// Faceted lowpoly: wide chined blended body, clipped-diamond wings and
// stabilators, twin canted vertical tails, caret intakes, gold canopy,
// twin thrust-vectoring nozzles. Nose points -Z, exhaust +Z.

const GREY     = 0x6b7280;   // medium stealth grey (upper body / nose)
const GREY_DK  = 0x4b525c;   // darker grey (wings / tails / lower)
const GREY_LT  = 0x828a96;   // lighter highlight panels
const STEEL    = 0x3a3d44;   // nozzle cans
const CANOPY   = 0x2e4d72;   // blue-tinted canopy glass
const EXH      = 0x0e0e0e;   // exhaust black

export function buildF22(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // --- Chined blended fuselage -----------------------------------------
  // Hexagonal cross-section (flat belly, sharp side chines, flat-ish top)
  // extruded along Z. Wide and flat — the F-22's diamond body.
  // Narrow + flat: the wide flat planform comes from the blended panels
  // below; this deck just adds height (canopy/spine) on top of them.
  const bodyCS = new THREE.Shape();
  bodyCS.moveTo(-0.92, -0.30);   // belly left
  bodyCS.lineTo( 0.92, -0.30);   // belly right
  bodyCS.lineTo( 1.20,  0.02);   // right chine
  bodyCS.lineTo( 0.56,  0.30);   // right shoulder
  bodyCS.lineTo(-0.56,  0.30);   // left shoulder
  bodyCS.lineTo(-1.20,  0.02);   // left chine
  bodyCS.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(bodyCS, { depth: 7.0, bevelEnabled: false });
  const body = new THREE.Mesh(bodyGeo, mat(GREY));
  body.position.set(0, 0, -2.6);   // extrude grows +Z; front face at z=-2.6
  g.add(body);

  // Darker belly underlay (reads as lower fuselage / weapons-bay line)
  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 6.4), mat(GREY_DK));
  belly.position.set(0, -0.40, 0.4);
  g.add(belly);

  // --- Chined nose (lofted from the body's exact cross-section) --------
  // Tapering the SAME hexagon the body uses means the facets line up with the
  // body at the junction — no weird step/twist where the nose meets the body.
  {
    const profile = [           // = bodyCS vertices (belly→chine→shoulder…)
      [-0.92, -0.30], [0.92, -0.30], [1.20, 0.02],
      [0.56, 0.30], [-0.56, 0.30], [-1.20, 0.02],
    ];
    const rings = [             // {z, scale} — full size at the body, → tip
      { z: -2.55, s: 1.00 },    // shares the body front face (seamless)
      { z: -3.60, s: 0.82 },
      { z: -4.55, s: 0.54 },
      { z: -5.30, s: 0.30 },
    ];
    const tip = [0, -0.02, -5.95];
    const n = profile.length;
    const pt = (r, i) => [profile[i][0] * r.s, profile[i][1] * r.s, r.z];
    const v = [];
    for (let r = 0; r < rings.length - 1; r++) {
      const a = rings[r], b = rings[r + 1];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const a0 = pt(a, i), a1 = pt(a, j), b0 = pt(b, i), b1 = pt(b, j);
        v.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
      }
    }
    const last = rings[rings.length - 1];   // tip cap
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      v.push(...pt(last, i), ...tip, ...pt(last, j));
    }
    const noseGeo = new THREE.BufferGeometry();
    noseGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    noseGeo.computeVertexNormals();
    g.add(new THREE.Mesh(noseGeo, mat(GREY)));
  }
  // Pitot probe
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), mat(STEEL));
  probe.rotation.x = -Math.PI / 2;
  probe.position.set(0, -0.02, -5.9);
  g.add(probe);

  // --- Bubble canopy (blue-tinted glass), set forward -----------------
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(CANOPY),
  );
  canopy.position.set(0, 0.36, -1.75);
  canopy.scale.set(0.80, 1.0, 2.5);
  g.add(canopy);

  // --- Caret intakes (lower side, below wing roots) --------------------
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.7), mat(GREY_DK));
    intake.position.set(side * 1.08, -0.16, -1.1);
    intake.rotation.y = side * 0.10;     // slight toe-in
    g.add(intake);
    // Caret mouth — dark slanted face
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.46), mat(EXH));
    mouth.position.set(side * 1.12, -0.16, -1.95);
    mouth.rotation.y = Math.PI + side * 0.10;
    mouth.rotation.z = side * 0.5;       // caret slant
    g.add(mouth);
  }

  // --- Blended planform panel (chine + wing as ONE continuous piece) ----
  // The F-22's signature: a single unbroken leading edge that sweeps from the
  // nose chine, out through the intake shoulder, and on to the wingtip — wing
  // and body are one flat diamond, NOT a tube with bolted-on wings.
  // shape coords (spanX, foreY): foreY+ = forward (-Z). Mirror via scale.x.
  const panelShape = new THREE.Shape();
  panelShape.moveTo(0.0,  4.3);    // inboard, near nose (hidden under body)
  panelShape.lineTo(1.2,  2.8);    // chine emerges alongside the forebody
  panelShape.lineTo(1.7,  0.6);    // widest chine shoulder (intake area)
  panelShape.lineTo(4.3, -1.7);    // wing LE tip (continuous sweep, slight kink)
  panelShape.lineTo(4.0, -2.4);    // wingtip — short raked clipped tip
  panelShape.lineTo(1.1, -3.2);    // wing root TE (forward-swept trailing edge)
  panelShape.lineTo(0.0, -3.4);    // inboard tail (hidden under body)
  panelShape.closePath();
  const panelGeo = new THREE.ExtrudeGeometry(panelShape, { depth: 0.16, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(panelGeo, mat(GREY));
    p.scale.x = side;
    p.rotation.x = -Math.PI / 2;
    p.position.set(0, -0.04, 0.0);
    g.add(p);
  }

  // --- Clipped-diamond stabilators (rear, all-moving) ------------------
  // Stealth planform alignment: LE parallel to the wing LE (~42° sweep), TE
  // parallel to the wing TE (~15° fwd sweep), short raked tip. Root mounts at
  // the outboard edge of the engine nacelles (x≈0.9) — clear of the engines.
  // 5-sided: LE, two-facet raked tip (pointed), TE, root edge.
  const stabShape = new THREE.Shape();
  stabShape.moveTo(0.0,   0.5);    // root LE
  stabShape.lineTo(2.15, -1.40);   // tip LE corner (LE swept ~42°, ∥ wing LE)
  stabShape.lineTo(1.95, -1.85);   // tip outer corner (short outer edge)
  stabShape.lineTo(1.10, -1.95);   // tip TE corner (raked aft edge angles inboard)
  stabShape.lineTo(0.0,  -1.25);   // root TE (TE swept fwd ~15°, ∥ wing TE)
  stabShape.closePath();
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.12, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(GREY_DK));
    s.scale.x = side;
    s.rotation.x = -Math.PI / 2;
    s.position.set(side * 0.92, -0.02, 3.80);   // root LE z=3.3 (∥, just aft of wing TE)
    g.add(s);
  }

  // --- Twin canted vertical tails --------------------------------------
  // side-profile trapezoid (foreY, height), extruded thin, then canted out.
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.35, 0.0);    // base leading
  finShape.lineTo(-0.55, 1.85);   // peak (top leading)
  finShape.lineTo( 0.55, 1.65);   // top trailing
  finShape.lineTo( 1.0,  0.0);    // base trailing
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  finGeo.translate(0, 0, -0.05);
  const cant = 28 * Math.PI / 180;
  // Each fin goes in a Group: the fin mesh carries the chord orientation
  // (rotation.y) while the GROUP's roll (rotation.z) is applied LAST in world
  // frame, so the top cants outward along world X. Negative roll on the +X
  // side → top tilts +X (outward).
  for (const side of [-1, 1]) {
    const finGroup = new THREE.Group();
    finGroup.position.set(side * 0.50, 0.18, 3.05);   // base on the body shoulder
    finGroup.rotation.z = -side * cant;  // cant outward ~28deg
    g.add(finGroup);

    const fin = new THREE.Mesh(finGeo, mat(GREY_DK));
    fin.rotation.y = -Math.PI / 2;       // align fin chord along Z
    finGroup.add(fin);
  }

  // --- Twin 2D (rectangular) thrust-vectoring nozzles ------------------
  // F119 nozzles set INTO the rear fuselage (not round tubes), recessed so the
  // stabilators extend well aft of the exhaust, each ending in a SINGLE
  // sawtooth chevron (one tooth per engine).
  const FRONT = 0.5, BASE = -0.3, TIP = -0.55, HW = 0.28;
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-HW, FRONT);
  deckShape.lineTo( HW, FRONT);
  deckShape.lineTo( HW, BASE);
  deckShape.lineTo(  0, TIP);            // single aft chevron point
  deckShape.lineTo(-HW, BASE);
  deckShape.closePath();
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 0.06, bevelEnabled: false });
  for (const sx of [-0.32, 0.32]) {
    // Rectangular nozzle housing, tucked into the body.
    const noz = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.50, 1.6), mat(GREY_DK));
    noz.position.set(sx, -0.06, 3.9);    // z ≈ 3.1 → 4.7
    g.add(noz);
    // Metal nozzle ring
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.44, 0.28), mat(STEEL));
    lip.position.set(sx, -0.06, 4.6);
    g.add(lip);
    // Dark rectangular exhaust exit
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.34), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(sx, -0.06, 4.72);
    g.add(hole);
    // Single sawtooth chevron deck (top + bottom), pointing aft at the exit.
    for (const sy of [0.18, -0.34]) {
      const deck = new THREE.Mesh(deckGeo, mat(GREY));
      deck.rotation.x = -Math.PI / 2;
      deck.position.set(sx, sy, 4.15);   // chevron tip at z≈4.7
      g.add(deck);
    }
  }

  return g;
}

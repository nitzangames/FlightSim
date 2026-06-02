// SR-71 Blackbird — Mach 3+ recon.
// Signature features: long pointed nose, forward chines flowing into the
// delta wings, HUGE engine nacelles with spike inlets mounted mid-span,
// twin vertical fins on top of the nacelles canted INWARD (unique).

const BLACK   = 0x1a1a1f;
const DARKER  = 0x0a0a0d;
const CANOPY  = 0x2a3340;
const EXH     = 0x111111;
const STEEL   = 0x3a3a40;

export function buildSR71(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // --- Long slim central body cylinder --------------------------------
  const BODY_R = 0.42;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(BODY_R, BODY_R, 9.5, 14), mat(BLACK),
  );
  body.rotation.x = Math.PI / 2;
  body.position.z = -0.5;
  g.add(body);

  // --- Pointed nose cone (long, very tapered) -------------------------
  const nose = new THREE.Mesh(new THREE.ConeGeometry(BODY_R, 3.0, 14), mat(BLACK));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -6.75;
  g.add(nose);

  // --- Pitot probe — moved back half its length (now half-recessed into the nose).
  const probe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), mat(STEEL),
  );
  probe.rotation.x = -Math.PI / 2;
  probe.position.z = -8.25;   // was -8.55, moved back by 0.3 (half its length)
  g.add(probe);

  // --- Tail cone — extended further out ------------------------------
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(BODY_R, 1.8, 14), mat(BLACK));
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 5.15;   // base at z=4.25, apex at z=6.05 (extends ~0.6 further)
  g.add(tailCone);

  // --- Forward chines — flat plates flowing from nose to wing root ----
  // Shape axes: X=spanwise (outboard), Y=forward chord. After Rx(-π/2),
  // shape +Y → world -Z (forward).
  const chineShape = new THREE.Shape();
  chineShape.moveTo( 0.0,  6.5);   // forward tip (along the nose)
  chineShape.lineTo( 0.85, -1.5);  // outboard rear (merges into wing root area)
  chineShape.lineTo( 0.0, -1.5);   // inboard rear
  chineShape.lineTo( 0.0,  6.5);
  const chineGeo = new THREE.ExtrudeGeometry(chineShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const chine = new THREE.Mesh(chineGeo, mat(BLACK));
    chine.scale.x = side;
    chine.rotation.x = -Math.PI / 2;
    chine.position.set(0, -0.08, 0);
    g.add(chine);
  }

  // --- Delta wings in TWO pieces per side -----------------------------
  // Inner wing (body → nacelle) and outer wing (nacelle → tip) with the
  // engine nacelle in the gap between them.
  // Wing pieces overlap INTO the nacelle (no gaps): the inner wing extends
  // outboard past the nacelle's inboard edge, and the outer wing extends
  // inboard past the nacelle's outboard edge — both reach ~nacelle center.
  const NAC_INBOARD  = 1.575;  // inner wing outboard edge — 25% narrower span; still tucks under nacelle (inboard edge 1.55)
  const NAC_OUTBOARD = 2.1;    // outer wing inboard edge  (= NAC_X, under nacelle)

  // Inner wing piece — TE forward-swept (outboard TE forward of root TE).
  const innerWing = new THREE.Shape();
  innerWing.moveTo( 0.0,  1.5);              // root LE
  innerWing.lineTo( NAC_INBOARD, -0.52);     // outboard LE
  innerWing.lineTo( NAC_INBOARD, -4.50);     // outboard TE (forward-swept, ~14°)
  innerWing.lineTo( 0.0, -5.0);              // root TE (deep back)
  innerWing.lineTo( 0.0,  1.5);
  const innerWingGeo = new THREE.ExtrudeGeometry(innerWing, { depth: 0.18, bevelEnabled: false });

  // Outer wing piece — TE continues forward sweep more aggressively (~25°).
  const outerWing = new THREE.Shape();
  outerWing.moveTo( NAC_OUTBOARD, -1.66);    // inboard LE
  outerWing.lineTo( 3.3, -3.0);              // tip LE — outboard span halved (tip 4.5 -> 3.3)
  outerWing.lineTo( 3.3, -3.5);              // cropped tip TE
  outerWing.lineTo( NAC_OUTBOARD, -4.50);    // inboard TE (matches inner outboard TE)
  outerWing.lineTo( NAC_OUTBOARD, -1.66);
  const outerWingGeo = new THREE.ExtrudeGeometry(outerWing, { depth: 0.18, bevelEnabled: false });

  for (const side of [-1, 1]) {
    const inner = new THREE.Mesh(innerWingGeo, mat(BLACK));
    inner.scale.x = side;
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(0, -0.12, 0);
    g.add(inner);
    const outer = new THREE.Mesh(outerWingGeo, mat(BLACK));
    outer.scale.x = side;
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(0, -0.12, 0);
    g.add(outer);
  }

  // --- Engine nacelles — huge cylinders mid-span on the wings ---------
  const NAC_R   = 0.55;
  const NAC_LEN = 4.5;        // shortened more from the back (was 5.5)
  const NAC_X   = 2.1;        // spanwise position (brought inboard from 2.5)
  const NAC_Y   = -0.20;
  const NAC_Z   = 1.25;       // center Z — back of nacelle at z=3.5, recessed into the wings
  const NAC_FRONT = NAC_Z - NAC_LEN / 2;   // -2.3
  const NAC_BACK  = NAC_Z + NAC_LEN / 2;   // +3.7
  for (const side of [-1, 1]) {
    // Main nacelle cylinder.
    const nac = new THREE.Mesh(
      new THREE.CylinderGeometry(NAC_R, NAC_R, NAC_LEN, 16), mat(BLACK),
    );
    nac.rotation.x = Math.PI / 2;
    nac.position.set(side * NAC_X, NAC_Y, NAC_Z);
    g.add(nac);

    // Dark inlet ring (the open mouth around the spike). Inner radius
    // matches the spike base so they meet cleanly.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.27, NAC_R, 16), mat(EXH));
    ring.rotation.y = Math.PI;
    ring.position.set(side * NAC_X, NAC_Y, NAC_FRONT - 0.005);
    g.add(ring);

    // Inlet spike cone — 50% shorter along Z (length 2.1→1.05); base stays at inlet.
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.27, 1.05, 12), mat(BLACK));
    spike.rotation.x = -Math.PI / 2;
    spike.position.set(side * NAC_X, NAC_Y, NAC_FRONT - 0.525);
    g.add(spike);

    // Exhaust nozzle — BLACK truncated cone: front R=0.50 (joins nacelle),
    // back R=0.34 (smaller outlet, bumped up slightly).
    const EX_LEN = 0.65;
    const exRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, NAC_R - 0.05, EX_LEN, 16), mat(BLACK),
    );
    exRing.rotation.x = Math.PI / 2;
    exRing.position.set(side * NAC_X, NAC_Y, NAC_BACK + EX_LEN / 2);
    g.add(exRing);
    // Dark exhaust hole at the rear outlet (matches the bigger back radius).
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(side * NAC_X, NAC_Y, NAC_BACK + EX_LEN + 0.01);
    g.add(hole);
  }

  // --- Twin vertical fins on top of the nacelles, canted INWARD -------
  // Wrap each fin in a Group so the cant rotation acts in world frame.
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.2, 0.0);    // forward base
  finShape.lineTo(-0.2, 1.5);    // top forward (peak)
  finShape.lineTo( 0.7, 1.35);   // top trailing
  finShape.lineTo( 0.8, 0.0);    // trailing base
  finShape.lineTo(-1.2, 0.0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  finGeo.translate(0, 0, -0.05);
  const FIN_CANT = 0.28;   // ~16° inward at the top
  for (const side of [-1, 1]) {
    const finGroup = new THREE.Group();
    finGroup.position.set(side * NAC_X, NAC_Y + NAC_R, NAC_Z + 1.4);
    // R_z(+θ) on +Y → -X. Right (+X) needs top toward -X (inward), so +rot.
    finGroup.rotation.z = side * FIN_CANT;
    g.add(finGroup);
    const fin = new THREE.Mesh(finGeo, mat(BLACK));
    fin.rotation.y = -Math.PI / 2;
    finGroup.add(fin);
  }

  // --- Bubble canopy (small, low-profile, integrated with spine) ------
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(CANOPY),
  );
  canopy.position.set(0, 0.40, -3.8);
  canopy.scale.set(0.7, 1.0, 2.5);
  g.add(canopy);

  return g;
}

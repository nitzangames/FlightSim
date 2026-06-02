// USAF Thunderbirds F-16C Fighting Falcon — single-engine 4th-gen fighter
// ("Viper"). Air-demonstration livery: white fuselage, blue dorsal spine,
// red wings and vertical tail, white horizontal stabilators, gray radome.

const WHITE     = 0xf0f0f0;   // gloss white fuselage / stabilators
const TB_BLUE   = 0x1a3e8c;   // Thunderbird royal-blue spine
const TB_RED    = 0xcb1f2e;   // Thunderbird red wings / tail
const GRAY_NOSE = 0x6e7176;   // gray radome cone
const INTAKE    = 0x2a2c30;
const STEEL     = 0x40434a;
const EXH       = 0x111111;
const CANOPY    = 0x2a3340;   // dark canopy glass

export function buildF16(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // --- Main fuselage cylinder ------------------------------------------
  // Spans world Z = -3.5 (front shoulder) to +4.5 (exhaust end), R=0.48.
  // scale.x widens the cross-section (oval body, wider than tall).
  const BODY_R = 0.48;
  const BODY_WIDE = 1.35;        // X-axis stretch factor
  const bodyMain = new THREE.Mesh(
    new THREE.CylinderGeometry(BODY_R, BODY_R, 8.0, 18), mat(WHITE),
  );
  bodyMain.rotation.x = Math.PI / 2;
  bodyMain.scale.x = BODY_WIDE;
  bodyMain.position.set(0, 0, 0.5);
  g.add(bodyMain);

  // --- Nose taper from body to radome ----------------------------------
  const noseTaper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, BODY_R, 1.6, 14), mat(WHITE),
  );
  noseTaper.rotation.x = -Math.PI / 2;
  noseTaper.scale.x = BODY_WIDE;
  noseTaper.position.set(0, 0, -4.30);
  g.add(noseTaper);

  // --- Pointed radome (gray cone) -------------------------------------
  const radome = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 14), mat(GRAY_NOSE));
  radome.rotation.x = -Math.PI / 2;
  radome.scale.x = BODY_WIDE;
  radome.position.set(0, 0, -5.45);
  g.add(radome);

  // --- Pitot probe -----------------------------------------------------
  const probe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), mat(STEEL),
  );
  probe.rotation.x = -Math.PI / 2;
  probe.position.set(0, 0, -6.08);
  g.add(probe);

  // --- Dorsal spine (Thunderbird blue) --------------------------------
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.44, 6.2), mat(TB_BLUE));
  spine.position.set(0, 0.50, 1.70);
  g.add(spine);

  // --- One-piece bubble canopy ----------------------------------------
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.50, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(CANOPY),
  );
  canopy.position.set(0, 0.42, -1.7);
  canopy.scale.set(0.85, 1.0, 2.8);
  g.add(canopy);

  // --- Belly chin intake (white body) ---------------------------------
  const intakeSide = new THREE.Shape();
  intakeSide.moveTo(-1.10,  0.0);    // top forward (mouth top)
  intakeSide.lineTo(-1.10, -0.48);   // bottom forward (mouth bottom)
  intakeSide.lineTo( 5.20, -0.48);   // bottom rear (world Z = 3.90)
  intakeSide.lineTo( 5.50,  0.0);    // top rear sloping up into body
  intakeSide.lineTo(-1.10,  0.0);
  const intakeGeo = new THREE.ExtrudeGeometry(intakeSide, { depth: 1.05, bevelEnabled: false });
  intakeGeo.translate(0, 0, -0.525);   // centre width on the X axis
  const intake = new THREE.Mesh(intakeGeo, mat(WHITE));
  intake.rotation.y = -Math.PI / 2;
  intake.position.set(0, -0.24, -1.30);  // raised half-height into body
  g.add(intake);
  // Mouth cap — dark rounded-rect at the forward face.
  const mouthShape = new THREE.Shape();
  const mw = 0.50, mh = 0.22, mr = 0.18;
  mouthShape.moveTo(-mw + mr, -mh);
  mouthShape.lineTo(mw - mr, -mh);
  mouthShape.quadraticCurveTo(mw, -mh, mw, -mh + mr);
  mouthShape.lineTo(mw, mh - mr);
  mouthShape.quadraticCurveTo(mw, mh, mw - mr, mh);
  mouthShape.lineTo(-mw + mr, mh);
  mouthShape.quadraticCurveTo(-mw, mh, -mw, mh - mr);
  mouthShape.lineTo(-mw, -mh + mr);
  mouthShape.quadraticCurveTo(-mw, -mh, -mw + mr, -mh);
  const mouth = new THREE.Mesh(new THREE.ShapeGeometry(mouthShape), mat(INTAKE));
  mouth.rotation.y = Math.PI;
  mouth.position.set(0, -0.48, -2.41);
  g.add(mouth);

  // --- Cropped delta wings (Thunderbird red) --------------------------
  const wingShape = new THREE.Shape();
  wingShape.moveTo( 0.0,  1.8);     // root leading
  wingShape.lineTo( 4.6, -0.6);     // tip leading (swept back)
  wingShape.lineTo( 4.6, -1.4);     // cropped flat tip
  wingShape.lineTo( 0.0, -2.2);     // root trailing
  wingShape.lineTo( 0.0,  1.8);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.16, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(TB_RED));
    w.scale.x = side;
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, -0.05, 0);
    g.add(w);
  }

  // --- Single vertical tail fin (Thunderbird red) ---------------------
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.3, 0.0);    // forward base
  finShape.lineTo(-0.1, 1.8);    // peak (top forward)
  finShape.lineTo( 1.0, 1.55);   // top trailing (rear-most, at exhaust)
  finShape.lineTo( 0.6, 0.0);    // trailing base (TE leans FORWARD)
  finShape.lineTo(-1.3, 0.0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  finGeo.translate(0, 0, -0.05);
  const fin = new THREE.Mesh(finGeo, mat(TB_RED));
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0, 0.72, 3.78);
  g.add(fin);

  // --- Twin ventral fins (white) --------------------------------------
  const ventShape = new THREE.Shape();
  ventShape.moveTo( 0.7,  0.0);
  ventShape.lineTo( 0.2, -0.50);
  ventShape.lineTo(-0.4, -0.50);
  ventShape.lineTo(-0.7,  0.0);
  ventShape.lineTo( 0.7,  0.0);
  const ventGeo = new THREE.ExtrudeGeometry(ventShape, { depth: 0.06, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const v = new THREE.Mesh(ventGeo, mat(WHITE));
    v.rotation.y = -Math.PI / 2;
    v.position.set(side * 0.30, -0.48, 3.2);
    v.rotation.z = -side * 0.35;
    g.add(v);
  }

  // --- Horizontal stabilators (white) ---------------------------------
  const stabShape = new THREE.Shape();
  stabShape.moveTo( 0.0,  0.8);     // root leading
  stabShape.lineTo( 2.1,  0.4);     // tip leading
  stabShape.lineTo( 2.1, -0.4);     // tip trailing
  stabShape.lineTo( 0.0, -1.0);     // root trailing
  stabShape.lineTo( 0.0,  0.8);
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(WHITE));
    s.scale.x = side;
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.05, 3.6);
    g.add(s);
  }

  // --- Exhaust nozzle at body rear (scaled 90%) ----------------------
  const EX_S = 0.9;
  const ex = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.42, 0.55, 14), mat(STEEL),
  );
  ex.rotation.x = Math.PI / 2;
  ex.scale.set(BODY_WIDE * EX_S, EX_S, EX_S);
  ex.position.set(0, 0, 4.78);
  g.add(ex);
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.34, 0.28, 14), mat(0x222428),
  );
  inner.rotation.x = Math.PI / 2;
  inner.scale.set(BODY_WIDE * EX_S, EX_S, EX_S);
  inner.position.set(0, 0, 5.00);
  g.add(inner);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.34, 14), mat(EXH));
  hole.rotation.y = Math.PI;
  hole.scale.set(BODY_WIDE * EX_S, EX_S, 1);
  hole.position.set(0, 0, 5.14);
  g.add(hole);
  // Engine plume anchor — read by the shell to place the flame cone. Tied to
  // the exhaust-hole mesh so the flame can't drift from the nozzle.
  g.userData.nozzles = [{ x: hole.position.x, y: hole.position.y, z: hole.position.z }];

  return g;
}

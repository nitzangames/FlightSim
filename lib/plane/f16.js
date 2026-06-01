// IDF F-16C Fighting Falcon — single-engine 4th-gen fighter ("Viper").
// Israeli Defence Force colours: alternating brown/green camo, with
// Star of David insignia on the wings and tail fin.

const GREEN     = 0x4a5040;   // olive (same as F-4 IDF)
const BROWN     = 0x6b5538;   // earthy brown (same as F-4 IDF)
const DARK_NOSE = 0x1a1a1a;   // black radome
const INTAKE    = 0x2a2c30;
const STEEL     = 0x40434a;
const EXH       = 0x111111;
const CANOPY    = 0x2a3340;   // dark canopy glass
const IDF_BLUE  = 0x0038b8;   // Israeli flag blue
const IDF_WHITE = 0xeaeaea;

// Star of David insignia (white disc with blue hexagram).
function makeStarOfDavid(THREE, diameter) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  const r = diameter / 2;

  // White disc background — circle in XY plane, normal +Z.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat(IDF_WHITE));
  g.add(disc);

  // Blue hexagram on top (12 points: outer/inner alternating).
  const starShape = new THREE.Shape();
  const outer = r * 0.85;
  const inner = outer * Math.sqrt(3) / 3;
  for (let i = 0; i < 12; i++) {
    const radius = (i % 2 === 0) ? outer : inner;
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape), mat(IDF_BLUE));
  star.position.z = 0.001;
  g.add(star);
  return g;
}

export function buildF16(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // --- Main fuselage cylinder ------------------------------------------
  // Spans world Z = -3.5 (front shoulder) to +4.5 (exhaust end), R=0.48.
  // scale.x widens the cross-section (oval body, wider than tall).
  const BODY_R = 0.48;
  const BODY_WIDE = 1.35;        // X-axis stretch factor
  const bodyMain = new THREE.Mesh(
    new THREE.CylinderGeometry(BODY_R, BODY_R, 8.0, 18), mat(GREEN),
  );
  bodyMain.rotation.x = Math.PI / 2;
  bodyMain.scale.x = BODY_WIDE;
  bodyMain.position.set(0, 0, 0.5);
  g.add(bodyMain);

  // --- Nose taper from body to radome ----------------------------------
  const noseTaper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, BODY_R, 1.6, 14), mat(GREEN),
  );
  noseTaper.rotation.x = -Math.PI / 2;
  noseTaper.scale.x = BODY_WIDE;
  noseTaper.position.set(0, 0, -4.30);
  g.add(noseTaper);

  // --- Pointed radome (black, like IDF F-4) ---------------------------
  const radome = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 14), mat(DARK_NOSE));
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

  // --- Dorsal spine (brown — alternates with green body) --------------
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.44, 6.2), mat(BROWN));
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

  // --- Belly chin intake (brown — alternates with green body) ---------
  const intakeSide = new THREE.Shape();
  intakeSide.moveTo(-1.10,  0.0);    // top forward (mouth top)
  intakeSide.lineTo(-1.10, -0.48);   // bottom forward (mouth bottom)
  intakeSide.lineTo( 5.20, -0.48);   // bottom rear (world Z = 3.90)
  intakeSide.lineTo( 5.50,  0.0);    // top rear sloping up into body
  intakeSide.lineTo(-1.10,  0.0);
  const intakeGeo = new THREE.ExtrudeGeometry(intakeSide, { depth: 1.05, bevelEnabled: false });
  intakeGeo.translate(0, 0, -0.525);   // centre width on the X axis
  const intake = new THREE.Mesh(intakeGeo, mat(BROWN));
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

  // --- Cropped delta wings (brown — alternates with green) ------------
  const wingShape = new THREE.Shape();
  wingShape.moveTo( 0.0,  1.8);     // root leading
  wingShape.lineTo( 4.6, -0.6);     // tip leading (swept back)
  wingShape.lineTo( 4.6, -1.4);     // cropped flat tip
  wingShape.lineTo( 0.0, -2.2);     // root trailing
  wingShape.lineTo( 0.0,  1.8);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.16, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(BROWN));
    w.scale.x = side;
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, -0.05, 0);
    g.add(w);
  }

  // Star of David insignia on each wing (top + bottom L+R).
  for (const side of [-1, 1]) {
    const top = makeStarOfDavid(THREE, 0.7);
    top.rotation.x = -Math.PI / 2;
    top.position.set(side * 2.4, 0.13, 0.5);
    g.add(top);
    const bot = makeStarOfDavid(THREE, 0.7);
    bot.rotation.x = Math.PI / 2;
    bot.position.set(side * 2.4, -0.07, 0.5);
    g.add(bot);
  }

  // --- Single vertical tail fin (green — alternates) ------------------
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.3, 0.0);    // forward base
  finShape.lineTo(-0.1, 1.8);    // peak (top forward)
  finShape.lineTo( 1.0, 1.55);   // top trailing (rear-most, at exhaust)
  finShape.lineTo( 0.6, 0.0);    // trailing base (TE leans FORWARD)
  finShape.lineTo(-1.3, 0.0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  finGeo.translate(0, 0, -0.05);
  const fin = new THREE.Mesh(finGeo, mat(GREEN));
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0, 0.72, 3.78);
  g.add(fin);

  // --- Twin ventral fins (green — alternates with brown wings) --------
  const ventShape = new THREE.Shape();
  ventShape.moveTo( 0.7,  0.0);
  ventShape.lineTo( 0.2, -0.50);
  ventShape.lineTo(-0.4, -0.50);
  ventShape.lineTo(-0.7,  0.0);
  ventShape.lineTo( 0.7,  0.0);
  const ventGeo = new THREE.ExtrudeGeometry(ventShape, { depth: 0.06, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const v = new THREE.Mesh(ventGeo, mat(GREEN));
    v.rotation.y = -Math.PI / 2;
    v.position.set(side * 0.30, -0.48, 3.2);
    v.rotation.z = -side * 0.35;
    g.add(v);
  }

  // --- Horizontal stabilators (green) ---------------------------------
  const stabShape = new THREE.Shape();
  stabShape.moveTo( 0.0,  0.8);     // root leading
  stabShape.lineTo( 2.1,  0.4);     // tip leading
  stabShape.lineTo( 2.1, -0.4);     // tip trailing
  stabShape.lineTo( 0.0, -1.0);     // root trailing
  stabShape.lineTo( 0.0,  0.8);
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(GREEN));
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

  return g;
}

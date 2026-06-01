// F-15 Eagle — twin-engine air superiority fighter.
// Architecture: central cylinder body + twin long side pods that contain
// the engines. The intakes are at the FRONT of each pod, exhausts at the
// REAR. The pods carry the vertical fins and the bulk of the volume.

const GREY      = 0xa0a6ae;   // air-superiority grey
const GREY_DARK = 0x6e747c;   // intake / camo accent
const CANOPY    = 0x2a3340;
const STEEL     = 0x46474d;
const EXH       = 0x141414;
const DARK      = 0x2a2c30;   // intake interior

export function buildF15(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // --- Central body cylinder ------------------------------------------
  // 10% wider, 50% taller. Taller than wide (oval, tall axis vertical).
  const BODY_R = 0.36;
  const BODY_WIDE = 1.375;   // X scale → width radius = 0.495 (was 0.45, +10%)
  const BODY_TALL = 1.50;    // Z scale → height radius = 0.54 (was 0.36, +50%)
  const bodyMain = new THREE.Mesh(
    new THREE.CylinderGeometry(BODY_R, BODY_R, 8.4, 16), mat(GREY),
  );
  bodyMain.rotation.x = Math.PI / 2;
  bodyMain.scale.set(BODY_WIDE, 1, BODY_TALL);
  bodyMain.position.set(0, 0, 0.3);
  g.add(bodyMain);

  // --- Nose taper from body to radome ---------------------------------
  const noseTaper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, BODY_R, 1.4, 14), mat(GREY),
  );
  noseTaper.rotation.x = -Math.PI / 2;
  noseTaper.scale.set(BODY_WIDE, 1, BODY_TALL);
  noseTaper.position.set(0, 0, -4.60);
  g.add(noseTaper);

  // --- Pointed radome --------------------------------------------------
  const radome = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.8, 14), mat(GREY));
  radome.rotation.x = -Math.PI / 2;
  radome.scale.set(BODY_WIDE, 1, BODY_TALL);
  radome.position.set(0, 0, -5.70);
  g.add(radome);

  // --- Tail cone (stinger) — apex points back, base joins body --------
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(BODY_R, 1.0, 14), mat(GREY));
  tailCone.rotation.x = Math.PI / 2;    // apex → world +Z (back) — flipped
  tailCone.scale.set(BODY_WIDE, 1, BODY_TALL);
  tailCone.position.set(0, 0, 5.00);    // base at z=4.5, apex at z=5.5
  g.add(tailCone);
  // Pitot probe.
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), mat(STEEL));
  probe.rotation.x = -Math.PI / 2;
  probe.position.set(0, 0, -6.35);
  g.add(probe);

  // --- Twin side pods (engine nacelles) -------------------------------
  // Each pod runs from the intake mouth at the front (slanted, top lip
  // leading) all the way to the engine exhaust at the rear. Shape in XY
  // (X = chord, Y = vertical), extruded along Z for pod width.
  const POD_FRONT_X = -2.5;   // top-forward (intake top lip — extends forward)
  const POD_BACK_X  =  2.0;   // back of pod (ends before engine cylinders)
  const podShape = new THREE.Shape();
  podShape.moveTo(-1.50, -0.50);   // bottom-forward (set back — short bottom)
  podShape.lineTo(POD_BACK_X, -0.50);
  podShape.lineTo(POD_BACK_X,  0.25);   // top-back (reduced height: 0.75 instead of 1.0)
  podShape.lineTo(POD_FRONT_X, 0.25);   // top-forward (long top, lip leads)
  podShape.lineTo(-1.50, -0.50);        // close: slanted front face (intake mouth)
  const podGeo = new THREE.ExtrudeGeometry(podShape, { depth: 0.70, bevelEnabled: false });
  podGeo.translate(0, 0, -0.35);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(podGeo, mat(GREY_DARK));
    pod.rotation.y = -Math.PI / 2;
    pod.position.set(side * 0.72, -0.05, 0);   // tight to body
    g.add(pod);
  }

  // --- Dark intake mouths at front of each pod (large rectangular) ----
  for (const side of [-1, 1]) {
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.60, 0.50), mat(DARK));
    mouth.position.set(side * 0.72, -0.18, -1.99);   // centered on new shorter front face
    mouth.rotation.y = Math.PI;
    g.add(mouth);
  }

  // --- Bubble canopy ---------------------------------------------------
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(CANOPY),
  );
  canopy.position.set(0, 0.42, -1.7);
  canopy.scale.set(0.78, 1.0, 2.3);
  g.add(canopy);

  // --- Trapezoidal swept wings ----------------------------------------
  // Shape axes: X=spanwise, Y=forward chord.
  const wingShape = new THREE.Shape();
  wingShape.moveTo( 0.0,  1.6);     // root leading
  wingShape.lineTo( 5.4, -0.8);     // tip leading (swept ~24°)
  wingShape.lineTo( 5.4, -1.8);     // cropped flat tip
  wingShape.lineTo( 0.0, -2.4);     // root trailing
  wingShape.lineTo( 0.0,  1.6);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(GREY));
    w.scale.x = side;
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, 0.0, 0.6);
    g.add(w);
  }

  // --- Twin VERTICAL fins (mounted on top of the pods) ----------------
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.4, 0.0);    // forward base
  finShape.lineTo(-0.3, 1.8);    // top forward (peak)
  finShape.lineTo( 0.8, 1.65);   // top trailing (slight slope)
  finShape.lineTo( 0.9, 0.0);    // trailing base
  finShape.lineTo(-1.4, 0.0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  finGeo.translate(0, 0, -0.05);
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, mat(GREY));
    fin.rotation.y = -Math.PI / 2;
    fin.position.set(side * 0.72, 0.20, 4.3);   // sits on lowered pod top, trailing at pod back
    g.add(fin);
  }

  // --- Horizontal stabilators -----------------------------------------
  const stabShape = new THREE.Shape();
  stabShape.moveTo( 0.0,  0.9);
  stabShape.lineTo( 2.6,  0.4);
  stabShape.lineTo( 2.6, -0.7);
  stabShape.lineTo( 0.0, -1.2);
  stabShape.lineTo( 0.0,  0.9);
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(GREY_DARK));
    s.scale.x = side;
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, -0.05, 3.8);
    g.add(s);
  }

  // --- Twin engine cylinders (touching at centerline) -----------------
  // Front cones taper INTO the body (apex points forward into body).
  // Cylinders span from just behind the pods all the way to the exhaust.
  const ENG_R = 0.48;   // 50% bigger (was 0.32)
  const ENG_FRONT_Z = 1.8;     // cylinder front (cone joins here)
  const ENG_BACK_Z  = 5.0;     // cylinder back (exhaust face)
  const ENG_LEN = ENG_BACK_Z - ENG_FRONT_Z;
  for (const side of [-1, 1]) {
    // Main engine cylinder.
    const eng = new THREE.Mesh(
      new THREE.CylinderGeometry(ENG_R, ENG_R, ENG_LEN, 14), mat(GREY_DARK),
    );
    eng.rotation.x = Math.PI / 2;
    eng.position.set(side * ENG_R, -0.05, (ENG_FRONT_Z + ENG_BACK_Z) / 2);
    g.add(eng);
    // Front cone — apex points forward (-Z), into the body.
    const engCone = new THREE.Mesh(new THREE.ConeGeometry(ENG_R, 1.0, 14), mat(GREY_DARK));
    engCone.rotation.x = -Math.PI / 2;
    engCone.position.set(side * ENG_R, -0.05, ENG_FRONT_Z - 0.5);
    g.add(engCone);
    // Exhaust nozzle at the back of the cylinder.
    const ex = new THREE.Mesh(
      new THREE.CylinderGeometry(ENG_R, ENG_R - 0.05, 0.55, 14), mat(STEEL),
    );
    ex.rotation.x = Math.PI / 2;
    ex.position.set(side * ENG_R, -0.05, ENG_BACK_Z + 0.275);
    g.add(ex);
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(ENG_R - 0.06, ENG_R - 0.10, 0.22, 14), mat(0x222428),
    );
    inner.rotation.x = Math.PI / 2;
    inner.position.set(side * ENG_R, -0.05, ENG_BACK_Z + 0.65);
    g.add(inner);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(ENG_R - 0.10, 14), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.set(side * ENG_R, -0.05, ENG_BACK_Z + 0.78);
    g.add(hole);
  }

  return g;
}

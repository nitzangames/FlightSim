// F/A-18 Hornet — Blue Angels demo team livery.
// Twin-engine carrier fighter with prominent LEX (Leading Edge Extensions)
// flowing from wing root forward along the fuselage sides, twin canted
// vertical fins, twin close-set engine nozzles at the rear.
// Royal blue body with yellow accents (nose, LE stripes, wing/fin tips).

const BLUE   = 0x002f87;   // Blue Angels royal blue
const YELLOW = 0xffc81f;   // Blue Angels yellow
const CANOPY = 0x1c2230;   // dark canopy glass
const STEEL  = 0x46474d;
const EXH    = 0x141414;
const DARK   = 0x2a2c30;   // intake interior

export function buildF18(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  // Yellow material biases its depth slightly forward so coplanar yellow
  // faces always render in front of the blue body (no z-fighting).
  const yMat = () => new THREE.MeshPhongMaterial({
    color: YELLOW, flatShading: true, shininess: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  // --- Main fuselage ---------------------------------------------------
  // Side-profile extrude shape (X = chord forward, Y = vertical).
  // After Ry(-π/2): shape X positive maps to world Z positive (back).
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-4.7,  0.0);     // forward radome tip
  bodyShape.lineTo(-4.4,  0.25);    // top of radome
  bodyShape.lineTo(-2.4,  0.55);    // rises to cockpit shoulder
  bodyShape.lineTo(-1.6,  0.75);    // cockpit spine peak
  bodyShape.lineTo( 0.8,  0.65);    // long flat-top spine
  bodyShape.lineTo( 3.0,  0.45);    // tapers down to tail
  bodyShape.lineTo( 4.5,  0.40);    // back end top
  bodyShape.lineTo( 4.5, -0.40);    // back end bottom (exhaust face)
  bodyShape.lineTo( 3.0, -0.45);
  bodyShape.lineTo( 0.5, -0.55);    // belly
  bodyShape.lineTo(-1.8, -0.55);    // belly under cockpit
  bodyShape.lineTo(-3.0, -0.35);    // belly up toward nose
  bodyShape.lineTo(-4.4, -0.20);
  bodyShape.lineTo(-4.7,  0.0);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.95, bevelEnabled: false });
  bodyGeo.translate(0, 0, -0.475);   // centre on X (width)
  const body = new THREE.Mesh(bodyGeo, mat(BLUE));
  body.rotation.y = -Math.PI / 2;
  g.add(body);

  // --- Big bulbous radome — truncated cone with R=0.36 base (hidden in
  // body) tapering to R=0.05 at the forward end. Apex is a small flat
  // disc that the yellow nose tip sits flush against.
  const radome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.36, 1.0, 14), mat(BLUE),
  );
  radome.rotation.x = -Math.PI / 2;   // top (R=0.05) → forward (-Z)
  radome.position.z = -4.70;          // back at z=-4.20 (inside body), front at z=-5.20
  g.add(radome);
  // Yellow nose tip — base R=0.05 matches radome forward, clean blend.
  const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.30, 12), yMat());
  noseTip.rotation.x = -Math.PI / 2;
  noseTip.position.z = -5.35;   // base at z=-5.20, apex at z=-5.50
  g.add(noseTip);
  // Pitot probe — back at z=-5.50 touches yellow apex.
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.40, 8), mat(STEEL));
  probe.rotation.x = -Math.PI / 2;
  probe.position.z = -5.70;   // back at z=-5.50, front at z=-5.90
  g.add(probe);

  // --- LEX (Leading Edge Extensions) ----------------------------------
  // Triangular plates that taper from wing root forward to a sharp point
  // alongside the cockpit. Distinctive F-18 silhouette feature.
  // Shape axes: X=spanwise (outboard), Y=forward chord (+Y = forward).
  const lexShape = new THREE.Shape();
  lexShape.moveTo( 0.0,  0.4);     // inboard rear (at wing root)
  lexShape.lineTo( 0.95, 0.4);     // outboard rear (full LEX width)
  lexShape.lineTo( 0.18, 3.6);     // forward sharp tip (alongside cockpit)
  lexShape.lineTo( 0.0,  0.4);
  const lexGeo = new THREE.ExtrudeGeometry(lexShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const lex = new THREE.Mesh(lexGeo, mat(BLUE));
    lex.scale.x = side;
    lex.rotation.x = -Math.PI / 2;
    lex.position.set(0, 0.18, 0);
    g.add(lex);
  }

  // --- Twin engine pods (cylinders, yawed inward at the rear) ---------
  // Each pod + its exhaust + intake mouth is wrapped in a Group. The
  // group's rotation.y is applied LAST (in world frame), so the pod
  // yaws around its FRONT pivot point — backs converge at centerline.
  const POD_R = 0.32;
  const POD_FRONT = -1.6;
  const POD_BACK  = 4.55;
  const POD_LEN   = POD_BACK - POD_FRONT;
  const POD_CENTER_Z = (POD_FRONT + POD_BACK) / 2;
  const POD_YAW = 0.025;   // gentler inward yaw (~1.4°)
  for (const side of [-1, 1]) {
    const podGroup = new THREE.Group();
    // Pivot the group at the FRONT of the pod (so the front stays put
    // while the back swings inward).
    podGroup.position.set(side * 0.55, -0.18, POD_FRONT);
    podGroup.rotation.y = -side * POD_YAW;
    g.add(podGroup);

    // Inside the group, everything is positioned relative to the front
    // pivot — front=0, back=POD_LEN along local +Z.
    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(POD_R, POD_R, POD_LEN, 14), mat(BLUE),
    );
    pod.rotation.x = Math.PI / 2;
    pod.position.z = POD_LEN / 2;
    podGroup.add(pod);

    // Dark intake mouth disc at front (local z = 0).
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(POD_R * 0.85, 14), mat(DARK));
    mouth.rotation.y = Math.PI;
    mouth.position.z = -0.01;
    podGroup.add(mouth);

    // Exhaust nozzle at the back (local z = POD_LEN + offset).
    const ex = new THREE.Mesh(
      new THREE.CylinderGeometry(POD_R, POD_R - 0.04, 0.50, 14), mat(STEEL),
    );
    ex.rotation.x = Math.PI / 2;
    ex.position.z = POD_LEN + 0.25;
    podGroup.add(ex);
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(POD_R - 0.06, POD_R - 0.10, 0.20, 14), mat(0x222428),
    );
    inner.rotation.x = Math.PI / 2;
    inner.position.z = POD_LEN + 0.45;
    podGroup.add(inner);
    const holeLocalZ = POD_LEN + 0.56;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(POD_R - 0.10, 14), mat(EXH));
    hole.rotation.y = Math.PI;
    hole.position.z = holeLocalZ;
    podGroup.add(hole);
    // Engine plume anchor (per pod). The pod group is yawed about its front
    // pivot (podGroup.position = side*0.55, -0.18, POD_FRONT; rotation.y =
    // -side*POD_YAW), so map the hole's local z back into root (pre-scale)
    // coords for the shell's flame cone. Tied to the same constants as above.
    const yaw = -side * POD_YAW;
    if (!g.userData.nozzles) g.userData.nozzles = [];
    g.userData.nozzles.push({
      x: side * 0.55 + Math.sin(yaw) * holeLocalZ,
      y: -0.18,
      z: POD_FRONT + Math.cos(yaw) * holeLocalZ,
    });
  }

  // --- Cropped delta wings --------------------------------------------
  // Shape axes: X=spanwise, Y=forward chord.
  const wingShape = new THREE.Shape();
  wingShape.moveTo( 0.0,  1.4);     // root leading
  wingShape.lineTo( 4.4, -0.6);     // tip leading (swept ~28°)
  wingShape.lineTo( 4.4, -1.6);     // cropped flat tip
  wingShape.lineTo( 0.0, -2.0);     // root trailing
  wingShape.lineTo( 0.0,  1.4);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.16, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, mat(BLUE));
    w.scale.x = side;
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, -0.05, 0.4);
    g.add(w);
  }

  // Yellow leading-edge stripe — taller than the wing so no coplanar
  // faces with the wing top/bottom surfaces (avoids z-fighting).
  const leShape = new THREE.Shape();
  leShape.moveTo( 0.0,  1.4);
  leShape.lineTo( 4.4, -0.6);
  leShape.lineTo( 4.4, -0.9);
  leShape.lineTo( 0.0,  1.1);
  leShape.lineTo( 0.0,  1.4);
  const leGeo = new THREE.ExtrudeGeometry(leShape, { depth: 0.22, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const le = new THREE.Mesh(leGeo, yMat());
    le.scale.x = side;
    le.rotation.x = -Math.PI / 2;
    le.position.set(0, -0.08, 0.4);
    g.add(le);
  }

  // Yellow wing tip caps (where the missile rails would be).
  // Same depth/offset as the LE stripe so no z-fighting.
  const tipShape = new THREE.Shape();
  tipShape.moveTo( 4.4, -0.6);
  tipShape.lineTo( 4.6, -0.6);
  tipShape.lineTo( 4.6, -1.6);
  tipShape.lineTo( 4.4, -1.6);
  tipShape.lineTo( 4.4, -0.6);
  const tipGeo = new THREE.ExtrudeGeometry(tipShape, { depth: 0.22, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(tipGeo, yMat());
    tip.scale.x = side;
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(0, -0.08, 0.4);
    g.add(tip);
  }

  // --- Bubble canopy --------------------------------------------------
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(CANOPY),
  );
  canopy.position.set(0, 0.55, -1.6);   // lowered slightly into spine
  canopy.scale.set(0.78, 1.0, 2.4);
  g.add(canopy);

  // --- Twin canted vertical fins -------------------------------------
  // F-18 fins are sharply canted OUTWARD at the top (~20°).
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.3, 0.0);    // forward base
  finShape.lineTo(-0.2, 1.4);    // top forward (peak)
  finShape.lineTo( 0.7, 1.30);   // top trailing (gentle slope)
  finShape.lineTo( 0.6, 0.0);    // trailing base
  finShape.lineTo(-1.3, 0.0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  finGeo.translate(0, 0, -0.05);
  // Each fin + yellow cap goes in a Group. The group's rotation.z (roll)
  // is applied LAST in world frame, so the top cants outward in world X.
  const FIN_CANT = 0.35;
  for (const side of [-1, 1]) {
    const finGroup = new THREE.Group();
    finGroup.position.set(side * 0.42, 0.42, 2.6);  // tucked in tight against body
    finGroup.rotation.z = -side * FIN_CANT;  // negative roll on +X side → top tilts +X (outward)
    g.add(finGroup);

    const fin = new THREE.Mesh(finGeo, mat(BLUE));
    fin.rotation.y = -Math.PI / 2;
    finGroup.add(fin);

    // Yellow cap at the top of each fin (same orientation as the fin).
    const finCapShape = new THREE.Shape();
    finCapShape.moveTo(-0.2, 1.40);
    finCapShape.lineTo( 0.7, 1.30);
    finCapShape.lineTo( 0.7, 1.05);
    finCapShape.lineTo(-0.2, 1.15);
    finCapShape.lineTo(-0.2, 1.40);
    const finCapGeo = new THREE.ExtrudeGeometry(finCapShape, { depth: 0.11, bevelEnabled: false });
    finCapGeo.translate(0, 0, -0.055);
    const finCap = new THREE.Mesh(finCapGeo, yMat());
    finCap.rotation.y = -Math.PI / 2;
    finGroup.add(finCap);
  }

  // --- Horizontal stabilators (low-mounted at rear) ------------------
  const stabShape = new THREE.Shape();
  stabShape.moveTo( 0.0,  0.7);     // root leading
  stabShape.lineTo( 1.9,  0.3);     // tip leading (swept)
  stabShape.lineTo( 1.9, -0.5);     // tip trailing
  stabShape.lineTo( 0.0, -1.0);     // root trailing
  stabShape.lineTo( 0.0,  0.7);
  const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.10, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(stabGeo, mat(BLUE));
    s.scale.x = side;
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, -0.05, 3.8);
    g.add(s);
  }

  return g;
}

// Faceted lowpoly P-51D Mustang — WW2 long-range escort fighter.
// In-line V-12 Merlin → long nose, bubble canopy aft of the wings,
// signature belly radiator scoop. ~11 m wingspan, ~11 m length.
// Livery: bare-metal silver body with yellow spinner + cowling band.

const SILVER   = 0xc6cbd4;
const YELLOW   = 0xf2c33a;
const SCOOP    = 0xb8bdc6;
const CANOPY   = 0x2a3340;
const DARK     = 0x1c1c20;

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

  // Spinner — yellow pointed cone in front of the cowling.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.4, 10), mat(YELLOW));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -6.1;
  g.add(spinner);

  // Propeller — single bar mesh in a group so the chase loop can spin it.
  const propGroup = new THREE.Group();
  propGroup.position.z = -6.85;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.10), mat(DARK));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Wings — full-span ExtrudeGeometry shaped as a P-51 planform: nearly
  // straight leading edge, slight trailing-edge taper outboard, rounded
  // (not pointed) tips. Built as one closed THREE.Shape traced through
  // root → taper → rounded tip → mirrored back. ~24 vertices per side.
  const SPAN = 11.0;
  const ROOT_LEAD  = 1.0;   // leading-edge offset from wing midline at root
  const ROOT_TRAIL = 1.6;   // trailing-edge offset from wing midline at root
  const TIP_HALF   = 0.45;  // tip half-chord (rounded)
  const TAPER_X    = 4.0;   // x at which taper starts (inboard panel is rectangular)
  const TIP_X      = SPAN / 2;
  const TIP_RADIUS_X = 0.4; // semi-axis of tip ellipse in the span direction
  const N_TIP      = 8;     // arc segments at each tip
  const wingShape = new THREE.Shape();
  // Start at the left trailing-edge corner of the root and walk counter-clockwise.
  wingShape.moveTo(-TAPER_X, -ROOT_TRAIL);
  // Left taper (trailing edge sweeps forward as we go outboard).
  wingShape.lineTo(-TIP_X + TIP_RADIUS_X, -TIP_HALF);
  // Left rounded tip — half-ellipse arc (radii TIP_RADIUS_X × TIP_HALF), trailing edge → leading edge.
  for (let i = 1; i < N_TIP; i++) {
    const t = i / N_TIP;
    const theta = -Math.PI / 2 + t * Math.PI;
    const cx = -TIP_X;
    const x = cx + TIP_RADIUS_X * Math.cos(theta);
    const y = TIP_HALF * Math.sin(theta);
    wingShape.lineTo(x, y);
  }
  wingShape.lineTo(-TIP_X + TIP_RADIUS_X, TIP_HALF);
  // Left leading edge back to root (nearly straight).
  wingShape.lineTo(-TAPER_X, ROOT_LEAD);
  // Root leading edge across.
  wingShape.lineTo(TAPER_X, ROOT_LEAD);
  // Right leading edge.
  wingShape.lineTo(TIP_X - TIP_RADIUS_X, TIP_HALF);
  // Right rounded tip — half-ellipse arc (radii TIP_RADIUS_X × TIP_HALF), leading edge → trailing edge.
  for (let i = 1; i < N_TIP; i++) {
    const t = i / N_TIP;
    const theta = Math.PI / 2 - t * Math.PI;
    const cx = TIP_X;
    const x = cx + TIP_RADIUS_X * Math.cos(theta);
    const y = TIP_HALF * Math.sin(theta);
    wingShape.lineTo(x, y);
  }
  wingShape.lineTo(TIP_X - TIP_RADIUS_X, -TIP_HALF);
  // Right taper back.
  wingShape.lineTo(TAPER_X, -ROOT_TRAIL);
  // Root trailing edge across (closes the shape).
  wingShape.lineTo(-TAPER_X, -ROOT_TRAIL);
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

  // Belly radiator scoop — flat-sided duct just aft of the wing root.
  // The lathe body's radius at z=0.5 is ~0.56, so the scoop top edge
  // (y = -0.55 + 0.45/2 = -0.325) sits just below the fuselage underside.
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.50, 1.8), mat(SCOOP));
  scoop.position.set(0, -0.78, 0.6);
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

  // Vertical fin — flatter-topped silhouette characteristic of the P-51D
  // (less swept / leaf-shaped than the Spitfire's).
  const finShape = new THREE.Shape();
  finShape.moveTo( 0.70, 0.00);   // base trailing edge
  finShape.lineTo(-0.55, 0.00);   // base leading edge
  finShape.lineTo(-0.20, 1.15);   // top leading corner
  finShape.lineTo( 0.50, 1.15);   // top trailing corner
  finShape.lineTo( 0.70, 0.00);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  const fin = new THREE.Mesh(finGeo, mat(SILVER));
  fin.rotation.y = Math.PI / 2;
  fin.position.set(0, 0.10, 3.0);
  g.add(fin);

  return g;
}

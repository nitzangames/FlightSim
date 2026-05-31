// Faceted lowpoly Fokker Dr.I "Red Baron" — WW1 German triplane. ~7m
// wingspan (top), ~5.8m length. Bright red overall with German Iron Cross
// (Balkenkreuz) markings on the wings and fuselage sides.

const RED      = 0xa11a1a;   // red baron livery
const BROWN    = 0x4d3826;   // wooden struts + prop
const STEEL    = 0x46474d;   // cowling + engine details + wheel struts
const DARK     = 0x1a1a1a;   // cockpit interior, wheels, iron cross
const WHITE    = 0xeaeaea;   // iron cross background

function makeIronCross(THREE, size, withBackground = true) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  // White square background (skip when the underlying surface is already
  // white — e.g. the rudder which is painted entirely white).
  if (withBackground) {
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat(WHITE));
    bg.rotation.x = -Math.PI / 2;
    bg.position.y = 0.000;
    g.add(bg);
  }
  // Black Balkenkreuz: two perpendicular bars
  const armLen = size * 0.95;
  const armW   = size * 0.30;
  const vert = new THREE.Mesh(new THREE.PlaneGeometry(armW, armLen), mat(DARK));
  vert.rotation.x = -Math.PI / 2;
  vert.position.y = 0.002;
  g.add(vert);
  const horiz = new THREE.Mesh(new THREE.PlaneGeometry(armLen, armW), mat(DARK));
  horiz.rotation.x = -Math.PI / 2;
  horiz.position.y = 0.002;
  g.add(horiz);
  return g;
}

// Racetrack-shaped wing planform (rectangular middle, half-circle ends).
// Duplicated from lib/plane/biplane.js per the self-contained convention.
function makeRacetrackWing(THREE, span, chord, thickness) {
  const r = chord / 2;
  const halfSpan = span / 2;
  const shape = new THREE.Shape();
  const N = 6;
  shape.moveTo(-halfSpan + r, +r);
  shape.lineTo(+halfSpan - r, +r);
  for (let i = 1; i < N; i++) {
    const theta = Math.PI / 2 - i * Math.PI / N;
    shape.lineTo(+halfSpan - r + r * Math.cos(theta), r * Math.sin(theta));
  }
  shape.lineTo(+halfSpan - r, -r);
  shape.lineTo(-halfSpan + r, -r);
  for (let i = 1; i < N; i++) {
    const theta = -Math.PI / 2 - i * Math.PI / N;
    shape.lineTo(-halfSpan + r + r * Math.cos(theta), r * Math.sin(theta));
  }
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
}

export function buildTriplane(THREE) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });

  // Fuselage — LatheGeometry teardrop in red. Length ~5.6 (z: -2.3 → 3.3).
  const fuseProfile = [
    new THREE.Vector2(0.00, -2.30),
    new THREE.Vector2(0.50, -2.25),
    new THREE.Vector2(0.55, -1.70),   // max radius at the engine
    new THREE.Vector2(0.50,  0.00),
    new THREE.Vector2(0.36,  1.30),
    new THREE.Vector2(0.20,  2.50),
    new THREE.Vector2(0.00,  3.30),
  ];
  const bodyGeo = new THREE.LatheGeometry(fuseProfile, 12);
  const body = new THREE.Mesh(bodyGeo, mat(RED));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Engine cowling — steel cylindrical cap at the front, characteristic
  // dark Oberursel rotary engine cowling.
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.60, 14), mat(STEEL));
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = -2.55;
  g.add(cowl);
  // Engine hub disc — dark, pushed slightly forward of the cowling front
  // face (at z=-2.85) to avoid z-fighting with the cowling's closed cap.
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.40, 16), mat(DARK));
  hub.rotation.y = Math.PI;
  hub.position.z = -2.88;
  g.add(hub);

  // Propeller — brown two-blade.
  const propGroup = new THREE.Group();
  propGroup.position.z = -2.95;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.10, 0.12), mat(BROWN));
  propGroup.add(blade);
  g.add(propGroup);
  g.userData.propeller = propGroup;

  // Three wings — racetrack planform (rounded tips), stacked vertically.
  // Top wing slightly wider than mid and bottom (Fokker Dr.I proportions).
  const topWingGeo  = makeRacetrackWing(THREE, 7.0, 1.30, 0.16);
  const midWingGeo  = makeRacetrackWing(THREE, 6.8, 1.30, 0.16);
  const botWingGeo  = makeRacetrackWing(THREE, 6.4, 1.30, 0.16);
  const topWing = new THREE.Mesh(topWingGeo, mat(RED));
  topWing.rotation.x = -Math.PI / 2;
  topWing.position.set(0, 1.50, -1.10);
  g.add(topWing);
  const midWing = new THREE.Mesh(midWingGeo, mat(RED));
  midWing.rotation.x = -Math.PI / 2;
  midWing.position.set(0, 0.55, -1.05);
  g.add(midWing);
  const botWing = new THREE.Mesh(botWingGeo, mat(RED));
  botWing.rotation.x = -Math.PI / 2;
  botWing.position.set(0, -0.48, -1.00);
  g.add(botWing);

  // Inter-wing struts — wood, two pairs per side (between top-mid and
  // mid-bottom).
  const strutGeo = new THREE.BoxGeometry(0.08, 0.95, 0.08);
  for (const sx of [-2.2, 2.2]) {
    for (const sz of [-1.40, -0.70]) {
      const s1 = new THREE.Mesh(strutGeo, mat(BROWN));
      s1.position.set(sx, 1.02, sz);
      g.add(s1);
      const s2 = new THREE.Mesh(strutGeo, mat(BROWN));
      s2.position.set(sx, 0.04, sz);
      g.add(s2);
    }
  }

  // Horizontal stabilizer — racetrack shape.
  const stabGeo = makeRacetrackWing(THREE, 2.4, 0.75, 0.10);
  const tailH = new THREE.Mesh(stabGeo, mat(RED));
  tailH.rotation.x = -Math.PI / 2;
  tailH.position.set(0, 0.05, 2.20);
  g.add(tailH);

  // Vertical fin — ExtrudeGeometry with a rounded comma silhouette
  // (Fokker Dr.I's distinctive rounded tail). Shape +X maps to world +Z
  // (aft) after rotation.y = -π/2.
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.30, 0.00);    // forward base
  finShape.lineTo(+0.45, 0.00);    // aft base
  finShape.lineTo(+0.45, 0.55);    // TE upper
  finShape.lineTo(+0.30, 0.85);    // top aft rounded
  finShape.lineTo( 0.00, 0.95);    // top apex
  finShape.lineTo(-0.25, 0.80);    // upper LE
  finShape.lineTo(-0.30, 0.00);    // back to base
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false });
  const tailV = new THREE.Mesh(finGeo, mat(WHITE));
  tailV.rotation.y = -Math.PI / 2;
  tailV.position.set(0.05, 0.05, 2.20);
  g.add(tailV);

  // Cockpit — dark recess just behind the upper wing's trailing edge.
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.7), mat(DARK));
  cockpit.position.set(0, 0.45, -0.20);
  g.add(cockpit);

  // Iron Cross (Balkenkreuz) insignia — top AND bottom faces of every
  // wing, plus fuselage sides and the rudder.
  // Top wing (y range 1.50 → 1.66): top face cross + bottom face cross.
  for (const sx of [-2.0, 2.0]) {
    const top = makeIronCross(THREE, 0.95);
    top.position.set(sx, 1.67, -1.10);
    g.add(top);
    const bot = makeIronCross(THREE, 0.95);
    bot.rotation.z = Math.PI;
    bot.position.set(sx, 1.49, -1.10);
    g.add(bot);
  }
  // Mid wing (y range 0.55 → 0.71): top + bottom.
  for (const sx of [-2.0, 2.0]) {
    const top = makeIronCross(THREE, 0.85);
    top.position.set(sx, 0.72, -1.05);
    g.add(top);
    const bot = makeIronCross(THREE, 0.85);
    bot.rotation.z = Math.PI;
    bot.position.set(sx, 0.54, -1.05);
    g.add(bot);
  }
  // Bottom wing (y range -0.48 → -0.32): top + bottom.
  for (const sx of [-1.8, 1.8]) {
    const top = makeIronCross(THREE, 0.85);
    top.position.set(sx, -0.31, -1.00);
    g.add(top);
    const bot = makeIronCross(THREE, 0.85);
    bot.rotation.z = Math.PI;
    bot.position.set(sx, -0.49, -1.00);
    g.add(bot);
  }
  // Fuselage sides — smaller cross at z=0.5 (body radius ~0.45 there).
  for (const side of [-1, 1]) {
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    const cross = makeIronCross(THREE, 0.55);
    inner.add(cross);
    inner.rotation.y = -side * Math.PI / 2;
    outer.add(inner);
    outer.rotation.z = -side * Math.PI / 2;
    outer.position.set(side * 0.46, 0.05, 0.50);
    g.add(outer);
  }
  // Vertical fin sides — bare black cross (no white background), since
  // the fin itself is white.
  for (const side of [-1, 1]) {
    const cross = makeIronCross(THREE, 0.35, false);
    cross.rotation.z = -side * Math.PI / 2;
    cross.position.set(side * 0.06, 0.45, 2.25);
    g.add(cross);
  }

  // Landing gear — two dark main wheels on vertical steel struts.
  // Fokker Dr.I had relatively tall fixed gear under the fuselage.
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.12, 14);
  for (const sx of [-0.85, 0.85]) {
    const wheel = new THREE.Mesh(wheelGeo, mat(DARK));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, -1.20, -1.40);
    g.add(wheel);
  }
  // Wheel struts — vertical posts from each wheel up to the bottom wing
  // root area (lower wing bottom at y ≈ -0.56).
  const wheelStrutGeo = new THREE.BoxGeometry(0.06, 0.70, 0.06);
  for (const sx of [-0.85, 0.85]) {
    const strut = new THREE.Mesh(wheelStrutGeo, mat(STEEL));
    strut.position.set(sx, -0.85, -1.40);
    g.add(strut);
  }
  // Axle — single horizontal bar between the two wheels (classic WW1 fixed
  // gear arrangement).
  const axle = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.06, 0.06), mat(STEEL));
  axle.position.set(0, -1.20, -1.40);
  g.add(axle);

  return g;
}

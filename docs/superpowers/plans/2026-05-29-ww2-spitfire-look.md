# WW2 Fighter — Spitfire Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the WW2 Fighter (`lib/plane/ww2-fighter.js`) so the chase-cam silhouette reads as a Supermarine Spitfire — elliptical wings, teardrop bubble canopy, longer pointed nose — and add RAF roundels on the wings and fuselage.

**Architecture:** Pure visual change to a single three.js builder module. No exports change, no controller change, no stats change. Each task replaces or adds a discrete sub-mesh, with the dev server (`http://localhost:8085/` — already running) as the visual feedback loop. Every task ends with `npm test` (locks the roster registry) and a manual chase-cam check in the browser.

**Tech Stack:** three.js r128 (loaded via CDN in `index.html`), ES modules, flat-shaded `MeshPhongMaterial` for the lowpoly look. Tests: vitest.

**Spec:** `docs/superpowers/specs/2026-05-29-ww2-spitfire-look-design.md`

---

### Task 1: Add the `makeRoundel` helper

**Files:**
- Modify: `lib/plane/ww2-fighter.js`

Adds the helper but does NOT place any roundels yet. Verifies the helper compiles and the plane still renders unchanged.

- [ ] **Step 1: Add roundel color constants and helper**

In `lib/plane/ww2-fighter.js`, add these constants just below the existing color constants at the top:

```js
const RAF_BLUE  = 0x1a3a7a;
const RAF_WHITE = 0xeaeaea;
const RAF_RED   = 0xb21a1a;
```

Then add this helper just above `export function buildWW2Fighter(THREE) {`:

```js
// RAF Type-A roundel: 3 concentric circles, slight Y offset to avoid z-fighting.
// Returns a THREE.Group lying in the XZ plane (normal = +Y). Position and
// rotate the returned group to place it on wing tops/bottoms/fuselage sides.
function makeRoundel(THREE, diameter) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
  const r = diameter / 2;
  const rings = [
    { color: RAF_BLUE,  radius: r,        y: 0.000 },
    { color: RAF_WHITE, radius: r * 0.66, y: 0.002 },
    { color: RAF_RED,   radius: r * 0.33, y: 0.004 },
  ];
  for (const { color, radius, y } of rings) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), mat(color));
    m.rotation.x = -Math.PI / 2; // lie flat in XZ
    m.position.y = y;
    g.add(m);
  }
  return g;
}
```

- [ ] **Step 2: Run tests to confirm nothing broke**

Run: `npm test`
Expected: all `tests/planes.test.js` tests PASS (registry tests are unaffected by the new helper).

- [ ] **Step 3: Visual check**

Open `http://localhost:8085/` → Menu → **WW2 Fighter** → Fly. Confirm the plane still renders identically (helper is defined but unused).

- [ ] **Step 4: Commit**

```bash
git add lib/plane/ww2-fighter.js
git commit -m "feat: add RAF roundel helper to WW2 fighter module"
```

---

### Task 2: Replace box wings with elliptical extruded wings

**Files:**
- Modify: `lib/plane/ww2-fighter.js`

Swap the current box-wing + two wing-tip blocks for a single full-span ExtrudeGeometry shaped like a Spitfire's asymmetric ellipse (leading edge slightly straighter than trailing edge).

- [ ] **Step 1: Replace the wing geometry**

In `lib/plane/ww2-fighter.js`, find this block:

```js
  // Wings sit just behind the engine nose (Spitfire proportions). Engine nose
  // back edge ~z=-3.0, wing leading edge ~-2.5, wing center ~-1.3.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.20, 2.4), mat(OLIVE));
  wing.position.set(0, -0.20, -1.3);
  g.add(wing);
  for (const sx of [-5.0, 5.0]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 1.6), mat(OLIVE_DARK));
    tip.position.set(sx, -0.30, -1.3);
    g.add(tip);
  }
```

Replace it with:

```js
  // Spitfire elliptical wing — a single full-span ExtrudeGeometry. Built as
  // a faceted asymmetric ellipse: leading edge sweep slightly flatter than
  // trailing edge sweep, the iconic Spitfire planform. ~16 facets so the
  // edges still read lowpoly. Wing thickness goes UP (+Y) after rotation.
  const SPAN = 11.0;
  const CHORD = 2.6;
  const N = 16;
  const wingShape = new THREE.Shape();
  // Leading edge (sweep left tip → right tip), forward = +Y in shape coords.
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (t - 0.5) * SPAN;
    const y = Math.sin(Math.PI * t) * (CHORD * 0.40); // flatter ellipse forward
    if (i === 0) wingShape.moveTo(x, y);
    else         wingShape.lineTo(x, y);
  }
  // Trailing edge (right tip → left tip), back = -Y in shape coords.
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const x = (t - 0.5) * SPAN;
    const y = -Math.sin(Math.PI * t) * (CHORD * 0.60); // fuller ellipse aft
    wingShape.lineTo(x, y);
  }
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.20, bevelEnabled: false });
  const wing = new THREE.Mesh(wingGeo, mat(OLIVE));
  // rotation.x = -π/2 maps shape +Y → world -Z (forward) and extrusion +Z → world +Y.
  wing.rotation.x = -Math.PI / 2;
  wing.position.set(0, -0.30, -1.3);
  g.add(wing);
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Visual check (the big one)**

Refresh `http://localhost:8085/` → Menu → WW2 Fighter → Fly. From chase cam, the wing planform should now read as the iconic Spitfire ellipse — curved tips, tapered chord, no boxy outline. Wing color stays olive.

If the wing looks upside-down (extrusion thickness pointing down), the rotation sign is wrong — flip to `+Math.PI / 2` and re-test. If leading and trailing edges look swapped (wider edge facing forward instead of aft), swap the `0.40` and `0.60` factors above.

- [ ] **Step 4: Commit**

```bash
git add lib/plane/ww2-fighter.js
git commit -m "feat: elliptical Spitfire wings on WW2 fighter"
```

---

### Task 3: Teardrop bubble canopy

**Files:**
- Modify: `lib/plane/ww2-fighter.js`

Replace the box canopy with a hemisphere scaled into a teardrop (same construction pattern as `lib/plane/p51.js:44-49`).

- [ ] **Step 1: Replace the canopy**

Find this block in `lib/plane/ww2-fighter.js`:

```js
  // Cockpit canopy — sits behind the wing trailing edge.
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.4), mat(0x223344));
  canopy.position.set(0, 0.55, 0.4);
  g.add(canopy);
```

Replace with:

```js
  // Cockpit canopy — bubble teardrop, sits behind the wing trailing edge.
  // Hemisphere scaled long in Z, same construction as p51.js.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0x223344),
  );
  canopy.position.set(0, 0.45, 0.4);
  canopy.scale.set(0.95, 1.0, 2.0);
  g.add(canopy);
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Visual check**

Refresh the page → WW2 Fighter → Fly. Canopy should now read as a curved teardrop bubble instead of a flat box. From chase cam (looking forward over the cockpit) it should bulge slightly upward and stretch back.

- [ ] **Step 4: Commit**

```bash
git add lib/plane/ww2-fighter.js
git commit -m "feat: teardrop bubble canopy on WW2 fighter"
```

---

### Task 4: Longer pointed nose + spinner

**Files:**
- Modify: `lib/plane/ww2-fighter.js`

Lengthen the spinner into a more pointed Merlin-engine cone and trim the engine-nose block so the front silhouette tapers smoothly.

- [ ] **Step 1: Update nose + spinner geometry**

Find this block:

```js
  // Engine nose
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.4, 8), mat(STEEL));
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -3.7;
  g.add(nose);

  // Spinner
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 8), mat(STEEL));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -4.6;
  g.add(spinner);

  // Propeller
  const propGroup = new THREE.Group();
  propGroup.position.z = -4.95;
```

Replace with:

```js
  // Engine nose — slimmer and slightly longer to read as a Merlin V-12 cowling.
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.8, 8), mat(OLIVE));
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -3.9;
  g.add(nose);

  // Spinner — long pointed Spitfire-style cone.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 8), mat(STEEL));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -5.2;
  g.add(spinner);

  // Propeller
  const propGroup = new THREE.Group();
  propGroup.position.z = -5.85;
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Visual check**

Refresh → WW2 Fighter → Fly. The nose should now taper more cleanly to a pointed spinner, and the prop should still spin (verifies `g.userData.propeller` reassignment isn't needed — propGroup is still the same reference).

- [ ] **Step 4: Commit**

```bash
git add lib/plane/ww2-fighter.js
git commit -m "feat: longer pointed Spitfire spinner + slimmer cowling"
```

---

### Task 5: Place RAF roundels on wings and fuselage

**Files:**
- Modify: `lib/plane/ww2-fighter.js`

Use the helper from Task 1 to place 6 roundels: wing tops (L+R), wing bottoms (L+R, facing down), fuselage sides (L+R, facing sideways).

- [ ] **Step 1: Add roundel placements**

Add this block in `lib/plane/ww2-fighter.js`, just **before** the `return g;` line at the end of `buildWW2Fighter`:

```js
  // RAF roundels. Float a tiny offset above each surface to avoid z-fighting.
  const wingRoundelD = 1.4;
  const fuseRoundelD = 0.9;

  // Wing tops (L + R) — sit on the upper wing surface, near mid-span.
  for (const sx of [-3.2, 3.2]) {
    const r = makeRoundel(THREE, wingRoundelD);
    r.position.set(sx, -0.18, -1.3); // wing top is at y = -0.30 + 0.20/2 + ε
    g.add(r);
  }

  // Wing bottoms (L + R) — flip 180° around Z so the colored faces point down.
  for (const sx of [-3.2, 3.2]) {
    const r = makeRoundel(THREE, wingRoundelD);
    r.rotation.z = Math.PI;
    r.position.set(sx, -0.42, -1.3); // wing bottom at y = -0.30 - 0.20/2 - ε
    g.add(r);
  }

  // Fuselage sides (L + R) — rotate so the roundels lie on the side walls
  // (normal = ±X). Position aft of the wing trailing edge.
  for (const side of [-1, 1]) {
    const r = makeRoundel(THREE, fuseRoundelD);
    r.rotation.z = side * Math.PI / 2;
    r.position.set(side * 0.56, 0.0, 1.6); // fuselage radius ~0.55 + ε
    g.add(r);
  }
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Visual check**

Refresh → WW2 Fighter → Fly. You should see:
- Two roundels on the wing top in level flight (chase cam looking down at wings).
- Roll inverted (or pull up high enough to look at the underside): two roundels on the wing bottom.
- Bank into a turn: a roundel visible on the fuselage side.

If any roundel z-fights (flickers) with the surface beneath it, bump its position offset away from the surface by an additional 0.01–0.02. If the wing-bottom roundels look upside-down (colors stacked backwards), the `rotation.z = Math.PI` is hiding them — try removing it instead (the circle should still be visible from below since `MeshPhongMaterial` is double-sided when `side: THREE.DoubleSide` — but our material isn't double-sided, so the flip IS required; double-check the offset sign first).

- [ ] **Step 4: Commit**

```bash
git add lib/plane/ww2-fighter.js
git commit -m "feat: RAF roundels on WW2 fighter wings + fuselage"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full visual sweep**

In `http://localhost:8085/` → WW2 Fighter → Fly:
- Chase cam straight-and-level: silhouette reads as a Spitfire (elliptical wings, bubble canopy, long pointed nose).
- Wing-top roundels visible.
- Roll: wing-bottom roundels visible from below; fuselage roundels visible from the side.
- Prop still spins.
- No clipping between the new wing and the fuselage / canopy.

- [ ] **Step 2: Run the full test suite once more**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Bump the patch version**

Open `package.json` and `lib/version.js` and bump the patch number (e.g. `0.1.146` → `0.1.147`). The project's convention (visible in `git log`) is to bump per feature commit-set.

- [ ] **Step 4: Commit the version bump**

```bash
git add package.json lib/version.js
git commit -m "chore: v0.1.147 (Spitfire-look WW2 fighter)"
```

---

## Self-Review Notes

- **Spec coverage:** silhouette (wings T2, canopy T3, nose T4) and roundels (helper T1, placements T5) all covered. Out-of-scope items (camo, leading-edge stripe, codes) intentionally absent.
- **Module surface:** `buildWW2Fighter(THREE)` signature unchanged; `g.userData.propeller = propGroup` line preserved through Task 4 (only `propGroup.position.z` moves; the assignment two lines below is unaffected).
- **Test coverage:** `tests/planes.test.js` exercises only the roster registry (stats, prices, ordering), so geometry edits cannot break it. The verification loop is browser-visual at each task — the spec accepts this.
- **Coordinate sanity:** wing rotation derivation noted inline at Task 2 so the executor can self-correct sign errors without reverting the whole task.

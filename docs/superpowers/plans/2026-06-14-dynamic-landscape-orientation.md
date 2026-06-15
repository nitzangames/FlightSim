# Dynamic Landscape Orientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game's DOM UI follow the actual drawable-box shape — filling the box and staying legible in landscape, behaving exactly as today in portrait, switching live on device rotation.

**Architecture:** The 3D cameras already adapt to any aspect via `resize()`. We add (1) a pure `pickOrientation(w,h)` helper + a DOM `applyOrientation()` that toggles a `landscape` class on `#ui-root`, (2) a CSS rule that makes `#ui-root.landscape` fill the box, and (3) a `cqi`→`cqmin` unit swap across the UI so text sizes off the short dimension in landscape (a no-op in portrait). Triggers: boot, `window` resize, and `PlaySDK.onOrientationChange` (feature-detected).

**Tech Stack:** Vanilla ES modules, Three.js (r128), CSS container queries (`container-type: size`), Vitest, PlaySDK.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/ui/orientation.js` (new) | Pure helper `pickOrientation(w, h)` — the single decision rule. Importable + testable with no DOM. |
| `tests/orientation.test.js` (new) | Unit tests for `pickOrientation`. |
| `index.html` (modify) | Add `#ui-root.landscape` fill rule; update the `#ui-root` comment. |
| `shell/main.js` (modify) | Import `pickOrientation`; add `applyOrientation()` + `onViewportChange()`; wire boot + resize + `PlaySDK.onOrientationChange`. |
| `lib/ui/hud.js`, `lib/ui/menu.js`, `lib/ui/settings-panel.js`, `lib/ui/crash-overlay.js` (modify) | Replace `cqi` units with `cqmin`. |

---

## Task 1: Pure orientation helper + tests

**Files:**
- Create: `lib/ui/orientation.js`
- Test: `tests/orientation.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/orientation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { pickOrientation } from '../lib/ui/orientation.js';

describe('pickOrientation', () => {
  it('returns landscape when width exceeds height', () => {
    expect(pickOrientation(800, 360)).toBe('landscape');
  });

  it('returns portrait when height exceeds width', () => {
    expect(pickOrientation(1080, 1920)).toBe('portrait');
  });

  it('treats a square box as portrait (w not greater than h)', () => {
    expect(pickOrientation(500, 500)).toBe('portrait');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/orientation.test.js`
Expected: FAIL — cannot resolve `../lib/ui/orientation.js` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

Create `lib/ui/orientation.js`:

```js
// Pure orientation decision shared by the shell. Driven by the actual drawable
// box shape (canvas client size), NOT PlaySDK.getOrientation(): on narrow
// phones the platform keeps the iframe a portrait strip even when the device is
// landscape, so the box shape is what the UI must match. `landscape` only when
// the box is genuinely wider than tall.
export function pickOrientation(w, h) {
  return w > h ? 'landscape' : 'portrait';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/orientation.test.js`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add lib/ui/orientation.js tests/orientation.test.js
git commit -m "feat: pure pickOrientation helper for box-shape-driven layout"
```

---

## Task 2: `#ui-root.landscape` fill rule in index.html

**Files:**
- Modify: `index.html` (the `#ui-root` rule, around lines 52-65)

- [ ] **Step 1: Update the `#ui-root` comment and add the landscape rule**

In `index.html`, find the existing `#ui-root` block:

```css
    /* DOM UI (menu, HUD, overlays) stays in a centered 9:16 portrait column
       even when the 3D view fills a wide desktop window — so the cqi-based
       layout keeps the exact proportions it has on mobile. container-type:size
       makes every cqi unit inside resolve to THIS box, not the full window.
       On a portrait iframe the box already equals the whole stage. */
    #ui-root {
      position: absolute;
      top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(100vw, calc(100vh * 9 / 16));
      height: min(100vh, calc(100vw * 16 / 9));
      container-type: size;
      pointer-events: none; z-index: 50;
      overflow: hidden;
    }
```

Replace it with:

```css
    /* DOM UI (menu, HUD, overlays). Default: a centered 9:16 portrait column,
       so on a portrait box it equals the whole stage and the cq-based layout
       keeps its mobile proportions. When the drawable box is landscape the
       shell adds the `landscape` class (see shell/main.js applyOrientation) and
       #ui-root fills the box instead. container-type:size makes every cq* unit
       inside resolve to THIS box; the UI uses cqmin so text sizes off the short
       dimension in either orientation. */
    #ui-root {
      position: absolute;
      top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(100vw, calc(100vh * 9 / 16));
      height: min(100vh, calc(100vw * 16 / 9));
      container-type: size;
      pointer-events: none; z-index: 50;
      overflow: hidden;
    }
    /* Landscape: fill the wide box edge-to-edge instead of the portrait column. */
    #ui-root.landscape {
      top: 0; left: 0; transform: none;
      width: 100%; height: 100%;
    }
```

- [ ] **Step 2: Sanity-check the file parses (no test harness for HTML; visual check)**

Run: `node --check index.html 2>/dev/null || echo "html (not JS) — skip node --check"`
Expected: prints the skip message (index.html is not JS). Confirm by eye that the new `#ui-root.landscape` block is present and the default `#ui-root` rule is intact.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: #ui-root.landscape fills the box in landscape"
```

---

## Task 3: Swap `cqi` → `cqmin` across the UI

**Files:**
- Modify: `lib/ui/hud.js`, `lib/ui/menu.js`, `lib/ui/settings-panel.js`, `lib/ui/crash-overlay.js`

Rationale: `cqi` keys off the container's width; in a landscape box width is the long dimension so `cqi` text balloons. `cqmin` keys off the smaller dimension, so it equals `cqi` in portrait (zero regression) and stays sane in landscape. `#ui-root` already has `container-type: size`, which `cqmin` requires.

- [ ] **Step 1: Replace every `cqi` token with `cqmin` in the four UI files**

Run (in repo root):

```bash
sed -i '' 's/cqi/cqmin/g' lib/ui/hud.js lib/ui/menu.js lib/ui/settings-panel.js lib/ui/crash-overlay.js
```

- [ ] **Step 2: Verify no `cqi` remains and counts moved to `cqmin`**

Run: `grep -rn "cqi" lib/ui/ ; echo "---" ; grep -rc "cqmin" lib/ui/*.js`
Expected: the first grep prints nothing (no bare `cqi` left); the second shows non-zero `cqmin` counts for hud.js, menu.js, settings-panel.js, crash-overlay.js (matching the prior cqi counts: hud 14, menu 15, settings-panel 10, crash-overlay 2).

- [ ] **Step 3: Run the full test suite (no UI regressions expected; ensures nothing imports broke)**

Run: `npm test`
Expected: PASS (all existing suites + Task 1's orientation test).

- [ ] **Step 4: Commit**

```bash
git add lib/ui/hud.js lib/ui/menu.js lib/ui/settings-panel.js lib/ui/crash-overlay.js
git commit -m "feat: size UI off cqmin so text stays sane in landscape"
```

---

## Task 4: Wire orientation into the shell

**Files:**
- Modify: `shell/main.js` — import (top, near line 19-24 with the other `lib/ui` imports); `resize()` block (lines 121-128).

- [ ] **Step 1: Add the import**

In `shell/main.js`, alongside the other `lib/ui` imports (e.g. after `import { buildCrashOverlay } from '../lib/ui/crash-overlay.js';`), add:

```js
import { pickOrientation } from '../lib/ui/orientation.js';
```

- [ ] **Step 2: Replace the resize wiring with orientation-aware wiring**

In `shell/main.js`, find:

```js
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  worldCam.aspect = w / h; worldCam.updateProjectionMatrix();
  menuCam.aspect  = w / h; menuCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
```

Replace it with:

```js
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  worldCam.aspect = w / h; worldCam.updateProjectionMatrix();
  menuCam.aspect  = w / h; menuCam.updateProjectionMatrix();
}

// Toggle the landscape UI layout to match the actual drawable box. Driven by
// the canvas client size (not PlaySDK.getOrientation): on narrow phones the
// platform keeps the iframe a portrait strip even when the device is landscape,
// so the box shape is what the UI must follow.
function applyOrientation() {
  const landscape = pickOrientation(canvas.clientWidth, canvas.clientHeight) === 'landscape';
  uiRoot.classList.toggle('landscape', landscape);
}

// Single entry point for any viewport change: re-base the cameras AND re-pick
// the UI orientation.
function onViewportChange() {
  resize();
  applyOrientation();
}

window.addEventListener('resize', onViewportChange);
// PlaySDK.onOrientationChange is the platform-sanctioned signal: window resize
// can fire with stale dimensions right after a rotation, and the letterboxed
// iframe makes window.matchMedia unreliable. Feature-detected — absent in local
// dev, tests, and signed-out web, where the resize listener already covers us.
if (window.PlaySDK && typeof window.PlaySDK.onOrientationChange === 'function') {
  try { window.PlaySDK.onOrientationChange(onViewportChange); } catch {}
}
onViewportChange();
```

- [ ] **Step 3: Run the test suite (guards against syntax/import errors in main.js's module graph)**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 4: Manual smoke in the browser**

Run: `npm run dev` then open `http://localhost:8085`.
Verify:
- Desktop wide window → UI fills the box (landscape layout), text legible (no ballooning).
- Narrow the window until it's taller than wide → UI returns to the centered portrait column, identical to before.
- DevTools device toolbar: rotate a ≥768px device (e.g. iPad) portrait↔landscape → UI + 3D view reflow live; rotate a narrow phone → stays portrait (box stays a strip).

(Note: `PlaySDK.onOrientationChange` is inert on localhost — the resize listener drives the switch in the browser; the SDK path only matters on `nitzan.games`.)

- [ ] **Step 5: Commit**

```bash
git add shell/main.js
git commit -m "feat: switch UI layout on orientation/box change"
```

---

## Task 5: Version bump

**Files:**
- Modify: `lib/version.js`, `package.json`

- [ ] **Step 1: Read the current version**

Run: `grep -n VERSION lib/version.js ; grep -n version package.json`
Note the current `VERSION` string (e.g. `v0.1.172`) and `package.json` version.

- [ ] **Step 2: Bump both by one patch level**

Edit `lib/version.js` to the next patch (e.g. `v0.1.172` → `v0.1.173`) and set the matching value in `package.json` (`0.1.172` → `0.1.173`). Keep the formats each file already uses.

- [ ] **Step 3: Commit**

```bash
git add lib/version.js package.json
git commit -m "vX.Y.Z — dynamic landscape orientation support"
```

(Replace `vX.Y.Z` with the actual bumped version.)

---

## Self-Review notes

- **Spec coverage:** box-shape-driven decision (Task 1 + Task 4), `#ui-root` fills in landscape (Task 2), `cqi`→`cqmin` sizing (Task 3), boot + resize + `PlaySDK.onOrientationChange` triggers (Task 4), narrow-phone "stays portrait" (falls out of box-shape logic — verified in Task 4 Step 4), desktop behavior change (intentional, accepted by user). All covered.
- **Type consistency:** `pickOrientation(w, h)` defined in Task 1, imported/used identically in Task 4. `applyOrientation()` / `onViewportChange()` names consistent within Task 4 and referenced in the index.html comment (Task 2).
- **Placeholder scan:** version bump uses `vX.Y.Z` only as an explicit "replace with actual" placeholder for the commit message; the value is read live in Step 1. No other placeholders.

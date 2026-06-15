# Dynamic Landscape Orientation — Design

**Date:** 2026-06-14
**Status:** Draft, pending user review
**Scope:** Game-side only (`index.html`, `shell/main.js`, `lib/ui/*.js`, one test). No platform changes.

## Problem

The PlaySDK platform now supports landscape. Two independent mechanisms exist:

- **`desktop_fill: true`** (already set in `meta.json`) — on viewports **≥768px** the platform drops the 9:16 portrait lock and lets the iframe fill the window. On narrower viewports the iframe stays a **letterboxed 9:16 portrait strip regardless of device orientation**.
- **`PlaySDK.getOrientation()` / `onOrientationChange(cb)`** — the reliable device-orientation signal. Needed because the letterboxed iframe makes `window.innerWidth/innerHeight` and `matchMedia` report portrait even when the phone is held landscape.

Today the game's **3D view already adapts to any aspect** (`resize()` in `shell/main.js:121` re-bases both cameras off the canvas box). The gap is the **DOM UI**: `#ui-root` (`index.html:57`) is hard-locked to a centered 9:16 portrait column via `container-type:size` + `cqi` units, so on a wide landscape box the HUD/menu stay a narrow centered column and the side space is wasted.

**Goal:** when the drawable box is landscape the UI fills it and stays legible; when portrait it behaves exactly as today; switching is automatic and live when the device rotates.

## Key constraint and what "landscape" means here

The iframe box only actually becomes landscape on **≥768px** devices (tablets, large phones, desktop) — per the user's decision we **accept the platform behavior**: layout follows the *actual drawable box shape*, not a forced device-orientation override. Consequences:

- Narrow phone (<768px), any rotation → box stays a portrait strip → UI stays portrait (correct; the game can't draw outside the strip anyway).
- Wide device rotated landscape → box becomes wide → UI goes landscape.
- Rotating a wide device flips the box aspect → a `resize` fires → CSS + cameras reflow live.

Driving off the box aspect (rather than `getOrientation()` alone) is what makes the narrow-phone case "just work" and keeps the UI matching the box it's drawn into. `onOrientationChange` is wired as an **additional** trigger so cameras/measurement re-run promptly even on browsers that fire `orientationchange` before a stale-dimensioned `resize`.

## Approach (decision: "minimal adapt")

Keep the existing corner-anchored HUD/menu layout. Two changes make it land correctly in a wide box:

### 1. `#ui-root` fills the box in landscape — `.landscape` class toggle

- Default (portrait) CSS for `#ui-root` is unchanged (centered 9:16 column).
- New rule `#ui-root.landscape { inset: 0; width: 100%; height: 100%; }` makes it fill the box. `container-type: size` stays, so `cq*` units resolve to this box.
- A small helper toggles the class based on the measured canvas box.

### 2. Font/element sizing: `cqi` → `cqmin` across the UI

`cqi` = 1% of the container's **inline (width)** size. In a portrait box width is the short dimension (good); in a landscape box width is the **long** dimension, so `cqi` text balloons. `cqmin` = 1% of the container's **smaller** dimension, so:

- Portrait box: `cqmin == cqi` (width is smaller) → **zero change / zero regression**.
- Landscape box: `cqmin` keys off height (short dim) → text and elements stay sane.

This is a mechanical replace of `cqi` → `cqmin` in `lib/ui/hud.js`, `lib/ui/menu.js`, `lib/ui/settings-panel.js`, `lib/ui/crash-overlay.js`. (`index.html`'s only `cqi` mentions are in comments.) `cqmin` requires `container-type: size`, which `#ui-root` already has.

Percentage positions (`top/left/right/bottom: X%`) are left as-is: corner-anchored and centered elements remain in their corners/centered in a wide box, which is acceptable for "minimal adapt."

### 3. Orientation wiring in `shell/main.js`

- New pure helper `pickOrientation(w, h)` → `'landscape' | 'portrait'` (`landscape` when `w > h`). Unit-tested.
- New `applyOrientation()` measures `canvas.clientWidth/clientHeight`, sets/removes `landscape` on `#ui-root`.
- A single `onViewportChange()` calls `resize()` (cameras) **and** `applyOrientation()`.
- Triggers: at boot; on `window` `resize` (replaces the bare `resize` listener); and via `window.PlaySDK.onOrientationChange(onViewportChange)` when the SDK is present (guarded — absent in local dev / tests / signed-out web).
- `getOrientation()` is not strictly required as a source of truth (the box measurement is), but the `onOrientationChange` subscription is the platform-sanctioned signal that guarantees we re-measure right after a rotation.

## Components touched

| File | Change |
|------|--------|
| `index.html` | Add `#ui-root.landscape` fill rule; refresh the `#ui-root` comment to note the landscape mode. |
| `shell/main.js` | `pickOrientation()`, `applyOrientation()`, `onViewportChange()`; wire boot + resize + `PlaySDK.onOrientationChange`. |
| `lib/ui/hud.js`, `menu.js`, `settings-panel.js`, `crash-overlay.js` | `cqi` → `cqmin`. |
| `tests/orientation.test.js` (new) | Unit-test `pickOrientation`. |

## Data flow

device rotates / window resizes → `resize`/`orientationchange` → `onViewportChange()` → `resize()` re-bases cameras + `applyOrientation()` toggles `#ui-root.landscape` → CSS reflows the UI; `cqmin` re-resolves font sizing off the new short dimension.

## Error handling / edge cases

- **PlaySDK absent** (local dev, vitest, signed-out web): the `onOrientationChange` hook is feature-detected and skipped; the `resize` listener + boot call still drive everything on devices where the box actually changes.
- **Near-square box:** `w > h` is a clean threshold; mobile boxes are never square, so no flicker risk.
- **Initial paint:** `applyOrientation()` runs once at boot (alongside the existing `resize()` call) so the first frame is already correct.

## Deliberate behavior change to flag

This makes the UI follow the box on **desktop too**: a wide desktop window currently shows a centered 9:16 portrait UI column (an intentional choice noted in `index.html`). After this change a wide desktop box gets the landscape (filled) UI. This is consistent with "add landscape support," but it is a visible change to existing desktop behavior — calling it out for the review gate. (If undesired, the `.landscape` toggle can later be gated to exclude desktop; not planned for now.)

## Testing

- Unit: `pickOrientation(w,h)` returns `landscape` for `w>h`, `portrait` otherwise.
- Manual / visual: portrait phone (unchanged), wide landscape box (UI fills, text legible), live rotation on a ≥768px device (UI + cameras reflow), narrow phone rotated (stays portrait strip — correct).
- Regression: existing portrait rendering unchanged (`cqmin == cqi` in portrait).

## Out of scope

- Changing the iframe aspect / letterbox (platform-owned; explicitly out of scope per the platform's orientation spec).
- Counter-rotating the stage to fill narrow phones.
- A bespoke per-element landscape layout (chose "minimal adapt").

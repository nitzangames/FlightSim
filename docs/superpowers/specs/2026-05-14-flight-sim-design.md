# Flight Sim — design spec

**Date:** 2026-05-14
**Slug:** `flight-sim`
**Status:** design approved; ready for plan

## Goal

A pure free-roam flight sandbox for the nitzan.games platform. Player picks a plane, the world (procedural terrain) is the same every flight via a persistent seed, and they fly until they crash or back out. No missions, no upgrades, no economy.

Reuses two existing JSGames projects as source libraries:
- **ProceduralTerrain3D** — open-world chunk-streaming terrain (mountains, rivers, lakes, forests, sky dome, fog).
- **CanyonRun3D** — six plane meshes, plane physics, drag-and-keyboard input controller, chase camera.

## Product decisions (locked)

| Decision | Choice |
|---|---|
| Genre | Free-roam sandbox (no missions, no fail-state economy) |
| Engagement loop | Pure sandbox — no coins, no unlocks, no progression |
| Controls | CanyonRun3D `DragInput` (touch/mouse drag + WASD/Arrows) |
| Start state | Already airborne at a deterministic spawn |
| Crash behavior | 1.5s "Crashed" overlay → back to plane-picker menu |
| Plane roster | All 6 from CanyonRun3D, free choice (biplane, triplane, WW2 fighter, F-86, F-15, F-22) |
| World style | Player-selectable from menu (lowpoly / stylized / realistic / cartograph) |
| In-flight HUD | Minimal: speed, altitude above ground, version stamp |
| World seed | Persisted in localStorage — same world every flight and across reloads |
| Menu layout | Layout B (Hero preview): plane preview fills top 58%, name + arrows + stats, big FLY button anchored bottom |
| World loading | Pre-streams in MENU so taps to FLY are instant; rendered in a separate `worldScene` invisible during MENU |

## Architecture

### Approach

Approach B from brainstorming: **fresh shell, vendor only the libs we need.** The FlightSim directory is the deployable unit (game is shipped as a zip); we vendor (copy, not symlink) the `lib/terrain` tree from ProceduralTerrain3D and the `lib/plane` tree from CanyonRun3D, then write a small new shell on top. ~200 lines of new shell code, ~500 total LOC outside vendored libs.

### File layout

```
FlightSim/
├── index.html               # 1080×1920 portrait stage, PlaySDK + three.js r128, boot screen
├── meta.json                # slug=flight-sim, title, description, tags, author, thumbnail
├── package.json             # name, "dev": "python3 -m http.server 8085"
├── thumbnail.png            # captured from real three.js (per platform rule)
├── shell/
│   └── main.js              # boot, render loop, state machine, visibility pause, PlaySDK.ready
├── lib/
│   ├── version.js           # export const VERSION = '0.1.0'
│   ├── terrain/             # VENDORED from ProceduralTerrain3D
│   │   ├── index.js  carve.js  chunk-*.js  height.js  noise.js
│   │   ├── river-graph.js  style-system.js  trees.js  water.js
│   ├── plane/               # VENDORED from CanyonRun3D
│   │   ├── biplane.js  triplane.js  ww2-fighter.js
│   │   ├── f86.js  f15.js  f22.js
│   │   ├── controller.js    # PlanePhysics + DragInput
│   │   └── camera.js        # ChaseCamera
│   ├── game/
│   │   ├── planes.js        # PLANES map: name + base stats from CanyonRun, fuelDrainRate=0
│   │   ├── collision.js     # crashed(physics, terrain, radius) — terrain-height test
│   │   └── state.js         # tiny StateMachine (copy from CanyonRun)
│   └── ui/
│       ├── menu.js          # plane picker (layout B) + style dropdown
│       ├── hud.js           # speed + altitude + version + back button
│       └── crash-overlay.js # 1.5s "Crashed" flash
└── tests/                   # vitest unit tests
    ├── planes.test.js
    ├── collision.test.js
    └── state.test.js
```

**Notes:**
- Vendoring is a one-time copy. Edits to ProceduralTerrain3D or CanyonRun3D do NOT propagate; FlightSim owns its copies after the initial pull. To refresh, re-copy intentionally.
- Dev port `8085` (8080=ProceduralTerrain3D, 8084=CanyonRun3D, 8083=EmojiSmash3D).
- Three.js r128 via CDN. PlaySDK injected by the platform on deploy.

### Components & interfaces

**Vendored (don't modify):**
- `lib/terrain/index.js` — `createTerrain({ THREE, scene, renderer, style, perfMode })` → `{ update(cameraPos), setStyle(s), setPerfMode(m), getHeight(x,z), dispose(), sun, hemi, skyDome, water, terrainMaterial }`. Chunks stream around the camera position passed to `update()`.
- `lib/plane/{biplane,triplane,ww2-fighter,f86,f15,f22}.js` — `buildXxx(THREE)` → `THREE.Group` with `userData.propeller` (mesh) for spin animation. Forward = -Z.
- `lib/plane/controller.js` — `PlanePhysics(cfg)` with `update({dragX,dragY,dt})`; `DragInput(canvas)` with `read()` → `{dragX,dragY}` and `resetStick()`. Supports touch, mouse, WASD, and arrow keys.
- `lib/plane/camera.js` — `ChaseCamera(THREE, camera)` with `update(physics, dt)`.

**New code:**

`lib/game/planes.js` — pure data + builder lookup.

```js
import { buildBiplane }    from '../plane/biplane.js';
import { buildTriplane }   from '../plane/triplane.js';
import { buildWW2Fighter } from '../plane/ww2-fighter.js';
import { buildF86 }        from '../plane/f86.js';
import { buildF15 }        from '../plane/f15.js';
import { buildF22 }        from '../plane/f22.js';

export const PLANES = {
  biplane:  { key:'biplane',  name:'WW1 Biplane',   build: buildBiplane,    stats: { maxSpeed:60,  maxPitchRate:0.45, maxYawRate:0.45, fuelDrainRate:0, maxFuel:1, collisionRadius:3.7 } },
  triplane: { key:'triplane', name:'WW1 Triplane',  build: buildTriplane,   stats: { maxSpeed:75,  maxPitchRate:0.55, maxYawRate:0.55, fuelDrainRate:0, maxFuel:1, collisionRadius:3.2 } },
  ww2:      { key:'ww2',      name:'WW2 Fighter',   build: buildWW2Fighter, stats: { maxSpeed:95,  maxPitchRate:0.55, maxYawRate:0.55, fuelDrainRate:0, maxFuel:1, collisionRadius:5.7 } },
  f86:      { key:'f86',      name:'F-86 Sabre',    build: buildF86,        stats: { maxSpeed:130, maxPitchRate:0.65, maxYawRate:0.65, fuelDrainRate:0, maxFuel:1, collisionRadius:4.5 } },
  f15:      { key:'f15',      name:'F-15 Eagle',    build: buildF15,        stats: { maxSpeed:160, maxPitchRate:0.75, maxYawRate:0.75, fuelDrainRate:0, maxFuel:1, collisionRadius:6.5 } },
  f22:      { key:'f22',      name:'F-22 Raptor',   build: buildF22,        stats: { maxSpeed:200, maxPitchRate:0.85, maxYawRate:0.85, fuelDrainRate:0, maxFuel:1, collisionRadius:6.8 } },
};

export const PLANE_ORDER = ['biplane','triplane','ww2','f86','f15','f22'];
```

Stats are the CanyonRun3D `base` values (not maxed). `fuelDrainRate: 0` ensures the engine never quits in the sandbox. `coinValue` / `magnetRadius` / `coinMultiplier` from CanyonRun's config are deleted — unused.

`lib/game/collision.js`:

```js
export function crashed(physics, terrain, radius) {
  if (!terrain) return false;
  const groundY = terrain.getHeight(physics.x, physics.z);
  return physics.y - radius <= groundY;
}
```

No canyon walls, no obstacle list. Just a terrain-height test. `radius` comes from `PLANES[key].stats.collisionRadius`.

`lib/game/state.js` — copy `StateMachine` verbatim from `CanyonRun3D/lib/game/state.js` (~30 lines, generic enough to reuse).

`lib/ui/menu.js` — `buildMenu({ root, scene, camera, currentPlane, currentStyle, onPlay(planeKey), onPlaneChange(key), onStyleChange(style) })` → `{ update({currentPlane,currentStyle}), dispose() }`. Mounts layout B HTML onto `root`. Owns a turntable rig (`THREE.Group`) added to the provided `menuScene`; swaps the plane mesh inside it on `onPlaneChange`. Auto-rotates the group each frame at 0.5 rad/s.

`lib/ui/hud.js` — `buildHUD({ root, version, onBack })` → `{ update({speed,altitude,countdown}), dispose() }`. Bottom-left `SPEED ## m/s / ALT ## m`, top-left back button (pointer-events:auto), centered countdown digit during pre-flight, version stamp bottom-center.

`lib/ui/crash-overlay.js` — `buildCrashOverlay({ root, durationMs:1500, onComplete })` → `{ dispose() }`. Shows centered "✕ CRASHED" red text; schedules `onComplete` after `durationMs`.

`shell/main.js` — owns the scene graph, state machine, active UI slot, visibility pause, PlaySDK signal.

### State machine & data flow

Three states. Terrain object exists for the entire session (built once at boot).

```
                    pick plane → tap Fly
       ┌──────────────────────────────────────────►   FLYING
       │            (world already streamed)            │
     MENU  ◄────────────── 1.5s timer ──── CRASH ◄──────┘
 (renders menuScene,                       (renders
  worldScene streams                         worldScene
  in background)                             frozen)
```

**Two scenes:** `worldScene` (terrain + plane + lights, rendered in FLYING/CRASH) and `menuScene` (the turntable rig only, rendered in MENU). Single shared `WebGLRenderer`. Two cameras: `worldCam` driven by `ChaseCamera`, `menuCam` aimed at the turntable origin.

**Boot order:**

1. Build renderer, two scenes (`menuScene`, `worldScene`), two cameras. Canvas + boot screen.
2. Read or mint `flightsim.seed`, `flightsim.plane`, `flightsim.style` from localStorage.
3. `startWorld(seed, style)` — build `terrain` into `worldScene` via `createTerrain(...)`, build plane mesh for `currentPlane`, build `physics` parked at deterministic spawn `(0, terrain.getHeight(0,0)+120, 0)`, build `chase`. `worldReady = true`.
4. Build turntable rig in `menuScene` with a clone of `currentPlane`'s mesh.
5. `sm.start()` → enters MENU. Renderer draws `menuScene`. Terrain streams invisibly in `worldScene` via per-frame `terrain.update(spawnPos)`.
6. `requestAnimationFrame(frame)` starts the loop.
7. `PlaySDK.ready()` on the next tick.

**Per-frame frame loop:**

- MENU: `terrain.update(spawnPos)` (background streaming using spawn point as reference) → turntable rotation → `renderer.render(menuScene, menuCam)`.
- FLYING (countdown or active): physics + chase + `terrain.update(camera.position)` → `renderer.render(worldScene, worldCam)`.
- CRASH: no updates, just `renderer.render(worldScene, worldCam)` (frozen frame).

**MENU**
- *Enter:* mount picker UI on `uiRoot`. Active render switches to `menuScene`.
- *On style change:* `terrain.setStyle(newStyle)` immediately (worldScene re-palettes invisibly), persist `flightsim.style`.
- *On plane change:* if different from current, swap the turntable mesh AND swap the worldScene plane mesh (helper `setPlane(planeKey)`), reset `physics` to spawn pose, persist `flightsim.plane`.
- *On Play:* transition to FLYING.

**FLYING**
- *Enter:* mount HUD. Reset physics pose to spawn. Reset `DragInput` stick. Set `flyingCountdown = 1.5s` for a "3, 2, 1, GO" beat (terrain was pre-streamed in MENU). Active render → `worldScene`.
- *Update(dt):* countdown → freeze plane, render world. Else `physics.update({...input.read(), dt})`, `clampToCeiling(physics)`, update mesh pose, spin propeller proportional to `physics.speed`, `chase.update(physics, dt)`, `terrain.update(camera.position)`, HUD updates with `{speed: physics.speed, altitude: physics.y - terrain.getHeight(physics.x, physics.z)}`. If `crashed(physics, terrain, radius)` → state CRASH.
- *Back button:* tap → reset physics to spawn → state MENU.

**CRASH**
- *Enter:* mount crash overlay (1.5s). Stop propeller spin. Plane mesh stays where it crashed. No physics, no terrain streaming, no chase movement.
- *Exit:* timer fires → reset physics to spawn → state MENU.

**Why this works:**
- Terrain built once for the session; never torn down.
- Streaming happens continuously in MENU using the spawn position as the camera reference, so chunks are already loaded when FLYING starts.
- Seed persistence means reloads land in the same world.
- Plane swaps in MENU are cheap (mesh swap only; physics + chase reused).
- Style swaps repaint terrain invisibly during MENU; player sees the result on next flight.

## UI — Layout B (Hero preview)

### MENU

```
┌─────────────────────────────────────┐
│                       CARTOGRAPH ▾  │  ← Subheading 66 (canvas px), top-right
│                                     │
│        [ 3D plane preview ]         │  ← worldCam → menuScene turntable rig,
│         (real three.js,              │     fills top ~58% of stage; renders
│          rotates 0.5 rad/s)         │     the actual plane mesh
│                                     │
│           WW1 BIPLANE               │  ← Heading 90, centered
│                                     │
│  ◄        SPEED ███░░░       ►      │  ← Arrows flanking stat readout
│           AGILITY ██░░░             │     (Body 36 for stats)
│                                     │
│         ┌─────────────┐             │
│         │     FLY     │             │  ← big primary button, full-width-ish
│         └─────────────┘             │
│                                     │
│              v0.1.0                 │  ← Caption 21, bottom-center
└─────────────────────────────────────┘
```

- **Style dropdown** (top-right): native `<select>`, four options (lowpoly / stylized / realistic / cartograph), styled to fit the dark palette. On change → `terrain.setStyle(newStyle)` + persist.
- **Plane preview**: occupies top ~58% of the stage. The `menuScene` turntable rig holds the currently-selected plane mesh, rotated about Y at 0.5 rad/s by the menu update loop. Lit by a hemisphere light + directional light shared by both scenes.
- **Plane name** (Heading 90): from `PLANES[currentPlane].name`.
- **Stat bars** (Body 36): visual `stats.maxSpeed / 200` and `stats.maxPitchRate / 0.85` ratios as filled-block character glyphs (`███░░░`). No numbers.
- **◄ / ►**: cycle through `PLANE_ORDER`. Each press calls `onPlaneChange(nextKey)`.
- **FLY**: large pointer-events:auto button. Tap → `onPlay()`.
- **Version stamp** (Caption 21): bottom-center, opacity 0.4.

### In-flight HUD

```
┌─────────────────────────────────────┐
│  ◄                                  │  ← back arrow, top-left, pointer-events:auto
│                                     │
│                                     │
│         (world fills frame)         │
│                                     │
│                                     │
│  SPEED   142 m/s                    │  ← Body 36, mono, bottom-left
│  ALT     387 m                      │
│                                     │
│              v0.1.0                 │  ← Caption 21, bottom-center
└─────────────────────────────────────┘
```

- The HUD wrapper has `pointer-events: none` so drags pass through to the canvas; the back button has `pointer-events: auto` on itself.
- **Speed**: `Math.round(physics.speed)`.
- **Altitude**: `Math.round(physics.y - terrain.getHeight(physics.x, physics.z))` — above ground, not sea level.
- **Countdown overlay** (active during `flyingCountdown > 0`): big centered "3 / 2 / 1 / GO" replacing the HUD's center while it counts.
- **Back button**: tap → state MENU (no crash anim).

### Crash overlay

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│            ✕ CRASHED                │  ← Heading 90, centered, red-ish
│            (1.5s fade)              │
│                                     │
│              v0.1.0                 │
└─────────────────────────────────────┘
```

- Translucent text overlay for 1.5s. Below it, `worldScene` is frozen at the crash frame. No tap targets; auto-transitions to MENU.

### Styling

- Type ladder (canvas-px from the platform's GAME_DEV_NOTES): **Title 126 / Heading 90 / Subheading 66 / Body 36 / Caption 21**. Sized in `cqi` so they scale with the letterboxed stage.
- Stage: `aspect-ratio: 9/16`, `container-type: size`, identical to CanyonRun3D's `index.html`. UI lives inside the stage so text never leaks onto letterbox bars.
- `menuScene` background color: `#0a0e14` (dark, plane-readable). Not the terrain style colors.

## Tests

Three lean vitest unit tests under `tests/`.

- **`tests/planes.test.js`** — `PLANES` has all 6 keys, each has a `build` function and a valid `stats` shape, every plane's `fuelDrainRate === 0` (sandbox invariant). `PLANE_ORDER` matches `Object.keys(PLANES)` length, order is biplane → f22.
- **`tests/collision.test.js`** — `crashed(physics, terrain, radius)` returns `true` when `physics.y - radius <= terrain.getHeight(x,z)`, `false` otherwise. Uses a stub terrain (`{ getHeight: () => 100 }`); no real chunk system needed. Edge case: `crashed(_, null, _) === false`.
- **`tests/state.test.js`** — state machine transitions: MENU→FLYING, FLYING→CRASH, CRASH→MENU (after timer), FLYING→MENU via back button. Verifies enter/exit callbacks fire correctly.

No e2e (puppeteer) tests in v1 — manual play covers it for a sandbox this small.

## Persistence

Three `localStorage` keys, no save file:

| Key | Value | Default if missing |
|---|---|---|
| `flightsim.seed` | uint32 string | minted as `(Math.random()*0xFFFFFFFF)|0` |
| `flightsim.plane` | plane key (e.g. `"biplane"`) | `"biplane"` |
| `flightsim.style` | style key | `"cartograph"` |

No NBucks. No `PlaySDK.save()`. No leaderboards. Pure local.

## Platform integration

- **`meta.json`**: `slug: "flight-sim"`, title `"Flight Sim"`, tags `["3d","sandbox","flying","casual","exploration"]`, author `"nitzanwilnai"`, thumbnail `"thumbnail.png"`.
- **PlaySDK**: `<script src="/lib/play-sdk.js">` injected by the platform on deploy. Call `PlaySDK.ready()` after the first render. No further SDK features used in v1.
- **Thumbnail**: captured from real three.js (per platform rule), showing the biplane over the cartograph terrain.
- **Deploy**: `./scripts/deploy-game.sh /Users/nitzanwilnai/Programming/Claude/JSGames/FlightSim` from the GamesPlatform repo (requires `DEPLOY_KEY`).

## Known risks & mitigations

1. **Mobile WebGL budget** — cap `setPixelRatio(min(dpr, 2))`, disable antialias on mobile, use ONE `WebGLRenderer` shared across MENU + FLYING. Single terrain object for the session. No second renderer for the menu turntable.
2. **Terrain memory persistence** — terrain lives for the whole session. Acceptable for a single-tab session. If the platform ever fires a "back to lobby" navigation, dispose on `pagehide`.
3. **Camera input smoothing** — already correct in `PlanePhysics`: `smoothed += (target - smoothed) * 0.5`.
4. **Per-commit version bump** — `lib/version.js` updated on every commit; version visible in MENU corner and HUD.
5. **Battery / pause** — copy CanyonRun3D's `visibilitychange` pattern: `cancelAnimationFrame` on hide, reset `lastFrame` and re-queue on show.
6. **Three.js r128 via CDN** — same as both source games. No build step.

## Out of scope for v1

- Plane unlocks, coins, economy, persistence beyond `{ seed, plane, style }`.
- Multiplayer, leaderboards, missions, POIs, map overlay.
- Audio (engine, wind, ambient).
- Runway takeoff / landing mechanics.
- Cockpit or cinematic camera modes (chase camera only).
- Custom plane unlocks beyond the six already-built meshes.
- "New world / re-roll seed" UI affordance.
- Settings panel beyond the style dropdown.

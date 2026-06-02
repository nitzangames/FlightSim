# How we built the planes

We started with six planes vendored in from CanyonRun3D (commit `27d6c30`). They were placeholder boxes-and-cylinders meshes — fine for flying around, but visibly generic. Every plane in the current roster has since been rebuilt to a recognizable real aircraft: P-51D, Spitfire, F-86 Sabre, F-4 Phantom (IDF/AF), A-10 Thunderbolt II, F-16 (IDF + Thunderbirds liveries), F-18 (Blue Angels), F-15 Eagle, F-22 Raptor, plus the WW1 biplane and Fokker Dr.I triplane.

## The pipeline

For each plane we used the same loop:

1. **Spec + plan.** A design spec (`docs/superpowers/specs/<date>-<plane>-rebuild-design.md`) describing the silhouette: nose shape, wing planform, fin style, livery, insignia. Then an implementation plan in `docs/superpowers/plans/` listing the THREE.js primitives that would build each part.
2. **Inspect harness.** A standalone HTML page per plane (`<plane>-inspect.html`) renders the mesh in a 6-view grid — top, side, iso, bottom, front, rear — using orthographic cameras. A puppeteer script (`tools/inspect-<plane>.cjs`) loads that page headlessly and screenshots it to `<plane>-inspect.png`. Critical: this image is what Claude looks at to judge the geometry. Without it, the model is building blind — it can't see what THREE.js actually produced.
3. **First-pass build.** A `buildXxx(THREE)` function in `lib/plane/<plane>.js` that returns a Group. Geometry comes from `ExtrudeGeometry` on 2D `Shape`s (chined fuselages, swept wings, tapered fins), `LatheGeometry` (round prop-fighter fuselages like the P-51 and Spitfire), or hand-built `BufferGeometry` for lofted parts where neighboring rings have to share vertices (e.g. the F-22's hexagonal nose, lofted from the same cross-section as the body so the facets line up at the junction).
4. **Render → screenshot → critique → tweak.** This is the loop that actually shaped each plane. Build, run the inspect tool, look at the PNG, find what's wrong, change one number, repeat. The A-10 alone took about ten correction passes — the commit log reads like a list of bad first guesses:
   - `51f1f28 fix: A-10 body taller than wide (extrude depth 1.6 → 1.1)`
   - `7da9385 fix: lower A-10 vertical fins (shape height 1.50 → 1.15)`
   - `fdf6f56 fix: A-10 cannon shorter, barrel closer to nose`
   - `5f6f5d3 fix: A-10 wing + fin tips squared off (not rounded)`

   Each commit subject is the specific delta from the previous frame.
5. **In-game shots.** Once the inspect view looked right, a separate harness (`tools/shot-f22-game.cjs`, `f22-game-*.png`) screenshotted the plane in the actual game scene — lighting, sky, contrails, scale against terrain. Things that read fine in the dark inspect background sometimes looked wrong against sky, and that's when livery saturation or panel-color contrast got adjusted.

## Where the back-and-forth lived

The iteration wasn't in the spec or the plan — it was in step 4. The specs were short. The plans were short. The actual sculpting happened by looking at the screenshot, noting "the vertical fin is too tall", and changing one number. You'll see runs like:

- `7da9385 fix: lower A-10 vertical fins (shape height 1.50 → 1.15)`
- `dec612a fix: A-10 fins back to full height, lowered to pass through the stab`

— a number went one way, the screenshot showed it was wrong, the number went back and a different variable moved instead. That's the workflow: each commit is one image's worth of feedback.

## What made it work

- **The inspect harness is the whole trick.** Without a 6-view ortho screenshot, building accurate geometry from code is guessing, and the iteration never converges. With it, every tweak becomes "I can see exactly what's off."
- **Real reference matters.** Pointing at a real photo of an A-10 or saying "the cannon should be tucked under the nose, not hanging off it" is what made the next pass converge. Unprompted mental images of what an A-10 looks like are worse than what the user can describe by looking at the real thing.
- **Small commits.** Each tweak shipped as its own commit with a one-line subject describing the visual change. Trivial to bisect if a "fix" actually regressed something.
- **Liveries last.** The shape-correct first pass was always bare plastic. Camo, roundels, Stars of David, Thunderbirds blue-and-white came after the silhouette was already right, so livery work didn't have to be redone when geometry changed.

## Adding a new plane

The repeatable recipe:

1. Write the spec under `docs/superpowers/specs/`.
2. Copy an existing `tools/inspect-<existing>.cjs` and `<existing>-inspect.html`, rename, point at the new file.
3. Create `lib/plane/<new>.js` exporting `buildXxx(THREE)` returning a Group. Start with primitives; loft only the parts that need it.
4. Run a local static server on `:8085` (e.g. `python3 -m http.server 8085`), then `node tools/inspect-<new>.cjs` to get a screenshot.
5. Look at the screenshot. Fix the most obviously wrong thing. Commit. Repeat until the silhouette reads as the target aircraft.
6. Apply livery + insignia. Re-screenshot.
7. Add to `lib/game/planes.js` roster. Run `tools/shot-<new>-game.cjs` (copy from `shot-f22-game.cjs`) to verify it reads correctly in the actual scene.

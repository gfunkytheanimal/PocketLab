# PocketLab Project Memory

## Vision
PocketLab / Vacuum Playground is a browser-based playable physics sandbox: a blank black vacuum where users drag in assets and watch gravity, heat, dust, fields, collisions, black holes, spacecraft, planets, gas, and emergent systems unfold. It should feel like a playable science museum exhibit plus cosmic toybox, not a strict scientific simulator.

## Current Priorities
- Make every two-object interaction entertaining and legible.
- Keep Newtonian gravity stable and readable before adding exotic effects.
- Treat black holes primarily as dangerous local attractor/eraser objects. Avoid W-space visual projection causing off-site collisions.
- Improve UI by moving selected-object actions into contextual controls and making the left toolkit cleaner/collapsible.
- Keep particles beautiful but aggressively capped/recycled so Merge and large collisions do not tank FPS.
- Prefer CC0/free-use assets and NASA/public-domain style quality where possible.

## Important Recent Decisions
- Field lines, topology, trails, scanner, bounds, and filament overlays should be off by default or subtle. They are advanced/math views.
- “Particles” means playable/emergent motes, dust, sparks, gas, debris, etc. Background stars are “Cosmic FX” or starfield, not gameplay particles.
- Imported NASA models are the quality bar for detailed assets.
- W-space / 4D ideas are now experimental flavor only. Do not let W offsets move rendered objects away from true physics positions.
- Black-hole shear should happen locally at the event horizon, not in another apparent screen location.
- Orbit should become a persistent lock/coupling, not just a one-time velocity kick.
- Paint mode needs its own interaction plane and should not fight left-click camera rotation.

## Systems And Files
- `src/vacuum/main.js`: app glue, spawning, actions, tools, presets, paint brush, inspector actions.
- `src/vacuum/PhysicsEngine.js`: Newtonian gravity, collisions, attachments, bounds, orbit locks.
- `src/vacuum/ObjectFactory.js`: creates bodies, procedural assets, imports GLB models, labels/base labels.
- `src/vacuum/UI.js`: toolkit, inspector, contextual selected-object UI, help text.
- `src/vacuum/Interaction.js`: pointer/drag/drop/paint/camera interactions.
- `src/vacuum/ParticleLayer.js`: GPU point particles, adaptive caps.
- `src/vacuum/NebulaFxLayer.js`: three-nebula sprite bursts, emitter caps.
- `src/vacuum/SpacetimeVolumeSystem.js`: experimental topology/spacetime effects. Keep conservative.
- `src/vacuum/FieldEventScanner.js` and `FieldEventOverlay.js`: toy anomaly scanner.

## Known Issues / Next Work
- UI still needs a larger cleanup: selected info on screen, sliders/tools primarily in left collapsible toolkit, fewer duplicated actions.
- Orbit locks need play-testing with paused setup: place bodies, lock each orbit, unpause.
- Add explicit “Lock Orbit To…” workflow later: select satellite, choose target anchor from nearby bodies.
- Camera/paint mode should keep improving around coordinate clarity.
- Some procedural effects still overproduce clutter around planets/stars. Conservative triggers are better.
- More high-quality CC0/free assets needed for UFO, alien, light beam, planets, comets, fluids, and fields.
- Fluid dynamics/gas behavior is a future major feature.
- Paint/fossilize/starfield tools should support macro-to-micro scale: distant background vs playable dust must stay distinct.
- UI should have a true dev mode for tuning all constants live.

## Run / Verify
- Dev server: `npm.cmd run dev`
- Build: `npm.cmd run build`
- Main page: `http://127.0.0.1:5173/vacuum.html`

## Git
Repo: `https://github.com/gfunkytheanimal/PocketLab`
Main branch is currently used directly.

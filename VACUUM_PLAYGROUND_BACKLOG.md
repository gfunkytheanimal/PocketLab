# Vacuum Playground Backlog

This is the living idea shelf so the good experiments from the thread do not get lost while we keep stabilizing the toybox.

## Physics Core

- Add a true Verlet/constraint solver layer for ragdolls, soft tethers, articulated spacecraft parts, and destructible joints.
- Add material profiles per category: metal, rock, ice, gas, organic, plasma, field, singularity.
- Make collisions branch by profile: stick, bounce, shatter, melt, vaporize, ignite, ablate, or phase-pop.
- Add stable orbit helpers: optional ghost orbit prediction, circularize selected object, orbital resonance preset.
- Expand black-hole/white-hole behavior: absorbed mass can emerge as dust jets, photon spray, plasma, or wormhole-linked output.
- Add electromagnetism as a separate force system with charged dust, magnetic field lines, and polarity controls.
- Add fluid/gas behavior for nebula clouds: compression, vortexing, ignition near stars, and accretion into disks.

## Visual Systems

- Add an intentional "fossilize run" / "make nebula memory" command that captures current chaos into a static background layer before reset.
- Replace blocky transient FX with soft impostors, volumetric sprites, and smoother shader-driven particle textures.
- Add filament shaders inspired by fragcoord-style plasma strands.
- Add volumetric spacetime wells and density fog that remain aligned from every camera angle.
- Add self-shadowed particles or light-scattering approximations for gas clouds and cosmic dust.
- Add asset-specific destruction looks: suit mist for astronauts, icy vapor for comets, molten crust for planets, metal sparks for spacecraft.
- Keep the current black hole visual as the quality bar; do not regress it.

## Assets

- Continue using CC0/public-domain-friendly sources first.
- Find or create better UFO, alien, and light-beam authored assets without placeholder companion artifacts.
- Add more NASA/CC0 spacecraft: landers, rovers, probes, satellites, telescopes, stations, dishes, debris modules.
- Add toybox objects for fun: gravity paint, antimatter seed, time crystal, force wall, plasma cannon, mini white hole.

## Interaction

- Expand Paint mode into brushes for star fields, dust clouds, gas, heat, magnetic charge, and spacetime distortion.
- Expand Powers into a god-mode toolbelt with radius/strength sliders and live cursor previews.
- Add "abduct selected", "explode selected", "ignite selected", "bind orbit", "make binary", and "make ring" commands.
- Add collision labels and hover tooltips so users can tell why something stuck, burned, shattered, or phased.
- Add scenario save/load so good accidental harmonics can be preserved.
- Add dev mode presets that save all physics/rendering sliders locally.

## Performance

- Keep simple Newtonian gravity for bodies, but use categories and caps so dust and FX do not become expensive N-body actors.
- Add adaptive substeps, force clamps, damping, and restitution controls as permanent first-class systems.
- Add quality modes for CPU laptops versus GPU machines: particle count, volumetric quality, bloom, render scale.
- Keep browser build warnings monitored; split heavy vendor chunks only if load time becomes a real problem.

# Pocket Universe Lab Roadmap

This project should grow in layers. The engine stays stable and readable while visuals, assets, and emergent systems get richer around it.

## Quality Bar

NASA spacecraft model detail is the current asset benchmark. Procedural objects should aim for the same feeling of specificity: visible structure, distinct materials, readable scale, and reaction points that can matter later.

Every object should answer four questions:

- What is it made of?
- What forces does it create?
- What forces affect it?
- What can it become when combined with another object?

## Phase 1: Stable Toybox

- Keep Newtonian gravity stable in 3D.
- Keep click-spawn safe and drag-spawn intuitive.
- Make inspector sliders work for every object category.
- Keep default visuals cinematic: fields, topology, trails, and bounds off unless requested.
- Make reset, clear dust, clear trails, and clear fossils reliable.

## Phase 2: Emergent Pair Reactions

Two assets should be enough to create a show.

- Planet + moon: capture, orbit rings, satellite labels.
- Planet + gas: atmosphere formation.
- Star + gas: ignition, corona bloom, plasma wind.
- Star + comet: vapor tail, steam, slingshot.
- Black hole + anything: material-specific tidal shear and accretion.
- Black hole + wormhole: whitehole/quasar jet.
- Magnet + dust/debris: aurora, charge, spirals.
- UFO + crew/debris: tractor capture and release.
- Light beam + matter: scorch, reflection, vaporization.

## Phase 3: Asset Fidelity

- Prefer CC0 or clearly permitted assets.
- Use NASA assets for realistic spacecraft, probes, rovers, dishes, and landers.
- Use authored CC0 assets for UFO, alien, rocks, props, and toybox oddities.
- Use procedural shaders for planets, stars, gas, fields, plasma, and black holes.
- Add per-part metadata later: wheels, panels, antennae, hulls, limbs, cores, beams.

## Phase 4: Fluids And Fields

- Replace blocky particles with soft, gaseous sprites and shader-driven motes.
- Add brush tools for starfields, gas, charge, heat, dust, and nebula.
- Add low-cost fluid-ish behavior: pressure, swirl, buoyancy, cooling, vaporization.
- Add GPU-heavy mode later for volumetric fields and self-shadowing particles.

## Phase 5: Play Modes

- Sandbox: blank vacuum and asset library.
- Scenarios: curated experiments such as Quasar Jet, Moon Capture, Alien Lab, Ring Chaos, Solar Harmonic.
- Dev Mode: expose internal constants and shader knobs.
- Showcase Mode: clean cinematic view with minimal UI.
- Save/Load: preserve a universe state once the system stabilizes.

## Showcase Target

A strong showcase build should let someone drop any two interesting assets and watch a distinct, legible interaction unfold within five seconds.

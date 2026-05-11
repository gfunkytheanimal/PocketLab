# Recursive Attractor Explorer

A browser-based musical particle instrument built with PlayCanvas Engine, ES modules, WGSL shaders, and an optional WebGPU compute path. The default experience is **Piano Physics Mode**: a sterile toroidal universe where each piano key activates one chromatic particle family with its own color, sprite shape, spring behavior, and trail style.

The scene starts calm and ordered. Pressing one note wakes only that particle family; neighboring families wiggle through physical coupling, and chords create richer interference. The previous nebula, multi-node, and recursive travel systems remain available through presets and **Tunnel Mode**, but they are disabled by default so the note-to-physics relationship is readable.

## Setup

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The stable default renderer uses WebGL2 camera-facing additive particle quads so the explorer opens directly into the particle universe. Chrome or Edge are recommended.

The default experience is **Piano Physics Mode** using the `piano-physics` preset. Play the virtual piano with the mouse or keyboard; live mic pitch detection can also trigger note families when confidence is high enough.

## Controls

- Sound Board left drag: orbit the nebula sculpture
- Sound Board right drag: pan
- Sound Board mouse wheel: zoom camera distance
- Sound Board Shift + wheel: adjust simulation intensity
- Tunnel mouse wheel: change tunnel speed and depth response
- Space: pause
- R: reset particles
- H: show controls outside Piano Physics Mode
- U: show/hide tuning GUI
- D: show/hide diagnostics
- Capture, screenshot, and poster hotkeys are disabled in Piano Physics Mode so the keyboard stays playable as an instrument.
- N: jump to the next cosmic encounter
- B: jump to the previous encounter
- E: force a seeded encounter near the camera
- G: toggle encounter labels
- GUI: tune the five art controls, presets, and mode. Technical controls live in **Advanced**.
- Sound Board test buttons: Sub Boom, Bass Pulse, Vocal Ribbon, Guitar/Lead Arc, HiHat Sparks, Full Music Burst

## Piano Physics Mode

Piano Physics Mode is the default simplified instrument. The particle system is arranged on a faint torus boundary, and every particle has a persistent chromatic family:

- `C C# D D# E F F# G G# A A# B`
- White keys: `A S D F G H J`
- Sharps: `W E T Y U`
- In Piano Physics Mode these keys are reserved exclusively for notes; plain `C`, `S`, `P`, `D`, `F`, `G`, `H`, `U`, and `E` no longer trigger app utilities.
- Press `` ` `` to show/hide the tuning GUI without stealing any piano key.

Each family owns its rest positions, mass, spring stiffness, damping, sprite style, color, and trail response. A key press applies a traveling string wave only to the matching family; nearby families move through spring/collision coupling instead of hidden note activation or global audio chaos. Releasing keys lets damping return the torus to an ordered standing-wave state. The `Layout` control switches between the default note ring layout and the experimental 3-Tori Universe.

The `Instrument` control changes the physics envelope: Piano is sharp and bouncy, Harp plucks spiral ripples, Drum creates radial shocks, Strings bow particles into ribbons, Synth Pad expands smoothly, Electric Guitar adds jagged spark energy, and Choir creates softer standing waves.

The small readout reports active notes, detected mic note/confidence, total energy, and chaos level. Live audio is secondary: pitch estimation softly triggers nearby note families, while the virtual piano remains the ground-truth input.

## Sound-Reactive Nebula Board

Sound Board Mode is a shallow 3D particle field embedded inside layered cosmic cloud volumes. Particles are continuous probes in a force field with inertia and damping. Trails are the primary visual layer; dots are subtle seeds inside the mist.

The default visible controls are intentionally small:

- **Cloud Density**: opacity and body of the nebula.
- **Particle Energy**: brightness and motion of charged dust.
- **Trail Persistence**: how long ribbon traces remain.
- **Audio Reactivity**: strength of audio-to-cloud and audio-to-physics mapping.
- **Audio Sensitivity**: live input gain, compression, and quiet-signal response.
- **Cosmic Glow**: overall cloud, trail, and bloom intensity.

Cloud bodies:

- central vapor core
- outer wisps
- vertical ghost veil
- spiral smoke arms
- shockwave mist rings

Audio-to-art mapping:

- Sub/bass expands and contracts the cloud core and sends thick pressure rings through the fog.
- Low mids curl the spiral smoke arms.
- Mids/vocals ripple vertical veils and bend particle ribbons.
- High mids create thin luminous rifts.
- Highs add edge ionization and sparks inside the mist.
- Strong broadband hits trigger the cosmic flower, with petal geometry and cloud bloom.

Audio analysis uses Web Audio `AnalyserNode` frequency and time-domain data:

- RMS amplitude
- bass, mid, and high bands
- onset/impulse detection
- spectral centroid
- smoothed level and fast/slow transient envelopes

Audio-to-physics mapping:

- Sub/bass affects the inner layers and breathing shell.
- Low mids drive warm spiral ribbon curls.
- Mids/vocals twist middle filaments and veils.
- High mids draw crystalline arcs and sound tears.
- Highs create outer electric sparks along existing trails.
- Broadband onsets bloom the whole sculpture, then re-separate into layers.

The live audio path and the test buttons now share the same event functions. Per-band onset detection uses adaptive floors, logarithmic band scaling, boosted pre-gain, spectral flux, fast/slow envelopes, quiet-signal response floors, and short cooldowns so a real kick, vocal phrase, high-mid lead, or hi-hat can trigger the same visual class as **Bass Pulse**, **Vocal Ribbon**, **Lead Arc**, or **HiHat Sparks**. Diagnostics show `subEvent`, `bassEvent`, `lowMidEvent`, `midEvent`, `highMidEvent`, `highEvent`, `broadbandEvent`, band variance, dominant band, and recent event history.

The board is now a real 3D volume rather than a flat plane:

- Sub particles form a central vertical core.
- Bass particles occupy a thick inner torus.
- Low mids curl through helical spiral arms.
- Mids/vocals create vertical ribbon veils wrapping the core.
- High mids draw crystalline 3D shards.
- Highs sparkle across an outer halo shell.
- Broadband hits open a 3D cosmic flower.

Particles now carry persistent musical roles rather than sharing one generic star style:

- **Bass Mass**: heavier glowing bodies with thick slow arcs.
- **Low-Mid Orbit**: spiral-arm particles with warmer orbiting trails.
- **Vocal Thread**: silk-like ribbon particles that weave between nodes.
- **High-Mid Shard**: angular particles that snap into crystalline alignments.
- **Treble Spark**: tiny fast particles with short electric scratches.
- **Chorus Bloom**: petal-path particles that synchronize during broadband hits.

Each particle stores deterministic role/style seeds for size, brightness, trail width, glow, sprite shape, and response sensitivity. The renderer uses procedural sprite shapes instead of one identical dot, and trails use role-aware width, alpha, color, and audio swelling so stars and tails carry the music while clouds echo the particle structure.

## Musical Toroidal Universe

Sound Board physics now keeps the universe inside a toroidal field. Particles are pulled toward the torus manifold, rebound from soft inner/outer walls, and circulate around the donut-shaped universe. Sub and bass strengthen galaxy-scale gravity; low mids drive orbital circulation; mids/vocals organize node relationships; high mids and highs energize shards, sparks, and rare escapes.

Notes are first-class physics events:

- **C**: central gravity structure
- **D**: orbiting ribbon system
- **E**: crystalline shard system
- **F**: nebula bloom
- **G**: spiral galaxy arm
- **A**: high-energy spark belt
- **B**: unstable golden escape/rift behavior

Octave changes scale: low notes act at galaxy scale, middle notes at system scale, and high notes at particle/spark scale. Live pitch estimation can trigger notes when a dominant pitch is detected, and the virtual piano provides reliable ground truth.

Keyboard piano:

- White keys: `A S D F G H J` = `C D E F G A B`
- Sharps: `W E T Y U` = `C# D# F# G# A#`

The virtual piano triggers the same `triggerNote(note, octave, strength)` path as live audio, with optional synth sound. Chords create multi-body gravitational relationships, sustained notes stabilize standing waves, and fast notes create particle streams. Rare golden-ratio escape particles use golden-angle trajectories and decay back toward the torus.

Use **Auto Orbit Showcase** to slowly rotate the camera through a full 360-degree view and check that the sculpture keeps depth from every angle.

## Multi-Node Nebula System

Sound Board Mode now generalizes the sculpture into reusable nebula nodes. The default setup uses three coupled organisms:

- **Bass Node**: a large central gravity well that responds most strongly to sub and bass.
- **Vocal Node**: an offset ribbon node tuned for low-mid and vocal/mid energy.
- **Treble Node**: an offset crystalline node tuned for high-mid and high-frequency sparks.

Each node has its own particle subset, local transform, size, palette, frequency response profile, cloud volume contribution, and line/ribbon geometry. The shared audio analyzer drives the relationships:

- Bass compresses the system inward and pulls side nodes toward the bass node.
- Mids/vocals twist the nodes around one another and strengthen ribbon bridges.
- Highs create spark bridges and crystalline jumps between nodes.
- Broadband hits bloom all nodes and open the cosmic flower across the whole system.
- Silence lets the nodes drift back toward calm positions.

Visible art controls for the multi-node board are:

- **View Depth**
- **Focus Node**
- **Interaction Strength**
- **Audio Sensitivity**
- **Cosmic Glow**

Use the mouse wheel to move through three view states. Zoom is a normalized journey from `0` to `1`, with many small wheel steps instead of an abrupt camera jump:

- **Universe View**: frames the whole musical system and emphasizes node-to-node bridges.
- **Travel View**: follows the bridge corridor toward the selected node. Bridges thicken into the transition path, cloud parallax increases, and particles stream along the route.
- **Inside The Music**: enters the focused node volume. Mouse drag behaves more like look-around, nearby particles/trails surround the camera, and distant nodes become background bodies.

Press **Tab** to cycle the focus node. The wheel still controls camera distance, but that distance now drives the experience arc from observing the music universe, to traveling through a relationship bridge, to entering one musical body.

Multi-node presets:

- `binary-stars`
- `three-body-nebula`
- `vocal-jellyfish-cluster`
- `bass-gravity-well`
- `spark-constellation`
- `cosmic-choir`

Sound Board presets:

- `ferrofluid-bloom`
- `plasma-mandala`
- `cymatic-lattice`
- `magnetic-storm-board`
- `deep-bass-gravity`
- `vocal-ghost-trails`

Tunnel presets still work and set `mode=tunnel`.

`Control Test Mode` is a verification preset with visible tunnel rings, exaggerated mouse response, and stronger wheel speed changes.

## Cosmic Encounters

The tunnel now contains deterministic major encounters placed along the travel path. The first appears within the opening stretch, then the director spaces new encounters roughly every 20-40 seconds of travel. Encounter order and placement are seeded by `?seed=...`, so the same URL gives the same sequence.

Encounter types:

- Spiral galaxy vortex: visible spiral arms that pull trails into orbit.
- Plasma jellyfish: bell rings with long drifting tendrils.
- Crystal cathedral: tall luminous arches and crystalline ribs.
- Event horizon lens: dark center with glowing accretion rings and inward pull.
- Filament web forest: branching vertical filaments that trails climb through.
- Recursive mandala gate: nested rotating polygon rings.
- Bioluminescent reef: branching coral-like glow structures.
- Broken spacetime mirror: floating triangular shards that split flow.
- Golden resonance shell: nested spherical shell lattices.
- Dark void with glowing rim: black center framed by luminous ellipses.

Use `G` to label encounters, `N`/`B` to jump through the sequence, and `E` to force a nearby seeded encounter for testing or poster composition.

## Shareable URLs

Important state can be encoded in the URL:

```text
?seed=golden-depth&preset=event-horizon&quality=high&hero=on
```

Supported presets:

- `clean-infinite-flow`
- `control-test-mode`
- `abyssal-plasma`
- `golden-singularity`
- `crystal-void`
- `recursive-storm`
- `bioluminescent-dream`
- `event-horizon`

Quality tiers:

- `potato`
- `low`
- `medium`
- `high`
- `ultra`

Omit `quality` or use `quality=auto` to auto-detect a conservative tier.

## Recording

For screen recording:

1. Open a 16:9 browser window.
2. Use a deterministic URL such as `?seed=golden-depth&preset=event-horizon&quality=high`.
3. Press **C** to start/stop built-in canvas capture if your browser supports `MediaRecorder`.
4. Or use OBS/Screen Studio/QuickTime with the UI hidden. Press **U** and **D** to ensure controls and diagnostics are off.
5. Press **P** for a poster still.

The built-in recorder saves a `.webm` file. Browser support varies.

## Compute Shader Pipeline

The stable internet-ready path is WebGL2. WebGPU is opt-in experimental and never affects the default presentation.

The WebGPU compute path lives in `src/systems/GpuParticleSimulator.js` and is enabled with:

```text
?webgpu=1&gpu=1
```

1. A `StorageBuffer` stores each particle as two `vec4f` records: `positionLife` and `velocitySeed`.
2. `src/shaders/particleUpdate.wgsl.js` defines the WGSL compute shader. It blends attractor fields, applies recursive scale modulation, integrates velocity, and recycles particles around the moving camera.
3. The shader is wrapped in a PlayCanvas `pc.Shader` with `shaderLanguage: pc.SHADERLANGUAGE_WGSL`, a `BindGroupFormat`, and a uniform buffer for camera/time/simulation parameters.
4. Each frame, `pc.Compute` is dispatched in 128-wide workgroups via `device.computeDispatch`.
5. The render material reads the same storage buffer from the vertex shader and draws point sprites with additive glow.

The default visual path uses `CpuParticleSimulator` and uploads a dynamic quad mesh each frame, keeping the app functional on browsers without WebGPU compute. The WebGPU storage buffer is created with explicit storage/copy usage, Phase 2/3 materials have native WGSL variants, and diagnostics include storage readback status. In the current local PlayCanvas/WebGPU runtime, compute mode initializes and reports capabilities, but the storage-buffer render path still presents black; it is intentionally exposed for triage rather than silently degrading the public experience.

## Phase 2 Systems

### Field Memory

`src/memory/FieldMemory.js` maintains a low-resolution 3D cache around the camera. Each cell stores:

- scalar energy
- averaged flow direction
- coherence

Particles inject curvature and velocity into the grid. The grid decays every frame:

```text
memory = decay * memory + injection
```

The simulator samples this memory and bends particle velocity toward persistent flow, which creates temporary nebula-like structures instead of independent particle noise.

### Recursive Scale Transitions

`src/recursion/RecursiveScaleController.js` divides forward travel into logarithmic-feeling scale bands. Each band rotates and rescales field coordinates, mutates attractor phase, and shifts palette harmonics:

```text
x' = rotate(depth) * x * scaleFactor^blend
F'(x, t) = F(x', t + bandOffset)
```

This preserves motion continuity while making deeper travel feel like entering a nested universe.

### Structure Analysis

`src/analysis/StructureAnalyzer.js` scans hot memory cells for energy, coherence, and flow speed. `src/structures/MegaStructureSystem.js` promotes coherent cells into nebulae, filaments, tunnels, shells, and voids. These structures feed back into particle velocity and volumetric fog density.

### Volumetric Fog

`src/volumetrics/VolumetricFogSystem.js` renders low-cost camera-facing volumetric billboards seeded by memory and structures. The shader approximates soft density falloff, glow, turbulence wobble, and audio pulse response. It is not a full 3D texture raymarch yet, but it functions as the first modular volumetric pass.

### Trail History

`src/rendering/TrailSystem.js` samples particle trajectories into persistent history and renders them as camera-facing ribbon traces. Trails are now the primary visual language; particles act as tiny seeds. GUI controls expose dot opacity, trail opacity, trail length, trail width, persistence, and trail-only mode.

### Cinematic Camera

`src/controls/ExplorerCamera.js` now includes inertial smoothing, slow procedural banking, FOV breathing, audio pulse response, and scale-aware forward travel.

### Audio Modulation

`src/audio/AudioReactiveSystem.js` uses microphone FFT bands after pressing **Start mic** or **enable mic**. Sub, bass, low-mid, mid, high-mid, treble, RMS, and event hits are available in the diagnostics overlay. In Sound Board Mode, audio changes cloud opacity, cloud scale, rift intensity, particle brightness, trail width, shock rings, and nebula color.

## Controls And Audio Troubleshooting

- If drag seems inactive, press **Enter** to dismiss the intro. Press **D** to show diagnostics; `moves`, `dragging`, `yaw`, and `pitch` should update while held.
- If Sound Board wheel zoom seems inactive, press **D** and watch `cam dist`. Trackpad scroll and mouse wheel should move the camera closer/farther. Use **Shift + wheel** for simulation intensity.
- If the intro was hidden but still blocks input, reload the page; hidden intro controls are now set to `pointer-events: none`.
- If microphone does nothing, press **Start mic** from the intro or **enable mic** in the GUI after a user gesture. Diagnostics report `permission`, `rms`, and all six audio bands.
- Microphone requires a secure browser context. `localhost` works in Chrome/Edge; some embedded browser surfaces deny permission and will show `Permission denied`.
- To verify visible cause/effect without mic permission, use the intro buttons. **Sub Boom** inflates the vapor core, **Bass Pulse** pushes a thick ring through the cloud, **Vocal Ribbon** twists veils, **HiHat Sparks** opens bright rifts, and **Full Music Burst** blooms the cosmic flower.

## Phase 3 Ecology Layer

Phase 3 adds coherent long-lived universe state rather than isolated visual effects.

### Persistent Seed

`src/universe/seed.js` stores a deterministic universe seed in `localStorage`. Use `?seed=name` to open a specific universe, or press **new seed** in the GUI to generate another one. Biome regions and anomaly placement derive from this seed, so the universe has stable geography.

### Universal Harmonics

`src/universe/HarmonicEngine.js` is the master oscillator. It combines nested sine systems and quasi-periodic low-frequency modulation into shared values:

```text
slow, medium, fast, chaos, convergence
```

Those values drive biome intensity, recursive palette drift, camera breathing, entity emergence, event-horizon tension, fog pulse, and procedural sound. This keeps separate systems synchronized through one hidden law.

### Cosmic Biomes

`src/universe/BiomeSystem.js` divides large spatial regions into gradually blended ecological identities:

- plasma ocean
- crystalline void
- filament forest
- recursive storm
- frozen void
- resonance chamber
- attractor coral
- singularity well

Biome state modifies field strength, velocity drag, fog density, color harmonics, and recursive behavior. Diagnostics show the current biome while traveling.

### Temporal Echoes

`src/universe/TemporalEchoSystem.js` stores delayed snapshots of hot memory cells and structures. Old states periodically reconstruct as fog-space echoes, creating the sense that the universe remembers previous flow.

### Field Entities

`src/universe/FieldEntitySystem.js` spawns coherent dynamical structures when memory energy and coherence persist. They are not mesh creatures; they are moving force knots that consume and reinject field energy, distort nearby particles, and render through fog as luminous topological presences.

### Non-Euclidean Distortion And Event Horizons

`src/universe/EventHorizonSystem.js` places rare deterministic anomaly regions: recursive fractures, mirror wells, and harmonic singularities. Their influence bends particle velocity, widens camera FOV, changes travel rhythm, and feeds a shader-space coordinate warp through `uHorizonWarp`.

### Procedural Cosmic Sound

`src/audio/ProceduralCosmicAudio.js` generates low harmonic drones and crackling directly from simulation state after pressing **start sound**. It responds to biome color, harmonic convergence, recursive depth, field entities, and event horizons. Microphone input remains optional and additive.

### Discovery Director

`src/universe/DiscoveryDirector.js` watches convergence, entities, and anomalies to label emergent pacing states such as `entity encounter`, `scale vista`, or `anomaly reveal`. The camera uses this intent for subtle choreography without scripted scenes.

### Deep Recursion Shading

The particle shader now includes horizon-driven coordinate warping, recursive palette phase, and curvature-like brightness fed from memory/entity/anomaly density. The volumetric pass reconstructs biomes, echoes, entities, and horizons as layered density billboards, moving the image away from uniform particles toward a living field.

## Phase 4 Presentation Layer

Phase 4 makes the piece shareable:

- Hero Mode default with automatic visual escalation
- cinematic intro overlay with title and preset selector
- hidden technical UI by default
- named visual presets
- quality tiers with auto detection
- shareable URL state
- built-in screenshot, poster, and recording controls
- diagnostics hidden unless requested
- film-grade vignette/contrast overlay

## Roadmap

- Finish PlayCanvas WebGPU storage-buffer render compatibility
- Add true low-res 3D density texture raymarching
- Add explicit star-depth parallax pass
- Add exportable preset gallery
- Add WebXR/VR camera mode
- Add offline deterministic render/export mode

## Attractor Math

Attractor equations are isolated in `src/math/attractors.js` and mirrored in the WGSL compute shader. The active field smoothly cycles through four systems:

```text
F(x, t) = mix(systemA(x), systemB(x), smoothstep(m(t)))
F_recursive(x, t) = F(x, t) + k * F(0.25x, t)
```

Each system has a scale factor so its native coordinate range contributes to one shared universe. New attractors can be added by exporting a JavaScript field function, adding the WGSL equivalent, and appending it to the field list.

## Performance Notes

- WebGPU targets 100k particles by default and keeps simulation data on the GPU.
- WebGL2 caps the fallback to 42k particles to avoid excessive CPU upload cost.
- Particle records are packed into two `vec4f` values for aligned storage-buffer access.
- The renderer uses point sprites and additive blending for glow without heavy geometry.
- Pixel ratio is clamped to 1.5 to protect frame time on high-DPI displays.
- Workgroup size is 128 for broad GPU occupancy without requiring large shared memory.
- Field memory and structure detection run at low resolution and are sampled by particles instead of performing expensive nearest-neighbor searches.
- Trail history samples a bounded subset of particles to preserve the topology cue without duplicating the entire particle buffer.
- Volumetric fog is represented by a fixed billboard pool driven by the density field, which keeps fill cost tunable through `volumetricDensity` and `volumetricScale`.
- Encounters render as a separate bounded additive line mesh. Only nearby encounters are drawn, and force sampling ignores encounters outside their influence radius.

## Structure

```text
src/
  controls/      camera drift and orbit input
  audio/         microphone FFT and procedural cosmic sound
  analysis/      structure analysis from memory fields
  math/          attractor equations and deterministic random helpers
  memory/        persistent spatial field memory
  recursion/     nested scale descent state
  rendering/     mesh and material creation
  shaders/       WGSL compute/render shaders plus GLSL fallback render shader
  systems/       CPU/GPU simulation and universe orchestration
  structures/    megastructure influence fields
  universe/      seeds, biomes, harmonics, entities, echoes, horizons
  volumetrics/   density billboard volume pass
```

Stretch features such as audio reactivity, splat rendering, WebXR, field-line tracing, and capture can be added as new systems without disturbing the simulation core.

# Pocket Universe Lab

Browser-based physics sandbox for playful cosmic experiments. Drop objects into a black vacuum, paint fields into space, and watch gravity, heat, particles, black holes, spacecraft, gas, dust, wormholes, and toybox powers interact.

## Run Locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open:

```text
http://127.0.0.1:5173/vacuum.html
```

## Build

```powershell
npm.cmd run build
```

## Current App

- `vacuum.html` is the main toybox.
- `blackhole.html` is a standalone event-horizon instrument/reference page.
- `src/vacuum/` contains the modular sandbox systems.
- `public/assets/models/` contains usable CC0 / NASA-derived model assets used by the sandbox.

## Controls

- Drag assets from the left library into the vacuum.
- Click an asset card to spawn it at a free point.
- Left drag objects to move/flick them.
- Right drag to pan the camera.
- Scroll to zoom.
- Space pauses.
- R resets.
- G toggles fields.
- T toggles trails.

## Notes

The goal is visual, explorable physics rather than perfect scientific simulation. The engine favors stable and entertaining behavior, exposed sliders, and clear cause/effect over strict realism.

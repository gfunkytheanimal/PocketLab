import './styles.css';
import * as pc from 'playcanvas/build/playcanvas.mjs';
import { GUI } from 'lil-gui';
import { AttractorUniverse } from './systems/AttractorUniverse.js';
import { ExplorerCamera } from './controls/ExplorerCamera.js';
import { createDefaultParams } from './systems/params.js';
import { applyPreset, PRESETS } from './config/presets.js';
import { applyQuality, QUALITY_TIERS } from './config/quality.js';
import { CaptureSystem } from './rendering/CaptureSystem.js';
import { VirtualPiano } from './ui/VirtualPiano.js';

const canvas = document.getElementById('application');
const backend = document.getElementById('backend');
const speedIndicator = document.getElementById('speed-indicator');
const boardReadout = document.getElementById('board-readout');
const inputDebug = document.getElementById('input-debug');
const audioPulse = document.getElementById('audio-pulse');
const cornerUpload = document.getElementById('corner-upload');
const cornerAdvanced = document.getElementById('corner-advanced');
const query = new URLSearchParams(window.location.search);

const params = createDefaultParams();
params.heroMode = query.get('hero') !== 'off';
applyPreset(params, query.get('preset') ?? 'piano-physics');
if (query.get('mode')) params.appMode = query.get('mode');
if (query.get('primaryMode')) params.primaryMode = query.get('primaryMode');
applyQuality(params, query.get('quality') ?? 'auto');
if (query.get('seed')) {
  localStorage.setItem('recursive-universe-seed', query.get('seed'));
}
if (query.get('audio') === 'on') {
  params.requestAudio = true;
}

document.body.classList.toggle('ui-visible', params.uiVisible);
document.body.classList.add('instrument-ready');

const device = await pc.createGraphicsDevice(canvas, {
  deviceTypes: query.has('webgpu')
    ? [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2]
    : [pc.DEVICETYPE_WEBGL2],
  antialias: false,
  alpha: false,
  depth: true,
  stencil: false,
  powerPreference: 'high-performance'
});

const app = new pc.Application(canvas, { graphicsDevice: device });
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, params.maxPixelRatio);
app.scene.toneMapping = pc.TONEMAP_ACES;
app.scene.gammaCorrection = pc.GAMMA_SRGB;
app.scene.ambientLight = new pc.Color(0, 0, 0);

window.addEventListener('resize', () => app.resizeCanvas());

const camera = new ExplorerCamera(app, params);
const universe = new AttractorUniverse(app, camera, params);
const capture = new CaptureSystem(canvas, params);
const piano = new VirtualPiano(universe.universe.audio);
const PIANO_KEY_CODES = new Set(['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ']);
const demoInput = document.createElement('input');
demoInput.type = 'file';
demoInput.accept = 'audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/*';
demoInput.style.display = 'none';
document.body.appendChild(demoInput);
demoInput.addEventListener('change', () => {
  const file = demoInput.files?.[0];
  if (file) loadDemoFile(file);
});
cornerUpload?.addEventListener('click', () => {
  params.primaryMode = 'demo';
  demoInput.click();
});
cornerAdvanced?.addEventListener('click', () => {
  params.uiVisible = !params.uiVisible;
  document.body.classList.toggle('ui-visible', params.uiVisible);
});
window.addEventListener('dragover', (event) => {
  if (params.primaryMode !== 'demo') return;
  event.preventDefault();
});
window.addEventListener('drop', (event) => {
  if (params.primaryMode !== 'demo') return;
  event.preventDefault();
  const file = [...(event.dataTransfer?.files ?? [])].find((item) => item.type.startsWith('audio/'));
  if (file) loadDemoFile(file);
});

backend.textContent = `${device.deviceType}${query.has('gpu') && device.supportsCompute ? ' compute' : ' particles'}`;

const gui = new GUI({ title: 'Playable Universe' });
gui.add(params, 'primaryMode', { 'Jam Session': 'piano', 'Microphone Listening': 'microphone', 'Demo Upload': 'demo' }).name('Mode').onChange((mode) => {
  params.appMode = 'sound-board';
  params.pianoPhysicsMode = true;
  if (mode === 'microphone') enableAudioInput(false);
  if (mode === 'demo') demoInput.click();
  universe.reset();
  updateUrl();
});
gui.add(params, 'viewLabel').name('Zoom Scale').listen();
gui.add(params, 'noteInstrument', { Piano: 'piano', Harp: 'harp', Drum: 'drum', Strings: 'strings', 'Synth Pad': 'synth-pad', 'Electric Guitar': 'electric-guitar', Choir: 'choir' }).name('Instrument');
gui.add(params, 'audioSensitivity', 0.5, 12, 0.05).name('Audio Sensitivity');
gui.add(params, 'universeScale', 0.4, 2.5, 0.01).name('Universe Scale').onFinishChange(() => universe.reset());
gui.add(params, 'clusterDensity', 0.5, 2.8, 0.01).name('Cluster Density').onFinishChange(() => universe.reset());
gui.add(params, 'collisionStrength', 0, 2.5, 0.01).name('Collision Strength');
gui.add(params, 'masterVolume', 0, 1.5, 0.01).name('Master Volume');
const advanced = gui.addFolder('Advanced');
advanced.close();
advanced.add(params, 'noteLayout', { 'Causal Universe': 'causal-universe', 'Note Rings': 'note-rings', '3-Tori Universe': 'three-tori' }).name('Layout').onChange(() => universe.reset());
advanced.add(params, 'synthVolume', 0, 1.2, 0.01).name('Synth Volume');
advanced.add(params, 'visualReactivity', 0.2, 3, 0.01).name('Visual Reactivity');
advanced.add(params, 'ringInstanceCount', 12, 144, 1).name('Ring Instances').onFinishChange(() => universe.reset());
advanced.add(params, 'particleTransfer', 0, 1.5, 0.01).name('Particle Transfer');
advanced.add(params, 'interactionStrength', 0, 2.5, 0.01).name('Interaction Strength');
advanced.add(params, 'cosmicGlow', 0.2, 2.5, 0.01).name('Cosmic Glow');
advanced.add(params, 'nodeCount', 1, 4, 1).name('Node Count').onChange(() => universe.reset());
advanced.add(params, 'particleExchange', 0, 2, 0.01).name('Particle Exchange');
advanced.add(params, 'cloudDensity', 0, 1.5, 0.01).name('Cloud Density');
advanced.add(params, 'particleEnergy', 0.2, 2.5, 0.01).name('Particle Energy');
advanced.add(params, 'trailPersistence', 0.75, 0.995, 0.005).name('Trail Persistence');
advanced.add(params, 'audioReactivity', 0.2, 3, 0.01).name('Audio Reactivity');
advanced.add(params, 'quality', Object.keys(QUALITY_TIERS)).name('quality').onChange((quality) => {
  applyQuality(params, quality);
  updateUrl();
  window.location.reload();
});
advanced.add(params, 'particleCount', 16000, 160000, 1000).name('particles').onFinishChange(() => universe.reset());
advanced.add(params, 'timeScale', 0, 2, 0.01).name('time scale');
advanced.add(params, 'integrationStep', 0.001, 0.018, 0.0005).name('field step');
advanced.add(params, 'fieldStrength', 0.15, 2.5, 0.01).name('field pull');
advanced.add(params, 'recursiveStrength', 0, 0.35, 0.01).name('recursive fold');
advanced.add(params, 'travelSpeed', 0, 8, 0.05).name('travel speed');
advanced.add(params, 'particleSize', 0.05, 4, 0.05).name('particle size');
advanced.add(params, 'dotOpacity', 0, 1, 0.01).name('dot opacity');
advanced.add(params, 'bloomStrength', 0, 2, 0.01).name('bloom');
advanced.add(params, 'fogDensity', 0, 0.12, 0.001).name('soft fog');
advanced.add(params, 'volumetricDensity', 0, 0.9, 0.01).name('volume density');
advanced.add(params, 'memoryInfluence', 0, 1.8, 0.01).name('field memory');
advanced.add(params, 'structureInfluence', 0, 1.5, 0.01).name('structures');
advanced.add(params, 'trailStrength', 0, 5, 0.01).name('trail glow');
advanced.add(params, 'trailOpacity', 0, 6, 0.01).name('trail opacity');
advanced.add(params, 'trailHistory', 4, 28, 1).name('trail length').onFinishChange(() => window.location.reload());
advanced.add(params, 'trailWidth', 0.01, 0.3, 0.01).name('trail width');
advanced.add(params, 'trailStyle', { 'Ribbon Field': 'ribbon-field', 'Electric Filaments': 'electric-filaments', 'Cymatic Threads': 'cymatic-threads', 'Plasma Smoke': 'plasma-smoke' }).name('trail style');
advanced.add(params, 'trailOnly').name('trail only');
advanced.add(params, 'fieldlineDensity', 0.2, 2, 0.01).name('fieldline density');
advanced.add(params, 'cymaticStrength', 0, 3, 0.01).name('cymatic strength');
advanced.add(params, 'shockwaveStrength', 0, 4, 0.01).name('shockwave');
advanced.add(params, 'vortexStrength', 0, 3, 0.01).name('vortex');
advanced.add(params, 'onsetSensitivity', 0.5, 5, 0.05).name('onset sensitivity');
advanced.add(params, 'autoOrbitShowcase').name('Auto Orbit Showcase');
advanced.add(params, 'cinematicMode').name('cinematic');
advanced.add(params, 'scaleBandSize', 35, 130, 1).name('scale depth');
advanced.add(params, 'chromaticAberration', 0, 2, 0.01).name('chromatic');
advanced.add(params, 'fieldLines').name('field lines');
advanced.add(params, 'motionMode', { paused: 'paused', slow: 'slow', normal: 'normal' }).name('motion');
advanced.add(params, 'pause').name('pause');
gui.add({ audio: () => enableAudioInput() }, 'audio').name('enable mic');
gui.add({ sound: () => universe.universe.cosmicAudio.start().catch((error) => console.warn(error)) }, 'sound').name('start sound');
gui.add({ sub: () => universe.universe.audio.triggerTest('sub') }, 'sub').name('Sub Boom');
gui.add({ bass: () => universe.universe.audio.triggerTest('bass') }, 'bass').name('Bass Pulse');
gui.add({ vocal: () => universe.universe.audio.triggerTest('vocal') }, 'vocal').name('Vocal Ribbon');
gui.add({ lead: () => universe.universe.audio.triggerTest('lead') }, 'lead').name('Guitar/Lead Arc');
gui.add({ hihat: () => universe.universe.audio.triggerTest('hihat') }, 'hihat').name('HiHat Sparks');
gui.add({ music: () => universe.universe.audio.triggerTest('music') }, 'music').name('Full Music Burst');
gui.add({ orbit: () => { params.autoOrbitShowcase = !params.autoOrbitShowcase; } }, 'orbit').name('Auto Orbit Showcase');
gui.add({ newSeed: () => {
  localStorage.setItem('recursive-universe-seed', `seed-${Date.now()}`);
  window.location.reload();
} }, 'newSeed').name('new seed');
gui.add({ share: () => navigator.clipboard?.writeText(window.location.href) }, 'share').name('copy URL');
gui.add({ reset: () => universe.reset() }, 'reset').name('reset');
gui.add({ upload: () => { params.primaryMode = 'demo'; demoInput.click(); } }, 'upload').name('Upload Song');
gui.add({ playPause: () => universe.universe.audio.toggleDemoPlayback?.() }, 'playPause').name('Play/Pause Song');

document.getElementById('intro')?.classList.add('hidden');

if (params.requestAudio) {
  enableAudioInput(true);
}
if (query.get('demo')) {
  loadDemoUrl(query.get('demo'), query.get('demoName') ?? 'demo audio', Number(query.get('demoStart') ?? 0));
}

window.addEventListener('keydown', (event) => {
  if (params.pianoPhysicsMode && PIANO_KEY_CODES.has(event.code)) return;
  if (event.code === 'Space') {
    params.motionMode = params.motionMode === 'paused' ? 'normal' : 'paused';
    params.pause = params.motionMode === 'paused';
  }
  if (event.code === 'KeyR') {
    universe.reset();
  }
  if (params.pianoPhysicsMode && event.code === 'Backquote') {
    params.uiVisible = !params.uiVisible;
    document.body.classList.toggle('ui-visible', params.uiVisible);
  }
  if (!params.pianoPhysicsMode && event.code === 'KeyF') {
    params.fieldLines = !params.fieldLines;
  }
  if (!params.pianoPhysicsMode && event.code === 'KeyH') {
    document.getElementById('controls-help')?.classList.toggle('visible');
  }
  if (event.code === 'Tab' && params.appMode === 'sound-board') {
    event.preventDefault();
    params.focusNodeIndex = (params.focusNodeIndex + 1) % Math.max(1, params.nodeCount ?? 3);
  }
  if (!params.pianoPhysicsMode && event.code === 'KeyU') {
    params.uiVisible = !params.uiVisible;
    document.body.classList.toggle('ui-visible', params.uiVisible);
  }
  if (!params.pianoPhysicsMode && event.code === 'KeyD') {
    params.diagnosticsVisible = !params.diagnosticsVisible;
    params.inputDebugVisible = params.diagnosticsVisible;
  }
  if (event.code === 'KeyN') {
    universe.universe.encounters.jumpToNext(camera);
  }
  if (event.code === 'KeyB') {
    universe.universe.encounters.jumpToPrevious(camera);
  }
  if (!params.pianoPhysicsMode && event.code === 'KeyE') {
    universe.universe.encounters.forceRandom(camera);
  }
  if (!params.pianoPhysicsMode && event.code === 'KeyG') {
    universe.universe.encounters.toggleLabels();
  }
  if (!params.pianoPhysicsMode && event.ctrlKey && event.shiftKey && event.code === 'KeyC') {
    capture.toggleRecording();
  }
  if (!params.pianoPhysicsMode && event.ctrlKey && event.shiftKey && event.code === 'KeyS') {
    capture.screenshot();
  }
  if (!params.pianoPhysicsMode && event.ctrlKey && event.shiftKey && event.code === 'KeyP') {
    params.posterMode = !params.posterMode;
    params.pause = params.posterMode;
    params.bloomStrength = params.posterMode ? Math.max(params.bloomStrength, 1.35) : PRESETS[params.preset].bloomStrength;
    params.volumetricDensity = params.posterMode ? Math.max(params.volumetricDensity, 0.09) : PRESETS[params.preset].volumetricDensity;
    if (params.posterMode) setTimeout(() => capture.screenshot(), 300);
  }
});

app.on('update', (dt) => {
  const activePreset = PRESETS[params.preset];
  if (!params.posterMode) {
    params.colorGrade = [...activePreset.colorGrade];
  }
  if (params.appMode !== 'sound-board' && params.heroMode && universe.time < 30) {
    const ramp = universe.time / 30;
    params.bloomStrength = activePreset.bloomStrength * (0.85 + ramp * 0.35);
    params.volumetricDensity = activePreset.volumetricDensity * (0.75 + ramp * 0.55);
    params.travelSpeed = activePreset.travelSpeed * (0.82 + ramp * 0.28);
  } else if (!params.posterMode) {
    params.volumetricDensity = activePreset.volumetricDensity;
    params.travelSpeed = activePreset.travelSpeed;
  }
  if (params.appMode !== 'sound-board' && params.encounterInfluence > 0.01) {
    const palette = params.encounterPalette ?? [1, 1, 1];
    params.colorGrade = [
      activePreset.colorGrade[0] * (1 - params.encounterInfluence * 0.35) + palette[0] * params.encounterInfluence * 0.35,
      activePreset.colorGrade[1] * (1 - params.encounterInfluence * 0.35) + palette[1] * params.encounterInfluence * 0.35,
      activePreset.colorGrade[2] * (1 - params.encounterInfluence * 0.35) + palette[2] * params.encounterInfluence * 0.35
    ];
    params.volumetricDensity = Math.max(params.volumetricDensity, activePreset.volumetricDensity + params.encounterInfluence * 0.012);
  }
  params.cosmicFlower *= Math.pow(0.965, Math.max(1, dt * 60));
  params.soundRift *= Math.pow(0.94, Math.max(1, dt * 60));
  params.goldenEscape *= Math.pow(0.975, Math.max(1, dt * 60));
  if (params.appMode === 'sound-board') {
    const bands = params.audioBands ?? {};
    params.cloudTint = [
      0.55 + (bands.bass ?? 0) * 0.95 + (bands.highMid ?? 0) * 0.35,
      0.85 + (bands.lowMid ?? 0) * 0.5 + (bands.mid ?? 0) * 0.45,
      1.05 + (bands.high ?? 0) * 0.8 + (bands.mid ?? 0) * 0.25
    ];
  }
  params.pause = params.motionMode === 'paused';
  const motionScale = params.motionMode === 'slow' ? 0.22 : 1;
  const scaledDt = params.pause ? 0 : Math.min(dt, params.updateCap) * params.timeScale * motionScale;
  camera.update(dt);
  universe.update(scaledDt);
  updateVisibleDebug();
});

app.start();

window.__recursiveUniverse = { params, camera, universe, piano };

function updateUrl() {
  const next = new URL(window.location.href);
  next.searchParams.set('preset', params.preset);
  next.searchParams.set('mode', params.appMode);
  next.searchParams.set('quality', params.quality);
  next.searchParams.set('hero', params.heroMode ? 'on' : 'off');
  if (params.universeSeed) next.searchParams.set('seed', params.universeSeed);
  next.searchParams.set('primaryMode', params.primaryMode);
  window.history.replaceState(null, '', next);
}

async function enableAudioInput(startProcedural = false) {
  try {
    await universe.universe.audio.enableMicrophone();
    if (startProcedural) await universe.universe.cosmicAudio.start();
  } catch (error) {
    params.audioPermission = error?.message ?? 'denied';
    console.warn(error);
  }
}

async function loadDemoFile(file) {
  try {
    params.primaryMode = 'demo';
    params.appMode = 'sound-board';
    params.pianoPhysicsMode = true;
    params.demoBuildProgress = 0;
    params.targetZoomDepth = 0.52;
    params.zoomDepth = 0.52;
    params.viewDepth = 0.52;
    params.cameraState = 'free';
    params.universeSeed = songSeed(file.name, file.size, file.lastModified || 0);
    localStorage.setItem('recursive-universe-seed', params.universeSeed);
    await universe.universe.audio.loadAudioFile(file);
    universe.reset();
    updateUrl();
  } catch (error) {
    params.audioPermission = error?.message ?? 'file failed';
    console.warn(error);
  }
}

async function loadDemoUrl(url, name = 'demo audio', startTime = 0) {
  try {
    params.primaryMode = 'demo';
    params.appMode = 'sound-board';
    params.pianoPhysicsMode = true;
    params.demoBuildProgress = 0;
    params.targetZoomDepth = 0.52;
    params.zoomDepth = 0.52;
    params.viewDepth = 0.52;
    params.cameraState = 'free';
    params.universeSeed = songSeed(name, url, startTime || 0);
    localStorage.setItem('recursive-universe-seed', params.universeSeed);
    await universe.universe.audio.loadAudioUrl(url, name);
    if (Number.isFinite(startTime) && startTime > 0) universe.universe.audio.seekDemoTime?.(startTime);
    universe.reset();
    updateUrl();
  } catch (error) {
    params.audioPermission = error?.message ?? 'demo failed';
    console.warn(error);
  }
}

function songSeed(...parts) {
  const text = parts.join('|').toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `song-${(h >>> 0).toString(36)}`;
}

function updateVisibleDebug() {
  document.body.classList.toggle('control-test', !!params.controlTestMode);
  const speed = params.speedMultiplier ?? 1;
  speedIndicator.style.display = params.appMode === 'sound-board' && params.viewDepth < 0.72 ? 'none' : 'block';
  speedIndicator.textContent = params.appMode === 'sound-board' ? params.viewLabel : `SPEED x${speed.toFixed(speed >= 10 ? 0 : 1)}`;
  boardReadout.style.display = params.appMode === 'sound-board' && !params.uiVisible && !params.diagnosticsVisible && params.primaryMode !== 'demo' ? 'none' : 'block';
  const activeNotes = params.activeNotes?.length ? params.activeNotes.join(' ') : 'none';
  const demoReadout = params.primaryMode === 'demo'
    ? ` · SONG ${params.demoFileName || 'drop audio'} ${formatTime(params.demoTime)}/${formatTime(params.demoDuration)} · RMS ${(params.audioRms ?? 0).toFixed(3)} · B/M/H ${(params.audioBass ?? 0).toFixed(2)}/${(params.audioMid ?? 0).toFixed(2)}/${(params.audioTreble ?? 0).toFixed(2)} · GROW ${(params.songGrowthLevel ?? params.demoBuildProgress ?? 0).toFixed(2)} · OBJECTS ${params.songObjectCount ?? 0} · ${params.songDominantStructure || params.strongestStructures || 'none'}`
    : '';
  boardReadout.textContent = params.pianoPhysicsMode
    ? `NOTES ${activeNotes} · ${params.noteInstrument} · ${params.chordType ?? 'none'} · MIC ${params.detectedNote} ${Math.round((params.detectedNoteConfidence ?? 0) * 100)}% · ENERGY ${(params.totalEnergy ?? 0).toFixed(2)}`
    : `CAM ${params.cameraDistance.toFixed(0)} · SIM x${params.simSpeed.toFixed(1)} · AUDIO ${params.audioLevel.toFixed(2)}`;
  if (params.primaryMode === 'demo') boardReadout.textContent += demoReadout;
  inputDebug.style.display = params.inputDebugVisible ? 'block' : 'none';
  inputDebug.textContent = [
    `mouse ${Math.round(params.mouseX)}, ${Math.round(params.mouseY)} moves ${params.pointerMoves}`,
    `dragging ${params.dragging} wheel ${Math.round(params.wheelDelta)}`,
    `yaw ${params.cameraYaw.toFixed(2)} pitch ${params.cameraPitch.toFixed(2)}`,
    `cam dist ${params.cameraDistance.toFixed(1)} sim ${params.simSpeed.toFixed(2)} target ${params.targetSimSpeed.toFixed(2)}`,
    `speed x${speed.toFixed(2)} target x${(params.targetSpeedMultiplier ?? 1).toFixed(2)}`,
    `tunnel ${params.tunnelTightness.toFixed(2)}`,
    `mic ${params.audioEnabled} permission ${params.audioPermission}`,
    `rms ${params.audioRms.toFixed(3)} floor ${params.audioNoiseFloor.toFixed(3)} energy ${params.audioEnergy.toFixed(2)}`,
    `sub ${params.audioSub.toFixed(2)} bass ${params.audioBass.toFixed(2)} lowMid ${params.audioLowMid.toFixed(2)}`,
    `mid ${params.audioMid.toFixed(2)} highMid ${params.audioHighMid.toFixed(2)} high ${params.audioTreble.toFixed(2)}`,
    `events sub ${params.audioBandEvents.sub.toFixed(2)} bass ${params.audioBandEvents.bass.toFixed(2)} lowMid ${params.audioBandEvents.lowMid.toFixed(2)}`,
    `events mid ${params.audioBandEvents.mid.toFixed(2)} highMid ${params.audioBandEvents.highMid.toFixed(2)} high ${params.audioBandEvents.high.toFixed(2)} broad ${params.audioBandEvents.broadband.toFixed(2)}`,
    `variance ${params.audioBandVariance.toFixed(3)} dominant ${params.audioDominantBand} history ${params.audioEventHistory}`,
    `onsets ${params.audioOnsetCount} hit ${params.audioHitType} onset ${params.audioOnset.toFixed(2)}`,
    `centroid ${Math.round(params.audioCentroid)}Hz synthetic ${params.audioSynthetic}`,
    `notes ${(params.activeNotes ?? []).join(' ') || 'none'} detected ${params.detectedNote} confidence ${(params.detectedNoteConfidence ?? 0).toFixed(2)}`,
    `instrument ${params.noteInstrument} live ${params.liveInstrumentEstimate} chord ${params.chordType} layout ${params.noteLayout}`,
    `families ${(params.noteFamilyActivation ?? []).map((value) => value.toFixed(2)).join(' ')} energy ${(params.totalEnergy ?? 0).toFixed(2)} chaos ${(params.chaosLevel ?? 0).toFixed(2)}`,
    `radius avg ${params.averageParticleRadius.toFixed(1)} target ${params.equilibriumRadius.toFixed(1)} edge ${params.boundaryRadius.toFixed(1)} inner ${params.innerRepulsionRadius.toFixed(1)}`,
    `hist ${params.radialHistogram}`,
    `encounter ${params.encounterName} ${Math.round(params.encounterDistance)}m ${params.encounterInfluence.toFixed(2)}`
  ].join('\n');

  const pulse = Math.max(params.audioPulse ?? 0, params.audioLevel ?? 0);
  const showDomPulse = params.controlTestMode && params.appMode === 'sound-board' && params.primaryMode !== 'demo';
  audioPulse.style.opacity = showDomPulse ? String(Math.min(0.9, pulse * 1.4)) : '0';
  audioPulse.style.transform = `translate(-50%, -50%) scale(${0.45 + pulse * (params.controlTestMode ? 5.5 : 3.2)})`;
  audioPulse.style.borderColor = `rgba(130, 255, 230, ${Math.min(0.75, pulse * 1.6)})`;
  audioPulse.style.boxShadow = `0 0 ${Math.round(24 + pulse * 90)}px rgba(0, 255, 220, ${Math.min(0.45, pulse)})`;
}

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

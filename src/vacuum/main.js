import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { PhysicsEngine } from './PhysicsEngine.js';
import { ObjectFactory } from './ObjectFactory.js';
import { VisualEffects } from './VisualEffects.js';
import { Interaction } from './Interaction.js';
import { UI } from './UI.js';
import { ParticleLayer } from './ParticleLayer.js';
import { NebulaBackground } from './NebulaBackground.js';
import { NebulaFxLayer } from './NebulaFxLayer.js';
import { FilamentLayer } from './FilamentLayer.js';
import { PaintLayer } from './PaintLayer.js';
import { createSoftParticleTexture } from './SoftParticleTexture.js';
import { ASSETS } from './config.js';

const canvas = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010207);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 9000);
camera.position.set(0, -420, 760);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.62, 0.72, 0.18);
composer.addPass(bloomPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.minDistance = 32;
controls.maxDistance = 6200;
controls.target.set(0, 0, 0);
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.update();

const ambient = new THREE.AmbientLight(0x6688aa, 0.5);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(120, 180, 400);
const starfield = createStarfield();
const paintCursor = createPaintCursor();
scene.add(ambient, sun, starfield, paintCursor);

const state = {
  bodies: [],
  events: [],
  selected: null,
  paused: false,
  showFields: false,
  showTopology: false,
  showTrails: false,
  showParticles: true,
  showFilaments: false,
  showBounds: false,
  devMode: false,
  toolMode: 'select',
  brushMode: 'stars',
  powerRadius: 185,
  powerStrength: 1,
  brushSize: 1,
  brushStrength: 1,
  cameraShake: 0,
  shakeScale: 1,
  timeScale: 1,
  gravityScale: 34,
  softeningScale: 18,
  captureScale: 1.4,
  substeps: 2,
  damping: 0.996,
  restitution: 0.72,
  boundaryRestitution: 0.78,
  maxAcceleration: 850,
  maxVelocity: 520,
  spacetimeScale: 1,
  wProjection: 0.65,
  ragdollScale: 1.35,
  boundsSize: 820,
  depthSpread: 140,
  cameraMode: 'iso',
  maxDust: 260,
  renderScale: 1.7,
  bloomStrength: 0.62,
  bloomRadius: 0.72,
  bloomThreshold: 0.18,
  nebulaOpacity: 1,
  fieldDensity: 1,
  trailLength: 240
};

const factory = new ObjectFactory(scene, state);
const physics = new PhysicsEngine(state);
const effects = new VisualEffects(scene, state);
const particles = new ParticleLayer(scene, state);
const nebulaBackground = new NebulaBackground(scene, state);
const nebula = new NebulaFxLayer(scene, state);
const filaments = new FilamentLayer(scene, state);
const paintLayer = new PaintLayer(scene, state);
const ui = new UI(state, {
  spawn,
  spawnAtCenter: (type) => spawn(type, findFreeSpawnPosition(type)),
  selectionChanged: () => ui.updateInspector(),
  inspectSet,
  inspectAction,
  togglePause,
  toggleFields,
  toggleTopology,
  toggleTrails,
  toggleParticles,
  toggleFilaments,
  toggleBounds,
  pulseUniverse,
  fossilizeUniverse,
  clearDust,
  clearFossils,
  clearTrails,
  setToolMode,
  setBrushMode,
  applyToolAt,
  setDevSetting,
  setCameraView,
  pointerMoved,
  spawnPreset,
  applyPhysicsPreset,
  reset
});
new Interaction(renderer, camera, state, {
  spawn,
  selectionChanged: () => ui.updateInspector(),
  togglePause,
  toggleFields,
  toggleTopology,
  toggleTrails,
  toggleParticles,
  toggleFilaments,
  toggleBounds,
  pulseUniverse,
  fossilizeUniverse,
  clearDust,
  clearFossils,
  clearTrails,
  setToolMode,
  setBrushMode,
  applyToolAt,
  setDevSetting,
  setCameraView,
  pointerMoved,
  spawnPreset,
  applyPhysicsPreset,
  reset
}, controls);

let last = performance.now();
animate(last);

function animate(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0.016) * state.timeScale;
  last = now;
  if (!state.paused) {
    physics.step(dt);
    consumePhysicsEvents();
    cleanupRemovedBodies();
    for (const body of state.bodies) {
      factory.updateTrail(body);
      updateBodyVisual(body, dt);
    }
    particles.update(dt);
    nebulaBackground.update(dt, camera);
    nebula.update(dt);
    paintLayer.update(dt);
  }
  filaments.update(dt);
  effects.update();
  starfield.position.copy(camera.position);
  ui.updateInspector();
  updateCameraTarget();
  controls.update();
  const shakeOffset = new THREE.Vector3();
  if (state.cameraShake > 0) {
    shakeOffset.copy(randomDirection()).multiplyScalar(state.cameraShake * (state.shakeScale ?? 1));
    camera.position.add(shakeOffset);
    state.cameraShake = Math.max(0, state.cameraShake - dt * 18);
  }
  composer.render();
  if (shakeOffset.lengthSq() > 0) camera.position.sub(shakeOffset);
  requestAnimationFrame(animate);
}

function cleanupRemovedBodies() {
  const removed = state.bodies.filter((body) => body.toRemove);
  for (const body of removed) {
    scene.remove(body.group);
    if (state.selected === body) state.selected = null;
  }
  if (removed.length) state.bodies = state.bodies.filter((body) => !body.toRemove);
}

function consumePhysicsEvents() {
  while (state.events.length) {
    const event = state.events.shift();
    if (event.type === 'magnetic-aurora') {
      particles.burst(event.position, 0x72fff0, 54, 86, 'spark');
      nebula.burst(event.position, { count: 68, colorA: '#72fff0', colorB: '#ff4ed6', speed: 90, life: 1.4, radius: [4, 15], drift: 42 });
      ui.status.textContent = 'magnetic aurora caught dust';
      continue;
    }
    if (event.type === 'portal-laser') {
      particles.burst(event.position, 0xff3c72, 68, 170, 'laser');
      particles.burst(event.position, 0x72fff0, 46, 130, 'spark');
      nebula.burst(event.position, { count: 80, colorA: '#ff3c72', colorB: '#72fff0', speed: 150, life: 1.1, radius: [3, 13], drift: 36 });
      state.cameraShake = Math.max(state.cameraShake, 1.8);
      ui.status.textContent = 'wormhole split the beam';
      continue;
    }
    if (event.type === 'comet-flare') {
      seedFineDust(event.position, 28, 0xcffcff, 120, 0.03, false, 'Comet Vapor');
      particles.burst(event.position, 0xcffcff, 54, 120, 'comet');
      nebula.burst(event.position, { count: 52, colorA: '#cffcff', colorB: '#ffb35d', speed: 105, life: 1.2, radius: [4, 14], drift: 34 });
      ui.status.textContent = 'star boiled a comet tail';
      continue;
    }
    if (event.type === 'vaporize-ice') {
      const body = state.bodies.find((item) => item.id === event.bodyId);
      if (body) {
        body.tailLength = Math.min(4, (body.tailLength ?? 1) + 0.9);
        body.tailWidth = Math.min(3, (body.tailWidth ?? 1) + 0.35);
        body.heat = 1;
      }
      seedFineDust(event.position, 42, 0xcffcff, 135, 0.025, false, 'Icy Steam');
      particles.burst(event.position, 0xcffcff, 86, 150, 'comet');
      nebula.burst(event.position, { count: 95, colorA: '#cffcff', colorB: '#ffb35d', speed: 130, life: 1.75, radius: [6, 22], drift: 52 });
      ui.status.textContent = 'star flash-boiled comet ice';
      continue;
    }
    if (event.type === 'magma-splash') {
      const body = state.bodies.find((item) => item.id === event.bodyId);
      if (body) {
        body.label = `Molten ${body.label}`;
        body.heat = 1;
        body.glow = Math.max(body.glow ?? 1, 2.2);
      }
      seedFineDust(event.position, 48, 0xff7a24, 120, 0.07, true, 'Molten Spray');
      particles.burst(event.position, 0xff7a24, 92, 150, 'radiation');
      nebula.burst(event.position, { count: 82, colorA: '#ff7a24', colorB: '#ffd36b', speed: 122, life: 1.35, radius: [5, 16], drift: 32 });
      ui.status.textContent = `${event.sourceType ?? 'planet'} crust liquefied`;
      continue;
    }
    if (event.type === 'gas-giant-shear') {
      const body = state.bodies.find((item) => item.id === event.bodyId);
      if (body) {
        body.heat = 1;
        body.angularVelocity += 0.9;
        body.fieldStress = 1.2;
      }
      seedFineDust(event.position, 70, 0xffb35d, 105, 0.035, true, 'Boiled Atmosphere');
      particles.burst(event.position, 0xffb35d, 96, 142, 'gas');
      nebula.burst(event.position, { count: 135, colorA: '#ffb35d', colorB: '#9b7cff', speed: 128, life: 2.0, radius: [8, 26], drift: 58 });
      ui.status.textContent = 'gas giant atmosphere sheared';
      continue;
    }
    if (event.type === 'charged-metal') {
      const body = state.bodies.find((item) => item.id === event.bodyId);
      if (body) {
        body.label = `Charged ${body.label}`;
        body.glow = Math.max(body.glow ?? 1, 1.7);
      }
      particles.burst(event.position, 0xff4ed6, 62, 105, 'spark');
      nebula.burst(event.position, { count: 70, colorA: '#ff4ed6', colorB: '#72fff0', speed: 95, life: 1.3, radius: [4, 15], drift: 42 });
      ui.status.textContent = 'metal hull charged by field contact';
      continue;
    }
    if (event.type === 'beam-scar') {
      const target = state.bodies.find((item) => item.id === event.targetId);
      if (target) {
        target.label = `Scarred ${target.label}`;
        target.glow = Math.max(target.glow ?? 1, 1.35);
      }
      seedFineDust(event.position, 16, 0xff3c72, 120, 0.025, true, 'Beam Ash');
      particles.burst(event.position, 0xff3c72, 58, 150, 'laser');
      nebula.burst(event.position, { count: 50, colorA: '#ff3c72', colorB: '#fff0ff', speed: 125, life: 0.9, radius: [3, 11], drift: 18 });
      ui.status.textContent = `${event.targetType ?? 'object'} beam-scarred`;
      continue;
    }
    if (event.type === 'spacetime-shear') {
      const body = state.bodies.find((item) => item.id === event.bodyId);
      if (body) {
        body.fieldStress = Math.max(body.fieldStress ?? 0, 1.1);
        body.shockwave = Math.max(body.shockwave ?? 0, 0.75);
        body.heat = Math.max(body.heat ?? 0, 0.35);
      }
      seedFineDust(event.position, 22, event.w > 0 ? 0x72eaff : 0xff9d42, 95, 0.035, true, 'Spacetime Shear');
      particles.burst(event.position, event.w > 0 ? 0x72eaff : 0xff9d42, 76, 150, 'radiation');
      nebula.burst(event.position, {
        count: 86,
        colorA: event.w > 0 ? '#72eaff' : '#ff9d42',
        colorB: '#ffffff',
        speed: 150,
        life: 1.45,
        radius: [5, 18],
        drift: 52
      });
      state.cameraShake = Math.max(state.cameraShake, 2.4);
      ui.status.textContent = `${event.bodyLabel ?? 'object'} sheared through W-space`;
      continue;
    }
    if (event.type === 'phase-pop') {
      const body = state.bodies.find((item) => item.id === event.bodyId);
      if (body) {
        body.fieldStress = Math.max(body.fieldStress ?? 0, 0.8);
        body.shockwave = Math.max(body.shockwave ?? 0, 0.7);
      }
      particles.burst(event.position, 0x72fff0, 64, 130, 'spark');
      nebula.burst(event.position, { count: 72, colorA: '#72fff0', colorB: '#c35cff', speed: 120, life: 1.25, radius: [4, 16], drift: 44 });
      ui.status.textContent = `${event.bodyLabel ?? 'object'} phase-popped through a wormhole`;
      continue;
    }
    if (event.type === 'ignite') {
      const body = state.bodies.find((item) => item.id === event.bodyId);
      if (body) {
        body.label = 'Ignited Gas Cloud';
        body.mass = Math.max(body.mass, 10);
        body.shockwave = 1;
        body.accretion = 1;
        body.angularVelocity += 1.4;
      }
      particles.burst(event.position, 0xffb35d, 72, 140, 'radiation');
      ui.status.textContent = 'gas cloud ignition';
      continue;
    }
    if (event.type === 'wormhole-star') {
      const portal = state.bodies.find((item) => item.id === event.portalId);
      const star = state.bodies.find((item) => item.id === event.starId);
      if (portal) {
        portal.label = 'Charged Wormhole';
        portal.angularVelocity += 1.8;
        portal.charge = Math.max(2, portal.charge ?? 0);
      }
      if (star) {
        star.shockwave = 1;
        star.fieldStress = 1;
      }
      seedFineDust(event.position, 42, 0xffd66b, 120, 0.1, true);
      particles.burst(event.position, 0x72fff0, 92, 170, 'radiation');
      nebula.burst(event.position, { count: 82, colorA: '#72fff0', colorB: '#ffd66b', speed: 135, life: 1.4, radius: [5, 16], drift: 32 });
      state.cameraShake = Math.max(state.cameraShake, 2.6);
      ui.status.textContent = 'wormhole charged by stellar contact';
      continue;
    }
    if (event.type === 'blackhole-merge') {
      const eater = state.bodies.find((item) => item.id === event.eaterId);
      if (eater) {
        eater.accretion = Math.max(eater.accretion ?? 0, 4.5);
        eater.shockwave = 1.5;
        eater.fieldStress = 1.2;
      }
      seedFineDust(event.position, 88, 0xff9d42, 180, 0.06, true, 'Horizon Ash');
      seedFineDust(event.position, 42, 0x72eaff, 150, 0.04, true, 'Lensed Plasma');
      particles.burst(event.position, 0xff9d42, 120, 230, 'accretion');
      particles.burst(event.position, 0x72eaff, 90, 210, 'radiation');
      nebula.burst(event.position, { count: 140, colorA: '#ff9d42', colorB: '#72eaff', speed: 190, life: 2.0, radius: [6, 24], drift: 58 });
      state.cameraShake = Math.max(state.cameraShake, 6.5);
      ui.status.textContent = 'event horizons merged';
      continue;
    }
    if (event.type === 'stick') {
      particles.burst(event.position, 0x8ff7ff, 18, 36, 'spark');
      ui.status.textContent = `${event.smallLabel} stuck to ${event.largeLabel}`;
      continue;
    }
    if (event.type === 'impact') {
      const impact = impactRecipe(event);
      const color = impact.color;
      particles.burst(event.position, color, Math.min(58, 12 + Math.floor(event.speed * 0.35)), 45 + event.speed, impact.kind);
      if (event.aCategory === 'crew' || event.bCategory === 'crew') {
        nebula.burst(event.position, { count: 34, colorA: '#7dff9b', colorB: '#ff4b38', speed: 65 + event.speed, life: 1.2, radius: [4, 13], drift: 38 });
      } else {
        nebula.burst(event.position, { count: Math.min(46, 8 + Math.floor(event.speed * 0.22)), colorA: `#${color.toString(16).padStart(6, '0')}`, colorB: impact.colorB, speed: 42 + event.speed, life: 0.9, radius: [2, 9], drift: 20 });
      }
      if (event.speed > 34) seedFineDust(event.position, Math.min(18, Math.floor(event.speed * 0.18)), color, 35 + event.speed * 0.45, 0.035, event.speed > 60);
      if (event.speed > 32) state.cameraShake = Math.max(state.cameraShake, Math.min(3.4, event.speed * 0.035));
      continue;
    }
    if (event.type === 'abduct') {
      const target = state.bodies.find((item) => item.id === event.targetId);
      const craft = state.bodies.find((item) => item.id === event.ufoId);
      if (target) {
        target.fieldStress = Math.max(target.fieldStress ?? 0, 0.85);
        target.trail.length = 0;
      }
      if (craft) craft.accretion = Math.max(craft.accretion ?? 0, 1);
      particles.burst(event.position, 0x72fff0, 58, 94, 'spark');
      nebula.burst(event.position, { count: 72, colorA: '#72fff0', colorB: '#9dff6e', speed: 92, life: 1.45, radius: [5, 18], drift: 34 });
      ui.status.textContent = `${event.targetLabel ?? 'object'} caught in tractor field`;
      continue;
    }
    if (event.type === 'bio-plasma') {
      const alien = event.sourceType === 'alien';
      const colors = alien ? [0x9dff6e, 0x34ff7a, 0x72fff0] : [0xb51218, 0xff3a24, 0xffd8c4];
      seedFineDust(event.position, Math.floor(18 + event.severity * 28), colors[0], 48 + event.severity * 78, 0.035, true, alien ? 'Alien Bio-Plasma' : 'Suit Mist');
      particles.burst(event.position, colors[1], Math.floor(34 + event.severity * 52), 72 + event.severity * 84, 'gas');
      nebula.burst(event.position, {
        count: Math.floor(44 + event.severity * 62),
        colorA: `#${colors[0].toString(16).padStart(6, '0')}`,
        colorB: `#${colors[2].toString(16).padStart(6, '0')}`,
        speed: 64 + event.severity * 88,
        life: 1.5,
        radius: [4, 15],
        drift: 48
      });
      ui.status.textContent = `${event.sourceLabel ?? 'crew'} vented bio-plasma`;
      continue;
    }
    if (event.type === 'fragment') {
      const hot = event.severity > 0.6;
      seedFragments(event.position, event.velocity, event.severity, event.sourceCategory);
      seedFineDust(event.position, Math.floor(10 + event.severity * 24), hot ? 0xffb35d : 0x9fefff, 80 + event.severity * 90, 0.04, hot);
      particles.burst(event.position, hot ? 0xff9d42 : 0x9fefff, Math.floor(24 + event.severity * 50), 90 + event.severity * 110, hot ? 'radiation' : 'spark');
      nebula.burst(event.position, { count: Math.floor(28 + event.severity * 55), colorA: hot ? '#ff9d42' : '#9fefff', colorB: '#ffffff', speed: 80 + event.severity * 130, life: 0.9 + event.severity * 0.5, radius: [3, 11], drift: 24 });
      state.cameraShake = Math.max(state.cameraShake, 1.6 + event.severity * 2.2);
      ui.status.textContent = `${event.sourceType} fragmented`;
      continue;
    }
    if (event.type === 'burn') {
      seedFineDust(event.position, 22, 0xff9d42, 130, 0.03, true);
      particles.burst(event.position, 0xff6a32, 78, 150, 'radiation');
      nebula.burst(event.position, { count: 70, colorA: '#ff6a32', colorB: '#fff0a4', speed: 145, life: 1.0, radius: [4, 14], drift: 36 });
      ui.status.textContent = `${event.foodType} burned up`;
      continue;
    }
    if (event.type === 'scorch') {
      const body = state.bodies.find((item) => item.id === event.bodyId);
      if (body) {
        body.label = `Scorched ${body.label}`;
        body.heat = 1;
        body.shockwave = 1;
      }
      particles.burst(event.position, 0xff9d42, 42, 95, 'radiation');
      nebula.burst(event.position, { count: 36, colorA: '#ff9d42', colorB: '#fff4b8', speed: 85, life: 0.85, radius: [4, 12], drift: 18 });
      ui.status.textContent = `${event.bodyType} scorched`;
      continue;
    }
    if (event.type !== 'absorb') continue;
    handleBlackHoleAbsorb(event);
  }
}

function handleBlackHoleAbsorb(event) {
  const category = event.foodCategory ?? 'debris';
  const recipes = {
    crew: {
      status: `${event.foodLabel ?? 'crew'} spaghettified`,
      dustLabel: 'Suit Mist',
      fragmentLabel: 'Suit Fragment',
      colors: [0xb51218, 0xff3a24, 0xffd8c4],
      dust: 36,
      fragments: 14,
      speed: 145,
      hot: true,
      sparkKind: 'radiation'
    },
    planetary: {
      status: `${event.foodLabel ?? 'planet'} became molten rubble`,
      dustLabel: 'Molten Regolith',
      fragmentLabel: 'Crust Shard',
      colors: [0xff7a24, 0x9b6c4b, 0xffd36b],
      dust: 54,
      fragments: 20,
      speed: 118,
      hot: true,
      sparkKind: 'radiation'
    },
    gas: {
      status: `${event.foodLabel ?? 'gas cloud'} flashed into plasma`,
      dustLabel: 'Plasma Vapor',
      fragmentLabel: 'Ion Knot',
      colors: [0xffb35d, 0x9b7cff, 0x72fff0],
      dust: 72,
      fragments: 0,
      speed: 92,
      hot: true,
      sparkKind: 'gas'
    },
    spacecraft: {
      status: `${event.foodLabel ?? 'spacecraft'} shredded into metal`,
      dustLabel: 'Metal Spark',
      fragmentLabel: 'Hull Shard',
      colors: [0xb8d8ff, 0xf2fbff, 0xffb36b],
      dust: 42,
      fragments: 18,
      speed: 135,
      hot: true,
      sparkKind: 'spark'
    },
    'small-body': {
      status: `${event.foodLabel ?? 'small body'} sprayed icy grit`,
      dustLabel: event.foodType === 'comet' ? 'Icy Vapor' : 'Rock Grit',
      fragmentLabel: event.foodType === 'comet' ? 'Ice Shard' : 'Rock Shard',
      colors: event.foodType === 'comet' ? [0xcffcff, 0x72dfff, 0xffffff] : [0xb08d73, 0x7a6657, 0xffb36b],
      dust: 46,
      fragments: 12,
      speed: 118,
      hot: event.foodType !== 'comet',
      sparkKind: event.foodType === 'comet' ? 'comet' : 'spark'
    },
    debris: {
      status: `${event.foodLabel ?? 'debris'} ground into dust`,
      dustLabel: 'Impact Powder',
      fragmentLabel: 'Debris Chip',
      colors: [0x8b776a, 0xc7b8a6, 0xff9d42],
      dust: 34,
      fragments: 8,
      speed: 105,
      hot: true,
      sparkKind: 'spark'
    },
    dust: {
      status: `${event.foodLabel ?? 'dust'} joined the accretion flow`,
      dustLabel: 'Accretion Dust',
      fragmentLabel: 'Dust Fleck',
      colors: [0xff9d42, 0x72fff0, 0xffffff],
      dust: 20,
      fragments: 0,
      speed: 80,
      hot: true,
      sparkKind: 'accretion'
    },
    energy: {
      status: `${event.foodLabel ?? 'energy'} lanced through the horizon`,
      dustLabel: 'Photon Spray',
      fragmentLabel: 'Light Splinter',
      colors: [0xffffff, 0xff3c72, 0x72fff0],
      dust: 18,
      fragments: 0,
      speed: 190,
      hot: true,
      sparkKind: 'laser'
    },
    field: {
      status: `${event.foodLabel ?? 'field object'} warped the horizon`,
      dustLabel: 'Charged Topology',
      fragmentLabel: 'Field Node',
      colors: [0x72fff0, 0xc35cff, 0xffffff],
      dust: 44,
      fragments: 6,
      speed: 120,
      hot: false,
      sparkKind: 'spark'
    }
  };
  const recipe = recipes[category] ?? recipes.debris;
  const massBoost = Math.min(1.6, Math.max(0.5, (event.foodMass ?? 1) / 10));
  const inheritedVelocity = event.velocity ?? new THREE.Vector3();
  if (recipe.fragments) {
    seedFragments(event.position, inheritedVelocity, Math.min(1, 0.35 + massBoost * 0.36), category, recipe.colors, recipe.fragmentLabel);
  }
  seedFineDust(event.position, Math.floor(recipe.dust * massBoost), recipe.colors[0], recipe.speed, category === 'gas' ? 0.025 : 0.07, recipe.hot, recipe.dustLabel);
  for (let i = 0; i < recipe.colors.length; i++) {
    particles.burst(event.position, recipe.colors[i], Math.floor((28 + recipe.dust * 0.28) / (i + 1)), recipe.speed + i * 24, recipe.sparkKind);
  }
  nebula.burst(event.position, {
    count: Math.floor(38 + recipe.dust * 0.55),
    colorA: `#${recipe.colors[0].toString(16).padStart(6, '0')}`,
    colorB: `#${recipe.colors[recipe.colors.length - 1].toString(16).padStart(6, '0')}`,
    speed: recipe.speed * 1.05,
    life: category === 'gas' ? 1.8 : 1.25,
    radius: category === 'gas' ? [7, 20] : [3, 12],
    drift: category === 'crew' ? 48 : category === 'gas' ? 42 : 28
  });
  const eater = state.bodies.find((body) => body.id === event.eaterId);
  if (eater) {
    eater.accretion = Math.min(4, (eater.accretion ?? 0) + 0.2 + massBoost * 0.12);
    eater.shockwave = Math.max(eater.shockwave ?? 0, 0.65);
  }
  ui.status.textContent = recipe.status;
  state.cameraShake = Math.max(state.cameraShake, category === 'dust' ? 0.8 : 2.2 + massBoost);
}

function impactRecipe(event) {
  const categories = [event.aCategory, event.bCategory];
  const types = [event.aType, event.bType];
  if (categories.includes('spacecraft')) return { color: 0xb8d8ff, colorB: '#ffb36b', kind: 'spark' };
  if (categories.includes('stellar') || types.includes('star')) return { color: 0xffd36b, colorB: '#ff6838', kind: 'radiation' };
  if (categories.includes('gas')) return { color: 0x9b7cff, colorB: '#ffb35d', kind: 'gas' };
  if (categories.includes('field')) return { color: 0x72fff0, colorB: '#c35cff', kind: 'spark' };
  if (categories.includes('planetary')) return { color: 0xb9794e, colorB: '#ffd36b', kind: 'spark' };
  if (categories.includes('small-body') || categories.includes('debris')) return { color: 0x9a8171, colorB: '#ffc28a', kind: 'spark' };
  return { color: 0xffb36b, colorB: '#ffffff', kind: 'spark' };
}

function spawn(type, position) {
  const body = factory.create(type, position);
  state.bodies.push(body);
  state.selected = body;
  ui.status.textContent = `${body.label} dropped into the vacuum`;
  ui.updateInspector();
  if (type === 'debris') {
    for (let i = 0; i < 8; i++) {
      const fragment = factory.create('debris', position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 38, (Math.random() - 0.5) * 38, 0)));
      state.bodies.push(fragment);
    }
  }
  if (type === 'dust') {
    seedFineDust(position, 34, 0x9fefff, 42, 0.04, false);
  }
}

function randomSpawnPosition() {
  const depth = state.depthSpread ?? 0;
  return new THREE.Vector3(
    (Math.random() - 0.5) * 180,
    (Math.random() - 0.5) * 120,
    (Math.random() - 0.5) * depth
  );
}

function findFreeSpawnPosition(type) {
  const asset = ASSETS.find((item) => item.type === type);
  const radius = asset?.radius ?? 10;
  const attempts = 120;
  let best = randomSpawnPosition();
  let bestClearance = -Infinity;
  for (let i = 0; i < attempts; i++) {
    const spread = 160 + Math.min(620, i * 7);
    const candidate = new THREE.Vector3(
      (Math.random() - 0.5) * spread * 2,
      (Math.random() - 0.5) * spread * 1.35,
      (Math.random() - 0.5) * (state.depthSpread ?? 0)
    );
    const clearance = nearestClearance(candidate, radius, asset?.category);
    if (clearance > bestClearance) {
      best = candidate;
      bestClearance = clearance;
    }
    if (clearance > radius + 60) return candidate;
  }
  return best;
}

function nearestClearance(position, radius, category = null) {
  if (!state.bodies.length) return Infinity;
  let clearance = Infinity;
  const incomingField = category === 'singularity' ? radius * 9 : category === 'stellar' ? radius * 6 : category === 'field' ? radius * 4 : radius;
  for (const body of state.bodies) {
    const occupied = radius + body.radius * (body.collisionScale ?? 1) + 16;
    const existingField = body.category === 'singularity'
      ? body.radius * 10
      : body.category === 'stellar'
        ? body.radius * 6
        : body.category === 'field'
          ? body.radius * 4
          : body.radius;
    const needed = Math.max(occupied, existingField + incomingField * 0.45);
    clearance = Math.min(clearance, position.distanceTo(body.position) - needed);
  }
  return clearance;
}

function applyPhysicsPreset(name) {
  const presets = {
    chill: {
      gravityScale: 22,
      softeningScale: 30,
      captureScale: 0.9,
      substeps: 3,
      damping: 0.992,
      restitution: 0.52,
      boundaryRestitution: 0.58,
      maxAcceleration: 520,
      maxVelocity: 340,
      spacetimeScale: 0.55
    },
    orbit: {
      gravityScale: 34,
      softeningScale: 18,
      captureScale: 1.2,
      substeps: 3,
      damping: 0.998,
      restitution: 0.74,
      boundaryRestitution: 0.78,
      maxAcceleration: 850,
      maxVelocity: 520,
      spacetimeScale: 0.85
    },
    chaos: {
      gravityScale: 58,
      softeningScale: 10,
      captureScale: 1.5,
      substeps: 5,
      damping: 0.999,
      restitution: 0.92,
      boundaryRestitution: 0.94,
      maxAcceleration: 1250,
      maxVelocity: 780,
      spacetimeScale: 1.25
    },
    theater: {
      gravityScale: 42,
      softeningScale: 22,
      captureScale: 2,
      substeps: 4,
      damping: 0.995,
      restitution: 0.68,
      boundaryRestitution: 0.75,
      maxAcceleration: 900,
      maxVelocity: 520,
      spacetimeScale: 1.5
    }
  };
  const preset = presets[name] ?? presets.orbit;
  Object.assign(state, preset);
  ui.syncToolbar();
  ui.status.textContent = `${name} physics preset loaded`;
}

function spawnPreset(name) {
  reset();
  if (name === 'solar') {
    spawnWith('star', 0, 0, 0, 0, 0, 0);
    spawnWith('planet', 150, 0, 0, 0, 86, 0);
    spawnWith('mars', 220, -40, 35, 18, 68, -6);
    spawnWith('jupiter', -270, 35, -60, -8, -52, 4);
    spawnWith('moon', 174, 0, 0, 0, 108, 0);
    spawnWith('comet', -260, -90, 60, 82, 32, -12);
    spawnWith('hubble', 0, 190, -40, -76, 0, 8);
    spawnWith('jwst', -210, 160, 110, 46, -54, 12);
    ui.status.textContent = 'solar system playground seeded';
    setCameraView('iso');
  }
  if (name === 'feeding') {
    spawnWith('blackhole', 0, 0, 0, 0, 0, 0);
    spawnWith('gas', -160, 20, 20, 72, -4, 0);
    spawnWith('gas', 130, -120, -40, -54, 38, 8);
    spawnWith('comet', -260, -130, -35, 112, 42, 12);
    spawnWith('asteroid', 180, 130, 40, -80, -22, -8);
    spawnWith('astronaut', 120, -160, 30, -32, 62, 0);
    spawnWith('probe', -80, 190, -55, 48, -40, 10);
    spawnWith('voyager', 230, 80, 95, -58, -20, -12);
    ui.status.textContent = 'black hole feeding scenario seeded';
    setCameraView('iso');
  }
  if (name === 'deep-space') {
    spawnWith('station', -140, 60, 90, 20, 12, -8);
    spawnWith('mir', 130, -80, -80, -18, -10, 10);
    spawnWith('mystery', 0, 0, 0, 0, 34, 0);
    spawnWith('probe', -230, -150, 40, 72, 44, -16);
    spawnWith('hubble', 230, 150, -70, -62, -36, 18);
    spawnWith('mro', 90, 220, 80, -52, -38, -14);
    spawnWith('dish', -260, 120, -110, 12, -16, 8);
    spawnWith('asteroid', 40, 210, 110, -28, -64, -20);
    spawnWith('ufo', -70, -40, 120, 18, 16, -10);
    spawnWith('alien', -92, -78, 92, 34, 6, -4);
    ui.status.textContent = 'deep space mission scenario seeded';
    setCameraView('iso');
  }
  if (name === 'moon-capture') {
    spawnWith('planet', 0, 0, 0, 0, 0, 0);
    spawnWith('moon', 130, 0, 48, 0, 78, -8);
    spawnWith('astronaut', 170, -30, 30, -12, 64, 8);
    spawnWith('station', -130, 80, -56, 34, -24, 6);
    spawnWith('rover', 24, -22, 34, 0, 0, 0);
    ui.status.textContent = 'moon capture scenario seeded';
    setCameraView('iso');
  }
  if (name === 'slingshot') {
    spawnWith('star', 0, 0, 0, 0, 0, 0);
    spawnWith('comet', -330, -90, 90, 130, 42, -18);
    spawnWith('probe', -260, 170, -50, 90, -36, 14);
    spawnWith('hubble', 180, -130, 40, -30, 52, -4);
    ui.status.textContent = 'comet slingshot scenario seeded';
    setCameraView('iso');
  }
  if (name === 'tidal') {
    spawnWith('blackhole', 0, 0, 0, 0, 0, 0);
    spawnWith('astronaut', -155, 35, 30, 54, -10, 0);
    spawnWith('mir', -210, -110, -60, 72, 30, 8);
    spawnWith('debris', -190, 120, 20, 92, -20, 0);
    ui.status.textContent = 'tidal stress test seeded';
    setCameraView('follow');
  }
  if (name === 'binary') {
    spawnWith('star', -72, 0, -25, 0, -46, 0);
    spawnWith('star', 72, 0, 25, 0, 46, 0);
    spawnWith('planet', 0, 210, 60, -86, 0, -10);
    spawnWith('asteroid', 210, -140, -80, 54, 60, 14);
    ui.status.textContent = 'binary star scenario seeded';
    setCameraView('iso');
  }
  if (name === 'first-contact') {
    spawnWith('ufo', 0, 0, 80, 0, 0, 0);
    spawnWith('astronaut', -82, -34, 36, 26, 8, 8);
    spawnWith('alien', 76, 28, 18, -18, -6, 10);
    spawnWith('moon', 0, -150, -28, 62, 0, 2);
    spawnWith('dust', -35, 95, 42, 16, -24, 0);
    ui.status.textContent = 'first contact tractor demo seeded';
    setCameraView('iso');
  }
  if (name === 'alien-lab') {
    spawnWith('blackhole', 0, 0, 0, 0, 0, 0);
    spawnWith('ufo', -145, 55, 95, 42, -4, -8);
    spawnWith('alien', -210, -60, 30, 82, 18, 4);
    spawnWith('gas', 160, 20, -36, -55, 18, 0);
    spawnWith('laser', -280, 115, 10, 210, -22, 0);
    ui.status.textContent = 'alien lab hazard scenario seeded';
    setCameraView('follow');
  }
  if (name === 'probe-swarm') {
    spawnWith('planet', 0, 0, 0, 0, 0, 0);
    spawnWith('station', -120, 88, 55, 36, -38, 8);
    spawnWith('jwst', 148, -92, -60, -42, 46, -5);
    spawnWith('voyager', 230, 68, 72, -46, 24, -12);
    spawnWith('mro', -210, -74, -46, 44, -18, 10);
    spawnWith('probe', 36, 205, 92, -72, 12, -16);
    spawnWith('ufo', -245, 170, 120, 38, -64, -8);
    ui.status.textContent = 'probe swarm orbital playground seeded';
    setCameraView('iso');
  }
  if (name === 'ring-chaos') {
    const star = spawnWith('star', -76, 0, 0, 0, -34, 0);
    const blackhole = spawnWith('blackhole', 76, 0, 0, 0, 34, 0);
    seedDustRing(star);
    seedDustRing(blackhole);
    spawnWith('comet', -300, -150, 80, 150, 54, -10);
    spawnWith('asteroid', 260, 140, -70, -120, -42, 12);
    ui.status.textContent = 'ring chaos scenario seeded';
    setCameraView('cinematic');
  }
  if (name === 'horizon-merge') {
    const left = spawnWith('blackhole', -46, -8, -16, 32, 7, 4);
    const right = spawnWith('blackhole', 46, 8, 16, -32, -7, -4);
    left.mass = 250;
    right.mass = 210;
    left.accretion = 2.4;
    right.accretion = 2.2;
    left.angularVelocity = 0.8;
    right.angularVelocity = -0.72;
    seedDustRing(left);
    seedDustRing(right);
    spawnWith('gas', 0, 145, 60, -8, -52, -6);
    spawnWith('laser', -210, -70, 24, 230, 42, -4);
    ui.status.textContent = 'event horizon merger seeded';
    setCameraView('cinematic');
  }
  if (name === 'surprise') {
    const recipes = [surpriseSingularity, surpriseAbduction, surpriseCometPool, surpriseBinaryToy, surpriseWormholeHazard];
    recipes[Math.floor(Math.random() * recipes.length)]();
    setCameraView('cinematic');
  }
  ui.updateInspector();
}

function surpriseSingularity() {
  const hole = spawnWith('blackhole', 0, 0, 0, 0, 0, 0);
  hole.accretion = 1.4;
  seedDustRing(hole);
  spawnWith('astronaut', -145, -70, 42, 56, 52, 8);
  spawnWith('comet', -260, 96, -40, 148, -16, 12);
  spawnWith('gas', 155, -55, 70, -42, 34, -8);
  ui.status.textContent = 'surprise: singularity snack time';
}

function surpriseAbduction() {
  spawnWith('ufo', 0, 0, 95, 0, 0, 0);
  spawnWith('astronaut', -110, -44, 30, 42, 10, 12);
  spawnWith('alien', 88, 34, -18, -24, -2, 10);
  spawnWith('moon', 0, -155, -42, 64, 0, 4);
  seedFineDust(new THREE.Vector3(0, 0, 20), 30, 0x72fff0, 42, 0.025, false, 'Tractor Glitter');
  ui.status.textContent = 'surprise: first contact chaos';
}

function surpriseCometPool() {
  spawnWith('star', -70, 0, -20, 0, -20, 0);
  spawnWith('jupiter', 105, 20, 30, 0, 48, 0);
  spawnWith('comet', -310, -90, 70, 155, 46, -14);
  spawnWith('comet', 270, 135, -60, -142, -36, 18);
  spawnWith('asteroid', 0, -210, 80, 72, 22, -10);
  ui.status.textContent = 'surprise: comet billiards';
}

function surpriseBinaryToy() {
  spawnWith('planet', -72, 0, -16, 0, -36, 0);
  spawnWith('mars', 78, 0, 20, 0, 42, 0);
  spawnWith('moon', 0, 150, 44, -64, 0, -8);
  spawnWith('station', -160, -90, 52, 46, -18, 6);
  ui.status.textContent = 'surprise: tiny binary worlds';
}

function surpriseWormholeHazard() {
  spawnWith('portal', -95, 0, 20, 10, 18, 0);
  spawnWith('portal', 120, 10, -24, -12, -12, 0);
  spawnWith('laser', -300, -70, 18, 230, 34, 0);
  spawnWith('probe', 0, 160, 60, 30, -70, -12);
  spawnWith('gas', 50, -135, -40, -18, 55, 8);
  ui.status.textContent = 'surprise: wormhole hazard room';
}

function spawnWith(type, x, y, z, vx, vy, vz) {
  const body = factory.create(type, new THREE.Vector3(x, y, z));
  body.velocity.set(vx, vy, vz);
  state.bodies.push(body);
  state.selected = body;
  return body;
}

function updateBodyVisual(body, dt) {
  body.shockwave = Math.max(0, (body.shockwave ?? 0) - dt * 1.8);
  body.heat = Math.max(0, (body.heat ?? 0) - dt * 0.45);
  if (body.lifetime !== undefined) {
    body.lifetime -= dt;
    if (body.lifetime <= 0) body.toRemove = true;
  }
  body.accretion = Math.max(body.type === 'blackhole' ? 0.35 : 0, (body.accretion ?? 0) - dt * 0.26);
  const scale = 1 + body.fieldStress * 0.12 + body.shockwave * 0.4;
  const phaseScale = 1 + (body.phaseShift ?? 0) * 0.12;
  body.group.scale.setScalar((body.visualScale ?? 1) * phaseScale);
  body.group.position.copy(body.position).add(new THREE.Vector3(0, 0, (body.w ?? 0) * (state.wProjection ?? 0.65)));
  body.mesh.scale.setScalar(scale);
  if (body.selectionShell) {
    body.selectionShell.visible = state.selected === body && (state.showBounds || state.showTopology);
    body.selectionShell.scale.setScalar(1 + Math.sin(performance.now() * 0.004) * 0.035);
    body.selectionShell.material.uniforms.uTime.value += dt;
  }
  if (body.selectionLabel) {
    body.selectionLabel.visible = state.selected === body && body.type !== 'blackhole' && (state.showBounds || state.showTopology);
    body.selectionLabel.quaternion.copy(camera.quaternion);
    body.selectionLabel.position.y = body.radius * (2.4 + Math.sin(performance.now() * 0.003) * 0.08);
  }
  if (body.mesh.material?.uniforms?.uTime) {
    body.mesh.material.uniforms.uTime.value += dt;
  }
  if (body.mesh.material?.uniforms?.uHeat) {
    body.mesh.material.uniforms.uHeat.value = body.type === 'gas' ? (body.heat ?? 0) : 1 + body.heat + body.fieldStress;
  }
  if (body.mesh.material?.uniforms?.uStress) {
    body.mesh.material.uniforms.uStress.value = body.fieldStress ?? 0;
  }
  applyMaterialTuning(body);
  body.group.children.forEach((child) => {
    const uniforms = child.material?.uniforms;
    if (!uniforms) return;
    if (uniforms.uTime) uniforms.uTime.value += dt;
    if (uniforms.uHeat) uniforms.uHeat.value = body.heat ?? 0;
    if (uniforms.uPower) uniforms.uPower.value = Math.min(1, 0.35 + body.fieldStress * 0.45 + body.shockwave * 0.35 + Math.abs(body.charge ?? 0) * 0.08);
  });
  if (body.type === 'star') {
    body.mesh.material.emissiveIntensity = 2.2 + body.fieldStress * 1.8;
    body.group.children.forEach((child) => {
      if (child.name === 'star-flare') {
        child.rotation.z += dt * (0.18 + body.fieldStress * 1.6);
        child.material.opacity = 0.18 + body.fieldStress * 0.35 + body.shockwave * 0.18;
      }
      if (child.name === 'star-corona') {
        child.scale.setScalar(1 + body.shockwave * 0.25 + Math.sin(performance.now() * 0.002) * 0.04);
      }
      if (child.name === 'star-godray') {
        const active = body.fieldStress > 0.18 || body.shockwave > 0.08 || body.heat > 0.12;
        child.visible = active;
        child.rotation.z += dt * (0.08 + body.fieldStress * 0.22);
        child.material.uniforms.uPower.value = active ? 0.12 + body.fieldStress * 0.26 + body.shockwave * 0.18 : 0;
      }
    });
  }
  if (body.type === 'blackhole') {
    body.group.children.forEach((child) => {
      if (child.name === 'event-horizon-shader') {
        child.quaternion.copy(camera.quaternion);
        child.material.uniforms.uTime.value += dt;
        child.material.uniforms.uAccretion.value = body.accretion ?? 0.35;
        child.material.uniforms.uStress.value = body.fieldStress ?? 0;
        child.material.uniforms.uPulse.value = Math.max(body.shockwave ?? 0, Math.min(1, (body.accretion ?? 0) * 0.35));
      } else {
        child.rotation.z -= dt * (0.8 + body.fieldStress * 4 + (body.accretion ?? 0));
      }
    });
  }
  if (body.type === 'astronaut' || body.type === 'alien') updateAstronautVisual(body, dt);
  if (body.type === 'gas') {
    body.group.children.forEach((child) => {
      if (child.name === 'gas-particles') {
        child.rotation.z += dt * (0.25 + body.fieldStress * 5 + body.heat * 2);
        child.scale.setScalar(1 - body.fieldStress * 0.28 + body.heat * 0.2);
        child.material.opacity = 0.42 + body.heat * 0.45;
        child.material.color.setHex(body.heat > 0.55 ? 0xffb65c : 0x9a72ff);
      }
    });
  }
  if (body.heat > 0 && body.mesh.material?.emissiveIntensity !== undefined && body.type !== 'star') {
    body.mesh.material.emissiveIntensity = (0.55 + body.heat * 1.8) * (body.glow ?? 1);
  } else if (body.mesh.material?.emissiveIntensity !== undefined && body.type !== 'star') {
    body.mesh.material.emissiveIntensity = 0.55 * (body.glow ?? 1);
  }
  if (body.type === 'comet') {
    body.mesh.material.emissiveIntensity = (0.6 + body.velocity.length() * 0.012) * (body.glow ?? 1);
    const tail = body.group.children.find((child) => child.name === 'comet-tail-sprite');
    if (tail) {
      const speed = body.velocity.length();
      const back = speed > 0.4 ? body.velocity.clone().normalize().multiplyScalar(-1) : new THREE.Vector3(-1, 0, 0);
      const localBack = body.group.worldToLocal(body.position.clone().addScaledVector(back, body.radius * 1.15));
      tail.position.copy(localBack);
      const tailLength = body.tailLength ?? 1;
      const tailWidth = body.tailWidth ?? 1;
      tail.scale.set(
        body.radius * (8 + Math.min(10, speed * 0.045 + body.heat * 4)) * tailLength,
        body.radius * (2.8 + Math.min(4, speed * 0.014 + body.heat * 1.8)) * tailWidth,
        1
      );
      tail.material.opacity = (0.2 + Math.min(0.62, speed * 0.0045 + body.heat * 0.34)) * (body.tailOpacity ?? 1);
      tail.material.rotation = Math.atan2(back.y, back.x);
    }
    body.group.children.forEach((child, index) => {
      if (child.name === 'comet-ice-chip') {
        child.rotation.x += dt * (0.7 + index * 0.2);
        child.rotation.y -= dt * (0.9 + index * 0.16);
      }
    });
    const coma = body.group.children.find((child) => child.name === 'comet-coma');
    if (coma) {
      coma.scale.setScalar(1 + Math.sin(performance.now() * 0.003 + body.id) * 0.04 + Math.min(0.28, body.heat * 0.18));
      coma.material.opacity = 0.14 + Math.min(0.18, body.velocity.length() * 0.0015 + body.heat * 0.1);
    }
  }
  if (body.type === 'ufo') {
    body.tractorActive = Math.max(0, (body.tractorActive ?? 0) - dt);
    body.group.children.forEach((child) => {
      if (child.name === 'ufo-rim') child.rotation.z += dt * (1.6 + body.fieldStress * 2.4);
      if (child.name === 'tractor-beam') {
        child.visible = body.tractorActive > 0.04 || body.fieldStress > 0.3 || Math.abs(body.charge ?? 0) > 1.2;
        child.material.uniforms.uPower.value = 0.32 + Math.sin(performance.now() * 0.006 + body.id) * 0.08 + Math.min(0.3, Math.abs(body.charge ?? 0) * 0.12);
        child.scale.setScalar(1 + Math.sin(performance.now() * 0.004) * 0.08);
      }
      if (child.name === 'ufo-light') {
        child.material.opacity = 0.65 + Math.sin(performance.now() * 0.01 + child.position.x) * 0.28;
        child.scale.setScalar(1 + body.shockwave * 1.1);
      }
    });
  }
  if (body.type === 'magnet') {
    body.group.children.forEach((child, index) => {
      if (child.name === 'magnetic-field-ring') {
        child.rotation.z += dt * (0.3 + index * 0.12 + Math.abs(body.charge ?? 0) * 0.4);
        child.material.opacity = 0.18 + Math.min(0.34, Math.abs(body.charge ?? 0) * 0.09 + body.fieldStress * 0.18);
      }
      if (child.name === 'magnet-core') child.rotation.y += dt * 0.7;
    });
  }
  if (body.type === 'portal') {
    body.group.children.forEach((child, index) => {
      if (child.name === 'wormhole-main-ring' || child.name === 'wormhole-spiral') {
        child.rotation.z += dt * (0.55 + index * 0.14 + body.heat);
        child.material.opacity = child.name === 'wormhole-main-ring' ? 0.82 : 0.24 + body.heat * 0.22 + body.shockwave * 0.18;
      }
      if (child.name === 'wormhole-throat') {
        child.scale.set(1 + body.shockwave * 0.25, 1 + body.shockwave * 0.25, 0.32 + Math.sin(performance.now() * 0.004) * 0.06);
      }
    });
  }
  if (body.type === 'laser') {
    body.group.children.forEach((child) => {
      if (child.name === 'laser-glow') {
        child.material.uniforms.uPower.value = 0.4 + Math.sin(performance.now() * 0.018) * 0.08 + body.heat * 0.18;
        child.scale.x = 1 + Math.min(1.2, body.velocity.length() * 0.003 + body.heat * 0.25);
      }
      if (child.name === 'laser-muzzle') {
        child.scale.setScalar(1 + Math.sin(performance.now() * 0.012) * 0.08 + body.heat * 0.25);
      }
    });
  }
  if (body.type === 'debris') {
    body.group.children.forEach((child) => {
      if (child.name === 'debris-chip') {
        child.rotation.x += dt * (0.4 + body.angularVelocity * 0.08);
        child.rotation.y -= dt * 0.5;
      }
    });
  }
}

function applyMaterialTuning(body) {
  const glow = body.glow ?? 1;
  const heat = body.heat ?? 0;
  const stress = body.fieldStress ?? 0;
  const boost = Math.max(0, glow - 1) + heat * 1.35 + stress * 0.45;
  const phase = body.phaseShift ?? 0;
  const active = boost > 0.01 || phase > 0.02 || body.materialTuningActive;
  if (!active) return;

  body.materialTuningActive = boost > 0.01 || phase > 0.02;
  const materials = cachedBodyMaterials(body);
  for (const material of materials) {
    material.userData.baseEmissiveIntensity ??= material.emissiveIntensity ?? 0;
    material.userData.baseOpacity ??= material.opacity ?? 1;
    if (material.emissive) material.userData.baseEmissive ??= material.emissive.clone();
    if (material.emissiveIntensity !== undefined) {
      material.emissiveIntensity = material.userData.baseEmissiveIntensity + boost;
    }
    if (material.emissive) {
      material.emissive.copy(material.userData.baseEmissive);
      if (heat > 0.08) material.emissive.lerp(new THREE.Color(0xff8a32), Math.min(0.75, heat * 0.75));
    }
    if (material.opacity !== undefined && body.category !== 'singularity') {
      const faded = phase > 0.25 ? Math.max(0.42, material.userData.baseOpacity * (1 - phase * 0.28)) : material.userData.baseOpacity;
      material.transparent = material.transparent || faded < 0.99;
      material.opacity = faded;
    }
  }
}

function cachedBodyMaterials(body) {
  const stamp = body.group.children.length;
  if (body.materialCache && body.materialCacheStamp === stamp) return body.materialCache;
  const seen = new Set();
  const materials = [];
  body.group.traverse((child) => {
    if (!child.isMesh || !child.material || child.name === 'event-horizon-shader') return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of list) {
      if (!material || seen.has(material)) continue;
      seen.add(material);
      materials.push(material);
    }
  });
  body.materialCache = materials;
  body.materialCacheStamp = stamp;
  return materials;
}

function updateAstronautVisual(body, dt) {
  const response = state.ragdollScale ?? 1;
  const stress = (body.tidalStress ?? 0) * response;
  const stretch = 1 + stress * 1.55;
  const wobble = Math.sin(performance.now() * 0.008 + body.id) * (0.1 + stress * 0.68);
  const hasAuthoredModel = body.group.children.some((child) => child.name === `${body.type}-model`);
  if (!hasAuthoredModel) body.mesh.scale.set(1 / Math.sqrt(stretch), stretch, 1);
  if (hasAuthoredModel) {
    body.mesh.visible = false;
    for (const child of body.group.children) {
      if (child.userData.rigVisual) child.visible = false;
      if (child.name === `${body.type}-model`) {
        child.userData.baseScale ??= child.scale.clone();
        const baseScale = child.userData.baseScale;
        child.scale.set(
          baseScale.x * (1 - Math.min(0.28, stress * 0.12)),
          baseScale.y * (1 + stress * 0.42),
          baseScale.z * (1 - Math.min(0.22, stress * 0.08))
        );
        child.rotation.z += Math.sin(performance.now() * 0.006 + body.id) * stress * dt * 0.18;
      }
    }
    return;
  }
  for (const child of body.group.children) {
    if (child.userData.anchor) {
      const anchor = child.userData.anchor;
      child.position.set(body.radius * anchor.x * (1 + stress * 0.22), body.radius * anchor.y * stretch, body.radius * anchor.z);
      continue;
    }
    if (!child.userData.base) continue;
    const base = child.userData.base;
    const lag = body.angularVelocity * 0.12 + stress * base.bend * 1.25;
    child.rotation.z = base.bend + wobble + lag + Math.sin(performance.now() * 0.006 + base.phase) * 0.18;
    child.position.x = body.radius * base.x * (1 + stress * 0.64);
    child.position.y = body.radius * base.y * stretch;
    if (child.material?.emissiveIntensity !== undefined) child.material.emissiveIntensity = 0.42 + stress * 1.4;
  }
  const visor = body.group.children.find((child) => child.name === 'astro-visor');
  if (visor) visor.material.emissiveIntensity = 0.55 + stress * 2.8;
}

function inspectAction(action) {
  const body = state.selected;
  if (!body) return;
  if (action === 'mass-up') body.mass *= 1.25;
  if (action === 'mass-down') body.mass = Math.max(0.1, body.mass / 1.25);
  if (action === 'velocity-up') body.velocity.multiplyScalar(1.35);
  if (action === 'velocity-down') body.velocity.multiplyScalar(0.65);
  if (action === 'orbit-kick') orbitKick(body);
  if (action === 'dust-ring') seedDustRing(body);
  if (action === 'tractor') tractorSelected(body);
  if (action === 'goo-burst') emitBioPlasma(body);
  if (action === 'explode') burstSelected(body);
  if (action === 'ignite') igniteSelected(body);
  if (action === 'binary') makeBinary(body);
  if (action === 'release') releaseBody(body);
  if (action === 'flare') {
    body.heat = 1;
    body.shockwave = 1;
    body.fieldStress = Math.max(body.fieldStress ?? 0, 0.65);
    particles.burst(body.position, body.type === 'star' || body.type === 'gas' ? 0xffb35d : 0x7df7ff, 56, 120, 'radiation');
    nebula.burst(body.position, { count: 62, colorA: body.type === 'star' || body.type === 'gas' ? '#ffb35d' : '#7df7ff', colorB: '#ffffff', speed: 115, life: 1.25, radius: [4, 16], drift: 30 });
  }
  if (action === 'z-up') {
    body.position.z += 25;
    body.group.position.copy(body.position);
  }
  if (action === 'z-down') {
    body.position.z -= 25;
    body.group.position.copy(body.position);
  }
  if (action === 'stop') body.velocity.set(0, 0, 0);
  if (action === 'spin') body.angularVelocity += 1.2;
  if (action === 'freeze') body.frozen = !body.frozen;
  if (action === 'trail') body.showTrail = !body.showTrail;
  if (action === 'delete') {
    scene.remove(body.group);
    state.bodies = state.bodies.filter((item) => item !== body);
    state.selected = null;
  }
  ui.updateInspector();
}

function burstSelected(body) {
  const severity = body.category === 'stellar' || body.category === 'singularity' ? 0.65 : 0.95;
  body.shockwave = 1.2;
  body.heat = Math.max(body.heat ?? 0, 0.7);
  if (!['stellar', 'singularity', 'field'].includes(body.category)) {
    seedFragments(body.position, body.velocity, severity, body.category, undefined, `${body.label} Piece`);
    seedFineDust(body.position, 34, body.materialProfile === 'ice' ? 0xcffcff : body.materialProfile === 'organic' ? 0xff3a24 : 0xffb35d, 115, 0.04, true, `${body.label} Dust`);
    body.toRemove = body.mass < 18 || body.category === 'crew' || body.category === 'small-body';
  } else {
    seedFineDust(body.position, 78, body.type === 'blackhole' ? 0xff9d42 : 0xffd36b, 165, 0.055, true, `${body.label} Flare Dust`);
  }
  particles.burst(body.position, body.type === 'blackhole' ? 0xff9d42 : 0xff6a32, 120, 190, 'radiation');
  nebula.burst(body.position, { count: 128, colorA: '#ff6a32', colorB: '#ffffff', speed: 180, life: 1.35, radius: [6, 24], drift: 52 });
  state.cameraShake = Math.max(state.cameraShake, 4.2);
  ui.status.textContent = `${body.label} burst`;
}

function igniteSelected(body) {
  body.heat = 1;
  body.glow = Math.max(body.glow ?? 1, 2.4);
  body.shockwave = 1;
  body.fieldStress = Math.max(body.fieldStress ?? 0, 0.9);
  if (body.category === 'gas' || body.type === 'gas') {
    body.label = 'Ignited Gas Cloud';
    body.mass = Math.max(body.mass, 10);
    body.angularVelocity += 1.2;
  }
  particles.burst(body.position, 0xffd36b, 96, 145, 'radiation');
  nebula.burst(body.position, { count: 118, colorA: '#ff9d42', colorB: '#fff6a8', speed: 130, life: 1.8, radius: [7, 24], drift: 44 });
  ui.status.textContent = `${body.label} ignited`;
}

function makeBinary(body) {
  const partner = nearestBody(body.position, (candidate) => candidate !== body && candidate.mass > 0.5 && !candidate.toRemove);
  if (!partner) {
    ui.status.textContent = 'spawn another body for binary motion';
    return;
  }
  const center = body.position.clone().lerp(partner.position, 0.5);
  const radial = body.position.clone().sub(partner.position);
  if (radial.lengthSq() < 1) radial.set(1, 0, 0);
  const distance = Math.max(radial.length(), body.radius + partner.radius + 80);
  radial.normalize();
  const tangent = new THREE.Vector3(-radial.y, radial.x, radial.z * 0.18).normalize();
  const totalMass = Math.max(1, body.mass + partner.mass);
  const speed = Math.sqrt((state.gravityScale * totalMass) / distance) * 13;
  body.position.copy(center).addScaledVector(radial, distance * partner.mass / totalMass);
  partner.position.copy(center).addScaledVector(radial, -distance * body.mass / totalMass);
  body.velocity.copy(tangent).multiplyScalar(speed * partner.mass / totalMass);
  partner.velocity.copy(tangent).multiplyScalar(-speed * body.mass / totalMass);
  body.trail.length = 0;
  partner.trail.length = 0;
  body.shockwave = Math.max(body.shockwave ?? 0, 0.55);
  partner.shockwave = Math.max(partner.shockwave ?? 0, 0.55);
  nebula.burst(center, { count: 70, colorA: '#72fff0', colorB: '#ffffff', speed: 80, life: 1.1, radius: [4, 18], drift: 28 });
  ui.status.textContent = `${body.label} and ${partner.label} set into binary dance`;
}

function tractorSelected(body) {
  const craft = body.type === 'ufo' ? body : nearestBody(body.position, (candidate) => candidate.type === 'ufo');
  if (!craft) {
    ui.status.textContent = 'drop a UFO first';
    return;
  }
  const target = body.type === 'ufo'
    ? nearestBody(body.position, (candidate) => candidate !== body && (['crew', 'dust', 'debris', 'small-body'].includes(candidate.category) || candidate.mass < 3))
    : body;
  if (!target) {
    ui.status.textContent = 'no abductable target nearby';
    return;
  }
  const pull = craft.position.clone().sub(target.position);
  const distance = Math.max(12, pull.length());
  pull.normalize();
  const spiral = new THREE.Vector3(-pull.y, pull.x, 0.35).normalize();
  target.velocity.copy(craft.velocity).addScaledVector(pull, Math.min(180, 65 + distance * 0.35)).addScaledVector(spiral, 42);
  target.fieldStress = 1;
  target.heat = Math.max(target.heat ?? 0, 0.2);
  craft.shockwave = 1;
  craft.tractorActive = Math.max(craft.tractorActive ?? 0, 2.2);
  nebula.stream(craft.position, pull.clone().multiplyScalar(-1), { colorA: '#72fff0', colorB: '#9dff6e', count: 42, speed: 58, life: 1.2, radius: [3, 12], drift: 18 });
  ui.status.textContent = `${target.label} tractor locked`;
}

function emitBioPlasma(body) {
  const alien = body.type === 'alien';
  const colors = alien ? [0x9dff6e, 0x34ff7a, 0x72fff0] : [0xff3a24, 0xffb35d, 0xffd8c4];
  body.heat = 1;
  body.shockwave = 1;
  seedFineDust(body.position, alien ? 38 : 28, colors[0], alien ? 92 : 76, 0.035, true, alien ? 'Alien Goo' : 'Bio-Plasma');
  particles.burst(body.position, colors[1], alien ? 82 : 58, alien ? 120 : 92, 'gas');
  nebula.burst(body.position, { count: alien ? 96 : 64, colorA: `#${colors[0].toString(16).padStart(6, '0')}`, colorB: `#${colors[2].toString(16).padStart(6, '0')}`, speed: alien ? 116 : 84, life: 1.55, radius: [5, 18], drift: 50 });
  ui.status.textContent = `${body.label} emitted plasma`;
}

function releaseBody(body) {
  body.attachedTo = null;
  body.attachOffset = null;
  body.attachCooldown = 1.4;
  body.frozen = false;
  body.velocity.add(randomDirection().multiplyScalar(28));
  body.trail.length = 0;
  ui.status.textContent = `${body.label} released`;
}

function nearestBody(position, predicate) {
  return state.bodies
    .filter(predicate)
    .sort((a, b) => a.position.distanceToSquared(position) - b.position.distanceToSquared(position))[0] ?? null;
}

function orbitKick(body) {
  const anchors = state.bodies
    .filter((candidate) => candidate !== body && candidate.mass > body.mass && candidate.mass > 6)
    .sort((a, b) => a.position.distanceToSquared(body.position) - b.position.distanceToSquared(body.position));
  const anchor = anchors[0];
  if (!anchor) return;
  const radial = body.position.clone().sub(anchor.position);
  const distance = Math.max(radial.length(), anchor.radius + body.radius + 8);
  radial.normalize();
  const tangent = new THREE.Vector3(-radial.y, radial.x, radial.z * 0.15).normalize();
  const speed = Math.sqrt((state.gravityScale * anchor.mass) / distance) * 20;
  body.velocity.copy(anchor.velocity).addScaledVector(tangent, speed);
  body.trail.length = 0;
  ui.status.textContent = `${body.label} kicked into orbit`;
}

function seedDustRing(body) {
  const ringCount = body.type === 'blackhole' ? 72 : 44;
  const radius = body.radius * (body.type === 'blackhole' ? 4.6 : 2.9);
  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * body.radius * 0.8;
    const pos = body.position.clone().add(new THREE.Vector3(Math.cos(angle), Math.sin(angle), (Math.random() - 0.5) * body.radius * 0.35).multiplyScalar(radius + jitter));
    const dust = factory.create('dust', pos);
    dust.label = 'Ring Dust';
    dust.mass = 0.025 + Math.random() * 0.07;
    dust.radius = 0.75 + Math.random() * 0.85;
    dust.baseRadius = 2;
    dust.visualScale = dust.radius / dust.baseRadius;
    dust.isDust = true;
    const tangent = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), (Math.random() - 0.5) * 0.16).normalize();
    const speed = Math.sqrt(Math.max(1, state.gravityScale * Math.max(1, body.mass) / Math.max(12, radius))) * 14;
    dust.velocity.copy(body.velocity).addScaledVector(tangent, speed);
    dust.angularVelocity = (Math.random() - 0.5) * 1.8;
    state.bodies.push(dust);
  }
  body.shockwave = Math.max(body.shockwave ?? 0, 0.65);
  particles.burst(body.position, body.type === 'blackhole' ? 0xff9d42 : 0x87f7ff, 48, 85, 'spark');
  ui.status.textContent = `${body.label} dust belt seeded`;
}

function seedFineDust(position, count, color, speed, mass = 0.06, hot = false, label = null) {
  const liveDust = state.bodies.filter((body) => body.isDust).length;
  const allowed = Math.max(0, Math.min(count, state.maxDust - liveDust));
  for (let i = 0; i < allowed; i++) {
    const dir = randomDirection();
    const dust = factory.create('dust', position.clone().addScaledVector(dir, 4 + Math.random() * 30));
    dust.label = label ?? (hot ? 'Heated Space Dust' : 'Space Dust');
    dust.mass = mass * (0.45 + Math.random() * 0.85);
    dust.radius = 0.55 + Math.random() * 0.9;
    dust.baseRadius = 2;
    dust.visualScale = dust.radius / dust.baseRadius;
    dust.heat = hot ? 1 : 0.25;
    dust.isDust = true;
    tintBody(dust, jitterColor(color, 0.16));
    dust.velocity.copy(dir.multiplyScalar(speed * (0.25 + Math.random() * 0.95)));
    dust.angularVelocity = (Math.random() - 0.5) * 1.4;
    state.bodies.push(dust);
  }
}

function seedFragments(position, inheritedVelocity, severity = 0.5, category = 'debris', colors = [0x9fefff], label = null) {
  const count = Math.min(12, Math.floor(3 + severity * 10));
  for (let i = 0; i < count; i++) {
    const dir = randomDirection();
    const type = ['spacecraft', 'planetary', 'crew', 'small-body', 'field'].includes(category) && Math.random() > 0.28 ? 'debris' : 'dust';
    const fragment = factory.create(type, position.clone().addScaledVector(dir, 4 + Math.random() * 18));
    fragment.label = label ?? (type === 'dust' ? 'Impact Dust' : 'Impact Fragment');
    fragment.mass = type === 'dust' ? 0.035 + Math.random() * 0.08 : 0.14 + Math.random() * 0.42;
    fragment.radius = type === 'dust' ? 0.6 + Math.random() * 0.9 : fragmentRadiusFor(category, severity);
    fragment.baseRadius = type === 'dust' ? 2 : fragment.baseRadius;
    fragment.visualScale = fragment.radius / fragment.baseRadius;
    fragment.heat = severity;
    fragment.isDust = type === 'dust';
    fragment.showTrail = false;
    tintBody(fragment, jitterColor(colors[i % colors.length], 0.18));
    fragment.velocity.copy(inheritedVelocity).multiplyScalar(0.25).addScaledVector(dir, 55 + severity * 120);
    fragment.angularVelocity = (Math.random() - 0.5) * 5;
    fragment.lifetime = type === 'dust' ? undefined : 18 + Math.random() * 18;
    state.bodies.push(fragment);
  }
}

function fragmentRadiusFor(category, severity) {
  if (category === 'crew') return 0.75 + Math.random() * 1.15;
  if (category === 'spacecraft') return 1.2 + Math.random() * 2.7;
  if (category === 'planetary') return 1.5 + Math.random() * (2.4 + severity * 2);
  if (category === 'small-body') return 0.9 + Math.random() * 2.1;
  if (category === 'field') return 0.7 + Math.random() * 1.4;
  return 1 + Math.random() * 2;
}

function tintBody(body, color) {
  const tint = new THREE.Color(color);
  body.group.traverse((child) => {
    if (child.material?.color) child.material.color.copy(tint);
    if (child.material?.emissive) child.material.emissive.copy(tint);
    if (child.isPoints && child.geometry?.attributes?.color) {
      const colors = child.geometry.attributes.color;
      for (let i = 0; i < colors.count; i++) {
        const variation = 0.75 + Math.random() * 0.45;
        colors.setXYZ(i, tint.r * variation, tint.g * variation, tint.b * variation);
      }
      colors.needsUpdate = true;
    }
  });
}

function jitterColor(color, amount = 0.1) {
  const c = new THREE.Color(color);
  c.offsetHSL((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
  return c.getHex();
}

function randomDirection() {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
}

function inspectSet(prop, value) {
  const body = state.selected;
  if (!body) return;
  if (prop === 'radius') {
    body.baseRadius ??= body.radius;
    body.radius = Math.max(0.5, value);
    body.visualScale = body.radius / body.baseRadius;
  }
  if (prop === 'mass') body.mass = Math.max(0, value);
  if (prop === 'angularVelocity') body.angularVelocity = value;
  if (prop === 'vx') body.velocity.x = value;
  if (prop === 'vy') body.velocity.y = value;
  if (prop === 'vz') body.velocity.z = value;
  if (prop === 'w') body.w = value;
  if (prop === 'wVelocity') body.wVelocity = value;
  if (prop === 'heat') body.heat = value;
  if (prop === 'charge') body.charge = value;
  if (prop === 'glow') body.glow = value;
  if (prop === 'fieldStress') body.fieldStress = value;
  if (prop === 'tailLength') body.tailLength = value;
  if (prop === 'tailWidth') body.tailWidth = value;
  if (prop === 'tailOpacity') body.tailOpacity = value;
  if (prop === 'z') {
    body.position.z = value;
    body.group.position.copy(body.position);
  }
}

function togglePause() {
  state.paused = !state.paused;
  document.getElementById('pause-btn').textContent = state.paused ? 'Play' : 'Pause';
  ui.syncToolbar();
}

function toggleFields() {
  state.showFields = !state.showFields;
  ui.syncToolbar();
}

function toggleTopology() {
  state.showTopology = !state.showTopology;
  ui.syncToolbar();
}

function toggleTrails() {
  state.showTrails = !state.showTrails;
  ui.syncToolbar();
}

function toggleParticles() {
  state.showParticles = !state.showParticles;
  particles.points.visible = state.showParticles;
  ui.syncToolbar();
}

function toggleFilaments() {
  state.showFilaments = !state.showFilaments;
  ui.syncToolbar();
}

function toggleBounds() {
  state.showBounds = !state.showBounds;
  ui.syncToolbar();
}

function pulseUniverse() {
  const origin = state.selected?.position.clone() ?? systemCenter();
  if (!state.bodies.length) {
    ui.status.textContent = 'drop something in first';
    return;
  }
  let affected = 0;
  for (const body of state.bodies) {
    if (body.frozen || body.category === 'singularity') continue;
    const delta = body.position.clone().sub(origin);
    const distance = Math.max(18, delta.length());
    const dir = delta.lengthSq() > 0.001 ? delta.normalize() : randomDirection();
    const swirl = new THREE.Vector3(-dir.y, dir.x, dir.z * 0.24).normalize();
    const strength = Math.max(8, 145 - distance * 0.14) / Math.max(0.7, Math.sqrt(Math.max(0.4, body.mass)));
    body.velocity.addScaledVector(dir, strength);
    body.velocity.addScaledVector(swirl, strength * 0.42);
    body.shockwave = Math.max(body.shockwave ?? 0, 0.65);
    body.heat = Math.max(body.heat ?? 0, 0.18);
    body.trail.length = 0;
    affected++;
  }
  seedFineDust(origin, 46, 0x72fff0, 105, 0.03, false, 'Pulse Dust');
  particles.burst(origin, 0x72fff0, 92, 170, 'radiation');
  nebula.burst(origin, { count: 120, colorA: '#72fff0', colorB: '#ffffff', speed: 150, life: 1.2, radius: [4, 18], drift: 44 });
  state.cameraShake = Math.max(state.cameraShake, 3.8);
  ui.status.textContent = `pulse wave hit ${affected} objects`;
}

function clearDust() {
  const removed = state.bodies.filter((body) => body.category === 'dust' || body.isDust);
  for (const body of removed) {
    scene.remove(body.group);
    if (state.selected === body) state.selected = null;
  }
  state.bodies = state.bodies.filter((body) => body.category !== 'dust' && !body.isDust);
  paintLayer.clear();
  ui.status.textContent = `cleared ${removed.length} dust motes`;
  ui.updateInspector();
}

function clearTrails() {
  for (const body of state.bodies) body.trail.length = 0;
  ui.status.textContent = 'all trails cleared';
}

function fossilizeUniverse() {
  if (!state.bodies.length) {
    ui.status.textContent = 'nothing live to fossilize';
    return;
  }
  const snapshot = state.bodies.map((body) => ({
    type: body.type,
    category: body.category,
    label: body.label,
    mass: body.mass,
    radius: body.radius,
    heat: body.heat ?? 0,
    charge: body.charge ?? 0,
    position: body.position.clone(),
    velocity: body.velocity.clone()
  }));
  nebulaBackground.addFossilLayer(snapshot);
  reset({ preserveFossils: true, status: 'fossilized chaos into distant nebula' });
}

function clearFossils() {
  const count = nebulaBackground.clearFossils();
  ui.status.textContent = `cleared ${count} fossil backdrops`;
}

function setToolMode(tool) {
  state.toolMode = tool;
  ui.status.textContent = tool === 'select' ? 'selection tool active' : `${tool} power armed`;
  ui.syncToolbar();
}

function setBrushMode(brush) {
  state.brushMode = brush;
  if (state.toolMode !== 'paint') state.toolMode = 'paint';
  ui.status.textContent = `${brush} brush armed`;
  ui.syncToolbar();
}

function pointerMoved(world, mode) {
  ui.updateCoordinates(world, mode);
  paintCursor.visible = state.toolMode !== 'select';
  if (!paintCursor.visible || !world) return;
  paintCursor.position.copy(world);
  const radius = state.toolMode === 'paint' ? 34 * Math.max(0.4, state.brushSize ?? 1) : Math.max(16, state.powerRadius ?? 185);
  paintCursor.scale.setScalar(radius / 34);
  paintCursor.quaternion.copy(camera.quaternion);
}

function applyToolAt(origin, tool) {
  if (tool === 'paint') {
    paintBrush(origin);
    return;
  }
  const baseRadius = tool === 'orbit' ? 260 : ['fold', 'unfold'].includes(tool) ? 230 : 185;
  const radius = Math.max(20, state.powerRadius ?? baseRadius);
  const strengthScale = state.powerStrength ?? 1;
  let affected = 0;
  for (const body of state.bodies) {
    if (body.category === 'singularity' && tool !== 'heat') continue;
    const delta = body.position.clone().sub(origin);
    const distance = delta.length();
    if (distance > radius) continue;
    const falloff = 1 - distance / radius;
    const dir = distance > 0.001 ? delta.normalize() : randomDirection();
    const massFactor = 1 / Math.max(0.65, Math.sqrt(Math.max(0.2, body.mass)));
    if (tool === 'push') {
      body.velocity.addScaledVector(dir, 155 * falloff * massFactor * strengthScale);
    }
    if (tool === 'pull') {
      body.velocity.addScaledVector(dir, -135 * falloff * massFactor * strengthScale);
      body.fieldStress = Math.max(body.fieldStress ?? 0, falloff);
    }
    if (tool === 'heat') {
      body.heat = Math.min(1, (body.heat ?? 0) + falloff * 0.85 * strengthScale);
      body.shockwave = Math.max(body.shockwave ?? 0, falloff * 0.8 * strengthScale);
    }
    if (tool === 'freeze') {
      body.velocity.multiplyScalar(Math.max(0, 1 - falloff * 0.92 * strengthScale));
      body.angularVelocity *= Math.max(0, 1 - falloff * 0.9 * strengthScale);
      body.frozen = falloff > 0.78 ? !body.frozen : body.frozen;
    }
    if (tool === 'orbit') {
      const tangent = new THREE.Vector3(-dir.y, dir.x, dir.z * 0.25).normalize();
      body.velocity.addScaledVector(tangent, 95 * falloff * massFactor * strengthScale);
    }
    if (tool === 'fold') {
      body.wVelocity += 72 * falloff * massFactor * strengthScale;
      body.fieldStress = Math.max(body.fieldStress ?? 0, falloff * 1.1);
      body.shockwave = Math.max(body.shockwave ?? 0, falloff * 0.45);
    }
    if (tool === 'unfold') {
      body.wVelocity -= 72 * falloff * massFactor * strengthScale;
      body.fieldStress = Math.max(body.fieldStress ?? 0, falloff * 1.1);
      body.shockwave = Math.max(body.shockwave ?? 0, falloff * 0.45);
    }
    body.trail.length = 0;
    affected++;
  }
  const color = tool === 'heat' ? 0xff9d42 : tool === 'freeze' ? 0x9fefff : tool === 'pull' ? 0xc35cff : ['fold', 'unfold'].includes(tool) ? 0x72eaff : 0x72fff0;
  particles.burst(origin, color, Math.round(44 * Math.min(2, strengthScale)), (tool === 'orbit' ? 130 : 105) * strengthScale, tool === 'heat' ? 'radiation' : 'spark');
  nebula.burst(origin, { count: Math.round(62 * Math.min(2, strengthScale)), colorA: `#${color.toString(16).padStart(6, '0')}`, colorB: '#ffffff', speed: 115 * strengthScale, life: 0.9, radius: [3, 14], drift: 36 });
  state.cameraShake = Math.max(state.cameraShake, (tool === 'heat' ? 1.8 : 1.0) * Math.min(2, strengthScale));
  ui.status.textContent = `${tool} affected ${affected} objects`;
}

function paintBrush(origin) {
  if (state.brushMode === 'heat') {
    paintHeat(origin);
    return;
  }
  if (state.brushMode === 'gas') {
    paintGas(origin);
    return;
  }
  if (state.brushMode === 'charge') {
    paintCharge(origin);
    return;
  }
  paintStarField(origin);
}

function paintStarField(origin) {
  paintLayer.stamp(origin, 'stars', state.brushSize ?? 1, state.brushStrength ?? 1);
  const palette = [0x9fefff, 0x72fff0, 0xffffff, 0xffd36b, 0xc35cff];
  const liveDust = state.bodies.filter((body) => body.isDust).length;
  const brushSize = state.brushSize ?? 1;
  const brushStrength = state.brushStrength ?? 1;
  const count = Math.max(0, Math.min(Math.round(12 * brushStrength), state.maxDust - liveDust));
  for (let i = 0; i < count; i++) {
    const dir = randomDirection();
    const radius = 18 * brushSize + Math.random() * 92 * brushSize;
    const dust = factory.create('dust', origin.clone().addScaledVector(dir, radius));
    dust.label = 'Painted Star Mote';
    dust.mass = 0.012 + Math.random() * 0.035;
    dust.radius = 0.42 + Math.random() * 0.76;
    dust.baseRadius = 2;
    dust.visualScale = dust.radius / dust.baseRadius;
    dust.isDust = true;
    dust.showTrail = false;
    dust.charge = (Math.random() - 0.5) * 0.18;
    dust.velocity.copy(new THREE.Vector3(-dir.y, dir.x, dir.z * 0.18).normalize()).multiplyScalar((2 + Math.random() * 9) * brushStrength);
    tintBody(dust, jitterColor(palette[i % palette.length], 0.2));
    state.bodies.push(dust);
  }
  particles.burst(origin, 0x9fefff, 26, 34, 'spark');
  nebula.burst(origin, { count: Math.round(34 * brushStrength), colorA: '#9fefff', colorB: '#ffffff', speed: 32 * brushStrength, life: 1.8, radius: [3 * brushSize, 10 * brushSize], drift: 16 * brushSize });
  ui.status.textContent = `painted stars plus ${count} live motes`;
}

function paintGas(origin) {
  paintLayer.stamp(origin, 'gas', state.brushSize ?? 1, state.brushStrength ?? 1);
  const liveDust = state.bodies.filter((body) => body.isDust).length;
  const brushSize = state.brushSize ?? 1;
  const brushStrength = state.brushStrength ?? 1;
  const count = Math.max(0, Math.min(Math.round(8 * brushStrength), state.maxDust - liveDust));
  for (let i = 0; i < count; i++) {
    const dir = randomDirection();
    const radius = 10 * brushSize + Math.random() * 68 * brushSize;
    const gas = factory.create('dust', origin.clone().addScaledVector(dir, radius));
    gas.label = 'Painted Gas Wisp';
    gas.category = 'gas';
    gas.isDust = true;
    gas.mass = 0.018 + Math.random() * 0.045;
    gas.radius = 0.7 + Math.random() * 1.25;
    gas.baseRadius = 2;
    gas.visualScale = gas.radius / gas.baseRadius;
    gas.showTrail = false;
    gas.heat = 0.08 + Math.random() * 0.12;
    gas.velocity.copy(new THREE.Vector3(-dir.y, dir.x, dir.z * 0.35).normalize()).multiplyScalar((1 + Math.random() * 5) * brushStrength);
    tintBody(gas, jitterColor(0x7dffda, 0.32));
    state.bodies.push(gas);
  }
  nebula.burst(origin, { count: Math.round(86 * brushStrength), colorA: '#7dffda', colorB: '#3145ff', speed: 30 * brushStrength, life: 2.6, radius: [8 * brushSize, 28 * brushSize], drift: 22 * brushSize });
  particles.burst(origin, 0x7dffda, 18, 22, 'spark');
  ui.status.textContent = `painted gas plus ${count} live wisps`;
}

function paintCharge(origin) {
  paintLayer.stamp(origin, 'charge', state.brushSize ?? 1, state.brushStrength ?? 1);
  const palette = [0xff4fd8, 0x50ffe7, 0x74a4ff, 0xffffff];
  const liveDust = state.bodies.filter((body) => body.isDust).length;
  const brushSize = state.brushSize ?? 1;
  const brushStrength = state.brushStrength ?? 1;
  const count = Math.max(0, Math.min(Math.round(10 * brushStrength), state.maxDust - liveDust));
  for (let i = 0; i < count; i++) {
    const dir = randomDirection();
    const dust = factory.create('dust', origin.clone().addScaledVector(dir, 16 * brushSize + Math.random() * 78 * brushSize));
    dust.label = 'Charged Mote';
    dust.mass = 0.01 + Math.random() * 0.025;
    dust.radius = 0.36 + Math.random() * 0.58;
    dust.baseRadius = 2;
    dust.visualScale = dust.radius / dust.baseRadius;
    dust.isDust = true;
    dust.showTrail = false;
    dust.charge = (Math.random() > 0.5 ? 1 : -1) * (0.65 + Math.random() * 1.15) * brushStrength;
    dust.velocity.copy(randomDirection()).multiplyScalar((4 + Math.random() * 16) * brushStrength);
    tintBody(dust, jitterColor(palette[i % palette.length], 0.16));
    state.bodies.push(dust);
  }
  particles.burst(origin, 0xff4fd8, 30, 52, 'spark');
  nebula.burst(origin, { count: Math.round(48 * brushStrength), colorA: '#ff4fd8', colorB: '#50ffe7', speed: 52 * brushStrength, life: 1.3, radius: [3 * brushSize, 11 * brushSize], drift: 28 * brushSize });
  ui.status.textContent = `painted charge plus ${count} live motes`;
}

function paintHeat(origin) {
  paintLayer.stamp(origin, 'heat', state.brushSize ?? 1, state.brushStrength ?? 1);
  const brushSize = state.brushSize ?? 1;
  const brushStrength = state.brushStrength ?? 1;
  const radius = 160 * brushSize;
  let affected = 0;
  for (const body of state.bodies) {
    const distance = body.position.distanceTo(origin);
    if (distance > radius) continue;
    const falloff = 1 - distance / radius;
    body.heat = Math.min(1, (body.heat ?? 0) + 0.38 * falloff * brushStrength);
    body.glow = Math.max(body.glow ?? 1, 1 + falloff * 1.4 * brushStrength);
    body.shockwave = Math.max(body.shockwave ?? 0, falloff * 0.36);
    affected++;
  }
  particles.burst(origin, 0xff8a2d, Math.round(36 * brushStrength), 74 * brushStrength, 'radiation');
  nebula.burst(origin, { count: Math.round(74 * brushStrength), colorA: '#ff8a2d', colorB: '#fff6a8', speed: 62 * brushStrength, life: 1.4, radius: [7 * brushSize, 18 * brushSize], drift: 24 * brushSize });
  ui.status.textContent = `painted heat onto ${affected} objects`;
}

function setDevSetting(prop, value) {
  state[prop] = value;
  if (prop === 'renderScale') {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, value));
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  if (prop === 'bloomStrength') bloomPass.strength = value;
  if (prop === 'bloomRadius') bloomPass.radius = value;
  if (prop === 'bloomThreshold') bloomPass.threshold = value;
  if (prop === 'maxDust') state.maxDust = value;
  ui.status.textContent = `${prop} ${Number(value).toFixed(2)}`;
}

function setCameraView(view) {
  state.cameraMode = view;
  if (view === 'top') {
    camera.position.set(0, 0, 760);
  }
  if (view === 'iso') {
    camera.position.set(460, -520, 640);
  }
  if (view === 'side') {
    camera.position.set(0, -850, 180);
  }
  if (view === 'follow' && state.selected) {
    controls.target.copy(state.selected.position);
    camera.position.copy(state.selected.position).add(new THREE.Vector3(180, -280, 220));
  }
  if (view === 'cinematic') {
    camera.position.set(520, -680, 520);
  }
  controls.target.set(0, 0, 0);
  if (view === 'follow' && state.selected) controls.target.copy(state.selected.position);
  controls.update();
}

function updateCameraTarget() {
  if (state.cameraMode === 'follow' && state.selected) {
    controls.target.lerp(state.selected.position, 0.12);
  }
  if (state.cameraMode === 'cinematic') {
    const t = performance.now() * 0.00008;
    const radius = 760;
    camera.position.lerp(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 430 + Math.sin(t * 1.7) * 120), 0.025);
    controls.target.lerp(systemCenter(), 0.04);
  }
}

function systemCenter() {
  if (!state.bodies.length) return new THREE.Vector3();
  const center = new THREE.Vector3();
  let total = 0;
  for (const body of state.bodies) {
    const weight = Math.max(1, body.mass);
    center.addScaledVector(body.position, weight);
    total += weight;
  }
  return center.multiplyScalar(1 / total);
}

function reset(options = {}) {
  for (const body of state.bodies) scene.remove(body.group);
  state.bodies = [];
  state.selected = null;
  state.events = [];
  state.cameraShake = 0;
  particles.clear();
  nebula.clear();
  filaments.clear();
  effects.clearAll();
  paintLayer.clear();
  paintCursor.visible = false;
  controls.target.set(0, 0, 0);
  controls.update();
  ui.status.textContent = options.status ?? 'vacuum reset';
  ui.updateInspector();
}

window.addEventListener('wheel', (event) => {
  if (!event.target.closest('#scene')) return;
}, { passive: false });

function createStarfield() {
  const group = new THREE.Group();
  group.name = 'infinite-starfield';
  group.renderOrder = -10;
  const layers = [
    { count: 1500, radius: 3200, size: 1.3, color: 0xaad8ff, opacity: 0.5 },
    { count: 420, radius: 5200, size: 2.1, color: 0xf7fbff, opacity: 0.36 }
  ];
  for (const layer of layers) {
    const geometry = new THREE.BufferGeometry();
    const points = [];
    for (let i = 0; i < layer.count; i++) {
      const dir = randomDirection();
      const radius = layer.radius * (0.72 + Math.random() * 0.28);
      points.push(dir.x * radius, dir.y * radius, dir.z * radius);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const texture = createSoftParticleTexture(`starfield-${layer.size}`, {
      core: 'rgba(255,255,255,0.95)',
      mid: 'rgba(170,220,255,0.18)',
      falloff: 0.68,
      wisps: false
    });
    const material = new THREE.PointsMaterial({
      color: layer.color,
      size: layer.size,
      map: texture,
      alphaMap: texture,
      alphaTest: 0.02,
      sizeAttenuation: true,
      transparent: true,
      opacity: layer.opacity,
      depthWrite: false,
      depthTest: false
    });
    const pointsObject = new THREE.Points(geometry, material);
    pointsObject.frustumCulled = false;
    group.add(pointsObject);
  }
  return group;
}

function createPaintCursor() {
  const group = new THREE.Group();
  group.name = 'paint-plane-cursor';
  group.visible = false;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(34, 0.9, 8, 96),
    new THREE.MeshBasicMaterial({
      color: 0x7ff8ef,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    })
  );
  const cross = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
      -44, 0, 0, 44, 0, 0,
      0, -44, 0, 0, 44, 0
    ], 3)),
    new THREE.LineBasicMaterial({
      color: 0x9fefff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    })
  );
  group.add(ring, cross);
  return group;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

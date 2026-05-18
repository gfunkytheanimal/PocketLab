import { ASSETS } from './config.js';

const POWER_HELP = {
  select: 'Select and drag objects. No god-power is applied.',
  push: 'Push nearby objects away from the click point.',
  pull: 'Pull nearby objects toward the click point.',
  heat: 'Add heat, glow, shockwaves, and burn-up reactions.',
  freeze: 'Damp motion nearby; close clicks toggle frozen objects.',
  orbit: 'Add sideways velocity so objects start curling into orbits.',
  paint: 'Paint the active Brush mode into the vacuum. Brush motes are playable bodies unless the Heat brush is selected.',
  fold: 'Push objects into the hidden W-axis so spacetime effects phase them out of normal space.',
  unfold: 'Pull objects back down the hidden W-axis toward ordinary space.'
};

const INSPECTOR_HELP = {
  radius: 'Physical/visual body size. Imported models scale as a whole.',
  mass: 'Newtonian mass. Higher mass pulls harder and resists pushes.',
  angularVelocity: 'Spin rate around the local visual axis.',
  z: 'Depth in the 3D sandbox.',
  vx: 'Velocity along X.',
  vy: 'Velocity along Y.',
  vz: 'Velocity along Z.',
  w: 'Hidden fourth-coordinate offset. Only spacetime volumes and Fold/Unfold care about this.',
  wVelocity: 'Flow speed through the hidden W-axis.',
  charge: 'Electromagnetic-ish value for magnets, UFOs, and charged dust.',
  heat: 'Thermal stress. Makes many assets glow, burn, vaporize, or react.',
  glow: 'Extra emissive boost. Works on procedural and imported materials where possible.',
  fieldStress: 'Visual/physics stress value used by fields, shaders, and volume shells.',
  tailLength: 'Comet tail length multiplier.',
  tailWidth: 'Comet tail width multiplier.',
  tailOpacity: 'Comet tail opacity multiplier.'
};

const PHYSICS_INPUTS = [
  'gravity-scale',
  'softening-scale',
  'capture-scale',
  'substeps',
  'damping',
  'restitution',
  'boundary-restitution',
  'max-acceleration',
  'max-velocity',
  'spacetime-scale',
  'w-projection',
  'ragdoll-scale',
  'bounds-size',
  'depth-spread',
  'field-density',
  'trail-length',
  'power-radius',
  'power-strength',
  'brush-size',
  'brush-strength'
];

export class UI {
  constructor(state, callbacks) {
    this.state = state;
    this.callbacks = callbacks;
    this.inspectedId = null;
    this.library = document.getElementById('library');
    this.assetList = document.getElementById('asset-list');
    this.inspector = document.getElementById('inspector');
    this.selectionBadge = document.getElementById('selection-badge');
    this.helpPanel = document.getElementById('help-panel');
    this.devPanel = document.getElementById('dev-panel');
    this.status = document.getElementById('status');
    this.scannerReadout = document.getElementById('scanner-readout');
    this.coordinates = document.getElementById('coordinates');
    this.buildLibrary();
    this.bindToolbar();
  }

  buildLibrary() {
    this.assetList.innerHTML = '<h1>Pocket Universe Lab</h1><p>Drag assets into the vacuum.</p>';
    const groups = new Map();
    for (const asset of ASSETS) {
      const group = this.assetGroup(asset);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(asset);
    }
    for (const [group, assets] of groups) {
      const details = document.createElement('details');
      details.className = 'asset-section';
      details.open = ['Core Bodies', 'Living Systems', 'Spacecraft'].includes(group);
      details.innerHTML = `<summary>${group}</summary>`;
      const sectionList = document.createElement('div');
      sectionList.className = 'asset-section-list';
      for (const asset of assets) {
      const card = document.createElement('button');
      card.className = `asset-card asset-${asset.type}`;
      card.type = 'button';
      card.draggable = true;
      card.dataset.type = asset.type;
      card.title = `${asset.label}: click to spawn or drag into space`;
      card.innerHTML = `<span>${asset.icon}</span><strong>${asset.label}</strong><small>${this.assetHint(asset.type)}</small>`;
      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', asset.type);
        this.status.textContent = `placing ${asset.label}`;
      });
      card.addEventListener('click', () => this.callbacks.spawnAtCenter(asset.type));
        sectionList.appendChild(card);
      }
      details.appendChild(sectionList);
      this.assetList.appendChild(details);
    }
  }

  bindToolbar() {
    document.getElementById('library-toggle').addEventListener('click', () => document.body.classList.toggle('library-collapsed'));
    document.getElementById('controls-toggle').addEventListener('click', () => document.body.classList.toggle('controls-collapsed'));
    document.getElementById('inspector-toggle').addEventListener('click', () => document.body.classList.toggle('inspector-collapsed'));
    document.getElementById('cinema-btn').addEventListener('click', () => {
      document.body.classList.toggle('cinema');
      this.callbacks.setCameraView(document.body.classList.contains('cinema') ? 'cinematic' : 'iso');
    });
    document.getElementById('help-toggle').addEventListener('click', () => this.helpPanel.classList.toggle('hidden'));
    this.bindStateButton('pause-btn', () => this.callbacks.togglePause());
    this.bindStateButton('gravity-btn', () => this.callbacks.toggleFields());
    this.bindStateButton('topology-btn', () => this.callbacks.toggleTopology());
    this.bindStateButton('trails-btn', () => this.callbacks.toggleTrails());
    this.bindStateButton('particles-btn', () => this.callbacks.toggleParticles());
    this.bindStateButton('filaments-btn', () => this.callbacks.toggleFilaments());
    this.bindStateButton('scanner-btn', () => this.callbacks.toggleScanner());
    this.bindStateButton('bounds-btn', () => this.callbacks.toggleBounds());
    this.bindStateButton('dev-mode-btn', () => this.toggleDevMode());
    document.getElementById('pulse-btn').addEventListener('click', () => this.callbacks.pulseUniverse());
    document.getElementById('fossilize-btn').addEventListener('click', () => this.callbacks.fossilizeUniverse());
    document.getElementById('clear-dust-btn').addEventListener('click', () => this.callbacks.clearDust());
    document.getElementById('clear-fossils-btn').addEventListener('click', () => this.callbacks.clearFossils());
    document.getElementById('clear-trails-btn').addEventListener('click', () => this.callbacks.clearTrails());
    document.getElementById('save-universe-btn').addEventListener('click', () => this.callbacks.saveUniverse());
    document.getElementById('load-universe-btn').addEventListener('click', () => this.callbacks.loadUniverse());
    document.getElementById('reset-btn').addEventListener('click', () => this.callbacks.reset());
    document.querySelectorAll('.camera-btn').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.setCameraView(button.dataset.view));
    });
    document.querySelectorAll('.tool-btn').forEach((button) => {
      button.title = POWER_HELP[button.dataset.tool] ?? 'Apply this power to nearby objects.';
      button.addEventListener('click', () => this.callbacks.setToolMode(button.dataset.tool));
    });
    document.querySelectorAll('.brush-btn').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.setBrushMode(button.dataset.brush));
    });
    document.querySelectorAll('.preset-btn').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.spawnPreset(button.dataset.preset));
    });
    document.querySelectorAll('.physics-preset-btn').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.applyPhysicsPreset(button.dataset.physicsPreset));
    });
    document.getElementById('time-scale').addEventListener('input', (event) => {
      this.state.timeScale = Number(event.target.value);
    });
    for (const id of PHYSICS_INPUTS) {
      document.getElementById(id)?.addEventListener('input', (event) => {
        this.state[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = Number(event.target.value);
      });
    }
    document.querySelectorAll('[data-dev-prop]').forEach((input) => {
      input.addEventListener('input', () => this.callbacks.setDevSetting(input.dataset.devProp, Number(input.value)));
    });
    this.syncToolbar();
  }

  bindStateButton(id, callback) {
    document.getElementById(id).addEventListener('click', () => {
      callback();
      this.syncToolbar();
    });
  }

  syncToolbar() {
    this.syncToggle('gravity-btn', this.state.showFields);
    this.syncToggle('topology-btn', this.state.showTopology);
    this.syncToggle('trails-btn', this.state.showTrails);
    this.syncToggle('particles-btn', this.state.showParticles);
    this.syncToggle('filaments-btn', this.state.showFilaments);
    this.syncToggle('scanner-btn', this.state.showScanner);
    this.syncToggle('bounds-btn', this.state.showBounds);
    this.syncToggle('dev-mode-btn', this.state.devMode);
    document.getElementById('pause-btn').classList.toggle('is-off', this.state.paused);
    this.syncPhysicsInputs();
    document.querySelectorAll('.tool-btn').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tool === this.state.toolMode);
    });
    document.querySelectorAll('.brush-btn').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.brush === this.state.brushMode);
    });
    if (this.scannerReadout) {
      this.scannerReadout.classList.toggle('hidden', !this.state.showScanner);
      this.scannerReadout.textContent = `Scanner: ${this.state.scannerCount ?? 0} events`;
    }
  }

  syncPhysicsInputs() {
    document.getElementById('time-scale').value = this.state.timeScale;
    for (const id of PHYSICS_INPUTS) {
      const input = document.getElementById(id);
      if (!input) continue;
      const prop = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (this.state[prop] !== undefined) input.value = this.state[prop];
    }
  }

  toggleDevMode() {
    this.state.devMode = !this.state.devMode;
    this.devPanel.classList.toggle('hidden', !this.state.devMode);
    this.status.textContent = this.state.devMode ? 'dev tuning unlocked' : 'dev tuning hidden';
    this.syncToolbar();
  }

  syncToggle(id, active) {
    const button = document.getElementById(id);
    button.classList.toggle('is-off', !active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  updateCoordinates(world, mode = 'World') {
    if (!this.coordinates || !world) return;
    this.coordinates.classList.remove('hidden');
    this.coordinates.textContent = `${mode}  X ${world.x.toFixed(0)}  Y ${world.y.toFixed(0)}  Z ${world.z.toFixed(0)}`;
  }

  updateInspector() {
    this.updateScannerReadout();
    const body = this.state.selected;
    if (!body) {
      this.inspector.classList.add('hidden');
      this.inspector.innerHTML = '';
      this.selectionBadge.classList.add('hidden');
      this.selectionBadge.innerHTML = '';
      this.inspectedId = null;
      return;
    }
    this.selectionBadge.classList.remove('hidden');
    this.selectionBadge.innerHTML = `<strong>${body.label}</strong><span>${body.category ?? body.type} selected</span>`;
    if (document.body.classList.contains('inspector-collapsed')) return;
    this.inspector.classList.remove('hidden');
    if (this.inspectedId !== body.id) this.buildInspector(body);
    this.inspector.querySelector('[data-readout="mass"]').textContent = body.mass.toFixed(2);
    this.inspector.querySelector('[data-readout="velocity"]').textContent = body.velocity.length().toFixed(1);
    this.inspector.querySelector('[data-readout="spin"]').textContent = body.angularVelocity.toFixed(2);
    this.inspector.querySelector('[data-readout="tidal"]').textContent = (body.tidalStress ?? 0).toFixed(2);
    this.inspector.querySelector('[data-readout="heat"]').textContent = (body.heat ?? 0).toFixed(2);
    this.inspector.querySelector('[data-readout="damage"]').textContent = (body.damage ?? 0).toFixed(2);
    this.inspector.querySelector('[data-readout="depth"]').textContent = body.position.z.toFixed(1);
    this.inspector.querySelector('[data-readout="w"]').textContent = (body.w ?? 0).toFixed(1);
    this.inspector.querySelector('[data-readout="dilation"]').textContent = (body.timeDilation ?? 1).toFixed(2);
    this.inspector.querySelector('[data-readout="emergent"]').textContent = this.emergentStatus(body);
  }

  updateScannerReadout() {
    if (!this.scannerReadout) return;
    this.scannerReadout.classList.toggle('hidden', !this.state.showScanner);
    this.scannerReadout.textContent = `Scanner: ${this.state.scannerCount ?? 0} events`;
  }

  buildInspector(body) {
    this.inspectedId = body.id;
    const speed = body.velocity.length();
    this.inspector.innerHTML = `
      <h2>${body.label}</h2>
      <dl>
        <dt>Mass</dt><dd data-readout="mass">${body.mass.toFixed(2)}</dd>
        <dt>Velocity</dt><dd data-readout="velocity">${speed.toFixed(1)}</dd>
        <dt>Spin</dt><dd data-readout="spin">${body.angularVelocity.toFixed(2)}</dd>
        <dt>Tidal</dt><dd data-readout="tidal">${(body.tidalStress ?? 0).toFixed(2)}</dd>
        <dt>Heat</dt><dd data-readout="heat">${(body.heat ?? 0).toFixed(2)}</dd>
        <dt>Damage</dt><dd data-readout="damage">${(body.damage ?? 0).toFixed(2)}</dd>
        <dt>Depth</dt><dd data-readout="depth">${body.position.z.toFixed(1)}</dd>
        <dt>W-Axis</dt><dd data-readout="w">${(body.w ?? 0).toFixed(1)}</dd>
        <dt>Time</dt><dd data-readout="dilation">${(body.timeDilation ?? 1).toFixed(2)}</dd>
        <dt>Class</dt><dd>${body.category}</dd>
        <dt>Material</dt><dd>${body.materialProfile ?? 'unknown'}</dd>
        <dt>Emergent</dt><dd data-readout="emergent">${this.emergentStatus(body)}</dd>
      </dl>
      <h3>Physical</h3>
      <div class="inspector-controls">
        <label>Size <input data-prop="radius" type="range" min="1" max="90" step="0.5" value="${body.radius}"></label>
        <label>Mass <input data-prop="mass" type="range" min="0" max="320" step="0.5" value="${body.mass}"></label>
      </div>
      <h3>Motion</h3>
      <div class="inspector-controls">
        <label>Spin <input data-prop="angularVelocity" type="range" min="-8" max="8" step="0.05" value="${body.angularVelocity}"></label>
        <label>Depth <input data-prop="z" type="range" min="-420" max="420" step="2" value="${body.position.z}"></label>
        <label>VX <input data-prop="vx" type="range" min="-260" max="260" step="1" value="${body.velocity.x}"></label>
        <label>VY <input data-prop="vy" type="range" min="-260" max="260" step="1" value="${body.velocity.y}"></label>
        <label>VZ <input data-prop="vz" type="range" min="-180" max="180" step="1" value="${body.velocity.z}"></label>
        <label>W <input data-prop="w" type="range" min="-90" max="90" step="1" value="${body.w ?? 0}"></label>
        <label>W Flow <input data-prop="wVelocity" type="range" min="-120" max="120" step="1" value="${body.wVelocity ?? 0}"></label>
      </div>
      <h3>Forces</h3>
      <div class="inspector-controls">
        <label>Charge <input data-prop="charge" type="range" min="-4" max="4" step="0.05" value="${body.charge ?? 0}"></label>
        <label>Heat <input data-prop="heat" type="range" min="0" max="1" step="0.01" value="${body.heat ?? 0}"></label>
      </div>
      <h3>Visuals</h3>
      <div class="inspector-controls">
        <label>Glow <input data-prop="glow" type="range" min="0" max="3" step="0.05" value="${body.glow ?? 1}"></label>
        <label>Field Stress <input data-prop="fieldStress" type="range" min="0" max="2" step="0.01" value="${body.fieldStress ?? 0}"></label>
        ${body.type === 'comet' ? `
          <label>Tail Length <input data-prop="tailLength" type="range" min="0" max="4" step="0.05" value="${body.tailLength ?? 1}"></label>
          <label>Tail Width <input data-prop="tailWidth" type="range" min="0.1" max="3" step="0.05" value="${body.tailWidth ?? 1}"></label>
          <label>Tail Opacity <input data-prop="tailOpacity" type="range" min="0" max="2" step="0.05" value="${body.tailOpacity ?? 1}"></label>
        ` : ''}
      </div>
      <div class="inspector-actions">
        <button data-action="mass-up">Mass +</button>
        <button data-action="mass-down">Mass -</button>
        <button data-action="velocity-down">Slow</button>
        <button data-action="velocity-up">Boost</button>
        <button data-action="orbit-kick">Orbit Kick</button>
        <button data-action="dust-ring">Dust Belt</button>
        <button data-action="tractor">Tractor</button>
        <button data-action="goo-burst">Goo Burst</button>
        <button data-action="explode">Burst</button>
        <button data-action="ignite">Ignite</button>
        <button data-action="binary">Binary</button>
        <button data-action="survey">Survey</button>
        <button data-action="visit">Visit</button>
        <button data-action="flare">Flare</button>
        <button data-action="release">Release</button>
        <button data-action="z-down">Z -</button>
        <button data-action="z-up">Z +</button>
        <button data-action="spin">Add Spin</button>
        <button data-action="stop">Stop</button>
        <button data-action="freeze">${body.frozen ? 'Unfreeze' : 'Freeze'}</button>
        <button data-action="trail">${body.showTrail ? 'Hide Trail' : 'Show Trail'}</button>
        <button data-action="delete">Delete</button>
      </div>
    `;
    this.inspector.querySelectorAll('input[data-prop]').forEach((input) => {
      input.title = INSPECTOR_HELP[input.dataset.prop] ?? 'Adjust this property in real time.';
      input.addEventListener('input', () => this.callbacks.inspectSet(input.dataset.prop, Number(input.value)));
    });
    this.inspector.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.inspectAction(button.dataset.action));
    });
  }

  assetHint(type) {
    const hints = {
      astronaut: 'ragdoll',
      planet: 'gravity',
      mars: 'rust',
      jupiter: 'giant',
      moon: 'orbit',
      star: 'heat',
      blackhole: 'danger',
      comet: 'tail',
      gas: 'swirl',
      station: 'ISS',
      mir: 'station',
      hubble: 'telescope',
      jwst: 'mirror',
      mro: 'orbiter',
      voyager: 'probe',
      rover: 'wheels',
      dish: 'signal',
      probe: 'probe',
      ufo: 'abduct',
      alien: 'visitor',
      magnet: 'charge',
      portal: 'teleport',
      asteroid: 'rock',
      dust: 'motes',
      debris: 'fragments',
      laser: 'beam',
      mystery: 'lander',
      'kit-solar': 'premade orbit',
      'kit-moon': 'stable capture',
      'kit-binary': 'paired motion',
      'kit-comets': 'icy swarm',
      'kit-feeding': 'danger setup'
    };
    return hints[type] ?? 'asset';
  }

  emergentStatus(body) {
    const bits = [];
    if (body.atmosphere) bits.push(`atmosphere ${(body.atmosphere * 100).toFixed(0)}%`);
    if (body.water) bits.push(`${body.water > 0.45 ? 'ocean' : 'ice'} ${(body.water * 100).toFixed(0)}%`);
    if (body.craters) bits.push(`${body.craters} crater${body.craters === 1 ? '' : 's'}`);
    if (body.damage) bits.push(`damage ${(body.damage * 100).toFixed(0)}%`);
    if (body.surfaceMissions) bits.push(`${body.surfaceMissions} surface contact${body.surfaceMissions === 1 ? '' : 's'}`);
    if (body.surveyed) bits.push(`${body.surveyed} survey${body.surveyed === 1 ? '' : 's'}`);
    if (body.habitability) bits.push(`habitable ${(body.habitability * 100).toFixed(0)}%`);
    if (body.biosphere) bits.push(`biosphere ${(body.biosphere * 100).toFixed(0)}%`);
    if (body.worldSurvey) bits.push(body.worldSurvey);
    if (body.satelliteCount) bits.push(`${body.satelliteCount} capture${body.satelliteCount === 1 ? '' : 's'}`);
    if (body.accretion && body.accretion > 0.5) bits.push(`accretion ${body.accretion.toFixed(1)}`);
    if (body.phaseShift && body.phaseShift > 0.05) bits.push(`phase ${(body.phaseShift * 100).toFixed(0)}%`);
    if (body.attachedTo) bits.push('attached');
    return bits.length ? bits.join(', ') : 'none yet';
  }

  assetGroup(asset) {
    if (['astronaut', 'alien'].includes(asset.type)) return 'Crew';
    if (['planet', 'mars', 'jupiter', 'moon', 'star', 'blackhole'].includes(asset.type)) return 'Core Bodies';
    if (asset.category === 'kit') return 'Living Systems';
    if (['comet', 'asteroid', 'dust', 'debris', 'gas'].includes(asset.type)) return 'Matter & Fields';
    if (['magnet', 'portal', 'laser'].includes(asset.type)) return 'Forces & Energy';
    return 'Spacecraft';
  }
}

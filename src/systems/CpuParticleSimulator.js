import { blendedField } from '../math/attractors.js';

const NOTE_FAMILIES = [
  { note: 'C', color: [0.28, 0.55, 1.55], sprite: 0, mass: 1.45, stiffness: 0.7, damping: 0.91 },
  { note: 'C#', color: [0.15, 1.2, 1.55], sprite: 4, mass: 1.1, stiffness: 0.86, damping: 0.9 },
  { note: 'D', color: [0.25, 1.25, 0.62], sprite: 2, mass: 1.05, stiffness: 0.78, damping: 0.91 },
  { note: 'D#', color: [0.7, 1.55, 0.3], sprite: 5, mass: 0.86, stiffness: 1.05, damping: 0.88 },
  { note: 'E', color: [1.55, 1.08, 0.25], sprite: 0, mass: 1.2, stiffness: 0.74, damping: 0.91 },
  { note: 'F', color: [1.55, 0.58, 0.22], sprite: 1, mass: 1.0, stiffness: 0.82, damping: 0.9 },
  { note: 'F#', color: [1.5, 0.22, 0.22], sprite: 4, mass: 0.92, stiffness: 1.0, damping: 0.88 },
  { note: 'G', color: [1.35, 0.3, 1.45], sprite: 3, mass: 0.98, stiffness: 0.72, damping: 0.92 },
  { note: 'G#', color: [0.72, 0.42, 1.65], sprite: 1, mass: 0.88, stiffness: 0.95, damping: 0.89 },
  { note: 'A', color: [1.35, 1.48, 1.62], sprite: 5, mass: 0.76, stiffness: 1.18, damping: 0.86 },
  { note: 'A#', color: [0.22, 1.4, 1.12], sprite: 3, mass: 0.92, stiffness: 0.9, damping: 0.9 },
  { note: 'B', color: [1.65, 1.28, 0.34], sprite: 5, mass: 0.72, stiffness: 1.12, damping: 0.86 }
];

const INSTRUMENT_FORCES = {
  piano: { attack: 1.25, sustain: 0.75, scatter: 0.45, align: 0.25, shimmer: 0.35, decayDrag: 1.0 },
  harp: { attack: 0.85, sustain: 0.62, scatter: 0.2, align: 0.4, shimmer: 1.1, decayDrag: 1.04 },
  drum: { attack: 2.1, sustain: 0.25, scatter: 1.35, align: 0.05, shimmer: 0.15, decayDrag: 0.94 },
  strings: { attack: 0.62, sustain: 1.45, scatter: 0.08, align: 1.05, shimmer: 0.35, decayDrag: 1.06 },
  'synth-pad': { attack: 0.55, sustain: 1.25, scatter: 0.12, align: 0.72, shimmer: 0.62, decayDrag: 1.08 },
  'electric-guitar': { attack: 1.35, sustain: 0.65, scatter: 1.1, align: 0.32, shimmer: 1.35, decayDrag: 0.98 },
  choir: { attack: 0.48, sustain: 1.35, scatter: 0.05, align: 0.92, shimmer: 0.55, decayDrag: 1.07 }
};

const STRUCTURE_TYPES = [
  'gravity-well',
  'crystal-lattice',
  'orbital-chain',
  'asteroid-belt',
  'star-nursery',
  'nebula-cluster',
  'binary-star',
  'spiral-galaxy',
  'barred-spiral',
  'solar-system',
  'planetary-ring',
  'golden-filament'
];

const STRUCTURE_BAND_RESPONSE = {
  'gravity-well': { sub: 1.35, bass: 1.15, lowMid: 0.35, mid: 0.2, highMid: 0.12, high: 0.08 },
  'crystal-lattice': { sub: 0.08, bass: 0.15, lowMid: 0.28, mid: 0.45, highMid: 1.25, high: 0.75 },
  'orbital-chain': { sub: 0.22, bass: 0.42, lowMid: 1.2, mid: 0.62, highMid: 0.25, high: 0.12 },
  'asteroid-belt': { sub: 0.15, bass: 0.32, lowMid: 0.52, mid: 0.35, highMid: 0.9, high: 1.2 },
  'star-nursery': { sub: 0.35, bass: 0.55, lowMid: 0.75, mid: 0.85, highMid: 0.55, high: 0.32 },
  'nebula-cluster': { sub: 0.22, bass: 0.36, lowMid: 0.62, mid: 1.25, highMid: 0.52, high: 0.22 },
  'binary-star': { sub: 0.58, bass: 0.82, lowMid: 0.72, mid: 0.4, highMid: 0.2, high: 0.12 },
  'spiral-galaxy': { sub: 0.5, bass: 0.82, lowMid: 1.25, mid: 0.55, highMid: 0.24, high: 0.14 },
  'barred-spiral': { sub: 0.45, bass: 0.95, lowMid: 1.05, mid: 0.5, highMid: 0.3, high: 0.14 },
  'solar-system': { sub: 0.35, bass: 0.62, lowMid: 0.78, mid: 0.72, highMid: 0.38, high: 0.25 },
  'planetary-ring': { sub: 0.26, bass: 0.55, lowMid: 0.7, mid: 0.45, highMid: 0.75, high: 0.42 },
  'golden-filament': { sub: 0.08, bass: 0.14, lowMid: 0.28, mid: 0.42, highMid: 0.92, high: 1.35 }
};

export class CpuParticleSimulator {
  constructor(params) {
    this.params = params;
    this.universe = null;
    this.time = 0;
    this.particles = new Float32Array(0);
    this.restPositions = new Float32Array(0);
    this.particleRingIndices = new Uint16Array(0);
    this.familyCenters = Array.from({ length: 12 }, () => [0, 0, 0, 0]);
    this.ringCenters = [];
    this.ringInstances = [];
    this.count = 0;
    this.radialBins = new Float32Array(12);
  }

  reset(count, cameraPosition) {
    this.count = count;
    this.particles = new Float32Array(count * 12);
    this.restPositions = new Float32Array(count * 3);
    this.particleRingIndices = new Uint16Array(count);
    if (this.params.appMode === 'sound-board' && this.params.pianoPhysicsMode) this.buildRingInstances();
    for (let i = 0; i < count; i++) {
      const src = i * 12;
      const family = i % 12;
      const ringIndex = this.params.pianoPhysicsMode ? i % Math.max(1, this.ringInstances.length) : 0;
      this.particleRingIndices[i] = ringIndex;
      const p = this.params.appMode === 'sound-board' && this.params.pianoPhysicsMode ? this.spawnPianoParticle(i) : this.params.appMode === 'sound-board' ? this.spawnBoard(i) : this.spawnAhead(i, cameraPosition);
      const role = this.params.pianoPhysicsMode ? NOTE_FAMILIES[family].sprite : i % 6;
      let h1 = hash(i * 19.17);
      let h2 = hash(i * 23.31 + 4.2);
      let h3 = hash(i * 29.73 + 8.9);
      if (this.params.pianoPhysicsMode) {
        h1 = ((Math.floor(i / 12) % 4096) / 4096);
        h2 = Math.floor(hash(i * 23.31 + 4.2) * 5) / 4;
        h3 = hash(i * 29.73 + 8.9);
      }
      this.particles[src] = p[0];
      this.particles[src + 1] = p[1];
      this.particles[src + 2] = p[2];
      this.particles[src + 3] = 1;
      this.particles[src + 4] = 0;
      this.particles[src + 5] = 0;
      this.particles[src + 6] = 0;
      this.particles[src + 7] = 0;
      this.particles[src + 8] = role;
      this.particles[src + 9] = h1;
      this.particles[src + 10] = h2;
      this.particles[src + 11] = this.params.pianoPhysicsMode ? family : h3;
      const rdst = i * 3;
      this.restPositions[rdst] = p[0];
      this.restPositions[rdst + 1] = p[1];
      this.restPositions[rdst + 2] = p[2];
    }
  }

  update(dt, cameraPosition, universe = null) {
    this.universe = universe;
    this.time += dt;
    if (dt <= 0) return;
    if (this.params.appMode === 'sound-board') {
      if (this.params.pianoPhysicsMode) {
        this.updatePianoPhysics(dt);
        return;
      }
      this.updateBoard(dt);
      return;
    }
    const radius = this.params.recycleRadius;
    const radius2 = radius * radius;
    const clean = this.params.cleanFlow;
    const speedMultiplier = this.params.speedMultiplier ?? 1;
    const tightness = this.params.tunnelTightness ?? 1;
    for (let i = 0; i < this.count; i++) {
      const src = i * 12;
      const p = [this.particles[src], this.particles[src + 1], this.particles[src + 2]];
      const recursivePosition = universe?.recursion.remap(p) ?? p;
      const mutation = universe?.recursion.fieldMutation() ?? { morphOffset: 0, strength: 1, recursiveBoost: 0 };
      const fieldTime = clean ? this.time * 0.28 : this.time;
      const f0 = blendedField(
        recursivePosition,
        fieldTime + mutation.morphOffset * (clean ? 0.25 : 1) + this.params.audioMid * 2,
        this.params.recursiveStrength + mutation.recursiveBoost + this.params.audioBass * 0.08
      );
      const mid = [
        p[0] + f0[0] * dt * 0.5,
        p[1] + f0[1] * dt * 0.5,
        p[2] + f0[2] * dt * 0.5
      ];
      const f1 = blendedField(
        universe?.recursion.remap(mid) ?? mid,
        fieldTime + dt + mutation.morphOffset * (clean ? 0.25 : 1),
        this.params.recursiveStrength + mutation.recursiveBoost
      );
      const memory = universe?.memory.sample(p);
      const structure = universe?.megastructures.sample(p);
      const entity = universe?.entities.sample(p);
      const horizon = universe?.horizons.sample(p);
      const encounter = universe?.encounters.sample(p);
      const biome = universe?.biomes.sample(p);
      const len = Math.hypot(f1[0], f1[1], f1[2]) || 1;
      const memoryPull = this.params.memoryInfluence * (memory?.energy ?? 0);
      const structurePull = this.params.structureInfluence * (structure?.density ?? 0);
      const biomeField = biome?.influence.field ?? 1;
      const relX = p[0] - cameraPosition.x;
      const relY = p[1] - cameraPosition.y;
      const depth = Math.max(1, cameraPosition.z - p[2]);
      const corridor = this.corridorFlow(relX, relY, depth, i);
      const fieldBlend = clean ? 0.62 : 1;
      const tunnelBlend = clean ? 1.05 : 0.45;
      const encounterPull = clean ? 0.42 : 0.25;
      const ax = (f1[0] / len) * mutation.strength * biomeField * fieldBlend + corridor[0] * tunnelBlend + (memory?.flow[0] ?? 0) * memoryPull + (structure?.force[0] ?? 0) * structurePull + (entity?.force[0] ?? 0) * 0.08 + (horizon?.force[0] ?? 0) * 0.2 + (encounter?.force[0] ?? 0) * encounterPull;
      const ay = (f1[1] / len) * mutation.strength * biomeField * fieldBlend + corridor[1] * tunnelBlend + (memory?.flow[1] ?? 0) * memoryPull + (structure?.force[1] ?? 0) * structurePull + (entity?.force[1] ?? 0) * 0.08 + (horizon?.force[1] ?? 0) * 0.2 + (encounter?.force[1] ?? 0) * encounterPull;
      const az = (f1[2] / len) * mutation.strength * biomeField * fieldBlend + corridor[2] * tunnelBlend + (memory?.flow[2] ?? 0) * memoryPull + (structure?.force[2] ?? 0) * structurePull + (entity?.force[2] ?? 0) * 0.08 + (horizon?.force[2] ?? 0) * 0.2 + (encounter?.force[2] ?? 0) * encounterPull;
      const audioLift = 1 + this.params.audioLevel * (this.params.controlTestMode ? 3.5 : 1.4);
      const drag = clean ? 0.986 : (biome?.influence.drag ?? 0.992);
      const accel = (clean ? 0.035 : 0.12) * (1 + Math.log2(Math.max(1, speedMultiplier)) * 0.2);
      this.particles[src + 4] = this.particles[src + 4] * drag + ax * accel * audioLift;
      this.particles[src + 5] = this.particles[src + 5] * drag + ay * accel * audioLift;
      this.particles[src + 6] = this.particles[src + 6] * drag + az * accel * audioLift;
      this.particles[src] += this.particles[src + 4] * dt * this.params.fieldStrength;
      this.particles[src + 1] += this.particles[src + 5] * dt * this.params.fieldStrength;
      this.particles[src + 2] += (this.particles[src + 6] * this.params.fieldStrength + this.params.travelSpeed * speedMultiplier * (clean ? 0.62 : 0.75)) * dt;
      const curvature = Math.hypot(f1[0] - f0[0], f1[1] - f0[1], f1[2] - f0[2]);
      universe?.memory.inject(p, [this.particles[src + 4], this.particles[src + 5], this.particles[src + 6]], Math.min(4, curvature * 0.03 + len * 0.01));
      const targetAlpha = Math.min(1, this.particles[src + 3] + (memory?.energy ?? 0) * 0.35 + (structure?.density ?? 0) * 0.28 + (entity?.density ?? 0) * 0.45 + (horizon?.warp ?? 0) * 0.5 + (encounter?.density ?? 0) * 0.65);
      this.particles[src + 7] += (targetAlpha - this.particles[src + 7]) * (1 - Math.pow(0.015, dt));
      this.particles[src + 3] -= dt * 0.045;

      const dx = this.particles[src] - cameraPosition.x;
      const dy = this.particles[src + 1] - cameraPosition.y;
      const dz = this.particles[src + 2] - cameraPosition.z;
      const behind = this.particles[src + 2] > cameraPosition.z + 8;
      const tooFarAhead = this.particles[src + 2] < cameraPosition.z - radius * 1.55;
      const tooWide = dx * dx + dy * dy > radius2 * (0.7 / tightness);
      if (behind || tooFarAhead || tooWide || this.particles[src + 3] <= 0) {
        const r = this.spawnAhead(i + this.time * 100 + this.params.recursiveDepth * 17, cameraPosition);
        this.particles[src] = r[0];
        this.particles[src + 1] = r[1];
        this.particles[src + 2] = r[2];
        this.particles[src + 3] = 0.85;
        this.particles[src + 7] = 0;
        this.particles[src + 4] *= 0.25;
        this.particles[src + 5] *= 0.25;
        this.particles[src + 6] = Math.abs(this.particles[src + 6]) * 0.2;
      }
    }
  }

  updatePianoPhysics(dt) {
    dt *= this.params.simSpeed ?? 1;
    const activations = this.params.noteFamilyActivation ?? [];
    const held = this.params.noteFamilyHeld ?? [];
    const R = this.params.torusMajorRadius ?? this.params.boardRadius ?? 46;
    const tube = this.params.torusMinorRadius ?? 15;
    const instrument = INSTRUMENT_FORCES[this.params.noteInstrument ?? 'piano'] ?? INSTRUMENT_FORCES.piano;
    const visual = this.params.visualReactivity ?? 1.15;
    const chordType = this.params.chordType ?? 'none';
    const rings = this.ringInstances.length ? this.ringInstances : [{ family: 0, center: [0, 0, 0], activity: 0, radius: R, mass: 1 }];
    const bands = this.params.audioBands ?? {};
    const bandEvents = this.params.audioBandEvents ?? {};
    const onset = this.params.audioOnset ?? 0;
    const broad = bandEvents.broadband ?? 0;
    const demoMode = this.params.primaryMode === 'demo';
    const causalSongMode = this.params.noteLayout === 'causal-universe' && this.params.almightyWaveformMode && (this.params.primaryMode === 'demo' || this.params.primaryMode === 'piano' || this.params.primaryMode === 'microphone');
    const jamMode = !demoMode && this.params.primaryMode === 'piano' && causalSongMode;
    const songObjects = causalSongMode ? (this.params.songObjects ?? []) : [];
    const liveAudioFloor = demoMode
      ? Math.min(1, (this.params.audioRms ?? 0) * 2.8 + (this.params.audioEnergy ?? 0) * 0.45 + onset * 0.28 + broad * 0.32)
      : 0;
    const demoBuild = demoMode ? Math.max(0, Math.min(1, this.params.demoBuildProgress ?? 0)) : 1;
    const originFamily = this.params.originFamily ?? -1;
    this.ringCenters = rings.map(() => [0, 0, 0, 0]);
    let totalEnergy = 0;
    let chaos = 0;
    let radiusSum = 0;

    for (const center of this.familyCenters) {
      center[0] = 0;
      center[1] = 0;
      center[2] = 0;
      center[3] = 0;
    }
    for (let i = 0; i < this.count; i++) {
      const src = i * 12;
      const family = Math.max(0, Math.min(11, Math.round(this.particles[src + 11] ?? (i % 12))));
      const center = this.familyCenters[family];
      center[0] += this.particles[src];
      center[1] += this.particles[src + 1];
      center[2] += this.particles[src + 2];
      center[3] += 1;
      const ringCenter = this.ringCenters[this.particleRingIndices[i]];
      if (ringCenter) {
        ringCenter[0] += this.particles[src];
        ringCenter[1] += this.particles[src + 1];
        ringCenter[2] += this.particles[src + 2];
        ringCenter[3] += 1;
      }
    }
    for (let i = 0; i < rings.length; i++) {
      const center = this.ringCenters[i];
      if (center?.[3] > 0) {
        center[0] /= center[3];
        center[1] /= center[3];
        center[2] /= center[3];
      }
      const ring = rings[i];
      const familyLevel = activations[ring.family] ?? 0;
      const harmonic = Math.max(activations[(ring.family + 7) % 12] ?? 0, activations[(ring.family + 5) % 12] ?? 0) * 0.28;
      const dissonant = Math.max(activations[(ring.family + 1) % 12] ?? 0, activations[(ring.family + 11) % 12] ?? 0) * 0.16;
      const response = STRUCTURE_BAND_RESPONSE[ring.type] ?? STRUCTURE_BAND_RESPONSE['solar-system'];
      const bandDrive = (
        (bands.sub ?? 0) * response.sub +
        (bands.bass ?? 0) * response.bass +
        (bands.lowMid ?? 0) * response.lowMid +
        (bands.mid ?? 0) * response.mid +
        (bands.highMid ?? 0) * response.highMid +
        (bands.high ?? 0) * response.high
      ) / 2.6;
      const eventDrive = (
        (bandEvents.sub ?? 0) * response.sub +
        (bandEvents.bass ?? 0) * response.bass +
        (bandEvents.lowMid ?? 0) * response.lowMid +
        (bandEvents.mid ?? 0) * response.mid +
        (bandEvents.highMid ?? 0) * response.highMid +
        (bandEvents.high ?? 0) * response.high
      ) / 2.2;
      const proximity = ring.proximity ?? 1;
      const responseBias = Math.max(response.sub, response.bass, response.lowMid, response.mid, response.highMid, response.high) / 1.35;
      const seededPulse = 0.64 + hash((ring.index ?? 0) * 2.71 + Math.floor(this.time * 3.5)) * 0.36;
      const demoStructureDrive = liveAudioFloor * (0.08 + responseBias * 0.16) * seededPulse * (0.35 + proximity * 0.55);
      const noteSpark = Math.pow(Math.max(0, familyLevel + harmonic * 0.55 + dissonant * 0.25), 2.7);
      const noteReveal = Math.min(1, noteSpark * (ring.octave < 0 ? 0.42 : 0.12) + eventDrive * (ring.octave < 0 ? 0.05 : 0.02));
      const harmonicDistance = originFamily >= 0 ? Math.abs(((ring.family - originFamily + 18) % 12) - 6) / 6 : 0.5;
      const causalDelay = demoMode && originFamily >= 0 ? harmonicDistance * 0.18 + (ring.octave > 0 ? 0.08 : 0) : 0;
      const birthReveal = demoMode ? smoothstep((ring.birthPhase ?? 0) + causalDelay - 0.08, (ring.birthPhase ?? 0) + causalDelay + 0.16, demoBuild) : 1;
      const revealTarget = demoMode ? Math.max(birthReveal, noteReveal) : 1;
      ring.reveal = (ring.reveal ?? 0) * 0.94 + revealTarget * 0.06;
      const reveal = ring.reveal ?? 1;
      const audioDrive = Math.min(0.92, bandDrive * 0.92 + eventDrive * 0.78 + broad * 0.42 + onset * 0.16 + demoStructureDrive) * (0.48 + proximity * 0.58) * reveal;
      ring.activity = ring.activity * 0.9 + Math.min(1, Math.max((familyLevel + harmonic + dissonant) * proximity, audioDrive) * reveal) * 0.1;
      ring.audioDrive = (ring.audioDrive ?? 0) * 0.86 + audioDrive * 0.14;
      ring.bandDrive = bandDrive;
      ring.eventDrive = eventDrive;
      ring.demoDrive = demoStructureDrive;
    }
    const collisionStrength = this.params.collisionStrength ?? 0.9;
    let collisionEnergy = 0;
    for (const ring of rings) {
      if (!ring.baseCenter) ring.baseCenter = [...ring.center];
      if (!ring.velocity) ring.velocity = [0, 0, 0];
      const returnK = 0.012 + (ring.activity ?? 0) * 0.006;
      ring.velocity[0] += (ring.baseCenter[0] - ring.center[0]) * returnK;
      ring.velocity[1] += (ring.baseCenter[1] - ring.center[1]) * returnK;
      ring.velocity[2] += (ring.baseCenter[2] - ring.center[2]) * returnK;
      if (demoMode && liveAudioFloor > 0.01 && (ring.reveal ?? 0) > 0.025) {
        const phase = this.time * (0.7 + (ring.family % 5) * 0.09) + (ring.index ?? 0) * 1.17;
        const sway = (ring.audioDrive ?? 0) * liveAudioFloor * (ring.reveal ?? 0) * (0.014 + (ring.turbulence ?? 0.4) * 0.018);
        ring.velocity[0] += Math.cos(phase) * sway;
        ring.velocity[1] += Math.sin(phase * 1.31) * sway * 0.7;
        ring.velocity[2] += Math.sin(phase) * sway;
      }
      ring.collision = (ring.collision ?? 0) * 0.9;
      ring.wobble = (ring.wobble ?? 0) * 0.94 + (ring.activity ?? 0) * 0.035;
    }
    for (let a = 0; a < rings.length; a++) {
      const ra = rings[a];
      for (let b = a + 1; b < rings.length; b++) {
        const rb = rings[b];
        const dx = rb.center[0] - ra.center[0];
        const dy = rb.center[1] - ra.center[1];
        const dz = rb.center[2] - ra.center[2];
        const d = Math.hypot(dx, dy, dz) || 0.001;
        const desired = (ra.radius + rb.radius) * (0.68 + (ra.cluster === rb.cluster ? 0.22 : -0.08));
        if (d >= desired) continue;
        const interval = Math.abs(((rb.family - ra.family + 18) % 12) - 6);
        const harmonic = interval === 1 || interval === 5 ? 0.62 : interval === 0 ? 0.45 : interval <= 2 ? 1.35 : 0.9;
        const overlap = (desired - d) / desired;
        const force = overlap * collisionStrength * harmonic * (0.6 + (ra.activity + rb.activity) * 0.65);
        const nx = dx / d;
        const ny = dy / d;
        const nz = dz / d;
        const ma = rb.mass / (ra.mass + rb.mass);
        const mb = ra.mass / (ra.mass + rb.mass);
        ra.velocity[0] -= nx * force * ma;
        ra.velocity[1] -= ny * force * ma;
        ra.velocity[2] -= nz * force * ma;
        rb.velocity[0] += nx * force * mb;
        rb.velocity[1] += ny * force * mb;
        rb.velocity[2] += nz * force * mb;
        ra.collision = Math.max(ra.collision ?? 0, overlap * harmonic);
        rb.collision = Math.max(rb.collision ?? 0, overlap * harmonic);
        ra.wobble += overlap * 0.2;
        rb.wobble += overlap * 0.2;
        collisionEnergy += overlap * harmonic;
      }
    }
    for (const ring of rings) {
      const drag = Math.pow(0.82, Math.max(0.2, dt * 60));
      ring.velocity[0] *= drag;
      ring.velocity[1] *= drag;
      ring.velocity[2] *= drag;
      ring.center[0] += ring.velocity[0] * dt * 26;
      ring.center[1] += ring.velocity[1] * dt * 26;
      ring.center[2] += ring.velocity[2] * dt * 26;
    }
    for (const center of this.familyCenters) {
      if (center[3] <= 0) continue;
      center[0] /= center[3];
      center[1] /= center[3];
      center[2] /= center[3];
    }

    for (let i = 0; i < this.count; i++) {
      const src = i * 12;
      const rest = i * 3;
      const family = Math.max(0, Math.min(11, Math.round(this.particles[src + 11] ?? (i % 12))));
      const ringIndex = this.particleRingIndices[i] ?? 0;
      const ring = rings[ringIndex] ?? rings[0];
      let ringReveal = demoMode ? (ring.reveal ?? 0) : 1;
      const style = NOTE_FAMILIES[family];
      const ringActive = ring.activity ?? 0;
      let active = Math.max((activations[family] ?? 0) * (ring.proximity ?? 1), held[family] ?? 0, ringActive * 0.8) * ringReveal;
      const left = activations[(family + 11) % 12] ?? 0;
      const right = activations[(family + 1) % 12] ?? 0;
      const fifth = activations[(family + 7) % 12] ?? 0;
      const fourth = activations[(family + 5) % 12] ?? 0;
      const tritone = activations[(family + 6) % 12] ?? 0;
      const neighbor = Math.max(left, right) * 0.14 + Math.max(fifth, fourth) * 0.22 + tritone * 0.08;
      const coupled = Math.max(active, neighbor);
      let x = this.particles[src];
      let y = this.particles[src + 1];
      let z = this.particles[src + 2];
      let vx = this.particles[src + 4];
      let vy = this.particles[src + 5];
      let vz = this.particles[src + 6];
      const seedA = this.particles[src + 9];
      const seedB = this.particles[src + 10];
      const jamGate = !jamMode || seedA < Math.max(0, Math.min(1, this.params.jamParticleReveal ?? 0));
      let rx = this.restPositions[rest];
      let ry = this.restPositions[rest + 1];
      let rz = this.restPositions[rest + 2];
      let particleObject = null;
      let objectShell = tube;
      let objectMemoryGlow = 0;
      if (songObjects.length > 0) {
        particleObject = songObjects[(Math.floor(i / 5) + family * 11) % songObjects.length];
        const target = songObjectParticleTarget(particleObject, seedA, seedB, family, this.time);
        rx = target[0];
        ry = target[1];
        rz = target[2];
        objectShell = target[3];
        const objectDrive = Math.min(1, (particleObject.energy ?? 0) * 0.8 + (particleObject.pulse ?? 0) * 0.9 + liveAudioFloor * 0.22);
        objectMemoryGlow = jamMode ? Math.min(0.22, 0.035 + (particleObject.memory ?? 0) * 0.16 + (particleObject.prebuilt ? 0.035 : 0)) : 0;
        ringReveal = Math.max(ringReveal * 0.22, 0.18 + objectDrive * 0.72);
        active = jamGate ? Math.max(active * 0.45, objectDrive, objectMemoryGlow * 0.85) : 0;
      }
      const q = Math.hypot(rx, rz) || 1;
      const torusNormal = [rx / q, 0, rz / q];
      const tangent = [-rz / q, 0, rx / q];
      const tubeNormal = normalize([rx - torusNormal[0] * R, ry, rz - torusNormal[2] * R]);
      const familyPhase = family / 12 * Math.PI * 2;
      const stringT = seedA;
      const harmonic = 1 + (family % 5);
      const wavePhase = stringT * Math.PI * 2 * harmonic - this.time * (3.1 + family * 0.08);
      const pulse = Math.sin(wavePhase);
      const standing = Math.sin(stringT * Math.PI * 2 * (2 + (family % 4))) * Math.cos(this.time * (1.4 + family * 0.04));
      const heldLift = held[family] > 0 ? 0.45 : 0;
      const impulse = (active * (1.5 + heldLift) * (instrument.attack + instrument.sustain * held[family]) + neighbor * 0.75) * visual;
      const springK = (0.42 + style.stiffness * 0.34) * (1 + impulse * 0.55);
      const pluck = impulse * (4.5 + 2.7 * pulse + 1.8 * standing);
      const ringShift = ring.baseCenter ? [ring.center[0] - ring.baseCenter[0], ring.center[1] - ring.baseCenter[1], ring.center[2] - ring.baseCenter[2]] : [0, 0, 0];
      const targetX = rx + ringShift[0] + tubeNormal[0] * pluck + tangent[0] * impulse * Math.sin(wavePhase * 0.5) * 2.2;
      const targetY = ry + ringShift[1] + tubeNormal[1] * pluck + Math.sin(wavePhase + familyPhase) * impulse * (family === 7 || family === 10 ? 5.2 : 2.1);
      const targetZ = rz + ringShift[2] + tubeNormal[2] * pluck + tangent[2] * impulse * Math.sin(wavePhase * 0.5) * 2.2;
      let ax = (targetX - x) * springK;
      let ay = (targetY - y) * springK;
      let az = (targetZ - z) * springK;

      const behavior = noteBehaviorForce(family, {
        x, y, z, vx, vy, vz, rx, ry, rz, active, neighbor, impulse, seedA, seedB,
        time: this.time,
        tangent,
        tubeNormal,
        torusNormal,
        familyPhase,
        R,
        tube,
        instrument,
        chordType,
        centers: this.familyCenters
      });
      ax += behavior[0] * visual;
      ay += behavior[1] * visual;
      az += behavior[2] * visual;

      const transfer = harmonicTransferTarget(family, activations, active, seedA, seedB, this.familyCenters, chordType, this.params.particleTransfer ?? 0.55);
      if (transfer) {
        ax += (transfer[0] - x) * transfer[3];
        ay += (transfer[1] - y) * transfer[3];
        az += (transfer[2] - z) * transfer[3];
      }

      for (let j = 0; j < this.familyCenters.length; j++) {
        const otherActive = activations[j] ?? 0;
        if (j === family || otherActive < 0.025) continue;
        const center = this.familyCenters[j];
        const dx = x - center[0];
        const dy = y - center[1];
        const dz = z - center[2];
        const d2 = dx * dx + dy * dy + dz * dz + 18;
        const push = otherActive * coupled * 80 / d2;
        ax += dx * push;
        ay += dy * push;
        az += dz * push;
        chaos += push * 0.0008;
      }
      if ((ring.collision ?? 0) > 0.015) {
        const shove = Math.min(1.6, ring.collision) * collisionStrength;
        ax += tubeNormal[0] * shove * (5 + seedB * 4) + tangent[0] * shove * Math.sin(seedA * 19);
        ay += tubeNormal[1] * shove * (5 + seedB * 4) + Math.cos(seedA * 23) * shove * 2;
        az += tubeNormal[2] * shove * (5 + seedB * 4) + tangent[2] * shove * Math.sin(seedA * 19);
        chaos += shove * 0.006;
      }

      const torus = songObjects.length > 0 && particleObject
        ? restShellForce([x, y, z], [rx, ry, rz], objectShell)
        : this.params.noteLayout === 'three-tori'
        ? restShellForce([x, y, z], [rx, ry, rz], tube)
        : torusForce([x, y, z], this.params, this.params.goldenEscape ?? 0);
      ax += torus[0] * 3.2;
      ay += torus[1] * 3.2;
      az += torus[2] * 3.2;
      const globeLimit = Math.max(72, 110 * (this.params.universeScale ?? 1));
      const gd = Math.hypot(x, y, z) || 1;
      if (gd > globeLimit * 0.82) {
        const edge = (gd - globeLimit * 0.82) / Math.max(1, globeLimit * 0.18);
        const inward = Math.pow(Math.max(0, edge), 1.4) * (1.2 + collisionStrength * 0.8);
        ax += -(x / gd) * inward * 7.5;
        ay += -(y / gd) * inward * 7.5;
        az += -(z / gd) * inward * 7.5;
        vx *= 0.992 - Math.min(0.08, edge * 0.025);
        vy *= 0.992 - Math.min(0.08, edge * 0.025);
        vz *= 0.992 - Math.min(0.08, edge * 0.025);
      }

      const damping = Math.min(0.985, (style.damping - Math.min(0.08, active * 0.045 + neighbor * 0.035)) * instrument.decayDrag);
      vx = vx * damping + ax / style.mass * dt * 1.85;
      vy = vy * damping + ay / style.mass * dt * 1.85;
      vz = vz * damping + az / style.mass * dt * 1.85;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;

      if (active > 0.72 && seedB > 0.965 && (this.params.particleTransfer ?? 0) > 0.02) {
        const targetRing = nearestCompatibleRing(ringIndex, ring, rings, activations, seedA);
        if (targetRing >= 0 && targetRing !== ringIndex) {
          this.particleRingIndices[i] = targetRing;
          const migrated = this.spawnPianoParticle(i);
          this.restPositions[rest] = migrated[0];
          this.restPositions[rest + 1] = migrated[1];
          this.restPositions[rest + 2] = migrated[2];
          vx += (this.restPositions[rest] - x) * 0.04;
          vy += (this.restPositions[rest + 1] - y) * 0.04;
          vz += (this.restPositions[rest + 2] - z) * 0.04;
        }
      }

      this.particles[src] = x;
      this.particles[src + 1] = y;
      this.particles[src + 2] = z;
      this.particles[src + 3] = 1;
      this.particles[src + 4] = vx;
      this.particles[src + 5] = vy;
      this.particles[src + 6] = vz;
      const speed = Math.hypot(vx, vy, vz);
      const dormantPiano = !demoMode && this.params.almightyWaveformMode && !this.params.originEstablished && (this.params.songObjects?.length ?? 0) === 0;
      const calmAlpha = demoMode
        ? (0.001 + ringReveal * (0.018 + (family % 3) * 0.003))
        : dormantPiano ? 0 : (0.028 + (family % 3) * 0.004 + objectMemoryGlow);
      const activeGlow = demoMode
        ? active * 0.34 + neighbor * 0.08 + speed * 0.01
        : active * 0.48 + neighbor * 0.11 + speed * 0.012;
      const objectFade = demoMode ? 1 - Math.min(0.52, (this.params.songObjectCount ?? 0) / 320) : 1;
      const targetAlpha = Math.min(1, (calmAlpha + activeGlow + torus[3] * (demoMode ? 0.018 : 0.055)) * (demoMode ? Math.max(0.025, ringReveal * 0.72) * objectFade : 1) * (jamGate ? 1 : 0));
      this.particles[src + 7] += (targetAlpha - this.particles[src + 7]) * (1 - Math.pow(0.04, dt));
      totalEnergy += active + speed * 0.0025;
      radiusSum += Math.hypot(x, z);
    }

    this.params.totalEnergy = Math.min(1, totalEnergy / Math.max(1, this.count) * 10);
    this.params.chaosLevel = Math.min(1, chaos + collisionEnergy * 0.03 + this.params.totalEnergy * 0.45);
    this.params.collisionEnergy = Math.min(1, collisionEnergy * 0.04);
    this.params.averageParticleRadius = radiusSum / Math.max(1, this.count);
    this.params.boundaryRadius = R + tube;
    this.params.equilibriumRadius = R;
    this.params.innerRepulsionRadius = Math.max(1, R - tube);
    this.params.radialHistogram = NOTE_FAMILIES.map((family, index) => `${family.note}:${((activations[index] ?? 0) * 9).toFixed(0)}`).join(' ');
    const activeStructures = rings
      .filter((ring) => (ring.activity ?? 0) > 0.08)
      .sort((a, b) => (b.activity ?? 0) - (a.activity ?? 0));
    let universeRadius = 0;
    for (const ring of rings) {
      const reveal = demoMode ? (ring.reveal ?? 0) : 1;
      if (reveal < 0.06) continue;
      const d = Math.hypot(ring.center[0], ring.center[1], ring.center[2]) + (ring.radius ?? 0) * (0.8 + reveal);
      universeRadius = Math.max(universeRadius, d);
    }
    this.params.songUniverseRadius = universeRadius || 42;
    this.params.activeGalaxyCount = activeStructures.filter((ring) => !demoMode || (ring.reveal ?? 0) > 0.18).length;
    this.params.strongestStructures = activeStructures
      .slice(0, 5)
      .map((ring) => `${NOTE_FAMILIES[ring.family]?.note ?? '?'}:${ring.type}:${(ring.activity ?? 0).toFixed(2)}`)
      .join(' ');
    this.params.ringInstances = rings.map((ring) => ({ index: ring.index, family: ring.family, octave: ring.octave, cluster: ring.cluster, center: ring.center, radius: ring.radius, activity: ring.activity, mass: ring.mass, motif: ring.motif, type: ring.type, planets: ring.planets, arms: ring.arms, turbulence: ring.turbulence, tilt: ring.tilt, eccentricity: ring.eccentricity, broken: ring.broken, wobble: ring.wobble, collision: ring.collision, audioDrive: ring.audioDrive, bandDrive: ring.bandDrive, eventDrive: ring.eventDrive, demoDrive: ring.demoDrive, reveal: ring.reveal, birthPhase: ring.birthPhase }));
  }

  buildRingInstances() {
    const count = Math.max(12, Math.floor(this.params.ringInstanceCount ?? 48));
    const scale = this.params.universeScale ?? 1;
    const density = Math.max(0.45, this.params.clusterDensity ?? 1.25);
    const clusterCount = Math.max(5, Math.min(12, Math.round(Math.sqrt(count) * 0.85)));
    const clusterRadius = (18 + 22 / density) * scale;
    const globeRadius = (58 + Math.sqrt(count) * 4.8) * scale / Math.sqrt(density);
    const clusters = [];
    for (let c = 0; c < clusterCount; c++) {
      const a = c * 2.399963229728653;
      const y = (hash(c * 12.81) - 0.5) * globeRadius * 0.82;
      const r = Math.sqrt(Math.max(0.08, 1 - Math.pow(y / Math.max(1, globeRadius), 2))) * globeRadius * (0.28 + hash(c * 7.17) * 0.62);
      clusters.push([
        Math.cos(a) * r,
        y,
        Math.sin(a) * r
      ]);
    }
    this.ringInstances = [];
    for (let i = 0; i < count; i++) {
      const family = i % 12;
      const octave = Math.floor(i / 12) - 1;
      const primary = i < 12;
      const h = hash(i * 9.17 + 1.3);
      const clusterIndex = primary ? family % clusterCount : Math.floor(hash(i * 4.61 + 2.7) * clusterCount);
      const cluster = clusters[clusterIndex];
      const localA = primary ? family / 12 * Math.PI * 2 : i * 2.399963229728653;
      const localR = (primary ? clusterRadius * 0.78 : clusterRadius * (0.24 + hash(i * 3.7) * 0.92));
      const lift = (hash(i * 5.3) - 0.5) * clusterRadius * 0.78;
      const center = [
        cluster[0] + Math.cos(localA) * localR,
        cluster[1] + lift,
        cluster[2] + Math.sin(localA) * localR * (0.74 + hash(i * 8.1) * 0.42)
      ];
      const motif = family;
      const tilt = (hash(i * 6.91) - 0.5) * 1.5;
      const eccentricity = 0.72 + hash(i * 2.19) * 0.7;
      const broken = hash(i * 11.33) > 0.82 ? 0.22 + hash(i * 13.71) * 0.36 : 0;
      const type = STRUCTURE_TYPES[(family + Math.floor(hash(i * 10.37) * 3) * 4) % STRUCTURE_TYPES.length];
      const planets = Math.floor(2 + hash(i * 15.31) * 6);
      const arms = Math.floor(2 + hash(i * 16.73) * 4);
      const birthPhase = primary
        ? 0.025 + hash(i * 18.91 + 0.4) * 0.28
        : 0.16 + hash(i * 18.91 + 0.4) * 0.78;
      this.ringInstances.push({
        index: i,
        family,
        octave,
        cluster: clusterIndex,
        baseCenter: [...center],
        center,
        velocity: [0, 0, 0],
        radius: (primary ? 7.6 : 3.8 + hash(i * 3.1) * 4.8) * scale,
        mass: primary ? 1.6 : 0.55 + hash(i * 4.7) * 0.9,
        proximity: primary ? 1 : Math.max(0.25, 0.9 - Math.floor(i / 12) * 0.045),
        motif,
        type,
        planets,
        arms,
        turbulence: hash(i * 17.43),
        tilt,
        eccentricity,
        broken,
        birthPhase,
        reveal: 0,
        wobble: 0,
        collision: 0,
        audioDrive: 0,
        bandDrive: 0,
        eventDrive: 0,
        activity: 0
      });
    }
    this.params.ringInstances = this.ringInstances.map((ring) => ({ index: ring.index, family: ring.family, octave: ring.octave, cluster: ring.cluster, center: ring.center, radius: ring.radius, activity: ring.activity, mass: ring.mass, motif: ring.motif, type: ring.type, planets: ring.planets, arms: ring.arms, turbulence: ring.turbulence, tilt: ring.tilt, eccentricity: ring.eccentricity, broken: ring.broken, collision: ring.collision, audioDrive: ring.audioDrive, reveal: ring.reveal, birthPhase: ring.birthPhase }));
  }

  updateBoard(dt) {
    dt *= this.params.simSpeed ?? 1;
    const radius = this.params.boardRadius ?? 42;
    const boundaryRadius = radius;
    this.radialBins.fill(0);
    let radiusSum = 0;
    for (let i = 0; i < this.count; i++) {
      const src = i * 12;
      const node = this.nodeForParticle(i);
      const r = Math.hypot(this.particles[src] - node.center[0], this.particles[src + 1] - node.center[1]);
      radiusSum += r;
      const bin = Math.max(0, Math.min(this.radialBins.length - 1, Math.floor((r / boundaryRadius) * this.radialBins.length)));
      this.radialBins[bin] += 1;
    }
    const avgRadius = radiusSum / Math.max(1, this.count);
    this.params.averageParticleRadius = avgRadius;
    this.params.boundaryRadius = boundaryRadius;
    const bands = this.params.audioBands ?? {};
    const sub = bands.sub ?? this.params.audioSub ?? 0;
    const bass = bands.bass ?? this.params.audioBass ?? 0;
    const lowMid = bands.lowMid ?? this.params.audioLowMid ?? 0;
    const mid = bands.mid ?? this.params.audioMid ?? 0;
    const highMid = bands.highMid ?? this.params.audioHighMid ?? 0;
    const high = bands.high ?? this.params.audioTreble ?? 0;
    const energy = this.params.audioEnergy ?? 0;
    const onset = this.params.audioOnset ?? 0;
    const impulse = this.params.audioImpulse ?? 0;
    const events = this.params.audioEvents ?? [];
    const noteEvents = this.params.noteEvents ?? [];
    const bandEvents = this.params.audioBandEvents ?? {};
    const centroid = this.params.audioCentroid ?? 0;
    const kx = 1.5 + Math.min(7, centroid / 520) + bass * 0.8 + mid * 0.6;
    const ky = 1.9 + Math.min(8, centroid / 610) + mid * 1.2 + highMid * 0.8;
    const idlePhase = this.time * 0.12;
    const phase = this.time * (0.16 + mid * 1.25 + lowMid * 0.42);
    const toneStabilize = Math.min(1, mid * 1.2 + (this.params.audioSynthetic ? 0.2 : 0));
    const activeBlend = smoothstep(0.035, 0.2, Math.max(sub, bass, lowMid, mid, highMid, high, bandEvents.broadband ?? 0));
    const seedRadius = radius * 0.055;
    const debugTargetRadius = seedRadius * (1 - activeBlend) + radius * 0.48 * activeBlend;
    const depthRadius = radius * 0.62;
    const innerRadius = radius * 0.16;
    this.params.equilibriumRadius = debugTargetRadius;
    this.params.innerRepulsionRadius = innerRadius;
    this.params.radialHistogram = Array.from(this.radialBins, (count) => Math.round((count / this.count) * 100)).join(' ');
    for (let i = 0; i < this.count; i++) {
      const src = i * 12;
      const node = this.nodeForParticle(i);
      const center = node.center;
      let x = this.particles[src] - center[0];
      let y = this.particles[src + 1] - center[1];
      let z = this.particles[src + 2] - center[2];
      let vx = this.particles[src + 4];
      let vy = this.particles[src + 5];
      let vz = this.particles[src + 6];
      const layer = i % 6;
      const layerName = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'high'][layer];
      const profileBoost = node.profile?.[layerName] ?? 1;
      const focusBoost = node.index === this.params.focusNodeIndex ? 1 + (this.params.insideBlend ?? 0) * 1.2 + (this.params.travelBlend ?? 0) * 0.45 : 1 - (this.params.insideBlend ?? 0) * 0.68;
      const layerAudio = Math.min(1, ([sub, bass, lowMid, mid, highMid, high][layer] ?? 0) * profileBoost * focusBoost);
      const layerOnset = this.params.audioBandOnsets?.[layerName] ?? 0;
      const layerEvent = bandEvents[layerName] ?? 0;
      const layerTargets = [0.12, 0.2, 0.33, 0.5, 0.68, 0.84];
      const layerDepths = [0.5, 0.28, 0.45, 0.72, 0.62, 0.88];
      const layerDrag = [0.988, 0.984, 0.978, 0.974, 0.968, 0.958][layer];
      const layerSwirl = [0.08, 0.16, 0.52, 0.75, 1.05, 1.28][layer];
      const idleStructure = [0.42, 0.36, 0.32, 0.34, 0.3, 0.26][layer];
      const layerActive = Math.max(idleStructure, smoothstep(0.02, 0.2, Math.max(layerAudio, layerOnset * 0.75, layerEvent, bandEvents.broadband * 0.45)));
      const r = Math.hypot(x, y) || 1;
      const nx = x / r;
      const ny = y / r;
      const edge = r / boundaryRadius;
      const bin = Math.max(0, Math.min(this.radialBins.length - 1, Math.floor(edge * this.radialBins.length)));
      const binDensity = this.radialBins[bin] / Math.max(1, this.count);

      const sx = Math.sin((x / radius) * Math.PI * kx + phase);
      const sy = Math.sin((y / radius) * Math.PI * ky - phase * 0.82);
      const cymatic = sx * sy;
      const gx = Math.cos((x / radius) * Math.PI * kx + phase) * sy * kx;
      const gy = sx * Math.cos((y / radius) * Math.PI * ky - phase * 0.82) * ky;
      const nodalPull = -Math.sign(cymatic || 1) * this.params.cymaticStrength * (0.26 + toneStabilize * 0.74);

      let eventRadial = 0;
      let eventSwirl = 0;
      let eventSpark = 0;
      for (const event of events) {
        const match = eventMatchesLayer(event.type, layer);
        if (match <= 0) continue;
        const wave = Math.exp(-Math.abs(r - event.radius) * (event.type === 'high' ? 0.42 : 0.18)) * event.strength;
        const age = event.age ?? 0;
        if (event.type === 'sub' || event.type === 'bass') {
          const compress = -Math.exp(-age * 4.8) * 1.4;
          const release = Math.exp(-Math.max(0, age - 0.18) * 2.2) * smoothstep(0.08, 0.38, age) * 1.8;
          eventRadial += (compress + release + wave * 0.9) * this.params.shockwaveStrength * match;
        } else if (event.type === 'broadband') {
          eventRadial += wave * 1.5 * this.params.shockwaveStrength * match;
          eventSpark += wave * 1.0 * match;
        } else if (event.type === 'high' || event.type === 'highMid') {
          eventSpark += wave * 1.7 * match;
          eventRadial += wave * 0.32 * match;
        } else if (event.type === 'mid' || event.type === 'lowMid') {
          eventSwirl += (wave * 1.3 + event.strength * Math.exp(-age * 1.4) * 0.35) * match;
        } else if (event.type === 'tone') {
          eventSwirl += event.strength * 0.25 * match;
        } else if (event.type === 'golden') {
          eventSpark += event.strength * (layer >= 4 ? 1.8 : 0.4);
        }
      }
      let notePullX = 0;
      let notePullY = 0;
      let notePullZ = 0;
      for (const note of noteEvents) {
        const influence = noteInfluence(note.structure, layer) * note.strength;
        if (influence <= 0) continue;
        const octaveScale = Math.max(0.55, Math.min(1.65, 4 / Math.max(1, note.octave)));
        const notePhase = note.phase + this.time * (0.28 + note.frequency * 0.0008);
        const target = noteTarget(note.structure, radius * octaveScale, notePhase, i);
        notePullX += (target[0] - x) * 0.006 * influence;
        notePullY += (target[1] - y) * 0.006 * influence;
        notePullZ += (target[2] - z) * 0.006 * influence;
        if (note.structure === 'golden-escape') eventSpark += influence * 1.5;
      }
      const layerTarget = radius * layerTargets[layer] * (1 + layerAudio * 0.16 + layerEvent * 0.2);
      const targetRadius = seedRadius * (1 - layerActive) + layerTarget * layerActive;
      const breathing = Math.sin(this.time * (1.2 + bass * 2.2) - r * 0.12) * (sub + bass + layerEvent) * this.params.shockwaveStrength * (layer <= 1 ? 0.28 : 0.035);
      const vortex = (0.018 + layerAudio * layerSwirl + layerEvent * layerSwirl * 0.8 + eventSwirl) * this.params.vortexStrength;
      const curl = Math.sin(y * 0.11 + idlePhase) * Math.cos(x * 0.09 - idlePhase * 0.7);
      const radialSpring = (targetRadius - r) * (0.035 + layerAudio * 0.028 + layerEvent * 0.025);
      const innerRepel = r < innerRadius ? (innerRadius - r) * 0.13 : 0;
      const edgeZone = Math.max(0, edge - 0.72);
      const boundarySpring = -edgeZone * edgeZone * 7.5;
      const crowdedEdge = edge > 0.74 ? -Math.max(0, binDensity - 0.095) * 24 : 0;
      const returnLane = edge > 0.62 ? smoothstep(0.62, 1.08, edge) * (0.12 + layerAudio * 0.18 + layerEvent * 0.18 + high * 0.06) : 0;
      const laneSign = Math.sin(Math.atan2(y, x) * 6 + this.time * 0.35) > 0 ? 1 : -1;
      const tangentX = -ny * laneSign;
      const tangentY = nx * laneSign;
      const angle = Math.atan2(y, x);
      const zTargets = [
        Math.sin(this.time * 0.9 + i * 0.01) * depthRadius * 0.34,
        Math.sin(angle * 2 + this.time * 0.5) * depthRadius * 0.18,
        Math.sin(angle * 3.2 + r * 0.08 - this.time * 0.7) * depthRadius * 0.38,
        Math.sin(angle * 1.5 + y * 0.06 + this.time * 0.55) * depthRadius * 0.58,
        Math.sin(angle * 4.0 + i * 0.017) * depthRadius * 0.48,
        Math.sin(angle * 5.0 + this.time * 1.8 + i * 0.03) * depthRadius * 0.72
      ];
      const zTarget = zTargets[layer] * (0.35 + layerActive * 0.65 + layerEvent * 0.35 + (this.params.insideBlend ?? 0) * (node.index === this.params.focusNodeIndex ? 0.75 : 0.1));

      let radialForce = breathing + eventRadial + radialSpring + innerRepel + boundarySpring + crowdedEdge;
      const verticalLayer = layer === 3 ? 1.0 : layer === 4 ? 0.55 : 0.18;
      let ax = gx * nodalPull * 0.03 * layerActive + nx * radialForce + (-ny) * vortex * 0.38 + curl * (0.018 + layerAudio * 0.045) + tangentX * returnLane - nx * returnLane * 0.42 + notePullX;
      let ay = gy * nodalPull * 0.03 * layerActive + ny * radialForce + nx * vortex * 0.38 + Math.sin(x * 0.1 + idlePhase) * (0.018 + layerAudio * 0.045) + tangentY * returnLane - ny * returnLane * 0.42 + notePullY;
      let az = ((zTarget - z) * (0.22 + layerDepths[layer] * 0.18) + cymatic * (0.22 + toneStabilize * 2.7) * layerActive + (high + highMid + eventSpark) * Math.sin((x + y + z) * 0.25 + this.time * 9) * 0.9 * (layer >= 4 ? 1 : 0.25)) * 0.08 + notePullZ;
      const bridge = this.bridgeForNode(node.index);
      if (bridge && bridge.strength > 0.01 && layer >= 2) {
        const other = this.nodeByIndex(bridge.to);
        if (other) {
          const tx = other.center[0] - center[0];
          const ty = other.center[1] - center[1];
          const tz = other.center[2] - center[2];
          const layerBridge = bridge.strength * (layer === 5 ? 1.4 : layer === 4 ? 1.15 : 0.8) * (1 + (this.params.travelBlend ?? 0) * 1.4);
          ax += (tx * 0.5 - x) * 0.006 * layerBridge * (this.params.particleExchange ?? 0.8);
          ay += (ty * 0.5 - y) * 0.006 * layerBridge * (this.params.particleExchange ?? 0.8);
          az += (tz * 0.5 - z) * 0.006 * layerBridge * (this.params.particleExchange ?? 0.8);
          eventSpark += bridge.spark * (layer >= 4 ? 0.8 : 0.25);
        }
      }

      // Soft density and board edge constraints keep probes continuous instead of respawning.
      if (r > boundaryRadius * 0.82) {
        const tangentVelocity = vx * (-ny) + vy * nx;
        vx = vx * 0.93 + (-ny) * tangentVelocity * 0.04;
        vy = vy * 0.93 + nx * tangentVelocity * 0.04;
      }
      if (r > boundaryRadius) {
        ax += -nx * (r - boundaryRadius) * 0.65;
        ay += -ny * (r - boundaryRadius) * 0.65;
      }
      const world = [x + center[0], y + center[1], z + center[2]];
      const torus = torusForce(world, this.params, this.params.goldenEscape ?? 0);
      ax += torus[0];
      ay += torus[1];
      az += torus[2];
      const drag = layerDrag - Math.min(0.08, layerAudio * 0.035 + layerOnset * 0.035 + layerEvent * 0.025 + eventSpark * 0.025 + edgeZone * 0.055);
      vx = vx * drag + ax * dt * this.params.fieldStrength * 18;
      vy = vy * drag + ay * dt * this.params.fieldStrength * 18;
      vz = vz * 0.94 + az * dt * 16;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;

      if (Math.abs(x) > radius * 1.45 || Math.abs(y) > radius * 1.45 || Math.abs(z) > depthRadius * 1.6) {
        const p = this.spawnBoard(i);
        x = p[0] - center[0];
        y = p[1] - center[1];
        z = p[2] - center[2];
        vx *= 0.15;
        vy *= 0.15;
        vz *= 0.15;
        this.particles[src + 7] = 0;
      }

      this.particles[src] = x + center[0];
      this.particles[src + 1] = y + center[1];
      this.particles[src + 2] = z + center[2];
      this.particles[src + 3] = 1;
      this.particles[src + 4] = vx;
      this.particles[src + 5] = vy;
      this.particles[src + 6] = vz;
      const edgeGlow = smoothstep(0.78, 1.05, edge) * Math.max(0, -boundarySpring) * 0.04;
      const idleVisibility = layer <= 1 ? 0.16 : 0.035;
      const localFade = node.index === this.params.focusNodeIndex ? 1 + (this.params.insideBlend ?? 0) * 1.1 + (this.params.travelBlend ?? 0) * 0.35 : 1 - (this.params.insideBlend ?? 0) * 0.7;
      const brightness = localFade * (idleVisibility * (1 - layerActive) + layerActive * (0.1 + Math.abs(cymatic) * (0.14 + toneStabilize * 0.22) + layerAudio * 0.5 + layerEvent * 0.38 + eventSpark * 0.42 + edgeGlow + torus[3] * 0.22 + Math.min(0.3, Math.hypot(vx, vy, vz) * 0.025)));
      this.particles[src + 7] += (Math.min(1, brightness) - this.particles[src + 7]) * (1 - Math.pow(0.02, dt));
    }
  }

  spawnPianoParticle(seed) {
    const family = Math.abs(Math.floor(seed)) % 12;
    const ring = this.ringInstances?.[this.particleRingIndices?.[Math.abs(Math.floor(seed))] ?? 0];
    if (ring && this.params.noteLayout !== 'three-tori') {
      const stringIndex = Math.floor(Math.abs(seed) / 12);
      const stringT = (stringIndex % 4096) / 4096;
      const strand = Math.floor(hash(seed * 4.13 + 9.2) * 5);
      const theta = stringT * Math.PI * 2 + strand * 0.035;
      const tubePhase = stringT * Math.PI * 2 * (1 + (family % 3)) + strand * 0.4;
      const localR = ring.radius;
      const tube = Math.max(1.2, ring.radius * 0.32);
      const q = localR + Math.cos(tubePhase) * tube;
      return [
        ring.center[0] + Math.cos(theta) * q,
        ring.center[1] + Math.sin(tubePhase) * tube,
        ring.center[2] + Math.sin(theta) * q
      ];
    }
    const u = hash(seed * 1.17);
    const v = hash(seed * 2.31 + 5.7);
    const w = hash(seed * 4.13 + 9.2);
    const stringIndex = Math.floor(Math.abs(seed) / 12);
    const stringT = (stringIndex % 4096) / 4096;
    const R = this.params.torusMajorRadius ?? this.params.boardRadius ?? 46;
    const tube = this.params.torusMinorRadius ?? 15;
    if (this.params.noteLayout === 'three-tori') {
      const band = family <= 3 ? 0 : family <= 7 ? 1 : 2;
      const centers = [[-30, -10, -8], [0, 12, 8], [30, -6, -10]];
      const tilts = [0.8, -0.15, -0.9];
      const localR = R * [0.58, 0.68, 0.54][band];
      const localTube = tube * [0.7, 0.78, 0.62][band];
      const localIndex = band === 0 ? family : band === 1 ? family - 4 : family - 8;
      const theta = localIndex / 4 * Math.PI * 2 + (stringT - 0.5) * 0.75 + (u - 0.5) * 0.02;
      const tubePhase = stringT * Math.PI * 2 * (1 + (family % 2)) + Math.floor(w * 5) * 0.42;
      const q = localR + Math.cos(tubePhase) * localTube;
      const lx = Math.cos(theta) * q;
      const ly = Math.sin(tubePhase) * localTube;
      const lz = Math.sin(theta) * q;
      const tilt = tilts[band];
      const cy = Math.cos(tilt);
      const sy = Math.sin(tilt);
      return [
        centers[band][0] + lx * cy + lz * sy,
        centers[band][1] + ly,
        centers[band][2] - lx * sy + lz * cy
      ];
    }
    const familyAngle = family / 12 * Math.PI * 2;
    const arcSpread = 0.18 + (family % 4) * 0.014;
    const theta = familyAngle + (stringT - 0.5) * arcSpread + (u - 0.5) * 0.008;
    const strand = Math.floor(w * 5);
    const tubePhase = stringT * Math.PI * 2 * (1 + (family % 3)) + strand * 0.34 + Math.sin(familyAngle * 3) * 0.35;
    const standing = 0.62 + 0.32 * Math.sin((stringT * 4 + family * 0.5) * Math.PI);
    const rr = tube * (0.32 + Math.abs(standing) * 0.48 + strand * 0.025);
    const q = R + Math.cos(tubePhase) * rr;
    return [
      Math.cos(theta) * q,
      Math.sin(tubePhase) * rr,
      Math.sin(theta) * q
    ];
  }

  spawnBoard(seed) {
    const u = hash(seed * 1.17);
    const v = hash(seed * 2.31 + 5.7);
    const mode = Math.floor(hash(seed * 7.13) * 5);
    const radius = this.params.boardRadius ?? 42;
    const node = this.nodeForParticle(seed);
    const center = node.center;
    const nodeScale = node.size ?? 1;
    let a = u * Math.PI * 2;
    let r = Math.sqrt(v) * radius * 0.9;
    let z = (hash(seed * 4.1) - 0.5) * radius * 0.52;
    const layer = Math.abs(Math.floor(seed)) % 6;
    if (mode === 1) {
      const ring = 0.22 + Math.floor(hash(seed * 9.3) * 5) * 0.13;
      r = radius * ring + (hash(seed * 10.1) - 0.5) * 1.2;
      z = Math.sin(a * 2 + seed) * radius * 0.14;
    } else if (mode === 2) {
      r = radius * (0.12 + v * 0.74);
      a = r * 0.22 + u * 0.8;
      z = Math.sin(r * 0.28 + a) * radius * 0.32;
    } else if (mode === 3) {
      r = radius * (0.18 + v * 0.68);
      a = Math.round(u * 10) / 10 * Math.PI * 2 + (hash(seed * 11.4) - 0.5) * 0.08;
      z = (hash(seed * 12.8) - 0.5) * radius * 0.72;
    } else if (mode === 4) {
      r = radius * (0.18 + Math.pow(v, 0.35) * 0.58);
      a = u * Math.PI * 2;
      z = (hash(seed * 14.2) - 0.5) * radius * 0.9;
    }
    if (layer === 0) {
      r *= 0.32;
      z = (hash(seed * 16.2) - 0.5) * radius * 0.9;
    } else if (layer === 1) {
      r = radius * (0.16 + v * 0.12);
      z = Math.sin(a * 2) * radius * 0.12;
    } else if (layer === 5) {
      r = radius * (0.68 + v * 0.22);
      z = (hash(seed * 17.9) - 0.5) * radius * 0.95;
    }
    return [center[0] + Math.cos(a) * r * nodeScale, center[1] + Math.sin(a) * r * nodeScale, center[2] + z * nodeScale];
  }

  nodeForParticle(index) {
    const nodes = this.params.nebulaNodes?.length ? this.params.nebulaNodes : [{ index: 0, center: [0, 0, 0], size: 1, profile: {} }];
    const nodeIndex = Math.floor(Math.abs(index) / 6) % nodes.length;
    return nodes[nodeIndex] ?? nodes[0];
  }

  nodeByIndex(index) {
    return (this.params.nebulaNodes ?? []).find((node) => node.index === index);
  }

  bridgeForNode(index) {
    return (this.params.nebulaBridges ?? []).find((bridge) => bridge.from === index);
  }

  spawnAhead(seed, cameraPosition) {
    const u = hash(seed * 1.17);
    const v = hash(seed * 2.31 + 4.1);
    const w = hash(seed * 3.97 + 8.3);
    const depth = 10 + w * this.params.recycleRadius * 1.35;
    const angle = u * Math.PI * 2;
    const lane = Math.pow(v, 0.62);
    const tightness = this.params.tunnelTightness ?? 1;
    const radius = (1.2 + depth * 0.2) * lane / tightness;
    const twist = depth * 0.035;
    return [
      cameraPosition.x + Math.cos(angle + twist) * radius,
      cameraPosition.y + Math.sin(angle + twist) * radius * 0.72,
      cameraPosition.z - depth
    ];
  }

  corridorFlow(x, y, depth, seed) {
    const r = Math.hypot(x, y) || 1;
    const speedMultiplier = this.params.speedMultiplier ?? 1;
    const swirl = 0.78 + 0.24 * Math.sin(depth * 0.035 + seed * 0.001) + Math.log2(Math.max(1, speedMultiplier)) * 0.12;
    const centerPull = Math.min(0.56, r * 0.012 * (this.params.tunnelTightness ?? 1));
    const axial = 0.28 + Math.min(0.75, depth * 0.0035 + Math.log2(Math.max(1, speedMultiplier)) * 0.08);
    return [
      (-y / r) * swirl - (x / r) * centerPull,
      (x / r) * swirl - (y / r) * centerPull,
      axial
    ];
  }
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function noteBehaviorForce(family, state) {
  const {
    x, y, z, vx, vy, vz, rx, ry, rz, active, neighbor, impulse, seedA, seedB, time,
    tangent, tubeNormal, torusNormal, familyPhase, R, tube, instrument, chordType
  } = state;
  const phase = time * (1.2 + family * 0.11) + seedA * Math.PI * 2;
  const rdx = x - rx;
  const rdy = y - ry;
  const rdz = z - rz;
  const localR = Math.hypot(rdx, rdy, rdz) || 1;
  const radial = [rdx / localR, rdy / localR, rdz / localR];
  const tangentialSign = seedB > 0.5 ? 1 : -1;
  const shimmer = instrument.shimmer * (active + neighbor * 0.4);
  const scatter = instrument.scatter * active;
  const align = instrument.align * (active + neighbor);
  let ax = 0;
  let ay = 0;
  let az = 0;

  if (family === 0) {
    const gravity = Math.sin(phase) * impulse * 2.8;
    ax += tubeNormal[0] * gravity - radial[0] * active * 3.2;
    ay += tubeNormal[1] * gravity - radial[1] * active * 3.2;
    az += tubeNormal[2] * gravity - radial[2] * active * 3.2;
  } else if (family === 1) {
    const bounce = Math.sign(Math.sin(phase * 3.0)) * scatter * 6.5;
    ax += radial[0] * bounce + tangent[0] * impulse * 1.6;
    ay += radial[1] * bounce;
    az += radial[2] * bounce + tangent[2] * impulse * 1.6;
  } else if (family === 2) {
    const chain = Math.sin(seedA * Math.PI * 12 + time * 2.4) * impulse;
    ax += tangent[0] * (2.8 + chain) + tubeNormal[0] * align * 2.2;
    ay += tubeNormal[1] * align * 2.2;
    az += tangent[2] * (2.8 + chain) + tubeNormal[2] * align * 2.2;
  } else if (family === 3) {
    const jump = Math.pow(Math.max(0, Math.sin(phase * 5.0)), 8) * (5 + shimmer * 5);
    ay += jump;
    ax += tangent[0] * jump * tangentialSign;
    az += tangent[2] * jump * tangentialSign;
  } else if (family === 4) {
    ay += (4.5 + Math.sin(phase * 2) * 1.5) * impulse;
    ax += -tangent[0] * active * 1.2;
    az += -tangent[2] * active * 1.2;
  } else if (family === 5) {
    const swirl = (2.2 + shimmer * 3.2) * tangentialSign;
    ax += tangent[0] * swirl + tubeNormal[0] * Math.sin(phase) * impulse * 1.4;
    ay += Math.cos(phase * 0.7) * impulse * 0.9;
    az += tangent[2] * swirl + tubeNormal[2] * Math.sin(phase) * impulse * 1.4;
  } else if (family === 6) {
    const snap = Math.sign(Math.sin(seedA * Math.PI * 10 + time * 1.8)) * impulse * 4.4;
    ax += torusNormal[0] * snap;
    ay += Math.sign(Math.sin(phase * 2.0)) * impulse * 2.4;
    az += torusNormal[2] * snap;
  } else if (family === 7) {
    const loop = Math.sin(phase + seedA * Math.PI * 4) * impulse * 3.6;
    ax += tangent[0] * loop + tubeNormal[0] * align * 3.1;
    ay += Math.sin(phase * 0.5) * impulse * 4.4;
    az += tangent[2] * loop + tubeNormal[2] * align * 3.1;
  } else if (family === 8) {
    const outward = Math.sin(seedA * Math.PI) * impulse * 4.6;
    ax += radial[0] * outward - (x - rx) * active * 0.35;
    ay += radial[1] * outward - (y - ry) * active * 0.35;
    az += radial[2] * outward - (z - rz) * active * 0.35;
  } else if (family === 9) {
    const launch = Math.pow(Math.max(0, Math.sin(phase * 1.7)), 3) * impulse * 7.0;
    ax += tangent[0] * launch;
    ay += tubeNormal[1] * launch * 0.5;
    az += tangent[2] * launch;
  } else if (family === 10) {
    const orbit = (seedB > 0.5 ? 1 : -1) * impulse * 3.8;
    ax += tangent[0] * orbit;
    ay += Math.sin(phase) * impulse * 2.4;
    az += tangent[2] * orbit;
  } else {
    const escape = active > 0.72 && hash(seedA * 999 + Math.floor(time * 3)) > 0.985 ? 12 : 0;
    const golden = 2.399963229728653;
    ax += Math.cos(seedA * Math.PI * 16 + golden) * impulse * 1.6 + radial[0] * escape;
    ay += Math.sin(phase * 1.3) * impulse * 3.2 + escape * 0.35;
    az += Math.sin(seedA * Math.PI * 16 + golden) * impulse * 1.6 + radial[2] * escape;
  }

  if (chordType === 'major' || chordType === 'fifth') {
    ax += tangent[0] * active * 1.8;
    az += tangent[2] * active * 1.8;
  } else if (chordType === 'minor') {
    ax -= torusNormal[0] * active * 1.6;
    az -= torusNormal[2] * active * 1.6;
  } else if (chordType === 'dissonant' || chordType === 'cluster') {
    ax += (hash(seedA * 41.7 + time) - 0.5) * scatter * 4.0;
    ay += (hash(seedA * 53.1 + time) - 0.5) * scatter * 4.0;
    az += (hash(seedA * 67.9 + time) - 0.5) * scatter * 4.0;
  }
  return [ax, ay, az];
}

function harmonicTransferTarget(family, activations, active, seedA, seedB, centers, chordType, transferAmount = 0.55) {
  if (active < 0.45 && chordType !== 'major' && chordType !== 'fifth') return null;
  const candidates = [
    { index: (family + 7) % 12, weight: 0.9 },
    { index: (family + 5) % 12, weight: 0.65 },
    { index: (family + 1) % 12, weight: chordType === 'dissonant' ? 0.8 : 0.18 },
    { index: (family + 11) % 12, weight: chordType === 'dissonant' ? 0.8 : 0.18 }
  ];
  let best = null;
  for (const candidate of candidates) {
    const value = (activations[candidate.index] ?? 0) * candidate.weight;
    if (!best || value > best.value) best = { ...candidate, value };
  }
  const strikeTransfer = active > 0.76 && seedB > 0.78 ? active * 0.08 * transferAmount : 0;
  const chordTransfer = best?.value > 0.08 && seedB > 0.55 ? best.value * 0.06 * transferAmount : 0;
  const strength = strikeTransfer + chordTransfer;
  if (!best || strength <= 0) return null;
  const center = centers[best.index];
  if (!center || center[3] <= 0) return null;
  return [center[0], center[1], center[2], strength];
}

function nearestCompatibleRing(currentIndex, currentRing, rings, activations, seedA) {
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < rings.length; i++) {
    if (i === currentIndex) continue;
    const ring = rings[i];
    const dx = ring.center[0] - currentRing.center[0];
    const dy = ring.center[1] - currentRing.center[1];
    const dz = ring.center[2] - currentRing.center[2];
    const d = Math.hypot(dx, dy, dz) || 1;
    const interval = (ring.family - currentRing.family + 12) % 12;
    const harmonic = interval === 0 ? 1 : interval === 7 || interval === 5 ? 0.75 : interval === 1 || interval === 11 ? 0.22 : 0.36;
    const score = harmonic * (0.25 + (activations[ring.family] ?? 0)) / (1 + d * 0.035) + hash(seedA * 13.1 + i) * 0.02;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return bestScore > 0.045 ? best : -1;
}

function songObjectParticleTarget(object, seedA, seedB, family, time) {
  const center = object?.position ?? [0, 0, 0];
  const scale = Math.max(2, object?.scale ?? 6);
  const phase = (object?.phase ?? 0) + seedA * Math.PI * 2;
  const mature = smoothstep(4, 18, object?.age ?? 0);
  const motionTime = time * (1 - mature * 0.72);
  const tilt = (object?.variant ?? 0.5) * 1.7 + family * 0.09;
  const cy = Math.cos(tilt);
  const sy = Math.sin(tilt);
  const local = (x, y, z) => [
    center[0] + x * cy - z * sy,
    center[1] + y,
    center[2] + x * sy + z * cy
  ];
  const kind = object?.kind ?? 'star-cluster';
  const golden = 2.399963229728653;
  const h = seedA;
  const k = seedB;
  if (kind === 'gravity-well') {
    const a = phase + motionTime * (0.08 + (object.energy ?? 0) * 0.06);
    const r = scale * (0.28 + h * 0.86);
    return [...local(Math.cos(a) * r * 1.6, (k - 0.5) * scale * 0.22, Math.sin(a) * r * 0.58), scale * 0.72];
  }
  if (kind === 'spiral-arm' || kind === 'section-region') {
    const arm = Math.floor(k * 4);
    const t = h;
    const a = phase + arm * Math.PI * 0.5 + t * Math.PI * (2.8 + (object.variant ?? 0) * 2.2) + motionTime * 0.035;
    const r = scale * (0.15 + t * 1.25);
    return [...local(Math.cos(a) * r, Math.sin(t * Math.PI * 2 + phase) * scale * 0.18, Math.sin(a) * r * 0.62), scale * 0.64];
  }
  if (kind === 'nebula-veil' || kind === 'filament-web') {
    const y = (h - 0.5) * scale * 1.65;
    const a = phase + k * Math.PI * 2 + motionTime * 0.045;
    return [...local(Math.sin(y * 0.23 + a) * scale * (0.22 + k * 0.28), y, Math.cos(y * 0.17 + a) * scale * 0.46), scale * 0.78];
  }
  if (kind === 'spark-stream' || kind === 'crystal-shards') {
    const a = phase + Math.floor(h * 10) * golden + motionTime * (0.18 + (object.pulse ?? 0) * 0.35);
    const r = scale * (0.42 + k * (0.64 - mature * 0.18));
    return [...local(Math.cos(a) * r, (h - 0.5) * scale * 0.9, Math.sin(a) * r), scale * 0.42];
  }
  if (kind === 'rocky-planet' || kind === 'moon-system' || kind === 'asteroid-field') {
    const belt = kind === 'asteroid-field';
    const a = phase + Math.floor(h * (belt ? 18 : 7)) * golden + motionTime * (belt ? 0.09 : 0.035);
    const shell = belt ? 0.72 + k * 0.72 : 0.18 + Math.sqrt(k) * 0.42;
    const r = scale * shell;
    const wobble = Math.sin(a * 2.3 + h * 9.1) * scale * (belt ? 0.22 : 0.08);
    return [...local(Math.cos(a) * r, wobble + (h - 0.5) * scale * (belt ? 0.42 : 0.18), Math.sin(a) * r * (belt ? 0.72 : 0.44)), scale * (belt ? 0.36 : 0.46)];
  }
  if (kind === 'supernova-bloom') {
    const a = phase + h * Math.PI * 2;
    const b = Math.acos(2 * k - 1);
    const r = scale * (0.25 + h * 0.92);
    return [...local(Math.cos(a) * Math.sin(b) * r, Math.cos(b) * r, Math.sin(a) * Math.sin(b) * r), scale * 0.86];
  }
  if (kind === 'comet-river') {
    const t = h;
    const a = phase + t * Math.PI * 5.2 + motionTime * 0.11;
    const r = scale * (0.2 + t * 1.25);
    return [...local(Math.cos(a) * r, (t - 0.5) * scale * 1.2, Math.sin(a) * r * 0.52), scale * 0.48];
  }
  const a = phase + h * Math.PI * 2 + time * 0.025;
  const r = scale * (0.12 + Math.sqrt(k) * 0.82);
  return [...local(Math.cos(a) * r, (hash(h * 41.7 + family) - 0.5) * scale * 0.45, Math.sin(a) * r * (0.55 + h * 0.25)), scale * 0.58];
}

function restShellForce(p, rest, tube) {
  const dx = p[0] - rest[0];
  const dy = p[1] - rest[1];
  const dz = p[2] - rest[2];
  const d = Math.hypot(dx, dy, dz) || 1;
  const limit = tube * 0.9;
  const excess = Math.max(0, d - limit);
  const pull = -excess * 0.035;
  return [dx / d * pull, dy / d * pull, dz / d * pull, Math.min(1, excess / Math.max(1, limit))];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function eventMatchesLayer(type, layer) {
  if (type === 'broadband') return 1;
  if (type === 'tone') return layer >= 2 && layer <= 4 ? 1 : 0.25;
  const map = { sub: 0, bass: 1, lowMid: 2, mid: 3, highMid: 4, high: 5 };
  const target = map[type];
  if (target === undefined) return 0;
  const distance = Math.abs(layer - target);
  return distance === 0 ? 1 : distance === 1 ? 0.32 : 0;
}

function torusForce(p, params, escape = 0) {
  const R = params.torusMajorRadius ?? 54;
  const r = params.torusMinorRadius ?? 23;
  const strength = params.torusStrength ?? 1.1;
  const q = Math.hypot(p[0], p[2]) || 0.0001;
  const tubeX = p[0] / q * R;
  const tubeZ = p[2] / q * R;
  const dx = p[0] - tubeX;
  const dy = p[1];
  const dz = p[2] - tubeZ;
  const dist = Math.hypot(dx, dy, dz) || 0.0001;
  const surfaceError = dist - r;
  const manifoldPull = -surfaceError * 0.028 * strength * (1 - escape * 0.22);
  const wall = Math.max(0, Math.abs(surfaceError) - r * 0.18);
  const wallForce = -Math.sign(surfaceError) * wall * wall * 0.0025 * strength;
  const tangent = [-p[2] / q, 0, p[0] / q];
  const circulation = 0.018 * strength * (1 + (params.audioLowMid ?? 0) * 2.2);
  const golden = escape > 0.02 ? escape * 0.09 : 0;
  const phi = 1.61803398875;
  return [
    dx / dist * (manifoldPull + wallForce) + tangent[0] * circulation + Math.sin(p[1] * 0.03 + phi) * golden,
    dy / dist * (manifoldPull + wallForce) + Math.sin(q * 0.05) * circulation * 0.35 + Math.cos(q * 0.02 * phi) * golden,
    dz / dist * (manifoldPull + wallForce) + tangent[2] * circulation + Math.cos(p[1] * 0.03 + phi) * golden,
    Math.min(1, Math.abs(surfaceError) / Math.max(1, r))
  ];
}

function noteInfluence(structure, layer) {
  const map = {
    'central-gravity': [1.4, 1.0, 0.35, 0.25, 0.2, 0.15],
    'ribbon-orbit': [0.2, 0.45, 1.1, 1.25, 0.35, 0.2],
    'crystal-shard': [0.1, 0.22, 0.35, 0.55, 1.35, 0.7],
    'nebula-bloom': [0.45, 0.55, 0.7, 0.85, 0.9, 0.75],
    'spiral-arm': [0.2, 0.65, 1.35, 0.65, 0.35, 0.22],
    'spark-belt': [0.08, 0.15, 0.25, 0.4, 0.85, 1.45],
    'golden-escape': [0.05, 0.08, 0.16, 0.3, 1.0, 1.55]
  };
  return (map[structure] ?? map['central-gravity'])[layer] ?? 0;
}

function noteTarget(structure, radius, phase, seed) {
  const h = hash(seed * 3.71);
  const a = phase + h * Math.PI * 2;
  const phi = 1.61803398875;
  if (structure === 'central-gravity') {
    const rr = radius * (0.12 + h * 0.18);
    return [Math.cos(a) * rr, Math.sin(a * 2) * radius * 0.08, Math.sin(a) * rr];
  }
  if (structure === 'ribbon-orbit') {
    const t = h;
    const rr = radius * (0.32 + t * 0.2);
    return [Math.cos(a) * rr, Math.sin(t * Math.PI * 2 + phase) * radius * 0.28, Math.sin(a) * rr];
  }
  if (structure === 'crystal-shard') {
    const rr = radius * (0.45 + h * 0.35);
    return [Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) * rr, Math.sign(Math.sin(a * 1.7)) * radius * 0.35, Math.sin(a) * rr];
  }
  if (structure === 'nebula-bloom') {
    const petals = 7;
    const petal = Math.floor(h * petals);
    const aa = phase + petal / petals * Math.PI * 2;
    const rr = radius * (0.22 + Math.sin(h * Math.PI) * 0.58);
    return [Math.cos(aa) * rr, Math.sin(h * Math.PI * 2) * radius * 0.34, Math.sin(aa) * rr];
  }
  if (structure === 'spiral-arm') {
    const rr = radius * (0.16 + h * 0.72);
    const aa = phase + rr * 0.08;
    return [Math.cos(aa) * rr, Math.sin(rr * 0.05 + phase) * radius * 0.2, Math.sin(aa) * rr];
  }
  if (structure === 'spark-belt') {
    const rr = radius * (0.72 + h * 0.2);
    return [Math.cos(a) * rr, Math.sin(a * 3 + phase) * radius * 0.38, Math.sin(a) * rr];
  }
  const rr = radius * (0.78 + h * 0.55);
  const goldenA = seed * 2.399963 + phase * phi;
  return [Math.cos(goldenA) * rr, (h - 0.5) * radius * 1.1, Math.sin(goldenA) * rr];
}

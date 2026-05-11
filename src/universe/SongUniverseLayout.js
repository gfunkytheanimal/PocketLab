const NOTE_COLORS = [
  [0.28, 0.55, 1.55],
  [0.15, 1.2, 1.55],
  [0.25, 1.25, 0.62],
  [0.7, 1.55, 0.3],
  [1.55, 1.08, 0.25],
  [1.55, 0.58, 0.22],
  [1.5, 0.22, 0.22],
  [1.35, 0.3, 1.45],
  [0.72, 0.42, 1.65],
  [1.35, 1.48, 1.62],
  [0.22, 1.4, 1.12],
  [1.65, 1.28, 0.34]
];

export class SongUniverseLayout {
  constructor(params, seedValue = 1) {
    this.params = params;
    this.seedValue = seedValue;
    this.objects = [];
    this.processedEvents = new Set();
    this.processedNotes = new Set();
    this.energyAccum = 0;
    this.lastObjectTime = -10;
    this.lastConsolidationTime = -10;
    this.nextId = 1;
    this.section = 0;
    this.lastDominant = 'none';
    this.originObjectId = null;
    this.familyUnlock = Array(12).fill(0);
    this.lastImpactTime = -10;
    this.manualExcitations = 0;
  }

  reset() {
    this.objects = [];
    this.processedEvents.clear();
    this.processedNotes.clear();
    this.energyAccum = 0;
    this.lastObjectTime = -10;
    this.lastConsolidationTime = -10;
    this.nextId = 1;
    this.section = 0;
    this.lastDominant = 'none';
    this.originObjectId = null;
    this.familyUnlock.fill(0);
    this.lastImpactTime = -10;
    this.manualExcitations = 0;
    if (this.params.prebuiltUniverseOnStart && this.params.primaryMode === 'piano') this.seedPrebuiltUniverse(0);
    this.writeParams();
  }

  update(dt, time) {
    if (!this.params.almightyWaveformMode || this.params.appMode !== 'sound-board') {
      this.writeParams();
      return;
    }
    if (this.params.prebuiltUniverseOnStart && this.params.primaryMode === 'piano' && this.objects.length === 0) {
      this.seedPrebuiltUniverse(time);
    }

    const energy = this.params.audioEnergy ?? 0;
    const onset = this.params.audioOnset ?? 0;
    const bands = this.params.audioBands ?? {};
    const bandEvents = this.params.audioBandEvents ?? {};
    const eventPressure = Object.values(bandEvents).reduce((sum, value) => sum + Math.max(0, value ?? 0), 0);
    const excitation = energy + onset + eventPressure + (this.params.noteEvents?.length ? 0.5 : 0);
    if (this.objects.length > 0 || excitation > 0.018) {
      this.energyAccum += dt * ((this.objects.length > 0 ? 0.42 : 0) + energy * 8.5 + onset * 6.5 + eventPressure * 2.2);
    }
    const fastGrowth = 1 - Math.exp(-this.energyAccum * 0.16);
    if (this.params.primaryMode === 'demo') this.params.demoBuildProgress = Math.max(this.params.demoBuildProgress ?? 0, fastGrowth);

    if (this.params.originEstablished && !this.objects.some((object) => object.kind === 'origin-star')) {
      this.spawn('origin-star', this.params.originFamily ?? 0, 1, time, { radius: 0, angle: this.params.originPhase ?? 0 });
    }

    for (const note of this.params.noteEvents ?? []) {
      const key = `n:${Math.round((note.phase ?? 0) * 1000)}:${note.note}:${note.octave ?? 4}`;
      if (this.processedNotes.has(key)) continue;
      this.processedNotes.add(key);
      const family = noteNameToFamily(note.note);
      this.unlockFamily(family, note.strength ?? 0.4);
      const kind = noteKind(note.structure, note.strength ?? 0.4, family, this.manualExcitations + this.objects.length);
      this.ensureOrigin(family, note.strength ?? 0.4, time);
      if (this.params.primaryMode === 'piano') {
        this.manualExcitations += 1;
        this.params.jamExcitationCount = this.manualExcitations;
        if (this.manualExcitations === 1 && !this.objects.some((object) => object.prebuilt)) continue;
      }
      this.spawn(kind, family, note.strength ?? 0.4, time, { band: note.structure });
      if (this.params.primaryMode === 'piano') {
        this.fillJamGrowth(family, kind, note.strength ?? 0.4, time, note.structure);
      }
    }

    for (const event of this.params.audioEvents ?? []) {
      const key = `e:${event.type}:${Math.round((event.phase ?? 0) * 1000)}`;
      if (this.processedEvents.has(key)) continue;
      this.processedEvents.add(key);
      const family = dominantFamily(this.params);
      this.unlockFamily(family, event.strength ?? 0.35);
      this.ensureOrigin(family, event.strength ?? 0.35, time);
      this.spawn(eventKind(event.type), family, event.strength ?? 0.35, time, { band: event.type });
    }

    const dominant = this.params.audioDominantBand ?? 'none';
    if (dominant !== this.lastDominant && energy > 0.16) {
      this.section += 1;
      this.lastDominant = dominant;
      const family = dominantFamily(this.params);
      this.ensureOrigin(family, Math.min(1, energy + 0.2), time);
      this.spawn('section-region', family, Math.min(1, energy + 0.2), time, { band: dominant, section: this.section });
    }

    if (time - this.lastObjectTime > 0.32 && energy > 0.045) {
      const kind = ambientKind(bands, this.params.songMemory);
      const family = dominantFamily(this.params);
      this.ensureOrigin(family, Math.min(0.7, energy + 0.08), time);
      this.spawn(kind, family, Math.min(0.7, energy + 0.08), time, { band: dominant });
    }

    const allowAutoConsolidation = this.params.primaryMode !== 'piano' || this.manualExcitations >= 5;
    if (allowAutoConsolidation && time - this.lastConsolidationTime > 2.2 && this.objects.length > 8 && (energy > 0.03 || this.params.primaryMode === 'demo')) {
      const kind = settledKind(this.params.songMemory, bands, this.objects.length);
      this.spawn(kind, dominantFamily(this.params), Math.min(0.62, 0.22 + energy * 0.7), time, { band: 'memory', settled: true });
      this.lastConsolidationTime = time;
    }

    for (const object of this.objects) {
      object.age = time - object.createdAt;
      this.updateCausalPosition(object, dt, energy);
      const bandDrive = objectBandDrive(object, bands, bandEvents, onset);
      const noteDrive = noteObjectDrive(object, this.params.noteFamilyActivation ?? []);
      const totalDrive = Math.max(bandDrive, noteDrive);
      const memoryFloor = Math.min(0.62, (object.memory ?? 0) * 0.46 + object.strength * 0.16 + (object.settled ? 0.24 : 0.08));
      const cooling = object.kind === 'spark-stream' || object.kind === 'shock-shell' || object.kind === 'supernova-bloom' ? 0.982 : 0.996;
      object.energy = Math.max(object.energy * Math.pow(cooling, dt * 60), totalDrive * object.response, memoryFloor);
      object.pulse = Math.max(object.pulse * Math.pow(0.86, dt * 60), totalDrive, matchingPulse(object.kind, bandEvents, onset));
      object.memory = Math.min(1, (object.memory ?? 0) + dt * (0.012 + totalDrive * 0.08 + object.strength * 0.006));
      object.liveDrive = totalDrive;
      object.scale = Math.min(object.maxScale, object.scale + dt * object.growthRate * (1 + object.pulse * 2.2));
      this.growObjectChildren(object, time);
    }
    this.resolveMatterLifecycle(dt, time, energy);

    const maxObjects = this.params.primaryMode === 'demo' ? 260 : 220;
    while (this.objects.length > maxObjects) {
      const index = this.objects.findIndex((object) => object.kind !== 'origin-star' && !object.settled);
      this.objects.splice(index >= 0 ? index : 1, 1);
    }
    this.writeParams();
  }

  ensureOrigin(family, strength, time) {
    if (this.objects.some((object) => object.kind === 'origin-star')) return;
    this.params.originEstablished = true;
    this.params.originFamily = family;
    this.params.originStrength = Math.max(this.params.originStrength ?? 0, strength);
    if (this.params.originPhase === undefined) this.params.originPhase = hash(this.seedValue + family * 11.7) * Math.PI * 2;
    this.spawn('origin-star', family, Math.max(0.55, strength), time, { radius: 0, angle: this.params.originPhase });
  }

  seedPrebuiltUniverse(time) {
    this.params.originEstablished = true;
    this.params.originFamily = 0;
    this.params.originStrength = 0.18;
    this.params.originPhase = this.params.originPhase || hash(this.seedValue) * Math.PI * 2;
    this.spawn('origin-star', 0, 0.24, time, { radius: 0, angle: this.params.originPhase, prebuilt: true });
    const core = this.objects[this.objects.length - 1];
    core.scale = 3.2;
    core.maxScale = 4.4;
    core.energy = 0.14;
    core.memory = 0.42;
    core.prebuilt = true;
    core.settled = true;
    core.label = 'Sagittarius A* / galactic core';

    const armFamilies = [7, 2, 4, 9];
    for (let i = 0; i < armFamilies.length; i++) {
      this.spawn(i === 1 ? 'section-region' : 'spiral-arm', armFamilies[i], 0.16, time + i * 0.001, {
        parent: core,
        prebuilt: true,
        settled: true
      });
      const arm = this.objects[this.objects.length - 1];
      arm.offset = [
        Math.cos(this.params.originPhase + i * Math.PI * 0.5) * (12 + i * 2.2),
        (i - 1.5) * 1.8,
        Math.sin(this.params.originPhase + i * Math.PI * 0.5) * (8 + i * 1.5)
      ];
      arm.scale = 5.6 + i * 0.7;
      arm.maxScale = 10.5 + i * 1.1;
      arm.energy = 0.08;
      arm.memory = 0.3;
      arm.label = ['Perseus arm', 'Sagittarius arm', 'Orion spur', 'Scutum-Centaurus arm'][i];
    }

    this.spawn('solar-system', 4, 0.2, time + 0.01, { parent: this.objects[2] ?? core, prebuilt: true, settled: true });
    const sun = this.objects[this.objects.length - 1];
    sun.position = [10, 1.6, -7];
    sun.offset = [10, 1.6, -7];
    sun.scale = 2.6;
    sun.maxScale = 4.8;
    sun.energy = 0.1;
    sun.memory = 0.38;
    sun.label = 'Sol';
    const planets = [
      ['Mercury', 0.39, 0.38, 1],
      ['Venus', 0.72, 0.95, 4],
      ['Earth', 1.0, 1.0, 2],
      ['Mars', 1.52, 0.53, 5],
      ['Jupiter', 5.2, 11.2, 11],
      ['Saturn', 9.58, 9.45, 10],
      ['Uranus', 19.2, 4.0, 1],
      ['Neptune', 30.05, 3.88, 8]
    ];
    for (let i = 0; i < planets.length; i++) {
      const [name, au, radius, family] = planets[i];
      const kind = i >= 4 ? 'planetary-system' : 'rocky-planet';
      this.spawn(kind, family, 0.11 + i * 0.012, time + 0.02 + i * 0.001, { parent: sun, prebuilt: true, settled: true });
      const planet = this.objects[this.objects.length - 1];
      const a = this.params.originPhase + i * 2.399963229728653;
      const orbit = 2.6 + Math.log2(1 + au) * 4.1;
      planet.offset = [Math.cos(a) * orbit, Math.sin(i * 1.3) * 0.7, Math.sin(a) * orbit * 0.55];
      planet.position = [sun.position[0] + planet.offset[0], sun.position[1] + planet.offset[1], sun.position[2] + planet.offset[2]];
      planet.scale = Math.max(0.42, 0.34 + Math.sqrt(radius) * 0.28);
      planet.maxScale = Math.max(1.2, 1.2 + Math.sqrt(radius) * 0.42);
      planet.energy = 0.04;
      planet.memory = 0.22;
      planet.orbitSpeed *= 0.45 + 1 / Math.sqrt(au);
      planet.label = name;
      if (name === 'Earth' || name === 'Jupiter' || name === 'Saturn') {
        this.spawn('moon-system', (family + 7) % 12, 0.08, time + 0.035 + i * 0.001, { parent: planet, prebuilt: true, settled: true });
        const moon = this.objects[this.objects.length - 1];
        moon.scale = planet.scale * 0.42;
        moon.maxScale = planet.maxScale * 0.46;
        moon.offset = [planet.maxScale * 1.5, planet.maxScale * 0.18, planet.maxScale * 0.62];
        moon.memory = 0.18;
        moon.energy = 0.03;
        moon.label = name === 'Earth' ? 'Moon' : `${name} moons`;
      }
    }

    this.spawn('asteroid-field', 9, 0.09, time + 0.05, { parent: sun, prebuilt: true, settled: true });
    const belt = this.objects[this.objects.length - 1];
    belt.offset = [13, -0.4, 5.5];
    belt.scale = 3.2;
    belt.maxScale = 5.5;
    belt.memory = 0.2;
    belt.label = 'asteroid belt';
    this.writeParams();
  }

  unlockFamily(family, strength) {
    const index = ((family % 12) + 12) % 12;
    this.familyUnlock[index] = Math.min(1, Math.max(this.familyUnlock[index], strength));
    const unlocked = this.familyUnlock.filter((value) => value > 0.02).length;
    if (unlocked >= 1) {
      this.familyUnlock[(index + 7) % 12] = Math.max(this.familyUnlock[(index + 7) % 12], strength * 0.36);
      this.familyUnlock[(index + 5) % 12] = Math.max(this.familyUnlock[(index + 5) % 12], strength * 0.3);
    }
    if (unlocked >= 3) {
      this.familyUnlock[(index + 4) % 12] = Math.max(this.familyUnlock[(index + 4) % 12], strength * 0.24);
      this.familyUnlock[(index + 9) % 12] = Math.max(this.familyUnlock[(index + 9) % 12], strength * 0.2);
    }
  }

  spawn(kind, family, strength, time, options = {}) {
    const growth = this.params.demoBuildProgress ?? 0;
    const index = this.nextId++;
    const originFamily = this.params.originFamily >= 0 ? this.params.originFamily : family;
    const harmonic = harmonicAffinity(originFamily, family);
    const branch = Math.floor(index / 7);
    const angle = (this.params.originPhase ?? 0) + index * 2.399963229728653 + branch * 0.23;
    const parent = kind === 'origin-star' ? null : options.parent ?? this.chooseParent(family, kind, index);
    const generation = parent ? (parent.generation ?? 0) + 1 : 0;
    const parentScale = parent ? Math.max(3, parent.maxScale * 0.62, parent.scale * 1.2) : 0;
    const distance = options.radius ?? (kind === 'origin-star' ? 0 : parentScale * (1.15 + strength * 1.05) + (1 + Math.sqrt(generation)) * (2.6 + growth * 3.6));
    const branchBend = Math.sin(branch * 1.7 + originFamily + family * 0.31) * 0.62;
    const offset = [
      Math.cos(angle + branchBend) * distance,
      Math.sin(index * 1.27 + this.seedValue) * distance * (0.28 + harmonic * 0.14),
      Math.sin(angle + branchBend) * distance * (0.7 + harmonic * 0.28)
    ];
    const pos = parent ? [...parent.position] : [0, 0, 0];
    const color = varyColor(NOTE_COLORS[family] ?? [1, 1, 1], hash(this.seedValue + index * 8.31));
    const object = {
      id: index,
      kind,
      family,
      position: pos,
      offset,
      parentId: parent?.id ?? null,
      generation,
      color,
      phase: angle,
      orbitPhase: angle,
      orbitSpeed: (kind === 'spark-stream' || kind === 'comet-river' ? 0.16 : kind === 'gravity-well' ? 0.035 : 0.07) * (hash(this.seedValue + index * 4.7) > 0.5 ? 1 : -1),
      createdAt: time,
      age: 0,
      strength: Math.max(0.05, Math.min(1, strength)),
      scale: kind === 'origin-star' ? 1.8 : 0.15,
      maxScale: objectScale(kind, strength, growth),
      growthRate: objectGrowth(kind, strength),
      response: objectResponse(kind),
      pulse: strength,
      energy: strength,
      memory: strength * 0.24,
      liveDrive: strength,
      velocity: [0, 0, 0],
      impactMemory: 0,
      variant: hash(this.seedValue + index * 13.7),
      section: options.section ?? this.section,
      band: options.band ?? 'note',
      settled: options.settled ?? false,
      prebuilt: options.prebuilt ?? false,
      childStage: 0
    };
    this.objects.push(object);
    if (kind === 'origin-star') this.originObjectId = object.id;
    this.lastObjectTime = time;
  }

  chooseParent(family, kind, index) {
    const origin = this.objects.find((object) => object.kind === 'origin-star') ?? this.objects[0];
    if (!origin) return null;
    const candidates = this.objects.filter((object) => object.kind !== 'spark-stream' && object.kind !== 'shock-shell');
    if (candidates.length < 2) return origin;
    const preferSettled = kind === 'star-cluster' || kind === 'spiral-arm' || kind === 'nebula-veil';
    let best = origin;
    let bestScore = -Infinity;
    for (const object of candidates) {
      const affinity = harmonicAffinity(object.family ?? 0, family);
      const maturity = Math.min(1, (object.age ?? 0) / 8);
      const lineage = 1 / (1 + Math.max(0, object.generation ?? 0) * 0.35);
      const typeBias = preferSettled && object.settled ? 0.4 : 0;
      const noise = hash(this.seedValue + index * 5.13 + object.id * 9.7) * 0.28;
      const score = affinity * 0.55 + maturity * 0.32 + lineage * 0.18 + typeBias + noise;
      if (score > bestScore) {
        best = object;
        bestScore = score;
      }
    }
    return best;
  }

  updateCausalPosition(object, dt, energy) {
    if (object.kind === 'origin-star') {
      object.position[0] *= Math.pow(0.94, dt * 60);
      object.position[1] *= Math.pow(0.94, dt * 60);
      object.position[2] *= Math.pow(0.94, dt * 60);
      return;
    }
    const parent = this.objects.find((candidate) => candidate.id === object.parentId);
    if (!parent) return;
    const settledDrag = object.settled ? 0.35 : 1;
    object.orbitPhase += dt * object.orbitSpeed * (0.35 + energy * 1.4 + (object.liveDrive ?? 0) * 1.8) * settledDrag;
    const c = Math.cos(object.orbitPhase);
    const s = Math.sin(object.orbitPhase);
    const offset = object.offset ?? [0, 0, 0];
    const target = [
      parent.position[0] + offset[0] * c - offset[2] * s,
      parent.position[1] + offset[1] + Math.sin(object.orbitPhase * 0.7 + object.variant * 6.28) * Math.hypot(offset[0], offset[2]) * 0.08,
      parent.position[2] + offset[0] * s + offset[2] * c
    ];
    const follow = (object.settled ? 0.026 : 0.072) * (1 + energy * 0.95);
    object.position[0] += (target[0] - object.position[0]) * follow * dt * 60;
    object.position[1] += (target[1] - object.position[1]) * follow * dt * 60;
    object.position[2] += (target[2] - object.position[2]) * follow * dt * 60;
    const velocity = object.velocity ?? [0, 0, 0];
    const drag = object.kind === 'asteroid-field' || object.kind === 'comet-river' ? 0.982 : 0.972;
    object.position[0] += velocity[0] * dt;
    object.position[1] += velocity[1] * dt;
    object.position[2] += velocity[2] * dt;
    velocity[0] *= Math.pow(drag, dt * 60);
    velocity[1] *= Math.pow(drag, dt * 60);
    velocity[2] *= Math.pow(drag, dt * 60);
    object.velocity = velocity;
    object.impactMemory = Math.max(0, (object.impactMemory ?? 0) - dt * 0.16);
  }

  resolveMatterLifecycle(dt, time, energy) {
    const objects = this.objects;
    if (objects.length < 2) return;
    const wells = objects.filter((object) => object.kind === 'gravity-well' || object.kind === 'origin-star');
    const origin = wells[0] ?? objects[0];
    const matter = objects.filter((object) => object.kind !== 'origin-star' && object.kind !== 'supernova-bloom');
    for (const object of matter) {
      const targetWell = nearestWell(object, wells, origin);
      if (!targetWell) continue;
      const debrisBias = object.kind === 'asteroid-field' || object.kind === 'comet-river' || object.kind === 'spark-stream' ? 1 : 0.28;
      const dx = targetWell.position[0] - object.position[0];
      const dy = targetWell.position[1] - object.position[1];
      const dz = targetWell.position[2] - object.position[2];
      const d = Math.hypot(dx, dy, dz) || 1;
      const capture = (0.55 + (targetWell.memory ?? 0) * 0.8 + energy * 0.45) * debrisBias / (1 + d * 0.055);
      const velocity = object.velocity ?? [0, 0, 0];
      velocity[0] += dx / d * capture * dt * 14;
      velocity[1] += dy / d * capture * dt * 14;
      velocity[2] += dz / d * capture * dt * 14;
      object.velocity = velocity;
      if (d < Math.max(2.8, targetWell.scale * 0.72) && debrisBias > 0.8) {
        const jet = whiteHoleJet(object, targetWell, time);
        object.kind = jet.kind;
        object.offset = jet.offset;
        object.phase += 1.618;
        object.pulse = Math.max(object.pulse ?? 0, 0.82);
        object.energy = Math.max(object.energy ?? 0, 0.7);
        object.memory = Math.max(object.memory ?? 0, 0.34);
        object.velocity = jet.velocity;
      }
    }

    const colliders = objects
      .filter((object) => object.kind !== 'origin-star' && object.kind !== 'spark-stream' && object.kind !== 'supernova-bloom')
      .slice(0, 96);
    for (let i = 0; i < colliders.length; i++) {
      for (let j = i + 1; j < colliders.length; j++) {
        const a = colliders[i];
        const b = colliders[j];
        if (a.parentId === b.id || b.parentId === a.id) continue;
        const dx = b.position[0] - a.position[0];
        const dy = b.position[1] - a.position[1];
        const dz = b.position[2] - a.position[2];
        const d = Math.hypot(dx, dy, dz) || 1;
        const radius = collisionRadius(a) + collisionRadius(b);
        const overlap = radius - d;
        if (overlap <= 0) continue;
        const nx = dx / d;
        const ny = dy / d;
        const nz = dz / d;
        const affinity = harmonicAffinity(a.family ?? 0, b.family ?? 0);
        const dissonance = 1 - affinity;
        const push = overlap * (0.018 + (this.params.collisionStrength ?? 0.9) * 0.012);
        a.position[0] -= nx * push;
        a.position[1] -= ny * push;
        a.position[2] -= nz * push;
        b.position[0] += nx * push;
        b.position[1] += ny * push;
        b.position[2] += nz * push;
        a.velocity ??= [0, 0, 0];
        b.velocity ??= [0, 0, 0];
        const kick = overlap * (0.18 + dissonance * 0.55) * (this.params.collisionStrength ?? 0.9);
        a.velocity[0] -= nx * kick;
        a.velocity[1] -= ny * kick;
        a.velocity[2] -= nz * kick;
        b.velocity[0] += nx * kick;
        b.velocity[1] += ny * kick;
        b.velocity[2] += nz * kick;
        a.pulse = Math.max(a.pulse ?? 0, 0.22 + dissonance * 0.5);
        b.pulse = Math.max(b.pulse ?? 0, 0.22 + dissonance * 0.5);
        a.impactMemory = Math.min(1, (a.impactMemory ?? 0) + overlap * 0.08);
        b.impactMemory = Math.min(1, (b.impactMemory ?? 0) + overlap * 0.08);
        if (time - this.lastImpactTime > 0.75 && dissonance > 0.55 && overlap > Math.min(radius * 0.32, 4.5)) {
          const family = hash(this.seedValue + a.id * 3.7 + b.id * 8.1) > 0.5 ? a.family : b.family;
          const midpoint = [
            (a.position[0] + b.position[0]) * 0.5,
            (a.position[1] + b.position[1]) * 0.5,
            (a.position[2] + b.position[2]) * 0.5
          ];
          const parent = nearestWell({ position: midpoint }, wells, origin);
          this.spawn('asteroid-field', family, Math.min(0.72, 0.24 + overlap * 0.08), time, { band: 'impact-debris', settled: true, parent });
          const debris = this.objects[this.objects.length - 1];
          debris.position = midpoint;
          debris.velocity = [nx * kick * 1.4, ny * kick * 1.4, nz * kick * 1.4];
          debris.impactMemory = 1;
          this.lastImpactTime = time;
        }
      }
    }
  }

  growObjectChildren(object, time) {
    if (object.kind === 'origin-star') return;
    if (object.prebuilt && this.params.primaryMode === 'piano' && this.manualExcitations === 0) return;
    if (this.params.primaryMode === 'piano' && this.objects.length >= jamBudgetFor(this.manualExcitations)) return;
    if ((object.age ?? 0) < 0.85 || (object.memory ?? 0) < 0.08) return;
    if ((object.kind === 'star-cluster' || object.kind === 'spiral-arm' || object.kind === 'section-region') && object.childStage < 1) {
      this.spawn('solar-system', object.family, Math.max(0.28, object.strength * 0.72), time, { band: 'stellar-child', settled: true, parent: object });
      object.childStage = 1;
      return;
    }
    if ((object.kind === 'solar-system' || object.kind === 'star-cluster') && object.childStage < 2 && (object.memory ?? 0) > 0.2) {
      this.spawn('planetary-system', object.family, Math.max(0.22, object.strength * 0.54), time, { band: 'planet-child', settled: true, parent: object });
      object.childStage = 2;
      return;
    }
    if ((object.kind === 'solar-system' || object.kind === 'planetary-system') && object.childStage < 3 && (object.memory ?? 0) > 0.24) {
      this.spawn('rocky-planet', object.family, Math.max(0.2, object.strength * 0.46), time, { band: 'rock-child', settled: true, parent: object });
      object.childStage = 3;
      return;
    }
    if (object.kind === 'rocky-planet' && object.childStage < 4 && (object.memory ?? 0) > 0.28) {
      this.spawn('moon-system', object.family, Math.max(0.18, object.strength * 0.38), time, { band: 'moon-child', settled: true, parent: object });
      object.childStage = 4;
      return;
    }
    if ((object.kind === 'gravity-well' || object.kind === 'comet-river' || object.kind === 'spark-stream') && object.childStage < 1 && (object.memory ?? 0) > 0.18) {
      this.spawn('asteroid-field', object.family, Math.max(0.18, object.strength * 0.42), time, { band: 'debris-child', settled: true, parent: object });
      object.childStage = 1;
    }
  }

  fillJamGrowth(family, kind, strength, time, band = 'note') {
    const budget = jamBudgetFor(this.manualExcitations);
    const maxNew = Math.min(10, Math.max(0, budget - this.objects.length));
    for (let i = 0; i < maxNew; i++) {
      const nextFamily = i % 3 === 0 ? family : i % 3 === 1 ? (family + 7) % 12 : (family + 5) % 12;
      const childKind = jamChildKind(kind, this.objects.length, i);
      const parent = this.chooseParent(nextFamily, childKind, this.nextId + i);
      this.spawn(childKind, nextFamily, Math.max(0.16, strength * Math.pow(0.82, i + 1)), time + i * 0.001, {
        band,
        settled: i > 1,
        parent
      });
    }
  }

  writeParams() {
    let radius = 18;
    for (const object of this.objects) {
      const d = Math.hypot(object.position[0], object.position[1], object.position[2]) + object.maxScale * 3;
      radius = Math.max(radius, d);
    }
    const manual = this.params.primaryMode === 'piano' ? this.manualExcitations : 0;
    const budget = this.params.primaryMode === 'piano' ? jamBudgetFor(manual) : this.objects.length;
    const visibleObjects = this.params.primaryMode === 'piano'
      ? [
        ...this.objects.filter((object) => object.prebuilt),
        ...this.objects.filter((object) => !object.prebuilt).slice(0, Math.max(0, budget))
      ]
      : this.objects;
    this.params.songObjects = visibleObjects.map((object) => ({ ...object, position: [...object.position], color: [...object.color] }));
    this.params.songObjectCount = visibleObjects.length;
    this.params.jamExcitationCount = manual;
    this.params.jamGrowthBudget = this.params.primaryMode === 'piano' ? budget : 0;
    this.params.jamParticleReveal = this.params.primaryMode === 'piano'
      ? this.params.prebuiltUniverseOnStart ? Math.min(1, 0.12 + Math.sqrt(Math.max(1, budget)) / 38) : manual <= 1 ? 0 : Math.min(1, 0.05 + Math.sqrt(budget) / 34)
      : 1;
    this.params.songUniverseRadius = Math.max(this.params.songUniverseRadius ?? 0, radius);
    this.params.songGrowthLevel = Math.max(this.params.demoBuildProgress ?? 0, 1 - Math.exp(-this.energyAccum * 0.11));
    this.params.songDominantStructure = dominantStructure(this.objects);
    this.params.songSection = this.section;
    this.params.songEventRate = this.processedEvents.size + this.processedNotes.size;
  }
}

function jamBudgetFor(excitations) {
  if (excitations <= 0) return 0;
  if (excitations === 1) return 1;
  const phi = 1.61803398875;
  return Math.min(700, Math.max(1, Math.round(Math.pow(phi, excitations - 1))));
}

function jamChildKind(kind, total, step) {
  if (total < 3) return step === 0 ? 'star-cluster' : 'solar-system';
  if (total < 8) return ['solar-system', 'planetary-system', 'spiral-arm', 'rocky-planet'][step % 4];
  if (total < 24) return ['solar-system', 'rocky-planet', 'moon-system', 'asteroid-field', 'nebula-veil'][step % 5];
  if (kind === 'comet-river' || kind === 'spark-stream') return step % 2 ? 'comet-river' : 'asteroid-field';
  if (kind === 'gravity-well') return step % 3 === 0 ? 'asteroid-field' : 'solar-system';
  return ['solar-system', 'planetary-system', 'rocky-planet', 'moon-system', 'spiral-arm', 'nebula-veil', 'asteroid-field'][step % 7];
}

function eventKind(type) {
  if (type === 'sub' || type === 'bass') return 'gravity-well';
  if (type === 'lowMid') return 'spiral-arm';
  if (type === 'mid') return 'nebula-veil';
  if (type === 'highMid') return 'crystal-shards';
  if (type === 'high') return 'asteroid-field';
  if (type === 'broadband') return 'supernova-bloom';
  if (type === 'golden') return 'comet-river';
  return 'shock-shell';
}

function noteKind(structure, strength, family = 0, sequence = 0) {
  const turn = (family * 7 + sequence) % 5;
  if (structure === 'central-gravity') return turn === 0 ? 'gravity-well' : turn === 1 ? 'solar-system' : 'star-cluster';
  if (structure === 'ribbon-orbit') return turn < 2 ? 'spiral-arm' : turn === 2 ? 'planetary-system' : 'filament-web';
  if (structure === 'crystal-shard') return turn === 0 ? 'crystal-shards' : turn === 1 ? 'asteroid-field' : 'rocky-planet';
  if (structure === 'nebula-bloom') return turn === 0 ? 'nebula-veil' : turn === 1 ? 'star-cluster' : 'moon-system';
  if (structure === 'spiral-arm') return turn === 0 ? 'spiral-arm' : turn === 1 ? 'solar-system' : 'section-region';
  if (structure === 'spark-belt') return turn === 0 ? 'spark-stream' : turn === 1 ? 'asteroid-field' : 'comet-river';
  if (structure === 'golden-escape') return turn === 0 ? 'comet-river' : turn === 1 ? 'gravity-well' : 'asteroid-field';
  return 'star-cluster';
}

function ambientKind(bands, memory = {}) {
  const bass = Math.max(bands.sub ?? 0, bands.bass ?? 0);
  const mid = Math.max(bands.lowMid ?? 0, bands.mid ?? 0);
  const high = Math.max(bands.highMid ?? 0, bands.high ?? 0);
  if (bass > mid * 1.25 && bass > high) return 'gravity-well';
  if ((bands.highMid ?? 0) > Math.max(bass, mid) * 0.9) return 'crystal-shards';
  if (high > bass && high > mid * 1.05) return 'spark-stream';
  if ((memory.repetition ?? 0) > 0.25) return 'spiral-arm';
  if ((bands.lowMid ?? 0) > (bands.mid ?? 0) * 0.85) return 'spiral-arm';
  if (mid > bass) return 'nebula-veil';
  return hash((memory.energy ?? 0) * 17.3 + high * 11.1) > 0.62 ? 'comet-river' : 'star-cluster';
}

function settledKind(memory = {}, bands = {}, count = 0) {
  const bassMemory = Math.max(memory.bass ?? 0, bands.sub ?? 0, bands.bass ?? 0);
  const midMemory = Math.max(memory.sustain ?? 0, bands.lowMid ?? 0, bands.mid ?? 0);
  const bright = Math.max(memory.brightness ?? 0, bands.highMid ?? 0, bands.high ?? 0);
  const repetition = memory.repetition ?? 0;
  if (bassMemory > 0.38 && count % 4 === 0) return 'gravity-well';
  if (repetition > 0.18 || bands.lowMid > bands.mid * 0.85) return 'spiral-arm';
  if (midMemory > bright * 0.85) return 'nebula-veil';
  if (bright > 0.22 && count % 3 === 0) return 'asteroid-field';
  return count % 5 === 0 ? 'comet-river' : 'star-cluster';
}

function matchingPulse(kind, events, onset) {
  if (kind === 'gravity-well') return Math.max(events.sub ?? 0, events.bass ?? 0);
  if (kind === 'nebula-veil' || kind === 'filament-web' || kind === 'solar-system' || kind === 'planetary-system' || kind === 'rocky-planet' || kind === 'moon-system') return Math.max(events.lowMid ?? 0, events.mid ?? 0);
  if (kind === 'spark-stream' || kind === 'crystal-shards' || kind === 'asteroid-field') return Math.max(events.highMid ?? 0, events.high ?? 0);
  if (kind === 'supernova-bloom') return Math.max(onset ?? 0, events.broadband ?? 0);
  return onset ?? 0;
}

function objectBandDrive(object, bands = {}, events = {}, onset = 0) {
  const kind = object.kind ?? 'star-cluster';
  const response = {
    'origin-star': { sub: 0.9, bass: 0.9, lowMid: 0.35, mid: 0.28, highMid: 0.12, high: 0.08 },
    'star-cluster': { sub: 0.35, bass: 0.5, lowMid: 0.7, mid: 0.62, highMid: 0.28, high: 0.18 },
    'solar-system': { sub: 0.22, bass: 0.42, lowMid: 0.86, mid: 0.7, highMid: 0.32, high: 0.18 },
    'planetary-system': { sub: 0.12, bass: 0.25, lowMid: 0.62, mid: 0.82, highMid: 0.42, high: 0.24 },
    'rocky-planet': { sub: 0.18, bass: 0.32, lowMid: 0.52, mid: 0.72, highMid: 0.44, high: 0.25 },
    'moon-system': { sub: 0.08, bass: 0.18, lowMid: 0.38, mid: 0.54, highMid: 0.62, high: 0.35 },
    'asteroid-field': { sub: 0.04, bass: 0.08, lowMid: 0.18, mid: 0.3, highMid: 0.9, high: 1.18 },
    'gravity-well': { sub: 1.25, bass: 1.2, lowMid: 0.24, mid: 0.12, highMid: 0.08, high: 0.04 },
    'spiral-arm': { sub: 0.38, bass: 0.72, lowMid: 1.15, mid: 0.56, highMid: 0.22, high: 0.12 },
    'nebula-veil': { sub: 0.18, bass: 0.25, lowMid: 0.64, mid: 1.25, highMid: 0.44, high: 0.18 },
    'filament-web': { sub: 0.12, bass: 0.18, lowMid: 0.72, mid: 0.78, highMid: 0.76, high: 0.42 },
    'crystal-shards': { sub: 0.04, bass: 0.08, lowMid: 0.22, mid: 0.35, highMid: 1.28, high: 0.82 },
    'spark-stream': { sub: 0.02, bass: 0.04, lowMid: 0.12, mid: 0.22, highMid: 0.86, high: 1.3 },
    'comet-river': { sub: 0.08, bass: 0.14, lowMid: 0.34, mid: 0.42, highMid: 0.78, high: 1.05 },
    'supernova-bloom': { sub: 0.7, bass: 0.7, lowMid: 0.7, mid: 0.7, highMid: 0.7, high: 0.7 },
    'section-region': { sub: 0.45, bass: 0.55, lowMid: 0.75, mid: 0.75, highMid: 0.45, high: 0.28 }
  }[kind] ?? { sub: 0.25, bass: 0.35, lowMid: 0.55, mid: 0.55, highMid: 0.28, high: 0.18 };
  const level = (
    (bands.sub ?? 0) * response.sub +
    (bands.bass ?? 0) * response.bass +
    (bands.lowMid ?? 0) * response.lowMid +
    (bands.mid ?? 0) * response.mid +
    (bands.highMid ?? 0) * response.highMid +
    (bands.high ?? 0) * response.high
  ) / 2.1;
  const event = (
    (events.sub ?? 0) * response.sub +
    (events.bass ?? 0) * response.bass +
    (events.lowMid ?? 0) * response.lowMid +
    (events.mid ?? 0) * response.mid +
    (events.highMid ?? 0) * response.highMid +
    (events.high ?? 0) * response.high +
    (events.broadband ?? 0) * 0.6
  ) / 1.9;
  return Math.min(1, level * 0.78 + event * 0.95 + onset * (kind === 'supernova-bloom' ? 0.85 : 0.18));
}

function noteObjectDrive(object, activations = []) {
  if (!activations.length) return 0;
  const family = object.family ?? 0;
  const self = activations[family] ?? 0;
  const fifth = Math.max(activations[(family + 7) % 12] ?? 0, activations[(family + 5) % 12] ?? 0);
  const third = Math.max(activations[(family + 4) % 12] ?? 0, activations[(family + 3) % 12] ?? 0);
  const dissonance = Math.max(activations[(family + 1) % 12] ?? 0, activations[(family + 11) % 12] ?? 0, activations[(family + 6) % 12] ?? 0);
  const structuralBias = object.prebuilt ? 1.16 : 1;
  const kindBias = object.kind === 'origin-star' || object.kind === 'solar-system' ? 1.08 : object.kind === 'rocky-planet' || object.kind === 'moon-system' ? 0.92 : 1;
  return Math.min(1, (self * 1.15 + fifth * 0.42 + third * 0.28 + dissonance * 0.18) * structuralBias * kindBias);
}

function objectScale(kind, strength, growth) {
  const base = {
    'origin-star': 3.8,
    'star-cluster': 4.8,
    'solar-system': 5.8,
    'planetary-system': 4.2,
    'rocky-planet': 3.0,
    'moon-system': 2.6,
    'asteroid-field': 4.0,
    'gravity-well': 6.8,
    'spiral-arm': 8.5,
    'nebula-veil': 7.4,
    'spark-stream': 5.2,
    'crystal-shards': 5.6,
    'supernova-bloom': 10.5,
    'comet-river': 8.2,
    'filament-web': 7.0,
    'shock-shell': 6.4,
    'section-region': 9.0
  }[kind] ?? 5;
  return base * (0.82 + strength * 1.05) * (0.9 + growth * 0.72);
}

function objectGrowth(kind, strength) {
  const base = kind === 'supernova-bloom' ? 10 : kind === 'shock-shell' ? 8.5 : kind === 'spark-stream' ? 7 : kind === 'asteroid-field' ? 5.6 : kind === 'rocky-planet' || kind === 'moon-system' ? 2.8 : kind === 'planetary-system' ? 3.2 : 4.2;
  return base * (0.55 + strength);
}

function objectResponse(kind) {
  return kind === 'gravity-well' ? 1.15 : kind === 'spark-stream' || kind === 'asteroid-field' ? 1.2 : kind === 'supernova-bloom' ? 1.4 : kind === 'solar-system' || kind === 'planetary-system' || kind === 'rocky-planet' || kind === 'moon-system' ? 0.95 : 0.75;
}

function nearestWell(object, wells, fallback) {
  if (!wells.length) return fallback ?? null;
  let best = wells[0];
  let bestScore = Infinity;
  for (const well of wells) {
    const d = Math.hypot(
      (object.position?.[0] ?? 0) - well.position[0],
      (object.position?.[1] ?? 0) - well.position[1],
      (object.position?.[2] ?? 0) - well.position[2]
    ) / Math.max(1, 0.6 + (well.memory ?? 0));
    if (d < bestScore) {
      best = well;
      bestScore = d;
    }
  }
  return best;
}

function collisionRadius(object) {
  const kind = object.kind ?? 'star-cluster';
  const scale = Math.max(1, object.scale ?? object.maxScale ?? 4);
  const multiplier = {
    'gravity-well': 0.62,
    'spiral-arm': 0.44,
    'section-region': 0.46,
    'star-cluster': 0.38,
    'solar-system': 0.34,
    'planetary-system': 0.32,
    'rocky-planet': 0.28,
    'moon-system': 0.24,
    'asteroid-field': 0.3,
    'comet-river': 0.26,
    'crystal-shards': 0.32,
    'nebula-veil': 0.36,
    'filament-web': 0.34
  }[kind] ?? 0.28;
  return Math.max(0.75, scale * multiplier);
}

function whiteHoleJet(object, well, time) {
  const phase = (well.phase ?? 0) + (object.id ?? 0) * 2.399963 + time * 0.1;
  const lift = hash((object.id ?? 0) * 11.7 + time) > 0.5 ? 1 : -1;
  const speed = Math.max(4, (well.scale ?? 5) * 1.2);
  return {
    kind: hash((object.id ?? 0) * 17.3 + time) > 0.42 ? 'comet-river' : 'spark-stream',
    offset: [
      Math.cos(phase) * (well.scale ?? 5) * 1.2,
      lift * (well.scale ?? 5) * (1.15 + hash(phase) * 0.9),
      Math.sin(phase) * (well.scale ?? 5) * 1.2
    ],
    velocity: [
      Math.cos(phase) * speed * 0.55,
      lift * speed,
      Math.sin(phase) * speed * 0.55
    ]
  };
}

function harmonicAffinity(a, b) {
  const interval = Math.abs(((b - a + 18) % 12) - 6);
  return interval === 0 ? 1 : interval === 1 ? 0.25 : interval === 5 ? 0.9 : interval === 6 ? 0.15 : 0.55;
}

function noteNameToFamily(note) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const normalized = String(note ?? 'C').replace(/[0-9]/g, '').toUpperCase();
  return Math.max(0, names.indexOf(normalized));
}

function dominantFamily(params) {
  const active = params.noteFamilyActivation ?? [];
  let best = params.originFamily >= 0 ? params.originFamily : 0;
  let bestValue = -1;
  for (let i = 0; i < active.length; i++) {
    if ((active[i] ?? 0) > bestValue) {
      best = i;
      bestValue = active[i] ?? 0;
    }
  }
  return best;
}

function dominantStructure(objects) {
  const counts = new Map();
  for (const object of objects) counts.set(object.kind, (counts.get(object.kind) ?? 0) + object.scale);
  let best = 'origin';
  let value = 0;
  for (const [kind, count] of counts.entries()) {
    if (count > value) {
      best = kind;
      value = count;
    }
  }
  return best;
}

function varyColor(color, h) {
  return [
    color[0] * (0.78 + h * 0.36),
    color[1] * (0.82 + hash(h * 7.1) * 0.3),
    color[2] * (0.86 + hash(h * 11.3) * 0.28)
  ];
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

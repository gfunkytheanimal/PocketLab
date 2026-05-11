import { seededHash } from '../universe/seed.js';

export const ENCOUNTER_TYPES = [
  'recursive mandala gate',
  'spiral galaxy vortex',
  'plasma jellyfish',
  'crystal cathedral',
  'event horizon lens',
  'filament web forest',
  'bioluminescent reef',
  'broken spacetime mirror',
  'golden resonance shell',
  'dark void rim'
];

const PALETTES = {
  'recursive mandala gate': [0.95, 0.82, 1.35],
  'spiral galaxy vortex': [0.75, 1.05, 1.45],
  'plasma jellyfish': [1.05, 0.48, 1.25],
  'crystal cathedral': [0.62, 1.25, 1.55],
  'event horizon lens': [1.4, 0.72, 0.36],
  'filament web forest': [0.58, 1.42, 0.9],
  'bioluminescent reef': [0.35, 1.45, 1.1],
  'broken spacetime mirror': [1.25, 1.25, 1.55],
  'golden resonance shell': [1.55, 1.12, 0.42],
  'dark void rim': [0.9, 0.55, 1.65]
};

export class CosmicEncounterSystem {
  constructor(params, seed) {
    this.params = params;
    this.seed = seed;
    this.encounters = [];
    this.active = null;
    this.index = 0;
    this.labelVisible = false;
    this.reset();
  }

  reset() {
    this.encounters = [];
    let z = -58;
    let previousType = '';
    for (let i = 0; i < 32; i++) {
      let typeIndex = Math.floor(seededHash(this.seed, i, 3) * ENCOUNTER_TYPES.length) % ENCOUNTER_TYPES.length;
      if (i === 0) typeIndex = seededHash(this.seed, 100, 1) > 0.45 ? 0 : 1;
      if (ENCOUNTER_TYPES[typeIndex] === previousType) typeIndex = (typeIndex + 1) % ENCOUNTER_TYPES.length;
      const type = ENCOUNTER_TYPES[typeIndex];
      previousType = type;
      const intensity = 0.85 + i * 0.045;
      const radius = 18 + seededHash(this.seed, i, 9) * 16 + Math.min(14, i * 0.8);
      const x = (seededHash(this.seed, i, 11) - 0.5) * 22;
      const y = (seededHash(this.seed, i, 12) - 0.5) * 13;
      this.encounters.push({
        id: i,
        type,
        center: [x, y, z],
        radius,
        intensity,
        phase: seededHash(this.seed, i, 17) * Math.PI * 2,
        palette: PALETTES[type],
        seed: seededHash(this.seed, i, 23)
      });
      z -= 78 + seededHash(this.seed, i, 31) * 76;
    }
    this.index = 0;
    this.active = this.encounters[0];
    this.params.encounterName = this.active.type;
  }

  update(camera, time) {
    const cameraZ = camera.position.z;
    let nearest = this.encounters[0];
    let nearestScore = Infinity;
    for (const encounter of this.encounters) {
      const dz = cameraZ - encounter.center[2];
      const approachDistance = Math.abs(dz);
      if (approachDistance < nearestScore && dz > -160) {
        nearest = encounter;
        nearestScore = approachDistance;
      }
    }
    this.active = nearest;
    this.index = nearest?.id ?? 0;
    const distanceAhead = cameraZ - (nearest?.center[2] ?? cameraZ);
    const buildup = smoothstep(170, 44, distanceAhead);
    const peak = 1 - smoothstep(0, nearest?.radius ?? 1, Math.abs(distanceAhead));
    const exit = 1 - smoothstep((nearest?.radius ?? 1) * 0.8, (nearest?.radius ?? 1) * 2.6, Math.abs(distanceAhead));
    const influence = Math.max(0, Math.min(1, Math.max(buildup * 0.75, peak) * exit));
    this.params.encounterName = nearest?.type ?? 'none';
    this.params.encounterDistance = distanceAhead;
    this.params.encounterInfluence = influence;
    this.params.encounterPeak = peak;
    this.params.encounterPalette = nearest?.palette ?? [1, 1, 1];
    this.params.encounterAim = nearest ? nearest.center : [0, 0, cameraZ - 80];
    this.params.encounterLabelsVisible = this.labelVisible;
    this.params.discoveryIntent = influence > 0.35 ? 'cosmic encounter' : this.params.discoveryIntent;
    this.params.encounterTrailBoost = 1 + influence * 0.7;
    this.time = time;
  }

  visible(cameraZ) {
    return this.encounters.filter((encounter) => {
      const dz = cameraZ - encounter.center[2];
      return dz > -210 && dz < 90;
    });
  }

  sample(position) {
    let force = [0, 0, 0];
    let color = [0, 0, 0];
    let density = 0;
    for (const encounter of this.encounters) {
      const dx = position[0] - encounter.center[0];
      const dy = position[1] - encounter.center[1];
      const dz = position[2] - encounter.center[2];
      const distance = Math.hypot(dx, dy, dz);
      const radius = encounter.radius;
      if (distance > radius * 2.2) continue;
      const falloff = 1 - smoothstep(radius * 0.28, radius * 2.2, distance);
      if (falloff <= 0) continue;
      const f = encounterForce(encounter, dx, dy, dz, distance || 1, falloff);
      force[0] += f[0];
      force[1] += f[1];
      force[2] += f[2];
      color[0] += encounter.palette[0] * falloff;
      color[1] += encounter.palette[1] * falloff;
      color[2] += encounter.palette[2] * falloff;
      density += falloff;
    }
    return { force, color, density: Math.min(1, density) };
  }

  jumpToNext(camera) {
    const currentZ = camera.position.z;
    const next = this.encounters.find((encounter) => encounter.center[2] < currentZ - 45) ?? this.encounters[0];
    camera.forwardTravel = -next.center[2] - 42;
  }

  jumpToPrevious(camera) {
    const currentZ = camera.position.z;
    const reversed = [...this.encounters].reverse();
    const previous = reversed.find((encounter) => encounter.center[2] > currentZ + 18) ?? this.encounters[0];
    camera.forwardTravel = -previous.center[2] - 42;
  }

  forceRandom(camera) {
    const nextId = (this.index + 1 + Math.floor(seededHash(this.seed, this.time ?? 0, this.index) * 8)) % this.encounters.length;
    const encounter = this.encounters[nextId];
    encounter.center[2] = camera.position.z - 62;
    encounter.center[0] = (seededHash(this.seed, this.time ?? 0, 41) - 0.5) * 18;
    encounter.center[1] = (seededHash(this.seed, this.time ?? 0, 43) - 0.5) * 10;
  }

  toggleLabels() {
    this.labelVisible = !this.labelVisible;
    this.params.encounterLabelsVisible = this.labelVisible;
  }
}

function encounterForce(encounter, dx, dy, dz, distance, falloff) {
  const inv = 1 / distance;
  const nx = dx * inv;
  const ny = dy * inv;
  const nz = dz * inv;
  const swirl = [-ny, nx, 0];
  const strength = falloff * encounter.intensity;
  switch (encounter.type) {
    case 'spiral galaxy vortex':
      return [swirl[0] * 1.6 * strength - nx * 0.38 * strength, swirl[1] * 1.6 * strength - ny * 0.38 * strength, -nz * 0.18 * strength];
    case 'event horizon lens':
      return [-nx * 2.0 * strength + swirl[0] * 0.65 * strength, -ny * 2.0 * strength + swirl[1] * 0.65 * strength, -nz * 1.2 * strength];
    case 'golden resonance shell':
      return [nx * Math.sin(distance * 0.45) * strength, ny * Math.sin(distance * 0.45) * strength, swirl[0] * 0.2 * strength];
    case 'broken spacetime mirror':
      return [Math.sign(dx || 1) * 0.8 * strength, -ny * 0.5 * strength, Math.sin(dx * 0.4) * 0.6 * strength];
    case 'filament web forest':
      return [Math.sin(dy * 0.35) * 0.8 * strength, Math.cos(dx * 0.28) * 0.45 * strength, -nz * 0.12 * strength];
    case 'crystal cathedral':
      return [-nx * 0.3 * strength, Math.sign(dy || 1) * 0.5 * strength, -nz * 0.1 * strength];
    case 'plasma jellyfish':
      return [swirl[0] * 0.6 * strength, swirl[1] * 0.6 * strength + Math.sin(dz * 0.2) * 0.4 * strength, -Math.abs(nz) * 0.25 * strength];
    default:
      return [swirl[0] * 0.85 * strength - nx * 0.18 * strength, swirl[1] * 0.85 * strength - ny * 0.18 * strength, -nz * 0.12 * strength];
  }
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

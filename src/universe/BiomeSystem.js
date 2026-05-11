import { seededHash } from './seed.js';

export const BIOMES = [
  'plasma ocean',
  'crystalline void',
  'filament forest',
  'recursive storm',
  'frozen void',
  'resonance chamber',
  'attractor coral',
  'singularity well'
];

export class BiomeSystem {
  constructor(params, seed) {
    this.params = params;
    this.seed = seed;
    this.cellSize = 96;
    this.active = [];
    this.primary = { name: BIOMES[0], weights: new Float32Array(BIOMES.length), influence: biomeInfluence(0) };
  }

  update(cameraPosition, memory, recursion, harmonic) {
    const cx = Math.floor(cameraPosition.x / this.cellSize);
    const cy = Math.floor(cameraPosition.y / this.cellSize);
    const cz = Math.floor(cameraPosition.z / this.cellSize);
    const weights = new Float32Array(BIOMES.length);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const bx = cx + dx;
          const by = cy + dy;
          const bz = cz + dz;
          const id = this.pickBiome(bx, by, bz, memory, recursion);
          const center = [(bx + 0.5) * this.cellSize, (by + 0.5) * this.cellSize, (bz + 0.5) * this.cellSize];
          const dist = Math.hypot(cameraPosition.x - center[0], cameraPosition.y - center[1], cameraPosition.z - center[2]);
          const w = Math.max(0, 1 - dist / (this.cellSize * 1.8));
          weights[id] += w * w;
        }
      }
    }
    let sum = 0;
    for (const w of weights) sum += w;
    if (sum <= 0) weights[0] = 1;
    else for (let i = 0; i < weights.length; i++) weights[i] /= sum;
    let top = 0;
    for (let i = 1; i < weights.length; i++) if (weights[i] > weights[top]) top = i;
    const influence = biomeInfluence(top);
    influence.field *= 0.75 + harmonic.convergence * 0.35;
    influence.fog *= 0.75 + harmonic.slow * 0.5;
    this.primary = { name: BIOMES[top], weights, influence };
    this.params.biomeName = this.primary.name;
    this.params.biomeField = influence.field;
    this.params.biomeFog = influence.fog;
    return this.primary;
  }

  pickBiome(x, y, z, memory, recursion) {
    const h = seededHash(this.seed, x, y, z);
    const coherenceBias = Math.min(0.99, memory.highEnergyCells.length / 80);
    const depth = recursion.band % BIOMES.length;
    return Math.floor((h * BIOMES.length + coherenceBias * 2 + depth * 0.35) % BIOMES.length);
  }

  sample(position) {
    return this.primary;
  }
}

function biomeInfluence(id) {
  return [
    { field: 1.15, fog: 1.35, color: 0.05, drag: 0.985, recursion: 1.05 },
    { field: 0.72, fog: 0.42, color: 0.62, drag: 0.965, recursion: 0.85 },
    { field: 1.05, fog: 0.8, color: 0.23, drag: 0.99, recursion: 1.0 },
    { field: 1.45, fog: 1.15, color: 0.82, drag: 0.996, recursion: 1.25 },
    { field: 0.48, fog: 0.28, color: 0.55, drag: 0.94, recursion: 0.72 },
    { field: 0.95, fog: 0.95, color: 0.38, drag: 0.982, recursion: 1.45 },
    { field: 0.88, fog: 1.05, color: 0.16, drag: 0.975, recursion: 1.12 },
    { field: 1.7, fog: 1.55, color: 0.92, drag: 1.002, recursion: 1.65 }
  ][id];
}

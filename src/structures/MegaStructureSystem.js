import { hash01 } from '../math/random.js';

export class MegaStructureSystem {
  constructor(params) {
    this.params = params;
    this.structures = [];
  }

  update(analysis, cameraPosition, time) {
    const next = [];
    for (let i = 0; i < analysis.length; i++) {
      const source = analysis[i];
      const seed = hash01(Math.floor(source.x * 3.1 + source.y * 7.7 + source.z * 0.5));
      if (source.score < 0.16 && seed < 0.72) continue;
      next.push({
        type: seed > 0.72 ? 'tunnel' : source.type,
        center: [source.x, source.y, source.z],
        radius: source.radius * (1.1 + seed * 1.8),
        spin: (seed - 0.5) * 2.4,
        energy: source.score,
        colorPhase: (seed + time * 0.02) % 1
      });
    }
    const farZ = cameraPosition.z - this.params.recycleRadius * 0.85;
    for (let i = 0; i < 4; i++) {
      const seed = hash01(Math.floor(time * 0.05) * 13 + i * 19);
      if (seed < 0.78) continue;
      next.push({
        type: 'void',
        center: [
          cameraPosition.x + (hash01(seed * 31) - 0.5) * 42,
          cameraPosition.y + (hash01(seed * 53) - 0.5) * 28,
          farZ - hash01(seed * 71) * 50
        ],
        radius: 18 + seed * 32,
        spin: seed * 1.7,
        energy: 0.18 + seed * 0.12,
        colorPhase: seed
      });
    }
    this.structures = next.slice(0, 16);
    return this.structures;
  }

  sample(position) {
    let force = [0, 0, 0];
    let density = 0;
    for (const structure of this.structures) {
      const dx = position[0] - structure.center[0];
      const dy = position[1] - structure.center[1];
      const dz = position[2] - structure.center[2];
      const dist = Math.hypot(dx, dy, dz) || 1;
      const influence = Math.max(0, 1 - dist / structure.radius);
      if (influence <= 0) continue;
      const swirl = structure.type === 'tunnel' || structure.type === 'filament' ? 1 : -0.35;
      force[0] += (-dz / dist * swirl - dx / dist * 0.15) * influence * structure.energy;
      force[1] += (Math.sin(dist * 0.23 + structure.spin) - dy / dist) * influence * structure.energy * 0.35;
      force[2] += (dx / dist * swirl - dz / dist * 0.1) * influence * structure.energy;
      density += influence * structure.energy;
    }
    return { force, density: Math.min(1, density) };
  }
}

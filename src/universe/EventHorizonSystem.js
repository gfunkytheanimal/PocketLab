import { seededHash } from './seed.js';

export class EventHorizonSystem {
  constructor(params, seed) {
    this.params = params;
    this.seed = seed;
    this.cellSize = 420;
    this.active = [];
  }

  update(cameraPosition, time, harmonic) {
    const cz = Math.floor(cameraPosition.z / this.cellSize);
    const next = [];
    for (let dz = -1; dz <= 2; dz++) {
      const z = cz + dz;
      const h = seededHash(this.seed, z, 19, 41);
      if (h < 0.82) continue;
      const center = [
        (seededHash(this.seed, z, 1, 0) - 0.5) * 140,
        (seededHash(this.seed, z, 2, 0) - 0.5) * 90,
        (z + 0.5) * this.cellSize
      ];
      const dist = Math.hypot(cameraPosition.x - center[0], cameraPosition.y - center[1], cameraPosition.z - center[2]);
      const influence = Math.max(0, 1 - dist / 120);
      next.push({
        type: h > 0.95 ? 'harmonic singularity' : h > 0.9 ? 'mirror well' : 'recursive fracture',
        center,
        radius: 70 + h * 65,
        influence,
        phase: time * (0.05 + h * 0.04),
        energy: influence * (0.4 + harmonic.convergence)
      });
    }
    this.active = next;
    this.params.eventHorizon = next.reduce((m, e) => Math.max(m, e.influence), 0);
    return this.active;
  }

  sample(position) {
    let force = [0, 0, 0];
    let warp = 0;
    for (const h of this.active) {
      const dx = position[0] - h.center[0];
      const dy = position[1] - h.center[1];
      const dz = position[2] - h.center[2];
      const dist = Math.hypot(dx, dy, dz) || 1;
      const influence = Math.max(0, 1 - dist / h.radius);
      const pull = h.type === 'mirror well' ? -1 : 1;
      force[0] += (-dx / dist * pull + Math.sin(h.phase) * 0.25) * influence * h.energy;
      force[1] += (-dy / dist * pull + Math.cos(h.phase * 1.3) * 0.2) * influence * h.energy;
      force[2] += (-dz / dist * pull) * influence * h.energy;
      warp += influence * h.energy;
    }
    return { force, warp: Math.min(1, warp) };
  }
}

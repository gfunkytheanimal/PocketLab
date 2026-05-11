import { hash01 } from '../math/random.js';

export class FieldEntitySystem {
  constructor(params) {
    this.params = params;
    this.entities = [];
    this.nextId = 1;
  }

  reset() {
    this.entities.length = 0;
    this.nextId = 1;
  }

  update(dt, time, memory, biome, harmonic) {
    const candidates = memory.highEnergyCells.filter((c) => c.coherence > 0.12 && c.energy > 0.08);
    if (this.entities.length < 9 && candidates.length > 0 && harmonic.convergence > 0.38) {
      const c = candidates[Math.floor(hash01(time + this.nextId * 13.7) * candidates.length)];
      this.entities.push({
        id: this.nextId++,
        center: [c.x, c.y, c.z],
        velocity: [c.flow[0] * 0.2, c.flow[1] * 0.2, c.flow[2] * 0.2],
        energy: c.energy + c.coherence,
        phase: hash01(c.x + c.y * 3 + c.z * 7) * Math.PI * 2,
        age: 0,
        splitCooldown: 20
      });
    }
    for (const entity of this.entities) {
      entity.age += dt;
      entity.splitCooldown -= dt;
      const mem = memory.sample(entity.center);
      const orbit = [
        Math.sin(entity.phase + time * 0.31),
        Math.cos(entity.phase * 0.7 + time * 0.19),
        Math.sin(entity.phase * 1.3 + time * 0.23)
      ];
      const biomePush = biome.influence.field * 0.03;
      entity.velocity[0] = entity.velocity[0] * 0.985 + (mem.flow[0] + orbit[0] * 0.4) * biomePush;
      entity.velocity[1] = entity.velocity[1] * 0.985 + (mem.flow[1] + orbit[1] * 0.2) * biomePush;
      entity.velocity[2] = entity.velocity[2] * 0.985 + (mem.flow[2] + orbit[2] * 0.4) * biomePush;
      entity.center[0] += entity.velocity[0] * dt * 12;
      entity.center[1] += entity.velocity[1] * dt * 12;
      entity.center[2] += entity.velocity[2] * dt * 12;
      entity.energy = Math.min(1.8, entity.energy * 0.996 + mem.energy * 0.01 + harmonic.fast * 0.002);
      memory.inject(entity.center, entity.velocity, entity.energy * 0.8);
    }
    this.entities = this.entities.filter((e) => e.energy > 0.035 && e.age < 220);
    this.params.entityCount = this.entities.length;
    return this.entities;
  }

  sample(position) {
    let force = [0, 0, 0];
    let density = 0;
    for (const entity of this.entities) {
      const dx = position[0] - entity.center[0];
      const dy = position[1] - entity.center[1];
      const dz = position[2] - entity.center[2];
      const dist = Math.hypot(dx, dy, dz) || 1;
      const influence = Math.max(0, 1 - dist / (10 + entity.energy * 20));
      force[0] += (-dy / dist + entity.velocity[0]) * influence * entity.energy;
      force[1] += (dx / dist + entity.velocity[1]) * influence * entity.energy;
      force[2] += (Math.sin(dist * 0.2 + entity.phase) * 0.4 + entity.velocity[2]) * influence * entity.energy;
      density += influence * entity.energy;
    }
    return { force, density: Math.min(1, density) };
  }
}

export class FieldMemory {
  constructor(params, options = {}) {
    this.params = params;
    this.size = options.size ?? 18;
    this.cellSize = options.cellSize ?? 4.5;
    this.decay = options.decay ?? 0.982;
    this.count = this.size * this.size * this.size;
    this.energy = new Float32Array(this.count);
    this.flow = new Float32Array(this.count * 3);
    this.coherence = new Float32Array(this.count);
    this.origin = { x: 0, y: 0, z: 0 };
    this.highEnergyCells = [];
  }

  reset(cameraPosition) {
    this.energy.fill(0);
    this.flow.fill(0);
    this.coherence.fill(0);
    this.snapOrigin(cameraPosition);
    this.highEnergyCells.length = 0;
  }

  snapOrigin(cameraPosition) {
    const span = this.size * this.cellSize;
    this.origin.x = Math.floor(cameraPosition.x / this.cellSize) * this.cellSize - span * 0.5;
    this.origin.y = Math.floor(cameraPosition.y / this.cellSize) * this.cellSize - span * 0.5;
    this.origin.z = Math.floor(cameraPosition.z / this.cellSize) * this.cellSize - span * 0.5;
  }

  beginFrame(cameraPosition, dt) {
    this.snapOrigin(cameraPosition);
    const decay = Math.pow(this.decay, Math.max(0, dt * 60));
    this.highEnergyCells.length = 0;
    for (let i = 0; i < this.count; i++) {
      this.energy[i] *= decay;
      this.coherence[i] *= decay;
      const f = i * 3;
      this.flow[f] *= decay;
      this.flow[f + 1] *= decay;
      this.flow[f + 2] *= decay;
    }
  }

  index(ix, iy, iz) {
    return ix + this.size * (iy + this.size * iz);
  }

  cellFromWorld(position) {
    const ix = Math.floor((position[0] - this.origin.x) / this.cellSize);
    const iy = Math.floor((position[1] - this.origin.y) / this.cellSize);
    const iz = Math.floor((position[2] - this.origin.z) / this.cellSize);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= this.size || iy >= this.size || iz >= this.size) {
      return -1;
    }
    return this.index(ix, iy, iz);
  }

  inject(position, velocity, amount = 1) {
    const idx = this.cellFromWorld(position);
    if (idx < 0) return;
    const e = Math.min(6, amount);
    this.energy[idx] = this.energy[idx] * 0.98 + e * 0.02;
    const f = idx * 3;
    const vx = velocity[0];
    const vy = velocity[1];
    const vz = velocity[2];
    const mag = Math.hypot(vx, vy, vz) || 1;
    this.flow[f] = this.flow[f] * 0.985 + (vx / mag) * e * 0.015;
    this.flow[f + 1] = this.flow[f + 1] * 0.985 + (vy / mag) * e * 0.015;
    this.flow[f + 2] = this.flow[f + 2] * 0.985 + (vz / mag) * e * 0.015;
    this.coherence[idx] = Math.min(1, this.coherence[idx] + 0.006 * e);
  }

  sample(position) {
    const idx = this.cellFromWorld(position);
    if (idx < 0) {
      return { energy: 0, coherence: 0, flow: [0, 0, 0] };
    }
    const f = idx * 3;
    return {
      energy: this.energy[idx],
      coherence: this.coherence[idx],
      flow: [this.flow[f], this.flow[f + 1], this.flow[f + 2]]
    };
  }

  collectHotCells(limit = 48) {
    const cells = [];
    for (let iz = 1; iz < this.size - 1; iz++) {
      for (let iy = 1; iy < this.size - 1; iy++) {
        for (let ix = 1; ix < this.size - 1; ix++) {
          const idx = this.index(ix, iy, iz);
          const energy = this.energy[idx];
          if (energy < 0.08) continue;
          const f = idx * 3;
          cells.push({
            x: this.origin.x + (ix + 0.5) * this.cellSize,
            y: this.origin.y + (iy + 0.5) * this.cellSize,
            z: this.origin.z + (iz + 0.5) * this.cellSize,
            energy,
            coherence: this.coherence[idx],
            flow: [this.flow[f], this.flow[f + 1], this.flow[f + 2]]
          });
        }
      }
    }
    cells.sort((a, b) => b.energy + b.coherence - (a.energy + a.coherence));
    this.highEnergyCells = cells.slice(0, limit);
    return this.highEnergyCells;
  }
}

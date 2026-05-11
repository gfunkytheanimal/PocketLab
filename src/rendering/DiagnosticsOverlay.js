export class DiagnosticsOverlay {
  constructor(device, universe) {
    this.device = device;
    this.universe = universe;
    this.element = document.createElement('div');
    this.element.id = 'diagnostics';
    document.body.appendChild(this.element);
    this.last = '';
  }

  update() {
    this.element.classList.toggle('visible', this.universe.params.diagnosticsVisible);
    const text = [
      `device: ${this.device.deviceType}`,
      `compute: ${this.device.supportsCompute ? 'yes' : 'no'}`,
      `path: ${this.universe.useGpuCompute ? 'webgpu compute/storage' : 'dynamic particles'}`,
      `gpu validation: ${this.universe.simulator.validationStatus ?? 'n/a'}`,
      `memory: ${this.universe.universe.memory.highEnergyCells.length} active cells`,
      `structures: ${this.universe.universe.structures.length}`,
      `biome: ${this.universe.params.biomeName}`,
      `entities: ${this.universe.params.entityCount}`,
      `horizon: ${this.universe.params.eventHorizon.toFixed(2)}`,
      `intent: ${this.universe.params.discoveryIntent}`,
      `scale band: ${this.universe.params.recursiveDepth}`,
      `audio: ${this.universe.params.audioEnabled ? 'mic' : this.universe.params.proceduralAudio ? 'procedural' : 'idle'}`,
      `seed: ${this.universe.params.universeSeed}`
    ].join('\n');
    if (text !== this.last) {
      this.element.textContent = text;
      this.last = text;
    }
  }
}

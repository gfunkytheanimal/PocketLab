export class HarmonicEngine {
  constructor(params, seedValue) {
    this.params = params;
    this.seedValue = seedValue;
    this.phase = 0;
    this.slow = 0;
    this.medium = 0;
    this.fast = 0;
    this.chaos = 0;
    this.convergence = 0;
  }

  update(dt, time, audio) {
    const seed = this.seedValue * 6.28318530718;
    this.phase += dt * (0.055 + audio.level * 0.035);
    this.slow = wave(this.phase * 0.37 + seed) * 0.5 + 0.5;
    this.medium = wave(this.phase * 0.91 + seed * 1.7) * 0.5 + 0.5;
    this.fast = wave(this.phase * 2.03 + seed * 2.3) * 0.5 + 0.5;
    const q = Math.sin(time * 0.013 + seed) + Math.sin(time * 0.0217 + seed * 3.1);
    this.chaos = 0.5 + 0.5 * Math.sin(q + Math.sin(time * 0.007 + seed * 5.0));
    this.convergence = Math.pow(this.slow * 0.45 + this.medium * 0.35 + this.chaos * 0.2, 2.2);
    this.params.harmonicConvergence = this.convergence;
    this.params.harmonicPulse = this.fast;
  }
}

function wave(x) {
  return Math.sin(x) * 0.6 + Math.sin(x * 1.61803398875) * 0.3 + Math.sin(x * 2.41421) * 0.1;
}

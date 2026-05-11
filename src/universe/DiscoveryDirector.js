export class DiscoveryDirector {
  constructor(params) {
    this.params = params;
    this.timer = 0;
    this.intent = 'drift';
  }

  update(dt, universe) {
    this.timer += dt;
    const convergence = universe.harmonics.convergence;
    const horizon = this.params.eventHorizon;
    if (this.timer > 95 && (convergence > 0.55 || universe.entities.entities.length > 2 || horizon > 0.2)) {
      this.intent = horizon > 0.2 ? 'anomaly reveal' : convergence > 0.7 ? 'harmonic convergence' : 'entity encounter';
      this.timer = 0;
    } else if (this.timer > 150) {
      this.intent = 'scale vista';
      this.timer = 0;
    }
    this.params.discoveryIntent = this.intent;
  }
}

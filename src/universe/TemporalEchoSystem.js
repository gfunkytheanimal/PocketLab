export class TemporalEchoSystem {
  constructor(params) {
    this.params = params;
    this.snapshots = [];
    this.echoes = [];
    this.timer = 0;
  }

  reset() {
    this.snapshots.length = 0;
    this.echoes.length = 0;
    this.timer = 0;
  }

  update(dt, time, memory, structures, harmonic) {
    this.timer += dt;
    if (this.timer > 2.5) {
      this.timer = 0;
      this.snapshots.push({
        time,
        cells: memory.highEnergyCells.slice(0, 18).map((c) => ({ ...c, flow: [...c.flow] })),
        structures: structures.slice(0, 6).map((s) => ({ ...s, center: [...s.center] })),
        harmonic: harmonic.convergence
      });
      if (this.snapshots.length > 18) this.snapshots.shift();
    }
    this.echoes.length = 0;
    for (const snapshot of this.snapshots) {
      const age = time - snapshot.time;
      const window = Math.sin(age * 0.22 + snapshot.harmonic * 3.1) * 0.5 + 0.5;
      if (age < 8 || window < 0.72) continue;
      for (const s of snapshot.structures) {
        this.echoes.push({
          center: [
            s.center[0] + Math.sin(age * 0.11) * 2,
            s.center[1] + Math.cos(age * 0.13) * 2,
            s.center[2] - age * 0.18
          ],
          radius: s.radius * (1 + Math.sin(age * 0.17) * 0.12),
          energy: s.energy * Math.max(0, 1 - age / 80) * 0.75,
          colorPhase: (s.colorPhase + age * 0.01) % 1,
          type: 'temporal echo'
        });
      }
    }
    return this.echoes;
  }
}

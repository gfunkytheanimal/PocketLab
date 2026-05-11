const DEFAULT_NODES = [
  {
    name: 'Bass Node',
    base: [0, -4, 0],
    mass: 1.8,
    size: 1.14,
    palette: [0.62, 0.72, 1.55],
    profile: { sub: 1.35, bass: 1.45, lowMid: 0.55, mid: 0.32, highMid: 0.2, high: 0.16 }
  },
  {
    name: 'Vocal Node',
    base: [-34, 20, -24],
    mass: 0.9,
    size: 0.78,
    palette: [0.55, 1.35, 1.08],
    profile: { sub: 0.18, bass: 0.28, lowMid: 0.85, mid: 1.55, highMid: 0.55, high: 0.28 }
  },
  {
    name: 'Treble Node',
    base: [32, -22, 24],
    mass: 0.72,
    size: 0.7,
    palette: [1.65, 1.38, 0.78],
    profile: { sub: 0.1, bass: 0.16, lowMid: 0.34, mid: 0.55, highMid: 1.45, high: 1.65 }
  },
  {
    name: 'Bloom Node',
    base: [6, 28, 42],
    mass: 0.65,
    size: 0.66,
    palette: [1.45, 0.72, 1.35],
    profile: { sub: 0.55, bass: 0.65, lowMid: 0.9, mid: 0.9, highMid: 0.9, high: 0.75 }
  }
];

export class NebulaNodeSystem {
  constructor(params) {
    this.params = params;
    this.nodes = DEFAULT_NODES.map((node, index) => ({
      ...node,
      index,
      center: [...node.base],
      velocity: [0, 0, 0],
      energy: 0
    }));
  }

  reset() {
    for (const node of this.nodes) {
      node.center = [...node.base];
      node.velocity = [0, 0, 0];
      node.energy = 0;
      node.danceVelocity = [0, 0, 0];
    }
    this.writeParams([]);
  }

  update(time, dt) {
    if (this.params.appMode !== 'sound-board') {
      this.writeParams([]);
      return;
    }
    const active = this.nodes.slice(0, Math.max(1, Math.min(this.params.nodeCount ?? 3, this.nodes.length)));
    const bands = this.params.audioBands ?? {};
    const events = this.params.audioBandEvents ?? {};
    const noteEvents = this.params.noteEvents ?? [];
    const interaction = this.params.interactionStrength ?? 1;
    const exchange = this.params.particleExchange ?? 0.8;
    const bassPull = ((bands.sub ?? 0) * 0.8 + (bands.bass ?? 0) + (events.bass ?? 0) * 0.7) * interaction;
    const midTwist = ((bands.lowMid ?? 0) * 0.7 + (bands.mid ?? 0) + (events.mid ?? 0) * 0.6) * interaction;
    const highSpark = ((bands.highMid ?? 0) * 0.65 + (bands.high ?? 0) + (events.high ?? 0) * 0.8) * interaction;
    const bloom = Math.max(events.broadband ?? 0, this.params.cosmicFlower ?? 0);
    const noteGravity = noteEvents.filter((event) => event.structure === 'central-gravity').reduce((sum, event) => sum + event.strength, 0);
    const noteOrbit = noteEvents.filter((event) => event.structure === 'spiral-arm' || event.structure === 'ribbon-orbit').reduce((sum, event) => sum + event.strength, 0);
    const noteSpark = noteEvents.filter((event) => event.structure === 'spark-belt' || event.structure === 'golden-escape').reduce((sum, event) => sum + event.strength, 0);

    for (const node of active) {
      const p = node.profile;
      node.energy =
        (bands.sub ?? 0) * p.sub +
        (bands.bass ?? 0) * p.bass +
        (bands.lowMid ?? 0) * p.lowMid +
        (bands.mid ?? 0) * p.mid +
        (bands.highMid ?? 0) * p.highMid +
        (bands.high ?? 0) * p.high +
        bloom * 0.65;
      const compress = 1 - Math.min(0.42, bassPull * 0.16 + noteGravity * 0.035);
      const orbit = time * (0.18 + midTwist * 0.45 + noteOrbit * 0.04) + node.index * 2.07;
      const base = node.base;
      const nonCoplanar = [
        Math.sin(orbit * 0.7 + node.index) * (4 + midTwist * 9),
        Math.cos(orbit * 0.9 + node.index * 0.6) * (3 + midTwist * 7),
        Math.sin(orbit * 1.1 + node.index * 1.4) * (5 + midTwist * 10)
      ];
      const desired = [
        base[0] * compress + nonCoplanar[0] + Math.sin(time * 1.7 + node.index) * (highSpark + noteSpark * 0.2) * 3.2,
        base[1] * compress + nonCoplanar[1] + Math.sin(time * 1.2 + node.index) * bloom * 5,
        base[2] * compress + nonCoplanar[2] + Math.cos(time * 2.1 + node.index) * (highSpark + noteSpark * 0.2) * 4.2
      ];
      if (node.index !== 0 && active[0]) {
        const bassNode = active[0];
        desired[0] += (bassNode.center[0] - node.center[0]) * Math.min(0.24, bassPull * 0.06);
        desired[1] += (bassNode.center[1] - node.center[1]) * Math.min(0.18, bassPull * 0.04);
        desired[2] += (bassNode.center[2] - node.center[2]) * Math.min(0.24, bassPull * 0.06);
      }
      for (let a = 0; a < active.length; a++) {
        const other = active[a];
        if (other === node) continue;
        const dx = other.center[0] - node.center[0];
        const dy = other.center[1] - node.center[1];
        const dz = other.center[2] - node.center[2];
        const d = Math.hypot(dx, dy, dz) || 1;
        const targetDistance = 32 + (node.index + other.index) * 2;
        const spring = (d - targetDistance) * 0.003 * interaction * (0.35 + bassPull * 0.8);
        desired[0] += dx / d * spring * 28;
        desired[1] += dy / d * spring * 18;
        desired[2] += dz / d * spring * 28;
      }
      node.center[0] += (desired[0] - node.center[0]) * (1 - Math.pow(0.02, Math.max(0.001, dt)));
      node.center[1] += (desired[1] - node.center[1]) * (1 - Math.pow(0.02, Math.max(0.001, dt)));
      node.center[2] += (desired[2] - node.center[2]) * (1 - Math.pow(0.02, Math.max(0.001, dt)));
    }

    const bridges = [];
    if (active.length > 1) {
      for (let i = 0; i < active.length; i++) {
        const a = active[i];
        const b = active[(i + 1) % active.length];
        bridges.push({
          from: a.index,
          to: b.index,
          strength: Math.min(1, exchange * interaction * (bassPull * 0.25 + midTwist * 0.48 + highSpark * 0.55 + bloom * 0.8)),
          bass: Math.min(1, bassPull),
          vocal: Math.min(1, midTwist),
          spark: Math.min(1, highSpark + bloom * 0.6),
          bloom: Math.min(1, bloom)
        });
      }
    }
    this.writeParams(bridges);
  }

  writeParams(bridges) {
    const active = this.nodes.slice(0, Math.max(1, Math.min(this.params.nodeCount ?? 3, this.nodes.length)));
    this.params.nebulaNodes = active.map((node) => ({
      index: node.index,
      name: node.name,
      center: [...node.center],
      size: node.size,
      palette: [...node.palette],
      profile: { ...node.profile },
      energy: node.energy
    }));
    this.params.nebulaBridges = bridges;
  }
}

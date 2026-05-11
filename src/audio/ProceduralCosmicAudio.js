export class ProceduralCosmicAudio {
  constructor(params) {
    this.params = params;
    this.enabled = false;
    this.context = null;
    this.nodes = [];
  }

  async start() {
    if (this.enabled) return;
    this.context = new AudioContext();
    const master = this.context.createGain();
    master.gain.value = 0.035;
    master.connect(this.context.destination);
    this.master = master;
    for (const freq of [55, 82.41, 110, 164.81]) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(master);
      osc.start();
      this.nodes.push({ osc, gain, base: freq });
    }
    const crackle = this.context.createBufferSource();
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.035;
    crackle.buffer = buffer;
    crackle.loop = true;
    const crackleGain = this.context.createGain();
    crackleGain.gain.value = 0.0;
    crackle.connect(crackleGain).connect(master);
    crackle.start();
    this.crackleGain = crackleGain;
    this.enabled = true;
    this.params.proceduralAudio = true;
  }

  update(universe) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const biomeColor = universe.biomes.primary.influence.color;
    const convergence = universe.harmonics.convergence;
    const entities = universe.entities.entities.length;
    const horizon = this.params.eventHorizon;
    this.nodes.forEach((node, i) => {
      const target = node.base * (1 + biomeColor * 0.08 + this.params.recursiveDepth * 0.015 + i * convergence * 0.003);
      node.osc.frequency.setTargetAtTime(target, now, 0.4);
      node.gain.gain.setTargetAtTime(0.025 + convergence * 0.055 + entities * 0.006, now, 0.8);
    });
    this.crackleGain.gain.setTargetAtTime(horizon * 0.06 + this.params.audioTreble * 0.02, now, 0.3);
    this.master.gain.setTargetAtTime(0.018 + convergence * 0.02 + horizon * 0.02, now, 1.2);
  }
}

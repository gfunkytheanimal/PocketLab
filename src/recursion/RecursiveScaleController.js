export class RecursiveScaleController {
  constructor(params) {
    this.params = params;
    this.band = 0;
    this.local = 0;
    this.depthBlend = 0;
    this.paletteShift = 0;
    this.scaleFactor = 3.25;
  }

  update(camera, dt, audio = null) {
    const travel = Math.max(0, -camera.position.z + camera.forwardTravel);
    const bandSize = this.params.scaleBandSize;
    const phase = travel / bandSize;
    this.band = Math.floor(phase);
    this.local = phase - this.band;
    this.depthBlend = this.local * this.local * (3 - 2 * this.local);
    this.paletteShift = (this.band * 0.173 + this.depthBlend * 0.31 + (audio?.treble ?? 0) * 0.08) % 1;
    this.params.recursiveDepth = this.band;
    this.params.recursiveBlend = this.depthBlend;
    this.params.paletteShift = this.paletteShift;
  }

  remap(position) {
    const scale = Math.pow(this.scaleFactor, this.depthBlend);
    const angle = this.band * 0.77 + this.depthBlend * 1.91;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const x = position[0] * scale;
    const z = position[2] * scale;
    return [
      x * ca - z * sa,
      position[1] * (0.82 + this.depthBlend * 0.4),
      x * sa + z * ca
    ];
  }

  fieldMutation() {
    return {
      morphOffset: this.band * 9.37,
      strength: 1 + this.depthBlend * 0.35,
      recursiveBoost: this.depthBlend * 0.08
    };
  }
}

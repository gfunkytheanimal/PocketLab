import * as THREE from 'three';

const MAX_PAIR_FILAMENTS = 18;

export class FilamentLayer {
  constructor(scene, state) {
    this.state = state;
    this.group = new THREE.Group();
    this.group.name = 'volumetric-field-filaments';
    scene.add(this.group);
    this.clock = 0;
  }

  update(dt) {
    this.clock += dt;
    this.clear();
    this.group.visible = this.state.showFilaments && this.state.showParticles;
    if (!this.group.visible) return;
    this.drawPairFilaments();
    this.drawLocalFilaments();
  }

  drawPairFilaments() {
    const bodies = this.state.bodies.filter((body) => this.isEmitter(body));
    const pairs = [];
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const distance = a.position.distanceTo(b.position);
        const maxDistance = (this.state.boundsSize ?? 820) * 0.55;
        if (distance > maxDistance) continue;
        const charge = Math.abs(a.charge ?? 0) + Math.abs(b.charge ?? 0);
        const heat = (a.heat ?? 0) + (b.heat ?? 0) + (a.fieldStress ?? 0) + (b.fieldStress ?? 0);
        const gravity = Math.sqrt(Math.max(0, a.mass * b.mass)) / Math.max(22, distance);
        const strength = gravity + charge * 0.18 + heat * 0.35;
        if (strength < 0.18) continue;
        pairs.push({ a, b, distance, strength });
      }
    }
    pairs.sort((a, b) => b.strength - a.strength);
    for (const pair of pairs.slice(0, MAX_PAIR_FILAMENTS)) {
      const count = pair.a.type === 'blackhole' || pair.b.type === 'blackhole' ? 3 : 2;
      for (let i = 0; i < count; i++) this.addFilament(pair.a, pair.b, pair.strength, i);
    }
  }

  drawLocalFilaments() {
    const bodies = this.state.bodies.filter((body) => this.isEmitter(body));
    for (const body of bodies) {
      const loops = body.type === 'blackhole' ? 9 : body.type === 'star' ? 7 : ['portal', 'ufo', 'gas'].includes(body.type) ? 5 : 3;
      const activity = Math.min(1.8, 0.35 + (body.accretion ?? 0) * 0.25 + (body.heat ?? 0) * 0.7 + (body.fieldStress ?? 0) * 0.9 + Math.abs(body.charge ?? 0) * 0.18);
      if (activity < 0.42 && body.type !== 'blackhole') continue;
      for (let i = 0; i < loops; i++) {
        const phase = this.clock * (0.18 + i * 0.014) + body.id * 0.37 + i * Math.PI * 2 / loops;
        const radius = body.radius * (2.1 + i * 0.33 + activity * 0.8);
        const points = [];
        const turns = body.type === 'blackhole' ? 1.45 : 0.85;
        for (let s = 0; s <= 52; s++) {
          const t = s / 52;
          const angle = phase + t * Math.PI * 2 * turns;
          const wobble = Math.sin(t * Math.PI * 5 + this.clock * 1.7 + i) * body.radius * 0.22 * activity;
          points.push(new THREE.Vector3(
            body.position.x + Math.cos(angle) * (radius + wobble),
            body.position.y + Math.sin(angle) * (radius * (0.62 + activity * 0.08) - wobble * 0.4),
            body.position.z + Math.sin(angle * 1.7 + phase) * body.radius * (0.25 + activity * 0.28)
          ));
        }
        const material = this.materialFor(body, activity, i);
        this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
      }
    }
  }

  addFilament(a, b, strength, lane) {
    const start = a.position;
    const end = b.position;
    const delta = end.clone().sub(start);
    const distance = Math.max(1, delta.length());
    const dir = delta.clone().normalize();
    const side = new THREE.Vector3(-dir.y, dir.x, dir.z * 0.22).normalize();
    if (side.lengthSq() < 0.01) side.set(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(dir, side).normalize();
    const points = [];
    const phase = this.clock * (0.9 + lane * 0.17) + a.id * 0.31 + b.id * 0.11;
    const amp = Math.min(90, distance * 0.16) * (0.55 + strength * 0.45);
    for (let i = 0; i <= 54; i++) {
      const t = i / 54;
      const breathe = Math.sin(t * Math.PI * 2.0 + phase) * amp;
      const curl = Math.sin(t * Math.PI * 6.0 + phase * 1.4 + lane) * amp * 0.34;
      points.push(start.clone()
        .lerp(end, t)
        .addScaledVector(side, breathe)
        .addScaledVector(up, curl + Math.sin(t * Math.PI) * amp * 0.26)
      );
    }
    const color = this.mixColor(a, b, strength);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(0.42, 0.08 + strength * 0.16),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  materialFor(body, activity, index) {
    const color = body.type === 'blackhole'
      ? new THREE.Color(index % 2 ? 0xff8a32 : 0x72eaff)
      : body.type === 'star'
        ? new THREE.Color(0xffd36b)
        : body.type === 'gas'
          ? new THREE.Color(0x9b7cff)
          : body.type === 'ufo'
            ? new THREE.Color(0x72fff0)
            : body.type === 'portal'
              ? new THREE.Color(0x50ffc8)
              : new THREE.Color(0x8ff7ff);
    return new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(0.5, 0.08 + activity * 0.13),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }

  mixColor(a, b, strength) {
    if (a.type === 'blackhole' || b.type === 'blackhole') return strength > 1.2 ? 0xff8a32 : 0x72eaff;
    if (a.type === 'star' || b.type === 'star') return 0xffd36b;
    if (a.type === 'ufo' || b.type === 'ufo') return 0x72fff0;
    if (a.type === 'portal' || b.type === 'portal') return 0x9dffef;
    if (a.type === 'gas' || b.type === 'gas') return 0xb58cff;
    return 0x8ff7ff;
  }

  isEmitter(body) {
    if (body.category === 'dust' || body.category === 'debris') return false;
    return body.mass > 18
      || Math.abs(body.charge ?? 0) > 0.4
      || (body.heat ?? 0) > 0.25
      || (body.fieldStress ?? 0) > 0.18
      || ['blackhole', 'star', 'portal', 'ufo', 'gas', 'magnet'].includes(body.type);
  }

  clear() {
    while (this.group.children.length) {
      const child = this.group.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }
}

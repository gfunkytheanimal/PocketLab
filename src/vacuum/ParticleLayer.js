import * as THREE from 'three';

const MAX_PARTICLES = 1800;

export class ParticleLayer {
  constructor(scene, state) {
    this.state = state;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alpha = new Float32Array(MAX_PARTICLES);
    this.mode = new Float32Array(MAX_PARTICLES);
    this.velocities = Array.from({ length: MAX_PARTICLES }, () => new THREE.Vector3());
    this.life = new Float32Array(MAX_PARTICLES);
    this.age = new Float32Array(MAX_PARTICLES);
    this.kind = new Array(MAX_PARTICLES).fill('spark');
    this.cursor = 0;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    geometry.setAttribute('mode', new THREE.BufferAttribute(this.mode, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute float mode;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vMode;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vMode = mode;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (420.0 / max(80.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vMode;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          float core = smoothstep(0.22, 0.0, r);
          float halo = smoothstep(0.5, 0.04, r) * 0.34;
          float ring = smoothstep(0.24, 0.16, abs(r - 0.26)) * 0.12;
          float cross = (smoothstep(0.05, 0.0, abs(d.x)) + smoothstep(0.05, 0.0, abs(d.y))) * smoothstep(0.5, 0.04, r) * 0.18;
          float plasma = smoothstep(0.5, 0.0, r) * (0.55 + 0.45 * sin((d.x + d.y) * 34.0));
          float shape = core + halo;
          if (vMode > 0.5 && vMode < 1.5) shape += ring;
          if (vMode >= 1.5 && vMode < 2.5) shape += cross;
          if (vMode >= 2.5) shape += plasma * 0.22;
          vec3 color = vColor * (1.0 + core * 1.8 + halo * 0.65);
          gl_FragColor = vec4(color, clamp(shape * vAlpha, 0.0, 1.0));
        }
      `
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(position, color = 0x7df7ff, count = 28, speed = 85, kind = 'spark') {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const dir = randomDirection().multiplyScalar(speed * (0.28 + Math.random() * 0.9));
      this.positions[idx * 3] = position.x;
      this.positions[idx * 3 + 1] = position.y;
      this.positions[idx * 3 + 2] = position.z;
      this.colors[idx * 3] = c.r;
      this.colors[idx * 3 + 1] = c.g;
      this.colors[idx * 3 + 2] = c.b;
      this.sizes[idx] = 7 + Math.random() * 12;
      this.alpha[idx] = 0.92;
      this.mode[idx] = modeForKind(kind);
      this.velocities[idx].copy(dir);
      this.life[idx] = 0.6 + Math.random() * 1.4;
      this.age[idx] = 0;
      this.kind[idx] = kind;
    }
  }

  update(dt) {
    this.points.visible = this.state.showParticles;
    if (!this.state.showParticles) return;
    this.emitBodyParticles(dt);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.life[i] = 0;
        this.sizes[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      const fade = 1 - this.age[i] / this.life[i];
      const velocity = this.velocities[i];
      if (this.kind[i] === 'accretion') velocity.multiplyScalar(0.992);
      if (this.kind[i] === 'comet') velocity.multiplyScalar(0.985);
      this.positions[i * 3] += velocity.x * dt;
      this.positions[i * 3 + 1] += velocity.y * dt;
      this.positions[i * 3 + 2] += velocity.z * dt;
      this.sizes[i] *= this.kind[i] === 'radiation' ? 1.003 : 0.987;
      this.alpha[i] = Math.max(0, fade * fade);
      this.colors[i * 3] *= 0.997 + fade * 0.002;
      this.colors[i * 3 + 1] *= 0.996 + fade * 0.003;
      this.colors[i * 3 + 2] *= 0.995 + fade * 0.004;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
    this.points.geometry.attributes.mode.needsUpdate = true;
  }

  emitBodyParticles(dt) {
    for (const body of this.state.bodies) {
      if (body.type === 'comet' && Math.random() < dt * 24) {
        const back = body.velocity.lengthSq() > 1 ? body.velocity.clone().normalize().multiplyScalar(-1) : randomDirection();
        this.emitOne(body.position, back, 0xbdf9ff, 36, 'comet');
      }
      if (body.type === 'blackhole' && (body.accretion ?? 0) > 0.5 && Math.random() < dt * 70) {
        const tangent = randomDirection();
        tangent.z *= 0.18;
        tangent.normalize();
        const radius = body.radius * (2.4 + Math.random() * 2.6);
        const pos = body.position.clone().add(tangent.clone().multiplyScalar(radius));
        const swirl = new THREE.Vector3(-tangent.y, tangent.x, tangent.z * 0.2).multiplyScalar(90 + body.accretion * 18);
        this.emitOne(pos, swirl, Math.random() > 0.35 ? 0xff9d42 : 0x72f7ff, 54, 'accretion');
      }
      if (body.type === 'gas' && Math.random() < dt * 18) {
        this.emitOne(body.position.clone().add(randomDirection().multiplyScalar(body.radius * Math.random())), randomDirection(), body.heat > 0.4 ? 0xffb35d : 0x9b7cff, 22, 'gas');
      }
      if (body.type === 'star' && Math.random() < dt * 34) {
        const dir = randomDirection();
        const pos = body.position.clone().add(dir.clone().multiplyScalar(body.radius * (1.1 + Math.random() * 0.35)));
        this.emitOne(pos, dir, Math.random() > 0.3 ? 0xffd86b : 0xff6838, 38 + body.fieldStress * 80, 'radiation');
      }
      if (body.type === 'laser' && Math.random() < dt * 52) {
        const back = body.velocity.lengthSq() > 1 ? body.velocity.clone().normalize().multiplyScalar(-1) : randomDirection();
        this.emitOne(body.position, back, 0xff3c72, 80, 'laser');
      }
      if (body.type === 'ufo' && ((body.tractorActive ?? 0) > 0 || body.fieldStress > 0.25) && Math.random() < dt * 18) {
        const swirl = randomDirection();
        swirl.z = -Math.abs(swirl.z) - 0.25;
        this.emitOne(body.position.clone().add(randomDirection().multiplyScalar(body.radius * 0.9)), swirl.normalize(), Math.random() > 0.45 ? 0x72fff0 : 0xff74ef, 34 + Math.abs(body.charge ?? 0) * 22, 'spark');
      }
      if (body.type === 'portal' && Math.random() < dt * 24) {
        const dir = randomDirection();
        this.emitOne(body.position.clone().add(dir.clone().multiplyScalar(body.radius * 0.7)), new THREE.Vector3(-dir.y, dir.x, dir.z * 0.5).normalize(), Math.random() > 0.5 ? 0x72fff0 : 0xc35cff, 46 + body.heat * 40, 'spark');
      }
      if (body.type === 'magnet' && Math.random() < dt * 20) {
        const dir = randomDirection();
        this.emitOne(body.position.clone().add(dir.clone().multiplyScalar(body.radius * 1.2)), dir, Math.random() > 0.5 ? 0xff4ed6 : 0x72fff0, 30 + Math.abs(body.charge ?? 0) * 20, 'spark');
      }
      if (body.type === 'alien' && ((body.heat ?? 0) > 0.18 || body.fieldStress > 0.3) && Math.random() < dt * 8) {
        this.emitOne(body.position.clone().add(randomDirection().multiplyScalar(body.radius * 0.6)), randomDirection(), 0x7dffb3, 16, 'gas');
      }
      if ((body.heat ?? 0) > 0.55 && body.type !== 'star' && Math.random() < dt * (10 + body.heat * 28)) {
        const drift = randomDirection().multiplyScalar(0.35);
        drift.y += 0.45;
        const color = body.category === 'spacecraft' ? 0xffc28a : 0xff7a3a;
        this.emitOne(body.position.clone().add(randomDirection().multiplyScalar(body.radius * 0.9)), drift.normalize(), color, 28 + body.heat * 42, 'radiation');
      }
    }
  }

  emitOne(position, direction, color, speed, kind) {
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    const c = new THREE.Color(color);
    this.positions[idx * 3] = position.x;
    this.positions[idx * 3 + 1] = position.y;
    this.positions[idx * 3 + 2] = position.z;
    this.colors[idx * 3] = c.r;
    this.colors[idx * 3 + 1] = c.g;
    this.colors[idx * 3 + 2] = c.b;
    this.sizes[idx] = kind === 'accretion' ? 10 : kind === 'radiation' ? 8 : kind === 'gas' ? 9 : 6;
    this.alpha[idx] = kind === 'radiation' ? 0.82 : 0.9;
    this.mode[idx] = modeForKind(kind);
    this.velocities[idx].copy(direction).multiplyScalar(speed * (0.35 + Math.random() * 0.9));
    this.life[idx] = kind === 'accretion' ? 1.4 : kind === 'radiation' ? 0.65 : 0.9;
    this.age[idx] = 0;
    this.kind[idx] = kind;
  }

  clear() {
    this.life.fill(0);
    this.age.fill(0);
    this.sizes.fill(0);
    this.alpha.fill(0);
    this.mode.fill(0);
    this.positions.fill(0);
    this.colors.fill(0);
    this.cursor = 0;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
    this.points.geometry.attributes.mode.needsUpdate = true;
  }
}

function modeForKind(kind) {
  if (kind === 'accretion' || kind === 'comet') return 1;
  if (kind === 'radiation' || kind === 'laser') return 2;
  if (kind === 'gas') return 3;
  return 0;
}

function randomDirection() {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
}

import * as THREE from 'three';
import { createSoftParticleTexture } from './SoftParticleTexture.js';

const MAX_PAINT_POINTS = 9000;

export class PaintLayer {
  constructor(scene, state) {
    this.state = state;
    this.positions = new Float32Array(MAX_PAINT_POINTS * 3);
    this.colors = new Float32Array(MAX_PAINT_POINTS * 3);
    this.sizes = new Float32Array(MAX_PAINT_POINTS);
    this.alpha = new Float32Array(MAX_PAINT_POINTS);
    this.twinkle = new Float32Array(MAX_PAINT_POINTS);
    this.count = 0;
    this.cursor = 0;
    this.time = 0;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    geometry.setAttribute('twinkle', new THREE.BufferAttribute(this.twinkle, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uTexture: { value: createSoftParticleTexture('paint-layer-soft', {
          core: 'rgba(255,255,255,0.96)',
          mid: 'rgba(165,230,255,0.2)',
          falloff: 0.68,
          wisps: false
        }) },
        uTime: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute float twinkle;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vTwinkle;
        uniform float uTime;
        void main() {
          vColor = color;
          vTwinkle = 0.75 + 0.25 * sin(uTime * (0.6 + twinkle * 1.7) + twinkle * 19.0);
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (430.0 / max(90.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vTwinkle;
        void main() {
          float a = texture2D(uTexture, gl_PointCoord).a;
          gl_FragColor = vec4(vColor * (1.0 + vTwinkle * 0.65), a * vAlpha * vTwinkle);
        }
      `
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  stamp(origin, mode, brushSize = 1, brushStrength = 1) {
    const count = Math.round((mode === 'gas' ? 120 : mode === 'heat' ? 72 : 84) * brushStrength);
    const radius = (mode === 'gas' ? 78 : mode === 'heat' ? 54 : 64) * brushSize;
    const palette = paletteFor(mode);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PAINT_POINTS;
      this.count = Math.min(MAX_PAINT_POINTS, this.count + 1);
      const dir = randomDirection();
      const r = Math.pow(Math.random(), mode === 'gas' ? 0.38 : 0.62) * radius;
      const p = origin.clone().addScaledVector(dir, r);
      this.positions[idx * 3] = p.x;
      this.positions[idx * 3 + 1] = p.y;
      this.positions[idx * 3 + 2] = p.z;
      const color = new THREE.Color(palette[i % palette.length]).lerp(new THREE.Color(0xffffff), Math.random() * 0.24);
      this.colors[idx * 3] = color.r;
      this.colors[idx * 3 + 1] = color.g;
      this.colors[idx * 3 + 2] = color.b;
      this.sizes[idx] = (mode === 'gas' ? 10 : mode === 'heat' ? 13 : 7) * (0.55 + Math.random() * 1.4) * brushSize;
      this.alpha[idx] = mode === 'gas' ? 0.16 + Math.random() * 0.24 : mode === 'heat' ? 0.2 + Math.random() * 0.32 : 0.5 + Math.random() * 0.42;
      this.twinkle[idx] = Math.random();
    }
    this.markDirty();
  }

  update(dt) {
    this.points.visible = this.state.showParticles;
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
  }

  clear() {
    this.count = 0;
    this.cursor = 0;
    this.positions.fill(0);
    this.colors.fill(0);
    this.sizes.fill(0);
    this.alpha.fill(0);
    this.twinkle.fill(0);
    this.markDirty();
  }

  markDirty() {
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
    this.points.geometry.attributes.twinkle.needsUpdate = true;
  }
}

function paletteFor(mode) {
  if (mode === 'gas') return [0x7dffda, 0x3556ff, 0xae72ff, 0x59d5ff];
  if (mode === 'charge') return [0xff4fd8, 0x50ffe7, 0x74a4ff, 0xffffff];
  if (mode === 'heat') return [0xff7a32, 0xffd36b, 0xff335c, 0xffffff];
  return [0x9fefff, 0x72fff0, 0xffffff, 0xffd36b, 0xc35cff];
}

function randomDirection() {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
}

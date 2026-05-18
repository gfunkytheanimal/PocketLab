import * as THREE from 'three';

const cache = new Map();

export function createSoftParticleTexture(key = 'mist', options = {}) {
  if (cache.has(key)) return cache.get(key);

  const {
    size = 128,
    core = 'rgba(255,255,255,0.95)',
    mid = 'rgba(210,245,255,0.34)',
    edge = 'rgba(255,255,255,0)',
    falloff = 0.92,
    wisps = true
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const center = size * 0.5;
  const radius = size * 0.5;

  const gradient = context.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, core);
  gradient.addColorStop(0.28, mid);
  gradient.addColorStop(falloff, edge);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  if (wisps) {
    context.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const x = center + (Math.random() - 0.5) * radius * 0.75;
      const y = center + (Math.random() - 0.5) * radius * 0.75;
      const r = radius * (0.12 + Math.random() * 0.28);
      const haze = context.createRadialGradient(x, y, 0, x, y, r);
      haze.addColorStop(0, 'rgba(255,255,255,0.12)');
      haze.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = haze;
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, texture);
  return texture;
}

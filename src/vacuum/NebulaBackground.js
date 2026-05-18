import * as THREE from 'three';

export class NebulaBackground {
  constructor(scene, state) {
    this.state = state;
    this.group = new THREE.Group();
    this.group.name = 'distant-nebula-background';
    this.group.renderOrder = -20;
    this.layers = [];
    this.fossils = [];
    this.fossilGroup = new THREE.Group();
    this.fossilGroup.name = 'fossilized-universe-backdrops';
    this.textures = [
      createNebulaTexture('#1bb7ff', '#4927ff'),
      createNebulaTexture('#ff7a32', '#ff1e82'),
      createNebulaTexture('#56ffd2', '#203cff')
    ];
    this.createClouds();
    this.group.add(this.fossilGroup);
    scene.add(this.group);
  }

  createClouds() {
    const palettes = [
      { color: 0x59d5ff, opacity: 0.055, size: [1050, 540] },
      { color: 0xff7c43, opacity: 0.038, size: [920, 500] },
      { color: 0x7dffda, opacity: 0.032, size: [820, 460] }
    ];
    for (let i = 0; i < 8; i++) {
      const p = palettes[i % palettes.length];
      const material = new THREE.SpriteMaterial({
        map: this.textures[i % this.textures.length],
        color: p.color,
        transparent: true,
        opacity: p.opacity * (0.72 + Math.random() * 0.7),
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
      });
      const sprite = new THREE.Sprite(material);
      const dir = randomDirection();
      const radius = 1300 + Math.random() * 1850;
      sprite.position.copy(dir.multiplyScalar(radius));
      sprite.scale.set(
        p.size[0] * (0.48 + Math.random() * 0.55),
        p.size[1] * (0.48 + Math.random() * 0.55),
        1
      );
      sprite.material.rotation = Math.random() * Math.PI * 2;
      sprite.renderOrder = -20;
      sprite.frustumCulled = false;
      sprite.userData.spin = (Math.random() - 0.5) * 0.01;
      sprite.userData.baseOpacity = material.opacity;
      this.group.add(sprite);
      this.layers.push(sprite);
    }
  }

  update(dt, camera) {
    this.group.visible = this.state.showParticles;
    if (!this.group.visible) return;
    this.group.position.copy(camera.position);
    this.group.rotation.y += dt * 0.0015;
    this.group.rotation.x = Math.sin(performance.now() * 0.00003) * 0.04;
    for (const sprite of this.layers) {
      sprite.material.rotation += sprite.userData.spin * dt;
      sprite.material.opacity = sprite.userData.baseOpacity * (this.state.nebulaOpacity ?? 1);
    }
    for (const fossil of this.fossils) {
      fossil.material.rotation += fossil.userData.spin * dt;
      fossil.material.opacity = fossil.userData.baseOpacity * (this.state.nebulaOpacity ?? 1);
    }
  }

  addFossilLayer(snapshot) {
    if (!snapshot.length) return;
    const texture = createFossilTexture(snapshot);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(material);
    const dir = randomDirection();
    const radius = 1500 + Math.random() * 2300;
    sprite.position.copy(dir.multiplyScalar(radius));
    const mass = snapshot.reduce((sum, item) => sum + Math.max(0.2, item.mass ?? 0.2), 0);
    const span = snapshotSpan(snapshot);
    const scale = THREE.MathUtils.clamp(340 + Math.sqrt(mass) * 58 + span * 1.2, 420, 1450);
    sprite.scale.set(scale * (1.1 + Math.random() * 0.5), scale * (0.62 + Math.random() * 0.32), 1);
    sprite.material.rotation = Math.random() * Math.PI * 2;
    sprite.renderOrder = -18;
    sprite.frustumCulled = false;
    sprite.userData.spin = (Math.random() - 0.5) * 0.006;
    sprite.userData.baseOpacity = material.opacity;
    this.fossilGroup.add(sprite);
    this.fossils.push(sprite);
    while (this.fossils.length > 8) {
      const old = this.fossils.shift();
      this.fossilGroup.remove(old);
      disposeSprite(old);
    }
  }

  clearFossils() {
    const count = this.fossils.length;
    for (const fossil of this.fossils) {
      this.fossilGroup.remove(fossil);
      disposeSprite(fossil);
    }
    this.fossils = [];
    return count;
  }
}

function createNebulaTexture(colorA, colorB) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const centerX = 128 + (Math.random() - 0.5) * 26;
  const centerY = 128 + (Math.random() - 0.5) * 26;
  const gradient = ctx.createRadialGradient(centerX, centerY, 6, centerX, centerY, 124);
  gradient.addColorStop(0, hexToRgba(colorA, 0.9));
  gradient.addColorStop(0.28, hexToRgba(colorB, 0.34));
  gradient.addColorStop(0.62, hexToRgba(colorA, 0.11));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 160; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.pow(Math.random(), 0.55) * 115;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * 0.58;
    const w = 9 + Math.random() * 44;
    const h = 2 + Math.random() * 9;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.sin(radius * 0.04) * 0.9);
    ctx.fillStyle = Math.random() > 0.5 ? hexToRgba(colorA, 0.025 + Math.random() * 0.055) : hexToRgba(colorB, 0.025 + Math.random() * 0.06);
    ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
    ctx.restore();
  }

  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(128, 128, 4, 128, 128, 127);
  mask.addColorStop(0, 'rgba(255,255,255,0.95)');
  mask.addColorStop(0.68, 'rgba(255,255,255,0.34)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createFossilTexture(snapshot) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  const center = snapshotCenter(snapshot);
  const span = Math.max(120, snapshotSpan(snapshot));

  ctx.globalCompositeOperation = 'screen';
  const wash = ctx.createRadialGradient(256, 256, 10, 256, 256, 250);
  wash.addColorStop(0, 'rgba(150,230,255,0.22)');
  wash.addColorStop(0.42, 'rgba(40,120,255,0.10)');
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 512, 512);

  for (const body of snapshot) {
    const px = 256 + ((body.position.x - center.x) / span) * 310;
    const py = 256 + ((body.position.y - center.y) / span) * 310;
    const speed = Math.min(160, body.velocity.length ? body.velocity.length() : 0);
    const color = fossilColor(body);
    const size = THREE.MathUtils.clamp((body.radius ?? 4) * 2.2 + Math.sqrt(Math.max(0.1, body.mass ?? 0.1)) * 8, 10, 92);
    const glow = ctx.createRadialGradient(px, py, 1, px, py, size);
    glow.addColorStop(0, hexToRgba(color, 0.72));
    glow.addColorStop(0.28, hexToRgba(color, 0.22));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
    if (speed > 4) {
      const vx = body.velocity.x / Math.max(1, speed);
      const vy = body.velocity.y / Math.max(1, speed);
      const trail = ctx.createLinearGradient(px - vx * size * 2, py - vy * size * 2, px + vx * size * 0.6, py + vy * size * 0.6);
      trail.addColorStop(0, 'rgba(0,0,0,0)');
      trail.addColorStop(1, hexToRgba(color, 0.22));
      ctx.strokeStyle = trail;
      ctx.lineWidth = Math.max(2, size * 0.14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px - vx * speed * 1.4, py - vy * speed * 1.4);
      ctx.lineTo(px + vx * size * 0.7, py + vy * size * 0.7);
      ctx.stroke();
    }
  }

  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(256, 256, 18, 256, 256, 254);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.72, 'rgba(255,255,255,0.62)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function snapshotCenter(snapshot) {
  const center = new THREE.Vector3();
  let total = 0;
  for (const body of snapshot) {
    const weight = Math.max(0.1, body.mass ?? 0.1);
    center.addScaledVector(body.position, weight);
    total += weight;
  }
  return total > 0 ? center.multiplyScalar(1 / total) : center;
}

function snapshotSpan(snapshot) {
  const center = snapshotCenter(snapshot);
  let span = 1;
  for (const body of snapshot) span = Math.max(span, body.position.distanceTo(center));
  return span;
}

function fossilColor(body) {
  if (body.category === 'singularity' || body.type === 'blackhole') return '#ff8a42';
  if (body.type === 'star') return '#fff2a6';
  if (body.category === 'gas' || body.type === 'gas') return '#7dffda';
  if (body.category === 'spacecraft') return '#c8e4ff';
  if (body.category === 'life') return '#b7ffbb';
  if ((body.heat ?? 0) > 0.45) return '#ff4c28';
  if (Math.abs(body.charge ?? 0) > 0.4) return '#ff4fd8';
  return '#9fefff';
}

function disposeSprite(sprite) {
  sprite.material.map?.dispose();
  sprite.material.dispose();
}

function hexToRgba(hex, alpha) {
  const color = new THREE.Color(hex);
  return `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${alpha})`;
}

function randomDirection() {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
}

import * as THREE from 'three';

const COLORS = {
  stagnation: 0x72fff0,
  barrier: 0xffb35d,
  'shock-front': 0xff6a32,
  'stress-knot': 0xc35cff,
  'vortex-lock': 0x7dff9b,
  unknown: 0xffffff
};

export class FieldEventOverlay {
  constructor(scene, state, scanner, maxMarkers = 8) {
    this.state = state;
    this.scanner = scanner;
    this.group = new THREE.Group();
    this.group.name = 'field-event-scanner-overlay';
    this.group.renderOrder = 38;
    this.markers = [];
    for (let i = 0; i < maxMarkers; i++) {
      const marker = createMarker();
      marker.group.visible = false;
      this.group.add(marker.group);
      this.markers.push(marker);
    }
    scene.add(this.group);
  }

  update(dt, camera) {
    this.group.visible = this.state.showScanner;
    if (!this.state.showScanner) {
      for (const marker of this.markers) marker.group.visible = false;
      return;
    }

    const events = this.scanner.events ?? [];
    for (let i = 0; i < this.markers.length; i++) {
      const marker = this.markers[i];
      const event = events[i];
      if (!event) {
        marker.group.visible = false;
        continue;
      }
      const color = new THREE.Color(COLORS[event.type] ?? COLORS.unknown);
      const fade = THREE.MathUtils.clamp(event.lifetime / 2.2, 0, 1);
      const pulse = 0.82 + Math.sin(performance.now() * 0.004 + i) * 0.12;
      marker.group.visible = true;
      marker.group.position.set(event.x, event.y, event.z ?? 0);
      marker.group.quaternion.copy(camera.quaternion);
      marker.group.scale.setScalar(event.radius * (0.72 + event.strength * 0.08) * pulse);
      marker.ring.material.color.copy(color);
      marker.ring.material.opacity = 0.055 * fade + 0.018;
      marker.inner.material.color.copy(color);
      marker.inner.material.opacity = 0.22 * fade;
      marker.tick.material.color.copy(color);
      marker.tick.material.opacity = 0.28 * fade;
      marker.tick.rotation.z += dt * (0.85 + event.strength * 0.35);
      marker.label.visible = event.strength > 0.35;
      marker.label.position.set(0, 0.78, 0.02);
      marker.label.material.opacity = 0.58 * fade;
      if (marker.lastLabel !== event.label) {
        marker.lastLabel = event.label;
        updateLabel(marker, event);
      }
    }
  }

  clear() {
    for (const marker of this.markers) marker.group.visible = false;
  }
}

function createMarker() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.965, 1, 96),
    new THREE.MeshBasicMaterial({
      color: 0x72fff0,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(0.045, 0.075, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  const tick = new THREE.LineSegments(
    tickGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x72fff0,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createLabelTexture('ANOMALY', 0xffffff),
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    })
  );
  label.scale.set(1.05, 0.26, 1);
  group.add(ring, inner, tick, label);
  return { group, ring, inner, tick, label, lastLabel: '' };
}

function tickGeometry() {
  const points = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const inner = 0.72;
    const outer = i % 3 === 0 ? 0.86 : 0.8;
    points.push(Math.cos(a) * inner, Math.sin(a) * inner, 0.01);
    points.push(Math.cos(a) * outer, Math.sin(a) * outer, 0.01);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
}

function updateLabel(marker, event) {
  const old = marker.label.material.map;
  marker.label.material.map = createLabelTexture(`${event.label} ${event.persistenceFrames}F`, COLORS[event.type] ?? COLORS.unknown);
  marker.label.material.needsUpdate = true;
  old?.dispose?.();
}

function createLabelTexture(text, colorValue) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const color = `#${new THREE.Color(colorValue).getHexString()}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(1, 8, 14, 0.72)';
  roundRect(ctx, 18, 26, 476, 68, 14);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 26, 476, 68, 14);
  ctx.stroke();
  ctx.fillStyle = '#ecfeff';
  ctx.font = '700 28px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 61);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

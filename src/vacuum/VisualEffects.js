import * as THREE from 'three';

export class VisualEffects {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.trailGroup = new THREE.Group();
    this.fieldGroup = new THREE.Group();
    this.wellGroup = new THREE.Group();
    this.boundaryGroup = new THREE.Group();
    this.depthGroup = new THREE.Group();
    this.fogGroup = new THREE.Group();
    this.topologyGroup = new THREE.Group();
    this.selectionGroup = new THREE.Group();
    scene.add(this.trailGroup, this.fieldGroup, this.wellGroup, this.boundaryGroup, this.depthGroup, this.fogGroup, this.topologyGroup, this.selectionGroup);
    this.trailMaterials = new Map();
  }

  update() {
    this.clearGroup(this.trailGroup);
    this.clearGroup(this.fieldGroup);
    this.clearGroup(this.wellGroup);
    this.clearGroup(this.boundaryGroup);
    this.clearGroup(this.depthGroup);
    this.clearGroup(this.fogGroup);
    this.clearGroup(this.topologyGroup);
    this.clearGroup(this.selectionGroup);
    if (this.state.showBounds) this.drawBoundary();
    if (this.state.showBounds || this.state.showTopology) this.drawDepthGuides();
    if (this.state.showBounds || this.state.showTopology) this.drawSelectionMarker();
    if (this.state.showTrails) this.drawTrails();
    if (this.state.showFields) {
      this.drawWells();
      this.drawFieldFog();
      this.drawSpacetimeVolumes();
      this.drawMagneticFields();
      this.drawFieldArrows();
    }
    if (this.state.showTopology) {
      this.drawTopologyContours();
      if (!this.state.showFields) this.drawSpacetimeVolumes();
    }
  }

  drawBoundary() {
    const half = (this.state.boundsSize ?? 820) * 0.5;
    const corners = [
      [-half, -half, -half], [half, -half, -half], [half, half, -half], [-half, half, -half],
      [-half, -half, half], [half, -half, half], [half, half, half], [-half, half, half]
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const points = [];
    for (const [a, b] of edges) {
      points.push(new THREE.Vector3(...corners[a]), new THREE.Vector3(...corners[b]));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x284a63, transparent: true, opacity: 0.1, depthWrite: false });
    this.boundaryGroup.add(new THREE.LineSegments(geometry, material));
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(half * 2, half * 2, half * 2),
      new THREE.MeshBasicMaterial({
        color: 0x123447,
        transparent: true,
        opacity: 0.018,
        depthWrite: false,
        side: THREE.BackSide
      })
    );
    this.boundaryGroup.add(shell);
  }

  drawDepthGuides() {
    const guideMaterial = new THREE.LineBasicMaterial({ color: 0x356f86, transparent: true, opacity: 0.16, depthWrite: false });
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x5ff4ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
    for (const body of this.state.bodies) {
      if (Math.abs(body.position.z) < 4) continue;
      const foot = new THREE.Vector3(body.position.x, body.position.y, 0);
      const geometry = new THREE.BufferGeometry().setFromPoints([foot, body.position]);
      this.depthGroup.add(new THREE.Line(geometry, guideMaterial));
      const ring = new THREE.Mesh(new THREE.RingGeometry(body.radius * 0.35, body.radius * 0.48, 28), shadowMaterial);
      ring.position.copy(foot);
      this.depthGroup.add(ring);
    }
  }

  drawMagneticFields() {
    for (const body of this.state.bodies) {
      if (body.type !== 'magnet') continue;
      for (let i = 0; i < 10; i++) {
        const points = [];
        const phase = i / 10 * Math.PI * 2;
        for (let s = -36; s <= 36; s++) {
          const t = s / 36;
          const x = Math.sin(phase) * body.radius * 0.35 + t * body.radius * 7;
          const y = Math.cos(phase) * Math.sin(t * Math.PI) * body.radius * 3.2;
          points.push(new THREE.Vector3(body.position.x + x, body.position.y + y, body.position.z + Math.cos(t * Math.PI) * body.radius * 0.8));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xff55df, transparent: true, opacity: 0.22 });
        this.fieldGroup.add(new THREE.Line(geometry, material));
      }
    }
  }

  drawSelectionMarker() {
    const body = this.state.selected;
    if (!body) return;
    if (body.type === 'blackhole') return;
    const radius = body.radius * (body.collisionScale ?? 1) * 1.45;
    const material = new THREE.MeshBasicMaterial({
      color: 0x7df7ff,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
      depthWrite: false
    });
    const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), material);
    marker.position.copy(body.position);
    marker.scale.y = 0.72;
    this.selectionGroup.add(marker);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.95, radius * 1.04, 96),
      new THREE.MeshBasicMaterial({
        color: 0x7df7ff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.position.copy(body.position);
    ring.rotation.z = performance.now() * 0.0012;
    this.selectionGroup.add(ring);
  }

  drawFieldFog() {
    for (const body of this.state.bodies) {
      if (body.mass <= 18) continue;
      const radius = Math.sqrt(body.mass) * (body.type === 'blackhole' ? 14 : 9);
      const color = body.type === 'blackhole' ? 0x3bdcff : body.type === 'star' ? 0xff9d38 : 0x4d8dff;
      const shellCount = body.type === 'blackhole' ? 4 : 2;
      for (let i = 0; i < shellCount; i++) {
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(radius * (0.55 + i * 0.28), 32, 16),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: (0.035 + body.fieldStress * 0.025) / (i + 1),
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide
          })
        );
        shell.position.copy(body.position);
        this.fogGroup.add(shell);
      }
    }
  }

  drawSpacetimeVolumes() {
    const sources = this.state.bodies.filter((body) => body.spacetimeRadius > 0 || ['blackhole', 'portal', 'star', 'magnet', 'ufo'].includes(body.type));
    for (const body of sources) {
      const radius = body.spacetimeRadius ?? this.fallbackSpacetimeRadius(body);
      if (!radius) continue;
      const strength = Math.min(1.8, body.spacetimeStrength ?? body.fieldStress ?? 0.35);
      const color = body.type === 'blackhole'
        ? 0x9ed8ff
        : body.type === 'portal'
          ? 0x72ffe1
          : body.type === 'star'
            ? 0xffb35d
            : 0xff72ef;
      const rings = body.type === 'blackhole' ? 5 : 3;
      for (let i = 0; i < rings; i++) {
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(radius * (0.18 + i * 0.16), 48, 18),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: (0.018 + strength * 0.014) / (i + 1),
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            wireframe: this.state.showTopology,
            side: THREE.BackSide
          })
        );
        shell.position.copy(body.position);
        shell.scale.z = 0.72 + Math.sin(performance.now() * 0.001 + i) * 0.04 + Math.abs(body.w ?? 0) * 0.002;
        this.topologyGroup.add(shell);
      }

      if ((body.w ?? 0) || body.type === 'portal' || body.type === 'blackhole') {
        const axis = new THREE.Mesh(
          new THREE.RingGeometry(Math.max(4, radius * 0.12), Math.max(5, radius * 0.122), 96),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.18 + Math.min(0.22, Math.abs(body.w ?? 0) * 0.004),
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
          })
        );
        axis.position.copy(body.position);
        axis.rotation.x = Math.PI / 2 + (body.w ?? 0) * 0.01;
        axis.rotation.z = performance.now() * 0.0009 + body.id;
        this.topologyGroup.add(axis);
      }
    }
  }

  fallbackSpacetimeRadius(body) {
    if (body.type === 'blackhole') return body.radius * 30;
    if (body.type === 'portal') return body.radius * 10;
    if (body.type === 'star') return body.radius * 9;
    if (body.type === 'ufo') return body.radius * 6;
    if (body.type === 'magnet') return body.radius * 8;
    return 0;
  }

  drawTopologyContours() {
    const massive = this.state.bodies.filter((body) => body.mass > 6);
    if (!massive.length) return;
    const levels = [0.012, 0.018, 0.026, 0.038, 0.056, 0.082];
    const step = 34;
    const minX = -430;
    const maxX = 430;
    const minY = -300;
    const maxY = 300;
    for (const level of levels) {
      const points = [];
      for (let x = minX; x <= maxX; x += step) {
        for (let y = minY; y <= maxY; y += step) {
          const p = new THREE.Vector3(x, y, 0);
          const potential = this.potentialAt(p, massive);
          const right = this.potentialAt(new THREE.Vector3(x + step, y, 0), massive);
          const up = this.potentialAt(new THREE.Vector3(x, y + step, 0), massive);
          if ((potential - level) * (right - level) < 0) {
            points.push(new THREE.Vector3(x + step * 0.5, y, -3), new THREE.Vector3(x + step * 0.5, y + step * 0.55, -3));
          }
          if ((potential - level) * (up - level) < 0) {
            points.push(new THREE.Vector3(x, y + step * 0.5, -3), new THREE.Vector3(x + step * 0.55, y + step * 0.5, -3));
          }
        }
      }
      if (!points.length) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: level > 0.04 ? 0xffb84c : 0x61eaff,
        transparent: true,
        opacity: 0.12 + level * 2.2
      });
      this.topologyGroup.add(new THREE.LineSegments(geometry, material));
    }
  }

  potentialAt(point, bodies) {
    let potential = 0;
    for (const body of bodies) {
      const d = Math.sqrt(point.distanceToSquared(body.position) + 120);
      potential += body.mass / (d * 120);
    }
    return potential;
  }

  drawTrails() {
    for (const body of this.state.bodies) {
      if (!body.showTrail || body.trail.length < 2) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints(body.trail);
      const material = this.materialFor(body);
      const line = new THREE.Line(geometry, material);
      this.trailGroup.add(line);
    }
  }

  drawWells() {
    for (const body of this.state.bodies) {
      if (body.mass <= 8) continue;
      const radius = Math.sqrt(body.mass) * (body.type === 'blackhole' ? 16 : 10);
      const rings = body.type === 'blackhole' ? 5 : 3;
      for (let i = 1; i <= rings; i++) {
        const geometry = new THREE.RingGeometry(radius * i / rings, radius * i / rings + 0.8, 96);
        const material = new THREE.MeshBasicMaterial({
          color: body.type === 'blackhole' ? 0x7adfff : body.type === 'star' ? 0xffd36b : 0x4fa8ff,
          transparent: true,
          opacity: (0.16 / i) * (1 + body.fieldStress),
          side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.position.copy(body.position);
        ring.rotation.z = body.rotation + i * 0.05;
        this.wellGroup.add(ring);
      }
    }
  }

  drawFieldArrows() {
    const bodies = this.state.bodies.filter((body) => body.mass > 0 && body.category !== 'dust' && body.category !== 'debris');
    if (!bodies.length) return;
    const clutter = this.state.bodies.length + this.state.bodies.filter((body) => body.category === 'dust').length * 0.35;
    const selected = this.state.selected;
    const focused = clutter > 36 && selected;
    const center = focused ? selected.position : new THREE.Vector3();
    const rangeX = focused ? 300 : 420;
    const rangeY = focused ? 220 : 260;
    const step = Math.max(52, 92 - (this.state.fieldDensity ?? 1) * 16 + clutter * 0.8);
    const zLevels = focused ? [selected.position.z] : clutter > 28 ? [0] : [-90, 0, 90];
    let drawn = 0;
    const maxArrows = focused ? 72 : Math.max(60, 160 - clutter * 1.5);
    for (let x = center.x - rangeX; x <= center.x + rangeX; x += step) {
      for (let y = center.y - rangeY; y <= center.y + rangeY; y += step) {
        for (const z of zLevels) {
          if (drawn >= maxArrows) return;
          const origin = new THREE.Vector3(x, y, focused ? z : z + center.z * 0.25);
          const force = new THREE.Vector3();
          for (const body of bodies) {
            const delta = new THREE.Vector3().subVectors(body.position, origin);
            const d2 = delta.lengthSq() + 40;
            force.add(delta.normalize().multiplyScalar(body.mass / d2));
          }
          const len = Math.min(22, force.length() * 900);
          if (len < 2) continue;
          const arrow = new THREE.ArrowHelper(force.normalize(), origin, len, 0x6ef4ff, len * 0.32, len * 0.16);
          arrow.cone.material.opacity = 0.62;
          arrow.line.material.opacity = 0.42;
          arrow.cone.material.transparent = true;
          arrow.line.material.transparent = true;
          this.fieldGroup.add(arrow);
          drawn++;
        }
      }
    }
  }

  materialFor(body) {
    if (!this.trailMaterials.has(body.id)) {
      this.trailMaterials.set(body.id, new THREE.LineBasicMaterial({
        color: body.type === 'comet' ? 0xb6f7ff : body.type === 'blackhole' ? 0xffa43a : 0x79f8ff,
        transparent: true,
        opacity: 0.58
      }));
    }
    return this.trailMaterials.get(body.id);
  }

  clearAll() {
    this.clearGroup(this.trailGroup);
    this.clearGroup(this.fieldGroup);
    this.clearGroup(this.wellGroup);
    this.clearGroup(this.boundaryGroup);
    this.clearGroup(this.depthGroup);
    this.clearGroup(this.fogGroup);
    this.clearGroup(this.topologyGroup);
    this.clearGroup(this.selectionGroup);
  }

  clearGroup(group) {
    while (group.children.length) {
      const child = group.children.pop();
      child.geometry?.dispose?.();
      if (child.material && ![...this.trailMaterials.values()].includes(child.material)) child.material.dispose();
    }
  }
}

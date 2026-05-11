import * as pc from 'playcanvas/build/playcanvas.mjs';
import { createTrailMaterial } from './trailMaterial.js';

export class TrailSystem {
  constructor(app, params) {
    this.app = app;
    this.params = params;
    this.sampleCount = params.trailSamples ?? 640;
    this.historyLength = params.trailHistory ?? 9;
    this.segmentCount = this.sampleCount * (this.historyLength - 1);
    this.vertexCount = this.segmentCount * 4;
    this.indexCount = this.segmentCount * 6;
    this.history = new Float32Array(this.sampleCount * this.historyLength * 3);
    this.sampleMeta = new Float32Array(this.sampleCount * 4);
    this.writeCursor = 0;

    const format = new pc.VertexFormat(app.graphicsDevice, [
      { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR1, components: 4, type: pc.TYPE_FLOAT32 }
    ]);
    this.vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, format, this.vertexCount, pc.BUFFER_DYNAMIC);
    const indexBuffer = new pc.IndexBuffer(app.graphicsDevice, pc.INDEXFORMAT_UINT32, this.indexCount, pc.BUFFER_STATIC);
    const indices = new Uint32Array(indexBuffer.lock());
    let idst = 0;
    for (let i = 0; i < this.segmentCount; i++) {
      const v = i * 4;
      indices[idst++] = v;
      indices[idst++] = v + 1;
      indices[idst++] = v + 2;
      indices[idst++] = v;
      indices[idst++] = v + 2;
      indices[idst++] = v + 3;
    }
    indexBuffer.unlock();
    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.mesh.vertexBuffer = this.vertexBuffer;
    this.mesh.indexBuffer[0] = indexBuffer;
    this.mesh.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(400, 400, 400));
    this.mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
    this.mesh.primitive[0].base = 0;
    this.mesh.primitive[0].count = this.indexCount;
    this.mesh.primitive[0].indexed = true;
    this.material = createTrailMaterial();
    this.meshInstance = new pc.MeshInstance(this.mesh, this.material);
    this.meshInstance.cull = false;
    this.entity = new pc.Entity('recursive-flow-trails');
    app.root.addChild(this.entity);
    this.meshInstance.node = this.entity;
    app.scene.layers.getLayerById(pc.LAYERID_WORLD).addMeshInstances([this.meshInstance]);
  }

  update(particles, particleCount, paletteShift = 0, camera = null) {
    const hideMatureDemoTrails = this.params.primaryMode === 'demo'
      && this.params.pianoPhysicsMode
      && (this.params.songObjectCount ?? 0) > 24;
    const dormantPiano = this.params.primaryMode === 'piano'
      && this.params.pianoPhysicsMode
      && this.params.noteLayout === 'causal-universe'
      && this.params.almightyWaveformMode
      && !this.params.originEstablished
      && (this.params.songObjects?.length ?? 0) === 0;
    const firstJamSpark = this.params.primaryMode === 'piano'
      && this.params.pianoPhysicsMode
      && this.params.noteLayout === 'causal-universe'
      && (this.params.jamGrowthBudget ?? 0) <= 1;
    this.meshInstance.visible = !!this.params.fieldLines && !hideMatureDemoTrails && !dormantPiano && !firstJamSpark;
    if (!this.params.fieldLines) return;
    if (hideMatureDemoTrails || dormantPiano || firstJamSpark) return;

    const step = Math.max(1, Math.floor(particleCount / this.sampleCount));
    const familyCount = this.params.pianoPhysicsMode ? 12 : 6;
    const particlesPerLayer = Math.max(1, Math.floor(particleCount / familyCount));
    for (let i = 0; i < this.sampleCount; i++) {
      const particleIndex = this.params.appMode === 'sound-board'
        ? (i % familyCount) + ((Math.floor(i / familyCount) * Math.max(1, Math.floor(step / familyCount))) % particlesPerLayer) * familyCount
        : i * step % particleCount;
      const src = particleIndex * 12;
      const dst = (i * this.historyLength + this.writeCursor) * 3;
      this.history[dst] = particles[src];
      this.history[dst + 1] = particles[src + 1];
      this.history[dst + 2] = particles[src + 2];
      const meta = i * 4;
      this.sampleMeta[meta] = particles[src + 8] ?? (i % 6);
      this.sampleMeta[meta + 1] = particles[src + 9] ?? 0;
      this.sampleMeta[meta + 2] = particles[src + 10] ?? 0;
      this.sampleMeta[meta + 3] = particles[src + 11] ?? 0;
    }
    this.writeCursor = (this.writeCursor + 1) % this.historyLength;

    const data = new Float32Array(this.vertexBuffer.lock());
    let dst = 0;
    const speedStretch = 1 + Math.log2(Math.max(1, this.params.speedMultiplier ?? 1)) * 0.45;
    const maxSegment = (this.params.cleanFlow ? 9 : 24) * speedStretch;
    const firstTrailSegment = this.params.primaryMode === 'demo' ? Math.max(0, this.historyLength - 2) : 0;
    for (let i = 0; i < this.sampleCount; i++) {
      for (let h = 0; h < this.historyLength - 1; h++) {
        if (h < firstTrailSegment) continue;
        const a = (this.writeCursor + h) % this.historyLength;
        const b = (this.writeCursor + h + 1) % this.historyLength;
        const age = 1 - h / (this.historyLength - 1);
        const meta = i * 4;
        if (this.params.primaryMode === 'piano'
          && this.params.pianoPhysicsMode
          && this.params.noteLayout === 'causal-universe'
          && (this.params.jamParticleReveal ?? 1) < 1
          && (this.sampleMeta[meta + 1] ?? 0) > (this.params.jamParticleReveal ?? 0)) {
          continue;
        }
        const layer = this.params.appMode === 'sound-board' ? Math.round(this.params.pianoPhysicsMode ? this.sampleMeta[meta + 3] : this.sampleMeta[meta]) : -1;
        const color = layer >= 0 ? layerColor(layer, this.params, age) : harmonicColor(age + paletteShift);
        const continuity = segmentContinuity(this.history, i, this.historyLength, a, b, maxSegment);
        dst = writeRibbonSegment(data, dst, this.history, i, this.historyLength, a, b, color, age, this.params.trailStrength, continuity, this.params, camera, layer, this.sampleMeta[meta + 1], this.sampleMeta[meta + 2]);
      }
    }
    this.vertexBuffer.unlock();
  }
}

function writeRibbonSegment(data, dst, history, particle, historyLength, a, b, color, age, trailStrength = 1, continuity = 1, params = {}, camera = null, layer = -1, seedA = 0, seedB = 0) {
  const ai = (particle * historyLength + a) * 3;
  const bi = (particle * historyLength + b) * 3;
  const ax = history[ai];
  const ay = history[ai + 1];
  const az = history[ai + 2];
  const bx = history[bi];
  const by = history[bi + 1];
  const bz = history[bi + 2];
  let tx = bx - ax;
  let ty = by - ay;
  let tz = bz - az;
  const tLen = Math.hypot(tx, ty, tz) || 1;
  tx /= tLen;
  ty /= tLen;
  tz /= tLen;
  const cameraPos = camera?.position;
  let vx = (cameraPos?.x ?? 0) - (ax + bx) * 0.5;
  let vy = (cameraPos?.y ?? 0) - (ay + by) * 0.5;
  let vz = (cameraPos?.z ?? 0) - (az + bz) * 0.5;
  const vLen = Math.hypot(vx, vy, vz) || 1;
  vx /= vLen;
  vy /= vLen;
  vz /= vLen;
  let sx = ty * vz - tz * vy;
  let sy = tz * vx - tx * vz;
  let sz = tx * vy - ty * vx;
  const sLen = Math.hypot(sx, sy, sz) || 1;
  const distanceAtten = Math.max(0.08, Math.min(1, vLen * 0.018));
  const layerWidth = layer >= 0 ? noteTrailWidth(layer, params) : 1;
  const seedWidth = 0.72 + seedA * 0.82;
  const bandEvents = params.audioBandEvents ?? {};
  const bandKeys = params.pianoPhysicsMode ? noteBandKeys() : ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'high'];
  const bandPulse = layer >= 0 ? (bandEvents[bandKeys[layer] ?? 'mid'] ?? 0) : 0;
  const demoMaturity = params.primaryMode === 'demo' ? Math.min(1, (params.songObjectCount ?? 0) / 160) : 0;
  const demoWidthTrim = params.primaryMode === 'demo' ? (0.08 - demoMaturity * 0.055) : 1;
  const width = (params.trailWidth ?? 0.008) * layerWidth * seedWidth * demoWidthTrim * (1 + bandPulse * 0.75 + (params.insideBlend ?? 0) * 0.7) * distanceAtten * (1 + Math.log2(Math.max(1, params.speedMultiplier ?? 1)) * 0.16);
  sx = sx / sLen * width;
  sy = sy / sLen * width;
  sz = sz / sLen * width;
  const persistence = params.trailPersistence ?? 0.9;
  const falloff = Math.pow(Math.max(0, 1 - age), 1.1 + (1 - persistence) * 4);
  const nearFade = smoothstep(3, 18, vLen);
  const bandLevels = params.pianoPhysicsMode ? noteLevels(params) : [params.audioSub, params.audioBass, params.audioLowMid, params.audioMid, params.audioHighMid, params.audioTreble];
  const layerBoost = layer >= 0 ? 1 + (bandLevels[layer] ?? 0) * 0.8 + (bandEvents[bandKeys[layer] ?? 'mid'] ?? 0) * 1.3 : 1;
  const cloudGlow = params.appMode === 'sound-board' ? (1 + (params.cloudDensity ?? 0.7) * 0.28 + (params.audioEnergy ?? 0) * (params.audioReactivity ?? 1) * 0.18 + (params.cosmicFlower ?? 0) * 0.8) * layerBoost : 1;
  const roleAlpha = layer >= 0 ? noteTrailAlpha(layer, params) : 1;
  const demoTrailTrim = params.primaryMode === 'demo'
    ? (0.006 + Math.pow(Math.max(0, params.demoBuildProgress ?? 0), 1.4) * 0.012) * (1 - demoMaturity * 0.82)
    : 1;
  const alpha = Math.max(0, 0.32 * falloff * trailStrength * (params.trailOpacity ?? 1) * demoTrailTrim * (params.encounterTrailBoost ?? 1) * cloudGlow * continuity * nearFade * roleAlpha * (0.78 + seedB * 0.48));
  dst = writeVertex(data, dst, ax + sx, ay + sy, az + sz, color, alpha);
  dst = writeVertex(data, dst, ax - sx, ay - sy, az - sz, color, alpha);
  dst = writeVertex(data, dst, bx - sx, by - sy, bz - sz, color, alpha * 0.88);
  dst = writeVertex(data, dst, bx + sx, by + sy, bz + sz, color, alpha * 0.88);
  return dst;
}

function writeVertex(data, dst, x, y, z, color, alpha) {
  data[dst++] = x;
  data[dst++] = y;
  data[dst++] = z;
  data[dst++] = color[0];
  data[dst++] = color[1];
  data[dst++] = color[2];
  data[dst++] = alpha;
  return dst;
}

function segmentContinuity(history, particle, historyLength, a, b, maxSegment) {
  const ai = (particle * historyLength + a) * 3;
  const bi = (particle * historyLength + b) * 3;
  const dx = history[ai] - history[bi];
  const dy = history[ai + 1] - history[bi + 1];
  const dz = history[ai + 2] - history[bi + 2];
  const distance = Math.hypot(dx, dy, dz);
  return 1 - smoothstep(maxSegment * 0.55, maxSegment, distance);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function harmonicColor(t) {
  const p = t * Math.PI * 2;
  return [
    0.25 + 0.75 * Math.max(0, Math.sin(p + 0.2)),
    0.35 + 0.65 * Math.max(0, Math.sin(p + 2.1)),
    0.5 + 0.5 * Math.max(0, Math.sin(p + 4.2))
  ];
}

function layerColor(layer, params, age) {
  if (params.pianoPhysicsMode) return noteColor(layer, params, age);
  const colors = [
    [0.62, 1.05, 1.42],
    [1.45, 0.78, 0.42],
    [1.0, 0.48, 1.18],
    [0.55, 1.08, 1.55],
    [1.16, 1.25, 1.72],
    [0.82, 1.35, 1.95]
  ];
  const bandEvents = params.audioBandEvents ?? {};
  const keys = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'high'];
  const pulse = bandEvents[keys[layer]] ?? 0;
  const base = colors[layer] ?? harmonicColor(age);
  return [
    base[0] * (0.72 + pulse * 0.5 + age * 0.12),
    base[1] * (0.72 + pulse * 0.45 + age * 0.1),
    base[2] * (0.72 + pulse * 0.55 + age * 0.08)
  ];
}

function noteColor(layer, params, age) {
  const colors = [
    [0.28, 0.55, 1.55],
    [0.15, 1.2, 1.55],
    [0.25, 1.25, 0.62],
    [0.7, 1.55, 0.3],
    [1.55, 1.08, 0.25],
    [1.55, 0.58, 0.22],
    [1.5, 0.22, 0.22],
    [1.35, 0.3, 1.45],
    [0.72, 0.42, 1.65],
    [1.35, 1.48, 1.62],
    [0.22, 1.4, 1.12],
    [1.65, 1.28, 0.34]
  ];
  const pulse = params.noteFamilyActivation?.[layer] ?? 0;
  const base = colors[layer] ?? harmonicColor(age);
  return [
    base[0] * (0.55 + pulse * 0.85 + age * 0.1),
    base[1] * (0.55 + pulse * 0.82 + age * 0.1),
    base[2] * (0.55 + pulse * 0.9 + age * 0.1)
  ];
}

function noteTrailWidth(layer, params) {
  if (!params.pianoPhysicsMode) return [2.35, 1.55, 1.15, 2.1, 0.82, 0.42][layer] ?? 1;
  return [1.55, 0.9, 1.1, 0.7, 1.3, 1.05, 0.82, 1.65, 0.92, 0.72, 1.18, 0.62][layer] ?? 1;
}

function noteTrailAlpha(layer, params) {
  if (!params.pianoPhysicsMode) return [1.25, 1.05, 0.95, 1.35, 0.9, 0.72][layer] ?? 1;
  const active = params.noteFamilyActivation?.[layer] ?? 0;
  return ([1.05, 0.85, 0.9, 0.72, 1.0, 0.95, 0.82, 1.2, 0.8, 0.72, 0.95, 0.7][layer] ?? 1) * (0.32 + active * 1.1);
}

function noteBandKeys() {
  return ['bass', 'mid', 'lowMid', 'highMid', 'mid', 'bass', 'highMid', 'lowMid', 'mid', 'high', 'highMid', 'high'];
}

function noteLevels(params) {
  return params.noteFamilyActivation ?? Array(12).fill(0);
}

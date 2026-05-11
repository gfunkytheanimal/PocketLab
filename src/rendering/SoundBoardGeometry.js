import * as pc from 'playcanvas/build/playcanvas.mjs';
import { createEncounterMaterial } from '../encounters/EncounterRenderer.js';

const MAX_VERTICES = 72000;
const NOTE_COLORS = [
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

export class SoundBoardGeometry {
  constructor(app, params) {
    this.app = app;
    this.params = params;
    const format = new pc.VertexFormat(app.graphicsDevice, [
      { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR1, components: 4, type: pc.TYPE_FLOAT32 }
    ]);
    this.vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, format, MAX_VERTICES, pc.BUFFER_DYNAMIC);
    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.mesh.vertexBuffer = this.vertexBuffer;
    this.mesh.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(260, 260, 260));
    this.mesh.primitive[0].type = pc.PRIMITIVE_LINES;
    this.mesh.primitive[0].base = 0;
    this.mesh.primitive[0].count = 0;
    this.mesh.primitive[0].indexed = false;
    this.material = createEncounterMaterial('SoundBoardGeometry');
    this.meshInstance = new pc.MeshInstance(this.mesh, this.material);
    this.meshInstance.cull = false;
    this.entity = new pc.Entity('sound-board-geometry');
    app.root.addChild(this.entity);
    this.meshInstance.node = this.entity;
    app.scene.layers.getLayerById(pc.LAYERID_WORLD).addMeshInstances([this.meshInstance]);
  }

  update(time) {
    this.meshInstance.visible = this.params.appMode === 'sound-board';
    if (!this.meshInstance.visible) return;
    const data = new Float32Array(this.vertexBuffer.lock());
    let dst = 0;
    if (this.params.pianoPhysicsMode) {
      dst = pianoTorusGeometry(data, dst, this.params, time);
      this.vertexBuffer.unlock();
      this.mesh.primitive[0].count = Math.floor(dst / 7);
      const demoGlow = this.params.primaryMode === 'demo';
      this.material.setParameter('uEncounterGlow', demoGlow
        ? 0.82 + (this.params.totalEnergy ?? 0) * 0.95 + (this.params.audioOnset ?? 0) * 0.36
        : 1.85 + (this.params.totalEnergy ?? 0) * 3.2 + (this.params.audioOnset ?? 0) * 1.2);
      return;
    }
    const r = this.params.boardRadius ?? 42;
    const sub = this.params.audioSub ?? 0;
    const bass = this.params.audioBass ?? 0;
    const lowMid = this.params.audioLowMid ?? 0;
    const mid = this.params.audioMid ?? 0;
    const highMid = this.params.audioHighMid ?? 0;
    const high = this.params.audioTreble ?? 0;
    const onset = this.params.audioOnset ?? 0;
    const centroid = this.params.audioCentroid ?? 0;
    const events = this.params.audioEvents ?? [];
    const bandEvents = this.params.audioBandEvents ?? {};
    const flower = this.params.cosmicFlower ?? 0;
    const rift = this.params.soundRift ?? 0;
    const nodes = this.params.nebulaNodes?.length ? this.params.nebulaNodes : [{ center: [0, 0, 0], size: 1, profile: {}, palette: [1, 1, 1] }];
    for (const node of nodes) {
      const start = dst;
      const profile = node.profile ?? {};
      const palette = node.palette ?? [1, 1, 1];
      const rr = r * (node.size ?? 1);
      const role = node.index;
      const viewFocus = node.index === this.params.focusNodeIndex ? 1 + (this.params.insideBlend ?? 0) * 0.95 + (this.params.travelBlend ?? 0) * 0.35 : 1 - (this.params.insideBlend ?? 0) * 0.58;
      const subPulse = Math.max(sub * (profile.sub ?? 1), bandEvents.sub ?? 0);
      const bassPulse = Math.max(bass * (profile.bass ?? 1), bandEvents.bass ?? 0);
      const lowMidPulse = Math.max(lowMid * (profile.lowMid ?? 1), bandEvents.lowMid ?? 0);
      const midPulse = Math.max(mid * (profile.mid ?? 1), bandEvents.mid ?? 0);
      const highMidPulse = Math.max(highMid * (profile.highMid ?? 1), bandEvents.highMid ?? 0);
      const highPulse = Math.max(high * (profile.high ?? 1), bandEvents.high ?? 0);
      if (role === 0 || role === 3) {
        dst = darkCore(data, dst, rr * (0.12 + bassPulse * 0.08), tint([0.1, 0.15, 0.42], palette), 0.32 * viewFocus);
        dst = subLines(data, dst, rr, time, subPulse, tint([0.72, 0.86, 1.8], palette));
        for (let i = 0; i < 5; i++) {
          const radius = rr * (0.11 + i * 0.052) * (1 + bassPulse * 0.22 * Math.sin(time * 2.4 + i));
          dst = torusRing(data, dst, radius * 1.22, radius * 0.76, rr * (0.045 + bassPulse * 0.09), 128, time * (0.018 + i * 0.008), tint([0.58, 0.78, 1.65], palette), (0.05 + bassPulse * 0.24) * viewFocus);
        }
      }
      if (role === 1 || role === 3) {
        for (let arm = 0; arm < 5; arm++) {
          dst = helixSpiral(data, dst, rr * 0.72, arm * Math.PI * 0.44 + time * (0.035 + lowMidPulse * 0.55), rr * (0.2 + lowMidPulse * 0.32), tint([0.48, 1.35, 1.05], palette), (0.05 + lowMidPulse * 0.22) * viewFocus);
        }
      }
      const kx = 2 + Math.min(9, centroid / 430);
      const ky = 2.4 + Math.min(9, centroid / 520);
      if (role === 1 || role === 3) {
        for (let band = -4; band <= 4; band++) {
          dst = nodalCurve(data, dst, rr * 0.78, band / 4, kx, ky, time, tint([0.48, 1.2, 1.15], palette), (0.02 + midPulse * 0.13 + this.params.cymaticStrength * 0.012) * viewFocus);
        }
        dst = vocalVeils(data, dst, rr, time, midPulse, tint([0.42, 1.35, 1.15], palette));
      }
      if (role === 2 || role === 3) {
        dst = angularStreaks(data, dst, rr, time, highMidPulse, tint([1.55, 1.32, 0.72], palette));
        dst = highSparks(data, dst, rr, time, highPulse, tint([1.7, 1.45, 0.82], palette));
      }
      for (const event of events) {
        if (event.type === 'tone' || event.radius > rr * 2.4) continue;
        const color = tint(event.type === 'high' ? [1.1, 1.35, 1.8] : event.type === 'bass' || event.type === 'sub' ? [1.55, 0.95, 0.55] : [1.6, 1.25, 0.8], palette);
        const alpha = Math.min(0.42, event.strength * (event.type === 'high' ? 0.14 : event.type === 'mid' ? 0.12 : 0.25));
        if (event.type === 'sub') dst = verticalPulse(data, dst, event.radius * 0.55, event.phase ?? 0, color, alpha);
        else if (event.type === 'high' || event.type === 'highMid') dst = angularStreaks(data, dst, rr, time + (event.phase ?? 0), event.strength, color);
        else dst = circle(data, dst, event.radius * (node.size ?? 1), 96, event.phase ?? 0, color, alpha);
      }
      if (role === 3 || flower > 0.25) dst = flowerPetals(data, dst, rr * (0.16 + Math.max(flower, role === 3 ? 0.08 : 0) * 0.58), time, tint([1.45, 0.72, 1.35], palette), (0.025 + flower * 0.38) * viewFocus);
      if (rift > 0.015) dst = riftCracks(data, dst, rr * 0.75, time, tint([0.65, 1.15, 1.85], palette), 0.06 + rift * 0.24);
      transformVertices(data, start, dst, node.center ?? [0, 0, 0]);
    }
    dst = bridgeLines(data, dst, this.params.nebulaNodes ?? [], this.params.nebulaBridges ?? [], time, this.params);
    this.vertexBuffer.unlock();
    this.mesh.primitive[0].count = Math.floor(dst / 7);
    this.material.setParameter('uEncounterGlow', 2.2 + bass * 2.5 + onset * 3.5);
  }
}

function subLines(data, dst, radius, time, strength, color) {
  const alpha = 0.035 + strength * 0.24;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + time * 0.025;
    const rr = radius * (0.025 + strength * 0.07 + (i % 3) * 0.012);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    const z = radius * (0.06 + strength * 0.18);
    dst = line(data, dst, [x, y, -z], [x * 0.35, y * 0.35, z], color, alpha);
  }
  return dst;
}

function pianoTorusGeometry(data, dst, params, time) {
  const R = params.torusMajorRadius ?? params.boardRadius ?? 46;
  const tube = params.torusMinorRadius ?? 15;
  const activations = params.noteFamilyActivation ?? [];
  const ringInstances = params.ringInstances ?? [];
  const causalVisualMode = params.noteLayout === 'causal-universe' && params.almightyWaveformMode && (params.primaryMode === 'demo' || params.primaryMode === 'piano' || params.primaryMode === 'microphone');
  if (causalVisualMode) {
    const dormantPiano = params.primaryMode === 'piano' && !params.originEstablished && (params.songObjects?.length ?? 0) === 0;
    if (dormantPiano && !params.inputDebugVisible) return dst;
    dst = originWaveform(data, dst, params, time);
    if (((params.viewDepth ?? 0) < 0.035 && params.primaryMode !== 'demo') || params.inputDebugVisible) dst = observerSpheroid(data, dst, params, time);
    if (params.inputDebugVisible) dst = chainedToriEchoes(data, dst, params, time);
    if ((params.travelBlend ?? 0) > 0.02) dst = scaleTunnel(data, dst, params, time);
    if ((params.insideBlend ?? 0) > 0.12 && (params.primaryMode !== 'piano' || params.inputDebugVisible)) dst = cockpitArcs(data, dst, params, time);
    if ((params.insideBlend ?? 0) > 0.64) dst = firstPersonEncounters(data, dst, params, time);
    if ((params.demoBuildProgress ?? 0) > 0.22) dst = wanderingShip(data, dst, params, time);
    return dst;
  }
  if (ringInstances.length && params.noteLayout !== 'three-tori') {
    if (((params.viewDepth ?? 0) < 0.035 && params.primaryMode !== 'demo') || params.inputDebugVisible) dst = observerSpheroid(data, dst, params, time);
    dst = chainedToriEchoes(data, dst, params, time);
    if (params.almightyWaveformMode) {
      dst = songUniverseObjects(data, dst, params, time);
    }
    for (const ring of ringInstances) {
      const active = Math.max(ring.activity ?? 0, activations[ring.family] ?? 0);
      const reveal = params.primaryMode === 'demo' ? (ring.reveal ?? 0) : 1;
      if (params.primaryMode === 'demo' && reveal < 0.08 && active < 0.14) continue;
      const color = NOTE_COLORS[ring.family] ?? [1, 1, 1];
      const selected = ring.index === params.selectedRingIndex ? 1 : 0;
      const alpha = (ring.octave < 0 ? 0.026 + active * 0.15 + selected * 0.16 : 0.013 + active * 0.08 + (ring.collision ?? 0) * 0.045 + selected * 0.14) * reveal;
      dst = cosmicStructure(data, dst, ring, time, color, alpha, active, params);
      if (params.almightyWaveformMode && reveal > 0.16 && active > 0.16 && ring.index % 3 === 0) {
        dst = originTether(data, dst, ring, time, NOTE_COLORS[ring.family] ?? color, Math.min(0.065, alpha * 0.42));
      }
      if (selected) dst = cameraFacingMarker(data, dst, ring.center, ring.radius * 1.55, [1.7, 1.55, 1.1], 0.16);
    }
    if ((params.travelBlend ?? 0) > 0.02) dst = scaleTunnel(data, dst, params, time);
    if ((params.insideBlend ?? 0) > 0.12 && (params.primaryMode !== 'piano' || params.inputDebugVisible)) dst = cockpitArcs(data, dst, params, time);
    if ((params.insideBlend ?? 0) > 0.64) dst = firstPersonEncounters(data, dst, params, time);
    if (params.almightyWaveformMode && (params.demoBuildProgress ?? 0) > 0.22) dst = wanderingShip(data, dst, params, time);
    return chordBridges(data, dst, params, time);
  }
  if (params.noteLayout === 'three-tori') {
    const centers = [[-30, -10, -8], [0, 12, 8], [30, -6, -10]];
    const radii = [R * 0.58, R * 0.68, R * 0.54];
    for (let band = 0; band < 3; band++) {
      dst = offsetCircle(data, dst, centers[band], radii[band], 180, time * (0.005 + band * 0.002), [0.24, 0.42, 0.68], 0.025);
      dst = offsetCircle(data, dst, centers[band], radii[band] + tube * 0.3, 180, time * (0.006 + band * 0.003), [0.18, 0.35, 0.58], 0.014);
    }
    for (let family = 0; family < 12; family++) {
      const active = activations[family] ?? 0;
      if (active < 0.08) continue;
      const anchor = noteAnchor(family, params, time);
      const color = NOTE_COLORS[family];
      dst = offsetCircle(data, dst, anchor, tube * (0.35 + active * 0.55), 72, time * (0.12 + active * 0.35), color, active * 0.08);
    }
    return chordBridges(data, dst, params, time);
  }
  for (let ring = 0; ring < 3; ring++) {
    const alpha = 0.022 + ring * 0.006;
    dst = torusRing(data, dst, R + (ring - 1) * tube * 0.18, R * 0.92, tube * (0.12 + ring * 0.05), 192, time * 0.006 + ring * 0.4, [0.28, 0.5, 0.76], alpha);
  }
  for (let family = 0; family < 12; family++) {
    const active = activations[family] ?? 0;
    const color = NOTE_COLORS[family];
    const baseAngle = family / 12 * Math.PI * 2;
    const arc = 0.12 + active * 0.42;
    const loops = active > 0.04 ? 3 : 1;
    for (let loop = 0; loop < loops; loop++) {
      let last = null;
      const tubePhase = loop / Math.max(1, loops) * Math.PI * 2 + time * (0.08 + active * 0.6);
      for (let i = 0; i <= 42; i++) {
        const t = i / 42;
        const a = baseAngle - arc * 0.5 + arc * t;
        const localTube = tube * (0.38 + loop * 0.16 + active * 0.22);
        const phase = tubePhase + t * Math.PI * 2 * (1 + family % 3);
        const q = R + Math.cos(phase) * localTube;
        const p = [
          Math.cos(a) * q,
          Math.sin(phase) * localTube,
          Math.sin(a) * q
        ];
        if (last && active > 0.12) dst = line(data, dst, last, p, color, active * 0.035);
        last = p;
      }
    }
  }
  return chordBridges(data, dst, params, time);
}

function originWaveform(data, dst, params, time) {
  const family = params.originFamily ?? -1;
  const established = family >= 0 && params.originEstablished;
  const color = established ? NOTE_COLORS[family] ?? [0.6, 1.0, 1.3] : [0.16, 0.36, 0.42];
  const build = params.primaryMode === 'demo' ? (params.demoBuildProgress ?? 0) : Math.max(...(params.noteFamilyActivation ?? [0]));
  const memory = params.songMemory ?? {};
  const length = 24 + build * 74 + (memory.repetition ?? 0) * 20;
  const amp = 0.18 + (params.audioEnergy ?? 0) * 2.4 + build * 1.2;
  const phase = (params.originPhase ?? 0) + time * (0.7 + (params.audioMid ?? 0) * 1.5);
  let last = null;
  for (let i = 0; i < 150; i++) {
    const t = i / 149;
    const x = (t - 0.5) * length;
    const y = Math.sin(t * Math.PI * (3 + (family >= 0 ? family % 5 : 2)) + phase) * amp * (0.35 + Math.sin(t * Math.PI));
    const z = Math.cos(t * Math.PI * 2 + phase * 0.7) * amp * 0.55 + Math.sin(t * Math.PI * 5 + phase) * (memory.sparkle ?? 0) * 2.2;
    const p = [x, y, z];
    if (last) dst = line(data, dst, last, p, color, (0.01 + build * 0.035 + (params.originStrength ?? 0) * 0.025) * Math.sin(t * Math.PI));
    last = p;
  }
  if (established && params.primaryMode !== 'demo') dst = stellarBody(data, dst, [0, 0, 0], 1.3 + build * 1.8, mixColor(color, [1.6, 1.45, 1.1]), 0.06 + build * 0.18, phase);
  return dst;
}

function songUniverseObjects(data, dst, params, time) {
  const bodySpritesLead = (params.primaryMode === 'piano' || params.primaryMode === 'demo') && !params.inputDebugVisible;
  for (const object of params.songObjects ?? []) {
    const color = object.color ?? NOTE_COLORS[object.family] ?? [1, 1, 1];
    const rawAlpha = Math.min(0.62, 0.07 + (object.strength ?? 0.3) * 0.16 + (object.pulse ?? 0) * 0.28 + (object.energy ?? 0) * 0.14);
    const pianoAlpha = object.prebuilt ? 0.34 : 0.13;
    const alpha = rawAlpha * (params.primaryMode === 'demo' ? 0.075 : params.primaryMode === 'piano' ? pianoAlpha : 0.42);
    if (params.inputDebugVisible) dst = renderObjectMist(data, dst, object, color, alpha * 0.3, time);
    if (object.kind === 'origin-star') {
      dst = renderOriginSystem(data, dst, object, color, alpha, time, params);
    } else if (object.kind === 'star-cluster') {
      if (bodySpritesLead) dst = renderObjectConstellation(data, dst, object, color, alpha * 0.45, time);
      else dst = renderObjectStars(data, dst, object, color, alpha, time);
    } else if (object.kind === 'solar-system' || object.kind === 'planetary-system' || object.kind === 'rocky-planet' || object.kind === 'moon-system' || object.kind === 'asteroid-field') {
      if (bodySpritesLead) dst = renderObjectConstellation(data, dst, object, color, alpha * 0.26, time);
      else dst = renderSolarSystem(data, dst, object, color, alpha, time);
    } else if (object.kind === 'gravity-well') {
      dst = accretionCore(data, dst, object.position, object.scale * (0.42 + (object.pulse ?? 0) * 0.12), object.phase + time * 0.15, color, alpha * 2.1);
      dst = polarJets(data, dst, objectLocal(object), object.scale, object.phase + time * 0.12, mixColor(color, [0.75, 1.2, 1.6]), alpha * (0.5 + (object.pulse ?? 0)));
    } else if (object.kind === 'spiral-arm') {
      dst = renderObjectSpiral(data, dst, object, color, alpha, time);
    } else if (object.kind === 'nebula-veil') {
      dst = nebulaBubbles(data, dst, objectLocal(object), object.scale, object.phase + time * 0.08, color, alpha * 1.5);
      dst = renderVeil(data, dst, object, color, alpha, time);
    } else if (object.kind === 'spark-stream') {
      dst = renderSparkStream(data, dst, object, color, alpha, time);
    } else if (object.kind === 'crystal-shards') {
      dst = renderCrystalObject(data, dst, object, color, alpha, time);
    } else if (object.kind === 'supernova-bloom') {
      dst = renderSupernova(data, dst, object, color, alpha, time);
    } else if (object.kind === 'comet-river') {
      dst = renderCometRiver(data, dst, object, color, alpha, time);
    } else if (object.kind === 'filament-web' || object.kind === 'section-region') {
      dst = renderFilamentWeb(data, dst, object, color, alpha, time);
    } else {
      dst = renderShockShell(data, dst, object, color, alpha, time);
    }
  }
  return dst;
}

function objectLocal(object) {
  const c = object.position ?? [0, 0, 0];
  const tilt = object.phase ?? 0;
  const cy = Math.cos(tilt * 0.23);
  const sy = Math.sin(tilt * 0.23);
  return (x, y, z) => [c[0] + x * cy - z * sy, c[1] + y, c[2] + x * sy + z * cy];
}

function renderObjectMist(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  const count = Math.max(8, Math.min(34, Math.floor(object.scale * 2.4)));
  const pulse = object.pulse ?? 0;
  for (let i = 0; i < count; i++) {
    const h = hashLocal((object.id ?? 0) * 31.7 + i * 11.13);
    const k = hashLocal((object.id ?? 0) * 17.9 + i * 5.41);
    const a = object.phase + i * 2.399963229728653 + time * (0.012 + pulse * 0.035);
    const rr = object.scale * (0.18 + Math.pow(h, 0.62) * (0.92 + pulse * 0.24));
    const p = local(
      Math.cos(a) * rr,
      (k - 0.5) * object.scale * (0.46 + (object.variant ?? 0) * 0.3),
      Math.sin(a) * rr * (0.48 + h * 0.42)
    );
    const size = object.scale * (0.012 + h * 0.018 + pulse * 0.008);
    dst = smallStar(data, dst, p, size, mixColor(color, [1.08, 1.12, 1.22]), alpha * (0.25 + h * 0.35));
  }
  return dst;
}

function renderOriginSystem(data, dst, object, color, alpha, time, params = {}) {
  const local = objectLocal(object);
  const coreColor = mixColor(color, [1.75, 1.55, 1.12]);
  dst = stellarBody(data, dst, object.position, object.scale * 0.72, coreColor, alpha * 2.2, object.phase + time * 0.2);
  if (params.primaryMode === 'piano' && (params.jamExcitationCount ?? 0) <= 1) return dst;
  const ringCount = params.primaryMode === 'piano' ? 1 : 3;
  for (let ring = 0; ring < ringCount; ring++) {
    const r = object.scale * (0.9 + ring * 0.42 + (object.pulse ?? 0) * 0.18);
    dst = orbitArc(data, dst, object.position, r * 1.55, r * 0.76, object.phase + ring * 0.7, time * 0.08 + ring, time * 0.08 + ring + Math.PI * 1.8, color, alpha * (params.primaryMode === 'piano' ? 0.035 : 0.3 - ring * 0.065));
  }
  const bodyCount = params.primaryMode === 'piano' ? 2 : 7;
  for (let i = 0; i < bodyCount; i++) {
    const a = object.phase + i * 2.399963 + time * 0.08;
    const r = object.scale * (1.2 + i * 0.38);
    const p = local(Math.cos(a) * r, Math.sin(i * 1.7) * object.scale * 0.2, Math.sin(a) * r * 0.62);
    if (params.primaryMode !== 'piano') dst = planetBody(data, dst, p, object.scale * (0.055 + (i % 3) * 0.022), mixColor(color, NOTE_COLORS[(object.family + i + 5) % 12] ?? color), alpha * 0.72, a, i % 3 === 0);
    else dst = smallStar(data, dst, p, object.scale * 0.018, mixColor(color, NOTE_COLORS[(object.family + i + 5) % 12] ?? color), alpha * 0.22);
  }
  return dst;
}

function renderObjectConstellation(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  const count = Math.max(3, Math.min(9, Math.floor(object.scale * 0.45)));
  const pulse = object.pulse ?? 0;
  for (let i = 0; i < count; i++) {
    const h = hashLocal((object.id ?? 0) * 12.91 + i * 8.17);
    const a = object.phase + i * 2.399963 + time * (0.012 + pulse * 0.035);
    const r = object.scale * (0.16 + h * 0.7);
    const p = local(
      Math.cos(a) * r,
      (hashLocal(i * 4.17 + object.id) - 0.5) * object.scale * 0.32,
      Math.sin(a) * r * (0.46 + h * 0.32)
    );
    const q = local(
      Math.cos(a + 0.025) * (r + object.scale * 0.04),
      (hashLocal(i * 4.17 + object.id) - 0.5) * object.scale * 0.32,
      Math.sin(a + 0.025) * (r + object.scale * 0.04) * (0.46 + h * 0.32)
    );
    dst = line(data, dst, p, q, mixColor(color, [1.3, 1.25, 1.08]), alpha * (0.28 + h * 0.3));
  }
  return dst;
}

function renderSolarSystem(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  const rocky = object.kind === 'rocky-planet' || object.kind === 'moon-system';
  const asteroid = object.kind === 'asteroid-field';
  const planets = asteroid ? 8 : rocky ? 3 : 2 + Math.floor((object.variant ?? 0) * 5);
  if (!asteroid) {
    const coreSize = object.kind === 'planetary-system' ? 0.12 : rocky ? 0.18 : 0.2;
    dst = stellarBody(data, dst, object.position, object.scale * coreSize, mixColor(color, [1.48, 1.34, 1.05]), alpha * (rocky ? 0.82 : 1.35), object.phase + time * 0.08);
  }
  for (let i = 0; i < planets; i++) {
    const h = hashLocal((object.id ?? 0) * 8.3 + i * 13.7);
    const orbit = object.scale * (asteroid ? 0.28 + i * 0.12 + h * 0.34 : rocky ? 0.24 + i * 0.16 + h * 0.08 : 0.42 + i * 0.24 + h * 0.12);
    const tilt = object.phase * 0.17 + i * 0.42;
    const a = object.phase + time * (asteroid ? 0.11 + h * 0.12 + (object.energy ?? 0) * 0.08 : 0.05 + h * 0.08 + (object.energy ?? 0) * 0.06) + i * 2.399963;
    if ((!rocky || i > 0) && h > 0.42) dst = tiltedOrbit(data, dst, object.position, orbit * 1.18, orbit * (0.58 + h * 0.22), tilt, mixColor(color, [0.9, 1.0, 1.18]), alpha * (asteroid ? 0.025 : 0.038));
    const p = local(Math.cos(a) * orbit, Math.sin(a * 1.7 + i) * object.scale * (asteroid ? 0.16 : 0.08), Math.sin(a) * orbit * (0.58 + h * 0.22));
    const bodySize = object.scale * (asteroid ? 0.018 + h * 0.028 : rocky ? 0.045 + h * 0.03 : 0.035 + h * 0.045);
    dst = planetBody(data, dst, p, bodySize, bodyTone(color, object.family ?? 0, i, h), alpha * (asteroid ? 0.28 + h * 0.3 : 0.5 + h * 0.35), a, !asteroid && h > 0.62);
    if (rocky && i === 0) dst = moonlet(data, dst, p, object.scale * 0.13, object.scale * 0.016, a + time * 0.18, alpha * 0.45);
  }
  return dst;
}

function spiralDust(data, dst, local, radius, phase, color, alpha, arms) {
  const count = 54 + arms * 18;
  for (let i = 0; i < count; i++) {
    const h = hashLocal(i * 5.17 + phase * 1.91);
    const arm = i % arms;
    const t = (i / count + h * 0.08) % 1;
    const a = phase + arm / arms * Math.PI * 2 + t * Math.PI * (2.4 + arms * 0.58);
    const rr = radius * (0.18 + t * 1.18);
    const p = local(
      Math.cos(a) * rr + (h - 0.5) * radius * 0.08,
      (hashLocal(i * 9.7) - 0.5) * radius * 0.22,
      Math.sin(a) * rr * 0.62 + (hashLocal(i * 11.1) - 0.5) * radius * 0.08
    );
    dst = smallStar(data, dst, p, radius * (0.008 + h * 0.014), mixColor(color, [1.35, 1.24, 1.05]), alpha * (0.2 + h * 0.42));
  }
  return dst;
}

function renderObjectStars(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  const family = object.family ?? 0;
  if (family === 3 || family === 6 || object.variant > 0.72) {
    dst = renderCrystalObject(data, dst, object, color, alpha * 0.82, time);
  } else if (family === 7 || object.variant > 0.48) {
    dst = renderObjectSpiral(data, dst, object, color, alpha * 0.8, time);
  }
  dst = stellarNursery(data, dst, local, object.scale, 14 + Math.floor(object.scale * 2.2), object.phase + time * 0.05, color, alpha * 1.65);
  dst = renderSolarSystem(data, dst, object, color, alpha, time);
  return stellarBody(data, dst, object.position, object.scale * 0.34, mixColor(color, [1.65, 1.48, 1.14]), alpha * 2.0, object.phase);
}

function renderObjectSpiral(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  const arms = 2 + Math.floor((object.variant ?? 0) * 4);
  for (let arm = 0; arm < arms; arm++) {
    let last = null;
    for (let i = 0; i < 70; i++) {
      if (Math.floor(i / 6) % 4 === 3) {
        last = null;
        continue;
      }
      const t = i / 69;
      const a = object.phase + arm / arms * Math.PI * 2 + t * Math.PI * (1.8 + (object.variant ?? 0) * 2.7) + time * 0.04;
      const rr = object.scale * (0.14 + t * 1.35);
      const p = local(Math.cos(a) * rr, Math.sin(t * Math.PI * 2 + object.phase) * object.scale * 0.12, Math.sin(a) * rr * 0.62);
      if (last) dst = line(data, dst, last, p, color, alpha * (1 - t * 0.45));
      if (i % 15 === 0) dst = stellarBody(data, dst, p, object.scale * 0.035, mixColor(color, [1.35, 1.3, 1.15]), alpha * 0.9, a);
      last = p;
    }
  }
  dst = spiralDust(data, dst, local, object.scale, object.phase + time * 0.035, color, alpha * 0.75, arms);
  dst = stellarBody(data, dst, object.position, object.scale * 0.2, mixColor(color, [1.55, 1.45, 1.12]), alpha * 1.35, object.phase);
  return dst;
}

function renderVeil(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  for (let strand = 0; strand < 7; strand++) {
    let last = null;
    const phase = object.phase + strand * 0.8 + time * (0.08 + (object.energy ?? 0) * 0.2);
    for (let i = 0; i < 55; i++) {
      const t = i / 54;
      const y = (t - 0.5) * object.scale * 1.7;
      const x = Math.sin(t * Math.PI * 2.6 + phase) * object.scale * (0.16 + strand * 0.015);
      const z = Math.cos(t * Math.PI * 1.7 + phase) * object.scale * 0.32 + (strand - 3) * object.scale * 0.08;
      const p = local(x, y, z);
      if (last) dst = line(data, dst, last, p, color, alpha * Math.sin(t * Math.PI));
      last = p;
    }
  }
  return dst;
}

function renderSparkStream(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  for (let i = 0; i < 34; i++) {
    const t = i / 23;
    const a = object.phase + i * 2.399 + time * (0.4 + (object.pulse ?? 0) * 1.2);
    const rr = object.scale * (0.4 + t * 1.1);
    const p = local(Math.cos(a) * rr, Math.sin(a * 1.8) * object.scale * 0.35, Math.sin(a) * rr * 0.75);
    const q = local(Math.cos(a + 0.06) * (rr + object.scale * 0.18), Math.sin(a * 1.8) * object.scale * 0.35, Math.sin(a + 0.06) * (rr + object.scale * 0.18) * 0.75);
    dst = line(data, dst, p, q, mixColor(color, [1.45, 1.45, 1.65]), alpha * (0.9 + (object.pulse ?? 0)));
  }
  return dst;
}

function renderCrystalObject(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  const points = [];
  for (let i = 0; i < 10; i++) {
    const a = object.phase + i * 2.399 + time * 0.025;
    points.push(local(Math.cos(a) * object.scale * (0.25 + (i % 4) * 0.14), (i - 4.5) * object.scale * 0.12, Math.sin(a) * object.scale * (0.42 + (object.variant ?? 0) * 0.3)));
  }
  for (let i = 0; i < points.length; i++) {
    dst = stellarBody(data, dst, points[i], object.scale * 0.045, color, alpha, object.phase + i);
    for (let j = i + 1; j < points.length; j++) if ((i + j) % 3 === 0) dst = line(data, dst, points[i], points[j], color, alpha * 0.6);
  }
  return dst;
}

function renderSupernova(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  dst = stellarBody(data, dst, object.position, object.scale * (0.22 + (object.pulse ?? 0) * 0.08), mixColor(color, [1.7, 1.55, 1.2]), alpha * 2.1, object.phase + time);
  for (let i = 0; i < 18; i++) {
    const a = object.phase + i / 18 * Math.PI * 2;
    const p = local(Math.cos(a) * object.scale * 0.3, Math.sin(a * 2) * object.scale * 0.08, Math.sin(a) * object.scale * 0.3);
    const q = local(Math.cos(a) * object.scale * (0.95 + (i % 4) * 0.08), Math.sin(a * 2) * object.scale * 0.2, Math.sin(a) * object.scale * (0.95 + (i % 4) * 0.08));
    dst = line(data, dst, p, q, color, alpha * 0.7);
  }
  for (let shell = 0; shell < 3; shell++) {
    const r = object.scale * (0.45 + shell * 0.22 + Math.min(1, object.age ?? 0) * 0.12);
    dst = orbitArc(data, dst, object.position, r * 1.2, r * 0.78, object.phase + shell * 0.6, time * 0.18, time * 0.18 + Math.PI * 1.85, mixColor(color, [1.55, 1.28, 1.05]), alpha * (0.38 - shell * 0.08));
  }
  return dst;
}

function renderCometRiver(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const a = object.phase + t * Math.PI * 3.6 + time * 0.16;
    const p = local(Math.cos(a) * object.scale * (0.35 + t), (t - 0.5) * object.scale * 0.9, Math.sin(a) * object.scale * (0.35 + t) * 0.55);
    dst = cometGlyph(data, dst, p, object.scale * (0.18 + t * 0.08), a, color, alpha * (1 - t * 0.25));
  }
  return dst;
}

function renderFilamentWeb(data, dst, object, color, alpha, time) {
  const local = objectLocal(object);
  const points = [];
  for (let i = 0; i < 12; i++) {
    const a = object.phase + i * 2.399 + time * 0.012;
    points.push(local(Math.cos(a) * object.scale * (0.25 + (i % 5) * 0.16), Math.sin(i * 1.2) * object.scale * 0.34, Math.sin(a) * object.scale * (0.25 + (i % 4) * 0.18)));
  }
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if ((i * 7 + j * 3) % 5 > 1) continue;
      dst = line(data, dst, points[i], points[j], color, alpha * 0.42);
    }
  }
  return dst;
}

function renderShockShell(data, dst, object, color, alpha, time) {
  const r = object.scale * (0.45 + Math.min(1.25, object.age ?? 0) * 0.55);
  for (let i = 0; i < 4; i++) {
    dst = orbitArc(data, dst, object.position, r * (1 + i * 0.13), r * (0.62 + i * 0.07), object.phase + i * 0.45, time * 0.03 + i, time * 0.03 + i + Math.PI * 1.7, color, alpha * (0.34 - i * 0.055));
  }
  return dst;
}

function originTether(data, dst, ring, time, color, alpha) {
  const c = ring.center ?? [0, 0, 0];
  let last = [0, 0, 0];
  const phase = time * 0.18 + (ring.index ?? 0);
  for (let i = 1; i <= 26; i++) {
    const t = i / 26;
    const bow = Math.sin(t * Math.PI);
    const p = [
      c[0] * t + Math.sin(phase + t * 7) * bow * 2.6,
      c[1] * t + Math.cos(phase * 0.7 + t * 4) * bow * 1.8,
      c[2] * t + Math.sin(phase * 1.2 + t * 5) * bow * 2.2
    ];
    dst = line(data, dst, last, p, color, alpha * bow);
    last = p;
  }
  return dst;
}

function wanderingShip(data, dst, params, time) {
  const period = 74;
  const localTime = ((time + 19.5) % period) / period;
  if (localTime < 0.08 || localTime > 0.34) return dst;
  const t = (localTime - 0.08) / 0.26;
  const universeRadius = Math.max(36, params.songUniverseRadius ?? 64);
  const lane = Math.floor((time + 19.5) / period);
  const angle = lane * 2.399963229728653 + 0.7;
  const start = [-universeRadius * 1.35, Math.sin(angle) * universeRadius * 0.28, Math.cos(angle) * universeRadius * 0.54];
  const end = [universeRadius * 1.35, Math.cos(angle * 1.3) * universeRadius * 0.34, -Math.sin(angle) * universeRadius * 0.48];
  const p = [
    start[0] * (1 - t) + end[0] * t,
    start[1] * (1 - t) + end[1] * t + Math.sin(t * Math.PI) * universeRadius * 0.16,
    start[2] * (1 - t) + end[2] * t
  ];
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const f = [dx / len, dy / len, dz / len];
  const side = [-f[2], 0, f[0]];
  const up = [
    side[1] * f[2] - side[2] * f[1],
    side[2] * f[0] - side[0] * f[2],
    side[0] * f[1] - side[1] * f[0]
  ];
  const scale = Math.max(0.7, universeRadius * 0.018);
  const nose = [p[0] + f[0] * scale * 2.1, p[1] + f[1] * scale * 2.1, p[2] + f[2] * scale * 2.1];
  const tail = [p[0] - f[0] * scale * 1.5, p[1] - f[1] * scale * 1.5, p[2] - f[2] * scale * 1.5];
  const left = [p[0] + side[0] * scale * 0.9 - f[0] * scale * 0.35, p[1] + side[1] * scale * 0.9 - f[1] * scale * 0.35, p[2] + side[2] * scale * 0.9 - f[2] * scale * 0.35];
  const right = [p[0] - side[0] * scale * 0.9 - f[0] * scale * 0.35, p[1] - side[1] * scale * 0.9 - f[1] * scale * 0.35, p[2] - side[2] * scale * 0.9 - f[2] * scale * 0.35];
  const cabin = [p[0] + up[0] * scale * 0.34, p[1] + up[1] * scale * 0.34, p[2] + up[2] * scale * 0.34];
  const shipColor = [0.75, 1.25, 1.65];
  const warm = [1.65, 1.1, 0.45];
  const fade = Math.sin(t * Math.PI);
  dst = line(data, dst, nose, left, shipColor, 0.16 * fade);
  dst = line(data, dst, nose, right, shipColor, 0.16 * fade);
  dst = line(data, dst, left, tail, shipColor, 0.12 * fade);
  dst = line(data, dst, right, tail, shipColor, 0.12 * fade);
  dst = line(data, dst, cabin, nose, [1.35, 1.55, 1.7], 0.1 * fade);
  for (let i = 0; i < 4; i++) {
    const exhaust = [tail[0] - f[0] * scale * (1.2 + i * 0.6) + side[0] * (i - 1.5) * scale * 0.12, tail[1] - f[1] * scale * (1.2 + i * 0.6), tail[2] - f[2] * scale * (1.2 + i * 0.6) + side[2] * (i - 1.5) * scale * 0.12];
    dst = line(data, dst, tail, exhaust, warm, 0.1 * fade * (1 - i * 0.18));
  }
  return dst;
}

function scaleTunnel(data, dst, params, time) {
  const blend = params.travelBlend ?? 0;
  const color = [0.42, 0.8, 1.2];
  const anchor = params.transitionAnchor ?? [0, 0, 0];
  for (let z = 0; z < 12; z++) {
    const t = z / 11;
    const depth = -z * 8 - (time * 12 % 8);
    const radius = 7 + z * 1.65;
    const center = [
      anchor[0] * t * 0.72,
      anchor[1] * t * 0.72,
      anchor[2] * t * 0.72 + depth
    ];
    let last = null;
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * Math.PI * 2 + z * 0.22;
      const p = [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius * 0.72, center[2]];
      if (last) dst = line(data, dst, last, p, color, blend * 0.018 * (1 - z / 14));
      last = p;
    }
  }
  return dst;
}

function cockpitArcs(data, dst, params, time) {
  const inside = params.insideBlend ?? 0;
  const activations = params.noteFamilyActivation ?? [];
  const eye = params.cameraPosition ?? params.transitionAnchor ?? [0, 0, 0];
  const forward = params.cameraForward ?? [0, 0, -1];
  const right = params.cameraRight ?? [1, 0, 0];
  const up = params.cameraUp ?? [0, 1, 0];
  for (let family = 0; family < 12; family++) {
    const active = activations[family] ?? 0;
    const a = family / 12 * Math.PI * 2;
    const shell = 8 + (family % 4) * 2.2 + active * 5;
    const depth = 20 + (family % 3) * 8 - active * 4;
    const side = Math.cos(a) * shell;
    const lift = Math.sin(a) * shell + Math.sin(a * 2 + time * 0.1) * (2 + active * 4);
    const center = [
      eye[0] + forward[0] * depth + right[0] * side + up[0] * lift,
      eye[1] + forward[1] * depth + right[1] * side + up[1] * lift,
      eye[2] + forward[2] * depth + right[2] * side + up[2] * lift
    ];
    if (active < 0.08 && !params.inputDebugVisible) continue;
    const alpha = inside * (params.inputDebugVisible ? 0.05 + active * 0.18 : active * 0.045);
    dst = cameraFacingCircle(data, dst, center, right, up, 2.8 + active * 2.2, 48, time * 0.03 + a, NOTE_COLORS[family], alpha);
  }
  return dst;
}

function observerSpheroid(data, dst, params, time) {
  const radius = Math.max(112, 96 * (params.universeScale ?? 1));
  const depthFade = 1 - smoothstepLocal(0.08, 0.34, params.viewDepth ?? 0);
  const baseAlpha = (params.inputDebugVisible ? 0.018 : 0.0045) * depthFade;
  const shellColor = [0.3, 0.46, 0.76];
  for (let lat = -2; lat <= 2; lat++) {
    const y = lat * radius * 0.22;
    const rr = Math.sqrt(Math.max(0.02, 1 - Math.pow(y / (radius * 0.82), 2))) * radius;
    dst = tiltedEllipse(data, dst, [0, y, 0], rr, rr * 0.72, time * 0.002 + lat * 0.36, lat * 0.21, shellColor, baseAlpha * (lat === 0 ? 0.7 : 1));
  }
  for (let meridian = 0; meridian < 7; meridian++) {
    const phase = meridian / 7 * Math.PI * 2 + time * 0.0015;
    dst = meridianArc(data, dst, radius, phase, shellColor, baseAlpha * 0.82);
  }
  const phi = 2.399963229728653;
  const points = [];
  for (let i = 0; i < 28; i++) {
    const y = 1 - (i / 27) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * phi;
    points.push([Math.cos(a) * r * radius * 0.92, y * radius * 0.72, Math.sin(a) * r * radius * 0.92]);
  }
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i][0] - points[j][0];
      const dy = points[i][1] - points[j][1];
      const dz = points[i][2] - points[j][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > radius * 0.42 || d < radius * 0.22) continue;
      if (((i * 17 + j * 31) % 5) > 1) continue;
      dst = line(data, dst, points[i], points[j], [0.42, 0.54, 0.9], baseAlpha * 0.62);
    }
  }
  return dst;
}

function chainedToriEchoes(data, dst, params, time) {
  const depth = params.viewDepth ?? 0;
  if (params.primaryMode === 'demo' && !params.inputDebugVisible) return dst;
  if (depth > 0.78) return dst;
  const rings = params.ringInstances ?? [];
  const activations = params.noteFamilyActivation ?? [];
  const scale = params.universeScale ?? 1;
  const cellRadius = 72 * scale;
  const count = Math.min(34, Math.max(14, Math.floor(rings.length * 0.34)));
  const alphaBase = 0.011 + (1 - depth) * 0.014;
  for (let i = 0; i < count; i++) {
    const family = (i * 7 + 3) % 12;
    const active = activations[family] ?? 0;
    const a = i * 2.399963229728653 + time * 0.002;
    const layer = ((i % 5) - 2) * 24 * scale;
    const rr = cellRadius * (0.72 + (i % 4) * 0.22);
    const center = [
      Math.cos(a) * rr,
      Math.sin(i * 1.7) * 28 * scale + layer * 0.35,
      Math.sin(a) * rr * 0.78 + layer
    ];
    const radius = (5.5 + (i % 3) * 1.9) * scale * (1 + active * 0.32);
    dst = offsetCircle(data, dst, center, radius, 32, time * (0.005 + active * 0.05) + i, NOTE_COLORS[family], alphaBase + active * 0.045);
    if (i % 3 === 0) {
      const nextA = (i + 1) * 2.399963229728653 + time * 0.002;
      const next = [
        Math.cos(nextA) * rr * 0.95,
        Math.sin((i + 1) * 1.7) * 28 * scale + layer * 0.22,
        Math.sin(nextA) * rr * 0.74 + layer
      ];
      dst = curvedBridge(data, dst, center, next, NOTE_COLORS[family], alphaBase * 1.6 + active * 0.06, 'fifth', time + i);
    }
  }
  return dst;
}

function firstPersonEncounters(data, dst, params, time) {
  const inside = params.insideBlend ?? 0;
  const notes = params.chordNotes ?? [];
  const family = params.focusNoteFamily ?? 0;
  const activations = params.noteFamilyActivation ?? [];
  const active = activations[family] ?? 0;
  const anchor = params.transitionAnchor ?? [0, 0, 0];
  const alpha = (inside - 0.64) * 0.09;
  if ((params.chordType ?? '') === 'major' && notes.length >= 3) {
    for (let ring = 0; ring < 3; ring++) {
      dst = pentagonalGate(data, dst, [anchor[0], anchor[1], anchor[2] - 14 - ring * 5], 9 + ring * 3, time * (0.02 + ring * 0.01), [1.45, 1.22, 0.72], alpha * (1.4 - ring * 0.22));
    }
  }
  if ((params.chordType ?? '') === 'dissonant') {
    for (let i = 0; i < 18; i++) {
      const a = i * 2.399 + time * 1.6;
      const p = [anchor[0] + Math.cos(a) * 7, anchor[1] + Math.sin(a * 1.7) * 5, anchor[2] + Math.sin(a) * 7];
      const q = [p[0] + Math.cos(a + 1.9) * 4, p[1] + Math.sin(a * 3.1) * 3, p[2] + Math.sin(a + 1.9) * 4];
      dst = line(data, dst, p, q, [1.55, 0.72, 0.55], alpha * 2.2);
    }
  }
  if (family === 11 || active > 0.65) {
    let last = null;
    for (let i = 0; i < 80; i++) {
      const t = i / 79;
      const a = time * 0.22 + t * Math.PI * 4.2;
      const p = [
        anchor[0] + Math.cos(a) * (2 + t * 26),
        anchor[1] + Math.sin(t * Math.PI * 2.7 + time) * 8,
        anchor[2] + Math.sin(a) * (2 + t * 26) - t * 22
      ];
      if (last) dst = line(data, dst, last, p, [1.65, 1.32, 0.34], alpha * (1 - t) * (0.8 + active));
      last = p;
    }
  }
  return dst;
}

function chordBridges(data, dst, params, time) {
  const notes = params.chordNotes ?? [];
  if (notes.length < 2) return dst;
  const type = params.chordType ?? 'interval';
  const strength = Math.max(0.12, params.totalEnergy ?? 0.2);
  const alpha = type === 'major' ? 0.18 : type === 'fifth' ? 0.16 : type === 'minor' ? 0.12 : type === 'dissonant' ? 0.22 : 0.1;
  const indices = notes.map((note) => NOTE_NAMES.indexOf(note)).filter((index) => index >= 0);
  for (let i = 0; i < indices.length; i++) {
    for (let j = i + 1; j < indices.length; j++) {
      const a = noteAnchor(indices[i], params, time);
      const b = noteAnchor(indices[j], params, time);
      const color = mixColor(NOTE_COLORS[indices[i]], NOTE_COLORS[indices[j]]);
      dst = curvedBridge(data, dst, a, b, color, alpha * strength, type, time + i + j);
    }
  }
  return dst;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteAnchor(family, params, time) {
  const R = params.torusMajorRadius ?? params.boardRadius ?? 46;
  const rings = params.ringInstances ?? [];
  if (rings.length && params.noteLayout !== 'three-tori') {
    let best = null;
    for (const ring of rings) {
      if (ring.family !== family) continue;
      if (!best || (ring.activity ?? 0) > (best.activity ?? 0)) best = ring;
    }
    if (best) return best.center;
  }
  if (params.noteLayout === 'three-tori') {
    const band = family <= 3 ? 0 : family <= 7 ? 1 : 2;
    const centers = [[-30, -10, -8], [0, 12, 8], [30, -6, -10]];
    const localIndex = band === 0 ? family : band === 1 ? family - 4 : family - 8;
    const r = R * [0.58, 0.68, 0.54][band];
    const a = localIndex / 4 * Math.PI * 2 + time * 0.01;
    return [centers[band][0] + Math.cos(a) * r, centers[band][1] + Math.sin(a * 2) * 8, centers[band][2] + Math.sin(a) * r];
  }
  const a = family / 12 * Math.PI * 2;
  return [Math.cos(a) * R, 0, Math.sin(a) * R];
}

function offsetCircle(data, dst, center, radius, segments, phase, color, alpha) {
  let last = null;
  for (let i = 0; i <= segments; i++) {
    const a = phase + i / segments * Math.PI * 2;
    const p = [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a * 2 + phase) * radius * 0.12, center[2] + Math.sin(a) * radius];
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function cameraFacingCircle(data, dst, center, right, up, radius, segments, phase, color, alpha) {
  let last = null;
  for (let i = 0; i <= segments; i++) {
    const a = phase + i / segments * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    const p = [
      center[0] + right[0] * x + up[0] * y,
      center[1] + right[1] * x + up[1] * y,
      center[2] + right[2] * x + up[2] * y
    ];
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function cosmicStructure(data, dst, ring, time, color, alpha, active, params = {}) {
  const type = ring.type ?? 'solar-system';
  const c = ring.center ?? [0, 0, 0];
  const radius = ring.radius ?? 5;
  const demoEnergy = params.primaryMode === 'demo' ? Math.min(1, (params.audioRms ?? 0) * 2.5 + (params.audioEnergy ?? 0) * 0.35) : 0;
  const drive = Math.max(active, ring.audioDrive ?? 0, ring.demoDrive ?? 0, demoEnergy * 0.16);
  const phase = time * (0.04 + drive * 0.22) + (ring.index ?? 0) * 0.37;
  const tilt = ring.tilt ?? 0;
  const cy = Math.cos(tilt);
  const sy = Math.sin(tilt);
  const local = (x, y, z) => [c[0] + x * cy - z * sy, c[1] + y, c[2] + x * sy + z * cy];
  const starColor = mixColor(color, [1.55, 1.45, 1.15]);
  const glow = alpha * (1.1 + drive * 1.8);
  dst = stellarBody(data, dst, c, radius * (0.16 + drive * 0.08), starColor, glow, phase);
  dst = orbitalDust(data, dst, local, radius, 5 + Math.floor(drive * 8), phase, color, alpha * (0.18 + drive * 0.55));
  if (type === 'spiral-galaxy' || type === 'barred-spiral') {
    if (type === 'barred-spiral') {
      dst = line(data, dst, local(-radius * 1.15, 0, 0), local(radius * 1.15, 0, 0), starColor, glow * 0.65);
      dst = line(data, dst, local(0, 0, -radius * 1.15), local(0, 0, radius * 1.15), color, glow * 0.25);
    }
    const arms = ring.arms ?? 3;
    for (let arm = 0; arm < arms; arm++) {
      let last = null;
      for (let i = 0; i < 90; i++) {
        if (Math.floor(i / 5) % 3 === 2) {
          last = null;
          continue;
        }
        const t = i / 89;
        const a = phase + arm / arms * Math.PI * 2 + t * Math.PI * (1.8 + (ring.turbulence ?? 0) * 1.7 + drive);
        const rr = radius * (0.22 + t * 1.22);
        const p = local(Math.cos(a) * rr, Math.sin(t * Math.PI * 2 + phase) * radius * 0.16 * (ring.turbulence ?? 0.5), Math.sin(a) * rr * 0.72);
        if (last) dst = line(data, dst, last, p, color, glow * 0.55 * (1 - t * 0.5));
        if (i % 13 === 0) dst = stellarBody(data, dst, p, radius * (0.018 + drive * 0.01), mixColor(color, [1.4, 1.35, 1.15]), glow * 0.35, phase + i);
        last = p;
      }
    }
    dst = stellarNursery(data, dst, local, radius, 10 + arms * 2, phase, color, alpha * (0.12 + drive * 0.5));
  } else if (type === 'solar-system' || type === 'binary-star' || type === 'planetary-ring') {
    if (type === 'binary-star') {
      const sep = radius * (0.42 + drive * 0.2);
      dst = stellarBody(data, dst, local(Math.cos(phase) * sep, 0, Math.sin(phase) * sep), radius * 0.12, color, glow, phase);
      dst = stellarBody(data, dst, local(-Math.cos(phase) * sep, 0, -Math.sin(phase) * sep), radius * 0.1, [1.5, 1.1, 0.65], glow * 0.8, -phase);
    }
    const planets = Math.max(2, ring.planets ?? 4);
    for (let p = 0; p < planets; p++) {
      const rr = radius * (0.38 + p * 0.18);
      const a = phase * (0.6 + p * 0.16) + p * 2.399;
      const planet = local(Math.cos(a) * rr, Math.sin(a * 1.7) * radius * 0.04, Math.sin(a) * rr * (0.66 + (p % 3) * 0.1));
      dst = orbitArc(data, dst, c, rr, rr * (0.66 + (p % 3) * 0.1), tilt + p * 0.19, a - 0.05 - drive * 0.03, a + 0.08 + drive * 0.06, color, alpha * (0.05 + drive * 0.09));
      dst = planetBody(data, dst, planet, radius * (0.055 + p * 0.008 + drive * 0.022), p % 2 ? [1.25, 1.45, 1.6] : color, glow * 0.82, phase + p, p % 3 === 0 || type === 'planetary-ring');
      if (p % 2 === 0 && drive > 0.18) {
        const moonA = a + phase * 0.6;
        const moon = local(Math.cos(a) * rr + Math.cos(moonA) * radius * 0.085, Math.sin(a * 1.7) * radius * 0.04 + Math.sin(moonA * 1.3) * radius * 0.035, Math.sin(a) * rr * (0.66 + (p % 3) * 0.1) + Math.sin(moonA) * radius * 0.085);
        dst = stellarBody(data, dst, moon, radius * 0.019, [1.25, 1.32, 1.4], glow * 0.38, moonA);
      }
    }
  } else if (type === 'gravity-well') {
    dst = accretionCore(data, dst, c, radius * (0.3 + drive * 0.14), phase, color, glow * 1.15);
    for (let i = 0; i < 5; i++) {
      const a = phase * (0.7 + i * 0.08) + i * 1.17;
      const orbitColor = i === 0 ? [0.04, 0.06, 0.12] : mixColor(color, [0.85, 1.0, 1.2]);
      dst = orbitArc(data, dst, c, radius * (0.36 + i * 0.18) * (1 + drive * 0.18), radius * (0.2 + i * 0.11), tilt + i * 0.28 + phase, a - 0.12, a + 0.18 + drive * 0.06, orbitColor, alpha * (0.12 + drive * 0.32) * (1 - i * 0.12));
    }
    if (drive > 0.22) dst = polarJets(data, dst, local, radius, phase, mixColor(color, [0.8, 1.25, 1.65]), alpha * drive * 0.7);
  } else if (type === 'crystal-lattice') {
    const points = [];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399 + phase * 0.3;
      points.push(local(Math.cos(a) * radius * (0.35 + (i % 3) * 0.18), (i - 4) * radius * 0.08, Math.sin(a) * radius * (0.45 + drive * 0.2)));
    }
    for (let i = 0; i < points.length; i++) {
      dst = stellarBody(data, dst, points[i], radius * (0.035 + drive * 0.012), mixColor(color, [1.3, 1.45, 1.55]), alpha * (0.44 + drive * 0.7), phase + i);
      for (let j = i + 1; j < points.length; j++) {
        if ((i + j) % 4 !== 0) continue;
        dst = line(data, dst, points[i], points[j], color, alpha * (0.12 + drive * 0.38));
      }
    }
  } else if (type === 'nebula-cluster' || type === 'star-nursery') {
    dst = nebulaBubbles(data, dst, local, radius, phase, color, alpha * (0.28 + drive * 0.52));
    for (let loop = 0; loop < 6; loop++) {
      let last = null;
      for (let i = 0; i < 64; i++) {
        const t = i / 63;
        const a = phase + loop * 1.1 + t * Math.PI * 2;
        const rr = radius * (0.35 + Math.sin(t * Math.PI) * (0.5 + drive * 0.25));
        const p = local(Math.cos(a) * rr, Math.sin(a * 2 + loop) * radius * 0.34, Math.sin(a + loop) * rr * 0.74);
        if (last) dst = line(data, dst, last, p, color, alpha * (0.28 + drive) * Math.sin(t * Math.PI));
        last = p;
      }
    }
  } else if (type === 'asteroid-belt') {
    for (let i = 0; i < 28; i++) {
      const a = phase * 0.7 + i * 2.399;
      const rr = radius * (0.82 + Math.sin(i * 7.1) * 0.18);
      const p = local(Math.cos(a) * rr, Math.sin(i) * radius * 0.08, Math.sin(a) * rr * 0.72);
      const q = local(Math.cos(a + 0.03) * (rr + radius * 0.06), Math.sin(i) * radius * 0.08, Math.sin(a + 0.03) * (rr + radius * 0.06) * 0.72);
      dst = line(data, dst, p, q, color, alpha * (0.55 + drive));
      if (i % 5 === 0) dst = stellarBody(data, dst, p, radius * (0.018 + drive * 0.012), mixColor(color, [1.35, 1.25, 1.08]), alpha * (0.42 + drive * 0.7), a);
    }
  } else {
    let last = null;
    for (let i = 0; i < 120; i++) {
      const t = i / 119;
      const a = phase + t * Math.PI * 8 * 1.618;
      const rr = radius * (0.18 + t * 1.35);
      const p = local(Math.cos(a) * rr, (t - 0.5) * radius * (1.2 + drive), Math.sin(a) * rr * 0.55);
      if (last) dst = line(data, dst, last, p, [1.65, 1.28, 0.34], alpha * (1 - t * 0.2) * (0.7 + drive));
      if (i % 19 === 0) dst = cometGlyph(data, dst, p, radius * (0.055 + drive * 0.02), phase + i, [1.65, 1.28, 0.34], alpha * (0.45 + drive));
      last = p;
    }
  }
  return dst;
}

function stellarNursery(data, dst, local, radius, count, phase, color, alpha) {
  for (let i = 0; i < count; i++) {
    const h = hashLocal(i * 9.31 + phase * 1.7);
    const a = phase * 0.2 + i * 2.399963229728653;
    const rr = radius * (0.16 + h * 0.95);
    const p = local(Math.cos(a) * rr, (hashLocal(i * 4.7) - 0.5) * radius * 0.28, Math.sin(a) * rr * (0.42 + h * 0.5));
    dst = stellarBody(data, dst, p, radius * (0.012 + h * 0.018), mixColor(color, [1.45, 1.35, 1.1]), alpha * (0.45 + h * 0.75), phase + i);
  }
  return dst;
}

function planetBody(data, dst, center, radius, color, alpha, phase = 0, ringed = false) {
  dst = stellarBody(data, dst, center, radius, color, alpha, phase);
  const shade = mixColor(color, [0.55, 0.65, 0.78]);
  dst = line(data, dst, [center[0] - radius * 0.75, center[1] - radius * 0.18, center[2]], [center[0] + radius * 0.55, center[1] + radius * 0.12, center[2]], shade, alpha * 0.28);
  if (ringed) {
    const cy = Math.cos(phase * 0.2);
    const sy = Math.sin(phase * 0.2);
    let last = null;
    for (let i = 0; i <= 32; i++) {
      const a = i / 32 * Math.PI * 2;
      if (Math.floor(i / 4) % 3 === 1) {
        last = null;
        continue;
      }
      const x = Math.cos(a) * radius * 2.1;
      const z = Math.sin(a) * radius * 0.62;
      const p = [center[0] + x * cy - z * sy, center[1] + Math.sin(a * 2) * radius * 0.08, center[2] + x * sy + z * cy];
      if (last) dst = line(data, dst, last, p, mixColor(color, [1.1, 1.05, 0.92]), alpha * 0.085);
      last = p;
    }
  }
  return dst;
}

function moonlet(data, dst, planet, orbit, radius, phase, alpha) {
  const moon = [
    planet[0] + Math.cos(phase) * orbit,
    planet[1] + Math.sin(phase * 1.4) * orbit * 0.22,
    planet[2] + Math.sin(phase) * orbit * 0.72
  ];
  dst = smallStar(data, dst, moon, radius, [1.18, 1.22, 1.28], alpha);
  return line(data, dst, planet, moon, [0.75, 0.78, 0.84], alpha * 0.12);
}

function bodyTone(color, family, index, h) {
  const mineral = [
    [0.42, 0.48, 0.66],
    [0.62, 0.46, 0.34],
    [0.38, 0.58, 0.42],
    [0.78, 0.62, 0.36],
    [0.5, 0.5, 0.55],
    [0.72, 0.36, 0.28]
  ][(family + index) % 6];
  return mixColor(mixColor(color, mineral), [0.5 + h * 0.38, 0.46 + hashLocal(h * 17.2) * 0.28, 0.42 + hashLocal(h * 29.1) * 0.24]);
}

function accretionCore(data, dst, center, radius, phase, color, alpha) {
  const dark = [0.01, 0.012, 0.018];
  for (let i = 0; i < 5; i++) {
    const r = radius * (0.6 + i * 0.22);
    dst = orbitArc(data, dst, center, r * 1.55, r * 0.52, phase * 0.14 + i * 0.18, phase + i * 0.5, phase + i * 0.5 + Math.PI * 1.3, i === 0 ? dark : color, alpha * (0.38 - i * 0.045));
  }
  return stellarBody(data, dst, center, radius * 0.42, dark, alpha * 0.9, phase);
}

function polarJets(data, dst, local, radius, phase, color, alpha) {
  for (let side = -1; side <= 1; side += 2) {
    let last = local(0, side * radius * 0.12, 0);
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      const p = local(Math.sin(phase + t * 7) * radius * 0.04 * (1 - t), side * radius * (0.12 + t * 1.45), Math.cos(phase + t * 5) * radius * 0.04 * (1 - t));
      dst = line(data, dst, last, p, color, alpha * Math.pow(1 - t, 0.8));
      last = p;
    }
  }
  return dst;
}

function nebulaBubbles(data, dst, local, radius, phase, color, alpha) {
  for (let bubble = 0; bubble < 5; bubble++) {
    const a = phase * 0.25 + bubble * 1.37;
    const center = local(Math.cos(a) * radius * 0.35, Math.sin(bubble * 2.1) * radius * 0.16, Math.sin(a) * radius * 0.28);
    const r = radius * (0.12 + bubble * 0.035);
    for (let i = 0; i < 3; i++) {
      dst = orbitArc(data, dst, center, r * (1 + i * 0.18), r * (0.58 + i * 0.1), phase + bubble * 0.7 + i * 0.4, phase + i, phase + i + Math.PI * 1.55, mixColor(color, [1.2, 1.1, 1.35]), alpha * (0.18 - i * 0.035));
    }
  }
  return dst;
}

function cometGlyph(data, dst, head, length, phase, color, alpha) {
  dst = stellarBody(data, dst, head, length * 0.22, color, alpha, phase);
  const tail = [Math.cos(phase) * length, Math.sin(phase * 0.7) * length * 0.35, Math.sin(phase) * length];
  for (let i = 0; i < 3; i++) {
    const spread = (i - 1) * length * 0.16;
    const q = [head[0] - tail[0] + spread, head[1] - tail[1] * 0.5, head[2] - tail[2] - spread * 0.4];
    dst = line(data, dst, head, q, color, alpha * (0.32 - i * 0.055));
  }
  return dst;
}

function smallStar(data, dst, center, radius, color, alpha) {
  dst = line(data, dst, [center[0] - radius, center[1], center[2]], [center[0] + radius, center[1], center[2]], color, alpha);
  dst = line(data, dst, [center[0], center[1] - radius, center[2]], [center[0], center[1] + radius, center[2]], color, alpha);
  return line(data, dst, [center[0], center[1], center[2] - radius], [center[0], center[1], center[2] + radius], color, alpha);
}

function stellarBody(data, dst, center, radius, color, alpha, phase = 0) {
  const core = Math.max(0.18, radius);
  dst = smallStar(data, dst, center, core, color, alpha);
  const halo = mixColor(color, [1.6, 1.45, 1.1]);
  for (let ray = 0; ray < 8; ray++) {
    const a = phase + ray / 8 * Math.PI * 2;
    const b = a + Math.PI * 0.5;
    const p = [
      center[0] + Math.cos(a) * core * 0.32,
      center[1] + Math.sin(b) * core * 0.18,
      center[2] + Math.sin(a) * core * 0.32
    ];
    const q = [
      center[0] + Math.cos(a) * core * (1.55 + (ray % 3) * 0.18),
      center[1] + Math.sin(b) * core * (0.72 + (ray % 2) * 0.18),
      center[2] + Math.sin(a) * core * (1.55 + (ray % 3) * 0.18)
    ];
    dst = line(data, dst, p, q, halo, alpha * 0.38);
  }
  return dst;
}

function orbitalDust(data, dst, local, radius, count, phase, color, alpha) {
  for (let i = 0; i < count; i++) {
    const h = hashLocal(i * 13.31 + phase * 2.7);
    const a = phase * (0.35 + h * 0.3) + i * 2.399963229728653;
    const rr = radius * (0.24 + h * 1.05);
    const lift = (hashLocal(i * 6.77 + 4.2) - 0.5) * radius * 0.42;
    const p = local(Math.cos(a) * rr, lift, Math.sin(a) * rr * (0.48 + h * 0.42));
    const len = radius * (0.022 + h * 0.045);
    const q = local(Math.cos(a + 0.035) * (rr + len), lift + Math.sin(a) * len * 0.4, Math.sin(a + 0.035) * (rr + len) * (0.48 + h * 0.42));
    dst = line(data, dst, p, q, mixColor(color, [1.25, 1.2, 1.08]), alpha * (0.55 + h * 0.55));
  }
  return dst;
}

function orbitArc(data, dst, center, rx, rz, tilt, start, end, color, alpha) {
  let last = null;
  const cy = Math.cos(tilt);
  const sy = Math.sin(tilt);
  const segments = 18;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = start * (1 - t) + end * t;
    const x = Math.cos(a) * rx;
    const z = Math.sin(a) * rz;
    const p = [center[0] + x * cy - z * sy, center[1] + Math.sin(a * 2) * rx * 0.018, center[2] + x * sy + z * cy];
    if (last) dst = line(data, dst, last, p, color, alpha * Math.sin(t * Math.PI));
    last = p;
  }
  return dst;
}

function tiltedOrbit(data, dst, center, rx, rz, tilt, color, alpha) {
  let last = null;
  const cy = Math.cos(tilt);
  const sy = Math.sin(tilt);
  for (let i = 0; i <= 72; i++) {
    const dash = Math.floor(i / 5) % 5;
    if (dash > 1 || i % 11 === 0) {
      last = null;
      continue;
    }
    const a = i / 72 * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const z = Math.sin(a) * rz;
    const p = [center[0] + x * cy - z * sy, center[1] + Math.sin(a * 2) * rx * 0.02, center[2] + x * sy + z * cy];
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function hashLocal(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function cameraFacingMarker(data, dst, center, radius, color, alpha) {
  for (let i = 0; i < 3; i++) {
    dst = offsetCircle(data, dst, center, radius * (0.75 + i * 0.16), 64, i * 0.7, color, alpha * (1 - i * 0.25));
  }
  return dst;
}

function motifRing(data, dst, ring, radius, segments, phase, color, alpha) {
  let last = null;
  const center = ring.center ?? [0, 0, 0];
  const family = ring.family ?? 0;
  const motif = ring.motif ?? family;
  const tilt = ring.tilt ?? 0;
  const eccentricity = ring.eccentricity ?? 1;
  const wobble = (ring.wobble ?? 0) + (ring.collision ?? 0) * 0.6;
  const broken = ring.broken ?? 0;
  const cy = Math.cos(tilt);
  const sy = Math.sin(tilt);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    if (broken > 0 && Math.sin(t * Math.PI * 6 + phase) > 1 - broken) {
      last = null;
      continue;
    }
    const a = phase + t * Math.PI * 2;
    let x = Math.cos(a) * radius * eccentricity;
    let y = Math.sin(a * 2 + phase) * radius * 0.1;
    let z = Math.sin(a) * radius;
    if (motif === 1) {
      x = Math.sin(a) * radius * 0.9;
      z = Math.sin(a * 2) * radius * 0.48;
    } else if (motif === 2) {
      const rr = radius * (0.45 + 0.55 * t);
      x = Math.cos(a * 2.1) * rr;
      z = Math.sin(a * 2.1) * rr;
      y += Math.sin(t * Math.PI * 4 + phase) * radius * 0.18;
    } else if (motif === 3) {
      const rr = radius * (0.78 + Math.sin(a * 5) * 0.18);
      x = Math.cos(a) * rr;
      z = Math.sin(a) * rr;
    } else if (motif === 4) {
      const rr = radius * (0.65 + Math.sin(a * 3 + phase) * 0.28);
      x = Math.cos(a) * rr;
      z = Math.sin(a * 1.5) * radius * 0.76;
      y += Math.cos(a * 2) * radius * 0.16;
    } else if (motif === 5) {
      const braid = Math.sin(a * 6 + phase) * radius * 0.14;
      x = Math.cos(a) * (radius + braid);
      z = Math.sin(a) * (radius - braid);
      y += Math.cos(a * 3 + phase) * radius * 0.22;
    } else if (motif === 6) {
      x = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.65) * radius;
      z = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.65) * radius;
      y += Math.sign(Math.sin(a * 4 + phase)) * radius * 0.08;
    } else if (motif === 7) {
      const rr = radius * (0.7 + 0.22 * Math.cos(a * 4));
      x = Math.cos(a + Math.sin(a * 2) * 0.32) * rr;
      z = Math.sin(a + Math.sin(a * 2) * 0.32) * rr;
      y += Math.sin(a * 2) * radius * 0.32;
    } else if (motif === 8) {
      const rr = radius * (0.48 + Math.sin(t * Math.PI) * 0.72);
      x = Math.cos(a * 1.65) * rr;
      z = Math.sin(a * 1.65) * rr;
      y += (t - 0.5) * radius * 0.8;
    } else if (motif === 9) {
      const tail = Math.pow(t, 1.8) * radius * 1.2;
      x = Math.cos(a) * radius * (1 - t * 0.25) + Math.cos(phase) * tail;
      z = Math.sin(a) * radius * (1 - t * 0.25) + Math.sin(phase) * tail;
      y += Math.sin(t * Math.PI * 3) * radius * 0.25;
    } else if (motif === 10) {
      const crescent = radius * (0.55 + Math.sin(t * Math.PI) * 0.42);
      x = Math.cos(a) * crescent + radius * 0.28;
      z = Math.sin(a) * radius * 0.72;
      y += Math.cos(a) * radius * 0.12;
    } else if (motif === 11) {
      const sides = 5;
      const k = Math.cos(Math.PI / sides) / Math.cos((a % (Math.PI * 2 / sides)) - Math.PI / sides);
      x = Math.cos(a) * radius * k * 0.82;
      z = Math.sin(a) * radius * k * 0.82;
      y += Math.sin(a * 5 + phase) * radius * 0.12;
    }
    x += Math.sin(a * (3 + family % 4) + phase) * radius * wobble * 0.12;
    y += Math.cos(a * (2 + family % 3) + phase) * radius * wobble * 0.18;
    z += Math.cos(a * (4 + family % 5) + phase) * radius * wobble * 0.12;
    const px = x * cy - z * sy;
    const pz = x * sy + z * cy;
    const p = [center[0] + px, center[1] + y, center[2] + pz];
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function curvedBridge(data, dst, a, b, color, alpha, type, phase) {
  let last = null;
  const lift = type === 'major' ? 18 : type === 'minor' ? -10 : type === 'dissonant' ? 7 : 10;
  for (let i = 0; i <= 56; i++) {
    const t = i / 56;
    const wobble = type === 'dissonant' ? Math.sin(t * Math.PI * 9 + phase) * 6 : Math.sin(t * Math.PI) * lift;
    const p = [
      a[0] * (1 - t) + b[0] * t,
      a[1] * (1 - t) + b[1] * t + wobble,
      a[2] * (1 - t) + b[2] * t + Math.sin(t * Math.PI * 2 + phase) * (type === 'major' ? 3 : 8)
    ];
    if (last) dst = line(data, dst, last, p, color, alpha * Math.sin(t * Math.PI));
    last = p;
  }
  return dst;
}

function mixColor(a, b) {
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
}

function darkCore(data, dst, radius, color, alpha) {
  for (let ring = 0; ring < 5; ring++) {
    const rr = radius * (0.55 + ring * 0.18);
    dst = circle(data, dst, rr, 96, ring * 0.31, color, alpha * (1 - ring * 0.14));
  }
  return dst;
}

function verticalPulse(data, dst, radius, phase, color, alpha) {
  for (let i = 0; i < 10; i++) {
    const a = phase + i / 10 * Math.PI * 2;
    const rr = radius * (0.12 + (i % 3) * 0.06);
    dst = line(data, dst, [Math.cos(a) * rr, Math.sin(a) * rr, -radius * 0.35], [Math.cos(a) * rr * 0.35, Math.sin(a) * rr * 0.35, radius * 0.35], color, alpha);
  }
  return dst;
}

function ellipse(data, dst, rx, ry, segments, phase, color, alpha) {
  let last = null;
  for (let i = 0; i <= segments; i++) {
    const a = phase + i / segments * Math.PI * 2;
    const p = [Math.cos(a) * rx, Math.sin(a) * ry, Math.sin(a * 2 + phase) * 0.8];
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function torusRing(data, dst, rx, ry, depth, segments, phase, color, alpha) {
  let lastA = null;
  let lastB = null;
  for (let i = 0; i <= segments; i++) {
    const a = phase + i / segments * Math.PI * 2;
    const z = Math.sin(a * 2 + phase) * depth;
    const wobble = Math.cos(a * 3 + phase) * depth * 0.2;
    const p = [Math.cos(a) * (rx + wobble), Math.sin(a) * ry, z];
    const q = [Math.cos(a) * (rx - wobble * 0.6), Math.sin(a) * (ry * 0.82), -z * 0.72];
    if (lastA) dst = line(data, dst, lastA, p, color, alpha);
    if (lastB) dst = line(data, dst, lastB, q, color, alpha * 0.72);
    lastA = p;
    lastB = q;
  }
  return dst;
}

function circle(data, dst, radius, segments, phase, color, alpha) {
  let last = null;
  for (let i = 0; i <= segments; i++) {
    const a = phase + i / segments * Math.PI * 2;
    const p = [Math.cos(a) * radius, Math.sin(a) * radius, Math.sin(a * 3 + phase) * 0.6];
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function spiral(data, dst, radius, phase, color, alpha) {
  let last = null;
  for (let i = 0; i < 160; i++) {
    const t = i / 159;
    const a = phase + t * Math.PI * 5.8;
    const rr = radius * (0.08 + t * 0.92);
    const p = [Math.cos(a) * rr, Math.sin(a) * rr, Math.sin(t * Math.PI * 4 + phase) * 2.2];
    if (last) dst = line(data, dst, last, p, color, alpha * (1 - t * 0.35));
    last = p;
  }
  return dst;
}

function helixSpiral(data, dst, radius, phase, depth, color, alpha) {
  let last = null;
  for (let i = 0; i < 180; i++) {
    const t = i / 179;
    const a = phase + t * Math.PI * 6.8;
    const rr = radius * (0.08 + t * 0.92);
    const p = [Math.cos(a) * rr, Math.sin(a) * rr, Math.sin(t * Math.PI * 3 + phase) * depth * (0.35 + t * 0.65)];
    if (last) dst = line(data, dst, last, p, color, alpha * (1 - t * 0.3));
    last = p;
  }
  return dst;
}

function vocalVeils(data, dst, radius, time, strength, color) {
  if (strength < 0.015) return dst;
  for (let veil = 0; veil < 8; veil++) {
    let last = null;
    const offset = (veil - 3.5) * radius * 0.09;
    const phase = time * (0.28 + strength * 0.8) + veil;
    for (let i = 0; i < 120; i++) {
      const t = i / 119;
      const y = (t - 0.5) * radius * 1.15;
      const x = offset + Math.sin(t * Math.PI * 3 + phase) * radius * (0.08 + strength * 0.14);
      const z = Math.cos(t * Math.PI * 2.2 + phase + veil * 0.7) * radius * (0.14 + strength * 0.22);
      const p = [x, y, z];
      if (last) dst = line(data, dst, last, p, color, (0.03 + strength * 0.16) * Math.sin(t * Math.PI));
      last = p;
    }
  }
  return dst;
}

function angularStreaks(data, dst, radius, time, strength, color) {
  if (strength < 0.012) return dst;
  for (let i = 0; i < 22; i++) {
    const h = Math.sin(i * 91.7) * 43758.5453;
    const seed = h - Math.floor(h);
    const a = seed * Math.PI * 2 + time * 0.08;
    const rr = radius * (0.42 + (Math.sin(i * 12.3) * 0.5 + 0.5) * 0.36);
    const len = radius * (0.045 + strength * 0.11);
    const p = [Math.cos(a) * rr, Math.sin(a) * rr, Math.sin(i + time) * radius * (0.22 + strength * 0.28)];
    const q = [p[0] + Math.cos(a + 1.1) * len, p[1] + Math.sin(a + 1.1) * len, p[2] + Math.sin(a * 2) * len * 1.2];
    dst = line(data, dst, p, q, color, 0.035 + strength * 0.22);
  }
  return dst;
}

function highSparks(data, dst, radius, time, strength, color) {
  if (strength < 0.01) return dst;
  for (let i = 0; i < 48; i++) {
    const a = i * 2.399 + time * (0.6 + strength * 2.2);
    const rr = radius * (0.7 + 0.22 * Math.sin(i * 1.7 + time));
    const z = Math.sin(i * 0.8 + time * 3) * radius * 0.55;
    const p = [Math.cos(a) * rr, Math.sin(a) * rr, z];
    const q = [Math.cos(a + 0.028 + strength * 0.05) * (rr + radius * 0.025), Math.sin(a + 0.028 + strength * 0.05) * (rr + radius * 0.025), z + Math.cos(a * 3) * 1.8];
    dst = line(data, dst, p, q, color, 0.025 + strength * 0.18);
  }
  return dst;
}

function bridgeLines(data, dst, nodes, bridges, time, params = {}) {
  for (const bridge of bridges) {
    if (bridge.strength < 0.02) continue;
    const a = nodes.find((node) => node.index === bridge.from);
    const b = nodes.find((node) => node.index === bridge.to);
    if (!a || !b) continue;
    const ac = a.center;
    const bc = b.center;
    const bass = bridge.bass ?? 0;
    const vocal = bridge.vocal ?? 0;
    const spark = bridge.spark ?? 0;
    const bloom = bridge.bloom ?? 0;
    const color = bloom > 0.2
      ? [1.55, 0.95 + bloom * 0.35, 1.4 + bloom * 0.4]
      : spark > vocal && spark > bass
        ? [1.6, 1.35, 0.82 + spark * 0.65]
        : vocal > bass
          ? [0.48, 1.35, 1.05]
          : [0.48, 0.62, 1.55];
    const travel = params.travelBlend ?? 0;
    const strands = 3 + Math.floor(vocal * 5 + spark * 8 + bloom * 10 + travel * 8);
    for (let s = 0; s < strands; s++) {
      let last = null;
      const phase = time * (0.6 + bridge.spark) + s * 1.7;
      const points = spark > vocal && spark > bass ? 20 : 46;
      for (let i = 0; i < points; i++) {
        const t = i / (points - 1);
        const bow = Math.sin(t * Math.PI);
        const jitter = spark > 0.2 ? (Math.sin((i + s) * 12.989 + time * 18) * 0.5 + 0.5) : 0;
        const p = [
          ac[0] * (1 - t) + bc[0] * t + Math.sin(phase + t * 8) * bow * (3.5 + vocal * 5) + jitter * spark * 3,
          ac[1] * (1 - t) + bc[1] * t + Math.cos(phase * 0.7 + t * 5) * bow * (1.8 + bass * 3 + bloom * 5),
          ac[2] * (1 - t) + bc[2] * t + Math.sin(phase * 1.3 + t * 6) * bow * (4.5 + vocal * 5 + bloom * 7) - jitter * spark * 3
        ];
        const alpha = (0.035 + bridge.strength * 0.18 + bass * 0.08 + spark * 0.12 + bloom * 0.22 + travel * 0.16) * bow;
        if (last) dst = line(data, dst, last, p, color, alpha);
        last = p;
      }
    }
  }
  return dst;
}

function transformVertices(data, start, end, center) {
  for (let i = start; i < end; i += 7) {
    data[i] += center[0];
    data[i + 1] += center[1];
    data[i + 2] += center[2];
  }
}

function tint(color, palette) {
  return [color[0] * palette[0], color[1] * palette[1], color[2] * palette[2]];
}

function nodalCurve(data, dst, radius, offset, kx, ky, time, color, alpha) {
  let last = null;
  for (let i = 0; i < 150; i++) {
    const x = -radius + (i / 149) * radius * 2;
    const y = Math.sin(x * 0.08 * kx + time) * radius * 0.26 + offset * radius * 0.7;
    if (Math.hypot(x, y) > radius * 0.98) {
      last = null;
      continue;
    }
    const z = Math.sin(x * 0.05 * kx + y * 0.04 * ky - time) * 1.4;
    const p = [x, y, z];
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function flowerPetals(data, dst, radius, time, color, alpha) {
  const petals = 10;
  for (let petal = 0; petal < petals; petal++) {
    let last = null;
    const phase = petal / petals * Math.PI * 2 + time * 0.05;
    for (let i = 0; i < 90; i++) {
      const t = i / 89;
      const a = phase + Math.sin(t * Math.PI) * 0.55;
      const rr = radius * (0.2 + Math.sin(t * Math.PI) * 0.92);
      const p = [
        Math.cos(a) * rr,
        Math.sin(a) * rr,
        Math.sin(t * Math.PI * 2 + phase + petal * 0.6) * radius * 0.34
      ];
      if (last) dst = line(data, dst, last, p, color, alpha * Math.sin(t * Math.PI));
      last = p;
    }
  }
  return dst;
}

function riftCracks(data, dst, radius, time, color, alpha) {
  for (let crack = 0; crack < 7; crack++) {
    let last = null;
    const phase = crack * 1.37 + time * 0.08;
    const side = crack % 2 ? -1 : 1;
    for (let i = 0; i < 54; i++) {
      const t = i / 53;
      const x = (t - 0.5) * radius * 1.4;
      const y = side * (Math.sin(t * Math.PI * 2.7 + phase) * radius * 0.11 + (crack - 3) * radius * 0.07);
      const z = Math.cos(t * 8 + phase) * 4.5;
      const p = [x, y, z];
      if (last) dst = line(data, dst, last, p, color, alpha * (1 - Math.abs(t - 0.5) * 1.15));
      last = p;
    }
  }
  return dst;
}

function tiltedEllipse(data, dst, center, rx, rz, phase, tilt, color, alpha) {
  let last = null;
  const cy = Math.cos(tilt);
  const sy = Math.sin(tilt);
  for (let i = 0; i <= 96; i++) {
    const a = phase + i / 96 * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const z = Math.sin(a) * rz;
    const p = [
      center[0] + x * cy - z * sy,
      center[1] + Math.sin(a * 2 + phase) * rx * 0.025,
      center[2] + x * sy + z * cy
    ];
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function meridianArc(data, dst, radius, phase, color, alpha) {
  let last = null;
  for (let i = 0; i <= 84; i++) {
    const t = i / 84;
    const b = (t - 0.5) * Math.PI;
    const x = Math.cos(phase) * Math.cos(b) * radius * 0.92;
    const y = Math.sin(b) * radius * 0.72;
    const z = Math.sin(phase) * Math.cos(b) * radius * 0.92;
    const p = [x, y, z];
    if (last && i % 6 !== 0) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function pentagonalGate(data, dst, center, radius, phase, color, alpha) {
  const points = [];
  for (let i = 0; i < 5; i++) {
    const a = phase + i / 5 * Math.PI * 2;
    points.push([center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, center[2] + Math.sin(a * 2 + phase) * radius * 0.18]);
  }
  for (let i = 0; i < 5; i++) {
    dst = line(data, dst, points[i], points[(i + 1) % 5], color, alpha);
    dst = line(data, dst, points[i], points[(i + 2) % 5], color, alpha * 0.5);
  }
  return dst;
}

function smoothstepLocal(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function line(data, dst, a, b, color, alpha) {
  dst = vertex(data, dst, a, color, alpha);
  return vertex(data, dst, b, color, alpha);
}

function vertex(data, dst, p, color, alpha) {
  data[dst++] = p[0];
  data[dst++] = p[1];
  data[dst++] = p[2];
  data[dst++] = color[0];
  data[dst++] = color[1];
  data[dst++] = color[2];
  data[dst++] = alpha;
  return dst;
}

function boardPalette(shift, bass, mid, high) {
  const p = shift * Math.PI * 2;
  return [
    0.45 + 0.9 * Math.max(0, Math.sin(p + 0.2)) + bass * 0.8,
    0.55 + 0.85 * Math.max(0, Math.sin(p + 2.1)) + mid * 0.55,
    0.75 + 0.8 * Math.max(0, Math.sin(p + 4.3)) + high * 0.7
  ];
}

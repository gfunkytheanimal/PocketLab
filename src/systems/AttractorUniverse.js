import * as pc from 'playcanvas/build/playcanvas.mjs';
import { CpuParticleSimulator } from './CpuParticleSimulator.js';
import { GpuParticleSimulator } from './GpuParticleSimulator.js';
import { createParticleMaterial } from '../rendering/materials.js';
import { createPointMesh, fillIndexBuffer, uploadCpuParticles } from '../rendering/mesh.js';
import { UniverseState } from '../universe/UniverseState.js';
import { VolumetricFogSystem } from '../volumetrics/VolumetricFogSystem.js';
import { TrailSystem } from '../rendering/TrailSystem.js';
import { DiagnosticsOverlay } from '../rendering/DiagnosticsOverlay.js';
import { EncounterRenderer } from '../encounters/EncounterRenderer.js';
import { SoundBoardGeometry } from '../rendering/SoundBoardGeometry.js';
import { CosmicCloudSystem } from '../rendering/CosmicCloudSystem.js';
import { CosmicImpostorSystem } from '../rendering/CosmicImpostorSystem.js';
import { NebulaNodeSystem } from './NebulaNodeSystem.js';

export class AttractorUniverse {
  constructor(app, camera, params) {
    this.app = app;
    this.camera = camera;
    this.params = params;
    this.device = app.graphicsDevice;
    const query = new URLSearchParams(window.location.search);
    this.useGpuCompute = query.has('gpu') && this.device.deviceType === pc.DEVICETYPE_WEBGPU && this.device.supportsCompute;
    this.time = 0;
    this.entity = null;
    this.mesh = null;
    this.vertexBuffer = null;
    this.material = null;
    this.universe = new UniverseState(params);
    this.nebulaNodes = new NebulaNodeSystem(params);
    this.volumetrics = new VolumetricFogSystem(app, params);
    this.trails = new TrailSystem(app, params);
    this.encounterRenderer = new EncounterRenderer(app, params, this.universe);
    this.cosmicClouds = new CosmicCloudSystem(app, params);
    this.cosmicImpostors = new CosmicImpostorSystem(app, params);
    this.soundBoardGeometry = new SoundBoardGeometry(app, params);
    this.simulator = this.useGpuCompute
      ? new GpuParticleSimulator(this.device, params)
      : new CpuParticleSimulator(params);
    this.diagnostics = new DiagnosticsOverlay(this.device, this);

    this.reset();
  }

  reset() {
    if (this.meshInstance) {
      this.app.scene.layers.getLayerById(pc.LAYERID_WORLD).removeMeshInstances([this.meshInstance]);
      this.meshInstance = null;
    }
    if (this.entity) {
      this.entity.destroy();
      this.entity = null;
    }

    const requested = Math.floor(this.params.particleCount);
    const cpuCap = this.params.appMode === 'sound-board' ? 65000 : (this.params.cleanFlow ? 90000 : 56000);
    const count = this.useGpuCompute ? requested : Math.min(requested, cpuCap);
    this.universe.reset(this.camera.position);
    this.nebulaNodes.reset();
    this.simulator.reset(count, this.camera.position);

    const pointMesh = createPointMesh(this.device, count, this.useGpuCompute);
    this.mesh = pointMesh.mesh;
    this.vertexBuffer = pointMesh.vertexBuffer;
    if (this.useGpuCompute) {
      fillIndexBuffer(this.vertexBuffer, count);
    } else {
      uploadCpuParticles(this.vertexBuffer, this.simulator.particles, count);
    }

    this.material = createParticleMaterial(this.useGpuCompute);
    if (this.useGpuCompute) {
      this.material.setParameter('particles', this.simulator.storageBuffer);
      this.material.update();
    }

    const meshInstance = new pc.MeshInstance(this.mesh, this.material);
    meshInstance.cull = false;
    this.entity = new pc.Entity('recursive-attractor-particles');
    this.app.root.addChild(this.entity);
    meshInstance.node = this.entity;
    this.app.scene.layers.getLayerById(pc.LAYERID_WORLD).addMeshInstances([meshInstance]);
    this.meshInstance = meshInstance;
  }

  update(dt) {
    this.time += dt;
    this.universe.beginFrame(this.camera, dt, this.time);
    this.nebulaNodes.update(this.time, dt);
    this.simulator.update(dt, this.camera.position, this.universe);
    if (!this.useGpuCompute) {
      uploadCpuParticles(this.vertexBuffer, this.simulator.particles, this.simulator.count);
      this.trails.update(this.simulator.particles, this.simulator.count, this.params.paletteShift, this.camera);
    }
    this.volumetrics.meshInstance.visible = this.params.appMode !== 'sound-board';
    if (this.params.appMode !== 'sound-board') this.volumetrics.update(this.universe, this.camera, this.time);
    this.encounterRenderer.meshInstance.visible = this.params.appMode !== 'sound-board';
    if (this.params.appMode !== 'sound-board') this.encounterRenderer.update(this.camera, this.time);
    this.cosmicClouds.update(this.camera, this.time);
    this.cosmicImpostors.update(this.camera, this.time);
    this.soundBoardGeometry.update(this.time);
    this.meshInstance.visible = !this.params.trailOnly && (this.params.dotOpacity ?? 0) > 0.001;
    this.material.setParameter('uTime', this.time);
    const demoPointScale = this.params.primaryMode === 'demo' && this.params.pianoPhysicsMode ? 0.46 : 1;
    const inside = this.params.insideBlend ?? 0;
    const pianoInsideScale = this.params.pianoPhysicsMode ? (1 + inside * 0.12) : (1 + inside * 0.75);
    this.material.setParameter('uParticleSize', this.params.particleSize * demoPointScale * pianoInsideScale);
    this.material.setParameter('uResolution', [this.device.width, this.device.height]);
    this.material.setParameter('uBloomStrength', this.params.bloomStrength * (this.params.pianoPhysicsMode ? 0.72 : 1));
    this.material.setParameter('uFogDensity', this.params.fogDensity * (this.params.pianoPhysicsMode ? 0.38 : 1));
    this.material.setParameter('uChromaticAberration', this.params.chromaticAberration);
    this.material.setParameter('uPaletteShift', this.params.paletteShift);
    this.material.setParameter('uHorizonWarp', this.params.eventHorizon);
    const cloudBoost = this.params.appMode === 'sound-board' && !this.params.pianoPhysicsMode ? (1 + (this.params.cloudDensity ?? 0.7) * 0.55 + (this.params.audioEnergy ?? 0) * (this.params.audioReactivity ?? 1) * 0.6 + (this.params.insideBlend ?? 0) * 0.5 + (this.params.travelBlend ?? 0) * 0.25) : 1;
    const objectMaturityFade = this.params.primaryMode === 'demo'
      ? 1 - Math.min(0.58, (this.params.songObjectCount ?? 0) / 260)
      : 1;
    const causalPianoObjectBoost = this.params.primaryMode === 'piano'
      && this.params.noteLayout === 'causal-universe'
      && (this.params.songObjectCount ?? 0) > 0
      ? Math.min(1.45, 0.65 + (this.params.songObjectCount ?? 0) / 90)
      : 1;
    const demoBirthOpacity = this.params.primaryMode === 'demo'
      ? (0.04 + Math.pow(Math.max(0, this.params.demoBuildProgress ?? 0), 1.05) * 0.24) * objectMaturityFade
      : 1;
    const demoCloseDim = this.params.primaryMode === 'demo' ? (1 - Math.min(0.5, this.params.insideBlend ?? 0)) : 1;
    const dormantPianoOpacity = this.params.primaryMode === 'piano'
      && this.params.pianoPhysicsMode
      && this.params.noteLayout === 'causal-universe'
      && this.params.almightyWaveformMode
      && !this.params.originEstablished
      && (this.params.songObjects?.length ?? 0) === 0
      ? 0
      : 1;
    const firstJamSparkOpacity = this.params.primaryMode === 'piano'
      && this.params.pianoPhysicsMode
      && this.params.noteLayout === 'causal-universe'
      && (this.params.jamGrowthBudget ?? 0) <= 1
      && !this.params.prebuiltUniverseOnStart
      ? 0
      : 1;
    this.material.setParameter('uDotOpacity', this.params.trailOnly ? 0 : this.params.dotOpacity * (this.params.particleEnergy ?? 1) * cloudBoost * demoBirthOpacity * demoCloseDim * dormantPianoOpacity * causalPianoObjectBoost * firstJamSparkOpacity);
    this.material.setParameter('uAppMode', this.params.appMode === 'sound-board' ? 1 : 0);
    this.material.setParameter('uPianoPhysics', this.params.pianoPhysicsMode ? 1 : 0);
    this.material.setParameter('uColorGrade', this.params.colorGrade);
    this.material.setParameter('uContrast', this.params.contrast);
    this.material.setParameter('uSaturation', this.params.saturation);
    this.diagnostics.update();
  }
}

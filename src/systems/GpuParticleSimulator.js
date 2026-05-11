import * as pc from 'playcanvas/build/playcanvas.mjs';
import { particleUpdateWGSL } from '../shaders/particleUpdate.wgsl.js';
import { randomInSphere } from '../math/random.js';

const FLOATS_PER_PARTICLE = 8;

export class GpuParticleSimulator {
  constructor(device, params) {
    this.device = device;
    this.params = params;
    this.count = 0;
    this.time = 0;
    this.storageBuffer = null;
    this.compute = null;
    this.validationStatus = 'not initialized';
  }

  reset(count, cameraPosition) {
    this.destroy();
    this.count = count;
    const initial = new Float32Array(count * FLOATS_PER_PARTICLE);
    for (let i = 0; i < count; i++) {
      const p = randomInSphere(i, this.params.recycleRadius * 0.92);
      const src = i * FLOATS_PER_PARTICLE;
      initial[src] = p[0] + cameraPosition.x;
      initial[src + 1] = p[1] + cameraPosition.y;
      initial[src + 2] = p[2] + cameraPosition.z - this.params.recycleRadius * 0.35;
      initial[src + 3] = Math.random();
      initial[src + 4] = 0;
      initial[src + 5] = 0;
      initial[src + 6] = 0;
      initial[src + 7] = Math.random() * 1024;
    }

    this.storageBuffer = new pc.StorageBuffer(
      this.device,
      initial.byteLength,
      pc.BUFFERUSAGE_STORAGE | pc.BUFFERUSAGE_COPY_DST | pc.BUFFERUSAGE_COPY_SRC
    );
    this.storageBuffer.write(0, initial, 0, initial.length);
    this.validationStatus = 'storage write pending';
    this.storageBuffer.read(0, 32, null, true)
      .then((data) => {
        const floats = new Float32Array(data.buffer, data.byteOffset, Math.min(8, data.byteLength / 4));
        const sane = Number.isFinite(floats[0]) && Number.isFinite(floats[1]) && Number.isFinite(floats[2]);
        this.validationStatus = sane ? `storage read ok ${floats[0].toFixed(2)},${floats[1].toFixed(2)},${floats[2].toFixed(2)}` : 'storage read invalid';
      })
      .catch((error) => {
        this.validationStatus = `storage read failed: ${error.message}`;
      });

    const uniformFormat = new pc.UniformBufferFormat(this.device, [
      new pc.UniformFormat('cameraTime', pc.UNIFORMTYPE_VEC4),
      new pc.UniformFormat('sim', pc.UNIFORMTYPE_VEC4)
    ]);
    const shader = new pc.Shader(this.device, {
      name: 'RecursiveAttractorParticleUpdate',
      shaderLanguage: pc.SHADERLANGUAGE_WGSL,
      cshader: particleUpdateWGSL,
      computeUniformBufferFormats: { params: uniformFormat },
      computeBindGroupFormat: new pc.BindGroupFormat(this.device, [
        new pc.BindStorageBufferFormat('particles', pc.SHADERSTAGE_COMPUTE),
        new pc.BindUniformBufferFormat('params', pc.SHADERSTAGE_COMPUTE)
      ])
    });
    this.compute = new pc.Compute(this.device, shader, 'RecursiveAttractorParticleUpdate');
    this.compute.setParameter('particles', this.storageBuffer);
  }

  update(dt, cameraPosition) {
    this.time += dt;
    this.compute.setParameter('cameraTime', [
      cameraPosition.x,
      cameraPosition.y,
      cameraPosition.z,
      this.time
    ]);
    this.compute.setParameter('sim', [
      Math.max(0, dt) * this.params.integrationStep * 110,
      this.params.fieldStrength,
      this.params.recursiveStrength,
      this.count
    ]);
    this.compute.setupDispatch(Math.ceil(this.count / 128), 1, 1);
    this.device.computeDispatch([this.compute], 'recursive-attractor-update');
    if (this.validationStatus.startsWith('storage read ok')) {
      this.validationStatus = 'compute dispatched; render path under test';
    }
  }

  destroy() {
    if (this.compute) {
      this.compute.destroy();
      this.compute = null;
    }
    if (this.storageBuffer) {
      this.storageBuffer.destroy();
      this.storageBuffer = null;
    }
  }
}

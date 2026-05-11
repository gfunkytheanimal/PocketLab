import * as pc from 'playcanvas/build/playcanvas.mjs';
import { createVolumetricMaterial } from './volumetricMaterial.js';

export class VolumetricFogSystem {
  constructor(app, params) {
    this.app = app;
    this.params = params;
    this.billboardCount = params.volumetricBillboards ?? 96;
    this.vertexCount = this.billboardCount * 4;
    this.indexCount = this.billboardCount * 6;

    const format = new pc.VertexFormat(app.graphicsDevice, [
      { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR1, components: 4, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR2, components: 2, type: pc.TYPE_FLOAT32 }
    ]);
    this.vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, format, this.vertexCount, pc.BUFFER_DYNAMIC);
    const indexBuffer = new pc.IndexBuffer(app.graphicsDevice, pc.INDEXFORMAT_UINT16, this.indexCount, pc.BUFFER_STATIC);
    const indices = new Uint16Array(indexBuffer.lock());
    let dst = 0;
    for (let i = 0; i < this.billboardCount; i++) {
      const v = i * 4;
      indices[dst++] = v;
      indices[dst++] = v + 1;
      indices[dst++] = v + 2;
      indices[dst++] = v;
      indices[dst++] = v + 2;
      indices[dst++] = v + 3;
    }
    indexBuffer.unlock();

    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.mesh.vertexBuffer = this.vertexBuffer;
    this.mesh.indexBuffer[0] = indexBuffer;
    this.mesh.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(500, 500, 500));
    this.mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
    this.mesh.primitive[0].base = 0;
    this.mesh.primitive[0].count = this.indexCount;
    this.mesh.primitive[0].indexed = true;
    this.material = createVolumetricMaterial();
    this.meshInstance = new pc.MeshInstance(this.mesh, this.material);
    this.meshInstance.cull = false;
    this.entity = new pc.Entity('recursive-volumetric-fog');
    app.root.addChild(this.entity);
    this.meshInstance.node = this.entity;
    app.scene.layers.getLayerById(pc.LAYERID_WORLD).addMeshInstances([this.meshInstance]);
  }

  update(universe, camera, time) {
    const data = new Float32Array(this.vertexBuffer.lock());
    const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
    const cells = universe.memory.highEnergyCells;
    const structures = [
      ...universe.structures,
      ...universe.echoes.echoes,
      ...universe.entities.entities.map((e) => ({
        center: e.center,
        radius: 10 + e.energy * 18,
        energy: e.energy,
        colorPhase: e.phase * 0.159,
        type: 'field entity'
      })),
      ...universe.horizons.active.map((h) => ({
        center: h.center,
        radius: h.radius * 0.55,
        energy: 0.3 + h.energy,
        colorPhase: h.phase * 0.1,
        type: h.type
      }))
    ];
    const right = camera.entity.right;
    const up = camera.entity.up;
    let dst = 0;
    for (let i = 0; i < this.billboardCount; i++) {
      const source = structures[i % Math.max(1, structures.length)] ?? cells[i % Math.max(1, cells.length)];
      const fallbackDepth = -camera.forwardTravel - 20 - i * 0.9;
      const center = source?.center ?? [source?.x ?? Math.sin(i) * 30, source?.y ?? Math.cos(i * 1.7) * 18, source?.z ?? fallbackDepth];
      const energy = (source?.energy ?? source?.score ?? 0.05) * (universe.biomes.primary.influence.fog ?? 1);
      const clean = !!this.params.cleanFlow;
      const radiusLimit = clean ? 8 : 18;
      const radius = Math.min(radiusLimit, (source?.radius ?? 5 + energy * 22) * this.params.volumetricScale);
      const phase = (source?.colorPhase ?? i * 0.011) + this.params.paletteShift + universe.biomes.primary.influence.color;
      const color = spectralFog(phase, energy);
      for (let c = 0; c < 4; c++) {
        const cx = corners[c * 2];
        const cy = corners[c * 2 + 1];
        data[dst++] = center[0] + (right.x * cx + up.x * cy) * radius;
        data[dst++] = center[1] + (right.y * cx + up.y * cy) * radius;
        data[dst++] = center[2] + (right.z * cx + up.z * cy) * radius;
        data[dst++] = color[0];
        data[dst++] = color[1];
        data[dst++] = color[2];
        const alphaLimit = clean ? 0.018 : 0.065;
        data[dst++] = Math.min(alphaLimit, this.params.volumetricDensity * (0.08 + energy * 0.55));
        data[dst++] = cx;
        data[dst++] = cy;
      }
    }
    this.vertexBuffer.unlock();
    this.material.setParameter('uTime', time);
    this.material.setParameter('uFogPulse', 0.22 + universe.audio.level * 0.8 + universe.harmonics.convergence * 0.35 + this.params.eventHorizon * 0.5);
  }
}

function spectralFog(t, energy) {
  const p = t * Math.PI * 2;
  return [
    (0.02 + 0.28 * Math.max(0, Math.sin(p + 0.3))) * (0.35 + energy),
    (0.05 + 0.34 * Math.max(0, Math.sin(p + 2.2))) * (0.35 + energy),
    (0.08 + 0.4 * Math.max(0, Math.sin(p + 4.4))) * (0.35 + energy)
  ];
}

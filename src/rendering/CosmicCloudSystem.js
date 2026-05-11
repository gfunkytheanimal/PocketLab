import * as pc from 'playcanvas/build/playcanvas.mjs';

const CLOUDS = [
  { type: 0, center: [0, 0, -1.8], size: [34, 24], phase: 0.1, color: [0.35, 0.9, 1.25] },
  { type: 0, center: [0, 0, 8.5], size: [24, 18], phase: 0.8, color: [0.38, 0.7, 1.15] },
  { type: 1, center: [-12, 4, -3.5], size: [42, 16], phase: 1.7, color: [0.9, 0.45, 1.2] },
  { type: 1, center: [12, -5, -2.8], size: [40, 15], phase: 3.1, color: [0.35, 1.25, 0.9] },
  { type: 1, center: [3, 9, 13], size: [32, 14], phase: 3.8, color: [0.55, 1.1, 1.35] },
  { type: 2, center: [0, 0, 2.8], size: [20, 52], phase: 2.4, color: [0.72, 0.95, 1.55] },
  { type: 2, center: [-7, 1, -12], size: [18, 42], phase: 5.4, color: [0.9, 0.62, 1.35] },
  { type: 3, center: [0, 0, 0.8], size: [58, 58], phase: 4.2, color: [1.25, 0.85, 0.45] },
  { type: 3, center: [0, 0, -10], size: [46, 46], phase: 4.9, color: [0.75, 1.0, 1.4] },
  { type: 4, center: [-4, 2, 4.8], size: [64, 64], phase: 5.0, color: [0.85, 1.2, 1.5] },
  { type: 4, center: [6, -2, -15], size: [52, 52], phase: 6.0, color: [0.55, 0.95, 1.45] }
];
const MAX_NODES = 4;

export class CosmicCloudSystem {
  constructor(app, params) {
    this.app = app;
    this.params = params;
    this.vertexCount = CLOUDS.length * MAX_NODES * 4;
    this.indexCount = CLOUDS.length * MAX_NODES * 6;
    const format = new pc.VertexFormat(app.graphicsDevice, [
      { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR1, components: 4, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR2, components: 4, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR3, components: 2, type: pc.TYPE_FLOAT32 }
    ]);
    this.vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, format, this.vertexCount, pc.BUFFER_DYNAMIC);
    const indexBuffer = new pc.IndexBuffer(app.graphicsDevice, pc.INDEXFORMAT_UINT16, this.indexCount, pc.BUFFER_STATIC);
    const indices = new Uint16Array(indexBuffer.lock());
    let dst = 0;
    for (let i = 0; i < CLOUDS.length * MAX_NODES; i++) {
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
    this.mesh.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(160, 160, 160));
    this.mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
    this.mesh.primitive[0].base = 0;
    this.mesh.primitive[0].count = this.indexCount;
    this.mesh.primitive[0].indexed = true;
    this.material = createCloudMaterial();
    this.meshInstance = new pc.MeshInstance(this.mesh, this.material);
    this.meshInstance.cull = false;
    this.entity = new pc.Entity('cosmic-clouds');
    app.root.addChild(this.entity);
    this.meshInstance.node = this.entity;
    app.scene.layers.getLayerById(pc.LAYERID_WORLD).addMeshInstances([this.meshInstance]);
  }

  update(camera, time) {
    this.meshInstance.visible = this.params.appMode === 'sound-board' && this.params.cloudsEnabled !== false && !this.params.pianoPhysicsMode;
    if (!this.meshInstance.visible) return;
    const right = camera.entity.right;
    const up = camera.entity.up;
    const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
    const data = new Float32Array(this.vertexBuffer.lock());
    const bands = this.params.audioBands ?? {};
    const energy = (this.params.audioEnergy ?? 0) * (this.params.audioReactivity ?? 1);
    const flower = this.params.cosmicFlower ?? 0;
    const rift = this.params.soundRift ?? 0;
    const tint = this.params.cloudTint ?? [1, 1, 1];
    let dst = 0;
    const nodes = this.params.nebulaNodes?.length ? this.params.nebulaNodes.slice(0, MAX_NODES) : [{ center: [0, 0, 0], size: 1, palette: [1, 1, 1], profile: {} }];
    let quads = 0;
    for (const node of nodes) {
      const profile = node.profile ?? {};
      const palette = node.palette ?? [1, 1, 1];
      const viewFocus = node.index === this.params.focusNodeIndex ? 1 + (this.params.insideBlend ?? 0) * 1.05 + (this.params.travelBlend ?? 0) * 0.3 : 1 - (this.params.insideBlend ?? 0) * 0.72;
      for (let i = 0; i < CLOUDS.length; i++) {
        const cloud = CLOUDS[i];
        if (node.index === 0 && cloud.type === 2) continue;
        if (node.index === 1 && (cloud.type === 3 || cloud.type === 4)) continue;
        if (node.index === 2 && cloud.type === 2) continue;
        const rawBand = [bands.bass, bands.sub, bands.lowMid, bands.lowMid, bands.mid, bands.mid, bands.highMid, bands.bass, bands.sub, bands.high, bands.high][i] ?? 0;
        const profileKey = ['bass', 'sub', 'lowMid', 'lowMid', 'mid', 'mid', 'highMid', 'bass', 'sub', 'high', 'high'][i];
        const band = rawBand * (profile[profileKey] ?? 1);
        const scale = (node.size ?? 1) * (1 + energy * 0.1 + band * 0.5 + (cloud.type === 3 ? flower * 0.7 : 0) + (this.params.insideBlend ?? 0) * (node.index === this.params.focusNodeIndex ? 0.6 : 0));
        const parallax = 1 + Math.abs(cloud.center[2]) * 0.025;
        const cx = (node.center?.[0] ?? 0) + cloud.center[0] * (node.size ?? 1) + Math.sin(time * 0.09 + cloud.phase + node.index) * (1.5 + band * 5) * parallax;
        const cy = (node.center?.[1] ?? 0) + cloud.center[1] * (node.size ?? 1) + Math.cos(time * 0.07 + cloud.phase + node.index) * (1.0 + band * 3.5) * parallax;
        const cz = (node.center?.[2] ?? 0) + cloud.center[2] * (node.size ?? 1) + Math.sin(time * 0.11 + cloud.phase + node.index) * (2.5 + band * 7);
        const sx = cloud.size[0] * scale;
        const sy = cloud.size[1] * scale * (1 + (cloud.type === 2 ? (bands.mid ?? 0) * 0.55 : 0));
        const alpha = (0.14 + band * 0.16 + energy * 0.06 + flower * 0.1) * (this.params.cloudDensity ?? 0.7) * Math.max(0.12, viewFocus);
        for (let c = 0; c < 4; c++) {
          const ux = corners[c * 2];
          const uy = corners[c * 2 + 1];
          data[dst++] = cx + right.x * ux * sx + up.x * uy * sy;
          data[dst++] = cy + right.y * ux * sx + up.y * uy * sy;
          data[dst++] = cz + right.z * ux * sx + up.z * uy * sy;
          data[dst++] = cloud.color[0] * tint[0] * palette[0];
          data[dst++] = cloud.color[1] * tint[1] * palette[1];
          data[dst++] = cloud.color[2] * tint[2] * palette[2];
          data[dst++] = alpha;
          data[dst++] = cloud.type;
          data[dst++] = cloud.phase;
          data[dst++] = flower;
          data[dst++] = rift;
          data[dst++] = ux;
          data[dst++] = uy;
        }
        quads++;
      }
    }
    this.vertexBuffer.unlock();
    this.mesh.primitive[0].count = quads * 6;
    this.material.setParameter('uTime', time);
    this.material.setParameter('uCloudGlow', this.params.cosmicGlow ?? 1);
    this.material.setParameter('uAudio', [bands.sub ?? 0, bands.bass ?? 0, bands.mid ?? 0, bands.high ?? 0]);
  }
}

function createCloudMaterial() {
  const material = new pc.ShaderMaterial({
    uniqueName: 'CosmicCloudVolume',
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aColorAlpha: pc.SEMANTIC_ATTR1,
      aCloud: pc.SEMANTIC_ATTR2,
      aUv: pc.SEMANTIC_ATTR3
    },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec4 aColorAlpha;
      attribute vec4 aCloud;
      attribute vec2 aUv;
      uniform mat4 matrix_viewProjection;
      varying vec4 vColorAlpha;
      varying vec4 vCloud;
      varying vec2 vUv;
      void main(void) {
        gl_Position = matrix_viewProjection * vec4(aPosition, 1.0);
        vColorAlpha = aColorAlpha;
        vCloud = aCloud;
        vUv = aUv;
      }
    `,
    fragmentGLSL: `
      precision highp float;
      uniform float uTime;
      uniform float uCloudGlow;
      uniform vec4 uAudio;
      varying vec4 vColorAlpha;
      varying vec4 vCloud;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x), mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }
      void main(void) {
        vec2 uv = vUv;
        float r = length(uv);
        float base = smoothstep(1.08, 0.12, r);
        float n = noise(uv * 2.7 + vec2(uTime * 0.035 + vCloud.y, -uTime * 0.025));
        n += 0.55 * noise(uv * 5.4 + vec2(-uTime * 0.045, uTime * 0.04 + vCloud.y));
        float curl = sin(atan(uv.y, uv.x) * (3.0 + vCloud.x) + r * 7.0 - uTime * (0.35 + uAudio.y));
        float flower = max(0.0, sin(atan(uv.y, uv.x) * 8.0 + uTime * 0.35)) * vCloud.z;
        float rift = smoothstep(0.035, 0.0, abs(uv.y + sin(uv.x * 5.0 + uTime) * 0.08)) * vCloud.w;
        float density = base * smoothstep(0.45, 1.3, n + curl * 0.16 + flower * 0.6);
        density = max(density, rift * 0.75);
        vec3 color = vColorAlpha.rgb * (0.65 + n * 0.9 + flower * 1.2 + rift * 1.6) * uCloudGlow;
        color += vec3(1.0, 0.84, 0.52) * flower * 0.55 + vec3(0.55, 0.9, 1.6) * rift * 0.75;
        gl_FragColor = vec4(color * density, density * vColorAlpha.a);
      }
    `
  });
  material.blendType = pc.BLEND_ADDITIVEALPHA;
  material.depthWrite = false;
  material.depthTest = true;
  material.cull = pc.CULLFACE_NONE;
  material.update();
  return material;
}

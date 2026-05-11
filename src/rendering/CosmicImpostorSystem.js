import * as pc from 'playcanvas/build/playcanvas.mjs';

const MAX_QUADS = 900;
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

export class CosmicImpostorSystem {
  constructor(app, params) {
    this.app = app;
    this.params = params;
    const format = new pc.VertexFormat(app.graphicsDevice, [
      { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR1, components: 4, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR2, components: 4, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR3, components: 2, type: pc.TYPE_FLOAT32 }
    ]);
    this.vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, format, MAX_QUADS * 4, pc.BUFFER_DYNAMIC);
    const indexBuffer = new pc.IndexBuffer(app.graphicsDevice, pc.INDEXFORMAT_UINT16, MAX_QUADS * 6, pc.BUFFER_STATIC);
    const indices = new Uint16Array(indexBuffer.lock());
    let dst = 0;
    for (let i = 0; i < MAX_QUADS; i++) {
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
    this.mesh.primitive[0].count = 0;
    this.mesh.primitive[0].indexed = true;
    this.atlas = createCosmicAtlasTexture(app.graphicsDevice);
    this.material = createCosmicImpostorMaterial();
    this.material.setParameter('uAtlas', this.atlas);
    this.meshInstance = new pc.MeshInstance(this.mesh, this.material);
    this.meshInstance.cull = false;
    this.entity = new pc.Entity('cosmic-impostors');
    app.root.addChild(this.entity);
    this.meshInstance.node = this.entity;
    app.scene.layers.getLayerById(pc.LAYERID_WORLD).addMeshInstances([this.meshInstance]);
  }

  update(camera, time) {
    const visible = this.params.appMode === 'sound-board' && this.params.pianoPhysicsMode && (this.params.primaryMode === 'demo' || (this.params.songObjects?.length ?? 0) > 0);
    this.meshInstance.visible = visible;
    if (!visible) return;

    const right = camera.entity.right;
    const up = camera.entity.up;
    const forward = camera.entity.forward;
    const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
    const objects = [...(this.params.songObjects ?? [])]
      .sort((a, b) => distanceAlongCamera(b.position, camera.position, forward) - distanceAlongCamera(a.position, camera.position, forward));
    const data = new Float32Array(this.vertexBuffer.lock());
    let dst = 0;
    let quads = 0;

    for (const object of objects) {
      if (quads >= MAX_QUADS - 18) break;
      if (this.params.primaryMode === 'demo' && (this.params.songObjectCount ?? 0) > 150) {
        const important = object.kind === 'origin-star' || object.kind === 'gravity-well' || object.kind === 'spiral-arm' || object.kind === 'supernova-bloom' || (object.liveDrive ?? 0) > 0.22 || (object.pulse ?? 0) > 0.28;
        if (!important && hash((object.id ?? 0) * 91.7) < 0.42) continue;
      }
      const color = object.color ?? NOTE_COLORS[object.family] ?? [1, 1, 1];
      const birth = smoothstep(0.08, 1.4, object.age ?? 0);
      const live = object.liveDrive ?? 0;
      const memory = object.memory ?? 0;
      const inside = this.params.insideBlend ?? 0;
      const diffuseKind = object.kind === 'spiral-arm' || object.kind === 'section-region' || object.kind === 'nebula-veil' || object.kind === 'filament-web' || object.kind === 'supernova-bloom';
      const closeDim = (this.params.primaryMode === 'demo' || this.params.primaryMode === 'piano')
        ? 1 - Math.min(diffuseKind ? 0.82 : 0.46, inside * (diffuseKind ? 0.92 : 0.48))
        : 1;
      const prebuiltLift = object.prebuilt ? 1.42 : 1;
      const alpha = closeDim * birth * prebuiltLift * Math.min(0.5, 0.045 + (object.strength ?? 0.35) * 0.08 + memory * 0.1 + (object.energy ?? 0) * 0.12 + (object.pulse ?? 0) * 0.16 + live * 0.16);
      const base = Math.max(0.55, Math.min(object.scale ?? 5, 16)) * (0.66 + hash((object.id ?? 0) * 5.71) * 0.28) * (this.params.primaryMode === 'piano' ? 0.72 : 1);
      const mature = smoothstep(2.5, 14, object.age ?? 0);
      const pulse = object.pulse ?? 0;

      if (object.kind === 'origin-star') {
        dst = quad(data, dst, object.position, right, up, base * 3.2, base * 3.2, color, Math.max(0.18, alpha * 0.9), 0, object.phase + time * 0.05, pulse, object.variant, corners); quads++;
        if (this.params.primaryMode !== 'piano' || (this.params.jamExcitationCount ?? 0) > 1) {
          const count = this.params.primaryMode === 'demo' ? 2 : 3;
          dst = satelliteQuads(data, dst, object, right, up, color, alpha, time, corners, count); quads += count;
        }
      } else if (object.kind === 'star-cluster') {
        const coreScale = base * (1.05 + mature * 0.34 + pulse * 0.34 + live * 0.28);
        dst = quad(data, dst, object.position, right, up, coreScale, coreScale, mixColor(color, [1.65, 1.48, 1.12]), alpha * 0.95, 0, object.phase + time * 0.035, pulse, object.variant, corners); quads++;
        const satelliteCount = mature > 0.22 ? (this.params.primaryMode === 'demo' ? 2 : 4) : 1;
        dst = satelliteQuads(data, dst, object, right, up, color, alpha * 0.68, time, corners, satelliteCount); quads += satelliteCount;
        const dustCount = this.params.primaryMode === 'demo' ? 3 : 5;
        dst = starDustQuads(data, dst, object, right, up, color, alpha * 0.72, time, corners, dustCount); quads += dustCount;
      } else if (object.kind === 'solar-system' || object.kind === 'planetary-system') {
        const coreScale = base * (object.kind === 'solar-system' ? 0.72 : 0.42) * (1 + pulse * 0.3 + live * 0.25);
        dst = quad(data, dst, object.position, right, up, coreScale, coreScale, mixColor(color, [1.72, 1.52, 1.12]), alpha * 0.9, 0, object.phase + time * 0.06, pulse, object.variant, corners); quads++;
        const planetCount = object.kind === 'solar-system' ? (this.params.primaryMode === 'demo' ? 3 : 5) : 2;
        dst = planetSystemQuads(data, dst, object, right, up, color, alpha, time, corners, planetCount); quads += planetCount;
        if (mature > 0.25) {
          dst = starDustQuads(data, dst, object, right, up, color, alpha * 0.28, time, corners, 2); quads += 2;
        }
      } else if (object.kind === 'rocky-planet' || object.kind === 'moon-system' || object.kind === 'asteroid-field') {
        const bodyCount = object.kind === 'moon-system' ? 3 : object.kind === 'asteroid-field' ? 4 : 2;
        dst = rockyBodyQuads(data, dst, object, right, up, color, alpha, time, corners, bodyCount);
        quads += bodyCount;
      } else if (object.kind === 'gravity-well') {
        dst = quad(data, dst, object.position, right, up, base * (2.15 + pulse * 0.55 + live * 0.4), base * (0.95 + pulse * 0.22), color, alpha * 0.78, 2, object.phase, pulse, object.variant, corners); quads++;
        const holeColor = live > 0.72 ? [1.6, 1.7, 1.85] : [0.015, 0.018, 0.03];
        dst = quad(data, dst, object.position, right, up, base * 0.85, base * 0.85, holeColor, alpha * (live > 0.72 ? 0.38 : 0.24), 7, object.phase, pulse, object.variant, corners); quads++;
      } else if (object.kind === 'spiral-arm' || object.kind === 'section-region') {
        dst = quad(data, dst, object.position, right, up, base * (2.05 + mature * 0.55), base * (1.22 + mature * 0.36), color, alpha * (0.48 + mature * 0.24), 1, object.phase + time * 0.025, pulse, object.variant, corners); quads++;
        dst = starDustQuads(data, dst, object, right, up, color, alpha * 0.52, time, corners, 2); quads += 2;
      } else if (object.kind === 'nebula-veil' || object.kind === 'filament-web') {
        dst = quad(data, dst, object.position, right, up, base * 1.65, base * 2.25, color, alpha * 0.32, 3, object.phase + time * 0.015, pulse, object.variant, corners); quads++;
        dst = starDustQuads(data, dst, object, right, up, color, alpha * 0.36, time, corners, 2); quads += 2;
      } else if (object.kind === 'crystal-shards') {
        const shardColor = mixColor(color, [1.35, 1.44, 1.7]);
        dst = quad(data, dst, object.position, right, up, base * (0.62 + pulse * 0.12), base * (0.62 + pulse * 0.12), shardColor, alpha * 0.45, 0, object.phase + time * 0.04, pulse, object.variant, corners); quads++;
        dst = starDustQuads(data, dst, object, right, up, shardColor, alpha * 0.56, time, corners, 3); quads += 3;
      } else if (object.kind === 'supernova-bloom') {
        dst = quad(data, dst, object.position, right, up, base * (3.2 + pulse * 1.4), base * (3.2 + pulse * 1.4), color, alpha * 1.2, 5, object.phase + time * 0.08, pulse, object.variant, corners); quads++;
      } else if (object.kind === 'comet-river' || object.kind === 'spark-stream') {
        dst = cometQuads(data, dst, object, right, up, color, alpha, time, corners); quads += 3;
      } else {
        dst = quad(data, dst, object.position, right, up, base * 2.6, base * 2.0, color, alpha * 0.75, 6, object.phase, pulse, object.variant, corners); quads++;
      }
    }

    this.vertexBuffer.unlock();
    this.mesh.primitive[0].count = quads * 6;
    this.material.setParameter('uTime', time);
    this.material.setParameter('uAtlas', this.atlas);
    const closeGlowDim = this.params.primaryMode === 'demo' ? (1 - Math.min(0.36, this.params.insideBlend ?? 0)) : 1;
    this.material.setParameter('uGlow', closeGlowDim * (0.74 + (this.params.cosmicGlow ?? 1) * 0.42 + (this.params.audioOnset ?? 0) * 0.42));
  }
}

function satelliteQuads(data, dst, object, right, up, color, alpha, time, corners, count = 3) {
  for (let i = 0; i < count; i++) {
    const h = hash((object.id ?? 0) * 17.1 + i);
    const a = object.phase + i * 2.399963 + time * (0.03 + h * 0.04);
    const r = object.scale * (1.7 + i * 0.42);
    const p = [object.position[0] + Math.cos(a) * r, object.position[1] + Math.sin(i * 1.3) * object.scale * 0.25, object.position[2] + Math.sin(a) * r * 0.62];
    const planetColor = bodyColor(color, object.family ?? 0, i, h);
    const type = h > 0.84 ? 8 : h > 0.42 ? 9 : 10;
    const size = object.scale * (0.13 + h * 0.16);
    dst = quad(data, dst, p, right, up, size, size, planetColor, alpha * (0.42 + h * 0.36), type, a, object.pulse ?? 0, h, corners);
  }
  return dst;
}

function planetSystemQuads(data, dst, object, right, up, color, alpha, time, corners, count = 5) {
  const pulse = object.pulse ?? 0;
  const live = object.liveDrive ?? 0;
  for (let i = 0; i < count; i++) {
    const h = hash((object.id ?? 0) * 23.7 + i * 3.9);
    const a = object.phase + i * 2.399963 + time * (0.035 + h * 0.055 + live * 0.08);
    const r = object.scale * (0.95 + i * 0.36 + h * 0.2) * (1 + pulse * 0.08);
    const p = [
      object.position[0] + Math.cos(a) * r,
      object.position[1] + Math.sin(a * 1.7 + i) * object.scale * 0.12,
      object.position[2] + Math.sin(a) * r * (0.48 + h * 0.22)
    ];
    const planetColor = bodyColor(color, object.family ?? 0, i + 2, h);
    const size = object.scale * (0.12 + h * 0.11) * (1 + live * 0.28 + pulse * 0.12);
    const type = h > 0.86 ? 8 : h > 0.28 ? 9 : 10;
    dst = quad(data, dst, p, right, up, size, size, planetColor, alpha * (0.48 + h * 0.34 + live * 0.22), type, a, pulse, h, corners);
  }
  return dst;
}

function rockyBodyQuads(data, dst, object, right, up, color, alpha, time, corners, count = 4) {
  const pulse = object.pulse ?? 0;
  const live = object.liveDrive ?? 0;
  const centerType = object.kind === 'asteroid-field' ? 10 : 9;
  for (let i = 0; i < count; i++) {
    const h = hash((object.id ?? 0) * 41.7 + i * 9.1);
    const a = object.phase + i * 2.399963 + time * (object.kind === 'asteroid-field' ? 0.075 + h * 0.09 : 0.025 + h * 0.035 + live * 0.06);
    const spread = object.kind === 'rocky-planet' ? 0.28 : object.kind === 'moon-system' ? 0.64 : 1.18;
    const r = object.scale * (i === 0 ? 0 : 0.28 + h * spread + i * 0.11);
    const p = [
      object.position[0] + Math.cos(a) * r,
      object.position[1] + Math.sin(a * 1.3 + i) * object.scale * (0.05 + spread * 0.08),
      object.position[2] + Math.sin(a) * r * (0.48 + h * 0.28)
    ];
    const planetColor = bodyColor(color, object.family ?? 0, i + 5, h);
    const sizeBase = object.kind === 'asteroid-field' ? 0.075 : object.kind === 'moon-system' ? 0.095 : 0.18;
    const size = object.scale * (i === 0 && object.kind !== 'asteroid-field' ? sizeBase * 1.6 : sizeBase + h * sizeBase * 0.9) * (1 + pulse * 0.1);
    const type = object.kind === 'asteroid-field' || h > 0.72 ? 10 : centerType;
    dst = quad(data, dst, p, right, up, size, size * (type === 10 ? 0.72 + h * 0.42 : 1), planetColor, alpha * (0.5 + live * 0.25 + h * 0.24), type, a, pulse, h, corners);
  }
  return dst;
}

function starDustQuads(data, dst, object, right, up, color, alpha, time, corners, count) {
  for (let i = 0; i < count; i++) {
    const h = hash((object.id ?? 0) * 31.3 + i * 4.7);
    const a = object.phase + i * 2.399963 + time * 0.02;
    const r = object.scale * (0.65 + h * 1.25);
    const p = [object.position[0] + Math.cos(a) * r, object.position[1] + (hash(i * 11.9) - 0.5) * object.scale * 0.9, object.position[2] + Math.sin(a) * r * (0.45 + h * 0.36)];
    const starSize = object.scale * (0.032 + h * 0.052);
    dst = quad(data, dst, p, right, up, starSize, starSize, mixColor(color, [1.4, 1.34, 1.12]), alpha * (0.22 + h * 0.22), 0, a, object.pulse ?? 0, h, corners);
  }
  return dst;
}

function cometQuads(data, dst, object, right, up, color, alpha, time, corners) {
  for (let i = 0; i < 3; i++) {
    const h = hash((object.id ?? 0) * 19.1 + i);
    const t = i / 2;
    const a = object.phase + t * Math.PI * 3.6 + time * (0.08 + h * 0.1);
    const r = object.scale * (0.75 + t * 1.2);
    const p = [object.position[0] + Math.cos(a) * r, object.position[1] + (t - 0.5) * object.scale * 1.05, object.position[2] + Math.sin(a) * r * 0.58];
    dst = quad(data, dst, p, right, up, object.scale * (1.3 + h * 0.7), object.scale * (0.38 + h * 0.22), mixColor(color, [1.5, 1.42, 1.1]), alpha * (0.32 + h * 0.25), 6, a, object.pulse ?? 0, h, corners);
  }
  return dst;
}

function quad(data, dst, center, right, up, sx, sy, color, alpha, type, phase, pulse, variant, corners) {
  for (let c = 0; c < 4; c++) {
    const ux = corners[c * 2];
    const uy = corners[c * 2 + 1];
    data[dst++] = center[0] + right.x * ux * sx + up.x * uy * sy;
    data[dst++] = center[1] + right.y * ux * sx + up.y * uy * sy;
    data[dst++] = center[2] + right.z * ux * sx + up.z * uy * sy;
    data[dst++] = color[0];
    data[dst++] = color[1];
    data[dst++] = color[2];
    data[dst++] = alpha;
    data[dst++] = type;
    data[dst++] = phase;
    data[dst++] = pulse;
    data[dst++] = variant ?? 0;
    data[dst++] = ux;
    data[dst++] = uy;
  }
  return dst;
}

function distanceAlongCamera(position, cameraPosition, forward) {
  return (position[0] - cameraPosition.x) * forward.x + (position[1] - cameraPosition.y) * forward.y + (position[2] - cameraPosition.z) * forward.z;
}

function createCosmicImpostorMaterial() {
  const material = new pc.ShaderMaterial({
    uniqueName: 'CosmicImpostorSprites',
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aColorAlpha: pc.SEMANTIC_ATTR1,
      aInfo: pc.SEMANTIC_ATTR2,
      aUv: pc.SEMANTIC_ATTR3
    },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec4 aColorAlpha;
      attribute vec4 aInfo;
      attribute vec2 aUv;
      uniform mat4 matrix_viewProjection;
      varying vec4 vColorAlpha;
      varying vec4 vInfo;
      varying vec2 vUv;
      void main(void) {
        gl_Position = matrix_viewProjection * vec4(aPosition, 1.0);
        vColorAlpha = aColorAlpha;
        vInfo = aInfo;
        vUv = aUv;
      }
    `,
    fragmentGLSL: `
      precision highp float;
      uniform float uTime;
      uniform float uGlow;
      uniform sampler2D uAtlas;
      varying vec4 vColorAlpha;
      varying vec4 vInfo;
      varying vec2 vUv;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x), mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }
      mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }
      vec4 atlasSample(float tile, vec2 uv) {
        float col = mod(tile, 4.0);
        float row = floor(tile / 4.0);
        vec2 localUv = clamp(uv * 0.5 + 0.5, vec2(0.002), vec2(0.998));
        return texture2D(uAtlas, (vec2(col, row) + localUv) / vec2(4.0, 3.0));
      }

      void main(void) {
        vec2 uv = vUv;
        float type = vInfo.x;
        float phase = vInfo.y;
        float pulse = vInfo.z;
        float variant = vInfo.w;
        vec3 color = vColorAlpha.rgb;
        float r = length(uv);
        float a = atan(uv.y, uv.x);
        float alpha = 0.0;
        vec3 outColor = color;
        vec4 tex = vec4(1.0);

        if (type < 0.5) {
          tex = atlasSample(0.0, uv);
          float core = smoothstep(0.16, 0.0, r);
          float glintX = exp(-abs(uv.y) * 72.0) * smoothstep(0.52, 0.04, abs(uv.x));
          float glintY = exp(-abs(uv.x) * 72.0) * smoothstep(0.52, 0.04, abs(uv.y));
          float halo = exp(-r * 8.5) * 0.16;
          float granules = noise(uv * (16.0 + variant * 9.0) + vec2(phase, uTime * 0.02)) * smoothstep(0.42, 0.04, r) * 0.1;
          alpha = max(tex.a, core * 0.62 + (glintX + glintY) * 0.028 + halo + granules);
          outColor *= tex.rgb * (0.82 + core * 2.15 + (glintX + glintY) * 0.16 + granules * 0.2);
        } else if (type < 1.5) {
          tex = atlasSample(6.0, uv);
          vec2 p = rot(phase * 0.2) * uv;
          float rr = length(p);
          float theta = atan(p.y, p.x);
          float arms = 2.0 + floor(variant * 4.0);
          float spiral = pow(max(0.0, cos(theta * arms - rr * (8.0 + variant * 7.0) + phase)), 6.0);
          float disk = smoothstep(1.05, 0.08, rr) * (0.18 + 0.82 * spiral);
          float core = smoothstep(0.18, 0.0, rr);
          alpha = max(tex.a * 0.78, disk * (0.18 + pulse * 0.08) + core * 0.5);
          outColor *= tex.rgb * (0.62 + spiral * 1.2 + core * 1.5);
        } else if (type < 2.5) {
          tex = atlasSample(5.0, uv);
          vec2 p = rot(phase * 0.15) * uv;
          float disk = exp(-abs(p.y) * 7.0) * smoothstep(1.0, 0.12, abs(p.x));
          float ring = exp(-abs(length(p * vec2(1.0, 2.4)) - 0.56) * 9.0);
          alpha = max(tex.a * 0.85, max(disk * (0.32 + pulse * 0.18), ring * 0.32));
          outColor *= tex.rgb * (0.42 + ring * 1.1 + disk * 0.7);
        } else if (type < 3.5) {
          tex = atlasSample(7.0, uv);
          float n = noise(uv * (2.5 + variant * 3.0) + vec2(uTime * 0.025, phase));
          float veil = smoothstep(1.0, 0.05, r) * smoothstep(0.18, 0.9, n + sin(uv.y * 5.0 + phase) * 0.18);
          alpha = max(tex.a * 0.36, veil * 0.12);
          outColor *= tex.rgb * (0.52 + n * 0.8 + pulse * 0.32);
        } else if (type < 4.5) {
          tex = atlasSample(9.0, uv);
          vec2 p = rot(phase * 0.4) * uv;
          float shardA = exp(-abs(p.y + sin(p.x * 4.0 + phase) * 0.045) * 13.0) * smoothstep(0.72, 0.04, abs(p.x));
          float shardB = exp(-abs(p.x - p.y * 0.42) * 10.0) * smoothstep(0.52, 0.03, r) * 0.28;
          float grain = noise(p * 7.0 + vec2(phase, uTime * 0.035)) * smoothstep(0.78, 0.04, r);
          float core = smoothstep(0.24, 0.0, r);
          alpha = max(tex.a * 0.74, shardA * 0.03 + shardB * 0.03 + grain * 0.06 + core * 0.28);
          outColor *= tex.rgb * (0.68 + shardA * 0.5 + shardB * 0.45 + core * 0.9);
        } else if (type < 5.5) {
          tex = atlasSample(10.0, uv);
          float petalWave = 0.5 + 0.5 * cos(a * (6.0 + floor(variant * 4.0)) + phase);
          float petals = smoothstep(0.34, 0.98, petalWave) * smoothstep(1.0, 0.05, r) * smoothstep(0.04, 0.32, r);
          float wave = exp(-abs(r - (0.38 + pulse * 0.1)) * 5.0);
          float core = smoothstep(0.24, 0.0, r);
          alpha = max(tex.a * 0.58, petals * 0.08 + wave * 0.08 + core * 0.28);
          outColor *= tex.rgb * (0.72 + petals * 0.55 + wave * 0.5 + core * 0.9);
        } else if (type < 6.5) {
          tex = atlasSample(4.0, uv);
          vec2 p = rot(phase) * uv;
          float head = smoothstep(0.22, 0.0, length(p - vec2(0.42, 0.0)));
          float tail = exp(-abs(p.y) * 8.0) * smoothstep(-0.9, 0.25, -p.x) * smoothstep(1.0, -0.1, p.x);
          alpha = max(tex.a * 0.9, head * 0.8 + tail * 0.42);
          outColor *= tex.rgb * (0.72 + head * 1.6 + tail * 0.5);
        } else if (type < 7.5) {
          tex = atlasSample(5.0, uv);
          alpha = smoothstep(0.78, 0.48, r) * smoothstep(0.12, 0.22, r);
          alpha = max(alpha * 0.75, tex.a * 0.54);
          outColor *= tex.rgb * 0.9;
        } else if (type < 8.5) {
          tex = atlasSample(variant < 0.38 ? 8.0 : 3.0, uv);
          float planet = smoothstep(0.48, 0.45, r);
          float ringMask = step(0.38, variant);
          float ring = ringMask * exp(-abs((rot(phase * 0.2) * uv).y) * 14.0) * smoothstep(0.9, 0.25, abs(uv.x)) * smoothstep(0.16, 0.28, r);
          vec2 p = rot(phase * 0.1) * uv;
          float z = sqrt(max(0.0, 1.0 - r * r * 2.25));
          float lit = clamp(dot(normalize(vec3(p.x, p.y, z)), normalize(vec3(-0.45, 0.32, 0.84))) * 0.5 + 0.5, 0.0, 1.0);
          alpha = max(tex.a, max(planet, ring * 0.24));
          outColor = mix(outColor * (0.32 + lit * 0.88), outColor * tex.rgb * 1.2, tex.a);
          outColor *= 1.0 + ring * 0.35;
        } else if (type < 9.5) {
          tex = atlasSample(1.0, uv);
          vec2 p = rot(phase * 0.11) * uv;
          float rr = length(p);
          if (rr > 0.72) discard;
          float z = sqrt(max(0.0, 1.0 - rr * rr * 1.45));
          vec3 nrm = normalize(vec3(p.x * 1.2, p.y * 1.2, z));
          float lit = clamp(dot(nrm, normalize(vec3(-0.55, 0.42, 0.72))) * 0.5 + 0.5, 0.0, 1.0);
          float crater = noise(p * (9.0 + variant * 8.0) + vec2(variant * 12.0, phase * 0.03));
          float continent = noise(p * (3.2 + variant * 2.0) + vec2(phase * 0.02, variant * 7.0));
          float rim = smoothstep(0.72, 0.5, rr) * smoothstep(0.36, 0.72, rr);
          alpha = max(tex.a, smoothstep(0.74, 0.68, rr));
          outColor = mix(outColor * (0.34 + lit * 0.95), outColor * tex.rgb * 1.15, tex.a);
          outColor *= 0.72 + continent * 0.22 + rim * 0.22 + pulse * 0.12;
        } else {
          tex = atlasSample(2.0, uv);
          vec2 p = rot(phase * 0.21) * uv;
          float jag = 0.62 + noise(vec2(atan(p.y, p.x) * 3.0 + variant * 5.0, variant * 11.0)) * 0.22;
          float rr = length(p * vec2(1.0 + variant * 0.28, 0.74 + variant * 0.24));
          if (rr > jag) discard;
          float edge = smoothstep(jag, jag - 0.08, rr);
          float chip = noise(p * (12.0 + variant * 12.0) + vec2(phase * 0.04, variant * 9.0));
          alpha = max(tex.a, edge * (0.52 + chip * 0.18));
          outColor = mix(outColor * tex.rgb, vec3(0.72, 0.67, 0.58), 0.22) * (0.34 + chip * 0.42 + pulse * 0.08);
        }

        float luminousType = 1.0 - smoothstep(7.4, 8.0, type);
        float bodyLight = mix(0.62 + uGlow * 0.28, uGlow, luminousType);
        alpha *= vColorAlpha.a;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(outColor * bodyLight, alpha);
      }
    `
  });
  material.blendType = pc.BLEND_NORMAL;
  material.depthWrite = false;
  material.depthTest = true;
  material.cull = pc.CULLFACE_NONE;
  material.update();
  return material;
}

function createCosmicAtlasTexture(device) {
  const tile = 128;
  const cols = 4;
  const rows = 3;
  const canvas = document.createElement('canvas');
  canvas.width = tile * cols;
  canvas.height = tile * rows;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawAtlasTile(ctx, tile, 0, drawStarSprite);
  drawAtlasTile(ctx, tile, 1, drawRockyPlanetSprite);
  drawAtlasTile(ctx, tile, 2, drawAsteroidSprite);
  drawAtlasTile(ctx, tile, 3, drawRingedPlanetSprite);
  drawAtlasTile(ctx, tile, 4, drawCometSprite);
  drawAtlasTile(ctx, tile, 5, drawAccretionSprite);
  drawAtlasTile(ctx, tile, 6, drawGalaxySprite);
  drawAtlasTile(ctx, tile, 7, drawNebulaSprite);
  drawAtlasTile(ctx, tile, 8, drawMoonSprite);
  drawAtlasTile(ctx, tile, 9, drawShardSprite);
  drawAtlasTile(ctx, tile, 10, drawBloomSprite);
  drawAtlasTile(ctx, tile, 11, drawStarSprite);
  const texture = new pc.Texture(device, {
    width: canvas.width,
    height: canvas.height,
    format: pc.PIXELFORMAT_R8_G8_B8_A8,
    mipmaps: true
  });
  texture.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
  texture.magFilter = pc.FILTER_LINEAR;
  texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
  texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
  texture.setSource(canvas);
  return texture;
}

function drawAtlasTile(ctx, tile, index, draw) {
  const x = index % 4 * tile;
  const y = Math.floor(index / 4) * tile;
  ctx.save();
  ctx.translate(x, y);
  draw(ctx, tile);
  ctx.restore();
}

function radial(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const stop of stops) g.addColorStop(stop[0], stop[1]);
  return g;
}

function drawStarSprite(ctx, s) {
  const c = s / 2;
  ctx.fillStyle = radial(ctx, c, c, 0, c, [[0, 'rgba(255,255,245,1)'], [0.035, 'rgba(255,255,245,0.98)'], [0.12, 'rgba(180,215,255,0.28)'], [0.52, 'rgba(80,120,190,0.045)'], [1, 'rgba(0,0,0,0)']]);
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(c - s * 0.22, c); ctx.lineTo(c + s * 0.22, c);
  ctx.moveTo(c, c - s * 0.22); ctx.lineTo(c, c + s * 0.22);
  ctx.stroke();
}

function drawRockyPlanetSprite(ctx, s) {
  const c = s / 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, s * 0.36, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createRadialGradient(c - s * 0.18, c - s * 0.2, 0, c, c, s * 0.43);
  g.addColorStop(0, 'rgba(245,238,218,1)');
  g.addColorStop(0.32, 'rgba(132,126,116,1)');
  g.addColorStop(0.72, 'rgba(45,45,50,1)');
  g.addColorStop(1, 'rgba(8,9,13,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 64; i++) {
    const h = hash(i * 4.71);
    const a = h * Math.PI * 2;
    const r = Math.sqrt(hash(i * 9.13)) * s * 0.32;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    const cr = s * (0.006 + hash(i * 13.9) * 0.018);
    ctx.fillStyle = `rgba(${48 + h * 90},${44 + h * 78},${40 + h * 70},0.42)`;
    ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(230,240,255,0.22)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(c, c, s * 0.36, 0, Math.PI * 2); ctx.stroke();
}

function drawMoonSprite(ctx, s) {
  drawRockyPlanetSprite(ctx, s);
}

function drawAsteroidSprite(ctx, s) {
  const c = s / 2;
  const g = ctx.createLinearGradient(c - s * 0.25, c - s * 0.22, c + s * 0.26, c + s * 0.24);
  g.addColorStop(0, 'rgba(218,205,180,0.96)');
  g.addColorStop(0.5, 'rgba(108,100,88,0.94)');
  g.addColorStop(1, 'rgba(35,33,32,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    const r = s * (0.22 + hash(i * 2.91) * 0.15);
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r * 0.82;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(44,42,40,0.38)';
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(c + (hash(i * 7.3) - 0.5) * s * 0.42, c + (hash(i * 9.8) - 0.5) * s * 0.36, s * (0.01 + hash(i * 5.1) * 0.025), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRingedPlanetSprite(ctx, s) {
  const c = s / 2;
  ctx.strokeStyle = 'rgba(232,220,182,0.72)';
  ctx.lineWidth = s * 0.032;
  ctx.beginPath(); ctx.ellipse(c, c + s * 0.015, s * 0.46, s * 0.13, -0.08, 0, Math.PI * 2); ctx.stroke();
  drawRockyPlanetSprite(ctx, s);
  ctx.strokeStyle = 'rgba(255,245,205,0.36)';
  ctx.lineWidth = s * 0.014;
  ctx.beginPath(); ctx.ellipse(c, c + s * 0.015, s * 0.58, s * 0.16, -0.08, 0, Math.PI * 2); ctx.stroke();
}

function drawCometSprite(ctx, s) {
  const c = s / 2;
  const g = ctx.createLinearGradient(s * 0.02, c, s * 0.84, c);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, 'rgba(120,190,255,0.12)');
  g.addColorStop(0.85, 'rgba(235,245,255,0.58)');
  g.addColorStop(1, 'rgba(255,244,198,0.98)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(c, c, s * 0.48, s * 0.075, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,250,225,0.95)';
  ctx.beginPath(); ctx.arc(s * 0.82, c, s * 0.055, 0, Math.PI * 2); ctx.fill();
}

function drawAccretionSprite(ctx, s) {
  const c = s / 2;
  ctx.strokeStyle = 'rgba(255,220,150,0.72)';
  ctx.lineWidth = s * 0.04;
  ctx.beginPath(); ctx.ellipse(c, c, s * 0.38, s * 0.12, -0.22, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.beginPath(); ctx.arc(c, c, s * 0.16, 0, Math.PI * 2); ctx.fill();
}

function drawGalaxySprite(ctx, s) {
  const c = s / 2;
  ctx.fillStyle = radial(ctx, c, c, 0, c * 0.82, [[0, 'rgba(255,240,205,0.9)'], [0.08, 'rgba(220,225,255,0.38)'], [0.34, 'rgba(90,130,220,0.075)'], [1, 'rgba(0,0,0,0)']]);
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(218,232,255,0.42)';
  ctx.lineWidth = 1.25;
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const t = i / 69;
      const a = arm / 3 * Math.PI * 2 + t * Math.PI * 2.5;
      const r = s * (0.08 + t * 0.38);
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r * 0.58;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,245,220,0.54)';
  for (let i = 0; i < 90; i++) {
    const h = hash(i * 5.37);
    const a = h * Math.PI * 2;
    const r = Math.pow(hash(i * 11.9), 0.55) * s * 0.39;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r * 0.58, s * (0.003 + hash(i * 3.1) * 0.006), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNebulaSprite(ctx, s) {
  const c = s / 2;
  ctx.fillStyle = radial(ctx, c, c, 0, c, [[0, 'rgba(150,220,255,0.18)'], [0.35, 'rgba(100,70,190,0.09)'], [0.7, 'rgba(30,80,140,0.035)'], [1, 'rgba(0,0,0,0)']]);
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(180,230,255,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = i * 0.78 + hash(i * 8.3);
    ctx.beginPath();
    ctx.ellipse(c + Math.cos(a) * s * 0.08, c + Math.sin(a) * s * 0.08, s * (0.16 + hash(i) * 0.2), s * (0.04 + hash(i * 2.1) * 0.05), a, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawShardSprite(ctx, s) {
  const c = s / 2;
  ctx.fillStyle = 'rgba(220,240,255,0.72)';
  ctx.beginPath();
  ctx.moveTo(c, s * 0.08);
  ctx.lineTo(s * 0.62, c);
  ctx.lineTo(c, s * 0.92);
  ctx.lineTo(s * 0.38, c);
  ctx.closePath();
  ctx.fill();
}

function drawBloomSprite(ctx, s) {
  const c = s / 2;
  ctx.fillStyle = radial(ctx, c, c, 0, c, [[0, 'rgba(255,255,255,0.72)'], [0.1, 'rgba(255,210,235,0.28)'], [0.42, 'rgba(180,120,255,0.09)'], [1, 'rgba(0,0,0,0)']]);
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
}

function mixColor(a, b) {
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
}

function bodyColor(noteColor, family, index, h) {
  const palettes = [
    [0.42, 0.5, 0.78],
    [0.28, 0.72, 0.82],
    [0.38, 0.66, 0.45],
    [0.52, 0.72, 0.32],
    [0.86, 0.66, 0.34],
    [0.76, 0.42, 0.28],
    [0.64, 0.28, 0.24],
    [0.72, 0.34, 0.78],
    [0.48, 0.36, 0.8],
    [0.86, 0.88, 0.82],
    [0.34, 0.7, 0.62],
    [0.86, 0.66, 0.28]
  ];
  const base = palettes[((family + index) % 12 + 12) % 12] ?? [0.65, 0.62, 0.55];
  const mineral = [0.44 + h * 0.28, 0.4 + hash(h * 19.7) * 0.24, 0.36 + hash(h * 31.1) * 0.24];
  return mixColor(mixColor(noteColor, base), mineral);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

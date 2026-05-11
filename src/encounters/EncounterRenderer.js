import * as pc from 'playcanvas/build/playcanvas.mjs';

const MAX_VERTICES = 18000;

export class EncounterRenderer {
  constructor(app, params, universe) {
    this.app = app;
    this.params = params;
    this.universe = universe;
    this.label = document.getElementById('encounter-label');
    const format = new pc.VertexFormat(app.graphicsDevice, [
      { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_ATTR1, components: 4, type: pc.TYPE_FLOAT32 }
    ]);
    this.vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, format, MAX_VERTICES, pc.BUFFER_DYNAMIC);
    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.mesh.vertexBuffer = this.vertexBuffer;
    this.mesh.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(600, 600, 600));
    this.mesh.primitive[0].type = pc.PRIMITIVE_LINES;
    this.mesh.primitive[0].base = 0;
    this.mesh.primitive[0].count = 0;
    this.mesh.primitive[0].indexed = false;
    this.material = createEncounterMaterial();
    this.meshInstance = new pc.MeshInstance(this.mesh, this.material);
    this.meshInstance.cull = false;
    this.entity = new pc.Entity('cosmic-encounters');
    app.root.addChild(this.entity);
    this.meshInstance.node = this.entity;
    app.scene.layers.getLayerById(pc.LAYERID_WORLD).addMeshInstances([this.meshInstance]);
  }

  update(camera, time) {
    const data = new Float32Array(this.vertexBuffer.lock());
    let dst = 0;
    const cameraZ = camera.position.z;
    for (const encounter of this.universe.encounters.visible(cameraZ)) {
      const dz = cameraZ - encounter.center[2];
      const visibility = smoothstep(190, 70, dz) * (1 - smoothstep(-30, 80, -dz));
      if (visibility <= 0.001) continue;
      dst = writeEncounter(data, dst, encounter, time, visibility, this.params);
      if (dst >= MAX_VERTICES * 7 - 256) break;
    }
    this.vertexBuffer.unlock();
    this.mesh.primitive[0].count = Math.floor(dst / 7);
    this.material.setParameter('uTime', time);
    this.material.setParameter('uEncounterGlow', 2.6 + (this.params.encounterInfluence ?? 0) * 3.2);
    this.updateLabel(camera);
  }

  updateLabel(camera) {
    if (!this.label) return;
    const encounter = this.universe.encounters.active;
    const visible = !!this.params.encounterLabelsVisible && encounter;
    this.label.classList.toggle('visible', visible);
    if (!visible) return;
    this.label.textContent = `${encounter.type.toUpperCase()}  ${Math.max(0, Math.round(camera.position.z - encounter.center[2]))}m`;
  }
}

function writeEncounter(data, dst, encounter, time, visibility, params) {
  switch (encounter.type) {
    case 'spiral galaxy vortex':
      return writeGalaxy(data, dst, encounter, time, visibility);
    case 'plasma jellyfish':
      return writeJellyfish(data, dst, encounter, time, visibility);
    case 'crystal cathedral':
      return writeCathedral(data, dst, encounter, time, visibility);
    case 'event horizon lens':
      return writeEventHorizon(data, dst, encounter, time, visibility);
    case 'filament web forest':
      return writeForest(data, dst, encounter, time, visibility);
    case 'bioluminescent reef':
      return writeReef(data, dst, encounter, time, visibility);
    case 'broken spacetime mirror':
      return writeMirror(data, dst, encounter, time, visibility);
    case 'golden resonance shell':
      return writeShell(data, dst, encounter, time, visibility);
    case 'dark void rim':
      return writeVoid(data, dst, encounter, time, visibility);
    default:
      return writeMandala(data, dst, encounter, time, visibility, params);
  }
}

function writeMandala(data, dst, e, time, visibility) {
  for (let ring = 0; ring < 6; ring++) {
    const radius = e.radius * (0.22 + ring * 0.115);
    const sides = 5 + ring;
    const phase = e.phase + time * (0.08 + ring * 0.015);
    dst = polygon(data, dst, e.center, radius, sides, phase, e.palette, 0.18 * visibility);
    dst = circle(data, dst, e.center, radius * 0.82, 96, -phase * 0.6, e.palette, 0.08 * visibility);
  }
  return dst;
}

function writeGalaxy(data, dst, e, time, visibility) {
  for (let arm = 0; arm < 4; arm++) {
    const phase = e.phase + arm * Math.PI * 0.5 + time * 0.12;
    let last = null;
    for (let i = 0; i < 150; i++) {
      const t = i / 149;
      const r = e.radius * (0.08 + t * 0.88);
      const a = phase + t * 6.2;
      const p = [e.center[0] + Math.cos(a) * r, e.center[1] + Math.sin(a) * r * 0.56, e.center[2] + (t - 0.5) * e.radius * 0.45];
      if (last) dst = line(data, dst, last, p, e.palette, visibility * (0.05 + 0.16 * (1 - t)));
      last = p;
    }
  }
  return circle(data, dst, e.center, e.radius * 0.14, 80, time * 0.2, [1.2, 1.1, 1.6], 0.22 * visibility);
}

function writeJellyfish(data, dst, e, time, visibility) {
  for (let r = 0; r < 5; r++) dst = ellipse(data, dst, [e.center[0], e.center[1] + r * 0.8, e.center[2]], e.radius * (0.28 + r * 0.045), e.radius * (0.12 + r * 0.02), 80, e.phase + r * 0.2, e.palette, 0.12 * visibility);
  for (let t = 0; t < 28; t++) {
    const a = e.phase + t / 28 * Math.PI * 2;
    let last = [e.center[0] + Math.cos(a) * e.radius * 0.34, e.center[1] + Math.sin(a) * e.radius * 0.14, e.center[2]];
    for (let i = 1; i < 36; i++) {
      const k = i / 35;
      const p = [last[0] + Math.sin(time + k * 6 + t) * 0.18, e.center[1] - k * e.radius * 1.1, e.center[2] + k * e.radius * 0.55 + Math.cos(a) * k * 5];
      dst = line(data, dst, last, p, e.palette, visibility * 0.08 * (1 - k * 0.45));
      last = p;
    }
  }
  return dst;
}

function writeCathedral(data, dst, e, time, visibility) {
  const columns = 9;
  for (let i = 0; i < columns; i++) {
    const x = (i / (columns - 1) - 0.5) * e.radius * 1.25;
    const height = e.radius * (0.7 + Math.sin(i * 1.7) * 0.18);
    const base = [e.center[0] + x, e.center[1] - e.radius * 0.45, e.center[2] + Math.sin(i) * 5];
    const top = [base[0] * 0.96 + e.center[0] * 0.04, e.center[1] + height, base[2] - e.radius * 0.25];
    dst = line(data, dst, base, top, e.palette, 0.16 * visibility);
    dst = line(data, dst, top, [e.center[0], e.center[1] + e.radius * 0.36, e.center[2] - e.radius * 0.35], e.palette, 0.12 * visibility);
  }
  for (let arch = 0; arch < 4; arch++) dst = ellipse(data, dst, [e.center[0], e.center[1] - e.radius * 0.1 + arch * 2, e.center[2] - arch * 2], e.radius * (0.22 + arch * 0.12), e.radius * (0.45 + arch * 0.04), 56, 0, e.palette, 0.09 * visibility);
  return dst;
}

function writeEventHorizon(data, dst, e, time, visibility) {
  dst = circle(data, dst, e.center, e.radius * 0.36, 128, time * 0.2, [0.02, 0.015, 0.01], 0.4 * visibility);
  for (let i = 0; i < 6; i++) dst = ellipse(data, dst, e.center, e.radius * (0.42 + i * 0.035), e.radius * (0.13 + i * 0.018), 128, e.phase + i * 0.08 + time * 0.16, e.palette, 0.18 * visibility);
  return dst;
}

function writeForest(data, dst, e, time, visibility) {
  for (let trunk = 0; trunk < 34; trunk++) {
    const x = e.center[0] + (hash(trunk + e.seed) - 0.5) * e.radius * 1.6;
    const z = e.center[2] + (hash(trunk * 2.1 + e.seed) - 0.5) * e.radius * 1.4;
    const base = [x, e.center[1] - e.radius * 0.55, z];
    const top = [x + Math.sin(trunk) * 1.8, e.center[1] + e.radius * 0.55, z + Math.cos(trunk) * 2];
    dst = line(data, dst, base, top, e.palette, 0.09 * visibility);
    for (let b = 0; b < 3; b++) {
      const p = lerp(base, top, 0.35 + b * 0.18);
      dst = line(data, dst, p, [p[0] + Math.sin(b + trunk) * e.radius * 0.22, p[1] + e.radius * 0.14, p[2] + Math.cos(b * 2 + trunk) * e.radius * 0.18], e.palette, 0.07 * visibility);
    }
  }
  return dst;
}

function writeReef(data, dst, e, time, visibility) {
  for (let branch = 0; branch < 42; branch++) {
    const a = e.phase + branch * 2.399;
    let p = [e.center[0] + Math.cos(a) * e.radius * 0.14, e.center[1] + Math.sin(a * 1.7) * e.radius * 0.1, e.center[2] + Math.sin(a) * e.radius * 0.14];
    for (let i = 1; i < 9; i++) {
      const k = i / 8;
      const q = [p[0] + Math.cos(a + k) * e.radius * 0.05, p[1] + k * e.radius * 0.07, p[2] + Math.sin(a + k * 2) * e.radius * 0.12];
      dst = line(data, dst, p, q, e.palette, 0.14 * visibility * (1 - k * 0.3));
      if (i % 3 === 0) dst = circle(data, dst, q, e.radius * 0.025, 14, a, e.palette, 0.1 * visibility);
      p = q;
    }
  }
  return dst;
}

function writeMirror(data, dst, e, time, visibility) {
  for (let shard = 0; shard < 18; shard++) {
    const a = e.phase + shard * 0.71;
    const c = [e.center[0] + Math.cos(a) * e.radius * 0.45, e.center[1] + Math.sin(a * 1.4) * e.radius * 0.32, e.center[2] + Math.sin(a) * e.radius * 0.25];
    const w = e.radius * (0.08 + hash(shard) * 0.13);
    const h = e.radius * (0.18 + hash(shard + 8) * 0.22);
    const p1 = [c[0] - w, c[1] - h, c[2]];
    const p2 = [c[0] + w, c[1] - h * 0.2, c[2] + w];
    const p3 = [c[0] + w * 0.4, c[1] + h, c[2] - w];
    dst = line(data, dst, p1, p2, e.palette, 0.13 * visibility);
    dst = line(data, dst, p2, p3, e.palette, 0.13 * visibility);
    dst = line(data, dst, p3, p1, e.palette, 0.13 * visibility);
  }
  return dst;
}

function writeShell(data, dst, e, time, visibility) {
  for (let i = 0; i < 9; i++) {
    const r = e.radius * (0.22 + i * 0.075);
    dst = circle(data, dst, e.center, r, 112, e.phase + time * 0.04 + i * 0.2, e.palette, 0.1 * visibility);
    dst = ellipse(data, dst, e.center, r, r * 0.38, 96, Math.PI * 0.5 + i * 0.15, e.palette, 0.08 * visibility);
  }
  return dst;
}

function writeVoid(data, dst, e, time, visibility) {
  for (let i = 0; i < 7; i++) dst = ellipse(data, dst, e.center, e.radius * (0.32 + i * 0.035), e.radius * (0.16 + i * 0.018), 128, e.phase + time * 0.04 + i * 0.06, e.palette, 0.18 * visibility);
  return dst;
}

function circle(data, dst, center, radius, segments, phase, color, alpha) {
  return ellipse(data, dst, center, radius, radius, segments, phase, color, alpha);
}

function ellipse(data, dst, center, rx, ry, segments, phase, color, alpha) {
  let last = null;
  for (let i = 0; i <= segments; i++) {
    const a = phase + (i / segments) * Math.PI * 2;
    const p = [center[0] + Math.cos(a) * rx, center[1] + Math.sin(a) * ry, center[2] + Math.sin(a + phase) * rx * 0.08];
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return dst;
}

function polygon(data, dst, center, radius, sides, phase, color, alpha) {
  let first = null;
  let last = null;
  for (let i = 0; i < sides; i++) {
    const a = phase + (i / sides) * Math.PI * 2;
    const p = [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, center[2]];
    if (!first) first = p;
    if (last) dst = line(data, dst, last, p, color, alpha);
    last = p;
  }
  return line(data, dst, last, first, color, alpha);
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

export function createEncounterMaterial(name = 'CosmicEncounterLines') {
  const material = new pc.ShaderMaterial({
    uniqueName: name,
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aColor: pc.SEMANTIC_ATTR1
    },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec4 aColor;
      uniform mat4 matrix_viewProjection;
      varying vec4 vColor;
      void main(void) {
        gl_Position = matrix_viewProjection * vec4(aPosition, 1.0);
        vColor = aColor;
      }
    `,
    fragmentGLSL: `
      precision highp float;
      uniform float uEncounterGlow;
      varying vec4 vColor;
      void main(void) {
        gl_FragColor = vec4(vColor.rgb * vColor.a * uEncounterGlow, vColor.a);
      }
    `,
    vertexWGSL: `
      attribute aPosition: vec3f;
      attribute aColor: vec4f;
      uniform matrix_viewProjection: mat4x4f;
      varying vColor: vec4f;
      @vertex
      fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniform.matrix_viewProjection * vec4f(aPosition, 1.0);
        output.vColor = aColor;
        return output;
      }
    `,
    fragmentWGSL: `
      uniform uEncounterGlow: f32;
      varying vColor: vec4f;
      @fragment
      fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        output.color = vec4f(vColor.rgb * vColor.a * uniform.uEncounterGlow, vColor.a);
        return output;
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

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 19.7) * 43758.5453;
  return x - Math.floor(x);
}

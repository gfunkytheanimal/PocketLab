import * as pc from 'playcanvas/build/playcanvas.mjs';

export function createPointMesh(device, count, useGpuStorage) {
  const vertexCount = count * 4;
  const indexCount = count * 6;
  const elements = useGpuStorage
    ? [
        { semantic: pc.SEMANTIC_ATTR0, components: 1, type: pc.TYPE_FLOAT32 },
        { semantic: pc.SEMANTIC_ATTR1, components: 2, type: pc.TYPE_FLOAT32 }
      ]
    : [
        { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
        { semantic: pc.SEMANTIC_ATTR1, components: 4, type: pc.TYPE_FLOAT32 },
        { semantic: pc.SEMANTIC_ATTR3, components: 4, type: pc.TYPE_FLOAT32 },
        { semantic: pc.SEMANTIC_ATTR2, components: 2, type: pc.TYPE_FLOAT32 }
      ];

  const format = new pc.VertexFormat(device, elements);
  const vertexBuffer = new pc.VertexBuffer(device, format, vertexCount, pc.BUFFER_DYNAMIC);
  const indexFormat = vertexCount > 65535 ? pc.INDEXFORMAT_UINT32 : pc.INDEXFORMAT_UINT16;
  const indexBuffer = new pc.IndexBuffer(device, indexFormat, indexCount, pc.BUFFER_STATIC);
  const indices = indexFormat === pc.INDEXFORMAT_UINT32
    ? new Uint32Array(indexBuffer.lock())
    : new Uint16Array(indexBuffer.lock());
  let dst = 0;
  for (let i = 0; i < count; i++) {
    const v = i * 4;
    indices[dst++] = v;
    indices[dst++] = v + 1;
    indices[dst++] = v + 2;
    indices[dst++] = v;
    indices[dst++] = v + 2;
    indices[dst++] = v + 3;
  }
  indexBuffer.unlock();
  const mesh = new pc.Mesh(device);
  mesh.vertexBuffer = vertexBuffer;
  mesh.indexBuffer[0] = indexBuffer;
  mesh.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(400, 400, 400));
  mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
  mesh.primitive[0].base = 0;
  mesh.primitive[0].count = indexCount;
  mesh.primitive[0].indexed = true;
  return { mesh, vertexBuffer, format };
}

export function fillIndexBuffer(vertexBuffer, count) {
  const data = new Float32Array(vertexBuffer.lock());
  const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
  let dst = 0;
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 4; c++) {
      data[dst++] = i;
      data[dst++] = corners[c * 2];
      data[dst++] = corners[c * 2 + 1];
    }
  }
  vertexBuffer.unlock();
}

export function uploadCpuParticles(vertexBuffer, particles, count) {
  const data = new Float32Array(vertexBuffer.lock());
  const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
  let dst = 0;
  for (let i = 0; i < count; i++) {
    const src = i * 12;
    for (let c = 0; c < 4; c++) {
      data[dst++] = particles[src];
      data[dst++] = particles[src + 1];
      data[dst++] = particles[src + 2];
      data[dst++] = particles[src + 4];
      data[dst++] = particles[src + 5];
      data[dst++] = particles[src + 6];
      data[dst++] = particles[src + 7];
      data[dst++] = particles[src + 8];
      data[dst++] = particles[src + 9];
      data[dst++] = particles[src + 10];
      data[dst++] = particles[src + 11];
      data[dst++] = corners[c * 2];
      data[dst++] = corners[c * 2 + 1];
    }
  }
  vertexBuffer.unlock();
}

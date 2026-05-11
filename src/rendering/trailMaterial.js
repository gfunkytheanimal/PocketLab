import * as pc from 'playcanvas/build/playcanvas.mjs';

export function createTrailMaterial() {
  const material = new pc.ShaderMaterial({
    uniqueName: 'RecursiveFlowTrails',
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
      varying vec4 vColor;
      void main(void) {
        gl_FragColor = vec4(vColor.rgb * (0.28 + vColor.a * 1.8), vColor.a);
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
      varying vColor: vec4f;
      @fragment
      fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        output.color = vec4f(vColor.rgb * (0.28 + vColor.a * 1.8), vColor.a);
        return output;
      }
    `
  });
  material.blendType = pc.BLEND_ADDITIVEALPHA;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
  material.update();
  return material;
}

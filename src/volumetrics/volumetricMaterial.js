import * as pc from 'playcanvas/build/playcanvas.mjs';

export function createVolumetricMaterial() {
  const material = new pc.ShaderMaterial({
    uniqueName: 'RecursiveVolumetricFog',
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aColor: pc.SEMANTIC_ATTR1,
      aCorner: pc.SEMANTIC_ATTR2
    },
    vertexGLSL: `
      attribute vec3 aPosition;
      attribute vec4 aColor;
      attribute vec2 aCorner;
      uniform mat4 matrix_viewProjection;
      uniform float uTime;
      varying vec4 vColor;
      varying vec2 vCorner;
      void main(void) {
        vec3 wobble = vec3(
          sin(uTime * 0.13 + aPosition.y * 0.07),
          cos(uTime * 0.11 + aPosition.z * 0.05),
          sin(uTime * 0.09 + aPosition.x * 0.04)
        ) * aColor.a * 0.7;
        gl_Position = matrix_viewProjection * vec4(aPosition + wobble, 1.0);
        vColor = aColor;
        vCorner = aCorner;
      }
    `,
    fragmentGLSL: `
      precision highp float;
      uniform float uFogPulse;
      varying vec4 vColor;
      varying vec2 vCorner;
      void main(void) {
        float d = dot(vCorner, vCorner);
        float body = exp(-d * 1.25);
        float core = exp(-d * 4.5);
        float alpha = smoothstep(1.0, 0.05, d) * vColor.a * (0.08 + uFogPulse);
        gl_FragColor = vec4(vColor.rgb * (body * 0.55 + core * 0.25), alpha);
      }
    `,
    vertexWGSL: `
      attribute aPosition: vec3f;
      attribute aColor: vec4f;
      attribute aCorner: vec2f;
      uniform matrix_viewProjection: mat4x4f;
      uniform uTime: f32;
      varying vColor: vec4f;
      varying vCorner: vec2f;
      @vertex
      fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        let wobble = vec3f(
          sin(uniform.uTime * 0.13 + aPosition.y * 0.07),
          cos(uniform.uTime * 0.11 + aPosition.z * 0.05),
          sin(uniform.uTime * 0.09 + aPosition.x * 0.04)
        ) * aColor.a * 0.7;
        output.position = uniform.matrix_viewProjection * vec4f(aPosition + wobble, 1.0);
        output.vColor = aColor;
        output.vCorner = aCorner;
        return output;
      }
    `,
    fragmentWGSL: `
      uniform uFogPulse: f32;
      varying vColor: vec4f;
      varying vCorner: vec2f;
      @fragment
      fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let d = dot(vCorner, vCorner);
        let body = exp(-d * 1.25);
        let core = exp(-d * 4.5);
        let alpha = smoothstep(1.0, 0.05, d) * vColor.a * (0.08 + uniform.uFogPulse);
        output.color = vec4f(vColor.rgb * (body * 0.55 + core * 0.25), alpha);
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

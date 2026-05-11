import * as pc from 'playcanvas/build/playcanvas.mjs';
import {
  particleFragmentGLSL,
  particleFragmentWGSL,
  particleCpuVertexWGSL,
  particleVertexGLSL,
  particleVertexWGSL
} from '../shaders/particleRender.js';

export function createParticleMaterial(useGpuStorage) {
  const material = new pc.ShaderMaterial({
    uniqueName: useGpuStorage ? 'AttractorParticlesGPU' : 'AttractorParticlesCPU',
    attributes: useGpuStorage
      ? { aIndex: pc.SEMANTIC_ATTR0, aCorner: pc.SEMANTIC_ATTR1 }
      : { aPosition: pc.SEMANTIC_POSITION, aVelocityLife: pc.SEMANTIC_ATTR1, aRoleSeed: pc.SEMANTIC_ATTR3, aCorner: pc.SEMANTIC_ATTR2 },
    vertexWGSL: useGpuStorage ? particleVertexWGSL : particleCpuVertexWGSL,
    fragmentWGSL: particleFragmentWGSL,
    vertexGLSL: particleVertexGLSL,
    fragmentGLSL: particleFragmentGLSL
  });
  material.blendType = pc.BLEND_ADDITIVEALPHA;
  material.depthWrite = false;
  material.depthTest = true;
  material.cull = pc.CULLFACE_NONE;
  material.update();
  return material;
}

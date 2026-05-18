import * as THREE from 'three';

export function createBlackHoleMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAccretion: { value: 0.35 },
      uStress: { value: 0 },
      uPulse: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uAccretion;
      uniform float uStress;
      uniform float uPulse;

      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      void main() {
        vec2 uv = vUv;
        float r = length(uv);
        if (r > 1.08) discard;
        vec2 p = rot(uTime * (0.22 + uStress * 0.9)) * uv;
        float pr = length(p);
        float a = atan(p.y, p.x);
        float disk = exp(-abs(p.y + sin(p.x * 8.0 + uTime * 1.2) * 0.025) * (8.0 + uAccretion * 16.0))
          * smoothstep(0.98, 0.16, abs(p.x))
          * smoothstep(0.16, 0.28, pr);
        float photon = exp(-abs(r - (0.34 + uPulse * 0.035)) * 24.0);
        float lens = exp(-abs(r - (0.62 + uPulse * 0.06)) * 8.0);
        float arms = pow(max(0.0, cos(a * 2.0 - pr * (13.0 + uAccretion * 6.0) + uTime * 1.4)), 4.0);
        float n = noise(p * 12.0 + vec2(uTime * 0.6, -uTime * 0.22));
        float doppler = 0.5 + 0.5 * cos(a - uTime * 0.8);
        vec3 hot = mix(vec3(1.6, 0.35, 0.05), vec3(1.0, 0.94, 0.72), doppler);
        vec3 blue = vec3(0.32, 0.75, 1.5) * (1.0 - doppler);
        vec3 col = hot * disk * (0.65 + uAccretion * 1.8) * (0.58 + n * 0.8);
        col += hot * photon * (0.5 + uStress * 0.7);
        col += blue * lens * (0.22 + uPulse * 0.5);
        col += vec3(0.55, 0.8, 1.4) * arms * lens * (0.2 + uStress * 0.8);
        float core = smoothstep(0.33 + uPulse * 0.03, 0.18, r);
        col = mix(col, vec3(0.0), core * 0.95);
        float alpha = max(disk * 0.44, max(photon * 0.45, lens * 0.17 + arms * lens * 0.12));
        alpha = max(alpha, core * 0.82);
        alpha *= smoothstep(1.08, 0.86, r);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
}

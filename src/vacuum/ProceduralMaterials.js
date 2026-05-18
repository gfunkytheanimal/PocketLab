import * as THREE from 'three';

export function createProceduralPlanetMaterial(kind = 'earth') {
  const palettes = {
    mars: ['#33110b', '#aa4f2f', '#f1a46b', '#5a2418'],
    jupiter: ['#2f2019', '#d49a62', '#f2d29a', '#9b5232'],
    ice: ['#0a2035', '#74d9ff', '#e7fbff', '#3b78a3']
  };
  const colors = palettes[kind] ?? palettes.ice;
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new THREE.Color(colors[0]) },
      uBandA: { value: new THREE.Color(colors[1]) },
      uBandB: { value: new THREE.Color(colors[2]) },
      uStorm: { value: new THREE.Color(colors[3]) },
      uKind: { value: kind === 'mars' ? 0 : kind === 'jupiter' ? 1 : 2 }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBase;
      uniform vec3 uBandA;
      uniform vec3 uBandB;
      uniform vec3 uStorm;
      uniform float uKind;
      varying vec2 vUv;
      varying vec3 vNormal;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      void main() {
        vec3 color;
        if (uKind < 0.5) {
          float terrain = noise(vUv * 10.0) * 0.55 + noise(vUv * 31.0) * 0.28 + noise(vUv * 72.0) * 0.16;
          float dust = smoothstep(0.18, 0.95, terrain);
          float scar = smoothstep(0.65, 0.82, sin(vUv.x * 23.0 + noise(vUv * 4.0) * 5.0)) * smoothstep(0.34, 0.92, noise(vUv * 15.0));
          float cap = smoothstep(0.82, 0.96, abs(vUv.y - 0.5) * 2.0);
          color = mix(uBase, uBandA, dust);
          color = mix(color, uBandB, terrain * 0.28);
          color = mix(color, uStorm, scar * 0.42);
          color = mix(color, vec3(0.95, 0.82, 0.68), cap * 0.35);
        } else if (uKind < 1.5) {
          float laneNoise = noise(vec2(vUv.x * 5.0 + uTime * 0.018, vUv.y * 22.0));
          float bands = sin((vUv.y + laneNoise * 0.055) * 72.0);
          float thinBands = sin((vUv.y + laneNoise * 0.035) * 154.0);
          vec2 stormUv = vec2((vUv.x - 0.67) * 3.2, (vUv.y - 0.47) * 8.0);
          float storm = smoothstep(0.36, 0.02, dot(stormUv, stormUv)) * smoothstep(0.9, 0.1, abs(sin(vUv.x * 10.0)));
          color = mix(uBase, uBandA, smoothstep(-0.65, 0.85, bands));
          color = mix(color, uBandB, smoothstep(0.18, 0.98, thinBands) * 0.22);
          color = mix(color, uStorm, storm * 0.78);
        } else {
          float ocean = noise(vUv * 8.0);
          float clouds = smoothstep(0.48, 0.82, noise(vUv * 22.0 + vec2(uTime * 0.01, 0.0)));
          color = mix(uBase, uBandA, ocean);
          color = mix(color, uBandB, clouds * 0.45);
        }
        float rim = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
        gl_FragColor = vec4(color + rim * 0.18, 1.0);
      }
    `
  });
}

export function createStarSurfaceMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: 1.0 }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHeat;
      varying vec2 vUv;
      varying vec3 vNormal;
      float wave(vec2 p) {
        return sin(p.x * 28.0 + uTime * 2.1) * sin(p.y * 34.0 - uTime * 1.6);
      }
      void main() {
        float plasma = wave(vUv) * 0.5 + wave(vUv.yx * 1.7) * 0.35;
        vec3 core = vec3(1.0, 0.76, 0.18);
        vec3 hot = vec3(1.0, 0.22, 0.04);
        vec3 white = vec3(1.0, 0.96, 0.72);
        float rim = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 1.5);
        vec3 color = mix(core, hot, plasma * 0.5 + 0.5);
        color = mix(color, white, rim * 0.65 + uHeat * 0.08);
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}

export function createGasCloudMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: 0 },
      uStress: { value: 0 },
      uBase: { value: new THREE.Color(0x846bff) },
      uHot: { value: new THREE.Color(0xffb45f) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHeat;
      uniform float uStress;
      uniform vec3 uBase;
      uniform vec3 uHot;
      varying vec2 vUv;
      varying vec3 vNormal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(41.7, 289.1))) * 9758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p);
        float a = atan(p.y, p.x);
        float spiral = sin(a * 4.0 + r * 24.0 - uTime * (1.4 + uStress * 4.0));
        float vapor = noise(vUv * 11.0 + vec2(uTime * 0.08, -uTime * 0.06));
        float density = smoothstep(0.58, 0.05, r) * (0.34 + vapor * 0.42 + spiral * 0.12);
        float rim = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 1.8);
        vec3 color = mix(uBase, uHot, clamp(uHeat + uStress * 0.45 + spiral * 0.08, 0.0, 1.0));
        gl_FragColor = vec4(color + rim * vec3(0.25, 0.45, 0.7), density);
      }
    `
  });
}

export function createHologramMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x64f7ff) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        float scan = sin((vWorld.y + uTime * 24.0) * 2.8) * 0.5 + 0.5;
        float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.2);
        float alpha = 0.08 + rim * 0.55 + smoothstep(0.82, 1.0, scan) * 0.22;
        gl_FragColor = vec4(uColor + rim * vec3(0.25, 0.55, 0.7), alpha);
      }
    `
  });
}

export function createVolumetricShellMaterial(base = 0x72fff0, hot = 0xffb35d) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: 0 },
      uBase: { value: new THREE.Color(base) },
      uHot: { value: new THREE.Color(hot) }
    },
    vertexShader: `
      varying vec3 vPos;
      varying vec3 vNormal;
      void main() {
        vPos = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHeat;
      uniform vec3 uBase;
      uniform vec3 uHot;
      varying vec3 vPos;
      varying vec3 vNormal;
      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(17.1, 73.7, 191.9))) * 43758.5453);
      }
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
        return n;
      }
      void main() {
        vec3 p = normalize(vPos) * 2.4 + vec3(uTime * 0.08, -uTime * 0.05, uTime * 0.04);
        float layers = 0.0;
        float amp = 0.55;
        for (int i = 0; i < 4; i++) {
          layers += noise(p) * amp;
          p *= 1.9;
          amp *= 0.52;
        }
        float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 1.7);
        float density = smoothstep(0.28, 1.0, layers + rim * 0.75);
        vec3 color = mix(uBase, uHot, clamp(uHeat + layers * 0.35, 0.0, 1.0));
        gl_FragColor = vec4(color, density * (0.12 + rim * 0.46));
      }
    `
  });
}

export function createLightShaftMaterial(color = 0x74ffe8) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uPower: { value: 0.5 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocal;
      void main() {
        vUv = uv;
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uPower;
      varying vec2 vUv;
      varying vec3 vLocal;
      void main() {
        float center = 1.0 - smoothstep(0.0, 0.58, abs(vUv.x - 0.5));
        float scan = sin((vUv.y * 18.0 - uTime * 5.0) + vLocal.x * 0.04) * 0.5 + 0.5;
        float fade = smoothstep(1.0, 0.05, vUv.y);
        float alpha = center * fade * (0.12 + scan * 0.2 + uPower * 0.22);
        gl_FragColor = vec4(uColor + vec3(scan * 0.18), alpha);
      }
    `
  });
}

export function createGooMaterial(base = 0x7dff9b, hot = 0xff4b38) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: 0 },
      uBase: { value: new THREE.Color(base) },
      uHot: { value: new THREE.Color(hot) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position + normal * sin(position.y * 3.0) * 0.08;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHeat;
      uniform vec3 uBase;
      uniform vec3 uHot;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        float wobble = sin(vUv.x * 18.0 + uTime * 2.2) * sin(vUv.y * 23.0 - uTime * 1.5);
        float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0,0.0,1.0))), 2.2);
        vec3 color = mix(uBase, uHot, clamp(uHeat + wobble * 0.18, 0.0, 1.0));
        gl_FragColor = vec4(color + rim * 0.35, 0.18 + rim * 0.42 + abs(wobble) * 0.08);
      }
    `
  });
}

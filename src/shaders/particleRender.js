export const particleVertexWGSL = `
attribute aIndex: f32;
attribute aCorner: vec2f;
uniform matrix_viewProjection: mat4x4f;
uniform uParticleSize: f32;
uniform uResolution: vec2f;
uniform uTime: f32;
uniform uFogDensity: f32;
uniform uPaletteShift: f32;
uniform uHorizonWarp: f32;
uniform uDotOpacity: f32;
uniform uAppMode: f32;
uniform uPianoPhysics: f32;

struct Particle {
  positionLife: vec4f,
  velocitySeed: vec4f,
};

var<storage, read> particles: array<Particle>;
varying vColor: vec4f;
varying vCorner: vec2f;
varying vRoleSeed: vec4f;

fn palette(t: f32) -> vec3f {
  let a = vec3f(0.04, 0.18, 0.45);
  let b = vec3f(0.0, 0.85, 1.0);
  let c = vec3f(1.0, 0.28, 0.72);
  let d = vec3f(1.0, 0.86, 0.36);
  return mix(mix(a, b, smoothstep(0.0, 0.45, t)), mix(c, d, smoothstep(0.55, 1.0, t)), smoothstep(0.35, 0.9, t));
}

fn noteColor(family: f32) -> vec3f {
  let f = i32(clamp(round(family), 0.0, 11.0));
  if (f == 0) { return vec3f(0.28, 0.55, 1.55); }
  if (f == 1) { return vec3f(0.15, 1.20, 1.55); }
  if (f == 2) { return vec3f(0.25, 1.25, 0.62); }
  if (f == 3) { return vec3f(0.70, 1.55, 0.30); }
  if (f == 4) { return vec3f(1.55, 1.08, 0.25); }
  if (f == 5) { return vec3f(1.55, 0.58, 0.22); }
  if (f == 6) { return vec3f(1.50, 0.22, 0.22); }
  if (f == 7) { return vec3f(1.35, 0.30, 1.45); }
  if (f == 8) { return vec3f(0.72, 0.42, 1.65); }
  if (f == 9) { return vec3f(1.35, 1.48, 1.62); }
  if (f == 10) { return vec3f(0.22, 1.40, 1.12); }
  return vec3f(1.65, 1.28, 0.34);
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let particle = particles[u32(aIndex)];
  var pos = particle.positionLife.xyz;
  let warp = sin(pos.yzx * 0.045 + vec3f(uniform.uTime * 0.17, uniform.uTime * 0.11, uniform.uTime * 0.13));
  pos += warp * uniform.uHorizonWarp * 2.5;
  let velocity = particle.velocitySeed.xyz;
  let speed = clamp(length(velocity) * 0.18, 0.0, 1.0);
  let life = particle.positionLife.w;
  let distanceAtten = 1.0 / (1.0 + max(0.0, -pos.z) * 0.018);
  let boardSize = mix(1.0, 2.6, step(0.35, speed)) * mix(1.0, 1.65, step(0.72, life));
  let size = uniform.uParticleSize * (0.5 + speed * 0.35) * (0.55 + life * 0.35) * distanceAtten * mix(1.0, boardSize, uniform.uAppMode);
  var clip = uniform.matrix_viewProjection * vec4f(pos, 1.0);
  clip.xy += aCorner * size * 2.0 / uniform.uResolution * clip.w;
  output.position = clip;
  let color = palette(fract(speed + life * 0.35 + uniform.uPaletteShift + sin(uniform.uTime * 0.08) * 0.08));
  let fog = exp(-max(0.0, output.position.z) * uniform.uFogDensity);
  let brightness = 0.2 + speed * 0.9 + uniform.uAppMode * life * 0.55 + uniform.uPianoPhysics * (0.28 + life * 0.65);
  output.vColor = vec4f(color * brightness, clamp(life * fog * uniform.uDotOpacity * (1.0 + uniform.uAppMode * 0.8 + uniform.uPianoPhysics * 0.9), 0.0, 0.96));
  output.vCorner = aCorner;
  output.vRoleSeed = vec4f(0.0, fract(particle.velocitySeed.w), fract(particle.velocitySeed.w * 7.13), 0.0);
  return output;
}
`;

export const particleFragmentWGSL = `
uniform uBloomStrength: f32;
uniform uChromaticAberration: f32;
uniform uColorGrade: vec3f;
uniform uContrast: f32;
uniform uSaturation: f32;
varying vColor: vec4f;
varying vCorner: vec2f;
varying vRoleSeed: vec4f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let uv = vCorner;
  let d = dot(uv, uv);
  if (d > 1.0) {
    discard;
  }
  let role = vRoleSeed.x;
  let angle = atan2(uv.y, uv.x);
  let star = pow(max(0.0, cos(angle * 4.0)), 8.0) * 0.55 + pow(max(0.0, cos(angle * 8.0)), 14.0) * 0.25;
  let shard = smoothstep(0.16, 0.0, abs(uv.y)) * smoothstep(1.0, 0.05, abs(uv.x));
  let crescent = exp(-length(uv - vec2f(0.22, 0.0)) * 6.5) - exp(-length(uv - vec2f(-0.08, 0.02)) * 8.0);
  let droplet = exp(-(uv.x * uv.x * 5.0 + (uv.y + 0.18) * (uv.y + 0.18) * 10.0));
  let spark = smoothstep(0.035, 0.0, abs(uv.y)) * smoothstep(1.0, 0.0, abs(uv.x));
  let bead = exp(-d * 12.0);
  var shape = max(bead, exp(-d * 5.0) * 0.35);
  if (role >= 0.5 && role < 1.5) {
    shape = max(exp(-d * 8.0), star);
  } else if (role >= 1.5 && role < 2.5) {
    shape = max(droplet, exp(-d * 3.2) * 0.18);
  } else if (role >= 2.5 && role < 3.5) {
    shape = max(crescent, exp(-d * 9.0) * 0.5);
  } else if (role >= 3.5 && role < 4.5) {
    shape = max(shard, star * 0.7);
  } else if (role >= 4.5) {
    shape = max(spark, exp(-d * 18.0));
  }
  let core = shape;
  let halo = exp(-d * 2.2) * select(0.12, 0.04, role > 4.5);
  let edge = smoothstep(1.0, 0.45, d);
  let beadShade = clamp(0.48 + (uv.x * -0.35 + uv.y * 0.55) + (1.0 - d) * 0.55, 0.22, 1.35);
  let rimLight = pow(edge, 4.0) * 0.22 + pow(max(0.0, 1.0 - d), 5.0) * 0.35;
  let chroma = vec3f(1.0 + uv.x * 0.08 * uniform.uChromaticAberration, 1.0, 1.0 - uv.y * 0.06 * uniform.uChromaticAberration);
  var rgb = vColor.rgb * chroma * (core * beadShade + halo + rimLight) * (1.0 + uniform.uBloomStrength) * uniform.uColorGrade;
  let luma = dot(rgb, vec3f(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3f(luma), rgb, uniform.uSaturation);
  rgb = (rgb - vec3f(0.5)) * uniform.uContrast + vec3f(0.5);
  output.color = vec4f(max(rgb, vec3f(0.0)), vColor.a * edge);
  return output;
}
`;

export const particleCpuVertexWGSL = `
attribute aPosition: vec3f;
attribute aVelocityLife: vec4f;
attribute aRoleSeed: vec4f;
attribute aCorner: vec2f;
uniform matrix_viewProjection: mat4x4f;
uniform uParticleSize: f32;
uniform uResolution: vec2f;
uniform uTime: f32;
uniform uFogDensity: f32;
uniform uPaletteShift: f32;
uniform uHorizonWarp: f32;
uniform uDotOpacity: f32;
uniform uAppMode: f32;
uniform uPianoPhysics: f32;
varying vColor: vec4f;
varying vCorner: vec2f;
varying vRoleSeed: vec4f;

fn palette(t: f32) -> vec3f {
  let a = vec3f(0.04, 0.18, 0.45);
  let b = vec3f(0.0, 0.85, 1.0);
  let c = vec3f(1.0, 0.28, 0.72);
  let d = vec3f(1.0, 0.86, 0.36);
  return mix(mix(a, b, smoothstep(0.0, 0.45, t)), mix(c, d, smoothstep(0.55, 1.0, t)), smoothstep(0.35, 0.9, t));
}

fn noteColor(family: f32) -> vec3f {
  let f = i32(clamp(round(family), 0.0, 11.0));
  if (f == 0) { return vec3f(0.28, 0.55, 1.55); }
  if (f == 1) { return vec3f(0.15, 1.20, 1.55); }
  if (f == 2) { return vec3f(0.25, 1.25, 0.62); }
  if (f == 3) { return vec3f(0.70, 1.55, 0.30); }
  if (f == 4) { return vec3f(1.55, 1.08, 0.25); }
  if (f == 5) { return vec3f(1.55, 0.58, 0.22); }
  if (f == 6) { return vec3f(1.50, 0.22, 0.22); }
  if (f == 7) { return vec3f(1.35, 0.30, 1.45); }
  if (f == 8) { return vec3f(0.72, 0.42, 1.65); }
  if (f == 9) { return vec3f(1.35, 1.48, 1.62); }
  if (f == 10) { return vec3f(0.22, 1.40, 1.12); }
  return vec3f(1.65, 1.28, 0.34);
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let velocity = aVelocityLife.xyz;
  let role = aRoleSeed.x;
  let seedA = aRoleSeed.y;
  let seedB = aRoleSeed.z;
  let family = aRoleSeed.w;
  var warpedPosition = aPosition;
  let warp = sin(aPosition.yzx * 0.045 + vec3f(uniform.uTime * 0.17, uniform.uTime * 0.11, uniform.uTime * 0.13));
  warpedPosition += warp * uniform.uHorizonWarp * 2.5;
  let speed = clamp(length(velocity) * 0.18, 0.0, 1.0);
  let life = aVelocityLife.w;
  let distanceAtten = 1.0 / (1.0 + max(0.0, -warpedPosition.z) * 0.018);
  let roleSize = select(select(select(select(select(1.55, 1.1, role < 1.5), 1.0, role < 2.5), 1.22, role < 3.5), 0.82, role < 4.5), 0.55, role < 5.5);
  let boardSize = mix(1.0, 2.6, step(0.35, speed)) * mix(1.0, 1.65, step(0.72, life)) * roleSize * (0.72 + seedA * 0.7);
  let size = uniform.uParticleSize * (0.5 + speed * 0.35) * (0.55 + life * 0.35) * distanceAtten * mix(1.0, boardSize, uniform.uAppMode);
  var clip = uniform.matrix_viewProjection * vec4f(warpedPosition, 1.0);
  clip.xy += aCorner * size * 2.0 / uniform.uResolution * clip.w;
  output.position = clip;
  let roleT = (role + seedB * 0.35) / 6.0;
  let color = mix(palette(fract(roleT + speed * 0.18 + life * 0.16 + uniform.uPaletteShift * 0.3)), noteColor(family), uniform.uPianoPhysics);
  let fog = exp(-max(0.0, output.position.z) * uniform.uFogDensity);
  output.vColor = vec4f(color * (0.2 + speed * 0.9 + uniform.uAppMode * life * 0.55), clamp(life * fog * uniform.uDotOpacity * (1.0 + uniform.uAppMode * 0.8), 0.0, 0.92));
  output.vCorner = aCorner;
  output.vRoleSeed = aRoleSeed;
  return output;
}
`;

export const particleVertexGLSL = `
attribute vec3 aPosition;
attribute vec4 aVelocityLife;
attribute vec4 aRoleSeed;
attribute vec2 aCorner;
uniform mat4 matrix_viewProjection;
uniform float uParticleSize;
uniform vec2 uResolution;
uniform float uTime;
uniform float uFogDensity;
uniform float uPaletteShift;
uniform float uHorizonWarp;
uniform float uDotOpacity;
uniform float uAppMode;
uniform float uPianoPhysics;
varying vec4 vColor;
varying vec2 vCorner;
varying vec4 vRoleSeed;

vec3 palette(float t) {
  vec3 a = vec3(0.04, 0.18, 0.45);
  vec3 b = vec3(0.0, 0.85, 1.0);
  vec3 c = vec3(1.0, 0.28, 0.72);
  vec3 d = vec3(1.0, 0.86, 0.36);
  return mix(mix(a, b, smoothstep(0.0, 0.45, t)), mix(c, d, smoothstep(0.55, 1.0, t)), smoothstep(0.35, 0.9, t));
}

vec3 noteColor(float family) {
  float f = floor(clamp(family, 0.0, 11.0) + 0.5);
  if (f < 0.5) return vec3(0.28, 0.55, 1.55);
  if (f < 1.5) return vec3(0.15, 1.20, 1.55);
  if (f < 2.5) return vec3(0.25, 1.25, 0.62);
  if (f < 3.5) return vec3(0.70, 1.55, 0.30);
  if (f < 4.5) return vec3(1.55, 1.08, 0.25);
  if (f < 5.5) return vec3(1.55, 0.58, 0.22);
  if (f < 6.5) return vec3(1.50, 0.22, 0.22);
  if (f < 7.5) return vec3(1.35, 0.30, 1.45);
  if (f < 8.5) return vec3(0.72, 0.42, 1.65);
  if (f < 9.5) return vec3(1.35, 1.48, 1.62);
  if (f < 10.5) return vec3(0.22, 1.40, 1.12);
  return vec3(1.65, 1.28, 0.34);
}

void main(void) {
  vec3 velocity = aVelocityLife.xyz;
  float role = aRoleSeed.x;
  float seedA = aRoleSeed.y;
  float seedB = aRoleSeed.z;
  float family = aRoleSeed.w;
  vec3 warpedPosition = aPosition + sin(aPosition.yzx * 0.045 + vec3(uTime * 0.17, uTime * 0.11, uTime * 0.13)) * uHorizonWarp * 2.5;
  float life = aVelocityLife.w;
  float speed = clamp(length(velocity) * 0.18, 0.0, 1.0);
  float distanceAtten = 1.0 / (1.0 + max(0.0, -warpedPosition.z) * 0.018);
  float roleSize = role < 0.5 ? 1.05 : role < 1.5 ? 0.88 : role < 2.5 ? 0.82 : role < 3.5 ? 0.96 : role < 4.5 ? 0.72 : 0.5;
  float boardSize = mix(0.72, 1.85, step(0.35, speed)) * mix(0.85, 1.25, step(0.72, life)) * roleSize * (0.68 + seedA * 0.45);
  float size = uParticleSize * (0.5 + speed * 0.35) * (0.55 + life * 0.35) * distanceAtten * mix(1.0, boardSize, uAppMode);
  vec4 clip = matrix_viewProjection * vec4(warpedPosition, 1.0);
  clip.xy += aCorner * size * 2.0 / uResolution * clip.w;
  gl_Position = clip;
  vec3 color = mix(palette(fract((role + seedB * 0.35) / 6.0 + speed * 0.18 + life * 0.16 + uPaletteShift * 0.3)), noteColor(family), uPianoPhysics);
  float fog = exp(-max(0.0, gl_Position.z) * uFogDensity);
  float brightness = 0.2 + speed * 0.9 + uAppMode * life * 0.55 + uPianoPhysics * (0.28 + life * 0.65);
  vColor = vec4(color * brightness, clamp(life * fog * uDotOpacity * (1.0 + uAppMode * 0.8 + uPianoPhysics * 0.9), 0.0, 0.96));
  vCorner = aCorner;
  vRoleSeed = aRoleSeed;
}
`;

export const particleFragmentGLSL = `
precision highp float;
uniform float uBloomStrength;
uniform float uChromaticAberration;
uniform vec3 uColorGrade;
uniform float uContrast;
uniform float uSaturation;
varying vec4 vColor;
varying vec2 vCorner;
varying vec4 vRoleSeed;

void main(void) {
  vec2 uv = vCorner;
  float d = dot(uv, uv);
  if (d > 1.0) discard;
  float role = vRoleSeed.x;
  float angle = atan(uv.y, uv.x);
  float star = pow(max(0.0, cos(angle * 4.0)), 18.0) * 0.38 + pow(max(0.0, cos(angle * 8.0)), 26.0) * 0.14;
  float shard = smoothstep(0.16, 0.0, abs(uv.y)) * smoothstep(1.0, 0.05, abs(uv.x));
  float crescent = exp(-length(uv - vec2(0.22, 0.0)) * 6.5) - exp(-length(uv - vec2(-0.08, 0.02)) * 8.0);
  float droplet = exp(-(uv.x * uv.x * 5.0 + (uv.y + 0.18) * (uv.y + 0.18) * 10.0));
  float spark = smoothstep(0.035, 0.0, abs(uv.y)) * smoothstep(1.0, 0.0, abs(uv.x));
  float bead = exp(-d * 22.0);
  float shape = role < 0.5 ? max(bead, exp(-d * 11.0) * 0.12) : role < 1.5 ? max(exp(-d * 16.0), star) : role < 2.5 ? max(droplet, exp(-d * 8.0) * 0.08) : role < 3.5 ? max(crescent, exp(-d * 14.0) * 0.25) : role < 4.5 ? max(shard, star * 0.55) : max(spark, exp(-d * 28.0));
  float core = shape;
  float halo = exp(-d * 6.5) * (role < 4.5 ? 0.035 : 0.015);
  float edge = smoothstep(1.0, 0.45, d);
  float beadShade = clamp(0.48 + (uv.x * -0.35 + uv.y * 0.55) + (1.0 - d) * 0.55, 0.22, 1.35);
  float rimLight = pow(edge, 5.0) * 0.08 + pow(max(0.0, 1.0 - d), 7.0) * 0.26;
  vec3 chroma = vec3(1.0 + uv.x * 0.08 * uChromaticAberration, 1.0, 1.0 - uv.y * 0.06 * uChromaticAberration);
  vec3 rgb = vColor.rgb * chroma * (core * beadShade + halo + rimLight) * (1.0 + uBloomStrength) * uColorGrade;
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(luma), rgb, uSaturation);
  rgb = (rgb - 0.5) * uContrast + 0.5;
  gl_FragColor = vec4(max(rgb, vec3(0.0)), vColor.a * edge);
}
`;

export const particleUpdateWGSL = `
struct Particle {
  positionLife: vec4f,
  velocitySeed: vec4f,
};

struct Params {
  cameraTime: vec4f,
  sim: vec4f,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;

fn hash01(n: f32) -> f32 {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453123);
}

fn randomSphere(seed: f32, radius: f32) -> vec3f {
  let u = hash01(seed + 0.13);
  let v = hash01(seed + 1.37);
  let w = hash01(seed + 2.71);
  let theta = 6.28318530718 * u;
  let z = 2.0 * v - 1.0;
  let r = radius * pow(w, 0.3333333);
  let s = sqrt(max(0.0, 1.0 - z * z));
  return vec3f(r * s * cos(theta), r * z, r * s * sin(theta));
}

fn lorenz(p: vec3f) -> vec3f {
  return vec3f(10.0 * (p.y - p.x), p.x * (28.0 - p.z) - p.y, p.x * p.y - 2.6666667 * p.z);
}

fn aizawa(p: vec3f) -> vec3f {
  let a = 0.95;
  let b = 0.7;
  let c = 0.6;
  let d = 3.5;
  let e = 0.25;
  let f = 0.1;
  return vec3f(
    (p.z - b) * p.x - d * p.y,
    d * p.x + (p.z - b) * p.y,
    c + a * p.z - p.z * p.z * p.z / 3.0 - (p.x * p.x + p.y * p.y) * (1.0 + e * p.z) + f * p.z * p.x * p.x * p.x
  );
}

fn thomas(p: vec3f) -> vec3f {
  let b = 0.19;
  return vec3f(sin(p.y) - b * p.x, sin(p.z) - b * p.y, sin(p.x) - b * p.z);
}

fn halvorsen(p: vec3f) -> vec3f {
  let a = 1.4;
  return vec3f(
    -a * p.x - 4.0 * p.y - 4.0 * p.z - p.y * p.y,
    -a * p.y - 4.0 * p.z - 4.0 * p.x - p.z * p.z,
    -a * p.z - 4.0 * p.x - 4.0 * p.y - p.x * p.x
  );
}

fn systemField(index: u32, p: vec3f) -> vec3f {
  if (index == 0u) { return lorenz(p * 0.055); }
  if (index == 1u) { return aizawa(p * 0.75); }
  if (index == 2u) { return thomas(p * 1.35); }
  return halvorsen(p * 0.32);
}

fn attractorField(p: vec3f, t: f32, recursiveStrength: f32) -> vec3f {
  let phase = t * 0.045;
  let base = u32(floor(phase)) % 4u;
  let next = (base + 1u) % 4u;
  let local = fract(phase);
  let m = local * local * (3.0 - 2.0 * local);
  let main = mix(systemField(base, p), systemField(next, p), m);
  let fold = mix(systemField(next, p * 0.25), systemField((next + 1u) % 4u, p * 0.25), m);
  return main + recursiveStrength * fold;
}

@compute @workgroup_size(128, 1, 1)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
  let i = globalId.x;
  if (i >= u32(params.sim.w)) {
    return;
  }

  var particle = particles[i];
  let camera = params.cameraTime.xyz;
  let time = params.cameraTime.w;
  let dt = params.sim.x;
  let fieldStrength = params.sim.y;
  let recursiveStrength = params.sim.z;
  let radius = 42.0;

  var position = particle.positionLife.xyz;
  var velocity = particle.velocitySeed.xyz;
  var life = particle.positionLife.w - dt * 0.045;
  let seed = particle.velocitySeed.w + f32(i) * 0.071;

  let f0 = attractorField(position, time, recursiveStrength);
  let f1 = attractorField(position + f0 * dt * 0.5, time + dt, recursiveStrength);
  let accel = normalize(f1 + vec3f(0.0001)) * min(length(f1), 32.0);
  velocity = mix(velocity, accel, 0.085) * 0.995;
  position += velocity * dt * fieldStrength;

  let toCamera = position - camera;
  if (dot(toCamera, toCamera) > radius * radius || life <= 0.0) {
    position = camera + randomSphere(seed + time * 3.7, radius * 0.92);
    position.z -= radius * 0.35;
    velocity = normalize(attractorField(position, time, recursiveStrength) + vec3f(0.001)) * 0.35;
    life = 0.5 + hash01(seed + time) * 0.5;
  }

  let curvature = length(f1 - f0);
  particle.positionLife = vec4f(position, clamp(life + curvature * 0.0005, 0.0, 1.0));
  particle.velocitySeed = vec4f(velocity, particle.velocitySeed.w);
  particles[i] = particle;
}
`;

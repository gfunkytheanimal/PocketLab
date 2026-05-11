export const ATTRACTOR_NAMES = ['Lorenz', 'Aizawa', 'Thomas', 'Halvorsen'];

export function lorenz([x, y, z]) {
  return [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
}

export function aizawa([x, y, z]) {
  const a = 0.95;
  const b = 0.7;
  const c = 0.6;
  const d = 3.5;
  const e = 0.25;
  const f = 0.1;
  return [
    (z - b) * x - d * y,
    d * x + (z - b) * y,
    c + a * z - z ** 3 / 3 - (x * x + y * y) * (1 + e * z) + f * z * x ** 3
  ];
}

export function thomas([x, y, z]) {
  const b = 0.19;
  return [
    Math.sin(y) - b * x,
    Math.sin(z) - b * y,
    Math.sin(x) - b * z
  ];
}

export function halvorsen([x, y, z]) {
  const a = 1.4;
  return [
    -a * x - 4 * y - 4 * z - y * y,
    -a * y - 4 * z - 4 * x - z * z,
    -a * z - 4 * x - 4 * y - x * x
  ];
}

const FIELDS = [lorenz, aizawa, thomas, halvorsen];
const SCALES = [0.055, 0.75, 1.35, 0.32];

export function smoothMorph(time) {
  const phase = time * 0.045;
  const segment = Math.floor(phase) % FIELDS.length;
  const local = phase - Math.floor(phase);
  const m = local * local * (3 - 2 * local);
  return { from: segment, to: (segment + 1) % FIELDS.length, m };
}

export function blendedField(position, time, recursiveStrength = 0.1) {
  const morph = smoothMorph(time);
  const p0 = position.map((value) => value * SCALES[morph.from]);
  const p1 = position.map((value) => value * SCALES[morph.to]);
  const a = FIELDS[morph.from](p0);
  const b = FIELDS[morph.to](p1);
  const main = [
    a[0] * (1 - morph.m) + b[0] * morph.m,
    a[1] * (1 - morph.m) + b[1] * morph.m,
    a[2] * (1 - morph.m) + b[2] * morph.m
  ];
  if (recursiveStrength <= 0) {
    return main;
  }
  const folded = blendedField(
    [position[0] * 0.25, position[1] * 0.25, position[2] * 0.25],
    time + 17.0,
    0
  );
  return [
    main[0] + recursiveStrength * folded[0],
    main[1] + recursiveStrength * folded[1],
    main[2] + recursiveStrength * folded[2]
  ];
}

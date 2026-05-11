export function hash01(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function randomInSphere(index, radius) {
  const u = hash01(index * 3 + 0.13);
  const v = hash01(index * 3 + 1.37);
  const w = hash01(index * 3 + 2.71);
  const theta = 6.28318530718 * u;
  const phi = Math.acos(2 * v - 1);
  const r = radius * Math.cbrt(w);
  const s = Math.sin(phi);
  return [
    r * s * Math.cos(theta),
    r * Math.cos(phi),
    r * s * Math.sin(theta)
  ];
}

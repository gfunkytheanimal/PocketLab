import { hash01 } from '../math/random.js';

export function loadUniverseSeed() {
  const urlSeed = new URLSearchParams(window.location.search).get('seed');
  const stored = localStorage.getItem('recursive-universe-seed');
  const seed = urlSeed || stored || `epoch-${Math.floor(Date.now() / 86400000)}`;
  localStorage.setItem('recursive-universe-seed', seed);
  return seed;
}

export function seedNumber(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function seededHash(seed, x, y = 0, z = 0) {
  return hash01(seedNumber(seed) * 9973 + x * 37.17 + y * 113.91 + z * 271.43);
}

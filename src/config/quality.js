export const QUALITY_TIERS = {
  potato: {
    particleCount: 26000,
    maxPixelRatio: 0.8,
    volumetricBillboards: 28,
    trailSamples: 240,
    trailHistory: 8,
    updateCap: 1 / 24,
    bloomStrength: 0.65,
    ringInstanceCount: 36
  },
  low: {
    particleCount: 48000,
    maxPixelRatio: 1,
    volumetricBillboards: 44,
    trailSamples: 420,
    trailHistory: 10,
    updateCap: 1 / 30,
    bloomStrength: 0.78,
    ringInstanceCount: 48
  },
  medium: {
    particleCount: 80000,
    maxPixelRatio: 1.25,
    volumetricBillboards: 72,
    trailSamples: 760,
    trailHistory: 12,
    updateCap: 1 / 30,
    bloomStrength: 0.95,
    ringInstanceCount: 72
  },
  high: {
    particleCount: 100000,
    maxPixelRatio: 1.5,
    volumetricBillboards: 96,
    trailSamples: 1100,
    trailHistory: 14,
    updateCap: 1 / 45,
    bloomStrength: 1.08,
    ringInstanceCount: 96
  },
  ultra: {
    particleCount: 145000,
    maxPixelRatio: 1.75,
    volumetricBillboards: 132,
    trailSamples: 1500,
    trailHistory: 16,
    updateCap: 1 / 60,
    bloomStrength: 1.22,
    ringInstanceCount: 108
  }
};

export function detectQuality() {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = navigator.deviceMemory ?? 4;
  const ratio = window.devicePixelRatio ?? 1;
  if (cores <= 2 || memory <= 2) return 'low';
  if (cores <= 4 || memory <= 4 || ratio > 2.5) return 'medium';
  if (cores >= 10 && memory >= 8) return 'high';
  return 'medium';
}

export function applyQuality(params, qualityId) {
  const id = qualityId === 'auto' || !qualityId ? detectQuality() : qualityId;
  const tier = QUALITY_TIERS[id] ?? QUALITY_TIERS.medium;
  Object.assign(params, tier);
  params.quality = id in QUALITY_TIERS ? id : 'medium';
}

export const LEVEL_THRESHOLDS = [0, 10_000, 30_000, 60_000, 100_000, 200_000, 400_000, 800_000] as const;

export function getMemberLevel(totalPaid: number) {
  let level = 1;
  LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (totalPaid >= threshold) level = index + 1;
  });
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? null;
  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const progress = nextThreshold
    ? Math.min(100, Math.round(((totalPaid - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;
  return { level, currentThreshold, nextThreshold, progress };
}

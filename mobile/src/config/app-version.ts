const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function compareAppVersions(current: string, minimum: string) {
  if (!VERSION_PATTERN.test(current)) return -1;
  const currentParts = current.split(".").map(Number);
  const minimumParts = minimum.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = currentParts[index]! - minimumParts[index]!;
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

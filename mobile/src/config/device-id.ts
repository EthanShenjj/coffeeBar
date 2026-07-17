const DEVICE_ID_KEY = "coffeebar.device-id";

export function getInstallationDeviceId(storage: Pick<Storage, "getItem" | "setItem">) {
  try {
    const existing = storage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
  } catch {
    // Continue with an in-memory installation identifier.
  }
  const deviceId = crypto.randomUUID();
  try { storage.setItem(DEVICE_ID_KEY, deviceId); } catch { /* Persistence is best effort. */ }
  return deviceId;
}

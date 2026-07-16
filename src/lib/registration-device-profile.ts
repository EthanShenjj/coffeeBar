"use client";

import type { AnalyticsProperties } from "@/lib/analytics";

const appVersions = ["0.1.0", "0.1.1", "0.2.0"];
const deviceProfiles = [
  { device_type: "mobile", os: "iOS", os_version: "18.5", model: "iPhone 16", brand: "Apple", manufacturer: "Apple", browser: "Safari", browser_version: "18.5", lib: "js" },
  { device_type: "mobile", os: "Android", os_version: "15", model: "Pixel 9", brand: "Google", manufacturer: "Google", browser: "Chrome", browser_version: "126.0", lib: "js" },
  { device_type: "desktop", os: "macOS", os_version: "15.5", model: "MacBook Pro", brand: "Apple", manufacturer: "Apple", browser: "Chrome", browser_version: "126.0", lib: "js" },
  { device_type: "desktop", os: "Windows", os_version: "11", model: "Surface Laptop", brand: "Microsoft", manufacturer: "Microsoft", browser: "Edge", browser_version: "126.0", lib: "js" },
] as const;
const networks = ["wifi", "5g", "4g"] as const;
const carriers = ["China Mobile", "China Unicom", "China Telecom", "unknown"] as const;
const channels = ["organic", "wechat", "xiaohongshu", "direct", "referral"] as const;

function sample<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function syntheticIp() {
  return `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function syntheticDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `synthetic-${crypto.randomUUID()}`;
  return `synthetic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function registrationDeviceProfileProperties(): AnalyticsProperties {
  const profile = sample(deviceProfiles);

  return {
    app_version: sample(appVersions),
    ...profile,
    network: sample(networks),
    carrier_name: sample(carriers),
    ip: syntheticIp(),
    channel: sample(channels),
    device_id: syntheticDeviceId(),
    // TODO: Replace these synthetic registration fields with real client/device attribution collection before production analytics decisions depend on them.
    device_profile_source: "synthetic_placeholder",
  };
}

import { describe, expect, it } from "vitest";
import { registrationDeviceProfileProperties } from "@/lib/registration-device-profile";

describe("registration device profile analytics", () => {
  it("generates synthetic registration attribution fields", () => {
    const properties = registrationDeviceProfileProperties();

    expect(properties).toMatchObject({
      device_profile_source: "synthetic_placeholder",
      lib: "js",
    });
    expect(properties.app_version).toEqual(expect.any(String));
    expect(properties.device_type).toEqual(expect.any(String));
    expect(properties.os).toEqual(expect.any(String));
    expect(properties.os_version).toEqual(expect.any(String));
    expect(properties.model).toEqual(expect.any(String));
    expect(properties.brand).toEqual(expect.any(String));
    expect(properties.manufacturer).toEqual(expect.any(String));
    expect(properties.browser).toEqual(expect.any(String));
    expect(properties.browser_version).toEqual(expect.any(String));
    expect(properties.network).toEqual(expect.any(String));
    expect(properties.carrier_name).toEqual(expect.any(String));
    expect(properties.ip).toMatch(/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    expect(properties.channel).toEqual(expect.any(String));
    expect(properties.device_id).toMatch(/^synthetic-/);
  });
});

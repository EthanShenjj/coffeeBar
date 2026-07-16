import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("auth form analytics", () => {
  it("reports regist before the automatic login created by registration", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/auth-form.tsx"), "utf8");
    const registrationBranch = source.indexOf('if (mode === "signup")');
    const registEvent = source.indexOf('trackAnalytics("regist"', registrationBranch);
    const automaticLoginEvent = source.indexOf('login_method: "signup_auto_login"');

    expect(registrationBranch).toBeGreaterThan(-1);
    expect(registEvent).toBeGreaterThan(registrationBranch);
    expect(automaticLoginEvent).toBeGreaterThan(registEvent);
    expect(source.indexOf("registrationDeviceProfileProperties()", registEvent)).toBeGreaterThan(registEvent);
  });

  it("reports email-password login separately from registration", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/auth-form.tsx"), "utf8");
    const manualLoginBranch = source.indexOf('login_method: "email_password"');

    expect(manualLoginBranch).toBeGreaterThan(-1);
    expect(source.indexOf('trackAnalytics("login"', manualLoginBranch - 150)).toBeGreaterThan(-1);
    expect(source.match(/trackAnalytics\("regist"/g)).toHaveLength(1);
  });
});

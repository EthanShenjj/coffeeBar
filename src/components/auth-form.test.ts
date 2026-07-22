import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("auth form analytics", () => {
  it("reports registration without misclassifying it as a login", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/auth-form.tsx"), "utf8");
    const registrationBranch = source.indexOf('if (mode === "signup")');
    const registerEvent = source.indexOf('trackAnalytics("register"', registrationBranch);

    expect(registrationBranch).toBeGreaterThan(-1);
    expect(registerEvent).toBeGreaterThan(registrationBranch);
    expect(source.indexOf("registrationDeviceProfileProperties()", registerEvent)).toBeGreaterThan(registerEvent);
    expect(source).not.toContain('login_method: "signup_auto_login"');
  });

  it("reports email-password login separately from registration", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/auth-form.tsx"), "utf8");
    const manualLoginBranch = source.indexOf('login_method: "email_password"');

    expect(manualLoginBranch).toBeGreaterThan(-1);
    expect(source.indexOf('trackAnalytics("login"', manualLoginBranch - 150)).toBeGreaterThan(-1);
    expect(source.match(/trackAnalytics\("register"/g)).toHaveLength(1);
    expect(source.match(/trackAnalytics\("login"/g)).toHaveLength(1);
  });
});

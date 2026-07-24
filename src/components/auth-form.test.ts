import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("auth form analytics", () => {
  it("reports registration stages as events instead of an auth_mode property", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/auth-form.tsx"), "utf8");
    const registrationBranch = source.indexOf('if (mode === "signup")');
    const registerEvent = source.indexOf('trackAnalytics("register"', registrationBranch);

    expect(registrationBranch).toBeGreaterThan(-1);
    expect(registerEvent).toBeGreaterThan(registrationBranch);
    expect(source.indexOf("registrationDeviceProfileProperties()", registerEvent)).toBeGreaterThan(registerEvent);
    expect(source).toContain('trackAnalytics("register_submitted"');
    expect(source).toContain('trackAnalytics("register_failed"');
    expect(source).not.toContain('login_method: "signup_auto_login"');
    expect(source).not.toContain('"auth_submitted"');
    expect(source).not.toContain('"auth_failed"');
    expect(source).not.toContain("auth_mode:");
  });

  it("reports login stages as events separately from registration", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/auth-form.tsx"), "utf8");
    const manualLoginBranch = source.indexOf('login_method: "email_password"');

    expect(manualLoginBranch).toBeGreaterThan(-1);
    expect(source.indexOf('trackAnalytics("login"', manualLoginBranch - 150)).toBeGreaterThan(-1);
    expect(source).toContain('trackAnalytics("login_submitted"');
    expect(source).toContain('trackAnalytics("login_failed"');
    expect(source.match(/trackAnalytics\("register"/g)).toHaveLength(1);
    expect(source.match(/trackAnalytics\("login"/g)).toHaveLength(1);
  });
});

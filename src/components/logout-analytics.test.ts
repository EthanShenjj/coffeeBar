import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("logout analytics identity", () => {
  it.each(["user-menu.tsx", "settings-form.tsx"])("resets analytics after auth sign-out in %s", (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const signOut = source.indexOf("await authClient.signOut()");
    const reset = source.indexOf("resetAnalyticsIdentity()", signOut);

    expect(signOut).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(signOut);
  });
});

import { describe, expect, it } from "vitest";
import { compareAppVersions } from "./app-version";

describe("app version comparison", () => {
  it.each([
    ["1.0.0", "1.0.0", 0],
    ["1.0.1", "1.0.0", 1],
    ["1.2.0", "1.10.0", -1],
    ["2.0.0", "1.99.99", 1],
  ])("compares %s with %s", (current, minimum, expected) => {
    expect(compareAppVersions(current, minimum)).toBe(expected);
  });

  it("treats an invalid bundled version as older than a valid minimum", () => {
    expect(compareAppVersions("dev", "1.0.0")).toBe(-1);
  });
});

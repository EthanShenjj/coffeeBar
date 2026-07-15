import { describe, expect, it } from "vitest";
import { getMemberLevel, LEVEL_THRESHOLDS } from "@/lib/levels";

describe("member levels", () => {
  it.each(LEVEL_THRESHOLDS.map((threshold, index) => [threshold, index + 1]))("maps %i cents to L%i", (amount, level) => { expect(getMemberLevel(amount).level).toBe(level); });
  it("stays below the next threshold", () => { expect(getMemberLevel(29_999).level).toBe(2); });
  it("caps progress at level 8", () => { expect(getMemberLevel(999_999).progress).toBe(100); });
});

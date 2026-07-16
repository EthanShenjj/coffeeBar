import { describe, expect, it } from "vitest";
import { createPickupWindow, pickupSlotsForWindow } from "@/components/pickup-time-picker";

describe("pickup time picker", () => {
  it("starts at opening time before the store opens", () => {
    const window = createPickupWindow(new Date(2026, 6, 16, 9, 0));
    expect(window.defaultValue).toBe("2026-07-16T10:00");
  });

  it("rounds the first available time up to the next half hour", () => {
    const window = createPickupWindow(new Date(2026, 6, 16, 10, 10));
    expect(window.defaultValue).toBe("2026-07-16T10:30");
  });

  it("moves pickup to the next opening after closing", () => {
    const window = createPickupWindow(new Date(2026, 6, 16, 23, 9));
    expect(window.defaultValue).toBe("2026-07-17T10:00");
  });

  it("only creates slots inside store hours and the requested window", () => {
    const slots = pickupSlotsForWindow("2026-07-16T21:15", "2026-07-17T10:15");
    expect(slots).toEqual(["2026-07-16T21:30", "2026-07-17T10:00"]);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(), hasDatabase: vi.fn(() => false) }));

import { getAnnouncements } from "@/lib/dashboard";

describe("getAnnouncements", () => {
  it("keeps demo announcement dates in the web presentation format", async () => {
    await expect(getAnnouncements()).resolves.toMatchObject([
      { id: "a1", date: "07.12" },
      { id: "a2", date: "07.08" },
      { id: "a3", date: "06.28" },
    ]);
  });
});

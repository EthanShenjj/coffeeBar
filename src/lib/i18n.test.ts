import { describe, expect, it } from "vitest";
import { normalizeLocale, translate } from "@/lib/i18n";

describe("i18n", () => {
  it("defaults to Chinese when no supported locale is stored", () => {
    expect(normalizeLocale(undefined)).toBe("zh");
    expect(normalizeLocale("fr")).toBe("zh");
  });

  it("restores English when it is stored", () => {
    expect(normalizeLocale("en")).toBe("en");
  });

  it("translates text and interpolates values", () => {
    expect(translate("en", "{count} 条未读", { count: 3 })).toBe("3 unread");
    expect(translate("zh", "{count} 条未读", { count: 3 })).toBe("3 条未读");
  });

  it("keeps unknown content unchanged", () => {
    expect(translate("en", "CoffeeBar")).toBe("CoffeeBar");
  });
});

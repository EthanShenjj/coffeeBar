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

  it.each([
    "购物卡",
    "购物卡余额",
    "选择充值金额",
    "确认充值",
    "充值成功",
    "使用购物卡",
    "购物卡支付",
    "模拟付费",
    "余额明细",
  ])("translates gift card copy: %s", (key) => {
    expect(translate("en", key)).not.toBe(key);
  });
});

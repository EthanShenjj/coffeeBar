import { expect, test } from "@playwright/test";

test("mobile menu, cart and direct checkout flow", async ({ page }) => {
  await page.goto("/menu");
  await expect(page.getByRole("heading", { name: /今天.*想喝哪一杯/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "意式咖啡", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /经典美式/ }).click();
  const productDialog = page.getByRole("dialog");
  await expect(productDialog).toBeVisible();
  await productDialog.getByRole("button", { name: /加入购物车/ }).click();
  await page.getByLabel("购物车").click();
  await expect(page.getByText("点单购物车")).toBeVisible();
  await page.getByRole("link", { name: "去结算" }).click();
  await expect(page.getByText("门店自取")).toBeVisible();
  const giftCardOption = page.getByRole("checkbox", { name: /使用购物卡.*¥0/ });
  await expect(giftCardOption).toBeVisible();
  await expect(giftCardOption).toBeDisabled();
});

test("gift card account requires login", async ({ page }) => {
  await page.goto("/profile/gift-card");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile%2Fgift-card/);
});

test("shop cart stays separate", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByText("把咖啡日常")).toBeVisible();
  await expect(async () => {
    await page.getByRole("button", { name: /黑白陶瓷马克杯/ }).click();
    await expect(page.getByRole("button", { name: /加入购物车/ })).toBeVisible();
  }).toPass();
  await page.getByRole("button", { name: /加入购物车/ }).click();
  await page.getByLabel("购物车").click();
  await expect(page.getByText("商店购物车")).toBeVisible();
});

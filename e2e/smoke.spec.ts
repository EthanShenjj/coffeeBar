import { expect, test } from "@playwright/test";

test("mobile menu, cart and direct checkout flow", async ({ page }) => {
  await page.goto("/menu");
  await expect(page.getByText("Good coffee.")).toBeVisible();
  await expect(page.getByRole("button", { name: "美式", exact: true })).toHaveClass(/bg-black/);
  await expect(page.getByRole("button", { name: /经典美式/ })).toBeVisible();
  await expect(async () => {
    await page.getByRole("button", { name: "奶咖", exact: true }).click();
    await expect(page.getByRole("button", { name: /黑白拿铁/ })).toBeVisible();
  }).toPass();
  await page.getByRole("button", { name: /黑白拿铁/ }).click();
  await page.getByRole("button", { name: /加入购物车/ }).click();
  await page.getByLabel("购物车").click();
  await expect(page.getByText("点单购物车")).toBeVisible();
  await page.getByRole("link", { name: "去结算" }).click();
  await expect(page.getByText("门店自取")).toBeVisible();
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

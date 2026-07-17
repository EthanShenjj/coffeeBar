import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("customer deletion cascade", () => {
  it("cascades every direct user-owned relation and all order children", async () => {
    const schema = await readFile(path.resolve("prisma/schema.prisma"), "utf8");
    const migration = await readFile(
      path.resolve("prisma/migrations/20260717120000_enable_user_deletion/migration.sql"),
      "utf8",
    );

    const directUserCascadeModels = ["Session", "Account", "UserProfile", "Cart", "Order", "GiftCardAccount", "MessageReceipt"];
    for (const model of directUserCascadeModels) {
      const modelBlock = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`))?.[0];
      expect(modelBlock, `${model} must cascade on user deletion`).toMatch(
        /user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/,
      );
    }
    for (const model of ["CartItem", "OrderItem", "Payment", "GiftCardTransaction"]) {
      const modelBlock = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`))?.[0];
      expect(modelBlock, `${model} must be removed through its owning parent`).toContain("onDelete: Cascade");
    }
    expect(migration).toContain('DROP CONSTRAINT "Order_userId_fkey"');
    expect(migration).toContain('ON DELETE CASCADE ON UPDATE CASCADE');
  });
});

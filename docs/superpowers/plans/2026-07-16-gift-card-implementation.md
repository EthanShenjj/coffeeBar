# CoffeeBar Gift Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent simulated gift-card recharge flow with fixed denominations, optional gift-card checkout, and automatic mixed payment when the balance is insufficient.

**Architecture:** Add a one-per-user `GiftCardAccount`, an append-only `GiftCardTransaction` ledger, and split fields on the existing one-per-order `Payment`. Keep all payment allocation in pure domain helpers, perform balance mutation inside the existing order transaction with a conditional atomic update, and let the UI display only server-authoritative balances and final splits.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7/PostgreSQL, Zod 4, Vitest 4, Playwright, Tailwind CSS.

---

## File map

- Create `src/lib/gift-card.ts`: fixed denominations and pure payment-split calculation.
- Create `src/lib/gift-card.test.ts`: domain-rule regression tests.
- Modify `src/lib/validation.ts`: checkout opt-in and recharge request schemas.
- Modify `src/lib/validation.test.ts`: validation coverage for the new inputs.
- Modify `prisma/schema.prisma`: wallet, ledger, order relation, and payment split fields.
- Create `prisma/migrations/20260716110000_add_gift_cards/migration.sql`: forward-only PostgreSQL migration and historical payment backfill.
- Regenerate `src/generated/prisma/**`: generated client for the new schema.
- Create `src/lib/gift-card-service.ts`: transaction-scoped credit and conditional debit operations.
- Create `src/lib/gift-card-service.test.ts`: idempotency and atomic-debit unit tests with a narrow fake transaction client.
- Create `src/lib/gift-card-data.ts`: authenticated balance and recent-ledger read model.
- Create `src/actions/gift-card.ts`: simulated recharge server action.
- Create `src/components/gift-card-panel.tsx`: fixed-amount selector and recharge confirmation.
- Create `src/app/profile/gift-card/page.tsx`: protected balance/recharge/ledger page.
- Modify `src/lib/dashboard.ts`: expose gift-card balance on the profile dashboard.
- Modify `src/app/profile/page.tsx`: show the gift-card card and entry point.
- Modify `src/actions/checkout.ts`: reserve gift-card balance and persist the authoritative payment split in the order transaction.
- Modify `src/lib/types.ts`: add `useGiftCard` to checkout input.
- Modify `src/app/checkout/page.tsx`: load gift-card summary server-side.
- Modify `src/components/checkout-view.tsx`: manual opt-in, live split, and success navigation fields.
- Modify `src/app/payment/success/page.tsx`: render gift-card and simulated-payment amounts.
- Modify `src/lib/i18n.ts`: complete Chinese-to-English strings for the new flow.
- Modify `e2e/smoke.spec.ts`: no-database and protected-route smoke coverage.

### Task 1: Lock down denominations, payment allocation, and input validation

**Files:**
- Create: `src/lib/gift-card.ts`
- Create: `src/lib/gift-card.test.ts`
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/validation.test.ts`

- [ ] **Step 1: Write failing domain tests**

Create `src/lib/gift-card.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GIFT_CARD_RECHARGE_AMOUNTS, calculatePaymentSplit } from "@/lib/gift-card";

describe("gift card domain rules", () => {
  it("offers only the four fixed recharge amounts in cents", () => {
    expect(GIFT_CARD_RECHARGE_AMOUNTS).toEqual([10_000, 20_000, 30_000, 50_000]);
  });

  it("uses simulated payment when gift card is not selected", () => {
    expect(calculatePaymentSplit(12_800, 50_000, false)).toEqual({
      giftCardAmount: 0,
      externalAmount: 12_800,
    });
  });

  it("uses the gift card for the full order when balance is sufficient", () => {
    expect(calculatePaymentSplit(12_800, 20_000, true)).toEqual({
      giftCardAmount: 12_800,
      externalAmount: 0,
    });
  });

  it("uses all available balance and simulates the remainder", () => {
    expect(calculatePaymentSplit(12_800, 10_000, true)).toEqual({
      giftCardAmount: 10_000,
      externalAmount: 2_800,
    });
  });

  it("does not create a negative split for an empty balance", () => {
    expect(calculatePaymentSplit(12_800, 0, true)).toEqual({
      giftCardAmount: 0,
      externalAmount: 12_800,
    });
  });
});
```

- [ ] **Step 2: Extend validation tests before implementation**

Update imports and add these cases in `src/lib/validation.test.ts`:

```ts
import { checkoutSchema, giftCardRechargeSchema } from "@/lib/validation";

it("defaults checkout to not using a gift card", () => {
  const parsed = checkoutSchema.parse(valid);
  expect(parsed.useGiftCard).toBe(false);
});

describe("gift card recharge validation", () => {
  const token = "a6236aeb-4e08-44f4-b9d4-c927219563af";

  it.each([10_000, 20_000, 30_000, 50_000])("accepts %i cents", (amount) => {
    expect(giftCardRechargeSchema.safeParse({ token, amount }).success).toBe(true);
  });

  it.each([0, 9_999, 15_000, 50_001])("rejects unsupported amount %i", (amount) => {
    expect(giftCardRechargeSchema.safeParse({ token, amount }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run: `npm test -- src/lib/gift-card.test.ts src/lib/validation.test.ts`

Expected: FAIL because `@/lib/gift-card`, `giftCardRechargeSchema`, and the parsed `useGiftCard` field do not exist.

- [ ] **Step 4: Implement the minimal domain module**

Create `src/lib/gift-card.ts`:

```ts
export const GIFT_CARD_RECHARGE_AMOUNTS = [10_000, 20_000, 30_000, 50_000] as const;

export type PaymentSplit = {
  giftCardAmount: number;
  externalAmount: number;
};

export function calculatePaymentSplit(
  totalAmount: number,
  balance: number,
  useGiftCard: boolean,
): PaymentSplit {
  const giftCardAmount = useGiftCard
    ? Math.min(Math.max(balance, 0), Math.max(totalAmount, 0))
    : 0;
  return {
    giftCardAmount,
    externalAmount: Math.max(totalAmount - giftCardAmount, 0),
  };
}
```

Modify `src/lib/validation.ts`:

```ts
import { GIFT_CARD_RECHARGE_AMOUNTS } from "@/lib/gift-card";

const rechargeAmountSchema = z.number().int().refine(
  (amount) => GIFT_CARD_RECHARGE_AMOUNTS.some((allowed) => allowed === amount),
  "请选择有效的充值金额",
);

export const giftCardRechargeSchema = z.object({
  token: z.string().uuid(),
  amount: rechargeAmountSchema,
});

export const checkoutSchema = z.object({
  token: z.string().uuid(),
  kind: z.enum(["MENU", "SHOP"]),
  pickupName: z.string().trim().min(2).max(40),
  pickupPhone: z.string().regex(/^1\d{10}$/, "请输入 11 位手机号"),
  pickupAt: z.string().datetime(),
  note: z.string().trim().max(200).optional(),
  useGiftCard: z.boolean().default(false),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(20),
    optionIds: z.array(z.string()).max(8),
  })).min(1).max(30),
});
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `npm test -- src/lib/gift-card.test.ts src/lib/validation.test.ts`

Expected: both test files pass with no warnings.

- [ ] **Step 6: Commit the domain rules**

```bash
git add src/lib/gift-card.ts src/lib/gift-card.test.ts src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: define gift card payment rules"
```

### Task 2: Add the wallet, ledger, and payment-split schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260716110000_add_gift_cards/migration.sql`
- Regenerate: `src/generated/prisma/**`

- [ ] **Step 1: Add the Prisma enum, relations, models, and split fields**

Add this enum to `prisma/schema.prisma`:

```prisma
enum GiftCardTransactionType {
  RECHARGE
  PURCHASE
}
```

Add `giftCardAccount GiftCardAccount?` to `User`, add `giftCardTransaction GiftCardTransaction?` to `Order`, replace the `Payment` model, and append the two gift-card models:

```prisma
model Payment {
  id             String        @id @default(cuid())
  orderId        String        @unique
  amount         Int
  giftCardAmount Int           @default(0)
  externalAmount Int
  status         PaymentStatus @default(SUCCEEDED)
  providerRef    String?       @unique
  paidAt         DateTime      @default(now())
  order          Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
}

model GiftCardAccount {
  id           String                @id @default(cuid())
  userId       String                @unique
  balance      Int                   @default(0)
  createdAt    DateTime              @default(now())
  updatedAt    DateTime              @updatedAt
  user         User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions GiftCardTransaction[]
}

model GiftCardTransaction {
  id        String                  @id @default(cuid())
  accountId String
  type      GiftCardTransactionType
  amount    Int
  reference String                  @unique
  orderId   String?                 @unique
  createdAt DateTime                @default(now())
  account   GiftCardAccount         @relation(fields: [accountId], references: [id], onDelete: Cascade)
  order     Order?                  @relation(fields: [orderId], references: [id], onDelete: SetNull)

  @@index([accountId, createdAt])
}
```

- [ ] **Step 2: Write the forward migration**

Create `prisma/migrations/20260716110000_add_gift_cards/migration.sql`:

```sql
CREATE TYPE "GiftCardTransactionType" AS ENUM ('RECHARGE', 'PURCHASE');

ALTER TABLE "Payment"
  ADD COLUMN "giftCardAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "externalAmount" INTEGER;

UPDATE "Payment" SET "externalAmount" = "amount";

ALTER TABLE "Payment"
  ALTER COLUMN "externalAmount" SET NOT NULL,
  ALTER COLUMN "providerRef" DROP NOT NULL;

CREATE TABLE "GiftCardAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiftCardAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GiftCardTransaction" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "type" "GiftCardTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "reference" TEXT NOT NULL,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GiftCardAccount_userId_key" ON "GiftCardAccount"("userId");
CREATE UNIQUE INDEX "GiftCardTransaction_reference_key" ON "GiftCardTransaction"("reference");
CREATE UNIQUE INDEX "GiftCardTransaction_orderId_key" ON "GiftCardTransaction"("orderId");
CREATE INDEX "GiftCardTransaction_accountId_createdAt_idx" ON "GiftCardTransaction"("accountId", "createdAt");

ALTER TABLE "GiftCardAccount"
  ADD CONSTRAINT "GiftCardAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GiftCardTransaction"
  ADD CONSTRAINT "GiftCardTransaction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "GiftCardAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GiftCardTransaction"
  ADD CONSTRAINT "GiftCardTransaction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Validate the schema before generation**

Run: `npx prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npm run db:generate`

Expected: Prisma Client generation exits 0 and generated models include `GiftCardAccount` and `GiftCardTransaction`.

- [ ] **Step 5: Verify the generated surface**

Run: `rg -n "GiftCardAccount|GiftCardTransaction|giftCardAmount|externalAmount" src/generated/prisma | head -40`

Expected: generated model, enum, relation, and payment fields are present.

- [ ] **Step 6: Commit the schema and generated client**

```bash
git add prisma/schema.prisma prisma/migrations/20260716110000_add_gift_cards src/generated/prisma
git commit -m "feat: add gift card account ledger schema"
```

### Task 3: Implement idempotent recharge and the balance read model

**Files:**
- Create: `src/lib/gift-card-service.ts`
- Create: `src/lib/gift-card-service.test.ts`
- Create: `src/lib/gift-card-data.ts`
- Create: `src/actions/gift-card.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/lib/gift-card-service.test.ts` with a fake transaction object and these cases:

```ts
import { describe, expect, it, vi } from "vitest";
import { creditGiftCard } from "@/lib/gift-card-service";

function fakeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    giftCardTransaction: {
      findUnique: vi.fn().mockResolvedValue(null),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "txn-1" }),
    },
    giftCardAccount: {
      upsert: vi.fn().mockResolvedValue({ id: "card-1", userId: "user-1", balance: 2_000 }),
      update: vi.fn().mockResolvedValue({ id: "card-1", balance: 12_000 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides,
  };
}

describe("creditGiftCard", () => {
  it("increments the account and appends a positive recharge entry", async () => {
    const tx = fakeTransaction();
    const result = await creditGiftCard(tx as never, {
      userId: "user-1",
      amount: 10_000,
      reference: "RECHARGE:token-1",
    });

    expect(tx.giftCardAccount.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { balance: { increment: 10_000 } },
    });
    expect(tx.giftCardTransaction.createMany).toHaveBeenCalledWith({
      data: [{
        accountId: "card-1",
        type: "RECHARGE",
        amount: 10_000,
        reference: "RECHARGE:token-1",
      }],
      skipDuplicates: true,
    });
    expect(result).toEqual({ balance: 12_000, duplicate: false });
  });

  it("returns an existing recharge without incrementing twice", async () => {
    const tx = fakeTransaction({
      giftCardTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: "txn-existing",
          type: "RECHARGE",
          account: { userId: "user-1", balance: 12_000 },
        }),
        createMany: vi.fn(),
        create: vi.fn(),
      },
    });

    const result = await creditGiftCard(tx as never, {
      userId: "user-1",
      amount: 10_000,
      reference: "RECHARGE:token-1",
    });

    expect(tx.giftCardAccount.update).not.toHaveBeenCalled();
    expect(result).toEqual({ balance: 12_000, duplicate: true });
  });
});
```

- [ ] **Step 2: Run the service test and verify RED**

Run: `npm test -- src/lib/gift-card-service.test.ts`

Expected: FAIL because `creditGiftCard` does not exist.

- [ ] **Step 3: Implement the transaction-scoped recharge service**

Create `src/lib/gift-card-service.ts`:

```ts
import type { Prisma } from "@/generated/prisma/client";

export async function creditGiftCard(
  tx: Prisma.TransactionClient,
  input: { userId: string; amount: number; reference: string },
) {
  const existing = await tx.giftCardTransaction.findUnique({
    where: { reference: input.reference },
    include: { account: { select: { userId: true, balance: true } } },
  });
  if (existing) {
    if (existing.type !== "RECHARGE" || existing.account.userId !== input.userId) {
      throw new Error("充值令牌不可用");
    }
    return { balance: existing.account.balance, transactionId: existing.id, duplicate: true };
  }

  const account = await tx.giftCardAccount.upsert({
    where: { userId: input.userId },
    update: {},
    create: { userId: input.userId },
  });
  const inserted = await tx.giftCardTransaction.createMany({
    data: [{
      accountId: account.id,
      type: "RECHARGE",
      amount: input.amount,
      reference: input.reference,
    }],
    skipDuplicates: true,
  });
  if (inserted.count === 0) {
    const duplicate = await tx.giftCardTransaction.findUnique({
      where: { reference: input.reference },
      include: { account: { select: { userId: true, balance: true } } },
    });
    if (!duplicate || duplicate.type !== "RECHARGE" || duplicate.account.userId !== input.userId) {
      throw new Error("充值令牌不可用");
    }
    return { balance: duplicate.account.balance, duplicate: true };
  }
  const updated = await tx.giftCardAccount.update({
    where: { id: account.id },
    data: { balance: { increment: input.amount } },
  });
  return { balance: updated.balance, duplicate: false };
}
```

- [ ] **Step 4: Run the service test and verify GREEN**

Run: `npm test -- src/lib/gift-card-service.test.ts`

Expected: recharge tests pass.

- [ ] **Step 5: Implement the authenticated read model**

Create `src/lib/gift-card-data.ts`:

```ts
import { getSession } from "@/lib/auth";
import { getDb, hasDatabase } from "@/lib/db";

export async function getGiftCardSummary(limit = 20) {
  const session = await getSession();
  if (!session || !hasDatabase()) {
    return { balance: 0, transactions: [], persistent: false };
  }
  const account = await getDb().giftCardAccount.findUnique({
    where: { userId: session.user.id },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, type: true, amount: true, createdAt: true, order: { select: { orderNumber: true } } },
      },
    },
  });
  return {
    balance: account?.balance ?? 0,
    transactions: account?.transactions ?? [],
    persistent: true,
  };
}
```

- [ ] **Step 6: Implement the simulated recharge action**

Create `src/actions/gift-card.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getDb, hasDatabase } from "@/lib/db";
import { creditGiftCard } from "@/lib/gift-card-service";
import { giftCardRechargeSchema } from "@/lib/validation";

export type GiftCardRechargeResult =
  | { ok: true; balance: number }
  | { ok: false; message: string };

export async function rechargeGiftCard(raw: unknown): Promise<GiftCardRechargeResult> {
  const parsed = giftCardRechargeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "请选择有效的充值金额" };
  if (!hasDatabase()) return { ok: false, message: "购物卡充值需要配置数据库" };

  try {
    const user = await requireUser();
    const result = await getDb().$transaction((tx) => creditGiftCard(tx, {
      userId: user.id,
      amount: parsed.data.amount,
      reference: `RECHARGE:${parsed.data.token}`,
    }));
    revalidatePath("/profile");
    revalidatePath("/profile/gift-card");
    revalidatePath("/checkout");
    return { ok: true, balance: result.balance };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "充值失败，请稍后重试" };
  }
}
```

- [ ] **Step 7: Run focused and full unit tests**

Run: `npm test -- src/lib/gift-card-service.test.ts src/lib/gift-card.test.ts src/lib/validation.test.ts`

Expected: all focused tests pass.

- [ ] **Step 8: Commit the recharge service**

```bash
git add src/lib/gift-card-service.ts src/lib/gift-card-service.test.ts src/lib/gift-card-data.ts src/actions/gift-card.ts
git commit -m "feat: add simulated gift card recharge service"
```

### Task 4: Add the shopping-card account page and profile entry

**Files:**
- Create: `src/components/gift-card-panel.tsx`
- Create: `src/app/profile/gift-card/page.tsx`
- Modify: `src/lib/dashboard.ts`
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Implement the client recharge panel**

Create `src/components/gift-card-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rechargeGiftCard } from "@/actions/gift-card";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GIFT_CARD_RECHARGE_AMOUNTS } from "@/lib/gift-card";
import { formatMoney } from "@/lib/utils";

export function GiftCardPanel({ balance, persistent }: { balance: number; persistent: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function choose(amount: number) {
    setSelected(amount);
    setToken(crypto.randomUUID());
  }

  async function confirmRecharge() {
    if (selected === null || token === null) return;
    setPending(true);
    const result = await rechargeGiftCard({ amount: selected, token });
    setPending(false);
    if (!result.ok) return toast.error(t(result.message));
    toast.success(t("充值成功"));
    setSelected(null);
    setToken(null);
    router.refresh();
  }

  return <>
    <section className="overflow-hidden rounded-[2rem] bg-black p-7 text-white md:p-9">
      <p className="text-xs uppercase tracking-[.22em] text-white/45">CoffeeBar gift card</p>
      <p className="mt-6 text-sm text-white/55">{t("购物卡余额")}</p>
      <p className="mt-2 font-mono text-4xl font-semibold">{formatMoney(balance)}</p>
      {!persistent && <p className="mt-4 text-xs text-amber-200">{t("配置数据库后可使用购物卡")}</p>}
    </section>
    <section className="mt-5 rounded-[1.5rem] border bg-white p-6">
      <h2 className="font-semibold">{t("选择充值金额")}</h2>
      <p className="mt-1 text-xs text-zinc-400">{t("模拟充值，不会产生真实扣款")}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {GIFT_CARD_RECHARGE_AMOUNTS.map((amount) => <button
          type="button"
          key={amount}
          onClick={() => choose(amount)}
          className="min-h-20 rounded-2xl border bg-white font-mono text-xl font-semibold hover:border-black"
        >{formatMoney(amount)}</button>)}
      </div>
    </section>
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent>
        <DialogTitle className="text-2xl font-semibold">{t("确认充值")}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-zinc-500">{t("确认后金额将立即存入购物卡。")}</DialogDescription>
        <p className="my-7 text-center font-mono text-4xl font-semibold">{formatMoney(selected ?? 0)}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setSelected(null)}>{t("再想想")}</Button>
          <Button onClick={confirmRecharge} disabled={pending || !persistent}>{pending ? t("处理中…") : t("确认充值")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
```

- [ ] **Step 2: Implement the protected gift-card page and ledger list**

Create `src/app/profile/gift-card/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { GiftCardPanel } from "@/components/gift-card-panel";
import { SubpageHeader } from "@/components/subpage-header";
import { getSession } from "@/lib/auth";
import { getGiftCardSummary } from "@/lib/gift-card-data";
import { getLocale, getTranslator } from "@/lib/i18n-server";
import { formatMoney } from "@/lib/utils";

export default async function GiftCardPage() {
  const [session, summary, t, locale] = await Promise.all([
    getSession(), getGiftCardSummary(), getTranslator(), getLocale(),
  ]);
  if (!session) redirect("/login?next=%2Fprofile%2Fgift-card");
  return <AppFrame>
    <SubpageHeader back="/profile" title={t("购物卡")} width="max-w-2xl" />
    <main className="mx-auto max-w-2xl px-5 py-8">
      <GiftCardPanel balance={summary.balance} persistent={summary.persistent} />
      <section className="mt-5 rounded-[1.5rem] border bg-white p-6">
        <h2 className="font-semibold">{t("余额明细")}</h2>
        {summary.transactions.length === 0 && <p className="mt-5 text-sm text-zinc-400">{t("还没有购物卡记录")}</p>}
        <div className="mt-3 divide-y">
          {summary.transactions.map((item) => <div key={item.id} className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium">{t(item.type === "RECHARGE" ? "购物卡充值" : "订单消费")}</p>
              <p className="mt-1 text-xs text-zinc-400">{item.order?.orderNumber ?? item.createdAt.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</p>
            </div>
            <span className={`font-mono font-semibold ${item.amount > 0 ? "text-emerald-600" : "text-black"}`}>{item.amount > 0 ? "+" : ""}{formatMoney(item.amount)}</span>
          </div>)}
        </div>
      </section>
    </main>
  </AppFrame>;
}
```

- [ ] **Step 3: Add the balance to the profile read model**

In the demo branch of `getProfileDashboard`, add `giftCardBalance: 0`. In the database branch, query the account alongside orders:

```ts
const [orders, giftCardAccount] = await Promise.all([
  db.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { totalAmount: true, paidAt: true, kind: true, items: { select: { category: true } } },
  }),
  db.giftCardAccount.findUnique({ where: { userId: session.user.id }, select: { balance: true } }),
]);
```

Return `giftCardBalance: giftCardAccount?.balance ?? 0` with the existing dashboard fields.

- [ ] **Step 4: Add the profile gift-card entry**

In `src/app/profile/page.tsx`, import `CreditCard`, and add this card immediately after the black member overview:

```tsx
<Link href="/profile/gift-card" className="mt-5 flex items-center gap-4 rounded-[1.5rem] border bg-white p-5 hover:bg-zinc-50">
  <div className="flex size-11 items-center justify-center rounded-full bg-black text-white"><CreditCard className="size-4" /></div>
  <div className="flex-1">
    <p className="text-xs text-zinc-500">{t("购物卡余额")}</p>
    <p className="mt-1 font-mono text-xl font-semibold">{formatMoney(data.giftCardBalance)}</p>
  </div>
  <span className="text-sm font-medium">{t("充值")}</span>
  <ChevronRight className="size-4 text-zinc-300" />
</Link>
```

- [ ] **Step 5: Typecheck the account page slice**

Run: `npm run typecheck`

Expected: exit 0 after the Task 7 translations are added; before Task 7, missing translation keys are still accepted because `t` takes strings.

- [ ] **Step 6: Commit the account experience**

```bash
git add src/components/gift-card-panel.tsx src/app/profile/gift-card/page.tsx src/lib/dashboard.ts src/app/profile/page.tsx
git commit -m "feat: add gift card recharge experience"
```

### Task 5: Make checkout reserve and audit gift-card payment atomically

**Files:**
- Modify: `src/lib/gift-card-service.test.ts`
- Modify: `src/lib/gift-card-service.ts`
- Modify: `src/actions/checkout.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add failing conditional-debit tests**

Replace the existing service import, then append the new `describe` block in `src/lib/gift-card-service.test.ts`:

```ts
import { creditGiftCard, reserveGiftCardPayment } from "@/lib/gift-card-service";

describe("reserveGiftCardPayment", () => {
  it("does not touch the account when gift card is not selected", async () => {
    const tx = fakeTransaction();
    await expect(reserveGiftCardPayment(tx as never, { userId: "user-1", totalAmount: 12_800, useGiftCard: false }))
      .resolves.toEqual({ giftCardAmount: 0, externalAmount: 12_800, accountId: null });
    expect(tx.giftCardAccount.upsert).not.toHaveBeenCalled();
  });

  it("conditionally decrements all available balance for a mixed payment", async () => {
    const tx = fakeTransaction();
    tx.giftCardAccount.upsert.mockResolvedValue({ id: "card-1", userId: "user-1", balance: 10_000 });
    tx.giftCardAccount.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await expect(reserveGiftCardPayment(tx as never, { userId: "user-1", totalAmount: 12_800, useGiftCard: true }))
      .resolves.toEqual({ giftCardAmount: 10_000, externalAmount: 2_800, accountId: "card-1" });
    expect(tx.giftCardAccount.updateMany).toHaveBeenCalledWith({
      where: { id: "card-1", balance: { gte: 10_000 } },
      data: { balance: { decrement: 10_000 } },
    });
  });

  it("fails when a concurrent payment changed the balance", async () => {
    const tx = fakeTransaction();
    tx.giftCardAccount.upsert.mockResolvedValue({ id: "card-1", userId: "user-1", balance: 10_000 });
    tx.giftCardAccount.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    await expect(reserveGiftCardPayment(tx as never, { userId: "user-1", totalAmount: 12_800, useGiftCard: true }))
      .rejects.toThrow("购物卡余额已变化，请重试支付");
  });
});
```

- [ ] **Step 2: Run the new debit tests and verify RED**

Run: `npm test -- src/lib/gift-card-service.test.ts`

Expected: FAIL because `reserveGiftCardPayment` is not exported from `src/lib/gift-card-service.ts`.

- [ ] **Step 3: Implement the conditional debit**

Add this import and implementation to `src/lib/gift-card-service.ts`:

```ts
import { calculatePaymentSplit, type PaymentSplit } from "@/lib/gift-card";

export type ReservedGiftCardPayment = PaymentSplit & { accountId: string | null };

export async function reserveGiftCardPayment(
  tx: Prisma.TransactionClient,
  input: { userId: string; totalAmount: number; useGiftCard: boolean },
): Promise<ReservedGiftCardPayment> {
  if (!input.useGiftCard) {
    return { ...calculatePaymentSplit(input.totalAmount, 0, false), accountId: null };
  }
  const account = await tx.giftCardAccount.upsert({
    where: { userId: input.userId },
    update: {},
    create: { userId: input.userId },
  });
  const split = calculatePaymentSplit(input.totalAmount, account.balance, true);
  if (split.giftCardAmount === 0) return { ...split, accountId: account.id };

  const updated = await tx.giftCardAccount.updateMany({
    where: { id: account.id, balance: { gte: split.giftCardAmount } },
    data: { balance: { decrement: split.giftCardAmount } },
  });
  if (updated.count !== 1) throw new Error("购物卡余额已变化，请重试支付");
  return { ...split, accountId: account.id };
}
```

- [ ] **Step 4: Verify the debit tests are GREEN**

Run: `npm test -- src/lib/gift-card-service.test.ts`

Expected: recharge, opt-out, mixed-payment, and concurrent-change tests all pass.

- [ ] **Step 5: Extend checkout types and the server result**

Add `useGiftCard: boolean` to `CheckoutInput` in `src/lib/types.ts`.

In `src/actions/checkout.ts`, import `reserveGiftCardPayment`, extend `CheckoutResult`, and include the existing payment on idempotent lookup:

```ts
export type CheckoutResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      totalAmount: number;
      giftCardAmount: number;
      externalAmount: number;
      demo: boolean;
    }
  | { ok: false; message: string };

const existing = await db.order.findUnique({
  where: { checkoutToken: input.token },
  include: { payment: true },
});
if (existing) {
  if (existing.userId !== user.id) return { ok: false, message: "结算令牌不可用" };
  return {
    ok: true,
    orderId: existing.id,
    orderNumber: existing.orderNumber,
    totalAmount: existing.totalAmount,
    giftCardAmount: existing.payment?.giftCardAmount ?? 0,
    externalAmount: existing.payment?.externalAmount ?? existing.totalAmount,
    demo: false,
  };
}
```

In the no-database branch, reject `useGiftCard: true`; otherwise return the existing demo order with `giftCardAmount: 0` and `externalAmount: total`.

- [ ] **Step 6: Reserve balance inside the existing order transaction**

After stock checks and before `tx.order.create`, add:

```ts
const split = await reserveGiftCardPayment(tx, {
  userId: user.id,
  totalAmount,
  useGiftCard: input.useGiftCard,
});
```

Replace the nested payment data with:

```ts
payment: {
  create: {
    amount: totalAmount,
    giftCardAmount: split.giftCardAmount,
    externalAmount: split.externalAmount,
    providerRef: split.externalAmount > 0 ? `SIM-${input.token}` : null,
    paidAt: now,
  },
},
```

After creating the order and before returning from the same transaction, append the debit ledger when needed:

```ts
if (split.giftCardAmount > 0 && split.accountId) {
  await tx.giftCardTransaction.create({
    data: {
      accountId: split.accountId,
      type: "PURCHASE",
      amount: -split.giftCardAmount,
      reference: `PURCHASE:${input.token}`,
      orderId: order.id,
    },
  });
}
return { order, split };
```

Return `giftCardAmount` and `externalAmount` from the transaction result. Add `revalidatePath("/profile/gift-card")` and `revalidatePath("/checkout")` with the existing revalidation calls.

- [ ] **Step 7: Run domain, service, validation, and type checks**

Run: `npm test -- src/lib/gift-card.test.ts src/lib/gift-card-service.test.ts src/lib/validation.test.ts && npm run typecheck`

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 8: Commit atomic mixed payment**

```bash
git add src/lib/gift-card-service.ts src/lib/gift-card-service.test.ts src/actions/checkout.ts src/lib/types.ts
git commit -m "feat: support atomic gift card mixed payments"
```

### Task 6: Add manual gift-card selection and authoritative split display

**Files:**
- Modify: `src/app/checkout/page.tsx`
- Modify: `src/components/checkout-view.tsx`
- Modify: `src/app/payment/success/page.tsx`

- [ ] **Step 1: Load the balance on the server checkout page**

In `src/app/checkout/page.tsx`, call `getGiftCardSummary(0)` and pass its data:

```tsx
const [params, t, giftCard] = await Promise.all([
  searchParams,
  getTranslator(),
  getGiftCardSummary(0),
]);

<CheckoutView
  kind={kind}
  direct={params.direct === "1"}
  giftCardBalance={giftCard.balance}
  giftCardPersistent={giftCard.persistent}
/>
```

- [ ] **Step 2: Add client-side opt-in and derived split**

Change the `CheckoutView` props and add state in `src/components/checkout-view.tsx`:

```tsx
export function CheckoutView({
  kind,
  direct,
  giftCardBalance,
  giftCardPersistent,
}: {
  kind: CartKind;
  direct: boolean;
  giftCardBalance: number;
  giftCardPersistent: boolean;
}) {
  const [useGiftCard, setUseGiftCard] = useState(false);
  // existing state remains
  const split = useMemo(
    () => calculatePaymentSplit(total, giftCardBalance, useGiftCard),
    [total, giftCardBalance, useGiftCard],
  );
```

Import `calculatePaymentSplit`. Add the following block under the amount due in the payment summary:

```tsx
<div className="mt-5 rounded-2xl bg-zinc-100 p-4">
  <label className="flex items-center gap-3">
    <input
      type="checkbox"
      checked={useGiftCard}
      onChange={(event) => setUseGiftCard(event.target.checked)}
      disabled={!giftCardPersistent || giftCardBalance <= 0}
      className="size-4 accent-black"
    />
    <span className="flex-1 text-sm font-medium">{t("使用购物卡")}</span>
    <span className="font-mono text-sm">{formatMoney(giftCardBalance)}</span>
  </label>
  {useGiftCard && <div className="mt-4 space-y-2 border-t pt-3 text-sm">
    <div className="flex justify-between text-zinc-500"><span>{t("购物卡支付")}</span><span>{formatMoney(split.giftCardAmount)}</span></div>
    <div className="flex justify-between text-zinc-500"><span>{t("模拟付费")}</span><span>{formatMoney(split.externalAmount)}</span></div>
  </div>}
</div>
```

- [ ] **Step 3: Submit the opt-in and navigate with server-authoritative amounts**

Include `useGiftCard` in the `confirmCheckout` payload. Replace the success navigation with:

```ts
const successParams = new URLSearchParams({
  order: result.orderNumber,
  amount: String(result.totalAmount),
  giftCard: String(result.giftCardAmount),
  external: String(result.externalAmount),
  demo: result.demo ? "1" : "0",
});
router.push(`/payment/success?${successParams.toString()}`);
```

In the confirmation dialog, render these two rows whenever `useGiftCard` is true:

```tsx
{useGiftCard && <div className="mb-7 space-y-2 text-sm">
  <div className="flex justify-between"><span className="text-zinc-500">{t("购物卡支付")}</span><span>{formatMoney(split.giftCardAmount)}</span></div>
  <div className="flex justify-between"><span className="text-zinc-500">{t("模拟付费")}</span><span>{formatMoney(split.externalAmount)}</span></div>
</div>}
```

- [ ] **Step 4: Render the final split on the success page**

Extend search params in `src/app/payment/success/page.tsx` with `giftCard?: string` and `external?: string`. Parse both as non-negative numbers and add below the total:

```tsx
{giftCardAmount > 0 && <div className="mx-auto mt-5 max-w-xs space-y-2 rounded-2xl bg-zinc-100 p-4 text-sm">
  <div className="flex justify-between"><span className="text-zinc-500">{t("购物卡支付")}</span><span>{formatMoney(giftCardAmount)}</span></div>
  <div className="flex justify-between"><span className="text-zinc-500">{t("模拟付费")}</span><span>{formatMoney(externalAmount)}</span></div>
</div>}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: exit 0 with the new props and `CheckoutResult` fields aligned end-to-end.

- [ ] **Step 6: Commit the checkout UI**

```bash
git add src/app/checkout/page.tsx src/components/checkout-view.tsx src/app/payment/success/page.tsx
git commit -m "feat: add gift card selection to checkout"
```

### Task 7: Complete bilingual copy and smoke coverage

**Files:**
- Modify: `src/lib/i18n.ts`
- Modify: `src/lib/i18n.test.ts`
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: Add a failing translation test for the new keys**

In `src/lib/i18n.test.ts`, add:

```ts
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
])("translates the gift card key %s", (key) => {
  expect(translate("en", key)).not.toBe(key);
});
```

- [ ] **Step 2: Run the translation test and verify RED**

Run: `npm test -- src/lib/i18n.test.ts`

Expected: FAIL for every new key not yet present in the English dictionary.

- [ ] **Step 3: Add all gift-card translations**

Add these entries to the `english` dictionary in `src/lib/i18n.ts`:

```ts
"购物卡": "Gift card",
"购物卡余额": "Gift card balance",
"充值": "Top up",
"选择充值金额": "Choose a top-up amount",
"模拟充值，不会产生真实扣款": "Simulated top-up—no real charge will be made",
"确认充值": "Confirm top-up",
"确认后金额将立即存入购物卡。": "The amount will be added to your gift card immediately.",
"充值成功": "Top-up complete",
"请选择有效的充值金额": "Choose a valid top-up amount",
"充值失败，请稍后重试": "Top-up failed. Try again shortly.",
"充值令牌不可用": "This top-up session is unavailable",
"购物卡充值需要配置数据库": "Connect a database to top up a gift card",
"配置数据库后可使用购物卡": "Connect a database to use a gift card",
"余额明细": "Balance activity",
"还没有购物卡记录": "No gift card activity yet",
"购物卡充值": "Gift card top-up",
"订单消费": "Order payment",
"使用购物卡": "Use gift card",
"购物卡支付": "Gift card payment",
"模拟付费": "Simulated payment",
"购物卡余额已变化，请重试支付": "Your gift card balance changed. Please try the payment again.",
```

- [ ] **Step 4: Run the translation test and verify GREEN**

Run: `npm test -- src/lib/i18n.test.ts`

Expected: all i18n tests pass.

- [ ] **Step 5: Extend no-database smoke coverage**

In the first test in `e2e/smoke.spec.ts`, after reaching checkout, add:

```ts
await expect(page.getByText("购物卡余额")).toBeVisible();
await expect(page.getByRole("checkbox", { name: "使用购物卡" })).toBeDisabled();
```

Add a protected-route test:

```ts
test("gift card account requires login", async ({ page }) => {
  await page.goto("/profile/gift-card");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile%2Fgift-card/);
});
```

- [ ] **Step 6: Commit copy and smoke coverage**

```bash
git add src/lib/i18n.ts src/lib/i18n.test.ts e2e/smoke.spec.ts
git commit -m "test: cover gift card copy and access"
```

### Task 8: Apply the migration and verify the complete flow

**Files:**
- Verify all files changed in Tasks 1–7
- Update `design-qa.md` only if the repository convention requires recording a newly found visual defect; do not add a passing-only entry.

- [ ] **Step 1: Inspect the complete diff for scope and accidental changes**

Run: `git status --short && git diff --stat 2f2d724 && git diff --check`

Expected: only the planned gift-card, checkout, schema, generated-client, translation, test, and documentation files appear; `git diff --check` prints nothing.

- [ ] **Step 2: Run Prisma verification**

Run: `npx prisma validate && npm run db:generate`

Expected: schema validation and client generation both exit 0.

- [ ] **Step 3: Apply the migration to the configured development database**

Run: `npm run db:deploy`

Expected: Prisma reports the gift-card migration applied and the database is in sync. If the checked-in migration is already applied, Prisma reports no pending schema changes.

- [ ] **Step 4: Run the complete automated verification suite**

Run: `npm test && npm run lint && npm run typecheck && npm run build`

Expected: every command exits 0; Vitest has zero failures, ESLint has zero errors, TypeScript has zero errors, and Next.js produces a successful production build.

- [ ] **Step 5: Run browser smoke tests against the production build**

Run: `npm run test:e2e`

Expected: mobile and desktop Playwright projects pass the menu/cart checkout smoke, shop isolation, checkout gift-card disabled state, and protected gift-card route redirect.

- [ ] **Step 6: Manually verify the persistent recharge and mixed-payment path**

Run: `npm run dev`

In a signed-in browser session with the configured database:

1. Open `/profile/gift-card`, recharge ¥100, and confirm balance becomes ¥100 with one positive recharge row.
2. Reload the page and confirm the balance persists.
3. Add a shop item costing more than ¥100, continue to checkout, and verify “使用购物卡” is initially unchecked.
4. Check it and verify the displayed split uses ¥100 from the gift card and the exact remainder from simulated payment.
5. Confirm payment and verify the success page shows the same split.
6. Open `/profile/gift-card` and verify the balance is ¥0 with one negative order-payment row linked to the order number.
7. Reload the checkout success URL and verify no second debit or second order is created.

Expected: the complete fixed-amount recharge → persisted balance → manual opt-in → mixed payment → ledger audit loop behaves exactly as listed.

- [ ] **Step 7: Commit any verification-only corrections, then check final status**

If verification exposed a defect, fix it with a new failing test first, stage the specific test and implementation files named by that defect, and commit only those corrections:

```bash
git commit -m "fix: harden gift card payment flow"
```

Then run: `git status --short`

Expected: no uncommitted files remain.

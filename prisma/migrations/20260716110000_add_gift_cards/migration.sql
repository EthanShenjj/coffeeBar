BEGIN;

-- CreateEnum
CREATE TYPE "GiftCardTransactionType" AS ENUM ('RECHARGE', 'PURCHASE');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "giftCardAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "externalAmount" INTEGER;

UPDATE "Payment" SET "externalAmount" = "amount";

ALTER TABLE "Payment" ALTER COLUMN "externalAmount" SET NOT NULL,
ALTER COLUMN "providerRef" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GiftCardAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCardAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardAccount_userId_key" ON "GiftCardAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardTransaction_reference_key" ON "GiftCardTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardTransaction_orderId_key" ON "GiftCardTransaction"("orderId");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_accountId_createdAt_idx" ON "GiftCardTransaction"("accountId", "createdAt");

-- AddForeignKey
ALTER TABLE "GiftCardAccount" ADD CONSTRAINT "GiftCardAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GiftCardAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

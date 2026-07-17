CREATE TYPE "PushEnvironment" AS ENUM ('DEVELOPMENT', 'PRODUCTION');

CREATE TABLE "DevicePushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "environment" "PushEnvironment" NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "disabledReason" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DevicePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DevicePushToken_deviceId_key" ON "DevicePushToken"("deviceId");
CREATE UNIQUE INDEX "DevicePushToken_token_key" ON "DevicePushToken"("token");
CREATE UNIQUE INDEX "DevicePushToken_userId_deviceId_key" ON "DevicePushToken"("userId", "deviceId");
CREATE INDEX "DevicePushToken_userId_environment_disabledAt_idx" ON "DevicePushToken"("userId", "environment", "disabledAt");

ALTER TABLE "DevicePushToken" ADD CONSTRAINT "DevicePushToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

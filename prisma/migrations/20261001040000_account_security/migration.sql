ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "TwoFactor" ("id" TEXT NOT NULL PRIMARY KEY,"secret" TEXT NOT NULL,"backupCodes" TEXT NOT NULL,"userId" TEXT NOT NULL,"verified" BOOLEAN NOT NULL DEFAULT true,"failedVerificationCount" INTEGER NOT NULL DEFAULT 0,"lockedUntil" DATETIME,CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "TwoFactor_userId_idx" ON "TwoFactor"("userId");
CREATE INDEX "TwoFactor_secret_idx" ON "TwoFactor"("secret");
CREATE TABLE "EmailDelivery" ("id" TEXT NOT NULL PRIMARY KEY,"key" TEXT NOT NULL,"recipient" TEXT NOT NULL,"userId" TEXT,"kind" TEXT NOT NULL,"payload" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'PENDING',"attempts" INTEGER NOT NULL DEFAULT 0,"providerId" TEXT,"lastError" TEXT,"availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" DATETIME NOT NULL,"firstAttemptAt" DATETIME,"leaseUntil" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"sentAt" DATETIME);
CREATE UNIQUE INDEX "EmailDelivery_key_key" ON "EmailDelivery"("key");
CREATE INDEX "EmailDelivery_status_availableAt_idx" ON "EmailDelivery"("status","availableAt");

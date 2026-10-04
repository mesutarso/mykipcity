CREATE TABLE "EmailChange" ("id" TEXT NOT NULL PRIMARY KEY,"userId" TEXT NOT NULL,"oldEmail" TEXT NOT NULL,"newEmail" TEXT NOT NULL,"oldTokenHash" TEXT NOT NULL,"newTokenHash" TEXT NOT NULL,"oldConfirmed" BOOLEAN NOT NULL DEFAULT false,"newConfirmed" BOOLEAN NOT NULL DEFAULT false,"accessVersion" INTEGER NOT NULL,"expiresAt" DATETIME NOT NULL,"completedAt" DATETIME,"cancelledAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "EmailChange_oldTokenHash_key" ON "EmailChange"("oldTokenHash");
CREATE UNIQUE INDEX "EmailChange_newTokenHash_key" ON "EmailChange"("newTokenHash");
CREATE INDEX "EmailChange_userId_createdAt_idx" ON "EmailChange"("userId","createdAt");

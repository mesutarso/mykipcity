ALTER TABLE "User" ADD COLUMN "selectedFileId" TEXT;
ALTER TABLE "User" ADD COLUMN "mergedIntoUserId" TEXT;
DROP INDEX "Acquirer_userId_key";
CREATE INDEX "Acquirer_userId_idx" ON "Acquirer"("userId");
CREATE TABLE "AcquirerChange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "sourceFileId" TEXT NOT NULL,
  "targetFileId" TEXT NOT NULL,
  "preparedBy" TEXT NOT NULL,
  "preparedPersonId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" DATETIME
);
CREATE INDEX "AcquirerChange_status_createdAt_idx" ON "AcquirerChange"("status", "createdAt");
CREATE INDEX "AcquirerChange_sourceFileId_idx" ON "AcquirerChange"("sourceFileId");
CREATE INDEX "AcquirerChange_targetFileId_idx" ON "AcquirerChange"("targetFileId");

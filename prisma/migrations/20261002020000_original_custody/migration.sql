CREATE TABLE "Original" (
 "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "reference" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Original_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinanceCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Original_reference_key" ON "Original"("reference");
CREATE INDEX "Original_caseId_createdAt_idx" ON "Original"("caseId", "createdAt");
CREATE TABLE "OriginalEvent" (
 "id" TEXT NOT NULL PRIMARY KEY, "originalId" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "kind" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "replacesId" TEXT, "data" JSONB NOT NULL,
 "authorId" TEXT NOT NULL, "authorName" TEXT NOT NULL, "authorPersonId" TEXT NOT NULL,
 "reviewerId" TEXT NOT NULL, "reviewerName" TEXT, "reviewerPersonId" TEXT, "reviewReason" TEXT, "reviewedAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "originalName" TEXT NOT NULL,
 "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "size" INTEGER NOT NULL, "sha256" TEXT NOT NULL,
 CONSTRAINT "OriginalEvent_originalId_fkey" FOREIGN KEY ("originalId") REFERENCES "Original" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OriginalEvent_originalId_sequence_key" ON "OriginalEvent"("originalId", "sequence");
CREATE UNIQUE INDEX "OriginalEvent_storageKey_key" ON "OriginalEvent"("storageKey");
CREATE INDEX "OriginalEvent_reviewerId_status_idx" ON "OriginalEvent"("reviewerId", "status");

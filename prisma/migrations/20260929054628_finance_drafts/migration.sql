-- CreateTable
CREATE TABLE "FinanceCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "acquirerId" TEXT,
    "ownerId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "pathway" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "request" JSONB NOT NULL,
    "budget" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceCase_acquirerId_fkey" FOREIGN KEY ("acquirerId") REFERENCES "Acquirer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinanceCase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinanceRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL DEFAULT 'V2_DRAFT',
    "payload" JSONB NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceRevision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinanceCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinanceRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCase_reference_key" ON "FinanceCase"("reference");

-- CreateIndex
CREATE INDEX "FinanceCase_ownerId_updatedAt_idx" ON "FinanceCase"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceRevision_caseId_version_key" ON "FinanceRevision"("caseId", "version");

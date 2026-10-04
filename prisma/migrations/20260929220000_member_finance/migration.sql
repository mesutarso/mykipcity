CREATE TABLE "FinanceMemberUpdate" (
 "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
 "draft" JSONB NOT NULL, "published" JSONB, "audienceId" TEXT, "visible" BOOLEAN NOT NULL DEFAULT false,
 "publishedAt" DATETIME, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "FinanceMemberUpdate_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinanceCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinanceMemberUpdate_caseId_key" ON "FinanceMemberUpdate"("caseId");

ALTER TABLE "FinanceCase" ADD COLUMN "reviewerId" TEXT;
ALTER TABLE "FinanceCase" ADD COLUMN "validatorId" TEXT;
ALTER TABLE "FinanceCase" ADD COLUMN "reviewCycle" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "FinanceReview" ("id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "cycle" INTEGER NOT NULL, "snapshot" JSONB NOT NULL, "preparerPeople" JSONB NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "FinanceReview_caseId_cycle_key" ON "FinanceReview"("caseId", "cycle");
CREATE TABLE "FinanceReviewEvent" ("id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "cycle" INTEGER NOT NULL, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL, "actorPersonId" TEXT NOT NULL, "action" TEXT NOT NULL, "reason" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "FinanceReviewEvent_caseId_cycle_idx" ON "FinanceReviewEvent"("caseId", "cycle");

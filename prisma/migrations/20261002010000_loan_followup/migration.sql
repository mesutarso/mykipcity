CREATE TABLE "Loan" (
 "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "institutionId" TEXT NOT NULL,
 "institutionName" TEXT NOT NULL, "reference" TEXT NOT NULL, "currency" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Loan_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinanceCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Loan_caseId_institutionId_reference_key" ON "Loan"("caseId", "institutionId", "reference");
CREATE TABLE "LoanEvent" (
 "id" TEXT NOT NULL PRIMARY KEY, "loanId" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "replacesId" TEXT, "data" JSONB NOT NULL,
 "authorId" TEXT NOT NULL, "authorName" TEXT NOT NULL, "authorPersonId" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewerId" TEXT, "reviewerName" TEXT,
 "reviewerPersonId" TEXT, "reviewedAt" DATETIME, "reviewReason" TEXT,
 "originalName" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
 "size" INTEGER NOT NULL, "sha256" TEXT NOT NULL,
 CONSTRAINT "LoanEvent_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LoanEvent_storageKey_key" ON "LoanEvent"("storageKey");
CREATE INDEX "LoanEvent_loanId_createdAt_idx" ON "LoanEvent"("loanId", "createdAt");

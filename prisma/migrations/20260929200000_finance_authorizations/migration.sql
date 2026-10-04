CREATE TABLE "FinanceAuthorization" (
 "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "cycle" INTEGER NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "payload" JSONB NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "FinanceAuthorization_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinanceCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FinanceAuthorization_caseId_idx" ON "FinanceAuthorization"("caseId");
CREATE TABLE "FinanceAuthorizationRevision" (
 "id" TEXT NOT NULL PRIMARY KEY, "authorizationId" TEXT NOT NULL, "version" INTEGER NOT NULL,
 "status" TEXT NOT NULL, "payload" JSONB NOT NULL, "actorId" TEXT NOT NULL, "reason" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "FinanceAuthorizationRevision_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "FinanceAuthorization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinanceAuthorizationRevision_authorizationId_version_key" ON "FinanceAuthorizationRevision"("authorizationId", "version");

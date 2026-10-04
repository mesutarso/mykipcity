CREATE TABLE "RegistryImport" (
 "id" TEXT NOT NULL PRIMARY KEY, "actorId" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "filename" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PREVIEW',
 "source" JSONB NOT NULL, "report" JSONB NOT NULL, "result" JSONB,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" DATETIME NOT NULL, "committedAt" DATETIME
);
CREATE INDEX "RegistryImport_actorId_createdAt_idx" ON "RegistryImport"("actorId", "createdAt");

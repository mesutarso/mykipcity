CREATE TABLE "MemberPublication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "targetId" TEXT,
  "targetReference" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "authorId" TEXT NOT NULL,
  "authorPersonId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "publishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "MemberPublication_status_audience_targetId_publishedAt_idx" ON "MemberPublication"("status", "audience", "targetId", "publishedAt");

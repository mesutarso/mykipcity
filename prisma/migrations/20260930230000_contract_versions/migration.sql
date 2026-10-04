ALTER TABLE "Document" ADD COLUMN "groupId" TEXT;
ALTER TABLE "Document" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Document" ADD COLUMN "page" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Document" ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Document" ADD COLUMN "batchId" TEXT;
ALTER TABLE "Document" ADD COLUMN "batchHash" TEXT;
CREATE UNIQUE INDEX "Document_groupId_revision_page_key" ON "Document"("groupId", "revision", "page");
CREATE UNIQUE INDEX "Document_batchId_page_key" ON "Document"("batchId", "page");

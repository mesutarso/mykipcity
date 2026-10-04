CREATE TABLE "MemberDocument" (
 "id" TEXT NOT NULL PRIMARY KEY, "fileId" TEXT NOT NULL, "title" TEXT NOT NULL,
 "category" TEXT NOT NULL, "parcelReferences" JSONB NOT NULL, "direction" TEXT NOT NULL,
 "instructions" TEXT NOT NULL DEFAULT '', "version" INTEGER NOT NULL DEFAULT 0,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "MemberDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "AcquirerFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MemberDocument_fileId_updatedAt_idx" ON "MemberDocument"("fileId", "updatedAt");
CREATE TABLE "MemberDocumentVersion" (
 "id" TEXT NOT NULL PRIMARY KEY, "documentId" TEXT NOT NULL, "revision" INTEGER NOT NULL,
 "originalName" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
 "size" INTEGER NOT NULL, "sha256" TEXT NOT NULL, "uploadedBy" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "reason" TEXT NOT NULL DEFAULT '',
 "reviewedBy" TEXT, "reviewedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MemberDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MemberDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MemberDocumentVersion_storageKey_key" ON "MemberDocumentVersion"("storageKey");
CREATE UNIQUE INDEX "MemberDocumentVersion_documentId_revision_key" ON "MemberDocumentVersion"("documentId", "revision");

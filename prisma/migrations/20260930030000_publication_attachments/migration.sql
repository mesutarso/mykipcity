CREATE TABLE "PublicationAttachment" (
 "id" TEXT NOT NULL PRIMARY KEY, "publicationId" TEXT NOT NULL,
 "caption" TEXT NOT NULL, "takenOn" TEXT NOT NULL DEFAULT '',
 "originalName" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
 "size" INTEGER NOT NULL, "sha256" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "removedAt" DATETIME,
 CONSTRAINT "PublicationAttachment_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "MemberPublication"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PublicationAttachment_storageKey_key" ON "PublicationAttachment"("storageKey");
CREATE INDEX "PublicationAttachment_publicationId_removedAt_idx" ON "PublicationAttachment"("publicationId", "removedAt");

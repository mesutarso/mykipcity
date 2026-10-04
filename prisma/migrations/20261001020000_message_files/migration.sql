ALTER TABLE "Message" ADD COLUMN "uploadName" TEXT;
ALTER TABLE "Message" ADD COLUMN "uploadMime" TEXT;
ALTER TABLE "Message" ADD COLUMN "uploadSize" INTEGER;
ALTER TABLE "Message" ADD COLUMN "uploadSha256" TEXT;
ALTER TABLE "Message" ADD COLUMN "uploadStorageKey" TEXT;
CREATE UNIQUE INDEX "Message_uploadStorageKey_key" ON "Message"("uploadStorageKey");

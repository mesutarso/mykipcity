ALTER TABLE "Message" ADD COLUMN "subject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Message" ADD COLUMN "parcelReference" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Message" ADD COLUMN "attachmentId" TEXT;
ALTER TABLE "Message" ADD COLUMN "clientToken" TEXT;
CREATE UNIQUE INDEX "Message_authorId_clientToken_key" ON "Message"("authorId", "clientToken");
ALTER TABLE "FinanceRequirement" ADD COLUMN "memberAudienceId" TEXT;
ALTER TABLE "FinanceRequirement" ADD COLUMN "memberInstructions" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FinanceRequirement" ADD COLUMN "sharedAt" DATETIME;
CREATE TABLE "NotificationReceipt" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "notificationId" TEXT NOT NULL,
 "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "NotificationReceipt_userId_notificationId_key" ON "NotificationReceipt"("userId", "notificationId");

ALTER TABLE "FinanceRequirement" ADD COLUMN "sharingVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AcquirerFile" ADD COLUMN "details" JSONB;

ALTER TABLE "ParcelDeclaration" ADD COLUMN "details" JSONB;

ALTER TABLE "Document" ADD COLUMN "details" JSONB;

ALTER TABLE "MemberDocument" ADD COLUMN "closedAt" DATETIME;
ALTER TABLE "MemberDocument" ADD COLUMN "closingReason" TEXT NOT NULL DEFAULT '';

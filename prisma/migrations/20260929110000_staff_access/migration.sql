ALTER TABLE "User" ADD COLUMN "accessVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "StaffInvitation" (
 "id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "name" TEXT NOT NULL,
 "role" TEXT NOT NULL, "personId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
 "expiresAt" DATETIME NOT NULL, "consumedAt" DATETIME, "revokedAt" DATETIME,
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StaffInvitation_email_key" ON "StaffInvitation"("email");
CREATE UNIQUE INDEX "StaffInvitation_personId_key" ON "StaffInvitation"("personId");
CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");

ALTER TABLE "ParcelDeclaration" ADD COLUMN "accessVerification" JSONB;
ALTER TABLE "ParcelDeclaration" ADD COLUMN "accessExpiresAt" DATETIME;
ALTER TABLE "ParcelDeclaration" ADD COLUMN "accessRevokedAt" DATETIME;

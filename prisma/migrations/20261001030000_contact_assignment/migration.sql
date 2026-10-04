ALTER TABLE "AcquirerFile" ADD COLUMN "contactOwnerId" TEXT;
ALTER TABLE "AcquirerFile" ADD COLUMN "contactVersion" INTEGER NOT NULL DEFAULT 0;

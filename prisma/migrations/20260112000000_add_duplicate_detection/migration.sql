-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "isDuplicateFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN "duplicateOfId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "duplicateScore" INTEGER;

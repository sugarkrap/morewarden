-- AlterTable
ALTER TABLE "Link" ADD COLUMN "assistedScraping" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Link" ADD COLUMN "hookScript" TEXT;

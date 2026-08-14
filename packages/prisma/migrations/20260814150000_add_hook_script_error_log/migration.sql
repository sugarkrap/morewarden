-- AlterTable
ALTER TABLE "Link" ADD COLUMN "hookScriptFailed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Link" ADD COLUMN "hookScriptLog" TEXT;

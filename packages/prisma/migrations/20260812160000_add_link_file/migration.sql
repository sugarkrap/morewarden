-- CreateTable
CREATE TABLE "LinkFile" (
    "id" SERIAL NOT NULL,
    "linkId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkFile_linkId_idx" ON "LinkFile"("linkId");

-- AddForeignKey
ALTER TABLE "LinkFile" ADD CONSTRAINT "LinkFile_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HookScript" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HookScript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HookScript_ownerId_idx" ON "HookScript"("ownerId");

-- AddForeignKey
ALTER TABLE "HookScript" ADD CONSTRAINT "HookScript_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

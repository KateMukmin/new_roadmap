-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "when" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Phase_itemId_idx" ON "Phase"("itemId");

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

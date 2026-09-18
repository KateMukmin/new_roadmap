-- CreateEnum
CREATE TYPE "Status" AS ENUM ('NOW', 'NEXT', 'LATER');

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "title" TEXT NOT NULL DEFAULT 'New Roadmap',

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'NOW',
    "when" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeItem" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ThemeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThemeItem_themeId_idx" ON "ThemeItem"("themeId");

-- CreateIndex
CREATE INDEX "ThemeItem_itemId_idx" ON "ThemeItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeItem_themeId_itemId_key" ON "ThemeItem"("themeId", "itemId");

-- AddForeignKey
ALTER TABLE "ThemeItem" ADD CONSTRAINT "ThemeItem_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeItem" ADD CONSTRAINT "ThemeItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

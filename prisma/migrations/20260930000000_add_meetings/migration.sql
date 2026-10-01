-- AlterTable: approval fields on Item
ALTER TABLE "Item" ADD COLUMN "approvedDate" TEXT;
ALTER TABLE "Item" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "Item" ADD COLUMN "approvedDecision" TEXT;

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_date_key" ON "Meeting"("date");

-- CreateTable
CREATE TABLE "MeetingItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "signoff" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MeetingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingItem_meetingId_itemId_key" ON "MeetingItem"("meetingId", "itemId");
CREATE INDEX "MeetingItem_meetingId_idx" ON "MeetingItem"("meetingId");
CREATE INDEX "MeetingItem_itemId_idx" ON "MeetingItem"("itemId");

-- AddForeignKeys
ALTER TABLE "MeetingItem" ADD CONSTRAINT "MeetingItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingItem" ADD CONSTRAINT "MeetingItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

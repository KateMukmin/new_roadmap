-- AlterTable: add approvedContext to Item
ALTER TABLE "Item" ADD COLUMN "approvedContext" TEXT;

-- AlterTable: add context and history to MeetingItem
ALTER TABLE "MeetingItem" ADD COLUMN "context" TEXT;
ALTER TABLE "MeetingItem" ADD COLUMN "history" TEXT;

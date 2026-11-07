-- AlterTable
ALTER TABLE "guests" ADD COLUMN     "bot_blocked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "processed_transactions" ADD COLUMN     "notify_error" TEXT;

-- AlterTable
ALTER TABLE "guests" ADD COLUMN     "when_registered" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "processed_transactions" ADD COLUMN     "historical" BOOLEAN NOT NULL DEFAULT false;

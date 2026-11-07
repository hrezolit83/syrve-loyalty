-- AlterTable
ALTER TABLE "mock_transactions" ALTER COLUMN "sum" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "balance_after" DROP NOT NULL,
ALTER COLUMN "balance_after" SET DATA TYPE DECIMAL(14,2);

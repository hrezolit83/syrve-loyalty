-- AlterTable
ALTER TABLE "processed_transactions" ADD COLUMN     "type_name" VARCHAR(64),
ALTER COLUMN "sum" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "balance_after" DROP NOT NULL,
ALTER COLUMN "balance_after" SET DATA TYPE DECIMAL(14,2);

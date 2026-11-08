-- AlterTable
ALTER TABLE "processed_transactions" ADD COLUMN     "comment" VARCHAR(255),
ADD COLUMN     "when_created" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "processed_transactions_created_at_idx" ON "processed_transactions"("created_at");

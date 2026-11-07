/*
  Warnings:

  - Added the required column `syrve_customer_id` to the `operations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "operations" ADD COLUMN     "syrve_customer_id" UUID NOT NULL,
ALTER COLUMN "guest_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "operations_syrve_customer_id_created_at_idx" ON "operations"("syrve_customer_id", "created_at");

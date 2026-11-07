-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('topup', 'chargeoff');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "login" VARCHAR(64) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "phone" VARCHAR(20),
    "name" VARCHAR(100),
    "syrve_customer_id" UUID,
    "card_number" VARCHAR(32),
    "last_revision" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "type" "OperationType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'success',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_transactions" (
    "id" UUID NOT NULL,
    "transaction_id" VARCHAR(64) NOT NULL,
    "guest_id" UUID NOT NULL,
    "revision" BIGINT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "sum" DECIMAL(10,2) NOT NULL,
    "balance_after" DECIMAL(10,2) NOT NULL,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_login_key" ON "admins"("login");

-- CreateIndex
CREATE UNIQUE INDEX "guests_telegram_id_key" ON "guests"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "guests_phone_key" ON "guests"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "guests_syrve_customer_id_key" ON "guests"("syrve_customer_id");

-- CreateIndex
CREATE INDEX "guests_created_at_idx" ON "guests"("created_at");

-- CreateIndex
CREATE INDEX "operations_guest_id_created_at_idx" ON "operations"("guest_id", "created_at");

-- CreateIndex
CREATE INDEX "operations_admin_id_created_at_idx" ON "operations"("admin_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_transactions_transaction_id_key" ON "processed_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "processed_transactions_guest_id_revision_idx" ON "processed_transactions"("guest_id", "revision");

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_transactions" ADD CONSTRAINT "processed_transactions_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

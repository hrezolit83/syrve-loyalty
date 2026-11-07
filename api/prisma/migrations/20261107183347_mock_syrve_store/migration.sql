-- CreateTable
CREATE TABLE "mock_customers" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "card_number" VARCHAR(32),
    "card_track" VARCHAR(32),
    "in_program" BOOLEAN NOT NULL DEFAULT false,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mock_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_transactions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "revision" BIGINT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "type_name" VARCHAR(64) NOT NULL,
    "sum" DECIMAL(10,2) NOT NULL,
    "balance_after" DECIMAL(10,2) NOT NULL,
    "comment" VARCHAR(255),
    "when_created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mock_customers_phone_key" ON "mock_customers"("phone");

-- CreateIndex
CREATE INDEX "mock_transactions_customer_id_revision_idx" ON "mock_transactions"("customer_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "mock_transactions_customer_id_revision_key" ON "mock_transactions"("customer_id", "revision");

-- AddForeignKey
ALTER TABLE "mock_transactions" ADD CONSTRAINT "mock_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "mock_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

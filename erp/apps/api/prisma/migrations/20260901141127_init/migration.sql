-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('trial', 'active', 'past_due', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('completed', 'cancelled', 'returned', 'partially_returned');

-- CreateEnum
CREATE TYPE "FiscalStatus" AS ENUM ('queued', 'sending', 'authorized', 'rejected', 'cancelled', 'denied', 'contingency');

-- CreateTable
CREATE TABLE "economic_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economic_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_cents" BIGINT NOT NULL,
    "features" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "overage" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "economic_group_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "ie" TEXT,
    "tax_regime" TEXT NOT NULL,
    "crt" INTEGER NOT NULL,
    "address" JSONB NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'trial',
    "grace_until" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_entitlement" (
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "tenant_entitlement_pkey" PRIMARY KEY ("tenant_id","key")
);

-- CreateTable
CREATE TABLE "usage_counter" (
    "tenant_id" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "usage_counter_pkey" PRIMARY KEY ("tenant_id","period","metric")
);

-- CreateTable
CREATE TABLE "store" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'kiosk',
    "address" JSONB,
    "opens_at" TEXT,
    "closes_at" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminal" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fiscal_series" INTEGER NOT NULL,
    "device_token" TEXT NOT NULL,
    "app_version" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "pin_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT[],

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "store_id" TEXT,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "store_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'simple',
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "sold_by_weight" BOOLEAN NOT NULL DEFAULT false,
    "ncm" CHAR(8),
    "cest" CHAR(7),
    "origin" INTEGER NOT NULL DEFAULT 0,
    "cfop" CHAR(4),
    "tax_profile_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_axis" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "variant_axis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_value" (
    "id" TEXT NOT NULL,
    "axis_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "variant_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "axis1_value_id" TEXT,
    "axis2_value_id" TEXT,
    "description" TEXT NOT NULL,
    "avg_cost_cents" BIGINT NOT NULL DEFAULT 0,
    "track_lot" BOOLEAN NOT NULL DEFAULT false,
    "min_stock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcode" (
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ean',

    CONSTRAINT "barcode_pkey" PRIMARY KEY ("tenant_id","code")
);

-- CreateTable
CREATE TABLE "price" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "store_id" TEXT,
    "price_cents" BIGINT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),

    CONSTRAINT "price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_profile" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,

    CONSTRAINT "tax_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lot" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "lot_code" TEXT NOT NULL,
    "expires_at" DATE,

    CONSTRAINT "stock_lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "kind" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_cost_cents" BIGINT NOT NULL DEFAULT 0,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "reason" TEXT,
    "user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_session" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "opened_by" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "opening_float_cents" BIGINT NOT NULL DEFAULT 0,
    "closed_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "counted" JSONB,
    "expected" JSONB,
    "difference_cents" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,

    CONSTRAINT "cash_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movement" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "approved_by" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "number" BIGINT NOT NULL,
    "customer_document" CHAR(11),
    "operator_id" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'completed',
    "gross_cents" BIGINT NOT NULL,
    "discount_cents" BIGINT NOT NULL DEFAULT 0,
    "total_cents" BIGINT NOT NULL,
    "cost_cents" BIGINT NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL DEFAULT 'pos',
    "original_sale_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clock_skew_ms" INTEGER,

    CONSTRAINT "sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_item" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "sku_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price_cents" BIGINT NOT NULL,
    "discount_cents" BIGINT NOT NULL DEFAULT 0,
    "total_cents" BIGINT NOT NULL,
    "unit_cost_cents" BIGINT NOT NULL DEFAULT 0,
    "tax_snapshot" JSONB,
    "weighed" BOOLEAN NOT NULL DEFAULT false,
    "returned_qty" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "sale_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "change_cents" BIGINT NOT NULL DEFAULT 0,
    "captured" BOOLEAN NOT NULL DEFAULT false,
    "acquirer" TEXT,
    "card_brand" TEXT,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "nsu" TEXT,
    "authorization_code" TEXT,

    CONSTRAINT "sale_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_document" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "sale_id" TEXT,
    "model" INTEGER NOT NULL,
    "series" INTEGER NOT NULL,
    "number" BIGINT,
    "access_key" CHAR(44),
    "status" "FiscalStatus" NOT NULL DEFAULT 'queued',
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT,
    "environment" INTEGER NOT NULL DEFAULT 2,
    "protocol" TEXT,
    "authorized_at" TIMESTAMP(3),
    "rejection_code" TEXT,
    "rejection_msg" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "xml_url" TEXT,
    "danfe_url" TEXT,
    "qr_code" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminal_heartbeat" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_version" TEXT,
    "bridge_version" TEXT,
    "pending_sales" INTEGER NOT NULL DEFAULT 0,
    "fiscal_queue" INTEGER NOT NULL DEFAULT 0,
    "printer_ok" BOOLEAN,
    "scale_ok" BOOLEAN,
    "last_sale_at" TIMESTAMP(3),

    CONSTRAINT "terminal_heartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminal_alert" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "details" JSONB,

    CONSTRAINT "terminal_alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_code_key" ON "plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_cnpj_key" ON "tenant"("cnpj");

-- CreateIndex
CREATE INDEX "tenant_economic_group_id_idx" ON "tenant"("economic_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_tenant_id_code_key" ON "store"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "terminal_device_token_key" ON "terminal"("device_token");

-- CreateIndex
CREATE UNIQUE INDEX "terminal_tenant_id_store_id_code_key" ON "terminal"("tenant_id", "store_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_tenant_id_email_key" ON "app_user"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "role_tenant_id_code_key" ON "role"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_created_at_idx" ON "audit_log"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "category_tenant_id_name_key" ON "category"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "product_tenant_id_active_idx" ON "product"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "variant_axis_tenant_id_name_key" ON "variant_axis"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "variant_value_axis_id_value_key" ON "variant_value"("axis_id", "value");

-- CreateIndex
CREATE INDEX "sku_tenant_id_active_idx" ON "sku"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "sku_tenant_id_code_key" ON "sku"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sku_product_id_axis1_value_id_axis2_value_id_key" ON "sku"("product_id", "axis1_value_id", "axis2_value_id");

-- CreateIndex
CREATE INDEX "barcode_sku_id_idx" ON "barcode"("sku_id");

-- CreateIndex
CREATE INDEX "price_tenant_id_sku_id_store_id_valid_from_idx" ON "price"("tenant_id", "sku_id", "store_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "tax_profile_tenant_id_name_key" ON "tax_profile"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stock_lot_tenant_id_sku_id_lot_code_key" ON "stock_lot"("tenant_id", "sku_id", "lot_code");

-- CreateIndex
CREATE INDEX "stock_balance_tenant_id_store_id_idx" ON "stock_balance"("tenant_id", "store_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balance_store_id_sku_id_lot_id_key" ON "stock_balance"("store_id", "sku_id", "lot_id");

-- CreateIndex
CREATE INDEX "stock_movement_tenant_id_store_id_sku_id_occurred_at_idx" ON "stock_movement"("tenant_id", "store_id", "sku_id", "occurred_at");

-- CreateIndex
CREATE INDEX "cash_session_tenant_id_store_id_status_idx" ON "cash_session"("tenant_id", "store_id", "status");

-- CreateIndex
CREATE INDEX "cash_movement_tenant_id_session_id_idx" ON "cash_movement"("tenant_id", "session_id");

-- CreateIndex
CREATE INDEX "sale_tenant_id_store_id_occurred_at_idx" ON "sale"("tenant_id", "store_id", "occurred_at");

-- CreateIndex
CREATE INDEX "sale_tenant_id_session_id_idx" ON "sale"("tenant_id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_tenant_id_store_id_number_key" ON "sale"("tenant_id", "store_id", "number");

-- CreateIndex
CREATE INDEX "sale_item_tenant_id_sku_id_idx" ON "sale_item"("tenant_id", "sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_item_sale_id_line_number_key" ON "sale_item"("sale_id", "line_number");

-- CreateIndex
CREATE INDEX "sale_payment_tenant_id_sale_id_idx" ON "sale_payment"("tenant_id", "sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_document_access_key_key" ON "fiscal_document"("access_key");

-- CreateIndex
CREATE INDEX "fiscal_document_tenant_id_status_next_attempt_at_idx" ON "fiscal_document"("tenant_id", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "fiscal_document_tenant_id_store_id_authorized_at_idx" ON "fiscal_document"("tenant_id", "store_id", "authorized_at");

-- CreateIndex
CREATE INDEX "terminal_heartbeat_tenant_id_terminal_id_at_idx" ON "terminal_heartbeat"("tenant_id", "terminal_id", "at");

-- CreateIndex
CREATE INDEX "terminal_alert_tenant_id_resolved_at_idx" ON "terminal_alert"("tenant_id", "resolved_at");

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_economic_group_id_fkey" FOREIGN KEY ("economic_group_id") REFERENCES "economic_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_entitlement" ADD CONSTRAINT "tenant_entitlement_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counter" ADD CONSTRAINT "usage_counter_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store" ADD CONSTRAINT "store_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal" ADD CONSTRAINT "terminal_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_tax_profile_id_fkey" FOREIGN KEY ("tax_profile_id") REFERENCES "tax_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_value" ADD CONSTRAINT "variant_value_axis_id_fkey" FOREIGN KEY ("axis_id") REFERENCES "variant_axis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku" ADD CONSTRAINT "sku_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku" ADD CONSTRAINT "sku_axis1_value_id_fkey" FOREIGN KEY ("axis1_value_id") REFERENCES "variant_value"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku" ADD CONSTRAINT "sku_axis2_value_id_fkey" FOREIGN KEY ("axis2_value_id") REFERENCES "variant_value"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcode" ADD CONSTRAINT "barcode_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price" ADD CONSTRAINT "price_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price" ADD CONSTRAINT "price_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lot" ADD CONSTRAINT "stock_lot_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance" ADD CONSTRAINT "stock_balance_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance" ADD CONSTRAINT "stock_balance_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance" ADD CONSTRAINT "stock_balance_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cash_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cash_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payment" ADD CONSTRAINT "sale_payment_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_document" ADD CONSTRAINT "fiscal_document_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_document" ADD CONSTRAINT "fiscal_document_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal_heartbeat" ADD CONSTRAINT "terminal_heartbeat_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal_alert" ADD CONSTRAINT "terminal_alert_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

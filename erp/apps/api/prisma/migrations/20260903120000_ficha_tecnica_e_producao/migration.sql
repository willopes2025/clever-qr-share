-- AlterTable
ALTER TABLE "sku" ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'UN';

-- CreateTable
CREATE TABLE "recipe" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "output_sku_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'assembly',
    "output_quantity" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_item" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "recipe_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "output_sku_id" TEXT NOT NULL,
    "recipe_id" TEXT,
    "expected_quantity" DECIMAL(14,4) NOT NULL,
    "produced_quantity" DECIMAL(14,4) NOT NULL,
    "input_cost_cents" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_item" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_cost_cents" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "production_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_output_sku_id_key" ON "recipe"("output_sku_id");

-- CreateIndex
CREATE INDEX "recipe_tenant_id_active_idx" ON "recipe"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_item_recipe_id_sku_id_key" ON "recipe_item"("recipe_id", "sku_id");

-- CreateIndex
CREATE INDEX "production_order_tenant_id_store_id_occurred_at_idx" ON "production_order"("tenant_id", "store_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_output_sku_id_fkey" FOREIGN KEY ("output_sku_id") REFERENCES "sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_item" ADD CONSTRAINT "recipe_item_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_item" ADD CONSTRAINT "recipe_item_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order" ADD CONSTRAINT "production_order_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order" ADD CONSTRAINT "production_order_output_sku_id_fkey" FOREIGN KEY ("output_sku_id") REFERENCES "sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_item" ADD CONSTRAINT "production_order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_item" ADD CONSTRAINT "production_order_item_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Isolamento multiempresa nas tabelas novas.
--
-- O laço da migração de RLS rodou uma vez, sobre as tabelas que existiam
-- naquele dia. Tabela nova nasce sem política — e num sistema whitelabel isso
-- é a diferença entre um bug de consulta e o cardápio de um cliente aparecendo
-- para outro. Repetir o laço é idempotente e cobre o que veio depois.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO soul_app;

DO $$
DECLARE
  target text;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'tenant_id'
      AND NOT a.attisdropped
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', target);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I
         USING (tenant_id::text = current_setting(''app.tenant_id'', true))
         WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'', true))',
      target
    );
  END LOOP;
END
$$;

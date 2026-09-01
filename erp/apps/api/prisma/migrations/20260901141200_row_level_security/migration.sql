-- Isolamento multiempresa no banco (segunda camada de defesa).
--
-- A aplicação já filtra por tenant_id vindo do token; estas políticas garantem
-- que um bug de consulta não vaze dado de um CNPJ para outro.
--
-- Como ligar a aplicação do jeito seguro:
--   1. a API passa a conectar com a role `soul_app` (não com a dona das tabelas);
--   2. cada transação executa `SET LOCAL app.tenant_id = '<uuid>'`.
-- A role dona das tabelas continua ignorando as políticas — é o que permite
-- migração e seed rodarem normalmente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'soul_app') THEN
    CREATE ROLE soul_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO soul_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO soul_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO soul_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO soul_app;

-- Auditoria é append-only: nem a aplicação pode alterar o passado.
REVOKE UPDATE, DELETE ON audit_log FROM soul_app;

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
      -- tenant_id é texto no schema gerado pelo Prisma; a comparação é feita
      -- em texto para não depender do tipo da coluna.
      'CREATE POLICY tenant_isolation ON public.%I
         USING (tenant_id::text = current_setting(''app.tenant_id'', true))
         WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'', true))',
      target
    );
  END LOOP;
END
$$;

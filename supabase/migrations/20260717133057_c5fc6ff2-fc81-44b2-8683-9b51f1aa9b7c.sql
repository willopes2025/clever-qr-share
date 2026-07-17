
-- Fase 1: atualizar estatísticas do planner para as tabelas mais consultadas.
-- Aumentar statistics target melhora o plano em colunas com muitas cardinalidades
-- (ex.: user_id, stage_id, conversation_id) sem custo em tempo de execução.

ALTER TABLE public.contacts        ALTER COLUMN user_id SET STATISTICS 500;
ALTER TABLE public.contacts        ALTER COLUMN phone   SET STATISTICS 500;
ALTER TABLE public.conversations   ALTER COLUMN user_id SET STATISTICS 500;
ALTER TABLE public.conversations   ALTER COLUMN instance_id SET STATISTICS 500;
ALTER TABLE public.inbox_messages  ALTER COLUMN conversation_id SET STATISTICS 500;
ALTER TABLE public.funnel_deals    ALTER COLUMN stage_id SET STATISTICS 500;
ALTER TABLE public.funnel_deals    ALTER COLUMN contact_id SET STATISTICS 500;
ALTER TABLE public.campaign_messages ALTER COLUMN contact_id SET STATISTICS 500;

ANALYZE public.contacts;
ANALYZE public.conversations;
ANALYZE public.inbox_messages;
ANALYZE public.funnel_deals;
ANALYZE public.contact_tags;
ANALYZE public.tags;
ANALYZE public.campaign_messages;
ANALYZE public.form_submissions;
ANALYZE public.email_messages;
ANALYZE public.billing_reminders;

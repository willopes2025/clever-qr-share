
-- 1) Renumerar contact_display_id por usuário (sequência por created_at)
WITH ranked AS (
  SELECT id,
         LPAD(
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id)::text,
           4, '0'
         ) AS new_display_id
  FROM public.contacts
)
UPDATE public.contacts c
SET contact_display_id = r.new_display_id
FROM ranked r
WHERE c.id = r.id
  AND (c.contact_display_id IS DISTINCT FROM r.new_display_id);

-- 2) Índice único por (user_id, contact_display_id)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_display_id_unique
  ON public.contacts (user_id, contact_display_id);

-- 3) Substituir função para gerar próximo código livre por usuário
CREATE OR REPLACE FUNCTION public.generate_contact_display_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(contact_display_id, '\D', '', 'g'), '')::int), 0) + 1
    INTO next_num
    FROM public.contacts
    WHERE user_id = NEW.user_id;

  NEW.contact_display_id := LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$function$;

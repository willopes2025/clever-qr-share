
CREATE OR REPLACE FUNCTION public.generate_contact_display_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
  candidate TEXT;
  attempts INTEGER := 0;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(contact_display_id, '\D', '', 'g'), '')::int), 0) + 1
    INTO next_num
    FROM public.contacts
    WHERE user_id = NEW.user_id;

  LOOP
    -- Pad to at least 4 chars but never truncate larger numbers
    IF next_num < 10000 THEN
      candidate := LPAD(next_num::text, 4, '0');
    ELSE
      candidate := next_num::text;
    END IF;

    -- Ensure no collision (handles concurrency)
    IF NOT EXISTS (
      SELECT 1 FROM public.contacts
      WHERE user_id = NEW.user_id AND contact_display_id = candidate
    ) THEN
      EXIT;
    END IF;

    next_num := next_num + 1;
    attempts := attempts + 1;
    IF attempts > 1000 THEN
      EXIT;
    END IF;
  END LOOP;

  NEW.contact_display_id := candidate;
  RETURN NEW;
END;
$function$;

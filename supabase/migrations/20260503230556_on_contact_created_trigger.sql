-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================================================
-- on_contact_created automation trigger
--
-- Fires the handle-contact-created Edge Function whenever a
-- new row is inserted into the contacts table. The Edge Function
-- looks up on_contact_created automations for the user and
-- calls process-funnel-automations for any open deals linked
-- to the new contact.
-- =========================================================

CREATE OR REPLACE FUNCTION public.trigger_contact_created_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url    TEXT;
  _key    TEXT;
  _body   JSONB;
BEGIN
  -- Read runtime configuration injected by Supabase
  _url := current_setting('app.supabase_url', true);
  _key := current_setting('app.supabase_service_role_key', true);

  -- Fall back to known project values so the trigger works even when
  -- the GUC variables are not set (e.g. during local development)
  IF _url IS NULL OR _url = '' THEN
    _url := 'https://fgbenetdksqnvwkgnips.supabase.co';
  END IF;

  IF _key IS NULL OR _key = '' THEN
    -- Use the anon key as a fallback (same pattern as existing cron jobs).
    -- The Edge Function authenticates internally using SUPABASE_SERVICE_ROLE_KEY
    -- from its own Deno environment.
    _key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnYmVuZXRka3NxbnZ3a2duaXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3Mzg1MjksImV4cCI6MjA3OTMxNDUyOX0.V2rhtyEt2VSO7O2BqZELTGkFOX9p8onqNWSe3aazgaM';
  END IF;

  _body := jsonb_build_object(
    'type',   'INSERT',
    'table',  'contacts',
    'schema', 'public',
    'record', jsonb_build_object(
      'id',      NEW.id,
      'user_id', NEW.user_id,
      'name',    NEW.name,
      'phone',   NEW.phone,
      'email',   NEW.email
    )
  );

  -- Fire-and-forget HTTP POST via pg_net (non-blocking)
  PERFORM net.http_post(
    url     := _url || '/functions/v1/handle-contact-created',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body    := _body
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS on_contact_created_automation ON public.contacts;

CREATE TRIGGER on_contact_created_automation
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_contact_created_automations();

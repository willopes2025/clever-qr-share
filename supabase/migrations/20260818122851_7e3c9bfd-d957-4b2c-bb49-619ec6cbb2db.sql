CREATE TABLE public.message_sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instance_id UUID,
  instance_name TEXT NOT NULL,
  evolution_instance_name TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  chats_source TEXT,
  chats JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_chats INTEGER NOT NULL DEFAULT 0,
  processed_chats INTEGER NOT NULL DEFAULT 0,
  messages_imported INTEGER NOT NULL DEFAULT 0,
  contacts_created INTEGER NOT NULL DEFAULT 0,
  conversations_created INTEGER NOT NULL DEFAULT 0,
  chats_with_errors INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  lease_until TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.message_sync_jobs TO authenticated;
GRANT ALL ON public.message_sync_jobs TO service_role;

ALTER TABLE public.message_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view sync jobs"
ON public.message_sync_jobs
FOR SELECT
TO authenticated
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE INDEX idx_message_sync_jobs_instance_status ON public.message_sync_jobs (instance_id, status);
CREATE INDEX idx_message_sync_jobs_user_created ON public.message_sync_jobs (user_id, created_at DESC);

CREATE TRIGGER update_message_sync_jobs_updated_at
BEFORE UPDATE ON public.message_sync_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
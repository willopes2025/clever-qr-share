-- Add dispatch mode and chatbot flow to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS dispatch_mode text NOT NULL DEFAULT 'template',
  ADD COLUMN IF NOT EXISTS chatbot_flow_id uuid NULL;

-- FK for chatbot_flow_id (only if chatbot_flows table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chatbot_flows') THEN
    BEGIN
      ALTER TABLE public.campaigns
        ADD CONSTRAINT campaigns_chatbot_flow_id_fkey
        FOREIGN KEY (chatbot_flow_id) REFERENCES public.chatbot_flows(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_chatbot_flow_id ON public.campaigns(chatbot_flow_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_dispatch_mode ON public.campaigns(dispatch_mode);

-- Add trigger_campaign_id to chatbot_executions (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chatbot_executions') THEN
    BEGIN
      ALTER TABLE public.chatbot_executions
        ADD COLUMN IF NOT EXISTS trigger_campaign_id uuid NULL;
    EXCEPTION WHEN others THEN NULL;
    END;

    BEGIN
      ALTER TABLE public.chatbot_executions
        ADD CONSTRAINT chatbot_executions_trigger_campaign_id_fkey
        FOREIGN KEY (trigger_campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    CREATE INDEX IF NOT EXISTS idx_chatbot_executions_trigger_campaign
      ON public.chatbot_executions(trigger_campaign_id);
  END IF;
END $$;

-- Constraint to ensure dispatch_mode has valid values
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_dispatch_mode_check
      CHECK (dispatch_mode IN ('template', 'chatbot'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
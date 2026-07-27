CREATE TABLE public.meta_number_tokens (
  phone_number_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  waba_id TEXT,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.meta_number_tokens TO service_role;

ALTER TABLE public.meta_number_tokens ENABLE ROW LEVEL SECURITY;

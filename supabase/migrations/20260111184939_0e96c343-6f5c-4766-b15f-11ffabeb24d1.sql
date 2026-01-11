-- Add provider column to conversations table to distinguish WhatsApp Lite (Evolution) from WhatsApp API (Meta)
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'evolution' CHECK (provider IN ('evolution', 'meta'));

-- Add meta_phone_number_id to store which Meta number received/sent messages
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT;

-- Update existing conversations: set provider='meta' for conversations without instance_id
UPDATE public.conversations 
SET provider = 'meta' 
WHERE instance_id IS NULL AND provider IS NULL;

-- Create table for managing Meta WhatsApp numbers
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number_id TEXT NOT NULL,
  display_name TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, phone_number_id)
);

-- Enable RLS on meta_whatsapp_numbers
ALTER TABLE public.meta_whatsapp_numbers ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_whatsapp_numbers
CREATE POLICY "Users can view their own meta numbers"
ON public.meta_whatsapp_numbers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meta numbers"
ON public.meta_whatsapp_numbers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meta numbers"
ON public.meta_whatsapp_numbers
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meta numbers"
ON public.meta_whatsapp_numbers
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_provider ON public.conversations(provider);
CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_numbers_user_id ON public.meta_whatsapp_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_numbers_phone_id ON public.meta_whatsapp_numbers(phone_number_id);
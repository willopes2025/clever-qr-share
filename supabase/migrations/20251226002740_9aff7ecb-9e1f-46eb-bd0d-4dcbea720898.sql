-- Adicionar campos de configuração de voz ao ai_agent_configs
ALTER TABLE public.ai_agent_configs
ADD COLUMN IF NOT EXISTS response_mode TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL';

-- Adicionar constraint para response_mode
ALTER TABLE public.ai_agent_configs
ADD CONSTRAINT ai_agent_configs_response_mode_check 
CHECK (response_mode IN ('text', 'audio', 'both'));

-- Criar bucket para armazenar áudios TTS (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-audio', 'tts-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Policy para permitir leitura pública dos áudios
CREATE POLICY "Public read access for tts-audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'tts-audio');

-- Policy para permitir upload pelo service role
CREATE POLICY "Service role can upload tts-audio"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'tts-audio');

-- Policy para permitir delete pelo service role
CREATE POLICY "Service role can delete tts-audio"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'tts-audio');
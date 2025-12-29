import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detectar formato do áudio pela URL
const getAudioFormat = (url: string): string => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.mp3')) return 'mp3';
  if (urlLower.includes('.mp4') || urlLower.includes('.m4a')) return 'mp4';
  if (urlLower.includes('.ogg')) return 'ogg';
  if (urlLower.includes('.webm')) return 'webm';
  if (urlLower.includes('.wav')) return 'wav';
  if (urlLower.includes('.mpeg') || urlLower.includes('.mpga')) return 'mpeg';
  // Default para mp4 (comum em WhatsApp)
  return 'mp4';
};

// Obter extensão correta para o FormData
const getFileExtension = (format: string): string => {
  const extensions: Record<string, string> = {
    'mp3': 'mp3',
    'mp4': 'm4a',
    'ogg': 'ogg',
    'webm': 'webm',
    'wav': 'wav',
    'mpeg': 'mp3',
  };
  return extensions[format] || 'mp4';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openAIKey = Deno.env.get('OPENAI_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { messageId, audioUrl } = await req.json();

    if (!messageId || !audioUrl) {
      throw new Error('messageId and audioUrl are required');
    }

    console.log(`[TRANSCRIBE] Starting transcription for message ${messageId}`);
    console.log(`[TRANSCRIBE] Audio URL: ${audioUrl}`);

    // Detectar formato do áudio
    const audioFormat = getAudioFormat(audioUrl);
    const fileExtension = getFileExtension(audioFormat);
    console.log(`[TRANSCRIBE] Detected format: ${audioFormat}, extension: ${fileExtension}`);

    // Download do arquivo de áudio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error(`[TRANSCRIBE] Failed to download audio: ${audioResponse.status}`);
      throw new Error('Failed to download audio file');
    }

    const audioBlob = await audioResponse.blob();
    const audioSize = audioBlob.size;
    console.log(`[TRANSCRIBE] Audio downloaded, size: ${audioSize} bytes (${(audioSize / 1024 / 1024).toFixed(2)} MB)`);

    // Whisper suporta até 25MB
    const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
    if (audioSize > MAX_AUDIO_SIZE) {
      console.log(`[TRANSCRIBE] Audio too large: ${audioSize} bytes`);
      const transcription = '[Áudio muito grande para transcrição - máximo 25MB]';
      
      await supabase
        .from('inbox_messages')
        .update({ transcription })
        .eq('id', messageId);

      return new Response(
        JSON.stringify({ success: true, transcription }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se temos a chave da OpenAI
    if (!openAIKey) {
      console.error('[TRANSCRIBE] OPENAI_API_KEY not configured');
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Usar OpenAI Whisper para transcrição
    console.log('[TRANSCRIBE] Using OpenAI Whisper API...');
    
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${fileExtension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt'); // Português para melhor precisão

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error(`[TRANSCRIBE] Whisper API error: ${whisperResponse.status} - ${errorText}`);
      throw new Error(`Whisper API error: ${whisperResponse.status}`);
    }

    const whisperResult = await whisperResponse.json();
    const transcription = whisperResult.text || '[Transcrição não disponível]';

    console.log(`[TRANSCRIBE] Transcription successful: ${transcription.substring(0, 100)}...`);

    // Atualizar mensagem com a transcrição
    const { error: updateError } = await supabase
      .from('inbox_messages')
      .update({ transcription })
      .eq('id', messageId);

    if (updateError) {
      console.error('[TRANSCRIBE] Error updating message:', updateError);
      throw new Error('Failed to save transcription');
    }

    console.log(`[TRANSCRIBE] Message ${messageId} updated successfully`);

    return new Response(
      JSON.stringify({ success: true, transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TRANSCRIBE] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

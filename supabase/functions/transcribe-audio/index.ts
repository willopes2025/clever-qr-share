import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map content-type to Whisper-supported extension
const getExtensionFromContentType = (contentType: string | null, url: string): string => {
  // Check content-type header first
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('audio/mpeg') || ct.includes('audio/mp3')) return 'mp3';
    if (ct.includes('audio/mp4') || ct.includes('audio/m4a') || ct.includes('audio/x-m4a')) return 'm4a';
    if (ct.includes('audio/webm')) return 'webm';
    if (ct.includes('audio/wav') || ct.includes('audio/wave')) return 'wav';
    if (ct.includes('audio/ogg') || ct.includes('audio/opus')) return 'ogg';
    if (ct.includes('video/mp4')) return 'mp4'; // Some WhatsApp audios come as video/mp4
    if (ct.includes('video/webm')) return 'webm';
  }
  
  // Fallback to URL extension detection
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.mp3')) return 'mp3';
  if (urlLower.includes('.m4a')) return 'm4a';
  if (urlLower.includes('.mp4')) return 'mp4';
  if (urlLower.includes('.ogg') || urlLower.includes('.opus')) return 'ogg';
  if (urlLower.includes('.webm')) return 'webm';
  if (urlLower.includes('.wav')) return 'wav';
  
  // Default to mp4 (common for WhatsApp)
  return 'mp4';
};

// Get MIME type for FormData
const getMimeType = (extension: string): string => {
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'mp4': 'audio/mp4',
    'm4a': 'audio/mp4',
    'ogg': 'audio/ogg',
    'webm': 'audio/webm',
    'wav': 'audio/wav',
  };
  return mimeTypes[extension] || 'audio/mp4';
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

    // Download do arquivo de áudio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error(`[TRANSCRIBE] Failed to download audio: ${audioResponse.status}`);
      throw new Error('Failed to download audio file');
    }

    // Get content-type from response
    const contentType = audioResponse.headers.get('content-type');
    console.log(`[TRANSCRIBE] Content-Type from response: ${contentType}`);

    // Detect format from content-type or URL
    const fileExtension = getExtensionFromContentType(contentType, audioUrl);
    const mimeType = getMimeType(fileExtension);
    console.log(`[TRANSCRIBE] Using extension: ${fileExtension}, MIME type: ${mimeType}`);

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
    
    // Try with detected extension first, then fallback to alternatives
    const extensionsToTry = [fileExtension];
    
    // Add fallback extensions based on what we detected
    if (fileExtension === 'mp4' || fileExtension === 'm4a') {
      extensionsToTry.push('ogg', 'webm', 'mp3');
    } else if (fileExtension === 'ogg') {
      extensionsToTry.push('webm', 'mp4', 'mp3');
    } else {
      extensionsToTry.push('mp3', 'ogg', 'webm');
    }
    
    let whisperResult = null;
    let lastError = '';
    
    for (const ext of extensionsToTry) {
      console.log(`[TRANSCRIBE] Trying with extension: ${ext}`);
      
      const formData = new FormData();
      // Create a new blob with the correct MIME type
      const correctMimeType = getMimeType(ext);
      const audioBlobWithType = new Blob([await audioBlob.arrayBuffer()], { type: correctMimeType });
      formData.append('file', audioBlobWithType, `audio.${ext}`);
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
        },
        body: formData,
      });

      if (whisperResponse.ok) {
        whisperResult = await whisperResponse.json();
        console.log(`[TRANSCRIBE] Success with extension: ${ext}`);
        break;
      } else {
        const errorText = await whisperResponse.text();
        console.log(`[TRANSCRIBE] Failed with extension ${ext}: ${whisperResponse.status} - ${errorText}`);
        lastError = errorText;
      }
    }
    
    if (!whisperResult) {
      console.error(`[TRANSCRIBE] All format attempts failed. Last error: ${lastError}`);
      throw new Error('Could not transcribe audio - format not supported');
    }

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

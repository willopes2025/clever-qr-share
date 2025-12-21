import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { messageId, audioUrl } = await req.json();

    if (!messageId || !audioUrl) {
      throw new Error('messageId and audioUrl are required');
    }

    console.log(`Transcribing audio for message ${messageId}: ${audioUrl}`);

    // Download the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio file');
    }

    const audioBlob = await audioResponse.blob();
    const audioBase64 = await blobToBase64(audioBlob);

    console.log(`Audio downloaded, size: ${audioBlob.size} bytes`);

    // Use Lovable AI for transcription with Gemini
    const transcriptionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um transcritor de áudio. Sua tarefa é transcrever o áudio fornecido para texto. Retorne APENAS a transcrição, sem explicações adicionais. Se não conseguir transcrever ou o áudio estiver vazio, retorne "[Áudio não reconhecido]".'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcreva o seguinte áudio para texto:'
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: audioBase64,
                  format: 'wav'
                }
              }
            ]
          }
        ],
      }),
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('Lovable AI error:', transcriptionResponse.status, errorText);
      
      // Fallback: try with text-only prompt
      console.log('Falling back to text-only transcription...');
      
      const fallbackResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: `Não foi possível processar o áudio. Por favor, retorne: "[Transcrição indisponível - áudio não suportado]"`
            }
          ],
        }),
      });
      
      const fallbackData = await fallbackResponse.json();
      const fallbackText = fallbackData.choices?.[0]?.message?.content || '[Transcrição indisponível]';
      
      // Update message with fallback
      await supabase
        .from('inbox_messages')
        .update({ transcription: fallbackText })
        .eq('id', messageId);

      return new Response(
        JSON.stringify({ success: true, transcription: fallbackText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await transcriptionResponse.json();
    const transcription = data.choices?.[0]?.message?.content || '[Transcrição não disponível]';

    console.log('Transcription result:', transcription);

    // Update message with transcription
    const { error: updateError } = await supabase
      .from('inbox_messages')
      .update({ transcription })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw new Error('Failed to save transcription');
    }

    return new Response(
      JSON.stringify({ success: true, transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in transcribe-audio:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!ELEVENLABS_API_KEY) {
      console.error('[TTS] ELEVENLABS_API_KEY not configured');
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const { text, voiceId } = await req.json();

    if (!text) {
      throw new Error("Text is required");
    }

    // Use provided voiceId or default to Sarah (feminine voice)
    const selectedVoiceId = voiceId || 'EXAVITQu4vr4xnSDxMaL';

    console.log(`[TTS] Converting text to speech with voice ${selectedVoiceId}`);
    console.log(`[TTS] Text preview: ${text.substring(0, 100)}...`);

    // Call ElevenLabs Text-to-Speech API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          output_format: "mp3_44100_128",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TTS] ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    // Get audio as ArrayBuffer
    const audioBuffer = await response.arrayBuffer();
    console.log(`[TTS] Audio generated, size: ${audioBuffer.byteLength} bytes`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique filename
    const fileName = `tts/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('tts-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('[TTS] Upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('tts-audio')
      .getPublicUrl(fileName);

    console.log(`[TTS] Audio uploaded successfully: ${publicUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioUrl: publicUrl,
        fileName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[TTS] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

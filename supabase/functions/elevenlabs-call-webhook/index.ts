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

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const payload = await req.json();
    console.log('Webhook ElevenLabs recebido:', JSON.stringify(payload, null, 2));

    const { 
      event_type,
      conversation_id,
      call_id,
      sip_call_id,
      status,
      duration_seconds,
      transcript,
      recording_url,
      ended_reason,
      call_successful
    } = payload;

    // Map ElevenLabs event types to our status
    let mappedStatus = status;
    if (event_type === 'call.started' || event_type === 'call.ringing') {
      mappedStatus = 'ringing';
    } else if (event_type === 'call.connected' || event_type === 'call.answered') {
      mappedStatus = 'connected';
    } else if (event_type === 'call.ended' || event_type === 'call.completed') {
      mappedStatus = call_successful ? 'completed' : 'failed';
    } else if (event_type === 'call.failed') {
      mappedStatus = 'failed';
    }

    // Find the call record
    let query = supabaseClient.from('ai_phone_calls').select('*');
    
    if (conversation_id) {
      query = query.eq('elevenlabs_conversation_id', conversation_id);
    } else if (sip_call_id || call_id) {
      query = query.eq('sip_call_id', sip_call_id || call_id);
    } else {
      console.log('Nenhum identificador de chamada no payload');
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook processado, sem identificador' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callRecords, error: findError } = await query.limit(1);

    if (findError) {
      console.error('Erro ao buscar chamada:', findError);
      throw new Error('Erro ao buscar registro da chamada');
    }

    if (!callRecords || callRecords.length === 0) {
      console.log('Chamada não encontrada para:', { conversation_id, sip_call_id, call_id });
      return new Response(
        JSON.stringify({ success: true, message: 'Chamada não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callRecord = callRecords[0];
    console.log('Chamada encontrada:', callRecord.id);

    // Prepare update data
    const updateData: Record<string, any> = {
      status: mappedStatus,
    };

    if (duration_seconds !== undefined) {
      updateData.duration_seconds = duration_seconds;
    }

    if (transcript) {
      // Format transcript if it's an array of messages
      if (Array.isArray(transcript)) {
        updateData.transcript = transcript
          .map((msg: any) => `${msg.role || 'unknown'}: ${msg.content || msg.message || ''}`)
          .join('\n');
      } else {
        updateData.transcript = transcript;
      }
    }

    if (recording_url) {
      updateData.recording_url = recording_url;
    }

    if (ended_reason && !call_successful) {
      updateData.error_message = ended_reason;
    }

    if (mappedStatus === 'completed' || mappedStatus === 'failed') {
      updateData.ended_at = new Date().toISOString();
    }

    // Update call record
    const { error: updateError } = await supabaseClient
      .from('ai_phone_calls')
      .update(updateData)
      .eq('id', callRecord.id);

    if (updateError) {
      console.error('Erro ao atualizar chamada:', updateError);
      throw new Error('Erro ao atualizar registro da chamada');
    }

    console.log('Chamada atualizada com sucesso:', callRecord.id, updateData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processado com sucesso',
        call_id: callRecord.id,
        status: mappedStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

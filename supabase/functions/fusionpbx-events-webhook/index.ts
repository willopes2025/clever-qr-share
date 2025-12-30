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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const payload = await req.json();
    
    console.log('[FUSIONPBX-WEBHOOK] Received event:', JSON.stringify(payload, null, 2));

    const {
      event_type,
      call_uuid,
      caller_id_number,
      caller_id_name,
      destination_number,
      domain,
      duration,
      billsec,
      hangup_cause,
      recording_url,
      extension
    } = payload;

    // Buscar a chamada pelo UUID ou números
    let callQuery = supabase
      .from('voip_calls')
      .select('*');

    if (call_uuid) {
      callQuery = callQuery.eq('provider_call_id', call_uuid);
    } else if (caller_id_number && destination_number) {
      // Tentar encontrar por números
      callQuery = callQuery
        .or(`from_number.eq.${caller_id_number},to_number.eq.${destination_number}`)
        .eq('status', 'ringing')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: calls, error: callError } = await callQuery;

    let callRecord = calls?.[0];

    // Processar evento
    switch (event_type) {
      case 'CHANNEL_CREATE':
      case 'CHANNEL_ORIGINATE':
        console.log('[FUSIONPBX-WEBHOOK] Call initiated');
        if (callRecord) {
          await supabase
            .from('voip_calls')
            .update({ 
              status: 'ringing',
              provider_call_id: call_uuid
            })
            .eq('id', callRecord.id);
        }
        break;

      case 'CHANNEL_ANSWER':
        console.log('[FUSIONPBX-WEBHOOK] Call answered');
        if (callRecord) {
          await supabase
            .from('voip_calls')
            .update({ 
              status: 'in_progress',
              started_at: new Date().toISOString()
            })
            .eq('id', callRecord.id);
        }
        break;

      case 'CHANNEL_HANGUP':
      case 'CHANNEL_HANGUP_COMPLETE':
        console.log('[FUSIONPBX-WEBHOOK] Call ended:', hangup_cause);
        if (callRecord) {
          const durationSeconds = parseInt(billsec || duration || '0');
          
          await supabase
            .from('voip_calls')
            .update({ 
              status: 'completed',
              ended_at: new Date().toISOString(),
              duration_seconds: durationSeconds,
              recording_url: recording_url || null,
              notes: hangup_cause ? `Hangup cause: ${hangup_cause}` : null
            })
            .eq('id', callRecord.id);
        }
        break;

      case 'RECORD_START':
        console.log('[FUSIONPBX-WEBHOOK] Recording started');
        break;

      case 'RECORD_STOP':
        console.log('[FUSIONPBX-WEBHOOK] Recording stopped:', recording_url);
        if (callRecord && recording_url) {
          await supabase
            .from('voip_calls')
            .update({ recording_url })
            .eq('id', callRecord.id);
        }
        break;

      case 'DTMF':
        console.log('[FUSIONPBX-WEBHOOK] DTMF received:', payload.dtmf_digit);
        break;

      default:
        console.log('[FUSIONPBX-WEBHOOK] Unhandled event type:', event_type);
    }

    // Registrar evento
    if (callRecord) {
      await supabase
        .from('call_events')
        .insert({
          call_id: callRecord.id,
          event_type: event_type?.toLowerCase() || 'unknown',
          event_data: payload
        });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[FUSIONPBX-WEBHOOK] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      toNumber, 
      extensionId, 
      contactId, 
      conversationId,
      callType = 'outbound'
    } = await req.json();

    if (!toNumber) {
      throw new Error('Destination number is required');
    }

    console.log('[FUSIONPBX-ORIGINATE] Starting call:', { toNumber, extensionId, callType });

    // Buscar extensão do usuário
    let extQuery = supabase
      .from('extensions')
      .select(`
        *,
        fusionpbx_configs (
          id,
          domain,
          api_url,
          api_key,
          api_secret
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (extensionId) {
      extQuery = extQuery.eq('id', extensionId);
    }

    const { data: extensions, error: extError } = await extQuery.limit(1);

    if (extError || !extensions || extensions.length === 0) {
      console.error('[FUSIONPBX-ORIGINATE] Extension error:', extError);
      throw new Error('No active extension found');
    }

    const extension = extensions[0];
    const fusionConfig = extension.fusionpbx_configs;

    if (!fusionConfig || !fusionConfig.api_url) {
      throw new Error('FusionPBX API not configured');
    }

    // Criar registro de chamada no banco
    const { data: callRecord, error: callError } = await supabase
      .from('voip_calls')
      .insert({
        user_id: user.id,
        contact_id: contactId || null,
        conversation_id: conversationId || null,
        extension_id: extension.id,
        from_number: extension.caller_id_number || extension.extension_number,
        to_number: toNumber,
        direction: 'outbound',
        status: 'initiating',
        provider: 'fusionpbx',
        call_type: callType
      })
      .select()
      .single();

    if (callError) {
      console.error('[FUSIONPBX-ORIGINATE] Error creating call record:', callError);
      throw new Error('Failed to create call record');
    }

    console.log('[FUSIONPBX-ORIGINATE] Call record created:', callRecord.id);

    // Chamar API do FusionPBX para originar chamada (se click-to-call)
    if (callType === 'click-to-call') {
      const originateUrl = `${fusionConfig.api_url}/app/click_to_call/click_to_call.php`;
      
      const originateParams = new URLSearchParams({
        key: fusionConfig.api_key,
        src: extension.extension_number,
        dest: toNumber.replace(/\D/g, ''),
        auto_answer: 'true',
        cid_name: extension.caller_id_name || 'Outbound Call',
        cid_number: extension.caller_id_number || extension.extension_number
      });

      console.log('[FUSIONPBX-ORIGINATE] Calling FusionPBX API:', originateUrl);

      const originateResponse = await fetch(`${originateUrl}?${originateParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const originateResult = await originateResponse.text();
      console.log('[FUSIONPBX-ORIGINATE] FusionPBX response:', originateResult);

      if (!originateResponse.ok) {
        // Atualizar status da chamada para falha
        await supabase
          .from('voip_calls')
          .update({ 
            status: 'failed',
            notes: `FusionPBX error: ${originateResult}`
          })
          .eq('id', callRecord.id);

        throw new Error(`FusionPBX API error: ${originateResult}`);
      }

      // Atualizar status para ringing
      await supabase
        .from('voip_calls')
        .update({ status: 'ringing' })
        .eq('id', callRecord.id);
    }

    // Registrar evento de início
    await supabase
      .from('call_events')
      .insert({
        call_id: callRecord.id,
        event_type: 'call_initiated',
        event_data: {
          to_number: toNumber,
          extension: extension.extension_number,
          call_type: callType
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        callId: callRecord.id,
        status: callType === 'click-to-call' ? 'ringing' : 'initiating',
        message: callType === 'click-to-call' 
          ? 'Call originated, your phone will ring' 
          : 'Call record created for WebRTC'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[FUSIONPBX-ORIGINATE] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error'
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
